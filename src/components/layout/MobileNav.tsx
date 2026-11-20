import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { cn } from '../../utils/cn';
import { BrandMark, NAV_ITEMS, type NavItem } from './navigation';

export function MobileNav({ onNavigate }: { onNavigate: (route: NavItem['route']) => void }) {
  const open = useAppStore((s) => s.mobileNavOpen);
  const setOpen = useAppStore((s) => s.setMobileNavOpen);
  const route = useAppStore((s) => s.route);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const groups: Array<NavItem['group']> = ['Workspace', 'Creation', 'Publishing'];

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden flex bg-black/60 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-72 max-w-[85vw] h-full bg-sidebar border-r border-border-subtle flex flex-col">
        <div className="h-16 px-4 flex items-center justify-between border-b border-border-subtle">
          <BrandMark />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
            className="h-9 w-9 rounded-lg inline-flex items-center justify-center text-secondary hover:text-foreground hover:bg-surface-hover cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Mobile navigation">
          {groups.map((group) => (
            <div key={group}>
              <p className="px-2.5 mb-1.5 text-xs font-medium text-muted">{group}</p>
              <div className="space-y-0.5">
                {NAV_ITEMS.filter((i) => i.group === group).map((item) => {
                  const Icon = item.icon;
                  const active = route === item.route;
                  return (
                    <button
                      key={item.route}
                      type="button"
                      onClick={() => onNavigate(item.route)}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-lg px-3 h-11 text-sm font-medium transition-colors cursor-pointer',
                        active
                          ? 'bg-accent/14 text-accent'
                          : 'text-secondary hover:text-foreground hover:bg-surface-hover'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}
