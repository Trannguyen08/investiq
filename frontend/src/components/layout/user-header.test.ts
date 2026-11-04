import { describe, expect, it } from "vitest";

import { getUserGreeting, userNavigationLinks } from "@/components/layout/user-header";

describe("user navigation", () => {
  it("uses the beginner learning destination instead of the empty AI prediction label", () => {
    expect(userNavigationLinks).toContainEqual(["/learn", "Chứng khoán căn bản"]);
    expect(JSON.stringify(userNavigationLinks)).not.toContain("/predictions");
    expect(JSON.stringify(userNavigationLinks)).not.toContain("Dự báo AI");
  });

  it("does not include ai-assistant on header navigation to prioritize space", () => {
    expect(JSON.stringify(userNavigationLinks)).not.toContain("/ai-assistant");
    expect(JSON.stringify(userNavigationLinks)).not.toContain("Trợ lý AI");
  });

  it("formats user greeting with calling name instead of full name", () => {
    expect(getUserGreeting("Trần Chí Nguyện")).toBe("Xin chào, Nguyện");
    expect(getUserGreeting("Tran Chi Nguyen")).toBe("Xin chào, Nguyen");
    expect(getUserGreeting("admin")).toBe("Xin chào, admin");
    expect(getUserGreeting("user@example.com")).toBe("Xin chào, user");
    expect(getUserGreeting("")).toBe("Xin chào");
  });
});
