import { TxDiscussionStartClient } from "./tx-discussion-start-client";

export default async function TxDiscussionStartPage({
  params,
}: {
  params: Promise<{ id: string; safeTxHash: string }>;
}) {
  const { id, safeTxHash } = await params;
  return (
    <TxDiscussionStartClient
      safeId={id}
      safeTxHash={decodeURIComponent(safeTxHash)}
    />
  );
}
