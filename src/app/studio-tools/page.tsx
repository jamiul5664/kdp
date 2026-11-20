import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  GitBranch,
  Layers,
  Lock,
  Maximize2,
  Minimize2,
  Palette,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Unlock,
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { useEditorStore } from '../../stores/useEditorStore';
import {
  auditPagesAgainstStyleProfile,
  getTrimAspectRatio,
  useAdvancedStudioStore,
  type BatchGeneratedPage,
} from '../../stores/useAdvancedStudioStore';
import { requestBackendExport } from '../../services/studioService';
import { calculateFullCoverSpec } from '../../utils/kdpDimensions';
import type { BookPage } from '../../types';
import { generateId } from '../../utils/format';

type StudioTab = 'flipbook' | 'templates' | 'consistency' | 'batch' | 'workflows';

function FlipPageSurface({ page, pageNumber }: { page: BookPage; pageNumber: number }) {
  const patternStyle =
    page.background.pattern === 'lined'
      ? { backgroundImage: 'repeating-linear-gradient(transparent, transparent 22px, rgba(0,0,0,0.08) 23px)' }
      : page.background.pattern === 'dot-grid'
        ? { backgroundImage: 'radial-gradient(rgba(0,0,0,0.14) 1px, transparent 1px)', backgroundSize: '14px 14px' }
        : undefined;

  return (
    <div
      className="relative w-full h-full overflow-hidden shadow-md border border-black/15"
      style={{ backgroundColor: page.background.color || '#FFFFFF', ...patternStyle }}
    >
      {page.background.pattern === 'border-frame' && (
        <div className="pointer-events-none absolute inset-4 border border-black/20" />
      )}
      {page.elements.map((el) =>
        el.type === 'text' ? (
          <div
            key={el.id}
            className="absolute overflow-hidden whitespace-pre-wrap"
            style={{
              left: `${el.x}%`,
              top: `${el.y}%`,
              width: `${el.width}%`,
              fontFamily: el.fontFamily,
              fontSize: `${Math.max(9, Math.round(el.fontSize * 0.72))}px`,
              fontWeight: el.fontWeight,
              fontStyle: el.fontStyle,
              textAlign: el.textAlign,
              color: el.color,
              lineHeight: el.lineHeight,
            }}
          >
            {el.content}
          </div>
        ) : (
          <img
            key={el.id}
            src={el.src}
            alt={el.alt}
            loading="lazy"
            className="absolute object-contain"
            style={{
              left: `${el.x}%`,
              top: `${el.y}%`,
              width: `${el.width}%`,
              height: `${el.height}%`,
              opacity: el.opacity,
            }}
          />
        )
      )}
      <div className="absolute bottom-2 inset-x-0 text-center text-[10px] font-mono-tabular text-zinc-500">
        {pageNumber}
      </div>
    </div>
  );
}

