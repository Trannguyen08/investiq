import { AdminOverviewDashboard } from "@/components/admin/admin-overview-dashboard";
import { getAdminOverview } from "@/lib/server/admin-ops-api";

export default async function AdminPage() {
  let data = null;
  let errorMsg = null;
  try {
    data = await getAdminOverview();
  } catch (err) {
    errorMsg =
      err instanceof Error
        ? err.message
        : "Không thể tải số liệu tổng quan hệ thống.";
  }

  if (errorMsg || !data) {
    return (
      <div style={{ padding: "1rem 0" }}>
        <p className="admin-alert error" role="alert">
          {errorMsg ?? "Không thể tải số liệu tổng quan."}
        </p>
      </div>
    );
  }

  return <AdminOverviewDashboard data={data} />;
}
