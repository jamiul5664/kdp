import * as React from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ImagePlus,
  Lock,
  Trash2,
  Type,
  Unlock,
} from 'lucide-react';
import type {
  BookPage,
  BookSettings,
  ImageElement,
  InteriorType,
  PageBackground,
  PaperType,
  TextAlign,
  TextElement,
  TrimSizeId,
} from '../../types';
import { EDITOR_FONT_FAMILIES, TRIM_SIZES } from '../../utils/kdpDimensions';
import { COVER_ASSETS } from '../../stores/useAppStore';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { cn } from '../../utils/cn';

interface PropertiesPanelProps {
  page: BookPage;
  settings: BookSettings;
  selectedElementId: string | null;
  onUpdatePageLabel: (label: string) => void;
  onUpdatePageBackground: (patch: Partial<PageBackground>) => void;
  onAddText: () => void;
  onAddImage: (payload: {
    src: string;
    alt: string;
    naturalWidth: number;
    naturalHeight: number;
  }) => void;
  onUpdateElement: (
    elementId: string,
    patch: Partial<TextElement> | Partial<ImageElement>
  ) => void;
  onDeleteElement: (elementId: string) => void;
  onUpdateSettings: (patch: Partial<BookSettings>) => void;
}

const STUDIO_LIBRARY_IMAGES = [
  { label: 'Botanical Plate', src: COVER_ASSETS.botanicals, w: 1536, h: 2048 },
  { label: 'Woodland Lantern', src: COVER_ASSETS.forest, w: 1536, h: 2048 },
  { label: 'Logic Labyrinth', src: COVER_ASSETS.puzzles, w: 1536, h: 2048 },
  { label: 'Minimalist Linen', src: COVER_ASSETS.journal, w: 1536, h: 2048 },
];

