/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity } from "react";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { usersApiService } from "../../../users/api/users-api.service";
import { organizerApiService } from "../../api/organizer-api.service";
import type { OrganizerDetailDto } from "../../schemas/organizer.schemas";
import { AdminOrganizerReview } from "../AdminOrganizerReview";

// Only the API layer is replaced: the hooks, the cache and the screens are the real ones.
jest.mock("../../api/organizer-api.service", () => ({
  organizerApiService: {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    verify: jest.fn(),
    reject: jest.fn(),
    reopen: jest.fn(),
  },
}));
const api = jest.mocked(organizerApiService);

// The invite is the users feature's (one for every role): its API layer is replaced too.
jest.mock("../../../users/api/users-api.service", () => ({
  usersApiService: { resendInvite: jest.fn() },
}));
const invites = jest.mocked(usersApiService);

const organizerId = "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e15";
const decisionTime = "2026-10-26T12:00:00.000Z";

const acme: OrganizerDetailDto = {
  id: organizerId,
  organizationName: "Acme Events Pvt Ltd",
  organizationWebsite: "https://acme-events.example.com",
  appliedAt: "2026-10-20T09:18:00.000Z",
  status: "pending",
  approvedAt: null,
  rejectedAt: null,
  rejectionReason: null,
  hasDuplicate: false,
  applicant: {
    userId: "8f2c41a0-6b1e-4c52-9a3d-7e5b1c0d2f34",
    firstName: "Ananya",
    lastName: "Rao",
    email: "ananya.rao@example.com",
    emailVerifiedAt: "2026-10-20T09:21:00.000Z",
    accountStatus: "active",
    role: "user",
    createdAt: "2026-10-20T09:18:00.000Z",
  },
};

/**
 * A fake server holding one application: a decision changes what the next read returns, like the
 * real one does.
 */
function serve(
  overrides: Partial<Omit<OrganizerDetailDto, "applicant">> & {
    applicant?: Partial<OrganizerDetailDto["applicant"]>;
  } = {},
) {
  let current: OrganizerDetailDto = {
    ...acme,
    ...overrides,
    applicant: { ...acme.applicant, ...overrides.applicant },
  };
  // A copy, so the page never holds the server's own object.
  api.get.mockImplementation(async () => ({
    ...current,
    applicant: { ...current.applicant },
  }));
  api.verify.mockImplementation(async () => {
    current = { ...current, status: "verified", approvedAt: decisionTime };
    return {
      organizerId,
      organizationName: current.organizationName,
      organizerFirstName: "Ananya",
      organizerLastName: "Rao",
      verifiedAt: decisionTime,
      verifiedBy: "Admin User",
    };
  });
  api.reject.mockImplementation(async (_id, body) => {
    current = {
      ...current,
      status: "rejected",
      rejectedAt: decisionTime,
      rejectionReason: body.reason,
    };
    return {
      organizerId,
      organizationName: current.organizationName,
      organizerFirstName: "Ananya",
      organizerLastName: "Rao",
      rejectedAt: decisionTime,
      rejectedBy: "Admin User",
      rejectionReason: body.reason,
      rejectionEmailQueued: true,
    };
  });
  api.reopen.mockImplementation(async () => {
    current = {
      ...current,
      status: "pending",
      rejectedAt: null,
      rejectionReason: null,
    };
    return {
      organizerId,
      organizationName: current.organizationName,
      organizerFirstName: "Ananya",
      organizerLastName: "Rao",
      status: "pending",
    };
  });
}

// null = the page does not say where profiles are (undefined would pick the default).
function renderReview(applicantProfileBase: string | null = "/admin/users") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdminOrganizerReview
        organizerId={organizerId}
        applicantProfileBase={applicantProfileBase ?? undefined}
      />
    </QueryClientProvider>,
  );
}

const card = (name: string) => screen.getByRole("region", { name });
const decision = () => card("Your decision");
const loaded = () =>
  screen.findByRole("heading", { level: 1, name: "Acme Events Pvt Ltd" });

beforeEach(() => {
  jest.resetAllMocks();
  serve();
});

