import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import polyfillNode from 'rollup-plugin-polyfill-node';

export default defineConfig({
  plugins: [
    react(),
    polyfillNode()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "util": "util"
    },
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
  }
})
