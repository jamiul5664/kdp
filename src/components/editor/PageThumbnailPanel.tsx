import * as React from 'react';
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react';
import type { BookPage, TrimSizeId } from '../../types';
import { TRIM_SIZES } from '../../utils/kdpDimensions';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';

interface PageThumbnailPanelProps {
  pages: BookPage[];
  selectedPageId: string;
  trimSize: TrimSizeId;
  onSelect: (pageId: string) => void;
  onAdd: () => void;
  onDuplicate: (pageId: string) => void;
  onDelete: (pageId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export function PageThumbnailPanel({
  pages,
  selectedPageId,
  trimSize,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onReorder,
}: PageThumbnailPanelProps) {
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const spec = TRIM_SIZES[trimSize];
  const aspectRatio = spec.widthIn / spec.heightIn;

  return (
    <aside className="w-full lg:w-60 shrink-0 border-b lg:border-b-0 lg:border-r border-border-subtle bg-sidebar flex flex-col max-h-56 lg:max-h-none">
      <div className="px-3.5 py-3 border-b border-border-subtle flex items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-xs font-semibold text-foreground">Pages</h3>
          <p className="text-[11px] font-mono-tabular text-muted">{pages.length} editable sheets</p>
        </div>
        <Button size="sm" variant="secondary" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex lg:flex-col gap-3">
        {pages.map((page, index) => {
          const active = page.id === selectedPageId;
          return (
            <div
              key={page.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null && dragIndex !== index) {
                  onReorder(dragIndex, index);
                }
                setDragIndex(null);
              }}
              className={cn(
                'w-36 lg:w-full shrink-0 rounded-xl border p-2.5 transition-colors',
                active
                  ? 'border-accent bg-accent/10'
                  : 'border-border-subtle bg-surface hover:border-border-strong'
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(page.id)}
                className="w-full text-left cursor-pointer"
              >
                <div
                  className="w-full rounded border border-border-subtle overflow-hidden relative shadow-sm"
                  style={{
                    aspectRatio: `${aspectRatio}`,
                    backgroundColor: page.background.color,
                  }}
                >
                  {page.elements.map((el) =>
                    el.type === 'text' ? (
                      <div
                        key={el.id}
                        style={{
                          position: 'absolute',
                          left: `${el.x}%`,
                          top: `${el.y}%`,
                          width: `${el.width}%`,
                          color: el.color,
                          textAlign: el.textAlign,
                          fontFamily: el.fontFamily,
                          fontSize: `${Math.max(4, el.fontSize * 0.28)}px`,
                          fontWeight: el.fontWeight,
                        }}
                        className="pointer-events-none truncate leading-tight"
                      >
                        {el.content}
                      </div>
                    ) : (
                      <img
                        key={el.id}
                        src={el.src}
                        alt=""
                        referrerPolicy="no-referrer"
                        style={{
                          position: 'absolute',
                          left: `${el.x}%`,
                          top: `${el.y}%`,
                          width: `${el.width}%`,
                          height: `${el.height}%`,
                          objectFit: 'contain',
                        }}
                        className="pointer-events-none"
                      />
                    )
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between gap-1">
                  <span className="text-xs font-medium text-foreground truncate">{page.label}</span>
                  <span className="text-[11px] font-mono-tabular text-muted shrink-0">
                    #{index + 1}
                  </span>
                </div>
              </button>

              <div className="mt-2 pt-2 border-t border-border-subtle flex items-center justify-between gap-1">
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => onReorder(index, index - 1)}
                    aria-label="Move page up"
                    className="h-6 w-6 rounded inline-flex items-center justify-center text-muted hover:text-foreground hover:bg-surface-hover disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    disabled={index === pages.length - 1}
                    onClick={() => onReorder(index, index + 1)}
                    aria-label="Move page down"
                    className="h-6 w-6 rounded inline-flex items-center justify-center text-muted hover:text-foreground hover:bg-surface-hover disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>

                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => onDuplicate(page.id)}
                    aria-label="Duplicate page"
                    className="h-6 w-6 rounded inline-flex items-center justify-center text-muted hover:text-foreground hover:bg-surface-hover cursor-pointer"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    disabled={pages.length <= 1}
                    onClick={() => onDelete(page.id)}
                    aria-label="Delete page"
                    className="h-6 w-6 rounded inline-flex items-center justify-center text-muted hover:text-rose-400 hover:bg-surface-hover disabled:opacity-30 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
