// §11.2 — the integration tier, against a real MySQL.
//
// A separate config, not a folder in the default run, for two reasons. The unit
// suite must stay hermetic and fast enough that nobody skips it; and these
// tests TRUNCATE tables, which is a catastrophe pointed at a developer's dev
// database and merely slow pointed at a throwaway schema. Requiring an explicit
// INTEGRATION_DATABASE_URL makes running them against the wrong database a
// deliberate act rather than an accident of `npm test`.
import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "src"),
      "@contracts": path.resolve(templateRoot, "contracts"),
      "@db": path.resolve(templateRoot, "db"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["api/integration/**/*.integration.test.ts"],
    setupFiles: ["api/integration/setup.ts"],
    // These share one database. Running files in parallel would have them
    // truncating each other's fixtures mid-assertion.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
