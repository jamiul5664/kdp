import { BookCoverImage } from '../shared/BookCoverImage';
import type { CoverDesignState } from '../../types';
import type { FullCoverSpec } from '../../utils/kdpDimensions';
import { cn } from '../../utils/cn';

export type ActiveCoverPanel = 'front' | 'spine' | 'back';

interface CoverPreviewCanvasProps {
  design: CoverDesignState;
  spec: FullCoverSpec;
  activePanel: ActiveCoverPanel;
  onSelectPanel: (panel: ActiveCoverPanel) => void;
  showPrintGuides: boolean;
  mode?: 'interactive' | 'export_preview';
}

export function CoverPreviewCanvas({
  design,
  spec,
  activePanel,
  onSelectPanel,
  showPrintGuides,
  mode = 'interactive',
}: CoverPreviewCanvasProps) {
  const totalWidthIn = spec.trimWidthIn * 2 + spec.spineWidthIn;
  const backPct = (spec.trimWidthIn / totalWidthIn) * 100;
  const spinePct = Math.max(4, (spec.spineWidthIn / totalWidthIn) * 100);
  const frontPct = 100 - backPct - spinePct;
  const aspectRatio = spec.fullWidthIn / spec.fullHeightIn;

  const alignClass =
    design.textAlign === 'center'
      ? 'text-center items-center'
      : design.textAlign === 'right'
        ? 'text-right items-end'
        : 'text-left items-start';

  const isFramed = design.template === 'classic_framed';
  const isSplitBand = design.template === 'split_band';
  const isGrid = design.template === 'typographic_grid';

  return (
    <div className="rounded-xl border border-border-subtle bg-sidebar p-4 sm:p-6 flex flex-col items-center gap-4">
      <div className="w-full flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-medium text-secondary">
          {mode === 'export_preview'
            ? 'Print-Ready Full Wrap Simulation (300 DPI Spec Overlay)'
            : 'Interactive Screen Preview (72–96 PPI RGB · Click any panel to edit)'}
        </span>
        <span className="font-mono-tabular text-muted">
          {spec.fullWidthIn}&quot; × {spec.fullHeightIn}&quot; ({spec.fullWidthPx300} ×{' '}
          {spec.fullHeightPx300} px @ 300 DPI)
        </span>
      </div>

      <div className="w-full flex justify-center overflow-x-auto py-2">
        <div
          className="relative w-full max-w-[780px] shadow-2xl rounded-sm overflow-hidden select-none border border-white/15"
          style={{ aspectRatio: `${aspectRatio}` }}
        >
          {/* Optional Print Bleed Outer Overlay */}
          {showPrintGuides && (
            <div
              className="pointer-events-none absolute inset-0 z-30 border-[6px] border-rose-500/25"
              title={`Outer ${spec.bleedIn}" print bleed zone`}
            />
          )}

          <div className="w-full h-full flex">
            {/* BACK COVER PANEL */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelectPanel('back')}
              onKeyDown={(e) => e.key === 'Enter' && onSelectPanel('back')}
              style={{
                width: `${backPct}%`,
                backgroundColor: design.backBgColor,
                color: design.backTextColor,
              }}
              className={cn(
                'relative h-full p-4 sm:p-6 flex flex-col justify-between transition-all cursor-pointer overflow-hidden',
                mode === 'interactive' &&
                  activePanel === 'back' &&
                  'ring-2 ring-inset ring-accent z-10'
              )}
            >
              {showPrintGuides && (
                <div className="pointer-events-none absolute inset-3 border border-dashed border-teal/55" />
              )}

              <div className="relative z-10 space-y-2.5">
                <div
                  className="h-1 w-8 rounded-full"
                  style={{ backgroundColor: design.frontAccentColor }}
                />
                <h4
                  className="font-display text-xs sm:text-sm font-bold leading-snug"
                  style={{ fontFamily: design.titleFontFamily }}
                >
                  {design.backHeadline}
                </h4>
                <p className="text-[10px] sm:text-[11px] leading-relaxed opacity-85 whitespace-pre-line line-clamp-6">
                  {design.backBlurb}
                </p>
              </div>

              <div className="relative z-10 space-y-2.5">
                {design.backAuthorBio && (
                  <p className="text-[9px] sm:text-[10px] opacity-75 leading-snug border-t border-current/15 pt-2 line-clamp-3">
                    {design.backAuthorBio}
                  </p>
                )}

                <div className="flex items-end justify-between gap-2">
                  <span className="text-[9px] font-mono-tabular opacity-65">
                    {spec.trimWidthIn}&quot; × {spec.trimHeightIn}&quot;
                  </span>

                  {design.showIsbnBarcode && (
                    <div
                      className="w-20 sm:w-24 bg-white rounded-[2px] px-1.5 py-1 text-center shrink-0 shadow"
                      title="KDP ISBN Barcode Placement Area (2.0 x 1.2 in)"
                    >
                      <div className="h-6 w-full bg-[repeating-linear-gradient(90deg,#111_0_2px,#fff_2px_3.5px,#111_3.5px_4.5px,#fff_4.5px_6.5px)]" />
                      <p className="text-[7px] font-mono text-black mt-0.5 truncate">
                        {design.isbnNumber || '979-8-0000-0000-0'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SPINE PANEL (Dynamic width driven by actual pageCount * paperCaliper) */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelectPanel('spine')}
              onKeyDown={(e) => e.key === 'Enter' && onSelectPanel('spine')}
              style={{
                width: `${spinePct}%`,
                backgroundColor: design.spineBgColor,
                color: design.spineTextColor,
              }}
              className={cn(
                'relative h-full border-x border-white/12 flex flex-col items-center justify-between py-5 overflow-hidden cursor-pointer transition-all',
                mode === 'interactive' &&
                  activePanel === 'spine' &&
                  'ring-2 ring-inset ring-accent z-10'
              )}
              title={`Calculated Spine Width: ${spec.spineWidthIn}" (${spec.spineWidthPx300} px @ 300 DPI)`}
            >
              {showPrintGuides && (
                <div className="pointer-events-none absolute inset-y-2 inset-x-0.5 border border-dashed border-amber-400/60" />
              )}

              {spec.spineTextAllowed ? (
                <>
                  <span
                    className="text-[9px] sm:text-[10px] font-display font-semibold tracking-wide whitespace-nowrap truncate max-h-[65%]"
                    style={{
                      writingMode: 'vertical-rl',
                      fontFamily: design.titleFontFamily,
                    }}
                  >
                    {design.spineTitle || design.title}
                  </span>
                  <span
                    className="text-[8px] sm:text-[9px] opacity-80 whitespace-nowrap truncate max-h-[25%]"
                    style={{ writingMode: 'vertical-rl' }}
                  >
                    {design.spineAuthor || design.author}
                  </span>
                </>
              ) : (
                <span
                  className="text-[8px] font-mono-tabular opacity-60 whitespace-nowrap"
                  style={{ writingMode: 'vertical-rl' }}
                >
                  &lt; 79 pages
                </span>
              )}
            </div>

            {/* FRONT COVER PANEL */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelectPanel('front')}
              onKeyDown={(e) => e.key === 'Enter' && onSelectPanel('front')}
              style={{
                width: `${frontPct}%`,
                backgroundColor: design.frontBgColor,
                color: design.textColor,
              }}
              className={cn(
                'relative h-full overflow-hidden cursor-pointer transition-all',
                mode === 'interactive' &&
                  activePanel === 'front' &&
                  'ring-2 ring-inset ring-accent z-10'
              )}
            >
              {/* Artwork Layer with Placement & Scale Controls */}
              {design.artworkSrc && (
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ opacity: design.imageOpacity }}
                >
                  <div
                    className="w-full h-full"
                    style={{
                      transform: `scale(${design.imageScale}) translate(${design.imagePosX}%, ${design.imagePosY}%)`,
                      transformOrigin: 'center center',
                    }}
                  >
                    <BookCoverImage
                      src={design.artworkSrc}
                      alt={design.title}
                      title={design.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Contrast Scrim */}
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(180deg, rgba(11,13,18,${design.frontOverlayOpacity}) 0%, rgba(11,13,18,${Math.max(
                    0.15,
                    design.frontOverlayOpacity * 0.45
                  )}) 52%, rgba(11,13,18,${Math.min(0.92, design.frontOverlayOpacity + 0.25)}) 100%)`,
                }}
              />

              {/* Template Structural Accent */}
              {isFramed && (
                <div
                  className="pointer-events-none absolute inset-4 border"
                  style={{ borderColor: `${design.frontAccentColor}99` }}
                />
              )}
              {isGrid && (
                <div
                  className="pointer-events-none absolute inset-0 opacity-20"
                  style={{
                    backgroundImage: `linear-gradient(to right, ${design.frontAccentColor} 1px, transparent 1px), linear-gradient(to bottom, ${design.frontAccentColor} 1px, transparent 1px)`,
                    backgroundSize: '28px 28px',
                  }}
                />
              )}

              {showPrintGuides && (
                <div className="pointer-events-none absolute inset-3 border border-dashed border-teal/55 z-20" />
              )}

              {/* Front Typography Content */}
              <div
                className={cn(
                  'relative z-10 h-full p-5 sm:p-7 flex flex-col justify-between',
                  alignClass
                )}
              >
                <div
                  className={cn(
                    'w-full flex flex-col gap-2',
                    alignClass,
                    isSplitBand && 'rounded-lg bg-black/55 backdrop-blur-[2px] p-3.5'
                  )}
                >
                  <div
                    className="h-1 w-10 rounded-full"
                    style={{ backgroundColor: design.frontAccentColor }}
                  />
                  <h3
                    className="font-bold leading-tight tracking-tight"
                    style={{
                      fontFamily: design.titleFontFamily,
                      fontSize: `${Math.max(14, Math.min(34, design.titleFontSize))}px`,
                      textWrap: 'balance',
                    }}
                  >
                    {design.title || 'Untitled Book'}
                  </h3>
                  {design.subtitle && (
                    <p
                      className="opacity-90 leading-snug max-w-[92%]"
                      style={{
                        fontSize: `${Math.max(10, Math.min(18, design.subtitleFontSize))}px`,
                      }}
                    >
                      {design.subtitle}
                    </p>
                  )}
                </div>

                <div className="w-full pt-2.5 border-t border-current/25 flex items-center justify-between gap-2">
                  <span className="text-[11px] sm:text-xs font-medium tracking-wide truncate">
                    {design.author || 'Author Name'}
                  </span>
                  <span
                    className="h-2 w-6 rounded-full shrink-0"
                    style={{ backgroundColor: design.frontAccentColor }}
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Panel Indicator Strip */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted font-mono-tabular">
        <span>Back: {spec.trimWidthIn}&quot;</span>
        <span aria-hidden="true">·</span>
        <span>
          Spine: {spec.spineWidthIn}&quot; ({spec.spineTextAllowed ? 'Text OK' : 'No Text <79p'})
        </span>
        <span aria-hidden="true">·</span>
        <span>Front: {spec.trimWidthIn}&quot;</span>
        <span aria-hidden="true">·</span>
        <span>Bleed: {spec.bleedIn}&quot; outer</span>
      </div>
    </div>
  );
}
