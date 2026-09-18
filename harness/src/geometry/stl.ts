/**
 * STL ingestion.
 *
 * The harness has always reasoned over declared geometry: a spec says "wall 1.5mm,
 * bbox 90x90x110" and the engine believes it. This measures the mesh instead, so
 * the numbers the cost model and the DFM checks use come from the actual solid.
 *
 * Deliberately pure: it takes bytes and returns a summary. No file I/O, so the
 * same code runs in Node, in the CLI and inside the bundled Worker build.
 *
 * Units are assumed to be millimetres, which is what every mechanical STL in this
 * pipeline uses. STEP (B-rep, not a mesh) is still out of scope.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface StlGeometry {
  format: 'binary' | 'ascii';
  triangles: number;
  /** Measured bounding box, mm. */
  bboxMm: Vec3;
  /** Enclosed volume, mm^3. Meaningless if `watertight` is false. */
  volumeMm3: number;
  surfaceAreaMm2: number;
  /** Every edge shared by exactly two triangles. A hole or stray facet breaks this. */
  watertight: boolean;
}

type Triangle = [Vec3, Vec3, Vec3];

/**
 * Binary STLs are 84 + 50n bytes exactly, which is a far more reliable signal than
 * the leading "solid" string - binary exporters happily write that too.
 */
function looksBinary(data: Uint8Array): boolean {
  if (data.length < 84) return false;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return 84 + 50 * view.getUint32(80, true) === data.length;
}

function readBinary(data: Uint8Array): Triangle[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const count = view.getUint32(80, true);
  const triangles: Triangle[] = [];
  for (let i = 0; i < count; i++) {
    const base = 84 + i * 50 + 12; // skip the facet normal
    const vertex = (k: number): Vec3 => ({
      x: view.getFloat32(base + k * 12, true),
      y: view.getFloat32(base + k * 12 + 4, true),
      z: view.getFloat32(base + k * 12 + 8, true),
    });
    triangles.push([vertex(0), vertex(1), vertex(2)]);
  }
  return triangles;
}

function readAscii(text: string): Triangle[] {
  // Group the "vertex x y z" lines three at a time, in file order.
  const vertices: Vec3[] = [];
  const re = /vertex\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    vertices.push({ x: Number(match[1]), y: Number(match[2]), z: Number(match[3]) });
  }
  const triangles: Triangle[] = [];
  for (let i = 0; i + 2 < vertices.length; i += 3) {
    triangles.push([vertices[i]!, vertices[i + 1]!, vertices[i + 2]!]);
  }
  return triangles;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Signed volume of the tetrahedron to the origin; the sum over a closed mesh is the volume. */
function signedTetraVolume(a: Vec3, b: Vec3, c: Vec3): number {
  return dot(a, cross(b, c)) / 6;
}

function edgeKey(a: Vec3, b: Vec3): string {
  // Quantise so float noise between neighbouring facets does not split an edge.
  const q = (n: number) => Math.round(n * 1e4) / 1e4;
  const one = `${q(a.x)},${q(a.y)},${q(a.z)}`;
  const two = `${q(b.x)},${q(b.y)},${q(b.z)}`;
  return one < two ? `${one}|${two}` : `${two}|${one}`;
}

function magnitude(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function summarise(triangles: Triangle[], format: StlGeometry['format']): StlGeometry {
  let min: Vec3 | null = null;
  let max: Vec3 | null = null;
  let volume = 0;
  let area = 0;
  const edges = new Map<string, number>();

  for (const [a, b, c] of triangles) {
    for (const v of [a, b, c]) {
      min = min ? { x: Math.min(min.x, v.x), y: Math.min(min.y, v.y), z: Math.min(min.z, v.z) } : { ...v };
      max = max ? { x: Math.max(max.x, v.x), y: Math.max(max.y, v.y), z: Math.max(max.z, v.z) } : { ...v };
    }
    volume += signedTetraVolume(a, b, c);
    area += magnitude(cross(sub(b, a), sub(c, a))) / 2;
    for (const [p, q] of [
      [a, b],
      [b, c],
      [c, a],
    ] as Array<[Vec3, Vec3]>) {
      const key = edgeKey(p, q);
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }

  const bboxMm = min && max ? sub(max, min) : { x: 0, y: 0, z: 0 };
  // A closed surface has every edge shared by exactly two triangles.
  const watertight = triangles.length >= 4 && [...edges.values()].every((n) => n === 2);

  return {
    format,
    triangles: triangles.length,
    bboxMm,
    volumeMm3: Math.abs(volume),
    surfaceAreaMm2: area,
    watertight,
  };
}

/** Parse binary or ASCII STL bytes into a measured summary. */
export function parseStl(data: Uint8Array): StlGeometry {
  const binary = looksBinary(data);
  const triangles = binary ? readBinary(data) : readAscii(new TextDecoder().decode(data));
  return summarise(triangles, binary ? 'binary' : 'ascii');
}

/** Convenience: the shape a `Part.measured` field expects. */
export function measuredFromStl(data: Uint8Array): {
  source: 'stl';
  bboxMm: Vec3;
  volumeMm3: number;
  watertight: boolean;
  triangles: number;
} {
  const g = parseStl(data);
  return {
    source: 'stl',
    bboxMm: g.bboxMm,
    volumeMm3: g.volumeMm3,
    watertight: g.watertight,
    triangles: g.triangles,
  };
}
