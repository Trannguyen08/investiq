"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { changeTone, formatChange, formatPercent } from "@/components/market/formatters";
import { useAuth } from "@/hooks/use-auth";
import { useMarketStream } from "@/hooks/use-realtime-price";
import type { MarketInstrument, Watchlist } from "@/types/market";

async function csrfToken() {
  const response = await fetch("/auth-api/csrf", { cache: "no-store" });
  const body = await response.json() as { csrf_token?: string };
  if (!response.ok || !body.csrf_token) throw new Error("Không thể xác thực thao tác.");
  return body.csrf_token;
}

async function request<T>(path = "", init?: RequestInit): Promise<T> {
  const response = await fetch(`/market-api/watchlists${path ? `/${path}` : "/"}`, {
    ...init,
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? "Không thể cập nhật watchlist.");
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

async function write<T>(path: string, method: "POST" | "DELETE", body?: object) {
  const csrf = await csrfToken();
  return request<T>(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrf,
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function WatchlistPanel({ instruments }: { instruments: MarketInstrument[] }) {
  const auth = useAuth();
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeId, setActiveId] = useState("");
  const [name, setName] = useState("Danh sách của tôi");
  const [symbol, setSymbol] = useState(instruments[0]?.symbol ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const value = await request<{ data: Watchlist[] }>();
      setError("");
      setWatchlists(value.data);
      setActiveId((current) => current && value.data.some((item) => item.id === current) ? current : value.data[0]?.id ?? "");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không thể tải watchlist.");
    }
  }, []);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let cancelled = false;
    request<{ data: Watchlist[] }>().then((value) => {
      if (cancelled) return;
      setError("");
      setWatchlists(value.data);
      setActiveId((current) => current && value.data.some((item) => item.id === current) ? current : value.data[0]?.id ?? "");
    }).catch((value: unknown) => {
      if (!cancelled) setError(value instanceof Error ? value.message : "Không thể tải watchlist.");
    });
    return () => { cancelled = true; };
  }, [auth.status]);

  const active = useMemo(() => watchlists.find((item) => item.id === activeId), [watchlists, activeId]);
  const stream = useMarketStream(active?.items.map((item) => item.symbol) ?? []);
  const instrumentsBySymbol = useMemo(
    () => new Map(instruments.map((item) => [item.symbol, item])),
    [instruments],
  );
  const available = instruments.filter((item) => !active?.items.some((watched) => watched.symbol === item.symbol));

  if (auth.status === "loading") return <div className="market-empty">Đang kiểm tra phiên đăng nhập…</div>;
  if (auth.status !== "authenticated") return (
    <div className="market-auth-gate">
      <span aria-hidden="true">☆</span><h2>Watchlist riêng tư của bạn</h2>
      <p>Đăng nhập để tạo nhiều danh sách và theo dõi mã mà không công khai lựa chọn của bạn.</p>
      <Link className="market-primary-link" href="/login">Đăng nhập để tiếp tục</Link>
    </div>
  );

  async function create(event: FormEvent) {
    event.preventDefault(); setPending(true); setError("");
    try { const created = await write<Watchlist>("", "POST", { name }); await load(); setActiveId(created.id); setName(""); }
    catch (value) { setError(value instanceof Error ? value.message : "Không thể tạo watchlist."); }
    finally { setPending(false); }
  }

  async function add(event: FormEvent) {
    event.preventDefault(); if (!active || !symbol) return; setPending(true); setError("");
    try { await write(`${active.id}/items`, "POST", { symbol }); await load(); }
    catch (value) { setError(value instanceof Error ? value.message : "Không thể thêm mã."); }
    finally { setPending(false); }
  }

  async function remove(itemSymbol: string) {
    if (!active) return; setPending(true); setError("");
    try { await write(`${active.id}/items/${encodeURIComponent(itemSymbol)}`, "DELETE"); await load(); }
    catch (value) { setError(value instanceof Error ? value.message : "Không thể xóa mã."); }
    finally { setPending(false); }
  }

  async function removeList() {
    if (!active) return; setPending(true); setError("");
    try { await write(active.id, "DELETE"); await load(); }
    catch (value) { setError(value instanceof Error ? value.message : "Không thể xóa watchlist."); }
    finally { setPending(false); }
  }

  return (
    <div className="watchlist-workspace">
      <aside className="watchlist-sidebar">
        <div className="watchlist-sidebar-heading"><h2>Watchlist</h2><span>{watchlists.length}</span></div>
        <div className="watchlist-tabs">{watchlists.map((item) => <button className={item.id === activeId ? "active" : ""} type="button" key={item.id} onClick={() => setActiveId(item.id)}><span>{item.name}</span><small>{item.items.length} mã</small></button>)}</div>
        <form onSubmit={create}><label htmlFor="watchlist-name">Tạo danh sách mới</label><div><input id="watchlist-name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} required /><button type="submit" disabled={pending}>+</button></div></form>
      </aside>
      <section className="watchlist-content">
        {error && <p className="market-inline-error" role="alert">{error}</p>}
        {!active ? <div className="market-empty"><h2>Chưa có watchlist</h2><p>Tạo danh sách đầu tiên để bắt đầu theo dõi.</p></div> : <>
          <div className="watchlist-content-heading"><div><p className="eyebrow">DANH SÁCH RIÊNG TƯ</p><h2>{active.name}</h2></div><button className="watchlist-delete" type="button" onClick={removeList} disabled={pending}>Xóa danh sách</button></div>
          <form className="watchlist-add" onSubmit={add}><label htmlFor="watchlist-symbol">Thêm mã</label><select id="watchlist-symbol" value={symbol} onChange={(event) => setSymbol(event.target.value)} disabled={!available.length}>{available.map((item) => <option value={item.symbol} key={item.symbol}>{item.symbol} · {item.name}</option>)}</select><button type="submit" disabled={pending || !available.length}>Thêm vào watchlist</button></form>
          {active.items.length ? <div className="market-table-wrap"><table className="market-table"><thead><tr><th>Mã</th><th>Công ty</th><th>Giá</th><th>Thay đổi</th><th>Sàn</th><th>Ngành</th><th><span className="sr-only">Thao tác</span></th></tr></thead><tbody>{active.items.map((item) => { const snapshot = instrumentsBySymbol.get(item.symbol); const live = stream.items[item.symbol]; const price = typeof live?.price === "string" ? live.price : snapshot?.price; const changePercent = typeof live?.change_percent === "string" ? live.change_percent : snapshot?.change_percent; return <tr key={item.symbol}><td><strong>{item.symbol}</strong></td><td>{item.name}</td><td>{price ? formatChange(price) : "—"}</td><td className={changeTone(changePercent ?? "0")}>{changePercent ? formatPercent(changePercent) : "—"}</td><td>{item.exchange}</td><td>{item.sector ?? "—"}</td><td><button className="table-remove" type="button" onClick={() => remove(item.symbol)} disabled={pending} aria-label={`Xóa ${item.symbol} khỏi watchlist`}>×</button></td></tr>; })}</tbody></table></div> : <div className="market-empty compact"><p>Danh sách chưa có mã. Chọn một mã ở phía trên để thêm.</p></div>}
        </>}
      </section>
    </div>
  );
}

