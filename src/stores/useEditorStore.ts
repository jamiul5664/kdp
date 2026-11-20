import { create } from 'zustand';
import type {
  BookPage,
  BookSettings,
  ImageElement,
  PageBackground,
  PageElement,
  TextElement,
  TrimSizeId,
} from '../types';
import { generateId } from '../utils/format';
import { COVER_ASSETS } from './useAppStore';

export interface BookDocument {
  projectId: string;
  settings: BookSettings;
  pages: BookPage[];
}

interface HistorySnapshot {
  settings: BookSettings;
  pages: BookPage[];
}

function createInitialPages(projectId: string, title = 'Mindful Botanicals'): BookPage[] {
  const artwork =
    projectId === 'proj_forest'
      ? COVER_ASSETS.forest
      : projectId === 'proj_puzzles'
        ? COVER_ASSETS.puzzles
        : projectId === 'proj_journal'
          ? COVER_ASSETS.journal
          : COVER_ASSETS.botanicals;

  return [
    {
      id: generateId('page'),
      label: 'Title Page',
      background: { color: '#FFFFFF', pattern: 'border-frame' },
      elements: [
        {
          id: generateId('el'),
          type: 'text',
          content: title,
          x: 10,
          y: 22,
          width: 80,
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: 30,
          fontWeight: 'bold',
          fontStyle: 'normal',
          textAlign: 'center',
          color: '#111827',
          lineHeight: 1.25,
        },
        {
          id: generateId('el'),
          type: 'text',
          content: 'A Curated Amazon KDP Edition · Northstar Press',
          x: 15,
          y: 38,
          width: 70,
          fontFamily: '"DM Sans", sans-serif',
          fontSize: 13,
          fontWeight: 'normal',
          fontStyle: 'italic',
          textAlign: 'center',
          color: '#4B5563',
          lineHeight: 1.5,
        },
      ],
    },
    {
      id: generateId('page'),
      label: 'Featured Plate',
      background: { color: '#FFFFFF', pattern: 'none' },
      elements: [
        {
          id: generateId('el'),
          type: 'text',
          content: 'Plate 01 — Field Study & Composition',
          x: 10,
          y: 7,
          width: 80,
          fontFamily: '"Plus Jakarta Sans", sans-serif',
          fontSize: 15,
          fontWeight: 'bold',
          fontStyle: 'normal',
          textAlign: 'center',
          color: '#1F2937',
          lineHeight: 1.4,
        },
        {
          id: generateId('el'),
          type: 'image',
          src: artwork,
          alt: 'Interior book artwork plate',
          x: 18,
          y: 16,
          width: 64,
          height: 68,
          naturalWidth: 1536,
          naturalHeight: 2048,
          lockAspectRatio: true,
          opacity: 1,
        },
        {
          id: generateId('el'),
          type: 'text',
          content: 'High-resolution print plate preserved at native aspect ratio.',
          x: 12,
          y: 88,
          width: 76,
          fontFamily: '"Lora", Georgia, serif',
          fontSize: 11,
          fontWeight: 'normal',
          fontStyle: 'italic',
          textAlign: 'center',
          color: '#6B7280',
          lineHeight: 1.4,
        },
      ],
    },
    {
      id: generateId('page'),
      label: 'Guided Notes',
      background: { color: '#FAF9F5', pattern: 'lined' },
      elements: [
        {
          id: generateId('el'),
          type: 'text',
          content: 'Chapter Notes & Reflections',
          x: 10,
          y: 9,
          width: 80,
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: 20,
          fontWeight: 'bold',
          fontStyle: 'normal',
          textAlign: 'left',
          color: '#111827',
          lineHeight: 1.3,
        },
        {
          id: generateId('el'),
          type: 'text',
          content:
            'Use this page to record seasonal observations, favorite color palettes, or personal prompts before printing.',
          x: 10,
          y: 19,
          width: 80,
          fontFamily: '"DM Sans", sans-serif',
          fontSize: 13,
          fontWeight: 'normal',
          fontStyle: 'normal',
          textAlign: 'left',
          color: '#374151',
          lineHeight: 1.65,
        },
      ],
    },
  ];
}

