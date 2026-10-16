// `server-only` throws when imported outside a react-server bundle, and Jest is outside.
// Tests import server code on purpose, so the guard becomes a no-op here.
jest.mock("server-only", () => ({}));
