import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/wallet": "http://localhost:8080",
      "/payment": "http://localhost:8080",
    },
  },
});
