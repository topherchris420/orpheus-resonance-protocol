import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { PRODUCTION_CSP } from "./src/config/securityPolicy";

const normalizeModuleId = (id: string) => id.replace(/\\/g, "/");

const packageOf = (normalizedId: string) => {
  const rest = normalizedId.split("/node_modules/").pop() ?? "";
  const parts = rest.split("/");
  return parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
};

// The 3D layer's renderer and its private dependencies. React itself must not land here: when it
// did, the entry chunk imported this chunk (and three.js with it) on every page load.
const REACT_THREE_PACKAGES = new Set(["@react-three/fiber", "react-reconciler", "its-fine", "zustand", "suspend-react", "react-use-measure"]);
const REACT_PACKAGES = new Set(["react", "react-dom", "scheduler"]);

const getManualChunkName = (id: string) => {
  const normalizedId = normalizeModuleId(id);

  if (!normalizedId.includes("/node_modules/")) {
    return undefined;
  }

  const name = packageOf(normalizedId);
  if (name === "three") {
    return "three";
  }
  if (REACT_THREE_PACKAGES.has(name)) {
    return "react-three";
  }
  if (REACT_PACKAGES.has(name)) {
    return "react";
  }
  if (name === "zod") {
    return "zod";
  }

  return undefined;
};

/**
 * Production builds replace the development Content-Security-Policy (which must let Vite's dev server
 * open a WebSocket) with the strict policy from src/config/securityPolicy.ts.
 */
const productionContentSecurityPolicy = (): Plugin => ({
  name: "orpheus-production-csp",
  apply: "build",
  transformIndexHtml(html) {
    const meta = /<meta http-equiv="Content-Security-Policy" content="[^"]*" \/>/;
    if (!meta.test(html)) throw new Error("index.html must declare a Content-Security-Policy meta tag.");
    return html.replace(meta, `<meta http-equiv="Content-Security-Policy" content="${PRODUCTION_CSP}" />`);
  },
});

export default defineConfig({
  plugins: [react(), productionContentSecurityPolicy()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks: getManualChunkName,
      },
    },
  },
});
