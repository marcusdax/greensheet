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
    include: [
      "api/**/*.test.ts",
      "api/**/*.spec.ts",
      "contracts/**/*.test.ts",
      // src/ was missing, so src/design-tokens.test.ts — the §9 CI token check
      // — silently never ran. A test outside the include pattern is worse than
      // no test: it sits in the tree looking like coverage and enforces nothing.
      "src/**/*.test.ts",
    ],
  },
});
