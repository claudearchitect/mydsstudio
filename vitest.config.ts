import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    // Never discover tests inside nested agent worktrees — they are separate
    // repo checkouts and would run against the wrong source tree.
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", ".claude/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@fixtures": path.resolve(__dirname, "./fixtures"),
    },
  },
});
