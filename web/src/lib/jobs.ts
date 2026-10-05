import { generateSpec, refineSpec, type TargetRequest } from "./ai/generate";
import { createDesign } from "./create-design";
import { getDesign, updateJob } from "./db/queries";
import type { SpecInput } from "./spec-schema";

export type GeneratePayload = { prompt: string; target?: TargetRequest; remixOf?: string };
export type RefinePayload = { designId: string; request: string };

/** Real pipeline stages, in order. The client renders these as progress. */
export type JobStage = "drafting" | "scoring" | "publishing" | "done" | "failed";

async function setStage(jobId: string, stage: JobStage, note?: string, send?: (stage: string) => void) {
  const label = note ? `${stage} (${note})` : stage;
  send?.(label);
  await updateJob(jobId, { status: stage === "done" ? "done" : stage === "failed" ? "failed" : "running", stage: label }).catch(
    () => {},
  );
}

async function fail(jobId: string, error: string) {
  await updateJob(jobId, { status: "failed", stage: "failed", error }).catch(() => {});
}

/**
 * Run a generate job to completion, reporting real stages. The caller streams
 * them (SSE) and records them (D1) — the same run feeds both.
 */
export async function runGenerateJob(
  jobId: string,
  payload: GeneratePayload,
  send?: (stage: string) => void,
): Promise<{ slug: string } | { error: string }> {
  try {
    await setStage(jobId, "drafting", undefined, send);
    const result = await generateSpec(payload.prompt, payload.target, {
      onAttempt: (n) => {
        if (n > 1) void setStage(jobId, "drafting", `attempt ${n}/3`, send);
      },
    });
    if ("error" in result) {
      await fail(jobId, result.error);
      return { error: result.error };
    }
    if (payload.target) {
      result.spec.target = {
        platform: "muse-gadgets",
        sdk: payload.target.sdk,
        board: payload.target.board,
        capabilities: result.spec.target?.board === payload.target.board ? result.spec.target?.capabilities : undefined,
      };
    }
    const created = await createDesign(
      { prompt: payload.prompt, spec: result.spec, model: result.model, remixOf: payload.remixOf },
      { onStage: (s) => void setStage(jobId, s, undefined, send) },
    );
    await updateJob(jobId, { status: "done", stage: "done", resultSlug: created.slug }).catch(() => {});
    return { slug: created.slug };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Generation failed.";
    await fail(jobId, error);
    return { error };
  }
}

/** Same pipeline for a refinement: original spec + change request → remix. */
export async function runRefineJob(
  jobId: string,
  payload: RefinePayload,
  send?: (stage: string) => void,
): Promise<{ slug: string } | { error: string }> {
  try {
    const original = await getDesign(payload.designId);
    if (!original) {
      await fail(jobId, "That design no longer exists.");
      return { error: "That design no longer exists." };
    }
    let spec: SpecInput;
    try {
      spec = JSON.parse(original.specJson) as SpecInput;
    } catch {
      await fail(jobId, "The original spec is unreadable, so there is nothing to revise.");
      return { error: "The original spec is unreadable, so there is nothing to revise." };
    }
    const t = spec.target;
    const target: TargetRequest | undefined =
      t && t.platform === "muse-gadgets" && (t.sdk === "esp32" || t.sdk === "linux") && t.board
        ? { sdk: t.sdk, board: t.board, label: t.board }
        : undefined;

    await setStage(jobId, "drafting", undefined, send);
    const result = await refineSpec(spec, payload.request, target, {
      onAttempt: (n) => {
        if (n > 1) void setStage(jobId, "drafting", `attempt ${n}/3`, send);
      },
    });
    if ("error" in result) {
      await fail(jobId, result.error);
      return { error: result.error };
    }
    if (target) {
      result.spec.target = {
        platform: "muse-gadgets",
        sdk: target.sdk,
        board: target.board,
        capabilities: result.spec.target?.board === target.board ? result.spec.target?.capabilities : undefined,
      };
    }
    const created = await createDesign(
      {
        prompt: `Refinement of ${original.title}: ${payload.request}`.slice(0, 500),
        spec: result.spec,
        model: result.model,
        remixOf: payload.designId,
      },
      { onStage: (s) => void setStage(jobId, s, undefined, send) },
    );
    await updateJob(jobId, { status: "done", stage: "done", resultSlug: created.slug }).catch(() => {});
    return { slug: created.slug };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Refinement failed.";
    await fail(jobId, error);
    return { error };
  }
}
