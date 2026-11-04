import { NextResponse } from "next/server";

import { getMarketInstruments } from "@/lib/api-client";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const searchParams = new URLSearchParams(url.searchParams);
    const instruments = await getMarketInstruments(searchParams, 30);
    return NextResponse.json(instruments, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch market instruments", data: [] },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
