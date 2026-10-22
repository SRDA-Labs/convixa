"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useSignMessage } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { createSiweMessage } from "viem/siwe";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { ConfirmDialog } from "@/components/confirm-dialog";
function truncateAddress(addr: string, start = 6, end = 4): string {
  if (addr.length <= start + end) return addr;
  return `${addr.slice(0, start)}…${addr.slice(-end)}`;
}

type ConnectWalletSectionProps = {
  linkedWalletAddress: string | null;
  hideHeading?: boolean;
};

export function ConnectWalletSection({ linkedWalletAddress: initialLinked, hideHeading }: ConnectWalletSectionProps) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [linkedAddress, setLinkedAddress] = useState<string | null>(initialLinked);
  const [loading, setLoading] = useState(false);
  const [unlinkLoading, setUnlinkLoading] = useState(false);
  const [error, setError] = useState("");
  const [showChangeFlow, setShowChangeFlow] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  useEffect(() => {
    setLinkedAddress(initialLinked);
  }, [initialLinked]);

  const refresh = useCallback(() => {
    router.refresh();
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setLinkedAddress(d.linkedWalletAddress ?? null))
      .catch(() => {});
  }, [router]);

  const handleConnectWallet = async () => {
    if (!isConnected || !address) {
      setError("Please connect your wallet first using the button above.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const nonceRes = await fetch("/api/profile/wallet-nonce");
      if (!nonceRes.ok) {
        setError("Failed to get verification nonce");
        return;
      }
      const { nonce } = await nonceRes.json();
      if (!nonce) {
        setError("Invalid nonce response");
        return;
      }

      const domain = typeof window !== "undefined" ? window.location.host : "";
      const uri = typeof window !== "undefined" ? window.location.origin : "";
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

      const message = createSiweMessage({
        address: address as `0x${string}`,
        chainId: 1,
        domain,
        nonce,
        uri,
        version: "1",
        statement: "Link your wallet to your Convixa profile.",
        issuedAt: now,
        expirationTime: expiresAt,
      });

      const signature = await signMessageAsync({ message });
      if (!signature) {
        setError("Signing was cancelled or failed");
        setLoading(false);
        return;
      }

      const linkRes = await fetch("/api/profile/link-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });
      const data = await linkRes.json().catch(() => ({}));
      if (!linkRes.ok) {
        setError(data.error ?? "Failed to link wallet");
        setLoading(false);
        return;
      }
      setLinkedAddress(data.address ?? address);
      setShowChangeFlow(false);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    setUnlinkLoading(true);
    setError("");
    try {
      const res = await fetch("/api/profile/unlink-wallet", { method: "POST" });
      if (res.ok) {
        setLinkedAddress(null);
        setShowChangeFlow(false);
        refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to unlink");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setUnlinkLoading(false);
    }
  };

  return (
    <section aria-labelledby="linked-wallet-heading">
      <ConfirmDialog
        open={showUnlinkConfirm}
        onClose={() => setShowUnlinkConfirm(false)}
        title="Remove linked wallet?"
        description="Remove linked wallet from your profile?"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={handleUnlink}
        destructive
        loading={unlinkLoading}
      />
      {!hideHeading && (
        <div className="mb-6">
          <h4 id="linked-wallet-heading" className="text-base font-medium mb-1">Linked Wallet</h4>
          <p className="text-xs text-muted-foreground">Your connected Ethereum address for multisig operations</p>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 py-2.5 px-3 border border-border rounded-md bg-muted/30">
        <div className="flex items-center gap-3 min-w-0">
          {linkedAddress ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" aria-hidden />
              <code className="text-sm font-mono text-foreground truncate">{truncateAddress(linkedAddress)}</code>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">No wallet linked</span>
          )}
        </div>
        {linkedAddress ? (
          <button
            type="button"
            onClick={() => setShowChangeFlow(true)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            Change
          </button>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <ConnectButton.Custom>
              {({ openConnectModal }) => (
                <button
                  type="button"
                  onClick={openConnectModal}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Connect your wallet
                </button>
              )}
            </ConnectButton.Custom>
            {isConnected && address && (
              <button
                type="button"
                onClick={handleConnectWallet}
                disabled={loading}
                className={cn(
                  "text-xs font-medium text-primary hover:text-primary/90 transition-colors",
                  "disabled:opacity-50 inline-flex items-center gap-1"
                )}
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                {loading ? "Verifying…" : "Sign to link"}
              </button>
            )}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      {showChangeFlow && linkedAddress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" aria-modal="true" role="dialog">
          <div className="rounded-xl border border-border bg-card shadow-lg w-full max-w-sm p-6">
            <h3 className="font-semibold text-foreground">Change linked wallet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Connect a different wallet and sign to link it, or disconnect the current one.
            </p>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
            <div className="mt-4 flex flex-col gap-2">
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <button
                    type="button"
                    onClick={openConnectModal}
                    className="w-full rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                  >
                    Link a different wallet
                  </button>
                )}
              </ConnectButton.Custom>
              {isConnected && address && (
                <button
                  type="button"
                  onClick={handleConnectWallet}
                  disabled={loading}
                  className={cn(
                    "w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  )}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden /> : null}
                  {loading ? "Verifying…" : "Sign to link this wallet"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowUnlinkConfirm(true)}
                className="w-full rounded-lg border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                Disconnect wallet
              </button>
              <button
                type="button"
                onClick={() => { setShowChangeFlow(false); setError(""); }}
                className="w-full rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors mt-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
