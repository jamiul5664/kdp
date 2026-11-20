import * as React from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useTheme } from '../../hooks/useTheme';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { MobileNav } from './MobileNav';
import { CreateBookModal } from '../books/CreateBookModal';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { AppRoute } from '../../types';

export function AppShell({ children }: { children: React.ReactNode }) {
  useTheme();
  const route = useAppStore((s) => s.route);
  const setRoute = useAppStore((s) => s.setRoute);
  const hasUnsavedChanges = useEditorStore((s) => s.hasUnsavedChanges);
  const saveNow = useEditorStore((s) => s.saveNow);

  const [pendingRoute, setPendingRoute] = React.useState<AppRoute | null>(null);

  const handleNavigate = (target: AppRoute) => {
    if (route === '/editor' && target !== '/editor' && hasUnsavedChanges) {
      setPendingRoute(target);
      return;
    }
    setRoute(target);
  };

  if (route === '/login' || route === '/register') {
    return <div className="min-h-screen bg-canvas text-foreground">{children}</div>;
  }

  return (
    <div className="min-h-screen h-screen flex overflow-hidden bg-canvas text-foreground">
      <Sidebar onNavigate={handleNavigate} />
      <MobileNav onNavigate={handleNavigate} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav onNavigate={handleNavigate} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      <CreateBookModal />

      <Modal
        open={pendingRoute !== null}
        onClose={() => setPendingRoute(null)}
        title="Unsaved manuscript changes"
        description="Your current Book Editor draft has edits that have not been saved yet."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingRoute(null)}>
              Stay in Editor
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const target = pendingRoute;
                setPendingRoute(null);
                if (target) setRoute(target);
              }}
            >
              Leave Without Saving
            </Button>
            <Button
              onClick={() => {
                saveNow();
                const target = pendingRoute;
                setPendingRoute(null);
                if (target) setRoute(target);
              }}
            >
              Save & Continue
            </Button>
          </>
        }
      >
        <p className="text-sm text-secondary">
          Save your manuscript pages now to preserve all text blocks, images, and KDP trim settings
          before switching views.
        </p>
      </Modal>
    </div>
  );
}
