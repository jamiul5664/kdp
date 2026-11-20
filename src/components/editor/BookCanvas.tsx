import * as React from 'react';
import type { BookPage, BookSettings, ImageElement, TextElement } from '../../types';
import { getPageDimensionsIn } from '../../utils/kdpDimensions';
import { cn } from '../../utils/cn';

interface BookCanvasProps {
  page: BookPage;
  pageNumber: number;
  settings: BookSettings;
  selectedElementId: string | null;
  showGuides: boolean;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (
    elementId: string,
    patch: Partial<TextElement> | Partial<ImageElement>
  ) => void;
}

export function BookCanvas({
  page,
  pageNumber,
  settings,
  selectedElementId,
  showGuides,
  onSelectElement,
  onUpdateElement,
}: BookCanvasProps) {
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const dims = getPageDimensionsIn(settings.trimSize, settings.bleed);
  const aspectRatio = dims.widthIn / dims.heightIn;

  const startDrag = (
    e: React.PointerEvent,
    elementId: string,
    initialX: number,
    initialY: number
  ) => {
    e.stopPropagation();
    onSelectElement(elementId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startClientX = e.clientX;
    const startClientY = e.clientY;

    const handleMove = (moveEvent: PointerEvent) => {
      const dxPct = ((moveEvent.clientX - startClientX) / rect.width) * 100;
      const dyPct = ((moveEvent.clientY - startClientY) / rect.height) * 100;
      const nextX = Math.max(0, Math.min(92, Math.round((initialX + dxPct) * 10) / 10));
      const nextY = Math.max(0, Math.min(92, Math.round((initialY + dyPct) * 10) / 10));
      onUpdateElement(elementId, { x: nextX, y: nextY });
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const patternStyle: React.CSSProperties =
    page.background.pattern === 'lined'
      ? {
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0px, transparent 27px, rgba(15,23,42,0.12) 28px)',
        }
      : page.background.pattern === 'dot-grid'
        ? {
            backgroundImage: 'radial-gradient(rgba(15,23,42,0.18) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }
        : {};

  const marginTopPct = (settings.margins.top / dims.heightIn) * 100;
  const marginBottomPct = (settings.margins.bottom / dims.heightIn) * 100;
  const marginInsidePct = (settings.margins.inside / dims.widthIn) * 100;
  const marginOutsidePct = (settings.margins.outside / dims.widthIn) * 100;

  return (
    <div
      className="flex-1 overflow-auto bg-canvas flex flex-col items-center justify-start py-6 px-4 sm:px-8 gap-3"
      onClick={() => onSelectElement(null)}
    >
      <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono-tabular text-muted">
        <span>
          Page {pageNumber} · {page.label}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {dims.widthIn}&quot; × {dims.heightIn}&quot; ({dims.pixelsAt300Dpi.width} ×{' '}
          {dims.pixelsAt300Dpi.height} px @ 300 DPI)
        </span>
        <span aria-hidden="true">·</span>
        <span>{settings.bleed ? 'Bleed On (+0.125")' : 'No Bleed'}</span>
      </div>

      <div
        ref={canvasRef}
        className="relative w-full max-w-[540px] shadow-2xl rounded-[3px] overflow-hidden border border-border-strong shrink-0"
        style={{
          aspectRatio: `${aspectRatio}`,
          backgroundColor: page.background.color,
          ...patternStyle,
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelectElement(null);
        }}
      >
        {/* Decorative border frame pattern */}
        {page.background.pattern === 'border-frame' && (
          <div className="pointer-events-none absolute inset-6 border border-slate-400/50" />
        )}

        {/* KDP Bleed & Safe Margin Guides */}
        {showGuides && (
          <>
            {settings.bleed && (
              <div className="pointer-events-none absolute inset-0 border-[4px] border-rose-500/20" />
            )}
            <div
              className="pointer-events-none absolute border border-dashed border-accent/45"
              style={{
                top: `${marginTopPct}%`,
                bottom: `${marginBottomPct}%`,
                left: `${pageNumber % 2 === 1 ? marginInsidePct : marginOutsidePct}%`,
                right: `${pageNumber % 2 === 1 ? marginOutsidePct : marginInsidePct}%`,
              }}
            />
          </>
        )}

        {/* Independent Editable Page Elements (never flattened) */}
        {page.elements.map((el) => {
          const selected = el.id === selectedElementId;

          if (el.type === 'text') {
            return (
              <div
                key={el.id}
                onPointerDown={(e) => startDrag(e, el.id, el.x, el.y)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectElement(el.id);
                }}
                style={{
                  position: 'absolute',
                  left: `${el.x}%`,
                  top: `${el.y}%`,
                  width: `${el.width}%`,
                  fontFamily: el.fontFamily,
                  fontSize: `${el.fontSize}px`,
                  fontWeight: el.fontWeight,
                  fontStyle: el.fontStyle,
                  textAlign: el.textAlign,
                  color: el.color,
                  lineHeight: el.lineHeight,
                }}
                className={cn(
                  'px-2 py-1 rounded cursor-move select-none whitespace-pre-wrap break-words transition-shadow',
                  selected
                    ? 'ring-2 ring-accent bg-accent/5'
                    : 'hover:ring-1 hover:ring-accent/50'
                )}
              >
                {el.content}
              </div>
            );
          }

          return (
            <div
              key={el.id}
              onPointerDown={(e) => startDrag(e, el.id, el.x, el.y)}
              onClick={(e) => {
                e.stopPropagation();
                onSelectElement(el.id);
              }}
              style={{
                position: 'absolute',
                left: `${el.x}%`,
                top: `${el.y}%`,
                width: `${el.width}%`,
                height: `${el.height}%`,
                opacity: el.opacity,
              }}
              className={cn(
                'cursor-move select-none rounded overflow-hidden',
                selected ? 'ring-2 ring-accent' : 'hover:ring-1 hover:ring-accent/50'
              )}
            >
              <img
                src={el.src}
                alt={el.alt}
                referrerPolicy="no-referrer"
                draggable={false}
                className="w-full h-full object-contain pointer-events-none"
              />
              {selected && (
                <div className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-mono-tabular text-white">
                  {el.naturalWidth}×{el.naturalHeight}px
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
