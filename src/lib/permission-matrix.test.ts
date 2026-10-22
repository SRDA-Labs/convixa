import { describe, it, expect } from "vitest";
import { toggleMatrixPermission } from "./permission-matrix";

describe("toggleMatrixPermission", () => {
  it("adds view dependency when enabling create", () => {
    const next = toggleMatrixPermission([], "safes:create", true);
    expect(next).toContain("safes:read");
    expect(next).toContain("safes:create");
  });

  it("removes dependents when disabling view", () => {
    const next = toggleMatrixPermission(
      ["safes:read", "safes:create", "safes:delete"],
      "safes:read",
      false
    );
    expect(next).not.toContain("safes:read");
    expect(next).not.toContain("safes:create");
    expect(next).not.toContain("safes:delete");
  });

  it("adds security:read when enabling security:manage", () => {
    const next = toggleMatrixPermission([], "security:manage", true);
    expect(next).toEqual(expect.arrayContaining(["security:read", "security:manage"]));
  });
});
