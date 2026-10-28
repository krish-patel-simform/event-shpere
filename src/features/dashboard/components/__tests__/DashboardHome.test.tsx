/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import {
  authQueryKeys,
  PermissionProvider,
  type MeDto,
} from "@/src/features/auth";
import { DashboardHome } from "../DashboardHome";
import { WeeklySignupsChart } from "../admin/WeeklySignupsChart";
import type { OrganizerApplication } from "../OrganizerReviewStatus";

// ECharts needs a canvas (tested on its own in core/charts): a stand-in with the same name.
jest.mock("@/src/core/charts/EChart", () => ({
  EChart: ({ ariaLabel }: { ariaLabel: string }) => (
    <div role="img" aria-label={ariaLabel} />
  ),
}));

const application: OrganizerApplication = {
  status: "pending",
  organisationName: "Acme Events Pvt Ltd",
  website: null,
  contactName: "Ananya Rao",
  contactEmail: "ananya.rao@example.com",
  submittedAt: "2026-10-20T11:24:00Z",
  emailVerifiedAt: "2026-10-20T11:30:00Z",
};

// The user is put in the cache first: the provider reuses it and makes no request.
function renderHome(role: MeDto["role"], permissions: string[]) {
  const client = new QueryClient();
  client.setQueryData(authQueryKeys.me, {
    id: "0b0f6a1e-6a0d-4f6e-9a55-1f6f2f0f9a11",
    firstName: "Neha",
    lastName: "Shah",
    email: "neha@example.com",
    role,
    permissions,
  } satisfies MeDto);
  render(
    <QueryClientProvider client={client}>
      <PermissionProvider>
        <DashboardHome organizerApplication={application} />
      </PermissionProvider>
    </QueryClientProvider>,
  );
}

describe("DashboardHome", () => {
  it("platform-wide analytics permission: the admin's platform overview", async () => {
    renderHome("admin", ["ANALYTICS_VIEW_ALL", "ORGANIZER_VERIFY"]);

    expect(
      screen.getByRole("heading", { name: "Platform overview" }),
    ).toBeInTheDocument();
    // KPI cards, formatted.
    expect(screen.getByText("4,812")).toBeInTheDocument();
    expect(screen.getByText("▲ 312 new")).toBeInTheDocument();
    expect(screen.getByText("▲ 11% vs last period")).toBeInTheDocument();
    // Approval queue.
    expect(
      screen.getByRole("button", { name: "Approve Acme Events Pvt Ltd" }),
    ).toBeEnabled();
    // Breakdowns: the numbers are readable without the bars.
    expect(
      screen.getByRole("img", { name: /103 events: 52 published, 14 draft/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("4,701")).toBeInTheDocument();
    // The chart loads in the browser only, after a skeleton.
    expect(
      await screen.findByRole("img", {
        name: /New sign-ups over the last 8 weeks/,
      }),
    ).toBeInTheDocument();
  });

  it("analytics of own events: the organizer's home, not the admin overview", async () => {
    renderHome("organizer", ["EVENT_CREATE", "ANALYTICS_VIEW_EVENT"]);

    expect(
      await screen.findByRole("heading", { name: "Organizer dashboard" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Platform overview" }),
    ).not.toBeInTheDocument();
  });

  it("managing one's own speaker profile: the speaker's home", async () => {
    renderHome("speaker", ["SPEAKER_MANAGE_OWN", "REGISTRATION_VIEW_OWN"]);

    // The speaker home is picked before the attendee home, although they also have registrations.
    expect(
      await screen.findByRole("region", { name: "Your sessions" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Organizer dashboard" }),
    ).not.toBeInTheDocument();
  });

  it("viewing one's own registrations: the attendee's home", async () => {
    renderHome("user", ["REGISTRATION_VIEW_OWN", "PROFILE_VIEW"]);

    expect(
      await screen.findByRole("heading", { level: 1, name: /^Hi / }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Organizer dashboard" }),
    ).not.toBeInTheDocument();
  });

  it("none of those permissions: the organizer review screen", () => {
    renderHome("user", ["PROFILE_VIEW"]);

    expect(
      screen.queryByRole("heading", { name: "Platform overview" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Your organizer request is under review",
      }),
    ).toBeInTheDocument();
  });
});

describe("WeeklySignupsChart", () => {
  it("weeks with no sign-ups at all show an empty state, not a blank chart", () => {
    render(
      <WeeklySignupsChart
        weeks={[
          { weekStart: "2026-10-13", attendees: 0, organizerApplications: 0 },
          { weekStart: "2026-10-20", attendees: 0, organizerApplications: 0 },
        ]}
      />,
    );

    expect(screen.getByText("No sign-ups in this period.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("gives screen readers the exact numbers in a table", () => {
    render(
      <WeeklySignupsChart
        weeks={[
          { weekStart: "2026-10-20", attendees: 96, organizerApplications: 3 },
        ]}
      />,
    );

    const row = screen.getByRole("row", { name: /20 Oct/ });
    expect(row).toHaveTextContent("96");
    expect(row).toHaveTextContent("3");
  });
});
