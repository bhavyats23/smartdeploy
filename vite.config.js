import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],

  server: {
    port: 3000,
    // Proxy only runs in dev (vite dev server).
    // In production the React build is served by Express on the same origin,
    // so relative URLs like /auth/github resolve correctly without any proxy.
    ...(command === "serve" && {
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
          secure: false,
          credentials: true,
        },
        "/auth": {
          target: "http://localhost:3000",
          changeOrigin: true,
          secure: false,
          credentials: true,
        },
      },
    }),
  },

  build: {
    outDir: "dist",
  },
}));
