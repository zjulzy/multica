import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { patchViteClientForFrozenGuest } from "./src/main/experimental-vite-guest";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    // `@electron-toolkit/preload` must be bundled INTO the preload script:
    // the renderer windows run with `sandbox: true`, and a sandboxed preload's
    // `require` can only load `electron` plus a couple of node builtins — an
    // externalized `require("@electron-toolkit/preload")` would throw and
    // every contextBridge API would vanish. electron-vite emits preload as a
    // single CJS bundle, which is exactly what the sandbox requires.
    plugins: [externalizeDepsPlugin({ exclude: ["@electron-toolkit/preload"] })],
  },
  renderer: {
    server: {
      // Allow parallel worktrees to run `pnpm dev:desktop` side-by-side
      // (e.g. Multica Canary alongside a primary checkout) by overriding
      // the renderer port via env. Falls back to 5173 for the common case.
      port: Number(process.env.DESKTOP_RENDERER_PORT) || 5173,
      strictPort: true,
      // A frozen experimental guest loses its Vite websocket. Forwarding an
      // unhandled disconnect error through that same socket can recursively
      // generate more errors. Electron already captures renderer console logs.
      ...(process.env.MULTICA_NATIVE_ISSUE_CACHE_EXPERIMENT === "1"
        ? { forwardConsole: false }
        : {}),
    },
    plugins: [
      ...(process.env.MULTICA_NATIVE_ISSUE_CACHE_EXPERIMENT === "1" ? [{
        name: "experimental-frozen-guest-vite-reconnect",
        enforce: "post" as const,
        transform(code: string, id: string) {
          if (id.replaceAll("\\", "/").includes("/vite/dist/client/client.mjs")) {
            return patchViteClientForFrozenGuest(code);
          }
          return null;
        },
      }] : []),
      react(), tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": resolve("src/renderer/src"),
      },
      dedupe: ["react", "react-dom", "@tanstack/react-query"],
    },
  },
});
