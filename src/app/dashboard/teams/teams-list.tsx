"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreateTeamModal } from "./create-team-modal";

export function TeamsList({
  orgId,
  initialTeams,
  currentUser,
}: {
  orgId: string;
  initialTeams: { id: string; name: string; slug: string }[];
  currentUser: { id: string; name: string | null; email: string | null } | null;
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const router = useRouter();

  const handleSaved = () => {
    setShowCreateModal(false);
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowCreateModal(true)}
        className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all btn-primary-glow"
      >
        Create team
      </button>
      {showCreateModal && currentUser && (
        <CreateTeamModal
          currentUser={currentUser}
          onClose={() => setShowCreateModal(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
