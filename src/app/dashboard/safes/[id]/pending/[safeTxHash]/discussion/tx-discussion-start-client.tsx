"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, MessageSquarePlus } from "lucide-react";
import { orgHubUrl } from "@/lib/org-management/constants";

export function TxDiscussionStartClient({
  safeId,
  safeTxHash,
}: {
  safeId: string;
  safeTxHash: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadUrl, setThreadUrl] = useState<string | null>(null);
  const [canStart, setCanStart] = useState(false);
  const [liveTx, setLiveTx] = useState<{
    txType: string;
    to: string;
    value: string;
    nonce: number;
  } | null>(null);
  const [safeName, setSafeName] = useState<string | null>(null);

  const encodedHash = encodeURIComponent(safeTxHash);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/safes/${safeId}/pending/${encodedHash}/proposal`);
      if (res.status === 403) {
        setError("You do not have access to team discussions for this safe.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError("Could not load transaction.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.threadUrl) {
        setThreadUrl(data.threadUrl);
      }
      setCanStart(data.capabilities?.canStart ?? false);
      setLiveTx(data.liveTx ?? null);
      setSafeName(data.safe?.name ?? null);
    } catch {
      setError("Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [safeId, encodedHash]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (threadUrl) {
      router.replace(threadUrl);
    }
  }, [threadUrl, router]);

  async function startDiscussion() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/safes/${safeId}/pending/${encodedHash}/proposal`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start discussion.");
        setStarting(false);
        return;
      }
      if (data.threadUrl) {
        router.push(data.threadUrl);
      }
    } catch {
      setError("Could not start discussion.");
      setStarting(false);
    }
  }

  if (loading || threadUrl) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-5">
      <Link
        href={orgHubUrl("proposals")}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Team proposals
      </Link>

      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="space-y-1">
          <h1 className="text-base font-semibold text-foreground">Start a team discussion</h1>
          <p className="text-xs text-muted-foreground">
            Create a shared record for your team to discuss this pending transaction. Only team
            members (and invited collaborators) can access it.
          </p>
        </div>

        {liveTx && (
          <dl className="text-xs grid grid-cols-2 gap-x-3 gap-y-1.5 text-muted-foreground border-t border-border pt-4">
            <dt>Safe</dt>
            <dd className="text-foreground">{safeName ?? safeId.slice(0, 8) + "…"}</dd>
            <dt>Type</dt>
            <dd className="text-foreground">{liveTx.txType}</dd>
            <dt>Nonce</dt>
            <dd className="text-foreground tabular-nums">{liveTx.nonce}</dd>
          </dl>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        {canStart ? (
          <button
            type="button"
            onClick={startDiscussion}
            disabled={starting}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {starting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageSquarePlus className="h-4 w-4" />
            )}
            Start a discussion
          </button>
        ) : (
          <p className="text-xs text-muted-foreground">
            You do not have permission to start a discussion on this safe.
          </p>
        )}
      </div>
    </div>
  );
}
