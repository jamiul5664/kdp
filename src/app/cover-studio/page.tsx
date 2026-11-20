import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Eye,
  Grid3X3,
  ImagePlus,
  Layers,
  Sparkles,
  Upload,
} from 'lucide-react';
import { COVER_ASSETS, useAppStore } from '../../stores/useAppStore';
import { useEditorStore } from '../../stores/useEditorStore';
import {
  generateCoverArtwork,
  generateCoverConcepts,
  type CoverConcept,
} from '../../services/studioService';
import type {
  CoverDesignState,
  CoverTemplateId,
  InteriorType,
  PaperType,
  TextAlign,
  TrimSizeId,
} from '../../types';
import {
  calculateFullCoverSpec,
  EDITOR_FONT_FAMILIES,
  KDP_MIN_SPINE_TEXT_PAGES,
  TRIM_SIZES,
} from '../../utils/kdpDimensions';
import {
  CoverPreviewCanvas,
  type ActiveCoverPanel,
} from '../../components/cover/CoverPreviewCanvas';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ErrorState } from '../../components/shared/ErrorState';
import { cn } from '../../utils/cn';

const TEMPLATES: Array<{ id: CoverTemplateId; label: string; description: string }> = [
  { id: 'editorial_minimal', label: 'Editorial Minimal', description: 'Clean type with soft scrim' },
  { id: 'classic_framed', label: 'Classic Framed', description: 'Fine inset hairline border' },
  { id: 'full_bleed_art', label: 'Full-Bleed Art', description: 'Edge-to-edge artwork focus' },
  { id: 'split_band', label: 'Split Band', description: 'Title band contrast header' },
  { id: 'typographic_grid', label: 'Typographic Grid', description: 'Subtle Swiss grid lines' },
];

const ARTWORK_PRESETS = [
  { label: 'Botanical Linen', src: COVER_ASSETS.botanicals },
  { label: 'Woodland Lantern', src: COVER_ASSETS.forest },
  { label: 'Isometric Labyrinth', src: COVER_ASSETS.puzzles },
  { label: 'Slate Cloth Journal', src: COVER_ASSETS.journal },
];

