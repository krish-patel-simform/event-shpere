/** What the list looks like while it loads: a few grey rows in the shape of the table rows. */
export function SessionListSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading sessions"
      className="animate-pulse space-y-4 p-5 motion-reduce:animate-none"
    >
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex items-center gap-4">
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-surface-subtle" />
            <div className="h-3 w-1/3 rounded bg-surface-subtle" />
          </div>
          <div className="hidden h-4 w-24 rounded bg-surface-subtle sm:block" />
          <div className="h-6 w-20 rounded bg-surface-subtle" />
        </div>
      ))}
    </div>
  );
}
