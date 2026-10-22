import { TxProposalDetailClient } from "./tx-proposal-detail-client";

export default async function TxProposalDetailPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  return <TxProposalDetailClient threadId={threadId} />;
}
