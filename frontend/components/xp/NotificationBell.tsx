"use client";

import { useNotifications } from "@/lib/notifications/use-notifications";
import { BellIcon } from "./icons";
import "@/components/windows/notifications.css";

interface NotificationBellProps {
  onOpen: () => void;
}

export function NotificationBell({ onOpen }: NotificationBellProps) {
  const { unread } = useNotifications();

  return (
    <button
      type="button"
      className="xp-tray-button notif-bell"
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      title="Notifications"
      onClick={onOpen}
    >
      <BellIcon width={18} height={18} />
      {unread > 0 && (
        <span className="notif-badge" aria-hidden>
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}
