import type { AdminOrganizersData } from "../types/admin-organizers";

// TODO(API): sample data for the admin "Organizers" page until it is wired. The one place these
// numbers live: replace this object with the API data (GET /api/admin/organizers, once per
// verification filter), not the components. Events and registrations of approved organizers
// stay sample data until the events and registrations tables exist.
export const ADMIN_ORGANIZERS_SAMPLE: AdminOrganizersData = {
  asOf: "2026-10-26T12:00:00Z",
  counts: { pending: 5, approved: 37, rejected: 3 },
  pending: [
    {
      id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e11",
      organizerFirstName: "Leena",
      organizerLastName: "Pillai",
      organizationName: "Studio Forty Two",
      organizationWebsite: null,
      email: "leena@example.com",
      emailVerified: true,
      appliedAt: "2026-10-12T09:00:00Z",
    },
    {
      id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e12",
      organizerFirstName: "Imran",
      organizerLastName: "Qureshi",
      organizationName: "Harbor Tech Talks",
      organizationWebsite: "https://harbortechtalks.example.com",
      email: "imran@example.com",
      emailVerified: true,
      appliedAt: "2026-10-14T09:00:00Z",
    },
    {
      // Not verified: the Approve button is disabled for this row.
      id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e13",
      organizerFirstName: "Fatima",
      organizerLastName: "Sheikh",
      organizationName: "Lakeside Conferences",
      organizationWebsite: "https://lakeside-conf.example.com",
      email: "fatima@example.com",
      emailVerified: false,
      appliedAt: "2026-10-17T09:00:00Z",
    },
    {
      id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e14",
      organizerFirstName: "Rohan",
      organizerLastName: "Gupta",
      organizationName: "Northwind Meetups",
      organizationWebsite: null,
      email: "rohan@example.com",
      emailVerified: true,
      appliedAt: "2026-10-18T09:00:00Z",
    },
    {
      id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e15",
      organizerFirstName: "Ananya",
      organizerLastName: "Rao",
      organizationName: "Acme Events Pvt Ltd",
      organizationWebsite: "https://acme-events.example.com",
      email: "ananya.rao@example.com",
      emailVerified: true,
      appliedAt: "2026-10-20T09:15:00Z",
    },
  ],
  approved: [
    {
      id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e21",
      organizerFirstName: "Sanjay",
      organizerLastName: "Pillai",
      organizationName: "Orbit Community",
      email: "sanjay@example.com",
      verifiedAt: "2026-10-26T08:30:00Z",
      verifiedBy: "Admin User",
      events: { published: 3, drafts: 0, completed: 0 },
      registrations: 640,
    },
    {
      id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e22",
      organizerFirstName: "Divya",
      organizerLastName: "Rao",
      organizationName: "Cloudnine Meetups",
      email: "divya@example.com",
      verifiedAt: "2026-06-14T10:00:00Z",
      verifiedBy: "Admin User",
      events: { published: 4, drafts: 1, completed: 0 },
      registrations: 812,
    },
    {
      id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e23",
      organizerFirstName: "Kavya",
      organizerLastName: "Menon",
      organizationName: "Kinetic Events",
      email: "kavya@example.com",
      verifiedAt: "2026-03-02T10:00:00Z",
      verifiedBy: "Admin User",
      events: { published: 6, drafts: 2, completed: 0 },
      registrations: 2118,
    },
    {
      id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e24",
      organizerFirstName: "Mohit",
      organizerLastName: "Arora",
      organizationName: "Brightside Events",
      email: "mohit@example.com",
      verifiedAt: "2026-01-30T10:00:00Z",
      verifiedBy: "Admin User",
      events: { published: 0, drafts: 0, completed: 2 },
      registrations: 390,
    },
  ],
  approvedPage: { page: 1, pageSize: 4 },
  rejected: [
    {
      id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e31",
      organizerFirstName: "Sameer",
      organizerLastName: "Khan",
      organizationName: "Quick Tickets Hub",
      rejectedAt: "2026-10-03T10:00:00Z",
      rejectionReason:
        "We could not match the organisation to a registered business. Please contact support with a company website.",
    },
    {
      id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e32",
      organizerFirstName: "Tanvi",
      organizerLastName: "Shah",
      organizationName: "Pixel Garage",
      rejectedAt: "2026-08-22T10:00:00Z",
      rejectionReason:
        "Duplicate application. An approved organizer account already exists for this email domain.",
    },
    {
      id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e33",
      organizerFirstName: "Rakesh",
      organizerLastName: "Jain",
      organizationName: "Gigs4All",
      rejectedAt: "2026-07-09T10:00:00Z",
      rejectionReason:
        "Organisation name appeared to be a ticket resale service, which EventSphere does not support.",
    },
  ],
};
