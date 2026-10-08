"use client";

export default function MarketError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main-content" className="market-unavailable">
      <p className="eyebrow">TRUNG TÂM THỊ TRƯỜNG</p>
      <h1>Chưa thể tải dữ liệu thị trường</h1>
      <p>Nguồn dữ liệu có thể đang tắt hoặc tạm thời gián đoạn. Thử tải lại sau ít phút.</p>
      <button className="market-primary-link" type="button" onClick={reset}>Thử lại</button>
    </main>
  );
}

