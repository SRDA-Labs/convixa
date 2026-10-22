import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' https://fonts.reown.com",
      "connect-src 'self' https://api.safe.global https://*.safe.global https://safe-transaction-polygon.safe.global https://*.walletconnect.org https://api.web3modal.org https://*.web3modal.org https://pulse.walletconnect.org https://eth.merkle.io https://*.api.live.ledger.com https://*.ledger.com wss:",
      "frame-src 'self' https://verify.walletconnect.com https://verify.walletconnect.org https://secure.walletconnect.com https://secure.walletconnect.org",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployments
  output: "standalone",
  // Keep postgres driver on server only (avoid bundling resolution issues)
  serverExternalPackages: ["postgres", "@safe-global/protocol-kit", "@safe-global/api-kit"],
  // workerThreads removed — incompatible with custom webpack functions in Next.js 15.5.
  // Webpack functions (resolve.fallback) cannot be serialized across worker threads,
  // causing DataCloneError. The Next.js persistent cache (convixa-nextjs-build-cache)
  // provides faster incremental builds without worker threads.
  webpack: (config) => {
    // Stub optional peer deps from wagmi/rainbowkit (MetaMask SDK, pino) to avoid build warnings
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };

    // Ledger ships Tailwind v4 CSS using @layer base/components/utilities.
    // Tailwind v3's PostCSS plugin rejects those unless @tailwind is present.
    // Rename layers before PostCSS so the precompiled stylesheet builds cleanly.
    config.module.rules.unshift({
      test: /[\\/]node_modules[\\/]@ledgerhq[\\/]ledger-wallet-provider[\\/].*\.css$/,
      enforce: "pre",
      use: [require.resolve("./scripts/ledger-css-layer-fix-loader.cjs")],
    });

    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
