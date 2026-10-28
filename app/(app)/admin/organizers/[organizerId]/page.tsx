import type { Metadata } from "next";
import { Suspense } from "react";
import { PermissionGate } from "@/src/features/auth";
import { AdminOrganizerReview } from "@/src/features/organizer";
import { USER_ROUTES } from "@/src/features/users";

export const metadata: Metadata = { title: "Review organizer application" };

// Admin only, like the list: reading needs ORGANIZER_MANAGE and a decision needs ORGANIZER_VERIFY.
// A guest sees "log in", anyone else without them "no access". The API checks the same permissions.
export default function AdminOrganizerReviewPage(
  props: PageProps<"/admin/organizers/[organizerId]">,
) {
  return (
    <PermissionGate permissions={["ORGANIZER_MANAGE", "ORGANIZER_VERIFY"]}>
      {/* params is request data: with cacheComponents it must be read inside Suspense. */}
      <Suspense fallback={null}>
        <ReviewSection params={props.params} />
      </Suspense>
    </PermissionGate>
  );
}

async function ReviewSection({
  params,
}: Pick<PageProps<"/admin/organizers/[organizerId]">, "params">) {
  const { organizerId } = await params;
  // Whether this id is an application is decided by the API: an unknown or badly formed id is a
  // 404 or 400. The users feature owns the profile page; this page only links to it.
  return (
    <AdminOrganizerReview
      organizerId={organizerId}
      applicantProfileBase={USER_ROUTES.list}
    />
  );
}
