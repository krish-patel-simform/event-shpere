import {
  SAMPLE_SESSIONS,
  SAMPLE_SPEAKERS,
} from "../../sample/organizer-sample";
import {
  incompleteProfiles,
  searchSpeakers,
  speakerRows,
} from "../event-speakers";

const rows = speakerRows(SAMPLE_SPEAKERS, SAMPLE_SESSIONS);
const byName = (name: string) => {
  const row = rows.find((candidate) => candidate.name === name);
  if (!row) throw new Error(`no sample speaker ${name}`);
  return row;
};

describe("speakerRows", () => {
  it("lists the sessions each speaker presents, in schedule order", () => {
    expect(byName("Meera Joshi").sessionTitles).toEqual([
      "Opening Keynote: The State of Product Engineering",
      "Design Systems at Scale",
      "Designing Accessible Data Tables",
    ]);
  });

  it("does not count a cancelled session", () => {
    // Arjun Nair also had "Micro-frontends in Practice", which is cancelled.
    expect(byName("Arjun Nair").sessionTitles).toEqual([
      "Measuring Developer Experience",
      "Platform Teams at Scale",
    ]);
  });

  it("has no sessions for a speaker nobody assigned", () => {
    expect(byName("Rhea Thomas").sessionTitles).toEqual([]);
  });

  it("keeps a session that is not scheduled yet", () => {
    expect(byName("Priya Kulkarni").sessionTitles).toContain(
      "Platform Teams at Scale",
    );
  });
});

describe("searchSpeakers", () => {
  it("matches part of a name in any case", () => {
    expect(searchSpeakers(rows, "ananya").map((row) => row.name)).toEqual([
      "Ananya Rao",
    ]);
    expect(searchSpeakers(rows, "  MEHTA ").map((row) => row.name)).toEqual([
      "Vikram Mehta",
    ]);
  });

  it("gives every speaker for a blank search", () => {
    expect(searchSpeakers(rows, "   ")).toHaveLength(rows.length);
  });

  it("gives none when nobody matches", () => {
    expect(searchSpeakers(rows, "zzz")).toEqual([]);
  });
});

describe("incompleteProfiles", () => {
  it("counts the speakers with something missing", () => {
    expect(incompleteProfiles(rows)).toBe(2);
  });
});
