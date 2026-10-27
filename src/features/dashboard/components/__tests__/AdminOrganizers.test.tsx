/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity } from "react";
import { ADMIN_ORGANIZERS_SAMPLE } from "../../utils/admin-organizers.sample";
import { AdminOrganizers } from "../admin/AdminOrganizers";

const [studio, harbor, lakeside, , acme] = ADMIN_ORGANIZERS_SAMPLE.pending;
const [, pixelGarage] = ADMIN_ORGANIZERS_SAMPLE.rejected;

function renderPage() {
  const handlers = {
    onApprove: jest.fn(),
    onReject: jest.fn(),
    onReconsider: jest.fn(),
    onApprovedPageChange: jest.fn(),
  };
  render(<AdminOrganizers data={ADMIN_ORGANIZERS_SAMPLE} {...handlers} />);
  return handlers;
}

const section = (name: RegExp) => screen.getByRole("region", { name });
const bodyRows = (name: RegExp) =>
  within(section(name)).getAllByRole("row").slice(1);

describe("AdminOrganizers: overview", () => {
  it("shows the three counts as links to their sections", () => {
    renderPage();

    expect(
      screen.getByRole("link", { name: /Awaiting approval/ }),
    ).toHaveAttribute("href", "#pending");
    expect(
      screen.getByRole("link", { name: /Approved organizers/ }),
    ).toHaveAttribute("href", "#approved");
    expect(
      screen.getByRole("link", { name: /Rejected applications/ }),
    ).toHaveAttribute("href", "#rejected");
    expect(
      within(
        screen.getByRole("link", { name: /Approved organizers/ }),
      ).getByText("37"),
    ).toBeInTheDocument();
  });

  it("shows the whole-platform count in each section header, not the rows on the page", () => {
    renderPage();

    expect(
      within(section(/Approved organizers/)).getByText("37"),
    ).toBeInTheDocument();
    expect(bodyRows(/Approved organizers/)).toHaveLength(4);
  });
});

describe("AdminOrganizers: awaiting approval", () => {
  it("lists the applicants oldest first, each with how long it has waited", () => {
    renderPage();
    const rows = bodyRows(/Awaiting approval/);

    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent("Studio Forty Two");
    expect(rows[0]).toHaveTextContent("14 days waiting");
    expect(rows[4]).toHaveTextContent("Acme Events Pvt Ltd");
    expect(rows[4]).toHaveTextContent("6 days waiting");
  });

  it("shows a long wait in red and a short one not", () => {
    renderPage();
    const rows = bodyRows(/Awaiting approval/);

    expect(within(rows[0]).getByText("14 days waiting")).toHaveClass(
      "text-danger",
    );
    expect(within(rows[4]).getByText("6 days waiting")).toHaveClass(
      "text-warning",
    );
  });

  it("links the organisation and Review to the review page", () => {
    renderPage();
    const row = screen.getByRole("row", { name: /Studio Forty Two/ });

    expect(
      within(row).getByRole("link", { name: "Studio Forty Two" }),
    ).toHaveAttribute("href", `/admin/organizers/${studio.id}`);
    expect(
      within(row).getByRole("link", { name: "Review Studio Forty Two" }),
    ).toHaveAttribute("href", `/admin/organizers/${studio.id}`);
  });

  it("disables Approve until the applicant has verified their email, and says why", () => {
    renderPage();
    const row = screen.getByRole("row", { name: /Lakeside Conferences/ });

    expect(
      within(row).getByRole("button", { name: "Approve Lakeside Conferences" }),
    ).toBeDisabled();
    expect(
      within(row).getByText("Waiting for email verification"),
    ).toBeInTheDocument();
    expect(within(row).getByText("Not verified")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Approve Studio Forty Two" }),
    ).toBeEnabled();
  });
});

