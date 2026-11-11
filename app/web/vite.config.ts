import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Entwicklung: /api an Fastify (Standard http://localhost:3000). Origin wird auf das Ziel gesetzt, damit die
// Origin-/CSRF-Pruefung von Planora und Better Auth wie im Betrieb (gleiche Herkunft) greift.
const ziel = process.env.PLANORA_API ?? "http://localhost:3000";
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": { target: ziel, configure: (proxy) => proxy.on("proxyReq", (anfrage) => anfrage.setHeader("origin", ziel)) } },
  },
  build: { outDir: "dist", assetsDir: "assets", sourcemap: false },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
