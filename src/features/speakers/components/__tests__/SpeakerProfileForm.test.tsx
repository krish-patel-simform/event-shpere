/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  updateOwnSpeakerProfileBodySchema,
  type OwnSpeakerProfileDto,
} from "../../schemas/speaker.schemas";
import { OWN_SPEAKER_PROFILE_SAMPLE } from "../../utils/own-profile.sample";
import { LINK_ERROR } from "../../utils/own-profile-form";
import { SpeakerProfileForm } from "../SpeakerProfileForm";
import {
  SpeakerProfileError,
  SpeakerProfileSkeleton,
} from "../SpeakerProfileStates";

const SAMPLE_NOTE = "Sample data: nothing was sent to the server";

const profile: OwnSpeakerProfileDto = {
  ...OWN_SPEAKER_PROFILE_SAMPLE,
  expertise: ["Next.js", "TypeScript"],
};

const field = (name: string | RegExp) => screen.getByRole("textbox", { name });
const save = () => screen.getByRole("button", { name: "Save profile" });

async function replace(name: string | RegExp, text: string) {
  const input = field(name);
  await userEvent.clear(input);
  if (text) await userEvent.type(input, text);
}

async function addTopic(text: string) {
  await userEvent.type(field("Topics"), text);
  await userEvent.click(screen.getByRole("button", { name: "Add topic" }));
}

describe("SpeakerProfileForm: initial values", () => {
  it("fills the fields from the profile", () => {
    render(<SpeakerProfileForm initialValues={profile} />);
    expect(field(/First name/)).toHaveValue("Ananya");
    expect(field(/Last name/)).toHaveValue("Rao");
    expect(field(/Job title/)).toHaveValue("Principal Frontend Engineer");
    expect(field(/Company/)).toHaveValue("Northwind Labs");
    expect(field("Short bio")).toHaveValue(profile.bio);
    expect(field("Website")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Remove Next.js" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Your topics" }).children,
    ).toHaveLength(2);
  });

  it("shows the saved links and counts the bio", () => {
    render(
      <SpeakerProfileForm
        initialValues={{
          ...profile,
          bio: "Short.",
          websiteUrl: "https://example.com",
          linkedinUrl: "https://linkedin.com/in/ananya",
        }}
      />,
    );
    expect(field("Website")).toHaveValue("https://example.com");
    expect(field("LinkedIn")).toHaveValue("https://linkedin.com/in/ananya");
    expect(screen.getByText("6 / 5000")).toBeInTheDocument();
  });

  it("works with its own sample data", () => {
    render(<SpeakerProfileForm />);
    expect(field(/First name/)).toHaveValue("Ananya");
    expect(
      screen.getByRole("heading", { name: "Edit my profile" }),
    ).toBeInTheDocument();
  });

  it("links to the public page", () => {
    render(<SpeakerProfileForm initialValues={profile} />);
    expect(
      screen.getByRole("link", { name: "View public page" }),
    ).toHaveAttribute("href", `/speakers/${profile.slug}`);
  });

  it("says plainly that the photo cannot be changed yet", () => {
    render(<SpeakerProfileForm initialValues={profile} />);
    expect(
      screen.getByRole("button", { name: "Upload new photo" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/not available here yet.*JPG, PNG, WebP, up to 2 MB/),
    ).toBeInTheDocument();
  });
});

