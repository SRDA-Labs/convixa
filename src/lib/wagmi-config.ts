"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  mainnet,
  base,
  arbitrum,
  polygon,
  optimism,
  gnosis,
  avalanche,
  bsc,
  sepolia,
} from "wagmi/chains";

// WalletConnect Cloud project ID required for "Connect wallet". Get one at https://cloud.walletconnect.com
// Docker often sets the ENV to "" when the build-arg is unset — treat blank as missing (?? alone is not enough).
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || undefined;
if (!projectId) {
  console.warn(
    "[Convixa] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. WalletConnect will fail (403 / WebSocket 3000). Add it to .env from https://cloud.walletconnect.com"
  );
}

// RainbowKit/WalletConnect throw on empty projectId during SSR/prerender. Use a 32-char hex
// stub so `next build` succeeds; real wallet connect still needs a Cloud project ID at runtime.
const BUILD_PLACEHOLDER_PROJECT_ID = "00000000000000000000000000000001";

export const config = getDefaultConfig({
  appName: "Convixa",
  projectId: projectId ?? BUILD_PLACEHOLDER_PROJECT_ID,
  chains: [
    mainnet,
    base,
    arbitrum,
    polygon,
    optimism,
    gnosis,
    avalanche,
    bsc,
    sepolia,
  ],
  ssr: true,
});
