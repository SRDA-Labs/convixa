"use client";

import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { SessionProvider } from "next-auth/react";
import { config } from "@/lib/wagmi-config";
import { WalletErrorBoundary } from "@/components/wallet-error-boundary";
import { GlobalWalletErrorHandler } from "@/components/global-wallet-error-handler";
import "@rainbow-me/rainbowkit/styles.css";

const LedgerWalletProviderInit = dynamic(
  () =>
    import("@/components/ledger-wallet-provider-init").then(
      (m) => m.LedgerWalletProviderInit
    ),
  { ssr: false }
);

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GlobalWalletErrorHandler />
      <WalletErrorBoundary>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider>
              <LedgerWalletProviderInit />
              <SessionProvider>{children}</SessionProvider>
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </WalletErrorBoundary>
    </>
  );
}