function createDefaultDocument(
  projectId: string,
  title?: string,
  trimSize: TrimSizeId = '8.5x11',
  pageCount = 104
): BookDocument {
  return {
    projectId,
    settings: {
      trimSize,
      pageCount,
      interiorType: 'Black & White',
      bleed: true,
      margins: {
        top: 0.5,
        bottom: 0.5,
        inside: 0.625,
        outside: 0.5,
      },
      paperType: 'White Paper',
    },
    pages: createInitialPages(projectId, title),
  };
}

function cloneSnapshot(doc: BookDocument): HistorySnapshot {
  return {
    settings: structuredClone(doc.settings),
    pages: structuredClone(doc.pages),
  };
}

interface EditorState {
  documents: Record<string, BookDocument>;
  activeProjectId: string;
  selectedPageId: string;
  selectedElementId: string | null;
  undoStack: HistorySnapshot[];
  redoStack: HistorySnapshot[];
  hasUnsavedChanges: boolean;
  lastSavedAt: string | null;
  showGuides: boolean;
  previewOpen: boolean;

  ensureDocument: (projectId: string, title?: string, trimSize?: TrimSizeId, pageCount?: number) => void;
  hydrateGeneratedDocument: (payload: {
    projectId: string;
    trimSize: TrimSizeId;
    pageCount: number;
    paperType: 'White Paper' | 'Cream Paper';
    interiorType: 'Black & White' | 'Standard Color' | 'Premium Color';
    bleed: boolean;
    pages: Array<{ label: string; heading: string; body: string; callout?: string }>;
  }) => void;
  selectPage: (pageId: string) => void;
  selectElement: (elementId: string | null) => void;
  addPage: () => void;
  duplicatePage: (pageId: string) => void;
  deletePage: (pageId: string) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  updatePageLabel: (pageId: string, label: string) => void;
  updatePageBackground: (pageId: string, patch: Partial<PageBackground>) => void;
  addTextElement: (pageId: string) => void;
  addImageElement: (
    pageId: string,
    payload: { src: string; alt: string; naturalWidth: number; naturalHeight: number }
  ) => void;
  updateElement: (pageId: string, elementId: string, patch: Partial<TextElement> | Partial<ImageElement>) => void;
  deleteElement: (pageId: string, elementId: string) => void;
  updateBookSettings: (patch: Partial<BookSettings>) => void;
  undo: () => void;
  redo: () => void;
  saveNow: () => void;
  setShowGuides: (show: boolean) => void;
  setPreviewOpen: (open: boolean) => void;
}

const initialDoc = createDefaultDocument('proj_botanicals', 'Mindful Botanicals: Wildflower Line Art', '8.5x11', 104);

