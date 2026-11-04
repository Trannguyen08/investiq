import type { Metadata } from "next";
import { type ReactNode, Suspense } from "react";

import { ScrollRestoration } from "@/components/layout/scroll-restoration";
import "./globals.css";

export const metadata: Metadata = {
  title: "InvestIQ",
  description: "Investment research and portfolio workspace",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <Suspense fallback={null}>
          <ScrollRestoration />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
