import "server-only";

import { resolveApiBase } from "@/lib/api-base";
import { authenticatedSession } from "@/lib/server/user-auth";

const allowedPath = /^(?:|orders|orders\/[a-f0-9-]{1,64}|visibility|leaderboard|public\/[0-9a-f-]{36})$/;

export async function paperTradingRequest(pathWithQuery: string, init?: RequestInit) {
  const [path, search] = pathWithQuery.split("?");
  if (!allowedPath.test(path)) throw new Error("Invalid paper-trading API path");
  const isPublic = path === "leaderboard" || path.startsWith("public/");
  let token: string | undefined;

  try {
    const session = await authenticatedSession();
    token = session.value.credentials.access_token;
  } catch (error) {
    if (!isPublic) throw error;
  }

  const base = resolveApiBase();
  const queryStr = search ? `?${search}` : "";
  return fetch(`${base}/v1/paper-portfolio${path ? `/${path}` : ""}${queryStr}`, {
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
