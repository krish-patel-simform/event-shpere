import {
  cancelledKeynote,
  talk,
  workshop,
} from "../../__fixtures__/organizer-sessions";
import { filterSessionsBySearch } from "../session-search-filter";

const sessions = [cancelledKeynote, talk, workshop];
const titles = (found: readonly { title: string }[]) =>
  found.map((session) => session.title);

describe("filterSessionsBySearch", () => {
  it("returns every session, in order, for no text or only spaces", () => {
    expect(titles(filterSessionsBySearch(sessions, ""))).toEqual(
      titles(sessions),
    );
    expect(titles(filterSessionsBySearch(sessions, "   "))).toEqual(
      titles(sessions),
    );
  });

  it("matches the title anywhere in it, ignoring case", () => {
    expect(titles(filterSessionsBySearch(sessions, "OFFLINE"))).toEqual([
      talk.title,
    ]);
    expect(titles(filterSessionsBySearch(sessions, "systems in"))).toEqual([
      workshop.title,
    ]);
  });

  it("matches the hall name", () => {
    expect(titles(filterSessionsBySearch(sessions, "hall a"))).toEqual([
      talk.title,
    ]);
  });

  it("matches any speaker's name, also a second speaker", () => {
    expect(titles(filterSessionsBySearch(sessions, "rohan"))).toEqual([
      cancelledKeynote.title,
      workshop.title,
    ]);
    expect(titles(filterSessionsBySearch(sessions, "ananya"))).toEqual([
      talk.title,
      workshop.title,
    ]);
  });

  it("does not match a session with no hall by the word 'null' or 'online'", () => {
    expect(filterSessionsBySearch(sessions, "null")).toEqual([]);
    expect(filterSessionsBySearch(sessions, "undefined")).toEqual([]);
  });

  it("ignores the spaces around the text and finds nothing for text that is nowhere", () => {
    expect(titles(filterSessionsBySearch(sessions, "  offline  "))).toEqual([
      talk.title,
    ]);
    expect(filterSessionsBySearch(sessions, "zzz")).toEqual([]);
  });

  it("does not change the list it is given", () => {
    const original = [...sessions];
    filterSessionsBySearch(sessions, "talk");
    expect(sessions).toEqual(original);
  });
});
