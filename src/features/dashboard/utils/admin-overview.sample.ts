import type { AdminOverviewData } from "../types/admin-overview";

// TODO(API): sample data for the admin "Platform overview" until its endpoints exist. The one
// place these numbers live: replace this object with the API data, not the components.
export const ADMIN_OVERVIEW_SAMPLE: AdminOverviewData = {
  periodDays: 30,
  kpis: {
    totalUsers: 4812,
    newUsers: 312,
    approvedOrganizers: 37,
    pendingOrganizers: 5,
    publishedEvents: 52,
    draftEvents: 14,
    registrations: 6940,
    registrationsChangePct: 11,
    suspendedUsers: 6,
    suspendedThisMonth: 2,
  },
  pendingOrganizers: [
    {
      id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e01",
      organizerFirstName: "Ananya",
      organizerLastName: "Rao",
      organizationName: "Acme Events Pvt Ltd",
      organizationWebsite: "https://acme-events.example.com",
      email: "ananya.rao@example.com",
      emailVerified: true,
      appliedAt: "2026-10-20T09:15:00Z",
    },
    {
      id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e02",
      organizerFirstName: "Rohan",
      organizerLastName: "Gupta",
      organizationName: "Northwind Meetups",
      organizationWebsite: null,
      email: "rohan@example.com",
      emailVerified: true,
      appliedAt: "2026-10-18T14:40:00Z",
    },
    {
      // Not verified: the Approve button is disabled for this row.
      id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e03",
      organizerFirstName: "Fatima",
      organizerLastName: "Sheikh",
      organizationName: "Lakeside Conferences",
      organizationWebsite: "https://lakeside-conf.example.com",
      email: "fatima@example.com",
      emailVerified: false,
      appliedAt: "2026-10-17T11:05:00Z",
    },
  ],
  pendingOrganizersTotal: 5,
  weeklySignups: [
    { weekStart: "2026-09-01", attendees: 41, organizerApplications: 1 },
    { weekStart: "2026-09-08", attendees: 50, organizerApplications: 0 },
    { weekStart: "2026-09-15", attendees: 46, organizerApplications: 2 },
    { weekStart: "2026-09-22", attendees: 60, organizerApplications: 1 },
    { weekStart: "2026-09-29", attendees: 68, organizerApplications: 1 },
    { weekStart: "2026-10-06", attendees: 73, organizerApplications: 2 },
    { weekStart: "2026-10-13", attendees: 83, organizerApplications: 1 },
    { weekStart: "2026-10-20", attendees: 96, organizerApplications: 3 },
  ],
  eventsByStatus: { published: 52, draft: 14, completed: 31, cancelled: 6 },
  // Adds up to kpis.totalUsers.
  accountsByRole: { user: 4701, speaker: 70, organizer: 37, admin: 4 },
};
