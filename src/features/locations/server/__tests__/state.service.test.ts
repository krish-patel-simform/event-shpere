import { stateListResponseSchema } from "../../schemas/state.schemas";
import { createStateService } from "../state.service";

// Empty factory: the DB client and env are never loaded.
jest.mock("../state.repository", () => ({}));

const createdAt = new Date("2026-11-02T10:00:00.000Z");

const row = (id: string, name: string, code: string) => ({
  id,
  name,
  code,
  countryCode: null,
  createdAt,
  updatedAt: createdAt,
});

describe("stateService.listStates", () => {
  it("returns every state as a valid DTO, in the order the repository gave", async () => {
    const listStates = jest
      .fn()
      .mockResolvedValue([
        row("9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d", "Goa", "IN-GA"),
        row("3b7c2d1e-6f5a-4e8d-9a0b-1c2d3e4f5a6b", "Gujarat", "IN-GJ"),
      ]);

    const states = await createStateService({
      stateRepository: { listStates },
    }).listStates();

    expect(stateListResponseSchema.parse(states)).toEqual(states);
    expect(states.map((state) => state.name)).toEqual(["Goa", "Gujarat"]);
  });

  it("never returns the country code or the timestamps", async () => {
    const listStates = jest
      .fn()
      .mockResolvedValue([
        row("3b7c2d1e-6f5a-4e8d-9a0b-1c2d3e4f5a6b", "Gujarat", "IN-GJ"),
      ]);

    const [state] = await createStateService({
      stateRepository: { listStates },
    }).listStates();

    expect(Object.keys(state).sort()).toEqual(["code", "id", "name"]);
  });
});
