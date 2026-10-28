/** A grey placeholder block; the pulse is on the parent. */
function Bone({ className }: { className: string }) {
  return <div className={`rounded bg-surface-subtle ${className}`} />;
}

/**
 * What the session page looks like while it loads: the same shape as the loaded page (breadcrumb,
 * header card, a wide and a narrow column), so nothing jumps when the session arrives.
 */
export function SessionDetailSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading session"
      className="mx-auto max-w-6xl animate-pulse space-y-5 motion-reduce:animate-none"
    >
      <Bone className="h-4 w-56" />
      <div className="space-y-3 rounded-lg border border-line bg-surface p-5">
        <div className="flex gap-2">
          <Bone className="h-6 w-24" />
          <Bone className="h-6 w-28" />
          <Bone className="h-6 w-32" />
        </div>
        <Bone className="h-7 w-3/4" />
        <Bone className="h-4 w-1/2" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <Bone className="h-48 w-full" />
          <Bone className="h-40 w-full" />
        </div>
        <div className="space-y-5">
          <Bone className="h-56 w-full" />
          <Bone className="h-40 w-full" />
        </div>
      </div>
    </div>
  );
}
