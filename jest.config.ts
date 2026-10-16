import type { Config } from "jest";
import nextJest from "next/jest.js";

// next/jest wires the Next.js (SWC) compiler as the transform and loads .env files.
const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
  // Server code (services, http core) is tested in Node. Component tests will opt into
  // jsdom per file with a `@jest-environment jsdom` docblock once React tests exist.
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/e2e/"],
};

export default createJestConfig(config);
