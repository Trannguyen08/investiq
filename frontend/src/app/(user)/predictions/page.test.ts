import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  permanentRedirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
}));

vi.mock("next/navigation", () => ({ permanentRedirect: mocks.permanentRedirect }));

import LegacyPredictionsPage from "@/app/(user)/predictions/page";

describe("legacy predictions route", () => {
  it("permanently redirects old bookmarks to the learning journey", () => {
    expect(() => LegacyPredictionsPage()).toThrow("NEXT_REDIRECT");
    expect(mocks.permanentRedirect).toHaveBeenCalledWith("/learn");
  });
});
