import { NextResponse } from "next/server";

import { communityThesesRequest } from "@/lib/server/community-theses-api";
import { UserAuthError, verifyCsrf } from "@/lib/server/user-auth";

type Context = { params: Promise<{ path?: string[] }> };

function unavailable(error: unknown) {
  if (error instanceof UserAuthError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    {
      error: {
        code: "COMMUNITY_THESES_UNAVAILABLE",
        message: "Hệ thống luận điểm đầu tư tạm thời chưa sẵn sàng.",
      },
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

async function proxy(request: Request, context: Context, method: "GET" | "POST") {
  try {
    if (method !== "GET") await verifyCsrf(request);
    const path = (await context.params).path?.join("/") ?? "";
    const url = new URL(request.url);
    const search = url.search;
    const text = method === "POST" ? await request.text() : undefined;
    if (text && new TextEncoder().encode(text).length > 32_768) {
      return NextResponse.json(
        { error: { code: "REQUEST_TOO_LARGE", message: "Dữ liệu gửi lên quá lớn." } },
        { status: 413 },
      );
    }
    const response = await communityThesesRequest(path + search, {
      method,
      body: text || undefined,
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Type": response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    return unavailable(error);
  }
}

export function GET(request: Request, context: Context) {
  return proxy(request, context, "GET");
}

export function POST(request: Request, context: Context) {
  return proxy(request, context, "POST");
}
