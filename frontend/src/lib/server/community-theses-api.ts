import "server-only";

import { resolveApiBase } from "@/lib/api-base";
import { authenticatedSession, UserAuthError } from "@/lib/server/user-auth";

const allowedPath = /^(?:|leaderboard|my|[0-9a-f-]{36}|[0-9a-f-]{36}\/upvote)$/;

export async function communityThesesRequest(pathWithQuery: string, init?: RequestInit) {
  const [path, search] = pathWithQuery.split("?");
  if (!allowedPath.test(path)) throw new Error("Invalid community theses API path");

  const requiresAuth = init?.method === "POST" || path === "my" || path.endsWith("/upvote");
  let token: string | undefined;

  try {
    const session = await authenticatedSession();
    token = session.value.credentials.access_token;
  } catch (error) {
    if (requiresAuth) {
      if (error instanceof UserAuthError) throw error;
      throw new UserAuthError(401, "INVALID_SESSION", "Bạn cần đăng nhập để thực hiện thao tác này.");
    }
  }

  const base = resolveApiBase();
  const queryStr = search ? `?${search}` : "";
  return fetch(`${base}/v1/theses${path ? `/${path}` : ""}${queryStr}`, {
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
