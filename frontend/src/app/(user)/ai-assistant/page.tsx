import type { Metadata } from "next";
import { AiAssistantWorkspace } from "@/components/ai-chat/ai-assistant-workspace";

export const metadata: Metadata = {
  title: "Trợ lý Cố vấn Tài chính AI InvestIQ | InvestIQ",
  description:
    "Trợ lý phân tích tài chính thông minh dựa trên định lượng dữ liệu thực tế 1.396 mã chứng khoán Việt Nam, báo cáo tài chính, mô hình cảnh báo rủi ro Altman Z-Score và kỹ thuật.",
};

export default function AiAssistantPage() {
  return (
    <main id="main-content" className="w-full min-h-[calc(100vh-4rem)] bg-[#06111f] text-slate-100 flex flex-col">
      <AiAssistantWorkspace />
    </main>
  );
}
