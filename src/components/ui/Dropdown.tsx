import * as React from 'react';
import { cn } from '../../utils/cn';

interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  widthClass?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Dropdown({
  trigger,
  children,
  align = 'right',
  widthClass = 'w-64',
  open: controlledOpen,
  onOpenChange,
}: DropdownProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <div onClick={() => setOpen(!isOpen)}>{trigger}</div>
      {isOpen && (
        <div
          className={cn(
            'absolute top-full mt-2 z-40 rounded-xl bg-surface border border-border-strong shadow-xl py-1.5',
            align === 'right' ? 'right-0' : 'left-0',
            widthClass
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({
  className,
  children,
  onClick,
  danger,
}: {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors cursor-pointer',
        danger
          ? 'text-rose-400 hover:bg-rose-500/10'
          : 'text-foreground hover:bg-surface-hover',
        className
      )}
    >
      {children}
    </button>
  );
}
