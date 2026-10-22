"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAccount, useSignMessage } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Loader2 } from "lucide-react";
import { getAddress } from "viem";

type ChallengeData = {
  orgName: string;
  safeAddress: string;
  network: string;
  signerAddress: string;
  displayName: string | null;
  message: string;
};

export default function VerifySignerPage() {
  const params = useParams();
  const token = params.token as string;
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [data, setData] = useState<ChallengeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/verify-signer/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? "Invalid invite");
        }
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleVerify = async () => {
    if (!data || !isConnected || !address) {
      setError("Connect the wallet that matches the roster signer address.");
      return;
    }

    let wallet: string;
    try {
      wallet = getAddress(address);
    } catch {
      setError("Invalid connected wallet");
      return;
    }

    if (wallet.toLowerCase() !== data.signerAddress.toLowerCase()) {
      setError(`Connected wallet must be ${data.signerAddress}`);
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const signature = await signMessageAsync({ message: data.message });
      const res = await fetch(`/api/verify-signer/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: data.message, signature, walletAddress: wallet }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Verification failed");
        return;
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 space-y-4">
        <h1 className="text-lg font-semibold">Verify signer affiliation</h1>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {done && (
          <p className="text-sm text-emerald-600">
            Verification complete. You may close this page.
          </p>
        )}

        {data && !done && !loading && (
          <>
            <p className="text-sm text-muted-foreground">
              <strong>{data.orgName}</strong> requests verification for Safe{" "}
              <span className="font-mono text-xs">{data.safeAddress.slice(0, 10)}…</span> on{" "}
              {data.network}.
            </p>
            <p className="text-xs text-muted-foreground">
              Signer: <span className="font-mono">{data.signerAddress}</span>
            </p>
            <ConnectButton />
            <button
              type="button"
              onClick={handleVerify}
              disabled={submitting || !isConnected}
              className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {submitting ? "Signing…" : "Sign affiliation message"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