describe("AdminOrganizers: approve", () => {
  it("asks for confirmation, then approves that organizer and closes", async () => {
    const { onApprove } = renderPage();

    await userEvent.click(
      screen.getByRole("button", { name: "Approve Acme Events Pvt Ltd" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Approve Acme Events Pvt Ltd?",
    });
    expect(dialog).toHaveTextContent("Ananya Rao will get the organizer role");
    expect(onApprove).not.toHaveBeenCalled();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve organizer" }),
    );

    expect(onApprove).toHaveBeenCalledWith(acme.id);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Cancel closes the dialog without approving", async () => {
    const { onApprove } = renderPage();
    await userEvent.click(
      screen.getByRole("button", { name: "Approve Acme Events Pvt Ltd" }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onApprove).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("AdminOrganizers: reject", () => {
  async function openReject(organisation: string) {
    await userEvent.click(
      screen.getByRole("button", { name: `Reject ${organisation}` }),
    );
    return screen.getByRole("dialog", { name: `Reject ${organisation}?` });
  }

  it("will not reject without a reason, and says why", async () => {
    const { onReject } = renderPage();
    const dialog = await openReject("Harbor Tech Talks");

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Reject application" }),
    );

    expect(
      await within(dialog).findByText(
        "Enter a reason so the applicant knows what to change.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByLabelText("Reason shared with the applicant"),
    ).toBeInvalid();
    expect(onReject).not.toHaveBeenCalled();
    expect(dialog).toBeVisible();
  });

  it("will not reject with a reason of only spaces", async () => {
    const { onReject } = renderPage();
    const dialog = await openReject("Harbor Tech Talks");

    await userEvent.type(
      within(dialog).getByLabelText("Reason shared with the applicant"),
      "   ",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Reject application" }),
    );

    // The reason is trimmed before it is checked, so spaces alone count as empty.
    expect(
      await within(dialog).findByText(
        "Enter a reason so the applicant knows what to change.",
      ),
    ).toBeInTheDocument();
    expect(onReject).not.toHaveBeenCalled();
  });

  it("rejects that organizer with the trimmed reason and closes", async () => {
    const { onReject } = renderPage();
    const dialog = await openReject("Harbor Tech Talks");

    await userEvent.type(
      within(dialog).getByLabelText("Reason shared with the applicant"),
      "  Website could not be verified  ",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Reject application" }),
    );

    await waitFor(() =>
      expect(onReject).toHaveBeenCalledWith(
        harbor.id,
        "Website could not be verified",
      ),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("tells the admin what the applicant will see, without a gendered pronoun", async () => {
    renderPage();
    const dialog = await openReject("Harbor Tech Talks");

    expect(dialog).toHaveTextContent("Imran keeps their attendee account");
    expect(dialog).toHaveTextContent(
      "emailed to them and shown on their dashboard",
    );
  });

  it("opens empty again after a cancelled attempt", async () => {
    renderPage();
    let dialog = await openReject("Harbor Tech Talks");
    await userEvent.type(
      within(dialog).getByLabelText("Reason shared with the applicant"),
      "typed once",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );

    dialog = await openReject("Harbor Tech Talks");

    expect(
      within(dialog).getByLabelText("Reason shared with the applicant"),
    ).toHaveValue("");
  });
});

describe("AdminOrganizers: rejected applications", () => {
  it("shows who was rejected, when, and the reason they were given", () => {
    renderPage();
    const row = screen.getByRole("row", { name: /Pixel Garage/ });

    expect(within(row).getByText("Tanvi Shah")).toBeInTheDocument();
    expect(within(row).getByText("22 Aug 2026")).toBeInTheDocument();
    expect(within(row).getByText(/Duplicate application/)).toBeInTheDocument();
  });

  it("Reconsider sends that application back for a decision", async () => {
    const { onReconsider } = renderPage();

    await userEvent.click(
      screen.getByRole("button", { name: "Reconsider Pixel Garage" }),
    );

    expect(onReconsider).toHaveBeenCalledWith(pixelGarage.id);
  });
});

describe("AdminOrganizers: approved organizers", () => {
  it("shows events, registrations and who approved, when", () => {
    renderPage();
    const row = screen.getByRole("row", { name: /Kinetic Events/ });

    expect(within(row).getByText("6 published · 2 drafts")).toBeInTheDocument();
    expect(within(row).getByText("2,118")).toBeInTheDocument();
    expect(within(row).getByText("2 Mar 2026")).toBeInTheDocument();
    expect(within(row).getByText("by Admin User")).toBeInTheDocument();
    expect(
      within(row).getByText(/Kavya Menon · kavya@example.com/),
    ).toBeInTheDocument();
  });

  it("pages through them: Previous is off on the first page and Next asks for page 2", async () => {
    const { onApprovedPageChange } = renderPage();
    const pagination = screen.getByRole("navigation", { name: "Pagination" });

    expect(pagination).toHaveTextContent("Showing 1–4 of 37");
    expect(
      within(pagination).getByRole("button", { name: "Previous" }),
    ).toBeDisabled();

    await userEvent.click(
      within(pagination).getByRole("button", { name: "Next" }),
    );

    expect(onApprovedPageChange).toHaveBeenCalledWith(2);
  });
});

describe("AdminOrganizers: search and filters", () => {
  it("searches by organisation, applicant or email, in every list", async () => {
    renderPage();

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search organizers" }),
      "harbor",
    );

    expect(bodyRows(/Awaiting approval/)).toHaveLength(1);
    expect(bodyRows(/Awaiting approval/)[0]).toHaveTextContent(
      "Harbor Tech Talks",
    );
    expect(
      within(section(/Approved organizers/)).getByText(
        "No approved organizers match your search.",
      ),
    ).toBeInTheDocument();
    expect(
      within(section(/Rejected applications/)).getByText(
        "No rejected applications match your search.",
      ),
    ).toBeInTheDocument();
  });

  it("finds an applicant by email", async () => {
    renderPage();

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search organizers" }),
      "leena@",
    );

    expect(bodyRows(/Awaiting approval/)[0]).toHaveTextContent(
      "Studio Forty Two",
    );
  });

  it("says so when nothing matches, and keeps the real count", async () => {
    renderPage();

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search organizers" }),
      "zzzz",
    );

    const pending = section(/Awaiting approval/);
    expect(
      within(pending).getByText("No applications match your search."),
    ).toBeInTheDocument();
    expect(within(pending).getByText("5")).toBeInTheDocument();
  });

  it("filters the waiting list by email status", async () => {
    renderPage();

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Email status" }),
      "unverified",
    );

    const rows = bodyRows(/Awaiting approval/);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent(lakeside.organizationName);
  });

  it("sorts the waiting list newest first", async () => {
    renderPage();

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Sort" }),
      "newest",
    );

    const rows = bodyRows(/Awaiting approval/);
    expect(rows[0]).toHaveTextContent("Acme Events Pvt Ltd");
    expect(rows[4]).toHaveTextContent("Studio Forty Two");
  });
});

describe("AdminOrganizers: empty queue", () => {
  it("says nobody is waiting", () => {
    render(
      <AdminOrganizers
        data={{
          ...ADMIN_ORGANIZERS_SAMPLE,
          counts: { ...ADMIN_ORGANIZERS_SAMPLE.counts, pending: 0 },
          pending: [],
        }}
      />,
    );

    expect(
      screen.getByText("No organizers waiting for approval."),
    ).toBeInTheDocument();
  });
});

// Next.js (cacheComponents) hides a page we leave with <Activity> instead of unmounting it.
describe("AdminOrganizers: hidden and shown again", () => {
  it("comes back with no dialog open", async () => {
    const view = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <AdminOrganizers data={ADMIN_ORGANIZERS_SAMPLE} />
      </Activity>
    );
    const { rerender } = render(view("visible"));
    await userEvent.click(
      screen.getByRole("button", { name: "Approve Acme Events Pvt Ltd" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerender(view("hidden"));
    rerender(view("visible"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
