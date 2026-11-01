import "server-only";

import { resolveApiBase } from "@/lib/api-base";
import { authenticatedSession } from "@/lib/server/user-auth";

const allowedPath = /^(?:chat|conversations|conversations\/[0-9a-f-]{36})$/;

export async function aiChatRequest(pathWithQuery: string, init?: RequestInit) {
  const [path, search] = pathWithQuery.split("?");
  if (path && !allowedPath.test(path)) {
    throw new Error("Invalid AI assistant API path");
  }

  let token: string | undefined;
  try {
    const session = await authenticatedSession();
    token = session.value.credentials.access_token;
  } catch {
    // Guest user (not logged in) - proceed without token
  }

  const base = resolveApiBase();
  const queryStr = search ? `?${search}` : "";
  return fetch(`${base}/v1/ai${path ? `/${path}` : ""}${queryStr}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
}

