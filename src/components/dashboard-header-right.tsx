"use client";

import { ProfileMenu } from "@/components/profile-menu";
import { NotificationDropdown } from "@/components/notification-dropdown";

export function DashboardHeaderRight() {
  return (
    <div className="flex items-center gap-4 shrink-0">
      <NotificationDropdown />
      <ProfileMenu />
    </div>
  );
}
