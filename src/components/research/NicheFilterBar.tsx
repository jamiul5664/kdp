import { cn } from '../../utils/cn';

export type NicheFilterKey =
  | 'all'
  | 'high_demand'
  | 'low_competition'
  | 'childrens'
  | 'coloring'
  | 'activity'
  | 'puzzle'
  | 'journals';

const FILTER_OPTIONS: Array<{ key: NicheFilterKey; label: string }> = [
  { key: 'all', label: 'All Results' },
  { key: 'high_demand', label: 'High Demand' },
  { key: 'low_competition', label: 'Low Competition' },
  { key: 'childrens', label: "Children's Books" },
  { key: 'coloring', label: 'Coloring Books' },
  { key: 'activity', label: 'Activity Books' },
  { key: 'puzzle', label: 'Puzzle Books' },
  { key: 'journals', label: 'Journals' },
];

export function NicheFilterBar({
  activeFilter,
  onChange,
}: {
  activeFilter: NicheFilterKey;
  onChange: (filter: NicheFilterKey) => void;
}) {
  return (
    <div
      className="flex items-center gap-1.5 flex-wrap p-1.5 rounded-xl bg-sidebar border border-border-subtle"
      role="tablist"
      aria-label="Filter niche results"
    >
      {FILTER_OPTIONS.map((opt) => {
        const active = activeFilter === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer',
              active
                ? 'bg-accent text-white'
                : 'text-secondary hover:text-foreground hover:bg-surface-hover'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
