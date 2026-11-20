import { useEffect } from 'react';

interface ShortcutHandlers {
  onUndo?: () => void;
  onRedo?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  onPreview?: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  onUndo,
  onRedo,
  onSave,
  onDelete,
  onPreview,
  enabled = true,
}: ShortcutHandlers) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditingField =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSave?.();
        return;
      }

      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (isEditingField) return;
        e.preventDefault();
        onUndo?.();
        return;
      }

      if ((mod && e.shiftKey && e.key.toLowerCase() === 'z') || (mod && e.key.toLowerCase() === 'y')) {
        if (isEditingField) return;
        e.preventDefault();
        onRedo?.();
        return;
      }

      if (mod && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        onPreview?.();
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditingField) {
        e.preventDefault();
        onDelete?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onDelete, onPreview, onRedo, onSave, onUndo]);
}
