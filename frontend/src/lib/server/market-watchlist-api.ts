import "server-only";

import { authenticatedSession } from "@/lib/server/user-auth";

const allowedPath = /^(?:|[0-9a-f-]{36}|[0-9a-f-]{36}\/items|[0-9a-f-]{36}\/items\/[A-Za-z0-9._-]{1,24})$/;

export async function marketWatchlistRequest(path: string, init?: RequestInit) {
  if (!allowedPath.test(path)) throw new Error("Invalid watchlist API path");
  const session = await authenticatedSession();
  const base = process.env.API_INTERNAL_BASE_URL ?? "http://localhost:8000/api";
  return fetch(`${base}/v1/watchlists${path ? `/${path}` : ""}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-BFF-Secret": process.env.AUTH_BFF_SECRET ?? "",
      Authorization: `Bearer ${session.value.credentials.access_token}`,
      ...(init?.headers ?? {}),
    },
  });
}

