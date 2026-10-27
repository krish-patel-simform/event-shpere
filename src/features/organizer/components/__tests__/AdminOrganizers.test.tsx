/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity } from "react";
import { ApiError } from "@/src/core/api-client/base-api.service";
import {
  acme,
  approvedRows,
  harbor,
  lakeside,
  pendingRows,
  pixelGarage,
  rejectedRows,
} from "../../__fixtures__/organizers";
import { organizerApiService } from "../../api/organizer-api.service";
import type { OrganizerListItemDto } from "../../schemas/organizer.schemas";
import { AdminOrganizers } from "../AdminOrganizers";

// Only the API layer is replaced: the hooks, the cache and the screens are the real ones.
jest.mock("../../api/organizer-api.service", () => ({
  organizerApiService: {
    list: jest.fn(),
    create: jest.fn(),
    verify: jest.fn(),
    reject: jest.fn(),
    reopen: jest.fn(),
  },
}));
const api = jest.mocked(organizerApiService);

const lists = {
  pending: pendingRows,
  verified: approvedRows,
  rejected: rejectedRows,
};

const allRows = [...pendingRows, ...approvedRows, ...rejectedRows];

/** The date each list is sorted by, like the server does. */
const sortDate = {
  pending: (row: OrganizerListItemDto) => row.appliedAt,
  verified: (row: OrganizerListItemDto) => row.verifiedAt ?? "",
  rejected: (row: OrganizerListItemDto) => row.rejectedAt ?? "",
};

/**
 * A fake server: searches organisation, applicant and email, applies the email filter, sorts by
 * the list's date and pages, like the real one does.
 */
function serveLists() {
  api.list.mockImplementation(
    async ({
      verification,
      search = "",
      emailVerified,
      sort = "newest",
      page = 1,
      pageSize,
    }) => {
      const needle = search.toLowerCase();
      // No verification = every organizer, sorted by when the application came in.
      const source = verification ? lists[verification] : allRows;
      const dateOf = sortDate[verification ?? "pending"];
      const matching = source
        .filter((row) =>
          [
            row.organizationName,
            `${row.organizerFirstName} ${row.organizerLastName}`,
            row.email,
          ].some((text) => text.toLowerCase().includes(needle)),
        )
        .filter(
          (row) =>
            emailVerified === undefined || row.emailVerified === emailVerified,
        )
        .sort((a, b) =>
          sort === "oldest"
            ? dateOf(a).localeCompare(dateOf(b))
            : dateOf(b).localeCompare(dateOf(a)),
        );
      return {
        items: matching.slice((page - 1) * pageSize, page * pageSize),
        meta: { page, pageSize, total: matching.length },
      };
    },
  );
}

/** The page as the admin first sees it: on its first tab, "All organizers". */
function renderFreshPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdminOrganizers />
    </QueryClientProvider>,
  );
}

/** Most tests are about the waiting list (approve, reject, its filters): render and open it. */
function renderPage() {
  const view = renderFreshPage();
  fireEvent.click(screen.getByRole("tab", { name: /Awaiting approval/ }));
  return view;
}

const panel = () => screen.getByRole("tabpanel");
const bodyRows = () => within(panel()).getAllByRole("row").slice(1);
const searchBox = () =>
  screen.getByRole("searchbox", { name: "Search organizers" });
const tab = (name: RegExp) => screen.getByRole("tab", { name });
const openTab = (name: RegExp) => userEvent.click(tab(name));

beforeEach(() => {
  jest.resetAllMocks();
  serveLists();
  api.verify.mockResolvedValue({
    organizerId: acme.id,
    organizationName: acme.organizationName,
    organizerFirstName: "Ananya",
    organizerLastName: "Rao",
    verifiedAt: "2026-10-26T12:00:00.000Z",
    verifiedBy: "Admin User",
  });
  api.reject.mockResolvedValue({
    organizerId: harbor.id,
    organizationName: harbor.organizationName,
    organizerFirstName: "Imran",
    organizerLastName: "Qureshi",
    rejectedAt: "2026-10-26T12:00:00.000Z",
    rejectedBy: "Admin User",
    rejectionReason: "x",
    rejectionEmailQueued: true,
  });
  api.reopen.mockResolvedValue({
    organizerId: pixelGarage.id,
    organizationName: pixelGarage.organizationName,
    organizerFirstName: "Tanvi",
    organizerLastName: "Shah",
    status: "pending",
  });
});