export function PropertiesPanel({
  page,
  settings,
  selectedElementId,
  onUpdatePageLabel,
  onUpdatePageBackground,
  onAddText,
  onAddImage,
  onUpdateElement,
  onDeleteElement,
  onUpdateSettings,
}: PropertiesPanelProps) {
  const [tab, setTab] = React.useState<'element' | 'book'>('element');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const selectedElement = page.elements.find((el) => el.id === selectedElementId) ?? null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        onAddImage({
          src: dataUrl,
          alt: file.name,
          naturalWidth: img.naturalWidth || 1200,
          naturalHeight: img.naturalHeight || 1600,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleImageWidthChange = (el: ImageElement, nextWidth: number) => {
    const clampedW = Math.max(10, Math.min(100, nextWidth));
    if (el.lockAspectRatio && el.naturalWidth > 0) {
      const ratio = el.naturalHeight / el.naturalWidth;
      const nextHeight = Math.max(10, Math.min(100, Math.round(clampedW * ratio * 0.78)));
      onUpdateElement(el.id, { width: clampedW, height: nextHeight });
    } else {
      onUpdateElement(el.id, { width: clampedW });
    }
  };

  return (
    <aside className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-border-subtle bg-sidebar flex flex-col">
      <div className="p-2.5 border-b border-border-subtle flex items-center gap-1">
        <button
          type="button"
          onClick={() => setTab('element')}
          className={cn(
            'flex-1 h-8 rounded-lg text-xs font-medium transition-colors cursor-pointer',
            tab === 'element'
              ? 'bg-accent text-white'
              : 'text-secondary hover:text-foreground hover:bg-surface-hover'
          )}
        >
          Page &amp; Element
        </button>
        <button
          type="button"
          onClick={() => setTab('book')}
          className={cn(
            'flex-1 h-8 rounded-lg text-xs font-medium transition-colors cursor-pointer',
            tab === 'book'
              ? 'bg-accent text-white'
              : 'text-secondary hover:text-foreground hover:bg-surface-hover'
          )}
        >
          Book Settings
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {tab === 'element' ? (
          <>
            {/* Insert Controls */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted">Insert on Current Page</p>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="secondary" onClick={onAddText}>
                  <Type className="h-3.5 w-3.5" />
                  Add Text
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  Insert Image
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {STUDIO_LIBRARY_IMAGES.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() =>
                      onAddImage({
                        src: item.src,
                        alt: item.label,
                        naturalWidth: item.w,
                        naturalHeight: item.h,
                      })
                    }
                    className="rounded-lg border border-border-subtle bg-surface hover:bg-surface-hover px-2 py-1.5 text-[11px] text-secondary hover:text-foreground text-left truncate cursor-pointer"
                  >
                    + {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Element Inspector */}
            {selectedElement ? (
              <div className="pt-4 border-t border-border-subtle space-y-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">
                    {selectedElement.type === 'text' ? 'Text Properties' : 'Image Properties'}
                  </p>
                  <button
                    type="button"
                    onClick={() => onDeleteElement(selectedElement.id)}
                    aria-label="Delete selected element"
                    className="inline-flex items-center gap-1 text-xs text-rose-400 hover:underline cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>

                {selectedElement.type === 'text' ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs text-secondary">Text Content</label>
                      <textarea
                        rows={4}
                        value={selectedElement.content}
                        onChange={(e) =>
                          onUpdateElement(selectedElement.id, { content: e.target.value })
                        }
                        className="w-full rounded-lg bg-canvas border border-border-subtle p-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-secondary">Font Family</label>
                      <Select
                        value={selectedElement.fontFamily}
                        onChange={(e) =>
                          onUpdateElement(selectedElement.id, { fontFamily: e.target.value })
                        }
                      >
                        {EDITOR_FONT_FAMILIES.map((f) => (
                          <option key={f.label} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-xs text-secondary">Font Size (pt)</label>
                        <Input
                          type="number"
                          min={8}
                          max={72}
                          value={selectedElement.fontSize}
                          onChange={(e) =>
                            onUpdateElement(selectedElement.id, {
                              fontSize: Math.max(8, Number(e.target.value) || 12),
                            })
                          }
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-secondary">Text Color</label>
                        <input
                          type="color"
                          value={selectedElement.color}
                          onChange={(e) =>
                            onUpdateElement(selectedElement.id, { color: e.target.value })
                          }
                          className="h-10 w-full rounded-lg bg-canvas border border-border-subtle p-1 cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-secondary">Alignment</label>
                      <div className="grid grid-cols-4 gap-1 bg-canvas p-1 rounded-lg border border-border-subtle">
                        {(
                          [
                            ['left', AlignLeft],
                            ['center', AlignCenter],
                            ['right', AlignRight],
                            ['justify', AlignJustify],
                          ] as Array<[TextAlign, typeof AlignLeft]>
                        ).map(([align, Icon]) => (
                          <button
                            key={align}
                            type="button"
                            onClick={() =>
                              onUpdateElement(selectedElement.id, { textAlign: align })
                            }
                            aria-label={`Align ${align}`}
                            className={cn(
                              'h-8 rounded inline-flex items-center justify-center transition-colors cursor-pointer',
                              selectedElement.textAlign === align
                                ? 'bg-accent text-white'
                                : 'text-secondary hover:text-foreground'
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant={selectedElement.fontWeight === 'bold' ? 'primary' : 'secondary'}
                        onClick={() =>
                          onUpdateElement(selectedElement.id, {
                            fontWeight: selectedElement.fontWeight === 'bold' ? 'normal' : 'bold',
                          })
                        }
                      >
                        Bold
                      </Button>
                      <Button
                        size="sm"
                        variant={selectedElement.fontStyle === 'italic' ? 'primary' : 'secondary'}
                        onClick={() =>
                          onUpdateElement(selectedElement.id, {
                            fontStyle:
                              selectedElement.fontStyle === 'italic' ? 'normal' : 'italic',
                          })
                        }
                      >
                        Italic
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-lg bg-surface border border-border-subtle p-3 text-xs space-y-1">
                      <p className="text-muted">Original Source Resolution Preserved</p>
                      <p className="font-mono-tabular font-semibold text-teal">
                        {selectedElement.naturalWidth} × {selectedElement.naturalHeight} px
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-secondary">Aspect Ratio Lock</span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          onUpdateElement(selectedElement.id, {
                            lockAspectRatio: !selectedElement.lockAspectRatio,
                          })
                        }
                      >
                        {selectedElement.lockAspectRatio ? (
                          <>
                            <Lock className="h-3.5 w-3.5 text-teal" />
                            Locked
                          </>
                        ) : (
                          <>
                            <Unlock className="h-3.5 w-3.5" />
                            Free
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-xs text-secondary">Width (%)</label>
                        <Input
                          type="number"
                          min={10}
                          max={100}
                          value={selectedElement.width}
                          onChange={(e) =>
                            handleImageWidthChange(selectedElement, Number(e.target.value))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-secondary">Height (%)</label>
                        <Input
                          type="number"
                          min={10}
                          max={100}
                          value={selectedElement.height}
                          onChange={(e) =>
                            onUpdateElement(selectedElement.id, {
                              height: Math.max(10, Math.min(100, Number(e.target.value))),
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-secondary">
                        <span>Opacity</span>
                        <span className="font-mono-tabular">
                          {Math.round(selectedElement.opacity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        value={Math.round(selectedElement.opacity * 100)}
                        onChange={(e) =>
                          onUpdateElement(selectedElement.id, {
                            opacity: Number(e.target.value) / 100,
                          })
                        }
                        className="w-full accent-[#8B7CFF]"
                      />
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted pt-3 border-t border-border-subtle">
                Select any text block or image on the page canvas to adjust its typography or
                dimensions.
              </p>
            )}

            {/* Page Background & Label */}
            <div className="pt-4 border-t border-border-subtle space-y-3">
              <p className="text-xs font-semibold text-foreground">Page Properties</p>
              <div className="space-y-1">
                <label className="text-xs text-secondary">Page Label</label>
                <Input
                  value={page.label}
                  onChange={(e) => onUpdatePageLabel(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs text-secondary">Background</label>
                  <input
                    type="color"
                    value={page.background.color}
                    onChange={(e) => onUpdatePageBackground({ color: e.target.value })}
                    className="h-10 w-full rounded-lg bg-canvas border border-border-subtle p-1 cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-secondary">Pattern</label>
                  <Select
                    value={page.background.pattern}
                    onChange={(e) =>
                      onUpdatePageBackground({
                        pattern: e.target.value as PageBackground['pattern'],
                      })
                    }
                  >
                    <option value="none">Clean Paper</option>
                    <option value="lined">Journal Lines</option>
                    <option value="dot-grid">Dot Grid</option>
                    <option value="border-frame">Editorial Frame</option>
                  </Select>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* BOOK SETTINGS TAB */
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-secondary">KDP Trim Size</label>
              <Select
                value={settings.trimSize}
                onChange={(e) => onUpdateSettings({ trimSize: e.target.value as TrimSizeId })}
              >
                {Object.values(TRIM_SIZES).map((spec) => (
                  <option key={spec.id} value={spec.id}>
                    {spec.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-secondary">Target Page Count (24–828)</label>
              <Input
                type="number"
                min={24}
                max={828}
                value={settings.pageCount}
                onChange={(e) =>
                  onUpdateSettings({
                    pageCount: Math.max(24, Math.min(828, Number(e.target.value) || 24)),
                  })
                }
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-secondary">Interior Type</label>
              <Select
                value={settings.interiorType}
                onChange={(e) =>
                  onUpdateSettings({ interiorType: e.target.value as InteriorType })
                }
              >
                <option value="Black & White">Black &amp; White</option>
                <option value="Standard Color">Standard Color</option>
                <option value="Premium Color">Premium Color</option>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-secondary">Paper Type</label>
              <Select
                value={settings.paperType}
                onChange={(e) => onUpdateSettings({ paperType: e.target.value as PaperType })}
              >
                <option value="White Paper">White Paper (0.002252&quot;/pg)</option>
                <option value="Cream Paper">Cream Paper (0.002500&quot;/pg)</option>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface px-3 py-2.5">
              <div>
                <p className="text-xs font-medium text-foreground">Full Bleed</p>
                <p className="text-[11px] text-muted">Adds 0.125&quot; outer &amp; top/bottom</p>
              </div>
              <input
                type="checkbox"
                checked={settings.bleed}
                onChange={(e) => onUpdateSettings({ bleed: e.target.checked })}
                className="h-4 w-4 accent-[#8B7CFF] cursor-pointer"
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-border-subtle">
              <p className="text-xs font-semibold text-foreground">Margins (inches)</p>
              <div className="grid grid-cols-2 gap-2.5">
                {(['top', 'bottom', 'inside', 'outside'] as const).map((side) => (
                  <div key={side} className="space-y-1">
                    <label className="text-xs text-secondary capitalize">{side}</label>
                    <Input
                      type="number"
                      step={0.05}
                      min={0.25}
                      max={1.5}
                      value={settings.margins[side]}
                      onChange={(e) =>
                        onUpdateSettings({
                          margins: {
                            ...settings.margins,
                            [side]: Math.max(0.25, Number(e.target.value) || 0.375),
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