export const useEditorStore = create<EditorState>((set, get) => {
  const pushUndo = (doc: BookDocument) => {
    const stack = [...get().undoStack, cloneSnapshot(doc)].slice(-40);
    return stack;
  };

  return {
    documents: { [initialDoc.projectId]: initialDoc },
    activeProjectId: initialDoc.projectId,
    selectedPageId: initialDoc.pages[0].id,
    selectedElementId: initialDoc.pages[0].elements[0]?.id ?? null,
    undoStack: [],
    redoStack: [],
    hasUnsavedChanges: false,
    lastSavedAt: new Date().toISOString(),
    showGuides: true,
    previewOpen: false,

    ensureDocument: (projectId, title, trimSize, pageCount) => {
      const existing = get().documents[projectId];
      if (existing) {
        set({
          activeProjectId: projectId,
          selectedPageId: existing.pages[0]?.id ?? '',
          selectedElementId: existing.pages[0]?.elements[0]?.id ?? null,
          undoStack: [],
          redoStack: [],
        });
        return;
      }
      const created = createDefaultDocument(projectId, title, trimSize, pageCount);
      set((state) => ({
        documents: { ...state.documents, [projectId]: created },
        activeProjectId: projectId,
        selectedPageId: created.pages[0].id,
        selectedElementId: created.pages[0].elements[0]?.id ?? null,
        undoStack: [],
        redoStack: [],
        hasUnsavedChanges: false,
      }));
    },

    hydrateGeneratedDocument: ({
      projectId,
      trimSize,
      pageCount,
      paperType,
      interiorType,
      bleed,
      pages,
    }) => {
      const mappedPages: BookPage[] = pages.map((pg, idx) => ({
        id: generateId('page'),
        label: pg.label || `Page ${idx + 1}`,
        background: {
          color: idx === 0 ? '#FFFFFF' : '#FAF9F5',
          pattern: idx === 0 ? 'border-frame' : 'none',
        },
        elements: [
          {
            id: generateId('el'),
            type: 'text',
            content: pg.heading,
            x: 10,
            y: idx === 0 ? 22 : 9,
            width: 80,
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: idx === 0 ? 28 : 20,
            fontWeight: 'bold',
            fontStyle: 'normal',
            textAlign: idx === 0 ? 'center' : 'left',
            color: '#111827',
            lineHeight: 1.3,
          },
          {
            id: generateId('el'),
            type: 'text',
            content: pg.body,
            x: 10,
            y: idx === 0 ? 40 : 21,
            width: 80,
            fontFamily: '"DM Sans", sans-serif',
            fontSize: 13,
            fontWeight: 'normal',
            fontStyle: 'normal',
            textAlign: idx === 0 ? 'center' : 'left',
            color: '#374151',
            lineHeight: 1.6,
          },
          ...(pg.callout
            ? [
                {
                  id: generateId('el'),
                  type: 'text' as const,
                  content: pg.callout,
                  x: 10,
                  y: 84,
                  width: 80,
                  fontFamily: '"Lora", Georgia, serif',
                  fontSize: 11,
                  fontWeight: 'normal' as const,
                  fontStyle: 'italic' as const,
                  textAlign: 'left' as const,
                  color: '#4B5563',
                  lineHeight: 1.4,
                },
              ]
            : []),
        ],
      }));

      const nextDoc: BookDocument = {
        projectId,
        settings: {
          trimSize,
          pageCount: Math.max(24, pageCount),
          interiorType,
          bleed,
          margins: {
            top: 0.5,
            bottom: 0.5,
            inside: pageCount > 150 ? 0.625 : 0.5,
            outside: 0.5,
          },
          paperType,
        },
        pages: mappedPages,
      };

      set((state) => ({
        documents: { ...state.documents, [projectId]: nextDoc },
        activeProjectId: projectId,
        selectedPageId: mappedPages[0]?.id ?? '',
        selectedElementId: mappedPages[0]?.elements[0]?.id ?? null,
        undoStack: [],
        redoStack: [],
        hasUnsavedChanges: false,
        lastSavedAt: new Date().toISOString(),
      }));
    },

    selectPage: (pageId) => {
      const doc = get().documents[get().activeProjectId];
      const page = doc?.pages.find((p) => p.id === pageId);
      set({
        selectedPageId: pageId,
        selectedElementId: page?.elements[0]?.id ?? null,
      });
    },

    selectElement: (elementId) => set({ selectedElementId: elementId }),

    addPage: () => {
      const doc = get().documents[get().activeProjectId];
      if (!doc) return;
      const newPage: BookPage = {
        id: generateId('page'),
        label: `Page ${doc.pages.length + 1}`,
        background: { color: '#FFFFFF', pattern: 'none' },
        elements: [
          {
            id: generateId('el'),
            type: 'text',
            content: `Section ${doc.pages.length + 1}`,
            x: 12,
            y: 12,
            width: 76,
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: 18,
            fontWeight: 'bold',
            fontStyle: 'normal',
            textAlign: 'left',
            color: '#111827',
            lineHeight: 1.4,
          },
        ],
      };
      const undoStack = pushUndo(doc);
      set((state) => ({
        undoStack,
        redoStack: [],
        hasUnsavedChanges: true,
        selectedPageId: newPage.id,
        selectedElementId: newPage.elements[0].id,
        documents: {
          ...state.documents,
          [doc.projectId]: {
            ...doc,
            pages: [...doc.pages, newPage],
            settings: { ...doc.settings, pageCount: Math.max(doc.settings.pageCount, doc.pages.length + 1) },
          },
        },
      }));
    },

    duplicatePage: (pageId) => {
      const doc = get().documents[get().activeProjectId];
      if (!doc) return;
      const idx = doc.pages.findIndex((p) => p.id === pageId);
      if (idx === -1) return;
      const source = doc.pages[idx];
      const cloned: BookPage = {
        id: generateId('page'),
        label: `${source.label} (Copy)`,
        background: { ...source.background },
        elements: source.elements.map((el) => ({ ...structuredClone(el), id: generateId('el') })),
      };
      const pages = [...doc.pages];
      pages.splice(idx + 1, 0, cloned);
      const undoStack = pushUndo(doc);
      set((state) => ({
        undoStack,
        redoStack: [],
        hasUnsavedChanges: true,
        selectedPageId: cloned.id,
        selectedElementId: cloned.elements[0]?.id ?? null,
        documents: {
          ...state.documents,
          [doc.projectId]: { ...doc, pages },
        },
      }));
    },

    deletePage: (pageId) => {
      const doc = get().documents[get().activeProjectId];
      if (!doc || doc.pages.length <= 1) return;
      const idx = doc.pages.findIndex((p) => p.id === pageId);
      if (idx === -1) return;
      const pages = doc.pages.filter((p) => p.id !== pageId);
      const nextSelected = pages[Math.max(0, idx - 1)];
      const undoStack = pushUndo(doc);
      set((state) => ({
        undoStack,
        redoStack: [],
        hasUnsavedChanges: true,
        selectedPageId: nextSelected.id,
        selectedElementId: nextSelected.elements[0]?.id ?? null,
        documents: {
          ...state.documents,
          [doc.projectId]: { ...doc, pages },
        },
      }));
    },

    reorderPages: (fromIndex, toIndex) => {
      const doc = get().documents[get().activeProjectId];
      if (!doc) return;
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= doc.pages.length ||
        toIndex >= doc.pages.length
      ) {
        return;
      }
      const pages = [...doc.pages];
      const [moved] = pages.splice(fromIndex, 1);
      pages.splice(toIndex, 0, moved);
      const undoStack = pushUndo(doc);
      set((state) => ({
        undoStack,
        redoStack: [],
        hasUnsavedChanges: true,
        documents: {
          ...state.documents,
          [doc.projectId]: { ...doc, pages },
        },
      }));
    },

    updatePageLabel: (pageId, label) => {
      const doc = get().documents[get().activeProjectId];
      if (!doc) return;
      const undoStack = pushUndo(doc);
      set((state) => ({
        undoStack,
        redoStack: [],
        hasUnsavedChanges: true,
        documents: {
          ...state.documents,
          [doc.projectId]: {
            ...doc,
            pages: doc.pages.map((p) => (p.id === pageId ? { ...p, label } : p)),
          },
        },
      }));
    },

    updatePageBackground: (pageId, patch) => {
      const doc = get().documents[get().activeProjectId];
      if (!doc) return;
      const undoStack = pushUndo(doc);
      set((state) => ({
        undoStack,
        redoStack: [],
        hasUnsavedChanges: true,
        documents: {
          ...state.documents,
          [doc.projectId]: {
            ...doc,
            pages: doc.pages.map((p) =>
              p.id === pageId ? { ...p, background: { ...p.background, ...patch } } : p
            ),
          },
        },
      }));
    },

    addTextElement: (pageId) => {
      const doc = get().documents[get().activeProjectId];
      if (!doc) return;
      const newEl: TextElement = {
        id: generateId('el'),
        type: 'text',
        content: 'New editable text block',
        x: 14,
        y: 44,
        width: 72,
        fontFamily: '"DM Sans", sans-serif',
        fontSize: 14,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'left',
        color: '#111827',
        lineHeight: 1.5,
      };
      const undoStack = pushUndo(doc);
      set((state) => ({
        undoStack,
        redoStack: [],
        hasUnsavedChanges: true,
        selectedElementId: newEl.id,
        documents: {
          ...state.documents,
          [doc.projectId]: {
            ...doc,
            pages: doc.pages.map((p) =>
              p.id === pageId ? { ...p, elements: [...p.elements, newEl] } : p
            ),
          },
        },
      }));
    },

    addImageElement: (pageId, { src, alt, naturalWidth, naturalHeight }) => {
      const doc = get().documents[get().activeProjectId];
      if (!doc) return;
      const ratio = naturalWidth > 0 && naturalHeight > 0 ? naturalHeight / naturalWidth : 1.25;
      const widthPct = 56;
      const heightPct = Math.min(72, Math.max(20, Math.round(widthPct * ratio * 0.78)));
      const newImg: ImageElement = {
        id: generateId('el'),
        type: 'image',
        src,
        alt,
        x: 22,
        y: 18,
        width: widthPct,
        height: heightPct,
        naturalWidth,
        naturalHeight,
        lockAspectRatio: true,
        opacity: 1,
      };
      const undoStack = pushUndo(doc);
      set((state) => ({
        undoStack,
        redoStack: [],
        hasUnsavedChanges: true,
        selectedElementId: newImg.id,
        documents: {
          ...state.documents,
          [doc.projectId]: {
            ...doc,
            pages: doc.pages.map((p) =>
              p.id === pageId ? { ...p, elements: [...p.elements, newImg] } : p
            ),
          },
        },
      }));
    },

    updateElement: (pageId, elementId, patch) => {
      const doc = get().documents[get().activeProjectId];
      if (!doc) return;
      const undoStack = pushUndo(doc);
      set((state) => ({
        undoStack,
        redoStack: [],
        hasUnsavedChanges: true,
        documents: {
          ...state.documents,
          [doc.projectId]: {
            ...doc,
            pages: doc.pages.map((p) =>
              p.id !== pageId
                ? p
                : {
                    ...p,
                    elements: p.elements.map((el) =>
                      el.id === elementId ? ({ ...el, ...patch } as PageElement) : el
                    ),
                  }
            ),
          },
        },
      }));
    },

    deleteElement: (pageId, elementId) => {
      const doc = get().documents[get().activeProjectId];
      if (!doc) return;
      const undoStack = pushUndo(doc);
      set((state) => ({
        undoStack,
        redoStack: [],
        hasUnsavedChanges: true,
        selectedElementId: state.selectedElementId === elementId ? null : state.selectedElementId,
        documents: {
          ...state.documents,
          [doc.projectId]: {
            ...doc,
            pages: doc.pages.map((p) =>
              p.id !== pageId
                ? p
                : { ...p, elements: p.elements.filter((el) => el.id !== elementId) }
            ),
          },
        },
      }));
    },

    updateBookSettings: (patch) => {
      const doc = get().documents[get().activeProjectId];
      if (!doc) return;
      const undoStack = pushUndo(doc);
      set((state) => ({
        undoStack,
        redoStack: [],
        hasUnsavedChanges: true,
        documents: {
          ...state.documents,
          [doc.projectId]: {
            ...doc,
            settings: {
              ...doc.settings,
              ...patch,
              margins: patch.margins ? { ...doc.settings.margins, ...patch.margins } : doc.settings.margins,
            },
          },
        },
      }));
    },

    undo: () => {
      const { undoStack, redoStack, activeProjectId, documents } = get();
      const doc = documents[activeProjectId];
      if (!doc || undoStack.length === 0) return;
      const previous = undoStack[undoStack.length - 1];
      set({
        undoStack: undoStack.slice(0, -1),
        redoStack: [...redoStack, cloneSnapshot(doc)].slice(-40),
        hasUnsavedChanges: true,
        documents: {
          ...documents,
          [activeProjectId]: {
            ...doc,
            settings: previous.settings,
            pages: previous.pages,
          },
        },
        selectedPageId: previous.pages[0]?.id ?? '',
      });
    },

    redo: () => {
      const { undoStack, redoStack, activeProjectId, documents } = get();
      const doc = documents[activeProjectId];
      if (!doc || redoStack.length === 0) return;
      const next = redoStack[redoStack.length - 1];
      set({
        redoStack: redoStack.slice(0, -1),
        undoStack: [...undoStack, cloneSnapshot(doc)].slice(-40),
        hasUnsavedChanges: true,
        documents: {
          ...documents,
          [activeProjectId]: {
            ...doc,
            settings: next.settings,
            pages: next.pages,
          },
        },
        selectedPageId: next.pages[0]?.id ?? '',
      });
    },

    saveNow: () => {
      const { activeProjectId, documents } = get();
      const doc = documents[activeProjectId];
      if (doc && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(`kdp_book_${activeProjectId}`, JSON.stringify(doc));
        } catch {
          // Ignore storage quota warnings on large base64 images
        }
      }
      set({ hasUnsavedChanges: false, lastSavedAt: new Date().toISOString() });
    },

    setShowGuides: (show) => set({ showGuides: show }),
    setPreviewOpen: (open) => set({ previewOpen: open }),
  };
});
