import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidthClass = 'max-w-lg',
}: ModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          'w-full rounded-xl bg-surface border border-border-strong shadow-2xl overflow-hidden',
          maxWidthClass
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border-subtle">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
            {description && <p className="text-sm text-secondary mt-0.5">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-secondary hover:text-foreground hover:bg-surface-hover transition-colors shrink-0 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5 max-h-[75vh] overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-subtle bg-sidebar/60">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
