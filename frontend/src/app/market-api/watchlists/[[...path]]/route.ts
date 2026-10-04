import { NextResponse } from "next/server";

import { UserAuthError, verifyCsrf } from "@/lib/server/user-auth";
import { marketWatchlistRequest } from "@/lib/server/market-watchlist-api";

type Context = { params: Promise<{ path?: string[] }> };

function errorResponse(error: unknown) {
  if (error instanceof UserAuthError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { error: { code: "WATCHLIST_UNAVAILABLE", message: "Watchlist tạm thời chưa sẵn sàng." } },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

async function proxy(request: Request, context: Context, method: string) {
  try {
    if (method !== "GET") await verifyCsrf(request);
    const path = (await context.params).path?.join("/") ?? "";
    const text = method === "GET" || method === "DELETE" ? undefined : await request.text();
    if (text && new TextEncoder().encode(text).length > 16_384) {
      return NextResponse.json({ error: { code: "REQUEST_TOO_LARGE", message: "Dữ liệu gửi lên quá lớn." } }, { status: 413 });
    }
    const response = await marketWatchlistRequest(path, {
      method,
      body: text || undefined,
      headers: request.headers.get("idempotency-key")
        ? { "Idempotency-Key": request.headers.get("idempotency-key") ?? "" }
        : undefined,
    });
    const body = response.status === 204 ? null : await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        ...(body ? { "Content-Type": response.headers.get("content-type") ?? "application/json" } : {}),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export function GET(request: Request, context: Context) { return proxy(request, context, "GET"); }
export function POST(request: Request, context: Context) { return proxy(request, context, "POST"); }
export function PATCH(request: Request, context: Context) { return proxy(request, context, "PATCH"); }
export function DELETE(request: Request, context: Context) { return proxy(request, context, "DELETE"); }

