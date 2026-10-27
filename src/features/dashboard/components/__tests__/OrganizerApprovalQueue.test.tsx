/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PendingOrganizer } from "@/src/features/organizer";
import { OrganizerApprovalQueue } from "../admin/OrganizerApprovalQueue";

const verified: PendingOrganizer = {
  id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e01",
  organizerFirstName: "Ananya",
  organizerLastName: "Rao",
  organizationName: "Acme Events Pvt Ltd",
  organizationWebsite: "https://acme-events.example.com",
  email: "ananya.rao@example.com",
  emailVerified: true,
  appliedAt: "2026-10-20T09:15:00Z",
};
const unverified: PendingOrganizer = {
  ...verified,
  id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e03",
  organizationName: "Lakeside Conferences",
  organizationWebsite: null,
  emailVerified: false,
};

function renderQueue(
  organizers: PendingOrganizer[],
  total = organizers.length,
) {
  const onApprove = jest.fn();
  const onReject = jest.fn();
  render(
    <OrganizerApprovalQueue
      organizers={organizers}
      total={total}
      viewAllHref="/admin/organizers"
      onApprove={onApprove}
      onReject={onReject}
    />,
  );
  return { onApprove, onReject };
}

describe("OrganizerApprovalQueue", () => {
  it("shows each applicant with organisation, contact, email status and date", () => {
    renderQueue([verified, unverified], 5);

    const row = screen.getByRole("row", { name: /Acme Events Pvt Ltd/ });
    expect(within(row).getByText("Ananya Rao")).toBeInTheDocument();
    expect(within(row).getByText("ananya.rao@example.com")).toBeInTheDocument();
    expect(within(row).getByText("Verified")).toBeInTheDocument();
    expect(within(row).getByText("20 Oct 2026")).toBeInTheDocument();
    expect(
      within(row).getByRole("link", { name: "acme-events.example.com" }),
    ).toHaveAttribute("href", "https://acme-events.example.com");
    expect(screen.getByText("No website")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View all 5" })).toHaveAttribute(
      "href",
      "/admin/organizers",
    );
  });

  it("Approve and Reject report which organizer was chosen", async () => {
    const { onApprove, onReject } = renderQueue([verified]);

    await userEvent.click(
      screen.getByRole("button", { name: "Approve Acme Events Pvt Ltd" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Reject Acme Events Pvt Ltd" }),
    );

    expect(onApprove).toHaveBeenCalledWith(verified.id);
    expect(onReject).toHaveBeenCalledWith(verified.id);
  });

  it("an applicant without a verified email cannot be approved yet, and says why", async () => {
    const { onApprove } = renderQueue([unverified]);

    const approve = screen.getByRole("button", {
      name: "Approve Lakeside Conferences",
    });
    expect(approve).toBeDisabled();
    expect(approve).toHaveAccessibleDescription(
      "Waiting for email verification",
    );
    expect(screen.getByText("Not verified")).toBeInTheDocument();

    await userEvent.click(approve);
    expect(onApprove).not.toHaveBeenCalled();
  });

  it("an empty queue says so instead of an empty table", () => {
    renderQueue([]);

    expect(
      screen.getByText("No organizers waiting for approval."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /View all/ }),
    ).not.toBeInTheDocument();
  });
});
