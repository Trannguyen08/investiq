import { NextResponse } from "next/server";
import { assessmentServerRequest } from "@/lib/server/assessment-server-api";

type Context = { params: Promise<{ path?: string[] }> };

async function proxy(request: Request, context: Context, method: "GET" | "POST") {
  try {
    const path = (await context.params).path?.join("/") ?? "";
    const url = new URL(request.url);
    const search = url.search;
    const text = method === "POST" ? await request.text() : undefined;
    if (text && new TextEncoder().encode(text).length > 65_536) {
      return NextResponse.json(
        { error: { code: "REQUEST_TOO_LARGE", message: "Dữ liệu gửi lên quá lớn." } },
        { status: 413 },
      );
    }
    const response = await assessmentServerRequest(path + search, {
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
    return NextResponse.json(
      {
        error: {
          code: "ASSESSMENT_UNAVAILABLE",
          message: error instanceof Error ? error.message : "Dịch vụ khảo sát tạm thời chưa sẵn sàng.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export function GET(request: Request, context: Context) {
  return proxy(request, context, "GET");
}

export function POST(request: Request, context: Context) {
  return proxy(request, context, "POST");
}
