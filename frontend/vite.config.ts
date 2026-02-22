import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    // Safer dev default: bind to localhost. Set VITE_DEV_HOST="::" if you explicitly need LAN/IPv6 binding.
    host: process.env.VITE_DEV_HOST ?? "127.0.0.1",
    port: 8080,

    // If you need ngrok or a custom hostname, set VITE_ALLOWED_HOSTS="all" explicitly.
    allowedHosts: process.env.VITE_ALLOWED_HOSTS?.trim() === "all" ? "all" : ["localhost", "127.0.0.1"],

    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: "http://localhost:1111",
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

