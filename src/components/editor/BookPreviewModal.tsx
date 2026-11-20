import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { BookPage, BookSettings } from '../../types';
import { getPageDimensionsIn } from '../../utils/kdpDimensions';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface BookPreviewModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  pages: BookPage[];
  settings: BookSettings;
}

export function BookPreviewModal({
  open,
  onClose,
  title,
  pages,
  settings,
}: BookPreviewModalProps) {
  const [pageIdx, setPageIdx] = React.useState(0);
  const dims = getPageDimensionsIn(settings.trimSize, settings.bleed);
  const aspectRatio = dims.widthIn / dims.heightIn;

  React.useEffect(() => {
    if (!open) return;
    setPageIdx(0);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setPageIdx((i) => Math.min(pages.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setPageIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, pages.length]);

  const current = pages[pageIdx];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Full Book Preview — ${title}`}
      description={`${settings.trimSize}" · ${settings.interiorType} · ${settings.paperType} · ${
        settings.bleed ? 'Full Bleed' : 'No Bleed'
      }`}
      maxWidthClass="max-w-3xl"
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          <span className="text-xs font-mono-tabular text-muted">
            Page {pageIdx + 1} of {pages.length} · Use Left/Right arrow keys
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={pageIdx === 0}
              onClick={() => setPageIdx((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={pageIdx >= pages.length - 1}
              onClick={() => setPageIdx((i) => Math.min(pages.length - 1, i + 1))}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      }
    >
      {current && (
        <div className="flex justify-center py-2">
          <div
            className="relative w-full max-w-[420px] rounded shadow-xl border border-border-strong overflow-hidden"
            style={{
              aspectRatio: `${aspectRatio}`,
              backgroundColor: current.background.color,
            }}
          >
            {current.elements.map((el) =>
              el.type === 'text' ? (
                <div
                  key={el.id}
                  style={{
                    position: 'absolute',
                    left: `${el.x}%`,
                    top: `${el.y}%`,
                    width: `${el.width}%`,
                    fontFamily: el.fontFamily,
                    fontSize: `${el.fontSize * 0.8}px`,
                    fontWeight: el.fontWeight,
                    fontStyle: el.fontStyle,
                    textAlign: el.textAlign,
                    color: el.color,
                    lineHeight: el.lineHeight,
                  }}
                  className="whitespace-pre-wrap break-words"
                >
                  {el.content}
                </div>
              ) : (
                <img
                  key={el.id}
                  src={el.src}
                  alt={el.alt}
                  referrerPolicy="no-referrer"
                  style={{
                    position: 'absolute',
                    left: `${el.x}%`,
                    top: `${el.y}%`,
                    width: `${el.width}%`,
                    height: `${el.height}%`,
                    opacity: el.opacity,
                    objectFit: 'contain',
                  }}
                />
              )
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
