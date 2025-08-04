import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import polyfillNode from 'rollup-plugin-polyfill-node';

export default defineConfig(({ command }) => {
  const config = {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 8080,
    }
  }

  if (command === 'build') {
    config.plugins.push(polyfillNode());
    config.resolve.alias.util = "util";
  }

  return config;
})
