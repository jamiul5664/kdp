import * as React from 'react';
import { BookOpen } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-border-strong bg-surface/50 px-6 py-12',
        className
      )}
    >
      <div className="h-11 w-11 rounded-xl bg-elevated border border-border-subtle flex items-center justify-center text-accent mb-4">
        {icon ?? <BookOpen className="h-5 w-5" />}
      </div>
      <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-secondary mt-1.5 max-w-md">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-5">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
