import type { Config } from "jest";
import nextJest from "next/jest.js";

// next/jest wires the Next.js (SWC) compiler as the transform and loads .env files.
const createJestConfig = nextJest({ dir: "./" });

// What both projects share. Server code (services, http core) is tested in Node. Component tests
// opt into jsdom per file with a `@jest-environment jsdom` docblock.
const shared: Config = {
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
};

// API route tests: every one of them starts with the same three mocks (cookie, session, rate
// limit). They live in jest.route.setup.ts, so they are written once instead of in every file.
const ROUTE_TESTS = "app/api/**/route.test.ts";
const ROUTE_TESTS_PATTERN = "/app/api/.*/route\\.test\\.ts$";

// Two projects, so the route mocks reach only the route tests. `next/jest` builds each one, so
// both get the same compiler and .env loading. Run one file as usual: `pnpm test path/to/file`.
const config = async (): Promise<Config> => {
  const unit = await createJestConfig({
    ...shared,
    displayName: "unit",
    setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    testPathIgnorePatterns: [
      "/node_modules/",
      "/.next/",
      "/e2e/",
      ROUTE_TESTS_PATTERN,
    ],
  })();

  const routes = await createJestConfig({
    ...shared,
    displayName: "routes",
    setupFilesAfterEnv: [
      "<rootDir>/jest.setup.ts",
      "<rootDir>/jest.route.setup.ts",
    ],
    testMatch: [`<rootDir>/${ROUTE_TESTS}`],
    testPathIgnorePatterns: ["/node_modules/", "/.next/", "/e2e/"],
  })();

  return {
    // Coverage is a whole-run setting, not a per-project one.
    coverageProvider: "v8",
    projects: [unit, routes],
  };
};

export default config;