describe("SpeakerProfileForm: validation (the schema of PATCH /api/me/speaker-profile)", () => {
  it("needs a first and a last name", async () => {
    render(<SpeakerProfileForm initialValues={profile} />);
    await replace(/First name/, "");
    await replace(/Last name/, "   ");
    await userEvent.click(save());

    expect(
      await screen.findByText("First name is required"),
    ).toBeInTheDocument();
    expect(screen.getByText("Last name is required")).toBeInTheDocument();
    expect(field(/First name/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText(SAMPLE_NOTE)).toBeNull();
  });

  it("lets the optional texts be empty", async () => {
    render(<SpeakerProfileForm initialValues={profile} />);
    await replace(/Job title/, "");
    await replace(/Company/, "");
    await replace("Short bio", "");
    await userEvent.click(save());
    expect(await screen.findByText(SAMPLE_NOTE)).toBeInTheDocument();
  });

  it("refuses a bio over 5000 characters", async () => {
    render(<SpeakerProfileForm initialValues={profile} />);
    fireEvent.change(field("Short bio"), {
      target: { value: "a".repeat(5001) },
    });
    expect(screen.getByText("5001 / 5000")).toBeInTheDocument();
    await userEvent.click(save());

    expect(
      await screen.findByText("Use at most 5000 characters"),
    ).toBeInTheDocument();
    expect(screen.queryByText(SAMPLE_NOTE)).toBeNull();
  });

  it("accepts a bio of exactly 5000 characters", async () => {
    render(<SpeakerProfileForm initialValues={profile} />);
    fireEvent.change(field("Short bio"), {
      target: { value: "a".repeat(5000) },
    });
    await userEvent.click(save());
    expect(await screen.findByText(SAMPLE_NOTE)).toBeInTheDocument();
  });

  it("refuses a job title over 100 characters", async () => {
    render(<SpeakerProfileForm initialValues={profile} />);
    fireEvent.change(field(/Job title/), {
      target: { value: "x".repeat(101) },
    });
    await userEvent.click(save());
    expect(
      await screen.findByText("Use at most 100 characters"),
    ).toBeInTheDocument();
  });

  it.each([
    ["example.com"],
    ["javascript:alert(1)"],
    ["ftp://example.com/file"],
    ["https://"],
  ])("refuses the link %s: only http(s) addresses", async (link) => {
    render(<SpeakerProfileForm initialValues={profile} />);
    await replace("Website", link);
    await userEvent.click(save());

    expect(await screen.findByText(LINK_ERROR)).toBeInTheDocument();
    expect(field("Website")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText(SAMPLE_NOTE)).toBeNull();
  });

  it.each([["https://example.com"], ["http://example.com/me?x=1"]])(
    "accepts the link %s",
    async (link) => {
      render(<SpeakerProfileForm initialValues={profile} />);
      await replace("LinkedIn", link);
      await userEvent.click(save());
      expect(await screen.findByText(SAMPLE_NOTE)).toBeInTheDocument();
    },
  );

  it("agrees with the schema on what is a valid body", () => {
    const body = {
      firstName: "Ananya",
      lastName: "Rao",
      expertise: Array.from({ length: 10 }, (_, i) => `Topic ${i}`),
      websiteUrl: "https://example.com",
    };
    expect(updateOwnSpeakerProfileBodySchema.safeParse(body).success).toBe(
      true,
    );
    expect(
      updateOwnSpeakerProfileBodySchema.safeParse({
        ...body,
        expertise: [...body.expertise, "Topic 11"],
      }).success,
    ).toBe(false);
    expect(
      updateOwnSpeakerProfileBodySchema.safeParse({
        ...body,
        websiteUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });
});

describe("SpeakerProfileForm: topics", () => {
  it("adds a topic with the button and with Enter, without sending the form", async () => {
    render(<SpeakerProfileForm initialValues={profile} />);
    await addTopic("Web performance");
    expect(
      screen.getByRole("button", { name: "Remove Web performance" }),
    ).toBeInTheDocument();
    expect(field("Topics")).toHaveValue("");

    await userEvent.type(field("Topics"), "A11y{Enter}");
    expect(
      screen.getByRole("button", { name: "Remove A11y" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(SAMPLE_NOTE)).toBeNull();
    expect(screen.getByText(/4 of 10 topics/)).toBeInTheDocument();
  });

  it("does not add a blank topic or the same topic twice (any capitals)", async () => {
    render(<SpeakerProfileForm initialValues={profile} />);
    await addTopic("   ");
    await addTopic("next.JS");
    expect(
      screen.getByRole("list", { name: "Your topics" }).children,
    ).toHaveLength(2);
  });

  it("removes a topic", async () => {
    render(<SpeakerProfileForm initialValues={profile} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Remove Next.js" }),
    );
    expect(screen.queryByRole("button", { name: "Remove Next.js" })).toBeNull();
    expect(screen.getByText(/1 of 10 topics/)).toBeInTheDocument();
  });

  it("allows 10 topics and says 'Add up to 10 topics' for an 11th, which blocks saving", async () => {
    render(
      <SpeakerProfileForm
        initialValues={{
          ...profile,
          expertise: Array.from({ length: 9 }, (_, i) => `Topic ${i}`),
        }}
      />,
    );
    await addTopic("Tenth");
    expect(screen.queryByText("Add up to 10 topics")).toBeNull();

    await addTopic("Eleventh");
    expect(await screen.findByText("Add up to 10 topics")).toBeInTheDocument();
    await userEvent.click(save());
    expect(screen.queryByText(SAMPLE_NOTE)).toBeNull();

    // Removing one clears the error and saving works again.
    await userEvent.click(
      screen.getByRole("button", { name: "Remove Eleventh" }),
    );
    await userEvent.click(save());
    expect(await screen.findByText(SAMPLE_NOTE)).toBeInTheDocument();
  });

  it("limits one topic to 40 characters in the box", () => {
    render(<SpeakerProfileForm initialValues={profile} />);
    expect(field("Topics")).toHaveAttribute("maxlength", "40");
  });
});

describe("SpeakerProfileForm: submitting", () => {
  it("by default shows the sample note and sends nothing", async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy;
    render(<SpeakerProfileForm initialValues={profile} />);
    await userEvent.click(save());

    expect(await screen.findByText(SAMPLE_NOTE)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("hands the parsed body to onSubmit: trimmed, blanks as null, topics as a list", async () => {
    const onSubmit = jest.fn();
    render(<SpeakerProfileForm initialValues={profile} onSubmit={onSubmit} />);
    await replace(/First name/, "  Ananya ");
    await replace(/Job title/, "");
    await replace("Website", " https://example.com ");
    await userEvent.click(save());

    expect(await screen.findByText("Profile saved")).toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({
      firstName: "Ananya",
      lastName: "Rao",
      jobTitle: null,
      company: "Northwind Labs",
      bio: profile.bio,
      expertise: ["Next.js", "TypeScript"],
      linkedinUrl: null,
      twitterUrl: null,
      websiteUrl: "https://example.com",
    });
    // With an onSubmit, the sample note is not shown.
    expect(screen.queryByText(SAMPLE_NOTE)).toBeNull();
  });

  it("does not call onSubmit while the form is invalid", async () => {
    const onSubmit = jest.fn();
    render(<SpeakerProfileForm initialValues={profile} onSubmit={onSubmit} />);
    await replace(/Last name/, "");
    await userEvent.click(save());
    await screen.findByText("Last name is required");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows why saving failed and keeps the values", async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error("Server said no"));
    render(<SpeakerProfileForm initialValues={profile} onSubmit={onSubmit} />);
    await replace(/Company/, "Acme");
    await userEvent.click(save());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Server said no",
    );
    expect(field(/Company/)).toHaveValue("Acme");
  });

  it("shows the button as busy while saving", async () => {
    let finish: () => void = () => undefined;
    const onSubmit = jest.fn(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    render(<SpeakerProfileForm initialValues={profile} onSubmit={onSubmit} />);
    await replace(/Company/, "Acme");
    await userEvent.click(save());

    const busy = await screen.findByRole("button", { name: "Saving…" });
    expect(busy).toBeDisabled();
    finish();
    expect(await screen.findByText("Profile saved")).toBeInTheDocument();
  });
});

describe("SpeakerProfileForm: photo and the two requests", () => {
  const imageFile = (name = "me.png", type = "image/png") =>
    new File(["x"], name, { type });
  const pickPhoto = (file: File) =>
    fireEvent.change(screen.getByLabelText("Photo file"), {
      target: { files: [file] },
    });
  const renderWired = (
    handlers: {
      onSubmit?: jest.Mock;
      onUploadPhoto?: jest.Mock;
    } = {},
  ) => {
    const onSubmit = handlers.onSubmit ?? jest.fn();
    const onUploadPhoto = handlers.onUploadPhoto ?? jest.fn();
    render(
      <SpeakerProfileForm
        initialValues={profile}
        onSubmit={onSubmit}
        onUploadPhoto={onUploadPhoto}
      />,
    );
    return { onSubmit, onUploadPhoto };
  };

  beforeEach(() => {
    URL.createObjectURL = jest.fn(() => "blob:preview");
    URL.revokeObjectURL = jest.fn();
  });

  it("enables the photo button when uploads are wired, with the rules as its hint", () => {
    renderWired();
    expect(
      screen.getByRole("button", { name: "Upload new photo" }),
    ).toBeEnabled();
    expect(screen.getByText("JPG, PNG, WebP, up to 2 MB.")).toBeInTheDocument();
  });

  it("previews a chosen photo without uploading it yet", () => {
    const { onUploadPhoto } = renderWired();
    pickPhoto(imageFile("headshot.png"));

    expect(screen.getByRole("img")).toHaveAttribute("src", "blob:preview");
    expect(
      screen.getByText("headshot.png will replace your photo when you save."),
    ).toBeInTheDocument();
    expect(onUploadPhoto).not.toHaveBeenCalled();
  });

  it("refuses a file that is not a JPG, PNG or WebP image", () => {
    renderWired();
    pickPhoto(imageFile("cv.pdf", "application/pdf"));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose a JPG, PNG or WebP image",
    );
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("refuses a photo over 2 MB", () => {
    renderWired();
    const big = imageFile();
    Object.defineProperty(big, "size", { value: 2 * 1024 * 1024 + 1 });
    pickPhoto(big);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The photo must be 2 MB or smaller",
    );
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("drops the chosen photo on Discard", async () => {
    renderWired();
    pickPhoto(imageFile());
    await userEvent.click(
      screen.getByRole("button", { name: "Discard changes" }),
    );

    expect(screen.queryByRole("img")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Discard changes" }),
    ).toBeDisabled();
  });

  it("uploads only the photo when no detail changed", async () => {
    const { onSubmit, onUploadPhoto } = renderWired();
    const file = imageFile();
    pickPhoto(file);
    await userEvent.click(save());

    expect(await screen.findByText("Profile saved")).toBeInTheDocument();
    expect(onUploadPhoto).toHaveBeenCalledWith(file);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("uploads the photo first, then saves the details, and then has nothing left to save", async () => {
    const calls: string[] = [];
    const { onSubmit, onUploadPhoto } = renderWired({
      onUploadPhoto: jest.fn(async () => void calls.push("photo")),
      onSubmit: jest.fn(async () => void calls.push("details")),
    });
    pickPhoto(imageFile());
    await replace(/Company/, "Acme");
    await userEvent.click(save());

    expect(await screen.findByText("Profile saved")).toBeInTheDocument();
    expect(calls).toEqual(["photo", "details"]);
    expect(onUploadPhoto).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Discard changes" }),
    ).toBeDisabled();
  });

  it("does not save the details when the photo fails, and keeps the choice", async () => {
    const { onSubmit } = renderWired({
      onUploadPhoto: jest.fn().mockRejectedValue(new Error("Too big for us")),
    });
    pickPhoto(imageFile());
    await replace(/Company/, "Acme");
    await userEvent.click(save());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't upload your photo");
    expect(alert).toHaveTextContent("Too big for us");
    expect(alert).toHaveTextContent(
      "Your other changes were not saved either.",
    );
    expect(onSubmit).not.toHaveBeenCalled();
    expect(field(/Company/)).toHaveValue("Acme");
    expect(screen.getByRole("img")).toHaveAttribute("src", "blob:preview");
  });

  it("says the photo was updated when only the details fail, and does not upload it again", async () => {
    const { onUploadPhoto } = renderWired({
      onSubmit: jest.fn().mockRejectedValue(new Error("Strapi is down")),
    });
    pickPhoto(imageFile());
    await replace(/Company/, "Acme");
    await userEvent.click(save());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Photo updated, but your details were not saved",
    );
    expect(alert).toHaveTextContent("Strapi is down");

    // Trying again only sends the details.
    await userEvent.click(save());
    await screen.findByRole("alert");
    expect(onUploadPhoto).toHaveBeenCalledTimes(1);
  });

  it("sends nothing and says so when there is nothing to save", async () => {
    const { onSubmit, onUploadPhoto } = renderWired();
    await userEvent.click(save());

    expect(await screen.findByText("No changes to save")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onUploadPhoto).not.toHaveBeenCalled();
  });
});

describe("SpeakerProfileForm: discard and preview", () => {
  it("can only discard after a change, and puts the saved values back", async () => {
    render(<SpeakerProfileForm initialValues={profile} />);
    const discard = screen.getByRole("button", { name: "Discard changes" });
    expect(discard).toBeDisabled();

    await replace(/Company/, "Acme");
    await addTopic("Extra");
    expect(discard).toBeEnabled();

    await userEvent.click(discard);
    expect(field(/Company/)).toHaveValue("Northwind Labs");
    expect(screen.queryByRole("button", { name: "Remove Extra" })).toBeNull();
    expect(discard).toBeDisabled();
  });

  it("shows the preview and updates it as the speaker types", async () => {
    render(<SpeakerProfileForm initialValues={profile} />);
    expect(screen.getByText("Ananya Rao")).toBeInTheDocument();
    expect(
      screen.getByText("Principal Frontend Engineer · Northwind Labs"),
    ).toBeInTheDocument();

    await replace(/First name/, "Asha");
    expect(screen.getByText("Asha Rao")).toBeInTheDocument();
  });

  it("shows how complete the profile is and what is missing", async () => {
    render(<SpeakerProfileForm initialValues={profile} />);
    const bar = screen.getByRole("progressbar", {
      name: "Profile completeness",
    });
    expect(bar).toHaveAttribute("aria-valuenow", "80");
    expect(
      screen.getByText("Still to add: at least one link."),
    ).toBeInTheDocument();

    await replace("Website", "https://example.com");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("Nothing left to add.")).toBeInTheDocument();
  });
});

describe("Speaker profile states", () => {
  it("shows the loading state", () => {
    render(<SpeakerProfileSkeleton />);
    expect(
      screen.getByRole("status", { name: "Loading your profile" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Edit my profile" }),
    ).toBeInTheDocument();
  });

  it("shows the error with a Try again button", async () => {
    const onRetry = jest.fn();
    render(<SpeakerProfileError message="Network down" onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Network down");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
