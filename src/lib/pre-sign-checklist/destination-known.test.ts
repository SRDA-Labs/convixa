import { describe, expect, it } from "vitest";
import { evaluateDestinationKnown } from "./destination-known";

describe("evaluateDestinationKnown", () => {
  const addr = "0x5c542E960eB01D7EE5F4B1C4ca072Cf80C25cD67";

  it("passes when destination was seen in transaction history", () => {
    const result = evaluateDestinationKnown({
      hasTransactionHistory: true,
      addressListMatch: null,
      destinationAddress: addr,
    });
    expect(result.pass).toBe(true);
    expect(result.severity).toBe("pass");
    expect(result.action).toBeUndefined();
  });

  it("warns when address is on an org list but not yet used by this Safe", () => {
    const result = evaluateDestinationKnown({
      hasTransactionHistory: false,
      addressListMatch: { listId: "list-1", listName: "Vendors", entryLabel: "Acme Corp" },
      destinationAddress: addr,
    });
    expect(result.pass).toBe(true);
    expect(result.severity).toBe("warn");
    expect(result.message).toContain("Acme Corp");
    expect(result.action).toBeUndefined();
  });

  it("fails with address list link when unknown destination", () => {
    const result = evaluateDestinationKnown({
      hasTransactionHistory: false,
      addressListMatch: null,
      destinationAddress: addr,
    });
    expect(result.pass).toBe(false);
    expect(result.severity).toBe("fail");
    expect(result.action?.label).toBe("Add to address list");
    expect(result.action?.href).toContain(encodeURIComponent(addr));
  });
});
