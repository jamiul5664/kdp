import * as React from 'react';
import {
  CheckCircle2,
  Eye,
  Grid3X3,
  Redo2,
  Save,
  Undo2,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useUnsavedWarning } from '../../hooks/useUnsavedWarning';
import { formatTimeRelative } from '../../utils/format';
import { PageThumbnailPanel } from '../../components/editor/PageThumbnailPanel';
import { BookCanvas } from '../../components/editor/BookCanvas';
import { PropertiesPanel } from '../../components/editor/PropertiesPanel';
import { BookPreviewModal } from '../../components/editor/BookPreviewModal';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Input';

export default function EditorPage() {
  const projects = useAppStore((s) => s.projects);
  const activeAppProjectId = useAppStore((s) => s.activeProjectId);
  const setActiveAppProjectId = useAppStore((s) => s.setActiveProjectId);

  const documents = useEditorStore((s) => s.documents);
  const editorProjectId = useEditorStore((s) => s.activeProjectId);
  const selectedPageId = useEditorStore((s) => s.selectedPageId);
  const selectedElementId = useEditorStore((s) => s.selectedElementId);
  const undoStack = useEditorStore((s) => s.undoStack);
  const redoStack = useEditorStore((s) => s.redoStack);
  const hasUnsavedChanges = useEditorStore((s) => s.hasUnsavedChanges);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const showGuides = useEditorStore((s) => s.showGuides);
  const previewOpen = useEditorStore((s) => s.previewOpen);

  const ensureDocument = useEditorStore((s) => s.ensureDocument);
  const selectPage = useEditorStore((s) => s.selectPage);
  const selectElement = useEditorStore((s) => s.selectElement);
  const addPage = useEditorStore((s) => s.addPage);
  const duplicatePage = useEditorStore((s) => s.duplicatePage);
  const deletePage = useEditorStore((s) => s.deletePage);
  const reorderPages = useEditorStore((s) => s.reorderPages);
  const updatePageLabel = useEditorStore((s) => s.updatePageLabel);
  const updatePageBackground = useEditorStore((s) => s.updatePageBackground);
  const addTextElement = useEditorStore((s) => s.addTextElement);
  const addImageElement = useEditorStore((s) => s.addImageElement);
  const updateElement = useEditorStore((s) => s.updateElement);
  const deleteElement = useEditorStore((s) => s.deleteElement);
  const updateBookSettings = useEditorStore((s) => s.updateBookSettings);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const saveNow = useEditorStore((s) => s.saveNow);
  const setShowGuides = useEditorStore((s) => s.setShowGuides);
  const setPreviewOpen = useEditorStore((s) => s.setPreviewOpen);

  React.useEffect(() => {
    const project = projects.find((p) => p.id === activeAppProjectId) ?? projects[0];
    if (project && editorProjectId !== project.id) {
      ensureDocument(project.id, project.title, project.trimSize, project.pageCount);
    }
  }, [activeAppProjectId, editorProjectId, ensureDocument, projects]);

  const doc = documents[editorProjectId] ?? Object.values(documents)[0];
  const currentProject =
    projects.find((p) => p.id === doc?.projectId) ?? projects[0];
  const currentPageIndex = Math.max(
    0,
    doc.pages.findIndex((p) => p.id === selectedPageId)
  );
  const currentPage = doc.pages[currentPageIndex] ?? doc.pages[0];

  useAutoSave(hasUnsavedChanges, saveNow, 4000);
  useUnsavedWarning(hasUnsavedChanges);
  useKeyboardShortcuts({
    onUndo: undo,
    onRedo: redo,
    onSave: saveNow,
    onPreview: () => setPreviewOpen(true),
    onDelete: () => {
      if (selectedElementId && currentPage) {
        deleteElement(currentPage.id, selectedElementId);
      }
    },
    enabled: !previewOpen,
  });

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Editor Top Toolbar */}
      <div className="px-4 py-2.5 border-b border-border-subtle bg-sidebar flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Select
            aria-label="Select active book project"
            value={currentProject?.id ?? ''}
            onChange={(e) => {
              const target = projects.find((p) => p.id === e.target.value);
              if (target) {
                setActiveAppProjectId(target.id);
                ensureDocument(target.id, target.title, target.trimSize, target.pageCount);
              }
            }}
            className="h-8 text-xs max-w-[240px]"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>

          <span className="hidden xl:inline text-xs font-mono-tabular text-muted whitespace-nowrap">
            {hasUnsavedChanges ? (
              <span className="text-amber-400">Unsaved edits · Auto-saves in 4s</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-teal">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Saved {lastSavedAt ? formatTimeRelative(lastSavedAt) : 'now'}
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant="ghost"
            onClick={undo}
            disabled={undoStack.length === 0}
            title="Undo (Ctrl/Cmd+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Undo
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={redo}
            disabled={redoStack.length === 0}
            title="Redo (Ctrl/Cmd+Shift+Z)"
          >
            <Redo2 className="h-3.5 w-3.5" />
            Redo
          </Button>
          <Button
            size="sm"
            variant={showGuides ? 'secondary' : 'ghost'}
            onClick={() => setShowGuides(!showGuides)}
          >
            <Grid3X3 className="h-3.5 w-3.5" />
            Guides
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-3.5 w-3.5" />
            Preview Book
          </Button>
          <Button size="sm" variant="primary" onClick={saveNow} title="Save (Ctrl/Cmd+S)">
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </div>

      {/* 3-Panel Professional Book Editor Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <PageThumbnailPanel
          pages={doc.pages}
          selectedPageId={currentPage.id}
          trimSize={doc.settings.trimSize}
          onSelect={selectPage}
          onAdd={addPage}
          onDuplicate={duplicatePage}
          onDelete={deletePage}
          onReorder={reorderPages}
        />

        <BookCanvas
          page={currentPage}
          pageNumber={currentPageIndex + 1}
          settings={doc.settings}
          selectedElementId={selectedElementId}
          showGuides={showGuides}
          onSelectElement={selectElement}
          onUpdateElement={(elId, patch) => updateElement(currentPage.id, elId, patch)}
        />

        <PropertiesPanel
          page={currentPage}
          settings={doc.settings}
          selectedElementId={selectedElementId}
          onUpdatePageLabel={(label) => updatePageLabel(currentPage.id, label)}
          onUpdatePageBackground={(patch) => updatePageBackground(currentPage.id, patch)}
          onAddText={() => addTextElement(currentPage.id)}
          onAddImage={(payload) => addImageElement(currentPage.id, payload)}
          onUpdateElement={(elId, patch) => updateElement(currentPage.id, elId, patch)}
          onDeleteElement={(elId) => deleteElement(currentPage.id, elId)}
          onUpdateSettings={updateBookSettings}
        />
      </div>

      <BookPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={currentProject?.title || 'Untitled Book'}
        pages={doc.pages}
        settings={doc.settings}
      />
    </div>
  );
}
