import { useEffect } from 'react';

export function useAutoSave(hasUnsavedChanges: boolean, onSave: () => void, delayMs = 3500) {
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const timer = window.setTimeout(() => {
      onSave();
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [hasUnsavedChanges, onSave, delayMs]);
}
