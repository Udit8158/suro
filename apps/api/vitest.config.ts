import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    setupFiles: ["./test/minimal_test.test.ts"],
    include: ["./test/**/*.test.ts"],
  },
});
