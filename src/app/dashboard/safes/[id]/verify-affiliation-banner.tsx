"use client";

import { useState } from "react";
import { useSignMessage } from "wagmi";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  safeId: string;
  rosterId: string;
  signerAddress: string;
};

export function VerifyAffiliationBanner({ safeId, rosterId, signerAddress }: Props) {
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const challengeRes = await fetch(
        `/api/safes/${safeId}/roster/${rosterId}/affiliation-challenge`
      );
      if (!challengeRes.ok) {
        setError("Failed to load verification challenge");
        return;
      }
      const { message } = await challengeRes.json();
      const signature = await signMessageAsync({ message });
      const verifyRes = await fetch(
        `/api/safes/${safeId}/roster/${rosterId}/verify-affiliation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, signature }),
        }
      );
      if (!verifyRes.ok) {
        const data = await verifyRes.json().catch(() => ({}));
        setError(data.error ?? "Verification failed");
        return;
      }
      setDone(true);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  if (done) return null;

  return (
    <div className={cn("rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs")}>
      <p className="font-medium text-foreground">
        Your linked wallet matches signer {signerAddress.slice(0, 8)}…
      </p>
      <p className="text-muted-foreground mt-1">
        Complete Safe-scoped affiliation verification (distinct from profile wallet link).
      </p>
      {error && <p className="text-destructive mt-2">{error}</p>}
      <button
        type="button"
        onClick={handleVerify}
        disabled={loading}
        className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
      >
        {loading && <Loader2 className="h-3 w-3 animate-spin" />}
        Sign affiliation message
      </button>
    </div>
  );
}
