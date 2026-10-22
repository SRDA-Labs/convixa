import { createHmac, timingSafeEqual } from "crypto";

export function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  try {
    const sigBuf = Buffer.from(signature.replace(/^sha256=/, ""), "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return signature === expected || signature === `sha256=${expected}`;
  }
}

export function parseWebhookPayload(body: unknown): {
  eventType: string;
  safeAddress: string | null;
  safeTxHash: string | null;
} {
  const obj = body as Record<string, unknown>;
  const eventType =
    (obj.type as string) ??
    (obj.event as string) ??
    (obj.eventType as string) ??
    "UNKNOWN";
  const tx = (obj.tx ?? obj.transaction ?? obj.data) as Record<string, unknown> | undefined;
  const safeAddress =
    (obj.safe as string) ??
    (obj.safeAddress as string) ??
    (tx?.safe as string) ??
    null;
  const safeTxHash =
    (obj.safeTxHash as string) ??
    (tx?.safeTxHash as string) ??
    (obj.txHash as string) ??
    null;

  return {
    eventType: String(eventType),
    safeAddress: safeAddress ? String(safeAddress).toLowerCase() : null,
    safeTxHash: safeTxHash ? String(safeTxHash) : null,
  };
}