describe("AdminOrganizers: tabs and loading", () => {
  it("opens on the first tab, All organizers: a loading state, then the rows", async () => {
    renderFreshPage();

    expect(
      screen.getByRole("status", { name: "Loading organizers" }),
    ).toBeInTheDocument();
    expect(tab(/All organizers/)).toHaveAttribute("aria-selected", "true");

    await screen.findByRole("row", { name: /Studio Forty Two/ });
    expect(
      screen.queryByRole("status", { name: /Loading/ }),
    ).not.toBeInTheDocument();
  });

  it("has All organizers first, then the three lists", () => {
    renderFreshPage();

    expect(screen.getAllByRole("tab").map((item) => item.textContent)).toEqual([
      "All organizers",
      "Awaiting approval",
      "Approved",
      "Rejected",
    ]);
  });

  it("asks the API for the open tab only: every organizer, newest first, 10 per page, and nothing else", async () => {
    renderFreshPage();
    await screen.findByRole("row", { name: /Studio Forty Two/ });

    expect(api.list).toHaveBeenCalledTimes(1);
    expect(api.list).toHaveBeenCalledWith({
      verification: undefined,
      search: "",
      sort: "newest",
      page: 1,
      pageSize: 10,
    });
  });

  it("asks for another list only when its tab is clicked: one request per tab opened", async () => {
    renderFreshPage();
    await screen.findByRole("row", { name: /Studio Forty Two/ });
    expect(api.list).toHaveBeenCalledTimes(1);

    await openTab(/Awaiting approval/);
    await screen.findByRole("row", { name: /Studio Forty Two/ });
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ verification: "pending", sort: "oldest" }),
    );

    await openTab(/Approved/);
    await screen.findByRole("row", { name: /Kinetic Events/ });
    expect(api.list).toHaveBeenCalledTimes(3);

    await openTab(/Rejected/);
    await screen.findByRole("row", { name: /Pixel Garage/ });
    expect(api.list).toHaveBeenCalledTimes(4);
  });

  it("shows how many organizers the open tab holds, and says 'matching' while a search is set", async () => {
    renderPage();
    expect(await screen.findByText("4 in total")).toBeInTheDocument();

    await userEvent.type(searchBox(), "harbor");

    expect(await screen.findByText("1 matching")).toBeInTheDocument();
  });

  it("a tab opens its own list, with its own loading state", async () => {
    // The approved list is held back until the test lets it go, so its loading state can be seen.
    const server = api.list.getMockImplementation()!;
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    api.list.mockImplementation(async (params) => {
      if (params.verification === "verified") {
        await gate;
      }
      return server(params);
    });
    renderPage();
    await screen.findByRole("row", { name: /Studio Forty Two/ });

    await openTab(/Approved/);

    expect(
      screen.getByRole("status", { name: "Loading organizers" }),
    ).toBeInTheDocument();
    // The waiting list's rows are gone while the approved list loads: never shown under the new tab.
    expect(
      screen.queryByRole("row", { name: /Studio Forty Two/ }),
    ).not.toBeInTheDocument();
    release();
    expect(
      await screen.findByRole("row", { name: /Kinetic Events/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("row", { name: /Studio Forty Two/ }),
    ).not.toBeInTheDocument();
    expect(tab(/Approved/)).toHaveAttribute("aria-selected", "true");
    expect(panel()).toHaveAccessibleName(/Approved/);
  });

  it("a new search shows the loading state, not the rows of the old search", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Studio Forty Two/ });

    const server = api.list.getMockImplementation()!;
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    api.list.mockImplementation(async (params) => {
      await gate;
      return server(params);
    });
    await userEvent.type(searchBox(), "harbor");

    expect(
      await screen.findByRole("status", { name: "Loading organizers" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("row", { name: /Studio Forty Two/ }),
    ).not.toBeInTheDocument();

    release();
    expect(
      await screen.findByRole("row", { name: /Harbor/ }),
    ).toBeInTheDocument();
  });

  it("moves between tabs with the arrow keys", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Studio Forty Two/ });

    tab(/Awaiting approval/).focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(tab(/Approved/)).toHaveAttribute("aria-selected", "true");
    expect(tab(/Approved/)).toHaveFocus();
  });

  it("a list that fails shows its error with Try again", async () => {
    let failPending = true;
    const server = api.list.getMockImplementation()!;
    api.list.mockImplementation(async (params) => {
      if (params.verification === "pending" && failPending) {
        throw new ApiError(500, "INTERNAL", "Something went wrong");
      }
      return server(params);
    });
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't load the organizers");
    expect(alert).toHaveTextContent("Something went wrong");

    failPending = false;
    await userEvent.click(
      within(alert).getByRole("button", { name: "Try again" }),
    );

    expect(
      await screen.findByRole("row", { name: /Studio Forty Two/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("AdminOrganizers: awaiting approval", () => {
  it("lists the applicants oldest first", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Studio Forty Two/ });
    const rows = bodyRows();

    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent("Studio Forty Two");
    expect(rows[3]).toHaveTextContent("Acme Events Pvt Ltd");
  });

  it("shows how long each has waited, counting up to when the list was loaded", async () => {
    jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-26T12:00:00Z"));
    renderPage();
    await screen.findByRole("row", { name: /Studio Forty Two/ });

    expect(
      within(screen.getByRole("row", { name: /Studio Forty Two/ })).getByText(
        "14 days waiting",
      ),
    ).toHaveClass("text-danger");
    expect(
      within(screen.getByRole("row", { name: /Acme Events/ })).getByText(
        "6 days waiting",
      ),
    ).toHaveClass("text-warning");
    jest.restoreAllMocks();
  });

  it("disables Approve until the applicant has verified their email, and says why", async () => {
    renderPage();
    const row = await screen.findByRole("row", {
      name: /Lakeside Conferences/,
    });

    expect(
      within(row).getByRole("button", { name: "Approve Lakeside Conferences" }),
    ).toBeDisabled();
    expect(
      within(row).getByText("Waiting for email verification"),
    ).toBeInTheDocument();
  });

  it("says nobody is waiting when the list is empty", async () => {
    api.list.mockResolvedValue({
      items: [],
      meta: { page: 1, pageSize: 10, total: 0 },
    });
    renderPage();

    expect(
      await screen.findByText("No organizers waiting for approval."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Pagination" }),
    ).not.toBeInTheDocument();
  });
});

describe("AdminOrganizers: all organizers", () => {
  it("asks the server with no verification filter and lists everyone, newest application first", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Studio Forty Two/ });

    await openTab(/All organizers/);

    await screen.findByRole("row", { name: /Kinetic Events/ });
    const [params] = api.list.mock.lastCall!;
    expect(params.verification).toBeUndefined();
    expect(params).toEqual(expect.objectContaining({ sort: "newest" }));
    // 4 waiting + 2 approved + 2 rejected, newest application first.
    expect(bodyRows()).toHaveLength(8);
    expect(bodyRows()[0]).toHaveTextContent("Acme Events Pvt Ltd");
    expect(await screen.findByText("8 in total")).toBeInTheDocument();
  });

  it("shows where each application stands", async () => {
    renderPage();
    await openTab(/All organizers/);

    const waiting = await screen.findByRole("row", { name: /Acme Events/ });
    expect(within(waiting).getByText("Awaiting approval")).toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /Kinetic Events/ })).getByText(
        "Approved",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /Pixel Garage/ })).getByText(
        "Rejected",
      ),
    ).toBeInTheDocument();
  });

  it("has no decision buttons: those stay on the tabs where the decision is the point", async () => {
    renderPage();
    await openTab(/All organizers/);
    await screen.findByRole("row", { name: /Acme Events/ });

    expect(
      screen.queryByRole("button", { name: /Approve|Reject|Reconsider/ }),
    ).not.toBeInTheDocument();
  });

  it("is searched by the server like the other tabs, and has no email status filter", async () => {
    renderPage();
    await openTab(/All organizers/);
    await screen.findByRole("row", { name: /Acme Events/ });
    expect(
      screen.queryByRole("combobox", { name: "Email status" }),
    ).not.toBeInTheDocument();

    await userEvent.type(searchBox(), "tanvi");

    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(bodyRows()[0]).toHaveTextContent("Pixel Garage");
    expect(await screen.findByText("1 matching")).toBeInTheDocument();
  });

  it("says so when there are no organizers at all", async () => {
    api.list.mockResolvedValue({
      items: [],
      meta: { page: 1, pageSize: 10, total: 0 },
    });
    renderPage();
    await openTab(/All organizers/);

    expect(await screen.findByText("No organizers yet.")).toBeInTheDocument();
  });
});

