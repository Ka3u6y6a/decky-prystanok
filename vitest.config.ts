import path from "path";
import { defineConfig } from "vitest/config";

const r = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  resolve: {
    alias: {
      "@decky/api": r("tests/mocks/decky-api.ts"),
      "@decky/ui": r("tests/mocks/decky-ui.ts"),
      "react/jsx-runtime": r("tests/mocks/jsx-runtime.ts"),
      "react/jsx-dev-runtime": r("tests/mocks/jsx-runtime.ts"),
      react: r("tests/mocks/react.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
