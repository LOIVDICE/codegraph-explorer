// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    server: {
      proxy: {
        // The V3RTEX backend (127.0.0.1:7331) sends no CORS headers, so the
        // browser blocks direct cross-origin calls. Proxy them same-origin.
        "/v3rtex-api": {
          target: "http://127.0.0.1:7331",
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/v3rtex-api/, ""),
        },
      },
    },
  },
});
