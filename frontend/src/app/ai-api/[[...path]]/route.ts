import { NextResponse } from "next/server";

import { aiChatRequest } from "@/lib/server/ai-chat-server-api";
import { UserAuthError } from "@/lib/server/user-auth";

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
        code: "AI_SERVICE_UNAVAILABLE",
        message: "Trợ lý AI tạm thời chưa sẵn sàng. Vui lòng thử lại sau.",
      },
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

async function proxy(request: Request, context: Context, method: "GET" | "POST" | "DELETE") {
  try {
    const path = (await context.params).path?.join("/") ?? "";
    const url = new URL(request.url);
    const search = url.search;
    const text = method === "POST" ? await request.text() : undefined;
    if (text && new TextEncoder().encode(text).length > 32_768) {
      return NextResponse.json(
        { error: { code: "REQUEST_TOO_LARGE", message: "Nội dung gửi lên quá lớn." } },
        { status: 413 },
      );
    }
    const response = await aiChatRequest(path + search, {
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

export function DELETE(request: Request, context: Context) {
  return proxy(request, context, "DELETE");
}