describe("AdminOrganizers: filters", () => {
  it("the email status is asked of the server, not worked out in the browser", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Studio Forty Two/ });

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Email status" }),
      "unverified",
    );

    await waitFor(() =>
      expect(api.list).toHaveBeenCalledWith(
        expect.objectContaining({
          verification: "pending",
          emailVerified: false,
        }),
      ),
    );
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(bodyRows()[0]).toHaveTextContent(lakeside.organizationName);

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Email status" }),
      "verified",
    );
    await waitFor(() =>
      expect(api.list).toHaveBeenCalledWith(
        expect.objectContaining({ emailVerified: true }),
      ),
    );
    await waitFor(() => expect(bodyRows()).toHaveLength(3));
  });

  it("the sort is asked of the server too", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Studio Forty Two/ });

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Sort" }),
      "newest",
    );

    await waitFor(() =>
      expect(api.list).toHaveBeenCalledWith(
        expect.objectContaining({ verification: "pending", sort: "newest" }),
      ),
    );
    await waitFor(() =>
      expect(bodyRows()[0]).toHaveTextContent("Acme Events Pvt Ltd"),
    );
  });

  it("only the waiting list has an email status filter", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Studio Forty Two/ });
    expect(
      screen.getByRole("combobox", { name: "Email status" }),
    ).toBeInTheDocument();

    await openTab(/Approved/);
    await screen.findByRole("row", { name: /Kinetic Events/ });

    expect(
      screen.queryByRole("combobox", { name: "Email status" }),
    ).not.toBeInTheDocument();
  });

  it("each list names its sort after its own date", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Studio Forty Two/ });
    const sort = () => screen.getByRole("combobox", { name: "Sort" });
    expect(
      within(sort()).getByRole("option", { name: "Sort: Oldest first" }),
    ).toBeInTheDocument();

    await openTab(/Approved/);
    expect(
      within(sort()).getByRole("option", { name: "Sort: Recently approved" }),
    ).toBeInTheDocument();

    await openTab(/Rejected/);
    expect(
      within(sort()).getByRole("option", { name: "Sort: Recently rejected" }),
    ).toBeInTheDocument();
  });

  it("opening a tab starts that list with its own default sort, and no email filter", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Studio Forty Two/ });
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Email status" }),
      "unverified",
    );
    await waitFor(() => expect(bodyRows()).toHaveLength(1));

    await openTab(/Approved/);
    await screen.findByRole("row", { name: /Kinetic Events/ });
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ verification: "verified", sort: "newest" }),
    );
    expect(api.list).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ emailVerified: expect.anything() }),
    );

    await openTab(/Awaiting approval/);
    expect(
      await screen.findByRole("combobox", { name: "Email status" }),
    ).toHaveValue("any");
    await waitFor(() => expect(bodyRows()).toHaveLength(4));
  });
});

