import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  logLevel: "error",
  clearScreen: false,
  build: {
    reportCompressedSize: false,
  },
});
