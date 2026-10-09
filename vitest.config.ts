import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    // Test files share one database and truncate it, so they must not overlap.
    fileParallelism: false,
    setupFiles: ["./tests/setup.ts"],
    exclude: ["node_modules", ".next", "e2e"],
  },
});
