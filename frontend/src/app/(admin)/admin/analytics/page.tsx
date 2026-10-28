import { getAdminAnalytics } from "@/lib/server/admin-ops-api";
import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";

export default async function AdminAnalyticsPage() {
  let result = null;
  let errorMsg = null;
  try {
    result = await getAdminAnalytics();
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === "NEXT_REDIRECT" ||
        ("digest" in err && String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")))
    ) {
      throw err;
    }
    errorMsg =
      err instanceof Error
        ? err.message
        : "Không thể tải báo cáo phân tích thống kê.";
  }

  if (errorMsg || !result) {
    return (
      <div>
        <div className="admin-view-header">
          <div>
            <h1>Báo cáo & Thống kê</h1>
            <p>
              Báo cáo phân tích chuyên sâu hiệu suất nhà đầu tư, thanh khoản sàn giao dịch và dòng tiền hệ thống.
            </p>
          </div>
        </div>
        <p className="admin-alert error" role="alert">
          {errorMsg ?? "Không thể tải báo cáo thống kê."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="admin-view-header">
        <div>
          <h1>Báo cáo & Thống kê</h1>
          <p>
            Báo cáo phân tích chuyên sâu hiệu suất nhà đầu tư, thanh khoản sàn giao dịch và dòng tiền hệ thống.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <span className="admin-badge admin" style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem" }}>
            Top: {result.top_traders.length} Trader Xuất Sắc
          </span>
          <span className="admin-badge active" style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem" }}>
            Vốn: {(result.total_capital_deployed_vnd / 1_000_000_000).toFixed(1)} Tỷ VND
          </span>
        </div>
      </div>

      <AnalyticsDashboard data={result} />
    </div>
  );
}
