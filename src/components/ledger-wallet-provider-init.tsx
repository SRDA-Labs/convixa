"use client";

import { useEffect } from "react";
import "@ledgerhq/ledger-wallet-provider/styles.css";

/**
 * Client-only Ledger Wallet Provider bootstrap.
 * Announces via EIP-6963 so RainbowKit/wagmi can discover Ledger (USB/BT).
 * Requires NEXT_PUBLIC_LEDGER_WALLET_PROVIDER_API_KEY (and optional NEXT_PUBLIC_LEDGER_DAPP_IDENTIFIER).
 * @see https://developers.ledger.com/docs/ledger-wallet-provider/overview
 */
export function LedgerWalletProviderInit() {
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_LEDGER_WALLET_PROVIDER_API_KEY?.trim();
    const dAppIdentifier =
      process.env.NEXT_PUBLIC_LEDGER_DAPP_IDENTIFIER?.trim() || "convixa";

    if (!apiKey) {
      if (process.env.NODE_ENV === "development") {
        console.info(
          "[Convixa] Ledger Wallet Provider skipped — set NEXT_PUBLIC_LEDGER_WALLET_PROVIDER_API_KEY. WalletConnect → Ledger Live still works via RainbowKit."
        );
      }
      return;
    }

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      try {
        const { initializeLedgerProvider } = await import(
          "@ledgerhq/ledger-wallet-provider"
        );
        if (cancelled) return;
        // Show Ledger's floating connect button (top-left). With hideButton:true it only
        // appears via EIP-6963 inside RainbowKit — easy to miss. Top-left matches Ledger's
        // common demo flow: click → detect USB/BT device → pick account.
        cleanup = initializeLedgerProvider({
          apiKey,
          dAppIdentifier,
          hideButton: false,
          floatingButtonPosition: "top-left",
        });
      } catch (err) {
        console.warn("[Convixa] Failed to initialize Ledger Wallet Provider:", err);
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return null;
}

export function isLedgerWalletProviderConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_LEDGER_WALLET_PROVIDER_API_KEY?.trim());
}
