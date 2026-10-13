import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

describe("learning page accessibility CSS contract", () => {
  it("keeps the 390px layout bounded and its controls touch friendly", () => {
    expect(styles).toMatch(/@media \(max-width: 640px\)/);
    expect(styles).toMatch(/\.learn-page \{[^}]*min-width: 0/);
    expect(styles).toMatch(/\.learn-time-choice button \{[^}]*min-height: 44px/);
    expect(styles).toMatch(/body:has\(\.learn-page\) \.header-search \{ display: none; \}/);
  });

  it("turns off progress animation when reduced motion is requested", () => {
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.learn-progress-track i \{ transition: none; \}\s*\}/);
  });
});