describe("AdminOrganizerReview: loading the application", () => {
  it("shows a loading state, then the application", async () => {
    renderReview();

    expect(
      screen.getByRole("status", { name: "Loading application" }),
    ).toBeInTheDocument();
    await loaded();
    expect(
      screen.queryByRole("status", { name: "Loading application" }),
    ).not.toBeInTheDocument();
  });

  it("asks the API for the id in the URL, and only that", async () => {
    renderReview();
    await loaded();

    expect(api.get).toHaveBeenCalledWith(organizerId);
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it("a failed load shows the error with Try again", async () => {
    api.get.mockRejectedValueOnce(
      new ApiError(500, "INTERNAL", "Something went wrong"),
    );
    renderReview();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't load this application");
    expect(alert).toHaveTextContent("Something went wrong");

    await userEvent.click(
      within(alert).getByRole("button", { name: "Try again" }),
    );

    await loaded();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("an unknown application says so, with a way back to the list", async () => {
    api.get.mockRejectedValue(
      new ApiError(404, "NOT_FOUND", "Organizer not found"),
    );
    renderReview();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Application not found");
    expect(
      within(alert).getByRole("link", { name: "Back to organizers" }),
    ).toHaveAttribute("href", "/admin/organizers");
  });
});

describe("AdminOrganizerReview: what the admin reads", () => {
  it("names the organisation in the title, the breadcrumb and the status", async () => {
    renderReview();
    await loaded();

    expect(
      screen.getByText("Organizer application · applied 20 Oct 2026"),
    ).toBeInTheDocument();
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(
      within(breadcrumb).getByRole("link", { name: "Organizers" }),
    ).toHaveAttribute("href", "/admin/organizers");
    expect(within(breadcrumb).getByText("Acme Events Pvt Ltd")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows the organisation: website that opens in a new tab, and when it was submitted", async () => {
    renderReview();
    await loaded();
    const organisation = card("Organisation");

    const website = within(organisation).getByRole("link", {
      name: /acme-events\.example\.com/,
    });
    expect(website).toHaveAttribute("href", "https://acme-events.example.com");
    expect(website).toHaveAttribute("target", "_blank");
    expect(website).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(
      within(organisation).getByText("20 October 2026, 09:18"),
    ).toBeInTheDocument();
  });

  it("says 'No website' when none was given", async () => {
    serve({ organizationWebsite: null });
    renderReview();
    await loaded();

    expect(
      within(card("Organisation")).getByText("No website"),
    ).toBeInTheDocument();
  });

  it("shows the applicant, with a link to their user profile", async () => {
    renderReview();
    await loaded();
    const applicant = card("Applicant account");

    expect(within(applicant).getByText("Ananya Rao")).toBeInTheDocument();
    expect(within(applicant).getByText("Verified")).toBeInTheDocument();
    expect(within(applicant).getByText("Attendee")).toBeInTheDocument();
    expect(
      within(applicant).getByText(/Active · created 20 Oct 2026/),
    ).toBeInTheDocument();
    expect(
      within(applicant).getByRole("link", { name: "Open user profile" }),
    ).toHaveAttribute("href", `/admin/users/${acme.applicant.userId}`);
  });

  it("has no profile link when the page was not told where profiles are", async () => {
    renderReview(null);
    await loaded();

    expect(
      screen.queryByRole("link", { name: "Open user profile" }),
    ).not.toBeInTheDocument();
  });

  it("an applicant with no role says so", async () => {
    serve({ applicant: { role: null } });
    renderReview();
    await loaded();

    expect(
      within(card("Applicant account")).getByText("No role"),
    ).toBeInTheDocument();
  });

  it("lists the checks, and says in words whether each passed (not only by colour)", async () => {
    serve({ hasDuplicate: true });
    renderReview();
    await loaded();
    const checks = card("Checks before approving");

    expect(
      within(checks).getByText("Email address verified"),
    ).toBeInTheDocument();
    expect(within(checks).getAllByText("(Passed)")).toHaveLength(2);
    expect(within(checks).getByText("(Needs attention)")).toBeInTheDocument();
    expect(within(checks).getByText("(Check by hand)")).toBeInTheDocument();
  });

  it("shows the history, newest first", async () => {
    renderReview();
    await loaded();
    const items = within(card("History")).getAllByRole("listitem");

    expect(items[0]).toHaveTextContent("Waiting for admin decision");
    expect(items[1]).toHaveTextContent("Email verified");
    expect(items[2]).toHaveTextContent("Application submitted");
  });
});

describe("AdminOrganizerReview: approve", () => {
  const openApprove = async () => {
    await userEvent.click(
      within(decision()).getByRole("button", { name: "Approve organizer" }),
    );
    return screen.getByRole("dialog", { name: "Approve Acme Events Pvt Ltd?" });
  };

  it("asks for confirmation first, and Cancel approves nothing", async () => {
    renderReview();
    await loaded();
    const dialog = await openApprove();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.verify).not.toHaveBeenCalled();
  });

  it("approves that organizer, and the page shows the approval the server now reports", async () => {
    renderReview();
    await loaded();
    const dialog = await openApprove();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve organizer" }),
    );

    await waitFor(() => expect(api.verify).toHaveBeenCalledWith(organizerId));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    // The application is read again, so what is on screen is what the server says.
    await waitFor(() =>
      expect(within(decision()).getByText("Approved")).toBeInTheDocument(),
    );
    expect(api.get.mock.calls.length).toBeGreaterThan(1);
    expect(
      within(decision()).queryByRole("button", { name: "Approve organizer" }),
    ).not.toBeInTheDocument();
    expect(
      within(card("Organisation")).getByText("Approved"),
    ).toBeInTheDocument();
    expect(
      within(card("History")).getAllByRole("listitem")[0],
    ).toHaveTextContent("Approved");
  });

  it("shows why it failed (e.g. the CMS is down) and stays open so the admin can try again", async () => {
    api.verify.mockRejectedValueOnce(
      new ApiError(
        503,
        "CMS_UNAVAILABLE",
        "Could not set up CMS access right now. Please try verifying again.",
      ),
    );
    renderReview();
    await loaded();
    const dialog = await openApprove();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve organizer" }),
    );

    expect(
      await within(dialog).findByText(/Could not set up CMS access right now/),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("cannot be pressed twice while the request runs", async () => {
    api.verify.mockReturnValue(new Promise(() => {}));
    renderReview();
    await loaded();
    const dialog = await openApprove();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve organizer" }),
    );

    const working = await within(dialog).findByRole("button", {
      name: "Approving…",
    });
    expect(working).toBeDisabled();
    expect(api.verify).toHaveBeenCalledTimes(1);
  });

  it("cannot be approved until the applicant has verified their email, and says why", async () => {
    serve({ applicant: { emailVerifiedAt: null } });
    renderReview();
    await loaded();

    const button = within(decision()).getByRole("button", {
      name: "Approve organizer",
    });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(
      "Ananya has not verified their email yet. Approve is available once they do.",
    );
    expect(
      within(card("Checks before approving")).getByText("(Needs attention)"),
    ).toBeInTheDocument();
  });
});

describe("AdminOrganizerReview: reject", () => {
  const reasonBox = () =>
    within(decision()).getByLabelText("Reason shared with the applicant");
  const rejectButton = () =>
    within(decision()).getByRole("button", { name: "Reject application" });

  it("will not reject without a reason, and does not call the API", async () => {
    renderReview();
    await loaded();

    await userEvent.click(rejectButton());

    expect(
      await within(decision()).findByText(
        "Enter a reason so the applicant knows what to change.",
      ),
    ).toBeInTheDocument();
    expect(api.reject).not.toHaveBeenCalled();
  });

  it("choosing a common reason fills the box, and the admin can still change the words", async () => {
    renderReview();
    await loaded();

    await userEvent.selectOptions(
      within(decision()).getByRole("combobox", {
        name: "Reject this application",
      }),
      "Duplicate application",
    );

    const box = reasonBox() as HTMLTextAreaElement;
    expect(box.value).toContain("An organizer account already exists");
    await userEvent.type(box, " Thank you.");
    expect(box.value).toMatch(/exists[\s\S]*Thank you\.$/);
  });

  it("rejects with the trimmed reason, and the page shows the rejection the server now reports", async () => {
    renderReview();
    await loaded();
    await userEvent.type(reasonBox(), "  Website could not be verified  ");

    await userEvent.click(rejectButton());

    await waitFor(() =>
      expect(api.reject).toHaveBeenCalledWith(organizerId, {
        reason: "Website could not be verified",
      }),
    );
    expect(await within(decision()).findByText("Rejected")).toBeInTheDocument();
    expect(
      within(decision()).getByText(
        /Reason sent to Ananya: Website could not be verified/,
      ),
    ).toBeInTheDocument();
    expect(
      within(card("History")).getAllByRole("listitem")[0],
    ).toHaveTextContent("Rejected");
  });

  it("shows why it failed and keeps what was typed", async () => {
    api.reject.mockRejectedValueOnce(
      new ApiError(
        409,
        "ORGANIZER_ALREADY_VERIFIED",
        "A verified organizer cannot be rejected",
      ),
    );
    renderReview();
    await loaded();
    await userEvent.type(reasonBox(), "Not enough detail");

    await userEvent.click(rejectButton());

    expect(
      await within(decision()).findByText(
        "A verified organizer cannot be rejected",
      ),
    ).toBeInTheDocument();
    expect(reasonBox()).toHaveValue("Not enough detail");
  });

  it("cannot be pressed twice while the request runs", async () => {
    api.reject.mockReturnValue(new Promise(() => {}));
    renderReview();
    await loaded();
    await userEvent.type(reasonBox(), "Not enough detail");

    await userEvent.click(rejectButton());

    const working = await within(decision()).findByRole("button", {
      name: "Rejecting…",
    });
    expect(working).toBeDisabled();
    expect(api.reject).toHaveBeenCalledTimes(1);
  });

  it("Reconsider puts the application back in the queue with the decision form", async () => {
    serve({
      status: "rejected",
      rejectedAt: decisionTime,
      rejectionReason: "Not enough detail",
    });
    renderReview();
    await loaded();

    await userEvent.click(
      within(decision()).getByRole("button", {
        name: "Reconsider application",
      }),
    );

    await waitFor(() => expect(api.reopen).toHaveBeenCalledWith(organizerId));
    expect(
      await within(decision()).findByRole("button", {
        name: "Approve organizer",
      }),
    ).toBeEnabled();
    expect(
      within(card("Organisation")).getByText("Awaiting approval"),
    ).toBeInTheDocument();
  });

  it("shows why a reconsideration failed", async () => {
    serve({
      status: "rejected",
      rejectedAt: decisionTime,
      rejectionReason: "Not enough detail",
    });
    api.reopen.mockRejectedValueOnce(
      new ApiError(
        409,
        "ORGANIZER_NOT_REJECTED",
        "Only a rejected organizer can be reopened",
      ),
    );
    renderReview();
    await loaded();

    await userEvent.click(
      within(decision()).getByRole("button", {
        name: "Reconsider application",
      }),
    );

    expect(
      await within(decision()).findByText(
        "Only a rejected organizer can be reopened",
      ),
    ).toBeInTheDocument();
  });
});

describe("AdminOrganizerReview: an application that was already decided", () => {
  it("an approved one shows the approval and no decision buttons", async () => {
    serve({ status: "verified", approvedAt: decisionTime });
    renderReview();
    await loaded();

    expect(within(decision()).getByText("Approved")).toBeInTheDocument();
    expect(
      within(decision()).getByText(/26 October 2026, 12:00/),
    ).toBeInTheDocument();
    expect(within(decision()).queryByRole("button")).not.toBeInTheDocument();
  });

  it("a rejected one shows the reason and offers Reconsider", async () => {
    serve({
      status: "rejected",
      rejectedAt: decisionTime,
      rejectionReason: "Duplicate application",
    });
    renderReview();
    await loaded();

    expect(
      within(decision()).getByText(
        /Reason sent to Ananya: Duplicate application/,
      ),
    ).toBeInTheDocument();
    expect(
      within(decision()).getByRole("button", {
        name: "Reconsider application",
      }),
    ).toBeInTheDocument();
  });
});

// Next.js (cacheComponents) hides a page we leave with <Activity> instead of unmounting it.
describe("AdminOrganizerReview: resend invite", () => {
  const applicantCard = () =>
    screen.getByRole("region", { name: "Applicant account" });

  beforeEach(() => {
    invites.resendInvite.mockResolvedValue({
      setupEmailQueued: true,
      expiresAt: "2026-10-30T09:00:00.000Z",
    });
  });

  it("is offered while the applicant has not set up their account", async () => {
    serve({ applicant: { accountStatus: "pending", emailVerifiedAt: null } });
    renderReview();
    await screen.findByRole("heading", { name: "Acme Events Pvt Ltd" });

    expect(
      within(applicantCard()).getByRole("button", { name: "Resend invite" }),
    ).toBeInTheDocument();
  });

  it("is not offered once the account is active", async () => {
    serve();
    renderReview();
    await screen.findByRole("heading", { name: "Acme Events Pvt Ltd" });

    expect(
      screen.queryByRole("button", { name: "Resend invite" }),
    ).not.toBeInTheDocument();
  });

  it("sends the invite for the applicant's user and says where it went", async () => {
    serve({ applicant: { accountStatus: "pending", emailVerifiedAt: null } });
    renderReview();
    await screen.findByRole("heading", { name: "Acme Events Pvt Ltd" });

    await userEvent.click(
      within(applicantCard()).getByRole("button", { name: "Resend invite" }),
    );

    expect(invites.resendInvite).toHaveBeenCalledWith(acme.applicant.userId);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Invite sent to ananya.rao@example.com",
    );
  });

  it("shows why it failed", async () => {
    invites.resendInvite.mockRejectedValue(
      new ApiError(429, "RATE_LIMITED", "An invite was sent moments ago."),
    );
    serve({ applicant: { accountStatus: "pending", emailVerifiedAt: null } });
    renderReview();
    await screen.findByRole("heading", { name: "Acme Events Pvt Ltd" });

    await userEvent.click(
      within(applicantCard()).getByRole("button", { name: "Resend invite" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "An invite was sent moments ago.",
    );
  });
});

describe("AdminOrganizerReview: hidden and shown again", () => {
  it("comes back with no dialog open", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const view = (mode: "visible" | "hidden") => (
      <QueryClientProvider client={client}>
        <Activity mode={mode}>
          <AdminOrganizerReview organizerId={organizerId} />
        </Activity>
      </QueryClientProvider>
    );
    const { rerender } = render(view("visible"));
    await loaded();
    await userEvent.click(
      within(decision()).getByRole("button", { name: "Approve organizer" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerender(view("hidden"));
    rerender(view("visible"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
