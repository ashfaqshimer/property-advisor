import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// `.mts` so Vite loads this as ESM — a `.ts` config gets loaded as CommonJS
// and warns about the ESM syntax below.
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirrors the `@/*` alias in tsconfig.json.
    alias: { "@": import.meta.dirname },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["public/images/**"],
  },
});
