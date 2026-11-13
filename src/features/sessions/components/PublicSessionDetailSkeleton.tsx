/** What a session's public page shows while it loads: the hero, then the text and the side cards. */
export function PublicSessionDetailSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading session"
      className="mx-auto max-w-6xl animate-pulse space-y-6 motion-reduce:animate-none"
    >
      <div className="h-4 w-64 rounded bg-surface-subtle" />
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="aspect-video max-h-96 bg-surface-subtle sm:aspect-[21/9]" />
        <div className="space-y-3 p-6 sm:p-8">
          <div className="h-9 w-3/4 rounded bg-surface-subtle" />
          <div className="h-4 w-1/3 rounded bg-surface-subtle" />
          <div className="flex flex-wrap gap-3 pt-1">
            <div className="h-9 w-64 rounded-lg bg-surface-subtle" />
            <div className="h-9 w-56 rounded-lg bg-surface-subtle" />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[2_1_28rem] space-y-6">
          <div className="space-y-3 rounded-lg border border-line bg-surface p-6">
            <div className="h-5 w-40 rounded bg-surface-subtle" />
            <div className="h-4 rounded bg-surface-subtle" />
            <div className="h-4 w-5/6 rounded bg-surface-subtle" />
            <div className="h-4 w-2/3 rounded bg-surface-subtle" />
          </div>
          <div className="space-y-3 rounded-lg border border-line bg-surface p-6">
            <div className="h-5 w-24 rounded bg-surface-subtle" />
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-full bg-surface-subtle" />
              <div className="h-4 w-40 rounded bg-surface-subtle" />
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-[1_1_20rem] space-y-6">
          <div className="space-y-3 rounded-lg border border-line bg-surface p-6">
            <div className="h-5 w-32 rounded bg-surface-subtle" />
            <div className="h-8 w-24 rounded bg-surface-subtle" />
            <div className="h-2 rounded-full bg-surface-subtle" />
            <div className="h-10 rounded bg-surface-subtle" />
          </div>
          <div className="space-y-3 rounded-lg border border-line bg-surface p-6">
            <div className="h-5 w-20 rounded bg-surface-subtle" />
            <div className="h-4 rounded bg-surface-subtle" />
            <div className="h-4 w-4/5 rounded bg-surface-subtle" />
          </div>
        </div>
      </div>
    </div>
  );
}
