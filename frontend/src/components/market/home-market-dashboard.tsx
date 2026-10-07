"use client";

import Link from "next/link";

import { InfoTip, MarketColorLegend, MarketLineChart, SentimentGauge } from "@/components/market/beginner-market-ui";
import { changeTone, formatMoney, formatPercent } from "@/components/market/formatters";
import { mergeLiveIndex, mergeLiveInstrument } from "@/components/market/live-market";
import { MarketStatus } from "@/components/market/market-status";
import { MarketStreamProvider, useMarketStreamState } from "@/hooks/use-realtime-price";
import type { NewsSummary } from "@/lib/api-client";
import type { MarketIndex, MarketOverview } from "@/types/market";

const lessons = [
  "Cổ phiếu là gì?",
  "Sàn giao dịch hoạt động ra sao?",
  "Đọc bảng giá",
  "Rủi ro & quản lý vốn",
  "Tập giao dịch giả lập",
];

function marketConclusion(index: MarketIndex | undefined, advances: number, declines: number) {
  const total = advances + declines;
  const declineRate = total ? declines / total : 0.5;
  if ((index && Number(index.change_percent) < -0.5) || declineRate >= 0.6) {
    return { emoji: "😟", title: "Thị trường đang thận trọng", detail: `${Math.round(declineRate * 100)}% số mã có biến động đang giảm.` };
  }
  if ((index && Number(index.change_percent) > 0.5) || declineRate <= 0.4) {
    return { emoji: "😀", title: "Thị trường đang nghiêng về tích cực", detail: `${Math.round((1 - declineRate) * 100)}% số mã có biến động đang tăng.` };
  }
  return { emoji: "😐", title: "Thị trường đang giằng co", detail: "Số mã tăng và giảm chưa tạo ra chênh lệch rõ ràng." };
}

function liquidityComparison(index: MarketIndex | undefined) {
  const volumes = (index?.candles ?? []).map((item) => Number(item.volume)).filter((item) => item > 0);
  if (volumes.length < 3) return null;
  const current = volumes.at(-1)!;
  const history = volumes.slice(Math.max(0, volumes.length - 21), -1);
  const average = history.reduce((sum, value) => sum + value, 0) / history.length;
  return average ? ((current / average) - 1) * 100 : null;
}

function plainNewsImpact(item: NewsSummary) {
  if (item.sentiment.market_impact) return item.sentiment.market_impact;
  if (item.mentioned_symbols.length) return `Tin có nhắc tới ${item.mentioned_symbols.slice(0, 3).join(", ")}; cần đọc nguồn gốc trước khi đánh giá tác động.`;
  return "Chưa có đủ dữ liệu để xác nhận nhóm cổ phiếu chịu tác động trực tiếp.";
}

export function HomeMarketDashboard({ overview, news }: { overview: MarketOverview; news: NewsSummary[] }) {
  const symbols = [
    ...overview.data.indices.map((item) => item.symbol),
    ...overview.data.trending.slice(0, 6).map((item) => item.symbol),
  ];
  return <MarketStreamProvider symbols={symbols}><HomeMarketContent overview={overview} news={news} /></MarketStreamProvider>;
}

