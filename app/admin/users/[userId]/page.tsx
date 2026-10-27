import type { Metadata } from "next";
import { Suspense } from "react";
import { PermissionGate } from "@/src/features/auth";
import { AdminUserDetail } from "@/src/features/users";

export const metadata: Metadata = { title: "User profile" };

// Admin only, like the list: reading needs USER_VIEW, suspending needs USER_STATUS_MANAGE. A guest
// sees "log in", anyone else without them "no access". The API checks the same permissions.
export default function AdminUserDetailPage(
  props: PageProps<"/admin/users/[userId]">,
) {
  return (
    <PermissionGate permissions={["USER_VIEW", "USER_STATUS_MANAGE"]}>
      {/* params is request data: with cacheComponents it must be read inside Suspense. */}
      <Suspense fallback={null}>
        <UserSection params={props.params} />
      </Suspense>
    </PermissionGate>
  );
}

async function UserSection({
  params,
}: Pick<PageProps<"/admin/users/[userId]">, "params">) {
  const { userId } = await params;
  // Whether this id is a user is decided by the API: an unknown or badly formed id is a 404 or 400.
  return <AdminUserDetail userId={userId} />;
}
