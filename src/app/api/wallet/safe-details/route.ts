import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";
import { SAFE_CHAINS, getSafeTxServiceBaseUrl, safeApiFetch } from "@/lib/safe-api";

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/** GET /api/wallet/safe-details?network=eth&address=0x... – Safe info + last 10 executed txs (for detail modal). */
export async function GET(req: NextRequest) {
  const network = req.nextUrl.searchParams.get("network");
  const address = req.nextUrl.searchParams.get("address");
  if (!network || !address || !ETH_ADDRESS_REGEX.test(address)) {
    return NextResponse.json(
      { error: "Query params network and address (0x...) are required" },
      { status: 400 }
    );
  }

  const chain = SAFE_CHAINS.find((c) => c.slug === network);
  if (!chain) {
    return NextResponse.json(
      { error: `Unsupported network: ${network}` },
      { status: 400 }
    );
  }

  let safeAddress: string;
  try {
    safeAddress = getAddress(address);
  } catch {
    return NextResponse.json(
      { error: "Invalid address format" },
      { status: 400 }
    );
  }

  const base = getSafeTxServiceBaseUrl(network).replace(/\/$/, "");
  const [infoRes, txsRes] = await Promise.all([
    safeApiFetch(`${base}/api/v1/safes/${safeAddress}/`, { cache: "no-store" }),
    safeApiFetch(`${base}/api/v1/safes/${safeAddress}/multisig-transactions/?executed=true&limit=10`, {
      cache: "no-store",
    }),
  ]);

  if (!infoRes.ok) {
    return NextResponse.json(
      { error: "Safe not found or not indexed yet" },
      { status: 404 }
    );
  }

  const raw = (await infoRes.json()) as {
    address?: string;
    threshold?: number;
    owners?: string[];
    nonce?: number | string;
    version?: string;
  };
  if (!raw?.address || !Array.isArray(raw.owners)) {
    return NextResponse.json(
      { error: "Safe not found or not indexed yet" },
      { status: 404 }
    );
  }

  let transactions: Array<{
    safeTxHash: string;
    to: string;
    value: string;
    submissionDate: string;
    executedAt: string | null;
  }> = [];
  if (txsRes.ok) {
    type TxResult = { safeTxHash?: string; to?: string; value?: string; submissionDate?: string; executedAt?: string | null };
    const txsData = (await txsRes.json()) as { results?: TxResult[] };
    const list = txsData.results ?? [];
    transactions = list.map((t) => ({
      safeTxHash: t.safeTxHash ?? "",
      to: t.to ?? "",
      value: t.value ?? "0",
      submissionDate: t.submissionDate ?? "",
      executedAt: t.executedAt ?? null,
    }));
  }

  const nonce = typeof raw.nonce === "string" ? parseInt(raw.nonce, 10) : (raw.nonce ?? 0);

  return NextResponse.json({
    safe: {
      address: raw.address,
      network,
      chainId: chain.chainId,
      chainName: chain.name,
      threshold: raw.threshold ?? 0,
      owners: raw.owners,
      nonce,
      version: raw.version ?? undefined,
    },
    transactions,
  });
}
