import Link from "next/link";
import type { ReactNode } from "react";

const links = [
  ["/admin", "Overview"],
  ["/admin/users", "Users"],
  ["/admin/data-pipeline", "Data pipeline"],
  ["/admin/ml-models", "ML models"],
  ["/admin/content", "Content"],
  ["/admin/logs", "Logs"],
] as const;

export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="shell">
      <strong>InvestIQ administration</strong>
      <nav className="navigation" aria-label="Admin navigation">
        {links.map(([href, label]) => (
          <Link href={href} key={href}>{label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
