import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";
import { SAFE_CHAINS, getSafeTxServiceBaseUrl, safeApiFetch } from "@/lib/safe-api";

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/** GET /api/wallet/safe-info?network=eth&address=0x... – fetch one Safe's info (for "add to watch"). */
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

  const baseUrl = getSafeTxServiceBaseUrl(network);
  const url = `${baseUrl}api/v1/safes/${safeAddress}/`;
  const res = await safeApiFetch(url, { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json(
      { error: "Safe not found or not indexed yet" },
      { status: 404 }
    );
  }

  const raw = (await res.json()) as { address?: string; threshold?: number; owners?: string[] };
  if (!raw?.address || !Array.isArray(raw.owners)) {
    return NextResponse.json(
      { error: "Safe not found or not indexed yet" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    address: raw.address,
    network,
    chainId: chain.chainId,
    chainName: chain.name,
    threshold: raw.threshold ?? 0,
    owners: raw.owners,
  });
}