describe("AdminOrganizers: search", () => {
  it("asks the server for the typed text once typing pauses, for the selected list", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Studio Forty Two/ });

    await userEvent.type(searchBox(), "harbor");

    await waitFor(() =>
      expect(api.list).toHaveBeenCalledWith(
        expect.objectContaining({ verification: "pending", search: "harbor" }),
      ),
    );
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(bodyRows()[0]).toHaveTextContent("Harbor Tech Talks");
  });

  it("finds an organizer by the applicant's name or email, not only the organisation", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Studio Forty Two/ });

    await userEvent.type(searchBox(), "imran");
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(bodyRows()[0]).toHaveTextContent("Harbor Tech Talks");

    await userEvent.clear(searchBox());
    await userEvent.type(searchBox(), "fatima@example");
    expect(
      await screen.findByRole("row", { name: /Lakeside Conferences/ }),
    ).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(1);
  });

  it("does not ask for every keystroke", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Studio Forty Two/ });

    await userEvent.type(searchBox(), "harbor");
    await waitFor(() =>
      expect(api.list).toHaveBeenCalledWith(
        expect.objectContaining({ search: "harbor" }),
      ),
    );

    const searches = api.list.mock.calls.map(([params]) => params.search);
    expect(searches).not.toContain("h");
    expect(searches).not.toContain("har");
  });

  it("stays when another tab is opened, so the admin can look for the same name there", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Studio Forty Two/ });

    await userEvent.type(searchBox(), "kinetic");
    expect(
      await screen.findByText("No applications match your search."),
    ).toBeInTheDocument();

    await openTab(/Approved/);

    expect(searchBox()).toHaveValue("kinetic");
    expect(
      await screen.findByRole("row", { name: /Kinetic Events/ }),
    ).toBeInTheDocument();
  });

  it("says so when nothing matches, in the words of the selected list", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Studio Forty Two/ });

    await userEvent.type(searchBox(), "zzzz");
    expect(
      await screen.findByText("No applications match your search."),
    ).toBeInTheDocument();

    await openTab(/Approved/);
    expect(
      await screen.findByText("No approved organizers match your search."),
    ).toBeInTheDocument();

    await openTab(/Rejected/);
    expect(
      await screen.findByText("No rejected applications match your search."),
    ).toBeInTheDocument();
  });
});

