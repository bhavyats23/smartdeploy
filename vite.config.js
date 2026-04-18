import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: ".",
  build: {
    outDir: "dist",
  },
  server: {
    port: 3001,
    proxy: {
      "/auth": "http://localhost:3000",
      "/api": "http://localhost:3000",
    },
  },
});
