"use client";

import { useMe, usePermissions } from "@/src/features/auth";
import type { RegistrationViewer } from "../utils/registration-card-state";

/**
 * Guest, attendee or organizer/admin, for the registration and booking cards: it decides whether
 * route 2 is asked at all (the API answers a guest 401 and staff 403). `retry` loads the account
 * again after it failed with something other than a 401.
 */
export function useRegistrationViewer(): {
  viewer: RegistrationViewer;
  retry: () => void;
} {
  const { isLoading, isGuest, hasPermission } = usePermissions();
  // The provider already loaded the user: this reads the same cache, no second request.
  const me = useMe({ refetchOnMount: false });
  const retry = () => void me.refetch();
  if (isLoading) return { viewer: "loading", retry };
  if (isGuest) return { viewer: "guest", retry };
  if (me.isError) return { viewer: "unknown", retry };
  return {
    viewer: hasPermission("REGISTRATION_CREATE") ? "attendee" : "staff",
    retry,
  };
}
