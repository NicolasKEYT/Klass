import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { readFileSync } from "node:fs";

// Versão mostrada no Perfil: vem do package.json, nunca escrita à mão no código.
const { version } = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf8")) as {
  version: string;
};

export default defineConfig({
  plugins: [react()],
  define: {
    __VERSAO_KLASS__: JSON.stringify(version),
  },
  // O .env fica na raiz do monorepo (um só arquivo para web + workers,
  // ver .env.example) — sem isso o Vite só procura dentro de apps/web.
  envDir: path.resolve(__dirname, "../.."),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
});
