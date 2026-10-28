import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

function loadDevelopmentEnvironment() {
  if (process.env.NODE_ENV !== "development") return;

  try {
    process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

loadDevelopmentEnvironment();

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
