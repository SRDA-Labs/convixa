import { describe, expect, it } from "vitest";
import { classifySafeTransaction, normalizeSafeTxType } from "./tx-types";

describe("classifySafeTransaction", () => {
  it("classifies native ETH transfer", () => {
    expect(
      classifySafeTransaction({ value: "1000000000000000000", data: "0x" })
    ).toBe("NATIVE_TRANSFER");
  });

  it("classifies Safe governance methods", () => {
    expect(
      classifySafeTransaction({ method: "addOwnerWithThreshold", data: "0xabc" })
    ).toBe("ADD_OWNER");
    expect(classifySafeTransaction({ method: "changeThreshold", data: "0x" })).toBe(
      "CHANGE_THRESHOLD"
    );
  });

  it("classifies delegate calls by operation", () => {
    expect(
      classifySafeTransaction({
        method: "someMethod",
        data: "0xabc",
        operation: 1,
      })
    ).toBe("DELEGATE_CALL");
  });

  it("classifies ERC-20 transfer method", () => {
    expect(
      classifySafeTransaction({ method: "transfer", data: "0x095ea7b3", value: "0" })
    ).toBe("ERC20_TRANSFER");
  });

  it("classifies batch multisend", () => {
    expect(classifySafeTransaction({ method: "multiSend", data: "0xabc" })).toBe(
      "BATCH_MULTISEND"
    );
  });
});

describe("normalizeSafeTxType", () => {
  it("maps legacy ETH_TRANSFER alias", () => {
    expect(normalizeSafeTxType("ETH_TRANSFER")).toBe("NATIVE_TRANSFER");
  });

  it("accepts canonical codes", () => {
    expect(normalizeSafeTxType("DELEGATE_CALL")).toBe("DELEGATE_CALL");
  });
});
