import { describe, expect, it } from "vitest";
import { classifyInventoryTxStatus } from "./classify-status";

describe("classifyInventoryTxStatus", () => {
  it("classifies executed by transactionHash", () => {
    expect(
      classifyInventoryTxStatus(
        { transactionHash: "0xabc", nonce: 1 },
        5
      )
    ).toBe("executed");
  });

  it("classifies executed by executionDate", () => {
    expect(
      classifyInventoryTxStatus(
        { executionDate: "2026-01-01T00:00:00Z", nonce: 0 },
        1
      )
    ).toBe("executed");
  });

  it("classifies cancelled when nonce is behind safe nonce", () => {
    expect(
      classifyInventoryTxStatus({ nonce: 2 }, 5)
    ).toBe("cancelled");
  });

  it("classifies proposed when nonce equals safe nonce", () => {
    expect(
      classifyInventoryTxStatus({ nonce: 5 }, 5)
    ).toBe("proposed");
  });

  it("classifies proposed when nonce is ahead of safe nonce", () => {
    expect(
      classifyInventoryTxStatus({ nonce: 6 }, 5)
    ).toBe("proposed");
  });

  it("classifies proposed when nonce is missing", () => {
    expect(classifyInventoryTxStatus({}, 3)).toBe("proposed");
  });
});