describe("AdminOrganizers: paging", () => {
  /** 37 matches in every list, 10 per page: only the page asked for is returned. */
  function serveManyApproved() {
    api.list.mockImplementation(
      async ({ verification, page = 1, pageSize }) => {
        const items = lists[verification ?? "pending"];
        return {
          items,
          meta: {
            page,
            pageSize,
            total: verification === "verified" ? 37 : items.length,
          },
        };
      },
    );
  }

  it("Next asks the server for page 2 of the selected list", async () => {
    serveManyApproved();
    renderPage();
    await openTab(/Approved/);
    const pagination = await screen.findByRole("navigation", {
      name: "Pagination",
    });
    expect(pagination).toHaveTextContent("Showing 1–2 of 37");
    expect(
      within(pagination).getByRole("button", { name: "Previous" }),
    ).toBeDisabled();

    await userEvent.click(
      within(pagination).getByRole("button", { name: "Next" }),
    );

    await waitFor(() =>
      expect(api.list).toHaveBeenCalledWith(
        expect.objectContaining({
          verification: "verified",
          page: 2,
          pageSize: 10,
        }),
      ),
    );
  });

  it("a new search or another tab starts again from page 1", async () => {
    serveManyApproved();
    renderPage();
    await openTab(/Approved/);
    await userEvent.click(
      await within(
        await screen.findByRole("navigation", { name: "Pagination" }),
      ).findByRole("button", { name: "Next" }),
    );
    await waitFor(() =>
      expect(api.list).toHaveBeenCalledWith(
        expect.objectContaining({ verification: "verified", page: 2 }),
      ),
    );

    await userEvent.type(searchBox(), "kin");

    await waitFor(() =>
      expect(api.list).toHaveBeenLastCalledWith(
        expect.objectContaining({
          verification: "verified",
          search: "kin",
          page: 1,
        }),
      ),
    );
  });
});

