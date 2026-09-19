import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/main.ts"],
    format: ["esm"],
    target: "node20",
    clean: true,
    sourcemap: true,
    external: ["electron", "node-pty"],
  },
  {
    entry: ["src/preload.ts"],
    format: ["cjs"],
    target: "node20",
    outExtension: () => ({ js: ".cjs" }),
    clean: false,
    sourcemap: false,
    external: ["electron"],
  },
]);
