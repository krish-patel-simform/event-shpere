/** What the event's public page shows while it loads: the hero and the registration box. */
export function PublicEventDetailSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading event"
      className="mx-auto flex max-w-6xl animate-pulse flex-wrap items-start gap-6 motion-reduce:animate-none"
    >
      <div className="min-w-0 flex-[3_1_32rem] overflow-hidden rounded-lg border border-line bg-surface">
        <div className="h-55 bg-surface-subtle" />
        <div className="space-y-3 p-6">
          <div className="h-5 w-40 rounded bg-surface-subtle" />
          <div className="h-8 w-3/4 rounded bg-surface-subtle" />
          <div className="h-4 w-1/2 rounded bg-surface-subtle" />
          <div className="h-4 w-2/5 rounded bg-surface-subtle" />
        </div>
      </div>
      <div className="flex-[1_1_20rem] space-y-4 rounded-lg border border-line bg-surface p-6">
        <div className="h-8 w-24 rounded bg-surface-subtle" />
        <div className="h-4 w-40 rounded bg-surface-subtle" />
        <div className="h-10 rounded bg-surface-subtle" />
      </div>
    </div>
  );
}
