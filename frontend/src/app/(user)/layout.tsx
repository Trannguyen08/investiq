import type { ReactNode } from "react";

import { UserHeader } from "@/components/layout/user-header";
import { AiChatDrawer } from "@/components/ai-chat/ai-chat-drawer";
import { AiGlobalActionModals } from "@/components/ai-chat/ai-global-action-modals";

export default function UserLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <a className="skip-link" href="#main-content">Chuyển đến nội dung chính</a>
      <UserHeader />
      <div className="shell">{children}</div>
      <AiChatDrawer />
      <AiGlobalActionModals />
    </>
  );
}
