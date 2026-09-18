export default function Loading() {
  return (
    <div className="flex items-center gap-3 py-20 text-sm text-muted">
      <span className="h-3 w-3 animate-pulse rounded-full bg-accent" />
      Loading…
    </div>
  );
}
