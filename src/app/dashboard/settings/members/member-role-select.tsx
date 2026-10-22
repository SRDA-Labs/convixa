"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function MemberRoleSelect({
  membershipId,
  currentRoleId,
  orgRoles,
}: {
  membershipId: string;
  currentRoleId: string | null;
  orgRoles: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState<string>(currentRoleId ?? "");

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newVal = e.target.value;
    setValue(newVal);
    const roleId = newVal === "" ? null : newVal;
    startTransition(async () => {
      const res = await fetch(`/api/members/${membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      });
      if (!res.ok) return;
      router.refresh();
    });
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={isPending}
      title="Assign custom role"
      className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors bg-transparent border-none cursor-pointer appearance-none py-0 pr-5 focus:outline-none focus:ring-0 disabled:opacity-50 min-w-[5rem]"
    >
      <option value="">Edit role</option>
      {orgRoles.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </select>
  );
}