function HomeMarketContent({ overview, news }: { overview: MarketOverview; news: NewsSummary[] }) {
  const stream = useMarketStreamState();
  const indices = overview.data.indices.map((item) => mergeLiveIndex(item, stream.items[item.symbol]));
  const instruments = overview.data.trending.map((item) => mergeLiveInstrument(item, stream.items[item.symbol]));
  const primary = indices.find((item) => item.symbol === "VNINDEX") ?? indices[0];
  const breadthIndices = indices.filter((item) => ["VNINDEX", "HNXINDEX", "UPCOMINDEX"].includes(item.symbol));
  const breadth = breadthIndices.reduce((value, item) => ({
    advances: value.advances + item.advances,
    declines: value.declines + item.declines,
    unchanged: value.unchanged + item.unchanged,
  }), { advances: 0, declines: 0, unchanged: 0 });
  const breadthTotal = breadth.advances + breadth.declines + breadth.unchanged || 1;
  const conclusion = marketConclusion(primary, breadth.advances, breadth.declines);
  const sentiment = 50 + (breadth.advances - breadth.declines) / breadthTotal * 38 + Number(primary?.change_percent ?? 0) * 3;
  const liquidity = liquidityComparison(primary);
  const foreignNet = instruments.reduce((sum, item) => sum + Number(item.foreign_net_value), 0);

  return (
    <main id="main-content" className="market-home beginner-home">
      <MarketColorLegend />
      <section className="beginner-hero" aria-labelledby="today-market-title">
        <div className="beginner-hero-copy">
          <p className="eyebrow">HÔM NAY THỊ TRƯỜNG THẾ NÀO?</p>
          <h1 id="today-market-title"><span aria-hidden="true">{conclusion.emoji}</span> {conclusion.title}</h1>
          <p>{conclusion.detail} Số liệu được trình bày để bạn hiểu nhanh trước khi đi sâu.</p>
          {primary && <div className="hero-index-value"><span>VN-Index</span><strong>{Number(primary.value).toLocaleString("vi-VN")}</strong><em className={changeTone(primary.change_percent)}>{formatPercent(primary.change_percent)}</em></div>}
          <SentimentGauge score={sentiment} />
        </div>
        <div className="beginner-hero-chart">
          <div className="beginner-card-title"><span>Đường giá VN-Index</span><InfoTip term="VN-Index">Chỉ số đại diện biến động của cổ phiếu niêm yết trên HOSE. Chỉ số tăng không có nghĩa mọi cổ phiếu đều tăng.</InfoTip></div>
          <MarketLineChart candles={primary?.candles ?? []} label="Đường giá VN-Index" />
          <Link href="/market/stocks">Xem toàn cảnh thị trường →</Link>
        </div>
      </section>
      <MarketStatus meta={overview.meta} />

      <section className="beginner-section" aria-labelledby="one-minute-title">
        <div className="beginner-heading"><div><p className="eyebrow">THỊ TRƯỜNG TRONG 1 PHÚT</p><h2 id="one-minute-title">Ba điều nên biết trước tiên</h2></div></div>
        <div className="one-minute-grid">
          <article><div className="beginner-card-title"><h3>Tăng hay giảm?</h3><InfoTip term="Độ rộng thị trường">So sánh số cổ phiếu tăng, giảm và đứng giá. Nó cho biết mức tăng có lan tỏa hay chỉ do vài mã lớn kéo chỉ số.</InfoTip></div><strong>{breadth.advances > breadth.declines ? "Sắc xanh đang chiếm ưu thế" : breadth.advances < breadth.declines ? "Sắc đỏ đang chiếm ưu thế" : "Thị trường khá cân bằng"}</strong><div className="beginner-breadth"><span className="advance" style={{ width: `${breadth.advances / breadthTotal * 100}%` }} /><span className="unchanged" style={{ width: `${breadth.unchanged / breadthTotal * 100}%` }} /><span className="decline" style={{ width: `${breadth.declines / breadthTotal * 100}%` }} /></div><p><b className="positive">{breadth.advances} tăng</b> · {breadth.unchanged} đứng giá · <b className="negative">{breadth.declines} giảm</b></p></article>
          <article><div className="beginner-card-title"><h3>Tiền vào hay ra?</h3><InfoTip term="Thanh khoản">Lượng cổ phiếu và tiền được giao dịch. Thanh khoản cao cho thấy mua bán sôi động, không tự động đồng nghĩa giá sẽ tăng.</InfoTip></div><strong>{liquidity === null ? "Chưa đủ 20 phiên để so sánh" : `${liquidity >= 0 ? "Cao hơn" : "Thấp hơn"} bình thường ${Math.abs(liquidity).toFixed(0)}%`}</strong><p>So với trung bình tối đa 20 điểm dữ liệu gần nhất của VN-Index.</p></article>
          <article><div className="beginner-card-title"><h3>Khối ngoại</h3><InfoTip term="Khối ngoại">Nhà đầu tư nước ngoài mua và bán cổ phiếu. Mua ròng nghĩa là giá trị mua lớn hơn giá trị bán.</InfoTip></div><strong className={changeTone(String(foreignNet))}>{foreignNet >= 0 ? "Mua ròng" : "Bán ròng"} {formatMoney(String(Math.abs(foreignNet)))}</strong><p>Phạm vi các mã nổi bật đang tải; đây là ước tính nếu nguồn không có giá trị ròng chính thức.</p></article>
        </div>
      </section>

      <section className="beginner-learning" aria-labelledby="learning-title">
        <div><p className="eyebrow">LỘ TRÌNH CHO NGƯỜI MỚI</p><h2 id="learning-title">Đi từng bước, không cần học mọi thứ cùng lúc</h2><p>Hoàn thành năm bài nền tảng trước khi thử ra quyết định với tiền thật.</p><div className="learning-progress"><span style={{ width: "20%" }} /></div></div>
        <ol>{lessons.map((lesson, index) => <li className={index === 0 ? "active" : ""} key={lesson}><span>{index + 1}</span>{lesson}</li>)}</ol>
        <a className="market-primary-link" href="#term-title">Bắt đầu bài đầu tiên</a>
      </section>

      <div className="beginner-two-columns">
        <section className="beginner-glossary" aria-labelledby="term-title"><p className="eyebrow">THUẬT NGỮ HÔM NAY</p><h2 id="term-title">Giá tham chiếu là gì?</h2><p>Là mốc để tính cổ phiếu đang tăng hay giảm trong ngày. Trên bảng giá Việt Nam, giá bằng tham chiếu thường có màu vàng.</p><span className="term-example">Ví dụ: tham chiếu 50.000đ, giá 51.000đ nghĩa là tăng 2%.</span></section>
        <section className="beginner-community" aria-labelledby="community-title"><p className="eyebrow">CỘNG ĐỒNG HỌC CÙNG NHAU</p><h2 id="community-title">Hỏi điều bạn chưa rõ</h2><p>Khu thảo luận đang được hoàn thiện. Mỗi bài phân tích sẽ phải nêu rõ rủi ro và người viết có đang giữ mã hay không.</p><div><span>🌱 Dễ hiểu</span><span>🙋 Câu hỏi chưa có trả lời</span><span>🛡️ Bắt buộc nêu rủi ro</span></div></section>
      </div>

      <section className="beginner-news" aria-labelledby="news-title">
        <div className="beginner-heading"><div><p className="eyebrow">TIN TỨC DỊCH RA TIẾNG NGƯỜI</p><h2 id="news-title">Hiểu tin trước khi nhìn giá</h2></div><Link href="/news">Xem tất cả tin →</Link></div>
        {news.length ? <div className="plain-news-grid">{news.map((item) => <article key={item.id}><span>{item.source.name}</span><h3><Link href={`/news/${item.id}`}>{item.title}</Link></h3><dl><div><dt>Chuyện gì xảy ra?</dt><dd>{item.description ?? "Mở bài viết để xem thông tin gốc."}</dd></div><div><dt>Ảnh hưởng gì?</dt><dd>{plainNewsImpact(item)}</dd></div><div><dt>Người mới nên hiểu gì?</dt><dd>Một tin riêng lẻ chưa đủ để mua hoặc bán. Hãy kiểm tra nguồn, thời điểm và rủi ro trước.</dd></div></dl></article>)}</div> : <div className="market-empty"><h3>Chưa có tin mới để diễn giải</h3><p>InvestIQ không tạo nội dung giả khi nguồn tin chưa sẵn sàng.</p></div>}
      </section>

      <footer className="beginner-disclaimer"><strong>Thông tin tham khảo, không phải khuyến nghị đầu tư.</strong><span>Nguồn: {overview.meta.provider_name} · trạng thái độ trễ: {overview.meta.delay_class} · cập nhật theo thời gian ghi trên dữ liệu.</span></footer>
    </main>
  );
}
