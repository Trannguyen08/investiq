import { describe, expect, it } from "vitest";

import { userNavigationLinks } from "@/components/layout/user-header";

describe("user navigation", () => {
  it("uses the beginner learning destination instead of the empty AI prediction label", () => {
    expect(userNavigationLinks).toContainEqual(["/learn", "Chứng khoán căn bản"]);
    expect(JSON.stringify(userNavigationLinks)).not.toContain("/predictions");
    expect(JSON.stringify(userNavigationLinks)).not.toContain("Dự báo AI");
  });
});
