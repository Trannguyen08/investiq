import type { ReactNode } from "react";

import { UserHeader } from "@/components/layout/user-header";

export default function UserLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <a className="skip-link" href="#main-content">Chuyển đến nội dung chính</a>
      <UserHeader />
      <div className="shell">{children}</div>
    </>
  );
}
