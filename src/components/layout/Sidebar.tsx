import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { cn } from '../../utils/cn';
import { BrandMark, NAV_ITEMS, type NavItem } from './navigation';

interface SidebarProps {
  onNavigate: (route: NavItem['route']) => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const route = useAppStore((s) => s.route);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  const groups: Array<NavItem['group']> = ['Workspace', 'Creation', 'Publishing'];

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col shrink-0 bg-sidebar border-r border-border-subtle transition-[width] duration-200 select-none',
        collapsed ? 'w-[72px]' : 'w-[248px]'
      )}
    >
      <div
        className={cn(
          'h-16 flex items-center border-b border-border-subtle px-4',
          collapsed ? 'justify-center' : 'justify-between'
        )}
      >
        <button
          type="button"
          onClick={() => onNavigate('/dashboard')}
          className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg"
          aria-label="Go to Dashboard"
        >
          <BrandMark collapsed={collapsed} />
        </button>
        {!collapsed && (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
            className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-secondary hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Primary navigation">
        {groups.map((group) => {
          const items = NAV_ITEMS.filter((item) => item.group === group);
          return (
            <div key={group}>
              {!collapsed && (
                <p className="px-2.5 mb-1.5 text-xs font-medium text-muted">{group}</p>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = route === item.route;
                  return (
                    <button
                      key={item.route}
                      type="button"
                      title={collapsed ? item.label : undefined}
                      onClick={() => onNavigate(item.route)}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-lg px-2.5 h-10 text-sm font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap',
                        collapsed && 'justify-center px-0',
                        active
                          ? 'bg-accent/14 text-accent'
                          : 'text-secondary hover:text-foreground hover:bg-surface-hover'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {collapsed && (
        <div className="p-3 border-t border-border-subtle flex justify-center">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
            className="h-9 w-9 rounded-lg inline-flex items-center justify-center text-secondary hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      )}
    </aside>
  );
}
