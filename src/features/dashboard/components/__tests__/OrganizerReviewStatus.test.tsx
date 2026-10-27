/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import {
  OrganizerReviewStatus,
  type OrganizerApplication,
} from "../OrganizerReviewStatus";
import { formatDate } from "../../utils/format-date";

const application: OrganizerApplication = {
  status: "pending",
  organisationName: "Acme Events Pvt Ltd",
  website: "https://acme-events.example.com",
  contactName: "Ananya Rao",
  contactEmail: "ananya.rao@example.com",
  submittedAt: "2026-10-20T11:24:00Z",
  emailVerifiedAt: "2026-10-20T11:30:00Z",
};

describe("formatDate", () => {
  it("prints the same text whatever the machine's time zone (UTC)", () => {
    expect(formatDate("2026-10-20T11:24:00Z")).toBe("20 Oct 2026");
    expect(formatDate("2026-10-20T11:24:00Z", "long")).toBe(
      "20 October 2026, 11:24",
    );
  });
});

describe("OrganizerReviewStatus", () => {
  it("says the request is under review", () => {
    render(<OrganizerReviewStatus application={application} />);
    expect(
      screen.getByRole("heading", {
        name: "Your organizer request is under review",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pending review")).toBeInTheDocument();
  });

  it("shows the four stages with admin review as the current one", () => {
    render(<OrganizerReviewStatus application={application} />);
    const items = screen.getAllByRole("listitem");

    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("Application submitted");
    expect(items[0]).toHaveTextContent("20 Oct 2026");
    expect(items[2]).toHaveAttribute("aria-current", "step");
    expect(items[2]).toHaveTextContent("In progress");
    expect(items[3]).toHaveTextContent("After approval");
  });

  it("lists what was submitted", () => {
    render(<OrganizerReviewStatus application={application} />);
    expect(screen.getByText("Acme Events Pvt Ltd")).toBeInTheDocument();
    expect(
      screen.getByText("Ananya Rao · ananya.rao@example.com"),
    ).toBeInTheDocument();
    expect(screen.getByText("20 October 2026, 11:24")).toBeInTheDocument();
  });

  it("says so when no website was given", () => {
    render(
      <OrganizerReviewStatus application={{ ...application, website: null }} />,
    );
    expect(screen.getByText("Not provided")).toBeInTheDocument();
  });

  it("offers attendee actions while waiting", () => {
    render(<OrganizerReviewStatus application={application} />);
    expect(screen.getByRole("link", { name: "Browse events" })).toHaveAttribute(
      "href",
      "/events",
    );
    expect(
      screen.getByRole("link", { name: "Complete your profile" }),
    ).toHaveAttribute("href", "/profile");
  });
});

describe("OrganizerReviewStatus: rejected", () => {
  const rejected: OrganizerApplication = {
    ...application,
    status: "rejected",
    rejectedAt: "2026-10-22T09:00:00Z",
    rejectionReason: "Website could not be verified.\nPlease contact support.",
  };

  it("says the request was not approved and shows the admin's reason", () => {
    render(<OrganizerReviewStatus application={rejected} />);

    expect(
      screen.getByRole("heading", {
        name: "Your organizer request was not approved",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Not approved")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Website could not be verified\.\s+Please contact support\./,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Pending review")).not.toBeInTheDocument();
  });

  it("marks admin review as not approved with its date, and no step as current", () => {
    render(<OrganizerReviewStatus application={rejected} />);
    const items = screen.getAllByRole("listitem");

    expect(items[2]).toHaveTextContent("Not approved. 22 Oct 2026");
    expect(items[2]).not.toHaveAttribute("aria-current");
    expect(items[3]).toHaveTextContent("Not available");
  });

  it("still offers the attendee actions", () => {
    render(<OrganizerReviewStatus application={rejected} />);

    expect(
      screen.getByRole("heading", { name: "What you can do" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Browse events" }),
    ).toBeInTheDocument();
  });
});
