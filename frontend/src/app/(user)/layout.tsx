import Link from "next/link";
import type { ReactNode } from "react";

const links = [
  ["/", "Overview"],
  ["/portfolio", "Portfolio"],
  ["/predictions", "Predictions"],
  ["/backtesting", "Backtesting"],
  ["/alerts", "Alerts"],
  ["/watchlist", "Watchlist"],
] as const;

export default function UserLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="shell">
      <strong>InvestIQ</strong>
      <nav className="navigation" aria-label="User navigation">
        {links.map(([href, label]) => (
          <Link href={href} key={href}>{label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