describe("AdminOrganizers: create an organizer", () => {
  const createdOrganizer = {
    id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e99",
    userId: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e98",
    firstName: "Dev",
    lastName: "Verma",
    email: "dev.verma@example.com",
    status: "pending" as const,
    organizationName: "Verma Live",
    organizationWebsite: null,
    isVerified: false,
    createdAt: "2026-10-27T10:00:00.000Z",
    setupEmailQueued: true,
  };

  async function openForm() {
    renderFreshPage();
    await userEvent.click(
      screen.getByRole("button", { name: "Create organizer" }),
    );
    return screen.getByRole("dialog", { name: "Create an organizer" });
  }

  /** Types into the form; a field left out stays empty. */
  async function fillIn(
    dialog: HTMLElement,
    values: {
      first?: string;
      last?: string;
      email?: string;
      organisation?: string;
      website?: string;
    },
  ) {
    const type = async (label: string | RegExp, text?: string) => {
      if (text)
        await userEvent.type(within(dialog).getByLabelText(label), text);
    };
    await type("First name", values.first);
    await type("Last name", values.last);
    await type("Email address", values.email);
    await type("Organisation name", values.organisation);
    await type(/Organisation website/, values.website);
  }

  const submit = (dialog: HTMLElement) =>
    userEvent.click(
      within(dialog).getByRole("button", { name: "Create organizer" }),
    );

  beforeEach(() => api.create.mockResolvedValue(createdOrganizer));

  it("has a Create organizer button next to the title that opens the form", async () => {
    const dialog = await openForm();

    expect(within(dialog).getByLabelText("First name")).toHaveValue("");
    expect(within(dialog).getByLabelText("Last name")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Email address")).toBeInTheDocument();
    expect(
      within(dialog).getByLabelText("Organisation name"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByLabelText(/Organisation website/),
    ).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  it("will not send an empty form, and tells the admin what is missing", async () => {
    const dialog = await openForm();

    await submit(dialog);

    expect(
      await within(dialog).findByText("First name is required"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Organization name is required"),
    ).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  it("will not send a website that is not an http(s) URL", async () => {
    const dialog = await openForm();
    await fillIn(dialog, {
      first: "Dev",
      last: "Verma",
      email: "dev.verma@example.com",
      organisation: "Verma Live",
      website: "vermalive.com",
    });

    await submit(dialog);

    expect(
      await within(dialog).findByText(/Use a full http\(s\) URL/),
    ).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  it("sends the trimmed values with the email in lower case, and leaves a blank website out", async () => {
    const dialog = await openForm();
    await fillIn(dialog, {
      first: "  Dev ",
      last: "Verma",
      email: "Dev.Verma@Example.com",
      organisation: "Verma Live",
    });

    await submit(dialog);

    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith({
        firstName: "Dev",
        lastName: "Verma",
        email: "dev.verma@example.com",
        organizationName: "Verma Live",
        organizationWebsite: undefined,
      }),
    );
  });

  it("sends the website when one is typed", async () => {
    const dialog = await openForm();
    await fillIn(dialog, {
      first: "Dev",
      last: "Verma",
      email: "dev.verma@example.com",
      organisation: "Verma Live",
      website: "https://vermalive.example.com",
    });

    await submit(dialog);

    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationWebsite: "https://vermalive.example.com",
        }),
      ),
    );
  });

  it("closes, says an email was sent, and loads the lists again", async () => {
    const dialog = await openForm();
    await fillIn(dialog, {
      first: "Dev",
      last: "Verma",
      email: "dev.verma@example.com",
      organisation: "Verma Live",
    });
    await screen.findByRole("row", { name: /Studio Forty Two/ });
    const callsBefore = api.list.mock.calls.length;

    await submit(dialog);

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent("Verma Live created");
    expect(notice).toHaveTextContent("We emailed dev.verma@example.com");
    await waitFor(() =>
      expect(api.list.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });

  it("warns when the account was created but the setup email could not be queued", async () => {
    api.create.mockResolvedValue({
      ...createdOrganizer,
      setupEmailQueued: false,
    });
    const dialog = await openForm();
    await fillIn(dialog, {
      first: "Dev",
      last: "Verma",
      email: "dev.verma@example.com",
      organisation: "Verma Live",
    });

    await submit(dialog);

    const warning = await screen.findByRole("alert");
    expect(warning).toHaveTextContent("created, but the email was not sent");
    expect(warning).toHaveTextContent("dev.verma@example.com");
  });

  it("shows a taken email under the email field and stays open", async () => {
    api.create.mockRejectedValueOnce(
      new ApiError(
        409,
        "EMAIL_TAKEN",
        "An account with this email already exists",
      ),
    );
    const dialog = await openForm();
    await fillIn(dialog, {
      first: "Dev",
      last: "Verma",
      email: "dev.verma@example.com",
      organisation: "Verma Live",
    });

    await submit(dialog);

    expect(
      await within(dialog).findByText(
        "An account with this email already exists",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Email address")).toBeInvalid();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // What was typed is kept so the admin only has to fix the email.
    expect(within(dialog).getByLabelText("Organisation name")).toHaveValue(
      "Verma Live",
    );
  });

  it("shows any other failure in a box on top, and stays open", async () => {
    api.create.mockRejectedValueOnce(
      new ApiError(500, "INTERNAL", "Something went wrong"),
    );
    const dialog = await openForm();
    await fillIn(dialog, {
      first: "Dev",
      last: "Verma",
      email: "dev.verma@example.com",
      organisation: "Verma Live",
    });

    await submit(dialog);

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "We couldn't create this organizer",
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Something went wrong",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("cannot be pressed twice while the request runs", async () => {
    api.create.mockReturnValue(new Promise(() => {}));
    const dialog = await openForm();
    await fillIn(dialog, {
      first: "Dev",
      last: "Verma",
      email: "dev.verma@example.com",
      organisation: "Verma Live",
    });

    await submit(dialog);

    const working = await within(dialog).findByRole("button", {
      name: "Creating…",
    });
    expect(working).toBeDisabled();
    expect(api.create).toHaveBeenCalledTimes(1);
  });

  it("Cancel closes without creating, and the form is empty when opened again", async () => {
    const dialog = await openForm();
    await fillIn(dialog, { first: "Dev" });

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Create organizer" }),
    );

    expect(api.create).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole("dialog")).getByLabelText("First name"),
    ).toHaveValue("");
  });

  it("forgets the last result when the form is opened again", async () => {
    const dialog = await openForm();
    await fillIn(dialog, {
      first: "Dev",
      last: "Verma",
      email: "dev.verma@example.com",
      organisation: "Verma Live",
    });
    await submit(dialog);
    await screen.findByText("Verma Live created");

    await userEvent.click(
      screen.getByRole("button", { name: "Create organizer" }),
    );

    expect(screen.queryByText("Verma Live created")).not.toBeInTheDocument();
  });
});

describe("AdminOrganizers: approve", () => {
  it("asks for confirmation, approves that organizer, closes, and refreshes the lists and counts", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Approve Acme Events Pvt Ltd",
      }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Approve Acme Events Pvt Ltd?",
    });
    expect(api.verify).not.toHaveBeenCalled();
    const callsBefore = api.list.mock.calls.length;

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve organizer" }),
    );

    await waitFor(() => expect(api.verify).toHaveBeenCalledWith(acme.id));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    // The list and the counts are loaded again: the approved organizer moves between them.
    await waitFor(() =>
      expect(api.list.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });

  it("shows why it failed (e.g. the CMS is down) and stays open so the admin can try again", async () => {
    api.verify.mockRejectedValueOnce(
      new ApiError(
        503,
        "CMS_UNAVAILABLE",
        "Could not set up CMS access right now. Please try verifying again.",
      ),
    );
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Approve Acme Events Pvt Ltd",
      }),
    );
    const dialog = screen.getByRole("dialog");

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve organizer" }),
    );

    expect(
      await within(dialog).findByText(/Could not set up CMS access right now/),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve organizer" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(api.verify).toHaveBeenCalledTimes(2);
  });

  it("cannot be pressed twice while the request runs", async () => {
    api.verify.mockReturnValue(new Promise(() => {}));
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Approve Acme Events Pvt Ltd",
      }),
    );
    const dialog = screen.getByRole("dialog");

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve organizer" }),
    );

    const working = await within(dialog).findByRole("button", {
      name: "Approving…",
    });
    expect(working).toBeDisabled();
    expect(api.verify).toHaveBeenCalledTimes(1);
  });

  it("Cancel closes without approving", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Approve Acme Events Pvt Ltd",
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.verify).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("forgets an old error when the dialog is opened again", async () => {
    api.verify.mockRejectedValueOnce(
      new ApiError(409, "EMAIL_NOT_VERIFIED", "Not verified yet"),
    );
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Approve Acme Events Pvt Ltd",
      }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Approve organizer",
      }),
    );
    await screen.findByText("Not verified yet");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await userEvent.click(
      screen.getByRole("button", { name: "Approve Acme Events Pvt Ltd" }),
    );

    expect(screen.queryByText("Not verified yet")).not.toBeInTheDocument();
  });
});

