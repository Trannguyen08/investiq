import "server-only";

import { resolveApiBase } from "@/lib/api-base";
import { authenticatedSession } from "@/lib/server/user-auth";

const allowedPath = /^(?:|orders|orders\/[a-f0-9-]{1,64})$/;

export async function paperTradingRequest(path: string, init?: RequestInit) {
  if (!allowedPath.test(path)) throw new Error("Invalid paper-trading API path");
  const session = await authenticatedSession();
  const base = resolveApiBase();
  return fetch(`${base}/v1/paper-portfolio${path ? `/${path}` : ""}`, {
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
