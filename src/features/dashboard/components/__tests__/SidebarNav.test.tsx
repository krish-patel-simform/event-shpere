/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import {
  authQueryKeys,
  PermissionProvider,
  type MeDto,
} from "@/src/features/auth";
import { SidebarNav } from "../SidebarNav";

jest.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

const baseMe: Omit<MeDto, "role" | "permissions"> = {
  id: "0b0f6a1e-6a0d-4f6e-9a55-1f6f2f0f9a11",
  firstName: "Ananya",
  lastName: "Rao",
  email: "ananya@example.com",
};

// The user is put in the cache first: the provider reuses it and makes no request.
function renderNavFor(role: MeDto["role"], permissions: string[]) {
  const client = new QueryClient();
  client.setQueryData(authQueryKeys.me, { ...baseMe, role, permissions });
  render(
    <QueryClientProvider client={client}>
      <PermissionProvider>
        <SidebarNav />
      </PermissionProvider>
    </QueryClientProvider>,
  );
}

const links = () => screen.getAllByRole("link").map((link) => link.textContent);

describe("SidebarNav", () => {
  it("an attendee sees the public links, the dashboard and their own activity", () => {
    renderNavFor("user", [
      "REGISTRATION_VIEW_OWN",
      "SCHEDULE_MANAGE",
      "NOTIFICATION_VIEW",
      "PROFILE_VIEW",
    ]);

    expect(links()).toEqual([
      "Dashboard",
      "Browse events",
      "Speakers",
      "My events",
      "My schedule",
      "Notifications",
      "Profile & settings",
    ]);
  });

  it("drops links without the permission, and a section left empty loses its heading", () => {
    // An organizer does not register for events: no "My activity" links.
    renderNavFor("organizer", ["NOTIFICATION_VIEW", "PROFILE_VIEW"]);

    expect(links()).not.toContain("My events");
    expect(links()).not.toContain("My schedule");
    expect(screen.queryByText("My activity")).not.toBeInTheDocument();
    expect(links()).toContain("Dashboard");
  });
});
