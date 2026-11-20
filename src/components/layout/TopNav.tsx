import { Menu, Moon, Plus, Sun } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../ui/Button';
import { NotificationMenu } from './NotificationMenu';
import { UserProfileMenu } from './UserProfileMenu';
import { ROUTE_TITLES } from './navigation';
import type { AppRoute } from '../../types';

export function TopNav({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  const route = useAppStore((s) => s.route);
  const setMobileNavOpen = useAppStore((s) => s.setMobileNavOpen);
  const setCreateModalOpen = useAppStore((s) => s.setCreateModalOpen);
  const { theme, toggleTheme } = useTheme();

  const meta = ROUTE_TITLES[route] ?? { section: 'Workspace', title: 'Dashboard' };

  return (
    <header className="h-16 shrink-0 bg-sidebar/95 backdrop-blur-sm border-b border-border-subtle px-4 lg:px-6 flex items-center justify-between gap-6">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation menu"
          className="lg:hidden h-9 w-9 rounded-lg inline-flex items-center justify-center text-secondary hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
          <span className="hidden sm:inline text-muted whitespace-nowrap">{meta.section}</span>
          <span className="hidden sm:inline text-muted" aria-hidden="true">
            /
          </span>
          <span className="font-display font-semibold text-foreground whitespace-nowrap truncate">
            {meta.title}
          </span>
        </nav>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <Button
          size="sm"
          onClick={() => setCreateModalOpen(true)}
          className="hidden sm:inline-flex"
        >
          <Plus className="h-4 w-4" />
          Create New Book
        </Button>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          className="h-9 w-9 rounded-lg inline-flex items-center justify-center text-secondary hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <NotificationMenu onNavigate={onNavigate} />
        <UserProfileMenu onNavigate={onNavigate} />
      </div>
    </header>
  );
}
