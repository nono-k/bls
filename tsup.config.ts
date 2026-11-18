import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/scripts/index.ts", "src/scripts/browser.ts"],
  format: ["esm"],
  dts: false,
  clean: true,
  sourcemap: true,
  splitting: false,
  target: "es2022",
  outDir: "dist",
});
