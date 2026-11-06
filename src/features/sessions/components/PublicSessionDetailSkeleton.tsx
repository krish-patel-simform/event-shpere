/** What a session's public page shows while it loads: the hero, then the text and the speakers. */
export function PublicSessionDetailSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading session"
      className="mx-auto max-w-6xl animate-pulse space-y-6 motion-reduce:animate-none"
    >
      <div className="h-4 w-64 rounded bg-surface-subtle" />
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="h-55 bg-surface-subtle" />
        <div className="space-y-3 p-6">
          <div className="h-5 w-32 rounded bg-surface-subtle" />
          <div className="h-8 w-3/4 rounded bg-surface-subtle" />
          <div className="h-4 w-1/2 rounded bg-surface-subtle" />
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[2_1_28rem] space-y-3 rounded-lg border border-line bg-surface p-6">
          <div className="h-5 w-24 rounded bg-surface-subtle" />
          <div className="h-4 rounded bg-surface-subtle" />
          <div className="h-4 w-5/6 rounded bg-surface-subtle" />
          <div className="h-4 w-2/3 rounded bg-surface-subtle" />
        </div>
        <div className="flex-[1_1_18rem] space-y-3 rounded-lg border border-line bg-surface p-6">
          <div className="h-5 w-24 rounded bg-surface-subtle" />
          <div className="h-10 rounded bg-surface-subtle" />
          <div className="h-10 rounded bg-surface-subtle" />
        </div>
      </div>
    </div>
  );
}
