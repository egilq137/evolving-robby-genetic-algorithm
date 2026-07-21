import { resolve } from "node:path";
import { defineConfig } from "vite";

// Multi-page static build. Both HTML entry points are bundled to `dist/` so the
// site can be hosted as plain static files (e.g. on Vercel — framework preset
// "Vite", output directory "dist"). `/` serves the session-trace page and
// `/evolve.html` serves the live-evolution page.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        evolve: resolve(__dirname, "evolve.html"),
      },
    },
  },
});
