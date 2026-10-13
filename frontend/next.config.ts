import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

function loadDevelopmentEnvironment() {
  if (process.env.NODE_ENV !== "development") return;

  try {
    process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  if (!process.env.AUTH_SESSION_REDIS_URL && process.env.REDIS_PASSWORD) {
    const redisUrl = new URL("redis://127.0.0.1:6379/3");
    redisUrl.password = process.env.REDIS_PASSWORD;
    process.env.AUTH_SESSION_REDIS_URL = redisUrl.toString();
  }
}

loadDevelopmentEnvironment();

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
