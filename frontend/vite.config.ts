import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const proxyTarget = process.env.VITE_PROXY_TARGET ?? "http://127.0.0.1:8001";
const proxyMissionKey = process.env.VITE_PROXY_MISSION_CONTROL_KEY ?? "";
const allowPublicPreview = process.env.VITE_ALLOW_PUBLIC_PREVIEW === "true";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    allowedHosts: allowPublicPreview ? true : [],
    proxy: {
      "/api": {
        target: proxyTarget,
        changeOrigin: true,
        headers: proxyMissionKey ? { "X-Mission-Control-Key": proxyMissionKey } : {},
      },
    },
  },
});
