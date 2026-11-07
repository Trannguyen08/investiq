import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, vi } from "vitest";
import { fileURLToPath } from "node:url";

import React from "react";

try {
  const rootEnv = fileURLToPath(new URL("../../../.env", import.meta.url));
  process.loadEnvFile(rootEnv);
} catch {
  // Ignore if .env is missing or already loaded in the environment
}

vi.mock("next/link", () => ({
  default: ({
    children,
    prefetch: _prefetch,
    replace: _replace,
    scroll: _scroll,
    shallow: _shallow,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    prefetch?: boolean;
    replace?: boolean;
    scroll?: boolean;
    shallow?: boolean;
  }) =>
    React.createElement("a", { "data-next-link": "true", ...props }, children),
}));

afterEach(() => {
  cleanup();
});
