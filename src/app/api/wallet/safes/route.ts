import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";
import { getSignerSafesForAddress } from "@/lib/get-signer-safes";

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

interface WalletSafeItem {
  address: string;
  network: string;
  chainId: number;
  threshold: number;
  owners: string[];
  isSigner: true;
}

/** GET /api/wallet/safes?address=0x... – fetch all multisigs where address is a signer (across supported chains). */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address || !ETH_ADDRESS_REGEX.test(address)) {
    return NextResponse.json(
      { error: "Valid address query (0x...) is required" },
      { status: 400 }
    );
  }

  let ownerAddress: string;
  try {
    ownerAddress = getAddress(address);
  } catch {
    return NextResponse.json(
      { error: "Invalid address format" },
      { status: 400 }
    );
  }

  const nocache =
    req.nextUrl.searchParams.get("nocache") === "1" ||
    req.nextUrl.searchParams.get("nocache") === "true";
  const items = await getSignerSafesForAddress(ownerAddress, { nocache });
  const safes: WalletSafeItem[] = items.map((item) => ({
    address: item.address,
    network: item.network,
    chainId: item.chainId,
    threshold: item.threshold,
    owners: item.owners,
    isSigner: true as const,
  }));

  const json: { safes: WalletSafeItem[] } = { safes };
  return NextResponse.json(json);
}
