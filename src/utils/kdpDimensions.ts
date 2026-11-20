import type { InteriorType, PaperType, TrimSizeId } from '../types';

export interface TrimSizeSpec {
  id: TrimSizeId;
  label: string;
  widthIn: number;
  heightIn: number;
  recommendedFor: string;
}

export const TRIM_SIZES: Record<TrimSizeId, TrimSizeSpec> = {
  '6x9': {
    id: '6x9',
    label: '6" × 9" (Trade Paperback)',
    widthIn: 6,
    heightIn: 9,
    recommendedFor: 'Journals, Non-Fiction, Puzzle Books',
  },
  '8.5x11': {
    id: '8.5x11',
    label: '8.5" × 11" (Large Format)',
    widthIn: 8.5,
    heightIn: 11,
    recommendedFor: 'Coloring Books, Activity Books, Workbooks',
  },
  '8.5x8.5': {
    id: '8.5x8.5',
    label: '8.5" × 8.5" (Square Picture Book)',
    widthIn: 8.5,
    heightIn: 8.5,
    recommendedFor: "Children's Picture Books, Storybooks",
  },
  '5.5x8.5': {
    id: '5.5x8.5',
    label: '5.5" × 8.5" (Digest)',
    widthIn: 5.5,
    heightIn: 8.5,
    recommendedFor: 'Pocket Guides, Devotionals, Short Non-Fiction',
  },
  '7x10': {
    id: '7x10',
    label: '7" × 10" (Textbook / Planner)',
    widthIn: 7,
    heightIn: 10,
    recommendedFor: 'Planners, Technical Guides, Activity Workbooks',
  },
};

export const BLEED_INCHES = 0.125;
export const KDP_MIN_SPINE_TEXT_PAGES = 79;

export function getPaperCaliperIn(paperType: PaperType, interiorType?: InteriorType): number {
  if (interiorType === 'Premium Color') return 0.002347;
  if (interiorType === 'Standard Color') return 0.002252;
  return paperType === 'Cream Paper' ? 0.0025 : 0.002252;
}

export function getPageDimensionsIn(trimSize: TrimSizeId, bleed: boolean) {
  const spec = TRIM_SIZES[trimSize];
  return {
    widthIn: Number((spec.widthIn + (bleed ? BLEED_INCHES : 0)).toFixed(3)),
    heightIn: Number((spec.heightIn + (bleed ? BLEED_INCHES * 2 : 0)).toFixed(3)),
    pixelsAt300Dpi: {
      width: Math.round((spec.widthIn + (bleed ? BLEED_INCHES : 0)) * 300),
      height: Math.round((spec.heightIn + (bleed ? BLEED_INCHES * 2 : 0)) * 300),
    },
  };
}

export function calculateSpineWidthIn(
  pageCount: number,
  paperType: PaperType,
  interiorType?: InteriorType
): number {
  const caliper = getPaperCaliperIn(paperType, interiorType);
  return Number((Math.max(24, pageCount) * caliper).toFixed(4));
}

export interface FullCoverSpec {
  trimWidthIn: number;
  trimHeightIn: number;
  bleedIn: number;
  spineWidthIn: number;
  fullWidthIn: number;
  fullHeightIn: number;
  fullWidthPx300: number;
  fullHeightPx300: number;
  spineWidthPx300: number;
  safeMarginIn: number;
  spineTextAllowed: boolean;
  paperCaliperIn: number;
}

export function calculateFullCoverSpec(params: {
  trimSize: TrimSizeId;
  pageCount: number;
  paperType: PaperType;
  interiorType?: InteriorType;
  bleed?: boolean;
}): FullCoverSpec {
  const spec = TRIM_SIZES[params.trimSize];
  const bleedIn = params.bleed === false ? 0 : BLEED_INCHES;
  const pages = Math.max(24, Math.min(828, Math.round(params.pageCount || 24)));
  const paperCaliperIn = getPaperCaliperIn(params.paperType, params.interiorType);
  const spineWidthIn = Number((pages * paperCaliperIn).toFixed(4));
  const fullWidthIn = Number((bleedIn * 2 + spec.widthIn * 2 + spineWidthIn).toFixed(3));
  const fullHeightIn = Number((bleedIn * 2 + spec.heightIn).toFixed(3));

  return {
    trimWidthIn: spec.widthIn,
    trimHeightIn: spec.heightIn,
    bleedIn,
    spineWidthIn,
    fullWidthIn,
    fullHeightIn,
    fullWidthPx300: Math.round(fullWidthIn * 300),
    fullHeightPx300: Math.round(fullHeightIn * 300),
    spineWidthPx300: Math.round(spineWidthIn * 300),
    safeMarginIn: 0.125,
    spineTextAllowed: pages >= KDP_MIN_SPINE_TEXT_PAGES,
    paperCaliperIn,
  };
}

export const EDITOR_FONT_FAMILIES = [
  { label: 'DM Sans', value: '"DM Sans", sans-serif' },
  { label: 'Plus Jakarta Sans', value: '"Plus Jakarta Sans", sans-serif' },
  { label: 'Playfair Display', value: '"Playfair Display", Georgia, serif' },
  { label: 'Lora Serif', value: '"Lora", Georgia, serif' },
  { label: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
];
