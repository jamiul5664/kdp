import { useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { Dropdown } from '../ui/Dropdown';
import { cn } from '../../utils/cn';
import type { AppRoute } from '../../types';

export function NotificationMenu({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  const [open, setOpen] = useState(false);
  const notifications = useAppStore((s) => s.notifications);
  const markRead = useAppStore((s) => s.markNotificationRead);
  const markAllRead = useAppStore((s) => s.markAllNotificationsRead);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      widthClass="w-80 sm:w-96"
      trigger={
        <button
          type="button"
          aria-label={`Notifications (${unreadCount} unread)`}
          className="relative h-9 w-9 rounded-lg inline-flex items-center justify-center text-secondary hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent text-[10px] font-mono-tabular font-semibold text-white flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
      }
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle">
        <span className="font-display text-sm font-semibold text-foreground">Notifications</span>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline cursor-pointer"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-border-subtle">
        {notifications.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-secondary">No notifications yet.</p>
        ) : (
          notifications.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                markRead(item.id);
                setOpen(false);
                onNavigate(item.route);
              }}
              className={cn(
                'w-full text-left px-4 py-3 hover:bg-surface-hover transition-colors cursor-pointer',
                !item.read && 'bg-accent/[0.04]'
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                <span className="text-xs font-mono-tabular text-muted shrink-0">
                  {item.timestamp}
                </span>
              </div>
              <p className="text-xs text-secondary mt-1 line-clamp-2">{item.description}</p>
            </button>
          ))
        )}
      </div>
    </Dropdown>
  );
}
