import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const normalizeBasePath = (value: string | undefined) => {
  const path = value?.trim();
  if (!path || path === "/") {
    return "/";
  }
  return `/${path.replace(/^\/+|\/+$/g, "")}/`;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiPort = Number(env.SQLSV_API_PORT ?? 3001);
  const webPort = Number(env.SQLSV_WEB_PORT ?? 5173);
  const basePath = normalizeBasePath(env.SQLSV_PUBLIC_BASE_PATH);

  return {
    base: basePath,
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: webPort,
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true
        }
      }
    },
    build: {
      outDir: "dist/client",
      emptyOutDir: true
    }
  };
});