describe("AdminOrganizers: reject", () => {
  async function openReject() {
    await userEvent.click(
      await screen.findByRole("button", { name: "Reject Harbor Tech Talks" }),
    );
    return screen.getByRole("dialog", { name: "Reject Harbor Tech Talks?" });
  }

  it("will not reject without a reason, and does not call the API", async () => {
    renderPage();
    const dialog = await openReject();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Reject application" }),
    );

    expect(
      await within(dialog).findByText(
        "Enter a reason so the applicant knows what to change.",
      ),
    ).toBeInTheDocument();
    expect(api.reject).not.toHaveBeenCalled();
  });

  it("rejects that organizer with the trimmed reason and closes", async () => {
    renderPage();
    const dialog = await openReject();

    await userEvent.type(
      within(dialog).getByLabelText("Reason shared with the applicant"),
      "  Website could not be verified  ",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Reject application" }),
    );

    await waitFor(() =>
      expect(api.reject).toHaveBeenCalledWith(harbor.id, {
        reason: "Website could not be verified",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("shows a server error and keeps what was typed", async () => {
    api.reject.mockRejectedValueOnce(
      new ApiError(
        409,
        "ORGANIZER_ALREADY_VERIFIED",
        "A verified organizer cannot be rejected",
      ),
    );
    renderPage();
    const dialog = await openReject();
    await userEvent.type(
      within(dialog).getByLabelText("Reason shared with the applicant"),
      "Not enough detail",
    );

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Reject application" }),
    );

    expect(
      await within(dialog).findByText(
        "A verified organizer cannot be rejected",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByLabelText("Reason shared with the applicant"),
    ).toHaveValue("Not enough detail");
  });
});

describe("AdminOrganizers: rejected applications", () => {
  async function openRejected() {
    renderPage();
    await openTab(/Rejected/);
    await screen.findByRole("row", { name: /Pixel Garage/ });
  }

  it("shows who was rejected, when, and the reason they were given", async () => {
    await openRejected();
    const row = screen.getByRole("row", { name: /Pixel Garage/ });

    expect(within(row).getByText("Tanvi Shah")).toBeInTheDocument();
    // Clicking the organisation opens its review page, like on every other tab.
    expect(
      within(row).getByRole("link", { name: "Pixel Garage" }),
    ).toHaveAttribute("href", `/admin/organizers/${pixelGarage.id}`);
    expect(within(row).getByText("tanvi@example.com")).toBeInTheDocument();
    expect(within(row).getByText("22 Aug 2026")).toBeInTheDocument();
    expect(within(row).getByText(/Duplicate application/)).toBeInTheDocument();
  });

  it("Reconsider puts that application back in the queue and refreshes the lists", async () => {
    await openRejected();

    await userEvent.click(
      screen.getByRole("button", { name: "Reconsider Pixel Garage" }),
    );

    await waitFor(() =>
      expect(api.reopen).toHaveBeenCalledWith(pixelGarage.id),
    );
  });

  it("shows why it failed, without a dialog", async () => {
    api.reopen.mockRejectedValueOnce(
      new ApiError(
        409,
        "ORGANIZER_NOT_REJECTED",
        "Only a rejected organizer can be reopened",
      ),
    );
    await openRejected();

    await userEvent.click(
      screen.getByRole("button", { name: "Reconsider Pixel Garage" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only a rejected organizer can be reopened",
    );
  });

  it("disables the other Reconsider buttons while one request runs", async () => {
    api.reopen.mockReturnValue(new Promise(() => {}));
    await openRejected();

    await userEvent.click(
      screen.getByRole("button", { name: "Reconsider Pixel Garage" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Reconsider Gigs4All" }),
      ).toBeDisabled(),
    );
  });
});

describe("AdminOrganizers: approved organizers", () => {
  it("shows who approved and when", async () => {
    renderPage();
    await openTab(/Approved/);
    const row = await screen.findByRole("row", { name: /Kinetic Events/ });

    expect(within(row).getByText("2 Mar 2026")).toBeInTheDocument();
    expect(within(row).getByText("by Admin User")).toBeInTheDocument();
    expect(
      within(row).getByText(/Kavya Menon · kavya@example.com/),
    ).toBeInTheDocument();
  });
});

// Next.js (cacheComponents) hides a page we leave with <Activity> instead of unmounting it.
describe("AdminOrganizers: hidden and shown again", () => {
  it("comes back with no dialog open", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const view = (mode: "visible" | "hidden") => (
      <QueryClientProvider client={client}>
        <Activity mode={mode}>
          <AdminOrganizers />
        </Activity>
      </QueryClientProvider>
    );
    const { rerender } = render(view("visible"));
    await openTab(/Awaiting approval/);
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Approve Acme Events Pvt Ltd",
      }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerender(view("hidden"));
    rerender(view("visible"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
