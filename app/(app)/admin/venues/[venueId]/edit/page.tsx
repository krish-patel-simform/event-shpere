import type { Metadata } from "next";
import { Suspense } from "react";
import { PermissionGate } from "@/src/features/auth";
import { AdminVenueEdit } from "@/src/features/venues";

export const metadata: Metadata = { title: "Edit venue" };

// Admin only: editing a venue needs VENUE_MANAGE. The API checks it again.
export default function AdminVenueEditPage(
  props: PageProps<"/admin/venues/[venueId]/edit">,
) {
  return (
    <PermissionGate permissions={["VENUE_MANAGE"]}>
      {/* params is request data: with cacheComponents it must be read inside Suspense. */}
      <Suspense fallback={null}>
        <EditSection params={props.params} />
      </Suspense>
    </PermissionGate>
  );
}

async function EditSection({
  params,
}: Pick<PageProps<"/admin/venues/[venueId]/edit">, "params">) {
  const { venueId } = await params;
  return <AdminVenueEdit venueId={venueId} />;
}
