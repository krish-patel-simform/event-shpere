/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity } from "react";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { useHasPermission } from "@/src/features/auth";
import {
  ananya,
  createdSpeaker,
  meera,
  speakerRows,
} from "../../__fixtures__/speakers";
import { speakersApiService } from "../../api/speakers-api.service";
import type { SpeakerListItemDto } from "../../schemas/speaker.schemas";
import { SpeakerDirectory } from "../SpeakerDirectory";

// Only the API layer and the permission check are replaced: the hooks, the cache and the screens
// are the real ones.
jest.mock("../../api/speakers-api.service", () => ({
  speakersApiService: { list: jest.fn(), get: jest.fn(), create: jest.fn() },
}));
jest.mock("@/src/features/auth", () => ({
  ...jest.requireActual("@/src/features/auth"),
  useHasPermission: jest.fn(),
}));
const api = jest.mocked(speakersApiService);
const hasPermission = jest.mocked(useHasPermission);

/** A fake server: searches the name and pages, like the real endpoint. */
function serve(rows: SpeakerListItemDto[] = speakerRows) {
  api.list.mockImplementation(async ({ search = "", page = 1, pageSize }) => {
    const matches = rows.filter((row) =>
      `${row.firstName} ${row.lastName}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
    return {
      items: matches.slice((page - 1) * pageSize, page * pageSize),
      meta: { page, pageSize, total: matches.length },
    };
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SpeakerDirectory />
    </QueryClientProvider>,
  );
}

const searchBox = () =>
  screen.getByRole("searchbox", { name: "Search speakers" });
/** Types the text and presses Search. */
async function searchFor(text: string) {
  await userEvent.clear(searchBox());
  await userEvent.type(searchBox(), text);
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
}
const card = (name: RegExp) =>
  screen.getByRole("link", { name }).closest("li") as HTMLElement;
const lastListCall = () => api.list.mock.calls.at(-1)?.[0];

beforeEach(() => {
  jest.resetAllMocks();
  serve();
  hasPermission.mockReturnValue(false);
});

describe("SpeakerDirectory: list", () => {
  it("shows a loading state first, then a card for each speaker", async () => {
    renderPage();
    expect(
      screen.getByRole("status", { name: "Loading speakers" }),
    ).toBeInTheDocument();

    await screen.findByRole("link", { name: "Ananya Rao" });

    expect(
      screen.queryByRole("status", { name: "Loading speakers" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole("heading", { name: "3 speakers" })).toBeVisible();
  });

  it("asks the server for the first page of 12, with no search", async () => {
    renderPage();
    await screen.findByRole("link", { name: "Ananya Rao" });

    expect(api.list).toHaveBeenCalledWith({
      search: "",
      page: 1,
      pageSize: 12,
    });
  });

  it("links each card to the speaker's page", async () => {
    renderPage();

    expect(
      await screen.findByRole("link", { name: "Ananya Rao" }),
    ).toHaveAttribute("href", "/speakers/ananya-rao-3f9a1c");
    expect(screen.getByRole("link", { name: "Meera Joshi" })).toHaveAttribute(
      "href",
      "/speakers/meera-joshi-7b2e4d",
    );
  });

  it("shows the photo, the role and the first three topics, with how many more", async () => {
    renderPage();
    await screen.findByRole("link", { name: "Ananya Rao" });
    const ananyaCard = card(/Ananya Rao/);

    expect(
      within(ananyaCard).getByRole("img", { name: "Ananya Rao on stage" }),
    ).toHaveAttribute("src", ananya.profile?.photo?.url);
    expect(
      within(ananyaCard).getByText(
        "Principal Frontend Engineer · Northwind Labs",
      ),
    ).toBeInTheDocument();
    const topics = within(
      within(ananyaCard).getByRole("list", { name: "Topics" }),
    )
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(topics).toEqual(["Next.js", "TypeScript", "Performance", "+2"]);
  });

  it("shows the initials when there is no photo, and no topic list when there are no topics", async () => {
    renderPage();
    await screen.findByRole("link", { name: "Meera Joshi" });
    const meeraCard = card(/Meera Joshi/);

    expect(within(meeraCard).queryByRole("img")).not.toBeInTheDocument();
    expect(within(meeraCard).getByText("MJ")).toBeInTheDocument();
    expect(
      within(meeraCard).queryByRole("list", { name: "Topics" }),
    ).not.toBeInTheDocument();
    expect(
      within(meeraCard).getByText(meera.profile?.jobTitle ?? ""),
    ).toBeInTheDocument();
  });

  it("a speaker the CMS has nothing for still shows, with their name", async () => {
    renderPage();
    await screen.findByRole("link", { name: "Vikram Mehta" });

    expect(
      within(card(/Vikram Mehta/)).getByText("Profile coming soon"),
    ).toBeInTheDocument();
  });

  it("has no Export CSV button, no event select and no popular topics", async () => {
    renderPage();
    await screen.findByRole("link", { name: "Ananya Rao" });

    expect(
      screen.queryByRole("button", { name: /export/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText(/popular topics/i)).not.toBeInTheDocument();
  });

  it("says so when there are no speakers", async () => {
    serve([]);
    renderPage();

    expect(await screen.findByText("No speakers yet.")).toBeInTheDocument();
  });

  it("shows the error with Try again when the list cannot be loaded", async () => {
    api.list.mockRejectedValueOnce(
      new ApiError(500, "INTERNAL_ERROR", "Something went wrong"),
    );
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't load the speakers");
    expect(alert).toHaveTextContent("Something went wrong");

    await userEvent.click(
      within(alert).getByRole("button", { name: "Try again" }),
    );

    expect(
      await screen.findByRole("link", { name: "Ananya Rao" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("SpeakerDirectory: search by name", () => {
  it("does not ask the server while typing: only when Search is pressed", async () => {
    renderPage();
    await screen.findByRole("link", { name: "Ananya Rao" });
    const callsBefore = api.list.mock.calls.length;

    await userEvent.type(searchBox(), "meera");
    // Long enough for a debounce to have fired, if there were one.
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(api.list.mock.calls).toHaveLength(callsBefore);
    expect(
      screen.getByRole("link", { name: "Ananya Rao" }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() =>
      expect(lastListCall()).toEqual(
        expect.objectContaining({ search: "meera", page: 1 }),
      ),
    );
    expect(
      await screen.findByRole("heading", { name: "1 speaker matches “meera”" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Ananya Rao" }),
    ).not.toBeInTheDocument();
  });

  it("also searches when Enter is pressed in the box", async () => {
    renderPage();
    await screen.findByRole("link", { name: "Ananya Rao" });

    await userEvent.type(searchBox(), "meera{Enter}");

    await waitFor(() =>
      expect(lastListCall()).toEqual(
        expect.objectContaining({ search: "meera" }),
      ),
    );
  });

  it("trims the text, and an empty search shows everyone again", async () => {
    renderPage();
    await screen.findByRole("link", { name: "Ananya Rao" });
    await searchFor("  meera  ");
    await waitFor(() =>
      expect(lastListCall()).toEqual(
        expect.objectContaining({ search: "meera" }),
      ),
    );

    await userEvent.clear(searchBox());
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(
      await screen.findByRole("link", { name: "Ananya Rao" }),
    ).toBeInTheDocument();
    expect(lastListCall()).toEqual(expect.objectContaining({ search: "" }));
  });

  it("only searches the name: the box says so", async () => {
    renderPage();

    expect(searchBox()).toHaveAttribute("placeholder", "Search by name");
  });

  it("says so when nothing matches", async () => {
    renderPage();
    await screen.findByRole("link", { name: "Ananya Rao" });

    await searchFor("zzzz");

    expect(
      await screen.findByText("No speakers match your search."),
    ).toBeInTheDocument();
  });

  it("shows the loading state, not the cards of the old search, while a new search loads", async () => {
    renderPage();
    await screen.findByRole("link", { name: "Ananya Rao" });

    const server = api.list.getMockImplementation()!;
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    api.list.mockImplementation(async (params) => {
      await gate;
      return server(params);
    });
    await searchFor("meera");

    expect(
      await screen.findByRole("status", { name: "Loading speakers" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Ananya Rao" }),
    ).not.toBeInTheDocument();

    release();
    expect(
      await screen.findByRole("link", { name: "Meera Joshi" }),
    ).toBeInTheDocument();
  });
});

describe("SpeakerDirectory: paging", () => {
  const many = Array.from({ length: 14 }, (_, index) => ({
    ...vikramLike(index),
  }));

  function vikramLike(index: number): SpeakerListItemDto {
    const name = String(index).padStart(2, "0");
    return {
      slug: `speaker-${name}`,
      firstName: `Speaker${name}`,
      lastName: "Test",
      profile: null,
    };
  }

  it("shows the total from the server and pages with Next and Previous", async () => {
    serve(many);
    renderPage();
    await screen.findByRole("link", { name: "Speaker00 Test" });
    const pagination = screen.getByRole("navigation", { name: "Pagination" });
    expect(pagination).toHaveTextContent("Showing 1–12 of 14");

    await userEvent.click(
      within(pagination).getByRole("button", { name: "Next" }),
    );

    expect(
      await screen.findByRole("link", { name: "Speaker12 Test" }),
    ).toBeInTheDocument();
    expect(lastListCall()).toEqual(expect.objectContaining({ page: 2 }));
    expect(
      screen.getByRole("navigation", { name: "Pagination" }),
    ).toHaveTextContent("Showing 13–14 of 14");
  });

  it("a new search starts again from page 1", async () => {
    serve(many);
    renderPage();
    await screen.findByRole("link", { name: "Speaker00 Test" });
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("link", { name: "Speaker12 Test" });

    await searchFor("speaker0");

    await waitFor(() =>
      expect(lastListCall()).toEqual(
        expect.objectContaining({ search: "speaker0", page: 1 }),
      ),
    );
  });
});

describe("SpeakerDirectory: Add speaker", () => {
  it("is checked with the SPEAKER_CREATE permission", async () => {
    renderPage();
    await screen.findByRole("link", { name: "Ananya Rao" });

    expect(hasPermission).toHaveBeenCalledWith("SPEAKER_CREATE");
  });

  it("is hidden for someone without the permission", async () => {
    hasPermission.mockReturnValue(false);
    renderPage();
    await screen.findByRole("link", { name: "Ananya Rao" });

    expect(
      screen.queryByRole("button", { name: "Add speaker" }),
    ).not.toBeInTheDocument();
  });

  describe("with the permission", () => {
    beforeEach(() => {
      hasPermission.mockReturnValue(true);
      api.create.mockResolvedValue(createdSpeaker);
    });

    const openDialog = async () => {
      await userEvent.click(
        await screen.findByRole("button", { name: "Add speaker" }),
      );
      return screen.getByRole("dialog", { name: "Add a speaker" });
    };
    const fill = async (dialog: HTMLElement) => {
      await userEvent.type(
        within(dialog).getByLabelText("First name"),
        "Sneha",
      );
      await userEvent.type(within(dialog).getByLabelText("Last name"), "Desai");
      await userEvent.type(
        within(dialog).getByLabelText("Email address"),
        "sneha.desai@example.com",
      );
    };

    it("opens a form with the name and the email", async () => {
      renderPage();
      const dialog = await openDialog();

      expect(within(dialog).getByLabelText("First name")).toBeVisible();
      expect(within(dialog).getByLabelText("Last name")).toBeVisible();
      expect(within(dialog).getByLabelText("Email address")).toBeVisible();
    });

    it("asks for every field before sending", async () => {
      renderPage();
      const dialog = await openDialog();

      await userEvent.click(
        within(dialog).getByRole("button", { name: "Add speaker" }),
      );

      expect(
        await within(dialog).findByText("First name is required"),
      ).toBeVisible();
      expect(within(dialog).getByText("Last name is required")).toBeVisible();
      expect(api.create).not.toHaveBeenCalled();
    });

    it("adds the speaker, closes, says what happens next and loads the list again", async () => {
      renderPage();
      await screen.findByRole("link", { name: "Ananya Rao" });
      const dialog = await openDialog();
      await fill(dialog);
      const callsBefore = api.list.mock.calls.length;

      await userEvent.click(
        within(dialog).getByRole("button", { name: "Add speaker" }),
      );

      expect(api.create).toHaveBeenCalledWith({
        firstName: "Sneha",
        lastName: "Desai",
        email: "sneha.desai@example.com",
      });
      expect(await screen.findByText("Sneha Desai was added")).toBeVisible();
      expect(
        screen.getByText(/We emailed sneha\.desai@example\.com a link/),
      ).toBeVisible();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await waitFor(() =>
        expect(api.list.mock.calls.length).toBeGreaterThan(callsBefore),
      );
    });

    it("warns when the speaker was added but the email could not be queued", async () => {
      api.create.mockResolvedValue({
        ...createdSpeaker,
        setupEmailQueued: false,
      });
      renderPage();
      const dialog = await openDialog();
      await fill(dialog);

      await userEvent.click(
        within(dialog).getByRole("button", { name: "Add speaker" }),
      );

      expect(
        await screen.findByText(
          "Sneha Desai was added, but the email was not sent",
        ),
      ).toBeVisible();
    });

    it("shows a used email under the email field and stays open", async () => {
      api.create.mockRejectedValue(
        new ApiError(
          409,
          "SPEAKER_EXISTS",
          "A speaker with this email already exists",
        ),
      );
      renderPage();
      const dialog = await openDialog();
      await fill(dialog);

      await userEvent.click(
        within(dialog).getByRole("button", { name: "Add speaker" }),
      );

      expect(
        await within(dialog).findByText(
          "A speaker with this email already exists",
        ),
      ).toBeVisible();
      expect(
        screen.getByRole("dialog", { name: "Add a speaker" }),
      ).toBeInTheDocument();
      expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows any other failure in a box on top, and stays open", async () => {
      api.create.mockRejectedValue(
        new ApiError(
          503,
          "CMS_UNAVAILABLE",
          "Could not create the speaker right now. Please try again.",
        ),
      );
      renderPage();
      const dialog = await openDialog();
      await fill(dialog);

      await userEvent.click(
        within(dialog).getByRole("button", { name: "Add speaker" }),
      );

      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "Could not create the speaker right now",
      );
    });

    it("Cancel closes the form without sending anything", async () => {
      renderPage();
      const dialog = await openDialog();

      await userEvent.click(
        within(dialog).getByRole("button", { name: "Cancel" }),
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(api.create).not.toHaveBeenCalled();
    });
  });
});

// Next.js (cacheComponents) hides a page we leave with <Activity> instead of unmounting it.
describe("SpeakerDirectory: hidden and shown again", () => {
  it("comes back with no dialog open", async () => {
    hasPermission.mockReturnValue(true);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const view = (mode: "visible" | "hidden") => (
      <QueryClientProvider client={client}>
        <Activity mode={mode}>
          <SpeakerDirectory />
        </Activity>
      </QueryClientProvider>
    );
    const { rerender } = render(view("visible"));
    await userEvent.click(
      await screen.findByRole("button", { name: "Add speaker" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerender(view("hidden"));
    rerender(view("visible"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
