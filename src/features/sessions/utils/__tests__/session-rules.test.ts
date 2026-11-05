import { checkSessionShape, type SessionShape } from "../session-rules";

const start = new Date("2026-12-12T04:30:00.000Z");
const end = new Date("2026-12-12T05:30:00.000Z");
const hallId = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";
const link = "https://meet.example.com/abc";

const inPerson: SessionShape = {
  mode: "in_person",
  hallId,
  onlineUrl: null,
  startAt: start,
  endAt: end,
};

const messages = (shape: SessionShape) =>
  checkSessionShape(shape).map((issue) => `${issue.path}: ${issue.message}`);

describe("checkSessionShape", () => {
  it("has nothing to say about a valid in-person, online or hybrid session", () => {
    expect(checkSessionShape(inPerson)).toEqual([]);
    expect(
      checkSessionShape({
        ...inPerson,
        mode: "online",
        hallId: null,
        onlineUrl: link,
      }),
    ).toEqual([]);
    expect(
      checkSessionShape({ ...inPerson, mode: "hybrid", onlineUrl: link }),
    ).toEqual([]);
  });

  describe("times", () => {
    it("wants a start and an end", () => {
      expect(
        messages({ ...inPerson, startAt: null, endAt: undefined }),
      ).toEqual(["startAt: Set the start time", "endAt: Set the end time"]);
    });

    it("wants the end after the start (equal is not enough)", () => {
      expect(messages({ ...inPerson, endAt: start })).toEqual([
        "endAt: End must be after the start",
      ]);
      expect(
        messages({ ...inPerson, endAt: new Date("2026-12-12T04:00:00.000Z") }),
      ).toEqual(["endAt: End must be after the start"]);
    });
  });

  describe("hall and link by mode", () => {
    it("wants a hall for in person", () => {
      expect(messages({ ...inPerson, hallId: null })).toEqual([
        "hallId: Choose a hall",
      ]);
      expect(messages({ ...inPerson, hallId: undefined })).toEqual([
        "hallId: Choose a hall",
      ]);
    });

    it("refuses a join link on an in-person session", () => {
      expect(messages({ ...inPerson, onlineUrl: link })).toEqual([
        "onlineUrl: An in-person session has no join link",
      ]);
    });

    it("wants a link and no hall for online", () => {
      const online: SessionShape = { ...inPerson, mode: "online" };

      expect(messages(online)).toEqual([
        "hallId: An online session has no hall",
        "onlineUrl: Add the join link",
      ]);
    });

    it("wants both a hall and a link for hybrid", () => {
      expect(messages({ ...inPerson, mode: "hybrid", hallId: null })).toEqual([
        "hallId: Choose a hall",
        "onlineUrl: Add the join link",
      ]);
    });
  });
});
