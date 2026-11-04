import "server-only";

import { resolveApiBase } from "@/lib/api-base";
import { authenticatedSession } from "@/lib/server/user-auth";

export async function assessmentServerRequest(pathWithQuery: string, init?: RequestInit) {
  const [path, search] = pathWithQuery.split("?");
  let token: string | undefined;

  try {
    const session = await authenticatedSession();
    token = session?.value?.credentials?.access_token;
  } catch {
    // Guest submission is completely supported
  }

  const base = resolveApiBase();
  const queryStr = search ? `?${search}` : "";
  const normalizedPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  const targetUrl = `${base}/v1/assessment${normalizedPath}${queryStr}`;

  return fetch(targetUrl, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-BFF-Secret": process.env.AUTH_BFF_SECRET ?? "",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
}
