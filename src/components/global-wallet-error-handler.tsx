"use client";

import { useEffect, useState } from "react";

/**
 * Catches uncaught errors from WalletConnect/wagmi (e.g. in WebSocket callbacks) that
 * React error boundaries do not catch. Shows a friendly overlay so the user can refresh.
 */
export function GlobalWalletErrorHandler() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    /**
     * WalletConnect relay often throws "Connection interrupted while trying to subscribe"
     * (e.g. missing/invalid NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID). We intentionally avoid
     * matching the bare phrase "Connection interrupted" — other stacks (OAuth, fetch) can use
     * similar wording and would wrongly show this overlay after Google sign-in.
     */
    function isWalletConnectionError(text: string): boolean {
      const m = (text ?? "").toLowerCase();
      if (m.includes("walletconnect")) return true;
      if (m.includes("while trying to subscribe")) return true;
      if (
        m.includes("connection interrupted") &&
        (m.includes("subscribe") || m.includes("relay") || m.includes("websocket"))
      ) {
        return true;
      }
      return false;
    }

    function handleError(event: ErrorEvent): boolean {
      const filename = (event.filename ?? "").toLowerCase();
      const fromWalletScript =
        filename.includes("walletconnect") || filename.includes("@walletconnect");
      if (
        fromWalletScript ||
        isWalletConnectionError(event.message ?? "") ||
        isWalletConnectionError(String((event.error as Error)?.stack ?? ""))
      ) {
        setShow(true);
        return true; // prevent default (e.g. dev overlay)
      }
      return false;
    }

    function handleRejection(event: PromiseRejectionEvent): void {
      const reason = event.reason;
      const message =
        typeof reason === "object" && reason !== null && "message" in reason
          ? String((reason as Error).message)
          : reason?.toString?.() ?? String(reason ?? "");
      const stack =
        typeof reason === "object" && reason !== null && "stack" in reason
          ? String((reason as Error).stack ?? "")
          : "";
      const combined = `${message}\n${stack}`;
      if (isWalletConnectionError(combined)) {
        setShow(true);
        event.preventDefault?.();
      }
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-background/95 backdrop-blur">
      <div className="rounded-xl border border-border bg-card p-6 max-w-sm shadow-xl text-center">
        <p className="text-sm text-muted-foreground mb-4">
          The wallet connector (WalletConnect) hit an error — often a missing or invalid{" "}
          <code className="text-xs bg-muted px-1 rounded">NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID</code>
          . Google and email sign-in can still succeed; refresh to continue. If this persists, add a
          project ID from{" "}
          <a
            href="https://cloud.walletconnect.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            WalletConnect Cloud
          </a>
          .
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2"
        >
          Refresh page
        </button>
      </div>
    </div>
  );
}
