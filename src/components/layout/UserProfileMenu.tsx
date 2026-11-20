import { useState } from 'react';
import { LogOut, Moon, Settings, Sun, User } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { useTheme } from '../../hooks/useTheme';
import { Dropdown, DropdownItem } from '../ui/Dropdown';
import type { AppRoute } from '../../types';

export function UserProfileMenu({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  const [open, setOpen] = useState(false);
  const user = useAppStore((s) => s.user);
  const signOut = useAppStore((s) => s.signOut);
  const { theme, toggleTheme } = useTheme();
  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      widthClass="w-64"
      trigger={
        <button
          type="button"
          aria-label="Open user menu"
          className="h-9 flex items-center gap-2.5 rounded-lg pl-1 pr-2.5 hover:bg-surface-hover transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {avatarFailed ? (
            <div className="h-7 w-7 rounded-full bg-accent/20 text-accent text-xs font-semibold flex items-center justify-center">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
          ) : (
            <img
              src={user.avatar}
              alt={user.name}
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
              className="h-7 w-7 rounded-full object-cover border border-border-subtle"
            />
          )}
          <span className="hidden sm:inline text-sm font-medium text-foreground whitespace-nowrap max-w-[120px] truncate">
            {user.name}
          </span>
        </button>
      }
    >
      <div className="px-3.5 py-2.5 border-b border-border-subtle">
        <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
        <p className="text-xs text-secondary truncate">{user.email}</p>
        <p className="text-xs text-muted mt-0.5">{user.imprint}</p>
      </div>

      <div className="py-1">
        <DropdownItem
          onClick={() => {
            setOpen(false);
            onNavigate('/settings');
          }}
        >
          <User className="h-4 w-4 text-secondary" />
          Profile & Imprint
        </DropdownItem>
        <DropdownItem
          onClick={() => {
            setOpen(false);
            onNavigate('/settings');
          }}
        >
          <Settings className="h-4 w-4 text-secondary" />
          Workspace Settings
        </DropdownItem>
        <DropdownItem
          onClick={() => {
            toggleTheme();
            setOpen(false);
          }}
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 text-secondary" />
          ) : (
            <Moon className="h-4 w-4 text-secondary" />
          )}
          Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode
        </DropdownItem>
      </div>

      <div className="pt-1 border-t border-border-subtle">
        <DropdownItem
          danger
          onClick={() => {
            setOpen(false);
            signOut();
          }}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownItem>
      </div>
    </Dropdown>
  );
}
