import { Alert } from "@/src/core/ui";

/** Says plainly that the screen shows example data: the sessions API does not exist yet. */
export function SampleDataNotice({ children }: { children?: string }) {
  return (
    <Alert tone="info" title="Sample data">
      {children ??
        "These sessions are examples. Nothing is loaded from the server yet."}
    </Alert>
  );
}
