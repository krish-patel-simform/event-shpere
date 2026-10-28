import { OWN_SPEAKER_PROFILE_SAMPLE } from "../own-profile.sample";
import {
  fillValues,
  friendlyError,
  LINK_ERROR,
  linkError,
  photoFileError,
  profileCompleteness,
  toFormValues,
} from "../own-profile-form";

describe("photoFileError", () => {
  const MB = 1024 * 1024;

  it.each(["image/jpeg", "image/png", "image/webp"])("accepts %s", (type) => {
    expect(photoFileError({ type, size: 1000 })).toBeUndefined();
  });

  it.each(["image/gif", "image/svg+xml", "application/pdf", ""])(
    "refuses the type %p",
    (type) => {
      expect(photoFileError({ type, size: 1000 })).toBe(
        "Choose a JPG, PNG or WebP image",
      );
    },
  );

  it("accepts exactly 2 MB and refuses one byte more", () => {
    expect(photoFileError({ type: "image/png", size: 2 * MB })).toBeUndefined();
    expect(photoFileError({ type: "image/png", size: 2 * MB + 1 })).toBe(
      "The photo must be 2 MB or smaller",
    );
  });
});

describe("toFormValues", () => {
  it("turns a missing text into an empty string and keeps the rest", () => {
    const values = toFormValues({
      ...OWN_SPEAKER_PROFILE_SAMPLE,
      jobTitle: null,
      company: null,
      websiteUrl: "https://example.com",
    });
    expect(values).toMatchObject({
      firstName: "Ananya",
      jobTitle: "",
      company: "",
      linkedinUrl: "",
      websiteUrl: "https://example.com",
      expertise: OWN_SPEAKER_PROFILE_SAMPLE.expertise,
    });
  });
});

describe("fillValues", () => {
  it("fills what is missing or null with blanks", () => {
    expect(fillValues({ firstName: "A", jobTitle: null })).toEqual({
      firstName: "A",
      lastName: "",
      jobTitle: "",
      company: "",
      bio: "",
      expertise: [],
      linkedinUrl: "",
      twitterUrl: "",
      websiteUrl: "",
    });
  });
});

describe("friendlyError", () => {
  it("rewrites the too-long message of the schema", () => {
    expect(
      friendlyError("Too big: expected string to have <=100 characters", 100),
    ).toBe("Use at most 100 characters");
  });

  it("keeps our own messages and handles no message", () => {
    expect(friendlyError("First name is required", 100)).toBe(
      "First name is required",
    );
    expect(friendlyError(undefined, 100)).toBeUndefined();
  });
});

describe("linkError", () => {
  it("says what a link must look like", () => {
    expect(linkError("Invalid URL")).toBe(LINK_ERROR);
  });

  it("keeps the length message for a too long link", () => {
    expect(linkError("Too big: expected string to have <=255 characters")).toBe(
      "Use at most 255 characters",
    );
    expect(linkError(undefined)).toBeUndefined();
  });
});

describe("profileCompleteness", () => {
  const empty = fillValues({});

  it("is 0% for an empty profile and lists everything", () => {
    expect(profileCompleteness(empty)).toEqual({
      percent: 0,
      missing: [
        "a job title",
        "a company",
        "a bio",
        "at least one topic",
        "at least one link",
      ],
    });
  });

  it("counts each part once and ignores blank spaces", () => {
    const result = profileCompleteness({
      ...empty,
      jobTitle: "Engineer",
      company: "   ",
      expertise: ["A"],
    });
    expect(result.percent).toBe(40);
    expect(result.missing).toEqual(["a company", "a bio", "at least one link"]);
  });

  it("counts any one link", () => {
    expect(
      profileCompleteness({ ...empty, twitterUrl: "https://x.com/a" }).percent,
    ).toBe(20);
  });

  it("is 100% when all is there", () => {
    expect(
      profileCompleteness({
        ...toFormValues(OWN_SPEAKER_PROFILE_SAMPLE),
        websiteUrl: "https://example.com",
      }),
    ).toEqual({ percent: 100, missing: [] });
  });
});
