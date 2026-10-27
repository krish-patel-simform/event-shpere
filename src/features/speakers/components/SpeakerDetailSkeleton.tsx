/** A grey placeholder bar or block; the pulse is on the parent. */
function Bone({ className }: { className: string }) {
  return <div className={`rounded bg-surface-subtle ${className}`} />;
}

/**
 * What the speaker page looks like while it loads: the same shape as the loaded page (breadcrumb,
 * photo and name card, About card), so nothing jumps when the speaker arrives.
 */
export function SpeakerDetailSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading speaker"
      className="mx-auto max-w-5xl animate-pulse space-y-5 motion-reduce:animate-none"
    >
      <Bone className="h-4 w-44" />

      <div className="flex flex-wrap items-center gap-6 rounded-lg border border-line bg-surface p-5">
        <div className="size-28 shrink-0 rounded-full bg-surface-subtle" />
        <div className="min-w-0 flex-1 basis-80 space-y-3">
          <Bone className="h-7 w-56" />
          <Bone className="h-5 w-72 max-w-full" />
          <div className="flex gap-2">
            <Bone className="h-7 w-20" />
            <Bone className="h-7 w-24" />
            <Bone className="h-7 w-16" />
          </div>
          <div className="flex gap-2">
            <Bone className="h-9 w-24" />
            <Bone className="h-9 w-24" />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-line bg-surface p-5">
        <Bone className="h-5 w-20" />
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-11/12" />
        <Bone className="h-4 w-2/3" />
      </div>
    </div>
  );
}
