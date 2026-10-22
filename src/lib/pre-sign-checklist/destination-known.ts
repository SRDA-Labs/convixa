import type { AutoSeverity } from "./types";

export type DestinationKnownEval = {
  pass: boolean;
  message: string;
  severity: AutoSeverity;
  action?: { href: string; label: string };
};

export function evaluateDestinationKnown(params: {
  hasTransactionHistory: boolean;
  addressListMatch: { listId: string; listName: string; entryLabel: string | null } | null;
  destinationAddress: string;
}): DestinationKnownEval {
  if (params.hasTransactionHistory) {
    return {
      pass: true,
      severity: "pass",
      message: "Seen in transaction history",
    };
  }

  if (params.addressListMatch) {
    const who = params.addressListMatch.entryLabel
      ? `"${params.addressListMatch.entryLabel}"`
      : `address list "${params.addressListMatch.listName}"`;
    return {
      pass: true,
      severity: "warn",
      message: `Saved as ${who} — first on-chain use for this Safe`,
    };
  }

  const addParam = encodeURIComponent(params.destinationAddress);
  return {
    pass: false,
    severity: "fail",
    message: "New destination — not in transaction history or any address list",
    action: {
      href: `/dashboard/controls/lists?addAddress=${addParam}`,
      label: "Add to address list",
    },
  };
}