export default function StudioToolsPage() {
  const [activeTab, setActiveTab] = useState<StudioTab>('flipbook');
  const { projects, activeProjectId, setActiveProjectId, setRoute, addActivity } = useAppStore();
  const { documents, ensureDocument, hydrateGeneratedDocument } = useEditorStore();
  const {
    styleProfiles,
    updateStyleProfile,
    toggleApprovedPageLock,
    batchJobs,
    createBatchFromOutline,
    setBatchJobStatus,
    updateBatchPage,
    regenerateBatchPage,
    retryFailedBatchPages,
    templates,
    saveCustomTemplate,
    duplicateTemplate,
    workflows,
    createWorkflow,
    pauseWorkflow,
    resumeWorkflow,
    cancelWorkflow,
    approveWorkflowStep,
    retryWorkflowStep,
    simulateStepFailure,
    recoverInterruptedWorkflow,
  } = useAdvancedStudioStore();

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];
  useEffect(() => {
    if (activeProject) {
      ensureDocument(activeProject.id, activeProject.title, activeProject.trimSize, activeProject.pageCount);
    }
  }, [activeProject, ensureDocument]);

  const doc = documents[activeProject?.id || ''];
  const pages = doc?.pages ?? [];
  const aspectRatio = getTrimAspectRatio(doc?.settings.trimSize || '8.5x11');

  // Flipbook state
  const [spreadMode, setSpreadMode] = useState<'single' | 'double'>('double');
  const [showCoverFirst, setShowCoverFirst] = useState(true);
  const [flipIndex, setFlipIndex] = useState(0); // 0 = cover if showCoverFirst else page 0
  const [turningDir, setTurningDir] = useState<'next' | 'prev' | null>(null);
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exportingPreview, setExportingPreview] = useState(false);
  const flipContainerRef = useRef<HTMLDivElement>(null);

  // Template Library state
  const [tplCategory, setTplCategory] = useState('All');
  const [selectedTplId, setSelectedTplId] = useState(templates[0]?.templateId || '');
  const [customTplName, setCustomTplName] = useState('');
  const selectedTemplate = templates.find((t) => t.templateId === selectedTplId) ?? templates[0];

  // Style Profile editor draft
  const profile = styleProfiles[activeProject?.id || ''] ?? styleProfiles.proj_botanicals;
  const [draftArtStyle, setDraftArtStyle] = useState(profile.artStyle);
  const [draftLineWeight, setDraftLineWeight] = useState(profile.lineWeight);
  const [draftTone, setDraftTone] = useState(profile.writingTone);
  const [draftAudience, setDraftAudience] = useState(profile.targetAudience);
  const [draftBgMemory, setDraftBgMemory] = useState(profile.backgroundStyleMemory);
  const [draftCharName, setDraftCharName] = useState('');
  const [draftCharTraits, setDraftCharTraits] = useState('');

  useEffect(() => {
    setDraftArtStyle(profile.artStyle);
    setDraftLineWeight(profile.lineWeight);
    setDraftTone(profile.writingTone);
    setDraftAudience(profile.targetAudience);
    setDraftBgMemory(profile.backgroundStyleMemory);
  }, [profile.projectId, profile.version]);

  // Batch generation outline
  const [outlineText, setOutlineText] = useState(
    'Title Page | Clean editorial title composition\nColor Swatch & Bleed Test | 12 marker test boxes\nPlate 01: Meadow Fern | Single-sided botanical wildflower frame\nPlate 02: Chamomile Cluster | Open white space ink line-art\nPlate 03: Pine Cone & Cedar | Crisp symmetrical autumn leaves\nBack Matter & Notes | Reader reflection and series preview'
  );
  const activeBatch = batchJobs[activeProject?.id || ''];

  // Workflow creator
  const [wfTitle, setWfTitle] = useState(activeProject?.title || 'New KDP Book Workflow');
  const [wfMessage, setWfMessage] = useState<string | null>(null);

  const totalFlipItems = (showCoverFirst ? 1 : 0) + pages.length;
  const maxFlipIndex = Math.max(0, totalFlipItems - 1);

  const triggerFlip = (dir: 'next' | 'prev') => {
    const step = spreadMode === 'double' && !(showCoverFirst && flipIndex === 0) ? 2 : 1;
    const nextIdx =
      dir === 'next' ? Math.min(maxFlipIndex, flipIndex + step) : Math.max(0, flipIndex - step);
    if (nextIdx === flipIndex) return;
    setTurningDir(dir);
    window.setTimeout(() => {
      setFlipIndex(nextIdx);
      setTurningDir(null);
    }, 220);
  };

  const handleToggleFullscreen = async () => {
    if (!document.fullscreenElement && flipContainerRef.current) {
      await flipContainerRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else if (document.fullscreenElement) {
      await document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const handleDownloadPreviewPdf = async () => {
    if (!activeProject || !doc) return;
    setExportingPreview(true);
    try {
      const coverSpec = calculateFullCoverSpec({
        trimSize: doc.settings.trimSize,
        pageCount: doc.settings.pageCount,
        paperType: doc.settings.paperType,
        interiorType: doc.settings.interiorType,
        bleed: doc.settings.bleed,
      });
      const res = await requestBackendExport({
        projectId: activeProject.id,
        projectTitle: activeProject.title,
        subtitle: activeProject.subtitle,
        author: activeProject.author,
        trimSize: doc.settings.trimSize,
        artifactType: 'interior_pdf',
        settings: doc.settings,
        pages: doc.pages,
        coverSpec,
      });
      const a = document.createElement('a');
      a.href = res.downloadUrl;
      a.download = res.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setExportingPreview(false);
    }
  };

  const consistencyAudit = useMemo(
    () => auditPagesAgainstStyleProfile(pages, profile),
    [pages, profile]
  );

  const duplicatePageWarnings = useMemo(() => {
    const seen = new Map<string, number>();
    const dupes: Array<{ pageA: number; pageB: number }> = [];
    pages.forEach((p, idx) => {
      const sig = p.elements
        .map((e) => (e.type === 'text' ? e.content.trim().toLowerCase() : e.src))
        .join('|');
      if (sig.length > 10 && seen.has(sig)) {
        dupes.push({ pageA: seen.get(sig)! + 1, pageB: idx + 1 });
      } else {
        seen.set(sig, idx);
      }
    });
    return dupes;
  }, [pages]);

  const handleGenerateBatch = () => {
    if (!activeProject) return;
    const items = outlineText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, idx) => {
        const [title, prompt] = line.split('|').map((s) => s.trim());
        const pageType: BatchGeneratedPage['pageType'] =
          idx === 0 ? 'Title' : line.toLowerCase().includes('plate') ? 'Activity / Plate' : 'Story / Content';
        return {
          title: title || `Page ${idx + 1}`,
          pageType,
          prompt: prompt || `Original KDP illustration matching ${profile.artStyle}`,
        };
      });
    createBatchFromOutline(activeProject.id, items);
  };

  const handleCommitApprovedBatch = () => {
    if (!activeProject || !activeBatch) return;
    const approvedPages = activeBatch.pages.filter((p) => p.approvalStatus === 'Approved');
    if (approvedPages.length === 0) return;
    hydrateGeneratedDocument({
      projectId: activeProject.id,
      trimSize: doc?.settings.trimSize || activeProject.trimSize,
      pageCount: Math.max(24, approvedPages.length * 4),
      paperType: doc?.settings.paperType || 'White Paper',
      interiorType: doc?.settings.interiorType || 'Black & White',
      bleed: doc?.settings.bleed ?? true,
      pages: approvedPages.map((p) => ({
        label: p.title,
        heading: p.title,
        body: p.content,
        callout: `Batch v${p.versionNumber} · Prompt: ${p.illustrationPrompt.slice(0, 90)}`,
      })),
    });
    setBatchJobStatus(activeProject.id, 'Completed');
    addActivity({
      title: `Committed ${approvedPages.length} approved batch pages`,
      description: `Synced approved batch output into ${activeProject.title} Book Editor.`,
      category: 'editor',
      projectId: activeProject.id,
    });
    setRoute('/editor');
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-border-subtle pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Production Studio Suite
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground">
            Flipbook, Templates, Consistency, Batch & Workflows
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Preview print layouts without altering original assets, enforce global style profiles, run rate-limited batch generation, and orchestrate durable approval workflows.
          </p>
        </div>
        <select
          value={activeProject?.id || ''}
          onChange={(e) => setActiveProjectId(e.target.value)}
          className="h-9 rounded-lg border border-border-subtle bg-surface px-3 text-xs font-medium text-foreground"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} ({p.trimSize})
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border-subtle pb-px">
        {[
          { id: 'flipbook' as const, label: 'Book Flipbook Preview', icon: BookOpen },
          { id: 'templates' as const, label: 'KDP Template Library', icon: Layers },
          { id: 'consistency' as const, label: 'Book Consistency Engine', icon: Palette },
          { id: 'batch' as const, label: 'Batch Page Generation', icon: Sparkles },
          { id: 'workflows' as const, label: 'AI Workflow Automation', icon: GitBranch },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs font-medium transition-colors ${
                active ? 'border-accent text-foreground' : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 1. BOOK FLIPBOOK PREVIEW */}
      {activeTab === 'flipbook' && (
        <div
          ref={flipContainerRef}
          className={`rounded-xl border border-border-subtle bg-surface p-5 space-y-4 ${
            isFullscreen ? 'fixed inset-0 z-50 overflow-auto rounded-none' : ''
          }`}
        >
          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSpreadMode('single')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium border ${
                  spreadMode === 'single'
                    ? 'border-accent bg-accent/15 text-foreground'
                    : 'border-border-subtle text-muted hover:text-foreground'
                }`}
              >
                Single Page
              </button>
              <button
                type="button"
                onClick={() => setSpreadMode('double')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium border ${
                  spreadMode === 'double'
                    ? 'border-accent bg-accent/15 text-foreground'
                    : 'border-border-subtle text-muted hover:text-foreground'
                }`}
              >
                Double Spread
              </button>
              <label className="ml-2 inline-flex items-center gap-1.5 text-xs text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCoverFirst}
                  onChange={(e) => {
                    setShowCoverFirst(e.target.checked);
                    setFlipIndex(0);
                  }}
                />
                Include Cover Preview
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(60, z - 15))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle text-secondary hover:text-foreground"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="font-mono-tabular text-xs text-foreground w-10 text-center">{zoom}%</span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(160, z + 15))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle text-secondary hover:text-foreground"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-subtle px-2.5 text-xs text-secondary hover:text-foreground"
              >
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                {isFullscreen ? 'Exit' : 'Fullscreen'}
              </button>
              <button
                type="button"
                disabled={exportingPreview}
                onClick={handleDownloadPreviewPdf}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                {exportingPreview ? 'Building PDF...' : 'Download Preview PDF'}
              </button>
            </div>
          </div>

          {/* 3D Stage */}
          <div className="relative flex items-center justify-center rounded-xl bg-canvas/80 py-8 px-4 min-h-[460px] overflow-x-auto">
            <button
              type="button"
              disabled={flipIndex === 0}
              onClick={() => triggerFlip('prev')}
              className="mr-4 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface text-foreground hover:border-accent disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div
              className="flex items-center justify-center transition-transform duration-300"
              style={{
                perspective: '1600px',
                transform: `scale(${zoom / 100})`,
              }}
            >
              {showCoverFirst && flipIndex === 0 ? (
                <div
                  className="relative overflow-hidden rounded-r-md shadow-2xl border border-white/10 transition-transform duration-300"
                  style={{
                    width: `${Math.round(320 * aspectRatio)}px`,
                    height: '380px',
                    transform: turningDir === 'next' ? 'rotateY(-22deg)' : 'rotateY(0deg)',
                  }}
                >
                  <img
                    src={activeProject?.thumbnail}
                    alt={activeProject?.title}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent p-5 flex flex-col justify-end">
                    <span className="text-[10px] uppercase tracking-widest text-white/80">Front Cover Preview</span>
                    <h3 className="mt-1 font-display text-lg font-bold text-white leading-tight">{activeProject?.title}</h3>
                    <p className="mt-1 text-xs text-white/80">{activeProject?.author}</p>
                  </div>
                </div>
              ) : (() => {
                const startPageIdx = showCoverFirst ? flipIndex - 1 : flipIndex;
                const leftPage = pages[startPageIdx];
                const rightPage = spreadMode === 'double' ? pages[startPageIdx + 1] : undefined;
                const pageW = Math.round(330 * aspectRatio);

                return (
                  <div className="flex items-stretch shadow-2xl">
                    {leftPage && (
                      <div
                        className="transition-transform duration-300 origin-right"
                        style={{
                          width: `${pageW}px`,
                          height: '380px',
                          transform: turningDir === 'prev' ? 'rotateY(18deg)' : 'rotateY(0deg)',
                        }}
                      >
                        <FlipPageSurface page={leftPage} pageNumber={startPageIdx + 1} />
                      </div>
                    )}
                    {spreadMode === 'double' && (
                      <div className="w-px bg-black/25 shadow-inner" />
                    )}
                    {rightPage && (
                      <div
                        className="transition-transform duration-300 origin-left"
                        style={{
                          width: `${pageW}px`,
                          height: '380px',
                          transform: turningDir === 'next' ? 'rotateY(-18deg)' : 'rotateY(0deg)',
                        }}
                      >
                        <FlipPageSurface page={rightPage} pageNumber={startPageIdx + 2} />
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <button
              type="button"
              disabled={flipIndex >= maxFlipIndex}
              onClick={() => triggerFlip('next')}
              className="ml-4 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface text-foreground hover:border-accent disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Page Indicator & Thumbnail Navigation Strip */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>
                {showCoverFirst && flipIndex === 0
                  ? 'Front Cover'
                  : `Page ${(showCoverFirst ? flipIndex : flipIndex + 1)} of ${pages.length} · Trim ${doc?.settings.trimSize}"`}
              </span>
              <span>Read-only optimized preview · Original print-ready assets remain unmodified.</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {showCoverFirst && (
                <button
                  type="button"
                  onClick={() => setFlipIndex(0)}
                  className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-medium ${
                    flipIndex === 0 ? 'border-accent bg-accent/15 text-foreground' : 'border-border-subtle bg-canvas text-muted'
                  }`}
                >
                  Cover
                </button>
              )}
              {pages.map((p, idx) => {
                const targetIdx = showCoverFirst ? idx + 1 : idx;
                const active = flipIndex === targetIdx;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setFlipIndex(targetIdx)}
                    className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-mono-tabular ${
                      active ? 'border-accent bg-accent/15 text-foreground' : 'border-border-subtle bg-canvas text-muted hover:text-foreground'
                    }`}
                  >
                    P{idx + 1} · {p.label.slice(0, 14)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. REUSABLE KDP BOOK TEMPLATE LIBRARY (10 TEMPLATES) */}
      {activeTab === 'templates' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border-subtle bg-surface p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Reusable KDP Book Template Library ({templates.length} Templates)</h2>
              <p className="text-xs text-muted">
                Templates are structured starting points, not guaranteed KDP-compliant files. Always validate every exported book separately.
              </p>
            </div>
            <select
              value={tplCategory}
              onChange={(e) => setTplCategory(e.target.value)}
              className="h-9 rounded-lg border border-border-subtle bg-canvas px-3 text-xs text-foreground"
            >
              <option value="All">All 10 Book Types</option>
              {[
                'Coloring Book',
                'Activity Book',
                'Puzzle Book',
                'Word Search',
                'Sudoku',
                "Children's Story",
                'Guided Journal',
                'Daily Planner',
                'Educational Workbook',
                'Large Print Book',
              ].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="lg:col-span-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {templates
                .filter((t) => tplCategory === 'All' || t.bookType === tplCategory)
                .map((tpl) => {
                  const active = tpl.templateId === selectedTemplate?.templateId;
                  return (
                    <button
                      key={tpl.templateId}
                      type="button"
                      onClick={() => setSelectedTplId(tpl.templateId)}
                      className={`text-left rounded-xl border p-4 transition-colors ${
                        active ? 'border-accent bg-elevated/60' : 'border-border-subtle bg-surface hover:border-border-strong'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-teal">{tpl.bookType}</span>
                        <span className="font-mono-tabular text-[11px] text-muted">{tpl.trimSize}" · {tpl.recommendedPageCount}p</span>
                      </div>
                      <h3 className="mt-1 text-sm font-semibold text-foreground">{tpl.name}</h3>
                      <p className="mt-1 text-xs text-secondary line-clamp-2">{tpl.layoutRules}</p>
                      <p className="mt-2 text-[11px] text-muted">
                        {tpl.bleed ? 'Full Bleed' : 'No Bleed'} · {tpl.paperType} · {tpl.interiorType}
                      </p>
                    </button>
                  );
                })}
            </div>

            {selectedTemplate && (
              <div className="lg:col-span-5 rounded-xl border border-border-subtle bg-surface p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-mono-tabular text-muted">{selectedTemplate.templateId}</span>
                    <h3 className="text-base font-bold text-foreground">{selectedTemplate.name}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const copy = duplicateTemplate(selectedTemplate.templateId);
                      if (copy) setSelectedTplId(copy.templateId);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-border-subtle px-2.5 py-1.5 text-xs text-secondary hover:text-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" /> Duplicate
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs border-y border-border-subtle py-3">
                  <div><span className="text-muted block">Trim Size</span><strong className="font-mono-tabular text-foreground">{selectedTemplate.trimSize}"</strong></div>
                  <div><span className="text-muted block">Bleed</span><strong className="text-foreground">{selectedTemplate.bleed ? 'Enabled (+0.125")' : 'None'}</strong></div>
                  <div><span className="text-muted block">Typography</span><strong className="text-foreground">{selectedTemplate.typography.bodySizePt}pt body</strong></div>
                  <div>
                    <span className="text-muted block">Margins (T/B/In/Out)</span>
                    <strong className="font-mono-tabular text-foreground">
                      {selectedTemplate.marginsIn.top}/{selectedTemplate.marginsIn.bottom}/{selectedTemplate.marginsIn.inside}/{selectedTemplate.marginsIn.outside}"
                    </strong>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted">Editable Page Components</h4>
                  <ul className="mt-1.5 space-y-1 text-xs text-secondary">
                    {selectedTemplate.pageComponents.map((c) => <li key={c}>· {c}</li>)}
                  </ul>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeProject) return;
                      hydrateGeneratedDocument({
                        projectId: activeProject.id,
                        trimSize: selectedTemplate.trimSize,
                        pageCount: selectedTemplate.recommendedPageCount,
                        paperType: selectedTemplate.paperType,
                        interiorType: selectedTemplate.interiorType,
                        bleed: selectedTemplate.bleed,
                        pages: selectedTemplate.samplePages,
                      });
                      setRoute('/editor');
                    }}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-xs font-semibold text-white hover:opacity-90"
                  >
                    Apply Template to Book Editor
                  </button>

                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={customTplName}
                      onChange={(e) => setCustomTplName(e.target.value)}
                      placeholder="Save variant as custom template..."
                      className="flex-1 h-8 rounded-lg border border-border-subtle bg-canvas px-2.5 text-xs text-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!customTplName.trim()) return;
                        const created = saveCustomTemplate({
                          ...selectedTemplate,
                          name: customTplName.trim(),
                        });
                        setSelectedTplId(created.templateId);
                        setCustomTplName('');
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-border-subtle bg-elevated px-3 text-xs font-medium text-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" /> Save Custom
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. AI BOOK CONSISTENCY ENGINE */}
      {activeTab === 'consistency' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 rounded-xl border border-border-subtle bg-surface p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Global Book Style Profile (v{profile.version})</h2>
                <p className="text-xs text-muted">
                  Loaded before generating any new page. Approved pages are locked and never modified automatically.
                </p>
              </div>
              <span className="text-[11px] font-mono-tabular text-teal">
                Approved {new Date(profile.approvedAt).toLocaleDateString()}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <label className="space-y-1">
                <span className="text-muted">Art Style</span>
                <input
                  value={draftArtStyle}
                  onChange={(e) => setDraftArtStyle(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border-subtle bg-canvas px-2.5 text-foreground"
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted">Line Weight</span>
                <input
                  value={draftLineWeight}
                  onChange={(e) => setDraftLineWeight(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border-subtle bg-canvas px-2.5 text-foreground"
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted">Writing Tone</span>
                <input
                  value={draftTone}
                  onChange={(e) => setDraftTone(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border-subtle bg-canvas px-2.5 text-foreground"
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted">Target Audience</span>
                <input
                  value={draftAudience}
                  onChange={(e) => setDraftAudience(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border-subtle bg-canvas px-2.5 text-foreground"
                />
              </label>
              <label className="sm:col-span-2 space-y-1">
                <span className="text-muted">Background Style Memory</span>
                <input
                  value={draftBgMemory}
                  onChange={(e) => setDraftBgMemory(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border-subtle bg-canvas px-2.5 text-foreground"
                />
              </label>
            </div>

            <div>
              <span className="text-xs text-muted block mb-1.5">Color Palette Memory</span>
              <div className="flex flex-wrap items-center gap-2">
                {profile.colorPalette.map((hex) => (
                  <div key={hex} className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-canvas px-2 py-1 text-xs font-mono-tabular">
                    <span className="h-3.5 w-3.5 rounded-sm border border-white/20" style={{ backgroundColor: hex }} />
                    {hex}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border-subtle pt-3">
              <h3 className="text-xs font-semibold uppercase text-muted">Character Description Memory</h3>
              <div className="mt-2 space-y-2">
                {profile.characterDescriptions.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border-subtle bg-canvas p-3 text-xs">
                    <p className="font-semibold text-foreground">{c.name}</p>
                    <p className="text-secondary mt-0.5">{c.visualTraits} · {c.wardrobe}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-12 gap-2">
                <input
                  value={draftCharName}
                  onChange={(e) => setDraftCharName(e.target.value)}
                  placeholder="Character name..."
                  className="sm:col-span-4 h-8 rounded-lg border border-border-subtle bg-canvas px-2.5 text-xs text-foreground"
                />
                <input
                  value={draftCharTraits}
                  onChange={(e) => setDraftCharTraits(e.target.value)}
                  placeholder="Visual traits, wardrobe & consistency cues..."
                  className="sm:col-span-6 h-8 rounded-lg border border-border-subtle bg-canvas px-2.5 text-xs text-foreground"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!activeProject || !draftCharName.trim()) return;
                    updateStyleProfile(activeProject.id, {
                      characterDescriptions: [
                        ...profile.characterDescriptions,
                        {
                          id: generateId('char'),
                          name: draftCharName.trim(),
                          visualTraits: draftCharTraits.trim() || 'Consistent recurring character',
                          wardrobe: 'Consistent signature outfit',
                          personality: 'Aligned with writing tone',
                        },
                      ],
                    });
                    setDraftCharName('');
                    setDraftCharTraits('');
                  }}
                  className="sm:col-span-2 h-8 rounded-lg border border-border-subtle bg-elevated text-xs font-medium text-foreground"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (!activeProject) return;
                  updateStyleProfile(
                    activeProject.id,
                    {
                      artStyle: draftArtStyle,
                      lineWeight: draftLineWeight,
                      writingTone: draftTone,
                      targetAudience: draftAudience,
                      backgroundStyleMemory: draftBgMemory,
                    },
                    true
                  );
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-semibold text-white hover:opacity-90"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve Style Profile Changes
              </button>
            </div>
          </div>

          {/* Live Consistency Comparison & Duplicate Detector */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-xl border border-border-subtle bg-surface p-5">
              <h3 className="text-sm font-semibold text-foreground">Page-vs-Profile Consistency Audit</h3>
              <p className="text-xs text-muted">Lock approved pages so automated batch or style updates never overwrite them.</p>
              <div className="mt-3 space-y-2.5">
                {consistencyAudit.map((item) => (
                  <div key={item.pageId} className="rounded-lg border border-border-subtle bg-canvas p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">
                        Page {item.pageIndex} · {item.pageLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => activeProject && toggleApprovedPageLock(activeProject.id, item.pageId)}
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${
                          item.isApprovedLocked ? 'bg-teal/15 text-teal' : 'bg-elevated text-muted'
                        }`}
                      >
                        {item.isApprovedLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                        {item.isApprovedLocked ? 'Approved (Locked)' : 'Draft'}
                      </button>
                    </div>
                    {item.issues.length === 0 ? (
                      <p className="mt-1 text-teal">Matches approved typography & palette profile.</p>
                    ) : (
                      <ul className="mt-1 space-y-0.5 text-amber-400">
                        {item.issues.map((iss, i) => <li key={i}>· {iss}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border-subtle bg-surface p-5">
              <h3 className="text-sm font-semibold text-foreground">Duplicate Page Detection</h3>
              {duplicatePageWarnings.length === 0 ? (
                <p className="mt-2 text-xs text-teal">Zero duplicate pages detected across {pages.length} manuscript pages.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-xs text-rose-400">
                  {duplicatePageWarnings.map((d, i) => (
                    <li key={i}>· Pages {d.pageA} and {d.pageB} have identical content signatures.</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. BATCH BOOK PAGE GENERATION ENGINE */}
      {activeTab === 'batch' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border-subtle bg-surface p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Batch Book Page Generation Engine</h2>
                <p className="text-xs text-muted">
                  Celery-backed rate-limited queue (max 2 concurrent workers · 10 req/min provider cap · content hash deduplication).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerateBatch}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-semibold text-white hover:opacity-90"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate Batch from Outline
                </button>
              </div>
            </div>
            <textarea
              rows={4}
              value={outlineText}
              onChange={(e) => setOutlineText(e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-canvas p-3 font-mono text-xs text-foreground"
            />
          </div>

          {activeBatch && (
            <div className="rounded-xl border border-border-subtle bg-surface p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Batch Job {activeBatch.jobId} · Status: {activeBatch.status}
                  </h3>
                  <p className="text-xs text-muted">
                    Concurrency limit: {activeBatch.concurrencyLimit} · Provider Rate Limit: {activeBatch.rateLimitPerMinute}/min ·{' '}
                    {activeBatch.pages.filter((p) => p.approvalStatus === 'Approved').length}/{activeBatch.pages.length} Approved
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      activeProject &&
                      setBatchJobStatus(activeProject.id, activeBatch.status === 'Paused' ? 'Running' : 'Paused')
                    }
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-border-subtle px-3 text-xs text-foreground"
                  >
                    {activeBatch.status === 'Paused' ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                    {activeBatch.status === 'Paused' ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    type="button"
                    onClick={() => activeProject && retryFailedBatchPages(activeProject.id)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-border-subtle px-3 text-xs text-foreground"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Retry Failed
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeProject) return;
                      activeBatch.pages.forEach((p) =>
                        updateBatchPage(activeProject.id, p.id, { approvalStatus: 'Approved' })
                      );
                    }}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-teal/40 bg-teal/10 px-3 text-xs font-medium text-teal"
                  >
                    Approve All
                  </button>
                  <button
                    type="button"
                    onClick={handleCommitApprovedBatch}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-accent px-3 text-xs font-semibold text-white"
                  >
                    Finalize & Open in Editor
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border-subtle text-muted">
                      <th className="pb-2 pr-3">#</th>
                      <th className="pb-2 pr-3">Type</th>
                      <th className="pb-2 pr-3">Page Title & Illustration Prompt</th>
                      <th className="pb-2 pr-3">Status</th>
                      <th className="pb-2 pr-3">Approval</th>
                      <th className="pb-2 pr-3">Ver</th>
                      <th className="pb-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {activeBatch.pages.map((pg) => (
                      <tr key={pg.id}>
                        <td className="py-2.5 pr-3 font-mono-tabular text-muted">{pg.pageNumber}</td>
                        <td className="py-2.5 pr-3 text-secondary">{pg.pageType}</td>
                        <td className="py-2.5 pr-3">
                          <p className="font-medium text-foreground">{pg.title}</p>
                          <p className="text-[11px] text-muted truncate max-w-md">{pg.illustrationPrompt}</p>
                        </td>
                        <td className="py-2.5 pr-3 font-mono-tabular text-foreground">{pg.generationStatus}</td>
                        <td className="py-2.5 pr-3">
                          <span className={pg.approvalStatus === 'Approved' ? 'text-teal font-medium' : 'text-amber-400'}>
                            {pg.approvalStatus}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 font-mono-tabular text-muted">v{pg.versionNumber}</td>
                        <td className="py-2.5 text-right whitespace-nowrap space-x-2">
                          <button
                            type="button"
                            onClick={() => activeProject && regenerateBatchPage(activeProject.id, pg.id)}
                            className="text-secondary hover:text-foreground"
                          >
                            Regenerate
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              activeProject &&
                              updateBatchPage(activeProject.id, pg.id, {
                                approvalStatus: pg.approvalStatus === 'Approved' ? 'Pending Review' : 'Approved',
                              })
                            }
                            className="text-accent font-medium hover:underline"
                          >
                            {pg.approvalStatus === 'Approved' ? 'Unapprove' : 'Approve'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. AI WORKFLOW AUTOMATION ENGINE */}
      {activeTab === 'workflows' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border-subtle bg-surface p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Durable AI Workflow Automation Engine</h2>
                <p className="text-xs text-muted">
                  Idempotency-key protected task graph with mandatory human approval checkpoints and crash-safe checkpoint recovery.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={wfTitle}
                  onChange={(e) => setWfTitle(e.target.value)}
                  placeholder="Book workflow title..."
                  className="h-9 w-64 rounded-lg border border-border-subtle bg-canvas px-3 text-xs text-foreground"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!wfTitle.trim()) return;
                    const res = createWorkflow({
                      projectId: activeProject?.id || 'proj_botanicals',
                      bookTitle: wfTitle.trim(),
                      source: 'Workflow Studio',
                    });
                    setWfMessage(
                      res.deduplicated
                        ? `Duplicate execution prevented via idempotency key ${res.workflow.idempotencyKey}.`
                        : `Created durable workflow ${res.workflow.id} with checkpoint protection.`
                    );
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-xs font-semibold text-white hover:opacity-90"
                >
                  <Plus className="h-3.5 w-3.5" /> Create Book Workflow
                </button>
              </div>
            </div>
            {wfMessage && <p className="mt-2 text-xs text-teal">{wfMessage}</p>}
          </div>

          {workflows.map((wf) => (
            <div key={wf.id} className="rounded-xl border border-border-subtle bg-surface p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{wf.bookTitle}</h3>
                    <span className="font-mono-tabular text-[11px] text-teal">{wf.status}</span>
                  </div>
                  <p className="text-[11px] font-mono-tabular text-muted mt-0.5">
                    Run {wf.id} · Source: {wf.source} · Idempotency Key: {wf.idempotencyKey} · Checkpoint #{wf.checkpointStepIndex + 1}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {wf.status === 'Paused' ? (
                    <button
                      type="button"
                      onClick={() => resumeWorkflow(wf.id)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-border-subtle px-2.5 text-xs text-foreground"
                    >
                      <Play className="h-3.5 w-3.5" /> Resume
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={wf.status === 'Completed' || wf.status === 'Cancelled'}
                      onClick={() => pauseWorkflow(wf.id)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-border-subtle px-2.5 text-xs text-foreground disabled:opacity-40"
                    >
                      <Pause className="h-3.5 w-3.5" /> Pause
                    </button>
                  )}
                  {wf.status === 'Failed' && (
                    <button
                      type="button"
                      onClick={() => recoverInterruptedWorkflow(wf.id)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-teal/15 border border-teal/40 px-2.5 text-xs font-medium text-teal"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Recover from Checkpoint
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={wf.status === 'Completed' || wf.status === 'Cancelled'}
                    onClick={() => cancelWorkflow(wf.id)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-500/30 px-2.5 text-xs text-rose-400 disabled:opacity-40"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Cancel
                  </button>
                </div>
              </div>

              {/* Visual Workflow Timeline */}
              <div className="space-y-3">
                {wf.steps.map((step, idx) => (
                  <div
                    key={step.taskId}
                    className="rounded-lg border border-border-subtle bg-canvas p-3.5 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono-tabular text-muted">0{idx + 1}</span>
                        <span className="font-semibold text-foreground">{step.label}</span>
                        <span className="text-muted">· {step.agentName}</span>
                        <span
                          className={`font-mono-tabular font-medium ${
                            step.status === 'Completed'
                              ? 'text-teal'
                              : step.status === 'Waiting Approval'
                                ? 'text-amber-400'
                                : step.status === 'Failed'
                                  ? 'text-rose-400'
                                  : 'text-muted'
                          }`}
                        >
                          [{step.status}]
                        </span>
                      </div>
                      <p className="text-[11px] text-secondary">
                        <strong className="text-muted">Task ID:</strong> {step.taskId} ·{' '}
                        <strong className="text-muted">Depends On:</strong> {step.dependsOn.length ? step.dependsOn.join(', ') : 'Root'} ·{' '}
                        <strong className="text-muted">Approval Required:</strong> {step.approvalRequired ? 'Yes (Mandatory Gate)' : 'No'}
                      </p>
                      <p className="text-[11px] text-secondary">
                        <strong className="text-muted">Input:</strong> {step.inputSummary}
                      </p>
                      {step.outputSummary && (
                        <p className="text-[11px] text-teal">
                          <strong>Output:</strong> {step.outputSummary}
                        </p>
                      )}
                      {step.errorDetails && (
                        <p className="text-[11px] text-rose-400 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Error: {step.errorDetails}
                        </p>
                      )}
                      <p className="text-[10px] font-mono-tabular text-muted">
                        Start: {step.startTime ? new Date(step.startTime).toLocaleTimeString() : '—'} · Complete:{' '}
                        {step.completionTime ? new Date(step.completionTime).toLocaleTimeString() : '—'} · Attempts: {step.attempts}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {step.status === 'Waiting Approval' && (
                        <button
                          type="button"
                          onClick={() => approveWorkflowStep(wf.id, step.taskId)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-white hover:opacity-90"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve Checkpoint
                        </button>
                      )}
                      {step.status === 'Failed' && (
                        <button
                          type="button"
                          onClick={() => retryWorkflowStep(wf.id, step.taskId)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-border-subtle px-2.5 text-xs text-foreground"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Retry Step
                        </button>
                      )}
                      {step.status === 'Completed' && wf.status !== 'Completed' && (
                        <button
                          type="button"
                          onClick={() =>
                            simulateStepFailure(
                              wf.id,
                              step.taskId,
                              'Transient worker interruption (test durable recovery)'
                            )
                          }
                          className="inline-flex h-7 items-center gap-1 rounded border border-border-subtle px-2 text-[11px] text-muted hover:text-foreground"
                        >
                          <ShieldAlert className="h-3 w-3" /> Test Recovery
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
