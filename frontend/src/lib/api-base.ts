export function resolveApiBase(): string {
  const envUrl = process.env.API_INTERNAL_BASE_URL?.trim();
  if (!envUrl) return "http://localhost:8000/api";
  let url = envUrl;
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  url = url.replace(/\/+$/, "");
  if (!url.endsWith("/api")) {
    url = `${url}/api`;
  }
  return url;
}
