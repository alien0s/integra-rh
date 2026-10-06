import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Carrega .env da raiz do monorepo
  envDir: path.resolve(__dirname, "../.."),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@shared/types": path.resolve(
        __dirname,
        "../../packages/shared-types/src"
      ),
      "@shared/ui": path.resolve(__dirname, "../../packages/shared-ui/src"),
      "@rh/core": path.resolve(__dirname, "../../packages/rh-core/src")
    }
  },
  server: {
    port: 5173,
    // Libera o Host "integra.aceam.org.br" pro dev server (e pro `vite
    // preview`) — sem isso, o Vite rejeita requisições que chegam com esse
    // Host (ex.: atrás de um reverse proxy) por segurança (DNS rebinding).
    allowedHosts: ["integra.aceam.org.br"],
    proxy: {
      // 3002, não 3000: a 3000 é a API de PRODUÇÃO (rodando via PM2 nesta
      // mesma VPS) — o dev não pode usar a mesma porta.
      "/api": {
        target: "http://localhost:3002",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "")
      }
    }
  }
});
