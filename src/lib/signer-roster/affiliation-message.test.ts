import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildAffiliationMessage } from "../signer-roster/affiliation-message";

describe("affiliation message", () => {
  it("produces stable template bytes", () => {
    const message = buildAffiliationMessage({
      signerAddress: "0xAbC12345678901234567890123456789012345678",
      displayName: "Alice",
      roleLabel: "CTO",
      orgName: "Acme Corp",
      safeAddress: "0xSafe1234567890123456789012345678901234567",
      network: "eth",
      safePurpose: "Treasury operations",
      requestId: "req-123",
      issuedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:15:00.000Z",
    });

    assert.match(message, /I affirm that 0xAbC/);
    assert.match(message, /Request ID: req-123/);
    assert.match(message, /Purpose: Treasury operations/);
  });
});
