import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const normalizeModuleId = (id: string) => id.replace(/\\/g, "/");

const getManualChunkName = (id: string) => {
  const normalizedId = normalizeModuleId(id);

  if (!normalizedId.includes("/node_modules/")) {
    return undefined;
  }

  if (normalizedId.includes("/node_modules/three/")) {
    return "three";
  }

  if (normalizedId.includes("/node_modules/@react-three/fiber/")) {
    return "react-three";
  }

  return undefined;
};

export default defineConfig({
  plugins: [react()],
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
