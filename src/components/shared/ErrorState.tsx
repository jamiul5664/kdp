import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Unable to complete request',
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-xl border border-rose-500/30 bg-rose-500/5 px-5 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-display text-sm font-semibold text-foreground">{title}</h4>
          <p className="text-sm text-secondary mt-0.5">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}
