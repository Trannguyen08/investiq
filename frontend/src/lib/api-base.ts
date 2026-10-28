export function resolveApiBase(): string {
  const envUrl = process.env.API_INTERNAL_BASE_URL?.trim();
  let url = envUrl || "http://127.0.0.1:8000/api";
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  url = url.replace(/\/+$/, "");
  if (!url.endsWith("/api")) {
    url = `${url}/api`;
  }
  // Windows Node.js DNS optimization: rewrite localhost:8000 to 127.0.0.1:8000 to eliminate IPv6 probe delay
  return url.replace("://localhost:8000", "://127.0.0.1:8000");
}
