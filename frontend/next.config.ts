import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

function loadEnvironment() {
  try {
    const rootEnv = fileURLToPath(new URL("../.env", import.meta.url));
    process.loadEnvFile(rootEnv);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      try {
        process.loadEnvFile(".env");
      } catch (inner) {
        if ((inner as NodeJS.ErrnoException).code !== "ENOENT") throw inner;
      }
    }
  }
}

loadEnvironment();

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
