import { type ReactNode, Suspense } from "react";

import { UserHeader } from "@/components/layout/user-header";
import { AiChatDrawer } from "@/components/ai-chat/ai-chat-drawer";

export default function UserLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <a className="skip-link" href="#main-content">Chuyển đến nội dung chính</a>
      <Suspense fallback={<div className="h-16 bg-[#07111f] border-b border-slate-800/80" />}>
        <UserHeader />
      </Suspense>
      <div className="shell">{children}</div>
      <AiChatDrawer />
    </>
  );
}
