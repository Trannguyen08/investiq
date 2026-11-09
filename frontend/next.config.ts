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

const rawBackend =
  process.env.API_INTERNAL_BASE_URL ||
  process.env.INTERNAL_API_URL ||
  "http://127.0.0.1:8000";
const backendOrigin = rawBackend.replace(/\/+$/, "").replace(/\/api$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
