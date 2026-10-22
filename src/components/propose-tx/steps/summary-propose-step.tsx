"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSwitchChain, useWalletClient } from "wagmi";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import {
  actionPreviewLabel,
  buildAndSignOwnerChange,
  chainIdForSafeNetwork,
  networkLabel,
  ownersInclude,
  type Eip1193Provider,
  type OwnerChangeOperation,
} from "@/lib/safe-propose/owner-change";
import { getSafeAppUrl } from "@/lib/safe-api";
import { isLedgerWalletProviderConfigured } from "@/components/ledger-wallet-provider-init";
import type { ProposeSafeOption } from "../types";

type RowStatus = "idle" | "proposing" | "proposed" | "error";

type RowState = {
  status: RowStatus;
  error?: string;
  safeTxHash?: string;
};

function truncate(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function SummaryProposeStep({
  safes,
  operation,
}: {
  safes: ProposeSafeOption[];
  operation: OwnerChangeOperation;
}) {
  const { address, isConnected, chainId, connector } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const ledgerConfigured = isLedgerWalletProviderConfigured();

  const proposeForSafe = useCallback(
    async (safe: ProposeSafeOption) => {
      if (!address) {
        toast.error("Connect a wallet first");
        return;
      }
      if (!ownersInclude(safe.owners, address) && safe.owners.length > 0) {
        toast.error("Connected wallet is not an owner of this Safe");
        return;
      }

      setRowState((s) => ({
        ...s,
        [safe.id]: { status: "proposing" },
      }));

      try {
        const targetChainId = chainIdForSafeNetwork(safe.network);
        if (chainId !== targetChainId) {
          await switchChainAsync({ chainId: targetChainId });
        }

        let eip1193: Eip1193Provider | null = null;
        if (connector?.getProvider) {
          const raw = (await connector.getProvider()) as Eip1193Provider | undefined;
          if (raw?.request) eip1193 = raw;
        }
        if (!eip1193 && walletClient) {
          eip1193 = {
            request: async ({ method, params }) =>
              walletClient.request({
                method: method as never,
                params: params as never,
              }),
          };
        }
        if (!eip1193) {
          throw new Error("No wallet provider available");
        }

        const signed = await buildAndSignOwnerChange({
          provider: eip1193,
          signerAddress: address,
          safeAddress: safe.address,
          network: safe.network,
          operation,
        });

        const res = await fetch(`/api/safes/${safe.id}/propose`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            safeTxHash: signed.safeTxHash,
            senderAddress: signed.senderAddress,
            senderSignature: signed.senderSignature,
            safeTransactionData: signed.safeTransactionData,
            origin: "Convixa",
          }),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(body.error ?? `Propose failed (${res.status})`);
        }

        setRowState((s) => ({
          ...s,
          [safe.id]: { status: "proposed", safeTxHash: signed.safeTxHash },
        }));
        toast.success(`Proposed on ${safe.name || truncate(safe.address)}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Propose failed";
        setRowState((s) => ({
          ...s,
          [safe.id]: { status: "error", error: message },
        }));
        toast.error(message);
      }
    },
    [address, chainId, connector, operation, switchChainAsync, walletClient]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-xs font-medium text-foreground">Connected wallet</p>
          <p className="text-[11px] text-muted-foreground">
            Must be a Safe owner. Ledger: use RainbowKit
            {ledgerConfigured
              ? " — Ledger Wallet Provider is enabled (USB/BT, desktop)."
              : " — set Ledger Wallet Provider env for direct USB/BT, or use WalletConnect → Ledger Live."}{" "}
            Mobile browsers cannot use WebHID.
          </p>
        </div>
        {/* Custom ConnectButton — RainbowKit's default control collapses/overlaps in narrow modal flex rows */}
        <ConnectButton.Custom>
          {({
            account,
            chain,
            openAccountModal,
            openChainModal,
            openConnectModal,
            mounted,
          }) => {
            const ready = mounted;
            const connected = ready && account && chain;
            return (
              <div
                className="flex shrink-0 flex-wrap items-center gap-2"
                {...(!ready && {
                  "aria-hidden": true,
                  style: {
                    opacity: 0,
                    pointerEvents: "none" as const,
                    userSelect: "none" as const,
                  },
                })}
              >
                {!connected ? (
                  <button
                    type="button"
                    onClick={openConnectModal}
                    className={cn(
                      "inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium",
                      "bg-primary text-primary-foreground hover:bg-primary/90",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    )}
                  >
                    Connect wallet
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={openChainModal}
                      className={cn(
                        "inline-flex max-w-[9.5rem] items-center gap-1.5 truncate rounded-md border border-border/80",
                        "bg-background px-2.5 py-1.5 text-xs font-medium text-foreground",
                        "hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      )}
                    >
                      {chain.unsupported ? "Wrong network" : chain.name}
                    </button>
                    <button
                      type="button"
                      onClick={openAccountModal}
                      className={cn(
                        "inline-flex items-center rounded-md border border-border/80",
                        "bg-background px-2.5 py-1.5 font-mono text-xs text-foreground",
                        "hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      )}
                    >
                      {account.displayName}
                    </button>
                  </>
                )}
              </div>
            );
          }}
        </ConnectButton.Custom>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border/80 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Msig</th>
              <th className="px-3 py-2">Network</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Propose</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {safes.map((safe) => {
              const st = rowState[safe.id] ?? { status: "idle" as const };
              const label = safe.name?.trim() || truncate(safe.address);
              const notOwner =
                Boolean(address) &&
                safe.owners.length > 0 &&
                !ownersInclude(safe.owners, address!);
              return (
                <tr key={safe.id} className="align-top">
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/dashboard/safes/${safe.id}`}
                      className="font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {label}
                    </Link>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {truncate(safe.address)}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {networkLabel(safe.network)}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">
                    {actionPreviewLabel(operation)}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {st.status === "idle" && (
                      <span className="text-muted-foreground">
                        {notOwner ? "Wallet not owner" : "Ready"}
                      </span>
                    )}
                    {st.status === "proposing" && (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                        Proposing…
                      </span>
                    )}
                    {st.status === "proposed" && st.safeTxHash && (
                      <span className="space-y-1 block">
                        <span className="text-emerald-700 dark:text-emerald-400">Proposed</span>
                        <a
                          href={getSafeAppUrl(safe.network, safe.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-[11px] text-primary hover:underline"
                        >
                          Open in Safe
                        </a>
                        <Link
                          href={`/dashboard/safes/${safe.id}/pending/${encodeURIComponent(st.safeTxHash)}/discussion`}
                          className="block text-[11px] text-primary hover:underline"
                        >
                          Discuss in Convixa
                        </Link>
                      </span>
                    )}
                    {st.status === "error" && (
                      <span className="text-destructive" title={st.error}>
                        {st.error && st.error.length > 48
                          ? `${st.error.slice(0, 48)}…`
                          : st.error || "Error"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      disabled={
                        !isConnected ||
                        st.status === "proposing" ||
                        st.status === "proposed" ||
                        notOwner
                      }
                      onClick={() => void proposeForSafe(safe)}
                      className={cn(
                        "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                        "bg-primary text-primary-foreground hover:bg-primary/90",
                        "disabled:opacity-50 disabled:pointer-events-none",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      )}
                    >
                      {st.status === "proposing" ? "…" : "Propose"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