export default function CoverStudioPage() {
  const projects = useAppStore((s) => s.projects);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const setRoute = useAppStore((s) => s.setRoute);
  const addActivity = useAppStore((s) => s.addActivity);

  const editorDocs = useEditorStore((s) => s.documents);
  const project = projects.find((p) => p.id === activeProjectId) ?? projects[0];
  const editorSettings = editorDocs[project.id]?.settings;

  // Dynamic KDP Cover Specification Calculator state (never a fixed spine!)
  const [trimSize, setTrimSize] = React.useState<TrimSizeId>(
    editorSettings?.trimSize ?? project.trimSize
  );
  const [pageCount, setPageCount] = React.useState<number>(
    editorSettings?.pageCount ?? project.pageCount
  );
  const [paperType, setPaperType] = React.useState<PaperType>(
    editorSettings?.paperType ?? 'White Paper'
  );
  const [interiorType, setInteriorType] = React.useState<InteriorType>(
    editorSettings?.interiorType ?? 'Black & White'
  );
  const [bleed, setBleed] = React.useState<boolean>(editorSettings?.bleed ?? true);

  const [activePanel, setActivePanel] = React.useState<ActiveCoverPanel>('front');
  const [showPrintGuides, setShowPrintGuides] = React.useState(true);
  const [exportPreviewOpen, setExportPreviewOpen] = React.useState(false);

  const [design, setDesign] = React.useState<CoverDesignState>({
    template: 'editorial_minimal',
    title: project.title,
    subtitle: project.subtitle || 'A Curated Amazon KDP Edition',
    author: project.author,
    spineTitle: project.title,
    spineAuthor: project.author,
    spineBgColor: '#11141C',
    spineTextColor: '#F1F3F9',
    backHeadline: 'Inside This Edition',
    backBlurb:
      'Carefully structured for daily clarity and tactile print quality. Includes clean wide margins, durable layout spacing, and curated content designed for lasting shelf appeal.',
    backAuthorBio: `${project.author} publishes thoughtful independent print editions under Northstar Press.`,
    backBgColor: '#141822',
    backTextColor: '#E2E8F0',
    showIsbnBarcode: true,
    isbnNumber: '979-8-8901-4421-0',
    frontBgColor: '#171B25',
    frontAccentColor: '#8B7CFF',
    frontOverlayOpacity: 0.55,
    titleFontFamily: '"Playfair Display", Georgia, serif',
    titleFontSize: 22,
    subtitleFontSize: 12,
    textColor: '#FFFFFF',
    textAlign: 'left',
    artworkSrc: project.thumbnail,
    imageScale: 1,
    imagePosX: 0,
    imagePosY: 0,
    imageOpacity: 0.92,
  });

  const [aiPrompt, setAiPrompt] = React.useState(
    `Minimalist fine-line botanical and geometric motifs for "${project.title}"`
  );
  const [concepts, setConcepts] = React.useState<CoverConcept[]>([]);
  const uploadInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const docSettings = editorDocs[project.id]?.settings;
    setTrimSize(docSettings?.trimSize ?? project.trimSize);
    setPageCount(docSettings?.pageCount ?? project.pageCount);
    setPaperType(docSettings?.paperType ?? 'White Paper');
    setInteriorType(docSettings?.interiorType ?? 'Black & White');
    setBleed(docSettings?.bleed ?? true);
    setDesign((prev) => ({
      ...prev,
      title: project.title,
      subtitle: project.subtitle || prev.subtitle,
      author: project.author,
      spineTitle: project.title,
      spineAuthor: project.author,
      artworkSrc: project.thumbnail,
    }));
    setAiPrompt(`Minimalist editorial illustration for "${project.title}" (${project.category})`);
  }, [project.id, project.title, project.subtitle, project.author, project.thumbnail, project.trimSize, project.pageCount, project.category, editorDocs]);

  const coverSpec = React.useMemo(
    () =>
      calculateFullCoverSpec({
        trimSize,
        pageCount,
        paperType,
        interiorType,
        bleed,
      }),
    [trimSize, pageCount, paperType, interiorType, bleed]
  );

  const artworkMutation = useMutation({
    mutationFn: () =>
      generateCoverArtwork({
        prompt: aiPrompt,
        title: design.title,
        category: project.category,
        palette: `${design.frontBgColor}, ${design.frontAccentColor}, #36CFC9, #F1F3F9`,
      }),
    onSuccess: (data) => {
      setDesign((prev) => ({ ...prev, artworkSrc: data.dataUrl }));
      addActivity({
        title: `Generated AI cover artwork for "${design.title}"`,
        description: `Applied bespoke vector cover illustration to ${trimSize}" full wrap.`,
        category: 'cover',
        projectId: project.id,
      });
    },
  });

  const conceptsMutation = useMutation({
    mutationFn: () =>
      generateCoverConcepts({
        title: design.title,
        subtitle: design.subtitle,
        category: project.category,
        mood: design.template.replace(/_/g, ' '),
      }),
    onSuccess: (data) => setConcepts(data.concepts ?? []),
  });

  const handleUploadArtwork = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setDesign((prev) => ({ ...prev, artworkSrc: String(reader.result || prev.artworkSrc) }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const updateDesign = <K extends keyof CoverDesignState>(key: K, value: CoverDesignState[K]) => {
    setDesign((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            AI Book Cover Designer
          </h1>
          <p className="text-sm text-secondary">
            Edit Front, Spine, and Back panels with live KDP full-wrap dimensions computed from
            actual page count, paper caliper, trim size, and bleed.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Select
            aria-label="Select book project"
            value={project.id}
            onChange={(e) => setActiveProjectId(e.target.value)}
            className="w-56"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>

          <Button
            variant={showPrintGuides ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowPrintGuides(!showPrintGuides)}
          >
            <Grid3X3 className="h-3.5 w-3.5" />
            {showPrintGuides ? 'Guides On' : 'Guides Off'}
          </Button>

          <Button size="sm" onClick={() => setExportPreviewOpen(true)}>
            <Eye className="h-3.5 w-3.5" />
            Export Preview
          </Button>
        </div>
      </div>

      {/* Main Split: Live Full-Wrap Canvas + Spec Calculator on Left, Panel Controls on Right */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-7 space-y-5">
          {/* Interactive 3-Panel Cover Preview */}
          <CoverPreviewCanvas
            design={design}
            spec={coverSpec}
            activePanel={activePanel}
            onSelectPanel={setActivePanel}
            showPrintGuides={showPrintGuides}
            mode="interactive"
          />

          {/* KDP Cover Specification Calculator */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-accent" />
                  KDP Cover Specification Calculator
                </CardTitle>
                <CardDescription>
                  Dynamic spine and full-wrap print dimensions — never assumes a fixed spine width
                </CardDescription>
              </div>
              <span className="text-xs font-mono-tabular text-teal">
                Caliper {coverSpec.paperCaliperIn}&quot;/pg
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-secondary">Trim Size</label>
                  <Select
                    value={trimSize}
                    onChange={(e) => setTrimSize(e.target.value as TrimSizeId)}
                  >
                    {Object.values(TRIM_SIZES).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.id}&quot;
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-secondary">Page Count</label>
                  <Input
                    type="number"
                    min={24}
                    max={828}
                    value={pageCount}
                    onChange={(e) =>
                      setPageCount(Math.max(24, Math.min(828, Number(e.target.value) || 24)))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-secondary">Paper Type</label>
                  <Select
                    value={paperType}
                    onChange={(e) => setPaperType(e.target.value as PaperType)}
                  >
                    <option value="White Paper">White Paper</option>
                    <option value="Cream Paper">Cream Paper</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-secondary">Interior Ink</label>
                  <Select
                    value={interiorType}
                    onChange={(e) => setInteriorType(e.target.value as InteriorType)}
                  >
                    <option value="Black & White">Black &amp; White</option>
                    <option value="Standard Color">Standard Color</option>
                    <option value="Premium Color">Premium Color</option>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-sidebar border border-border-subtle px-3.5 py-2.5 text-xs">
                <span className="text-secondary">
                  Include KDP Outer Bleed (+0.125&quot; top, bottom, and outer edges)
                </span>
                <input
                  type="checkbox"
                  checked={bleed}
                  onChange={(e) => setBleed(e.target.checked)}
                  className="h-4 w-4 accent-[#8B7CFF] cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="rounded-lg bg-sidebar border border-border-subtle p-3">
                  <p className="text-[11px] text-muted">Full Wrap Width</p>
                  <p className="font-mono-tabular text-base font-semibold text-foreground mt-0.5">
                    {coverSpec.fullWidthIn}&quot;
                  </p>
                </div>
                <div className="rounded-lg bg-sidebar border border-border-subtle p-3">
                  <p className="text-[11px] text-muted">Full Wrap Height</p>
                  <p className="font-mono-tabular text-base font-semibold text-foreground mt-0.5">
                    {coverSpec.fullHeightIn}&quot;
                  </p>
                </div>
                <div className="rounded-lg bg-sidebar border border-border-subtle p-3">
                  <p className="text-[11px] text-muted">Calculated Spine</p>
                  <p className="font-mono-tabular text-base font-semibold text-teal mt-0.5">
                    {coverSpec.spineWidthIn}&quot;
                  </p>
                </div>
                <div className="rounded-lg bg-sidebar border border-border-subtle p-3">
                  <p className="text-[11px] text-muted">300 DPI Print Matrix</p>
                  <p className="font-mono-tabular text-sm font-semibold text-foreground mt-1">
                    {coverSpec.fullWidthPx300} × {coverSpec.fullHeightPx300}
                  </p>
                </div>
              </div>

              {!coverSpec.spineTextAllowed && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Books under {KDP_MIN_SPINE_TEXT_PAGES} pages cannot include spine text on
                    Amazon KDP. Spine typography is automatically suppressed until page count is
                    increased.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Art Direction Concepts (optional helper) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>AI Art Direction Concepts</CardTitle>
                <CardDescription>
                  Generate palette and typography recommendations for your book category
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={conceptsMutation.isPending}
                onClick={() => conceptsMutation.mutate()}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {conceptsMutation.isPending ? 'Generating...' : 'Suggest Concepts'}
              </Button>
            </CardHeader>
            {concepts.length > 0 && (
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {concepts.map((c, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-border-subtle bg-sidebar p-3.5 space-y-2"
                  >
                    <p className="font-display text-xs font-semibold text-foreground">{c.name}</p>
                    <div className="flex items-center gap-1.5">
                      {c.palette.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => updateDesign('frontAccentColor', hex)}
                          title={`Apply accent ${hex}`}
                          className="h-5 w-5 rounded border border-white/20 cursor-pointer"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] text-secondary">{c.typography}</p>
                    <p className="text-[11px] text-muted leading-relaxed">{c.layoutNotes}</p>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        </div>

        {/* Right Column: All 3 Cover Panel Editors + Template + AI Image Generation */}
        <div className="xl:col-span-5 space-y-5">
          {/* Panel Selector Tabs */}
          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-sidebar border border-border-subtle">
              {(
                [
                  ['front', 'Front Cover'],
                  ['spine', 'Spine'],
                  ['back', 'Back Cover'],
                ] as Array<[ActiveCoverPanel, string]>
              ).map(([panel, label]) => (
                <button
                  key={panel}
                  type="button"
                  onClick={() => setActivePanel(panel)}
                  className={cn(
                    'flex-1 h-9 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap',
                    activePanel === panel
                      ? 'bg-accent text-white'
                      : 'text-secondary hover:text-foreground hover:bg-surface-hover'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {activePanel === 'front' && (
              <div className="space-y-4">
                {/* Template Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-secondary flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    Cover Template
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => updateDesign('template', tpl.id)}
                        className={cn(
                          'rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer',
                          design.template === tpl.id
                            ? 'border-accent bg-accent/12 text-foreground'
                            : 'border-border-subtle bg-sidebar text-secondary hover:text-foreground'
                        )}
                      >
                        <p className="text-xs font-medium truncate">{tpl.label}</p>
                        <p className="text-[10px] text-muted truncate mt-0.5">{tpl.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title, Subtitle, Author */}
                <div className="space-y-3 pt-2 border-t border-border-subtle">
                  <div className="space-y-1">
                    <label className="text-xs text-secondary">Book Title</label>
                    <Input
                      value={design.title}
                      onChange={(e) => updateDesign('title', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-secondary">Subtitle</label>
                    <Input
                      value={design.subtitle}
                      onChange={(e) => updateDesign('subtitle', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-secondary">Author Name</label>
                    <Input
                      value={design.author}
                      onChange={(e) => updateDesign('author', e.target.value)}
                    />
                  </div>
                </div>

                {/* Typography Controls */}
                <div className="space-y-3 pt-2 border-t border-border-subtle">
                  <p className="text-xs font-semibold text-foreground">Typography Controls</p>
                  <div className="space-y-1">
                    <label className="text-xs text-secondary">Font Family</label>
                    <Select
                      value={design.titleFontFamily}
                      onChange={(e) => updateDesign('titleFontFamily', e.target.value)}
                    >
                      {EDITOR_FONT_FAMILIES.map((f) => (
                        <option key={f.label} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-xs text-secondary">Title Size</label>
                      <Input
                        type="number"
                        min={14}
                        max={36}
                        value={design.titleFontSize}
                        onChange={(e) =>
                          updateDesign('titleFontSize', Number(e.target.value) || 22)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-secondary">Subtitle Size</label>
                      <Input
                        type="number"
                        min={9}
                        max={20}
                        value={design.subtitleFontSize}
                        onChange={(e) =>
                          updateDesign('subtitleFontSize', Number(e.target.value) || 12)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-secondary">Text Color</label>
                      <input
                        type="color"
                        value={design.textColor}
                        onChange={(e) => updateDesign('textColor', e.target.value)}
                        className="h-10 w-full rounded-lg bg-canvas border border-border-subtle p-1 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1 bg-canvas p-1 rounded-lg border border-border-subtle">
                    {(
                      [
                        ['left', AlignLeft],
                        ['center', AlignCenter],
                        ['right', AlignRight],
                      ] as Array<[TextAlign, typeof AlignLeft]>
                    ).map(([align, Icon]) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() => updateDesign('textAlign', align)}
                        className={cn(
                          'h-8 rounded inline-flex items-center justify-center cursor-pointer',
                          design.textAlign === align
                            ? 'bg-accent text-white'
                            : 'text-secondary hover:text-foreground'
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Background Customization */}
                <div className="space-y-3 pt-2 border-t border-border-subtle">
                  <p className="text-xs font-semibold text-foreground">Background &amp; Scrim</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-secondary">Base Color</label>
                      <input
                        type="color"
                        value={design.frontBgColor}
                        onChange={(e) => updateDesign('frontBgColor', e.target.value)}
                        className="h-10 w-full rounded-lg bg-canvas border border-border-subtle p-1 cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-secondary">Accent Color</label>
                      <input
                        type="color"
                        value={design.frontAccentColor}
                        onChange={(e) => updateDesign('frontAccentColor', e.target.value)}
                        className="h-10 w-full rounded-lg bg-canvas border border-border-subtle p-1 cursor-pointer"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-secondary">
                      <span>Contrast Scrim Opacity</span>
                      <span className="font-mono-tabular">
                        {Math.round(design.frontOverlayOpacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={90}
                      value={Math.round(design.frontOverlayOpacity * 100)}
                      onChange={(e) =>
                        updateDesign('frontOverlayOpacity', Number(e.target.value) / 100)
                      }
                      className="w-full accent-[#8B7CFF]"
                    />
                  </div>
                </div>

                {/* AI Image Generation + Image Placement */}
                <div className="space-y-3 pt-2 border-t border-border-subtle">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">
                      Artwork &amp; AI Image Generation
                    </p>
                    <button
                      type="button"
                      onClick={() => uploadInputRef.current?.click()}
                      className="inline-flex items-center gap-1 text-xs text-accent hover:underline cursor-pointer"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload Image
                    </button>
                    <input
                      ref={uploadInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleUploadArtwork}
                      className="hidden"
                    />
                  </div>

                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Describe bespoke cover artwork to generate via AI..."
                      className="w-full rounded-lg bg-canvas border border-border-subtle p-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    />
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={artworkMutation.isPending || !aiPrompt.trim()}
                      onClick={() => artworkMutation.mutate()}
                    >
                      <ImagePlus className="h-3.5 w-3.5" />
                      {artworkMutation.isPending
                        ? 'Generating AI Cover Artwork...'
                        : 'Generate AI Cover Artwork'}
                    </Button>
                    {artworkMutation.isError && (
                      <ErrorState
                        title="AI artwork generation failed"
                        message={
                          artworkMutation.error instanceof Error
                            ? artworkMutation.error.message
                            : 'Request failed.'
                        }
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {ARTWORK_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => updateDesign('artworkSrc', preset.src)}
                        className={cn(
                          'rounded-lg border px-2.5 py-1.5 text-xs text-left truncate cursor-pointer transition-colors',
                          design.artworkSrc === preset.src
                            ? 'border-accent bg-accent/12 text-foreground'
                            : 'border-border-subtle bg-sidebar text-secondary hover:text-foreground'
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Image Placement Controls */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="space-y-1">
                      <label className="text-[11px] text-secondary">
                        Scale ({Math.round(design.imageScale * 100)}%)
                      </label>
                      <input
                        type="range"
                        min={100}
                        max={180}
                        value={Math.round(design.imageScale * 100)}
                        onChange={(e) => updateDesign('imageScale', Number(e.target.value) / 100)}
                        className="w-full accent-[#8B7CFF]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-secondary">
                        Shift X ({design.imagePosX}%)
                      </label>
                      <input
                        type="range"
                        min={-30}
                        max={30}
                        value={design.imagePosX}
                        onChange={(e) => updateDesign('imagePosX', Number(e.target.value))}
                        className="w-full accent-[#8B7CFF]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-secondary">
                        Shift Y ({design.imagePosY}%)
                      </label>
                      <input
                        type="range"
                        min={-30}
                        max={30}
                        value={design.imagePosY}
                        onChange={(e) => updateDesign('imagePosY', Number(e.target.value))}
                        className="w-full accent-[#8B7CFF]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activePanel === 'spine' && (
              <div className="space-y-4">
                <div className="rounded-lg bg-sidebar border border-border-subtle p-3.5 text-xs space-y-1">
                  <p className="font-medium text-foreground">
                    Dynamic Spine Width: {coverSpec.spineWidthIn}&quot; ({coverSpec.spineWidthPx300}{' '}
                    px @ 300 DPI)
                  </p>
                  <p className="text-secondary">
                    Computed from {pageCount} pages × {coverSpec.paperCaliperIn}&quot; ({paperType}
                    ).
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-secondary">Spine Title</label>
                  <Input
                    value={design.spineTitle}
                    onChange={(e) => updateDesign('spineTitle', e.target.value)}
                    disabled={!coverSpec.spineTextAllowed}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-secondary">Spine Author</label>
                  <Input
                    value={design.spineAuthor}
                    onChange={(e) => updateDesign('spineAuthor', e.target.value)}
                    disabled={!coverSpec.spineTextAllowed}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-secondary">Spine Background</label>
                    <input
                      type="color"
                      value={design.spineBgColor}
                      onChange={(e) => updateDesign('spineBgColor', e.target.value)}
                      className="h-10 w-full rounded-lg bg-canvas border border-border-subtle p-1 cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-secondary">Spine Text Color</label>
                    <input
                      type="color"
                      value={design.spineTextColor}
                      onChange={(e) => updateDesign('spineTextColor', e.target.value)}
                      className="h-10 w-full rounded-lg bg-canvas border border-border-subtle p-1 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {activePanel === 'back' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-secondary">Back Cover Headline</label>
                  <Input
                    value={design.backHeadline}
                    onChange={(e) => updateDesign('backHeadline', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-secondary">Back Cover Blurb</label>
                  <textarea
                    rows={4}
                    value={design.backBlurb}
                    onChange={(e) => updateDesign('backBlurb', e.target.value)}
                    className="w-full rounded-lg bg-canvas border border-border-subtle p-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-secondary">Author Bio</label>
                  <textarea
                    rows={2}
                    value={design.backAuthorBio}
                    onChange={(e) => updateDesign('backAuthorBio', e.target.value)}
                    className="w-full rounded-lg bg-canvas border border-border-subtle p-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-secondary">Back Background</label>
                    <input
                      type="color"
                      value={design.backBgColor}
                      onChange={(e) => updateDesign('backBgColor', e.target.value)}
                      className="h-10 w-full rounded-lg bg-canvas border border-border-subtle p-1 cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-secondary">Back Text Color</label>
                    <input
                      type="color"
                      value={design.backTextColor}
                      onChange={(e) => updateDesign('backTextColor', e.target.value)}
                      className="h-10 w-full rounded-lg bg-canvas border border-border-subtle p-1 cursor-pointer"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-sidebar px-3 py-2.5">
                  <span className="text-xs text-foreground">Reserve KDP ISBN Barcode Box</span>
                  <input
                    type="checkbox"
                    checked={design.showIsbnBarcode}
                    onChange={(e) => updateDesign('showIsbnBarcode', e.target.checked)}
                    className="h-4 w-4 accent-[#8B7CFF] cursor-pointer"
                  />
                </div>
                {design.showIsbnBarcode && (
                  <div className="space-y-1">
                    <label className="text-xs text-secondary">ISBN-13 Preview Label</label>
                    <Input
                      value={design.isbnNumber}
                      onChange={(e) => updateDesign('isbnNumber', e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Export Preview Modal (Screen Preview vs Print-Ready Export Distinction) */}
      <Modal
        open={exportPreviewOpen}
        onClose={() => setExportPreviewOpen(false)}
        title="Cover Export Preview & Print Specification"
        description="Verify the distinction between interactive screen preview and KDP 300 DPI print-ready output before generating files."
        maxWidthClass="max-w-4xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setExportPreviewOpen(false)}>
              Back to Designer
            </Button>
            <Button
              onClick={() => {
                setExportPreviewOpen(false);
                setRoute('/exports');
              }}
            >
              Open Export Center to Build Cover PDF
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <CoverPreviewCanvas
            design={design}
            spec={coverSpec}
            activePanel={activePanel}
            onSelectPanel={setActivePanel}
            showPrintGuides={true}
            mode="export_preview"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="rounded-xl border border-border-subtle bg-sidebar p-4 space-y-2">
              <p className="font-display font-semibold text-foreground">
                Screen Preview (Current Viewport)
              </p>
              <ul className="space-y-1 text-secondary list-disc pl-4">
                <li>Rendered at browser display density (72–96 PPI RGB)</li>
                <li>Includes visual bleed, safe margin, and spine fold guides</li>
                <li>Used strictly for typography and layout verification</li>
              </ul>
            </div>

            <div className="rounded-xl border border-teal/35 bg-sidebar p-4 space-y-2">
              <p className="font-display font-semibold text-teal flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Print-Ready Full Cover PDF Spec
              </p>
              <ul className="space-y-1 text-secondary font-mono-tabular list-disc pl-4">
                <li>
                  Physical size: {coverSpec.fullWidthIn}&quot; × {coverSpec.fullHeightIn}&quot;
                </li>
                <li>
                  Target raster matrix: {coverSpec.fullWidthPx300} × {coverSpec.fullHeightPx300} px
                  (300 DPI)
                </li>
                <li>
                  Dynamic spine: {coverSpec.spineWidthIn}&quot; ({pageCount}p · {paperType})
                </li>
                <li>
                  Outer bleed: {coverSpec.bleedIn}&quot; · Guides omitted from final print file
                </li>
              </ul>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
