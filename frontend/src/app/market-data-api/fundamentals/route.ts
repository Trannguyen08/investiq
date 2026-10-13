import { NextResponse } from "next/server";

const SYMBOL_PATTERN = /^[A-Z0-9._-]{1,24}$/;
const MAX_SYMBOLS = 15;
const MAX_CONCURRENCY = 3;

type InstrumentEnvelope = {
  data?: {
    symbol?: string;
    pe?: string | null;
    pb?: string | null;
  };
};

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("symbols") ?? "";
  const symbols = [...new Set(requested.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean))];
  if (!symbols.length || symbols.length > MAX_SYMBOLS || symbols.some((symbol) => !SYMBOL_PATTERN.test(symbol))) {
    return NextResponse.json(
      { error: { code: "INVALID_SYMBOLS", message: `Yêu cầu từ 1 đến ${MAX_SYMBOLS} mã cổ phiếu hợp lệ.` } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const base = process.env.API_INTERNAL_BASE_URL ?? "http://localhost:8000/api";
  const results = new Array<{ symbol: string; pe: string | null; pb: string | null }>(symbols.length);
  const deadline = AbortSignal.timeout(30_000);
  let cursor = 0;

  async function worker() {
    while (cursor < symbols.length) {
      const index = cursor;
      cursor += 1;
      const symbol = symbols[index];
      try {
        const response = await fetch(`${base}/v1/market/instruments/${encodeURIComponent(symbol)}`, {
          cache: "no-store",
          signal: deadline,
        });
        const body = await response.json().catch(() => null) as InstrumentEnvelope | null;
        results[index] = response.ok && body?.data
          ? { symbol, pe: body.data.pe ?? null, pb: body.data.pb ?? null }
          : { symbol, pe: null, pb: null };
      } catch {
        results[index] = { symbol, pe: null, pb: null };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, symbols.length) }, () => worker()));
  const complete = results.every((item) => item.pe !== null && item.pb !== null);
  return NextResponse.json(
    { data: results },
    {
      headers: {
        "Cache-Control": complete
          ? "public, max-age=60, s-maxage=3600, stale-while-revalidate=300"
          : "no-store",
      },
    },
  );
}
