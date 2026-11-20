import type {
  EvidenceSource,
  MarketplaceId,
  NicheDetailReport,
  NicheOpportunity,
  ResearchQueryParams,
} from '../types';
import { apiPost } from './apiClient';

export interface ResearchNichesResponse {
  niches: NicheOpportunity[];
  sources: EvidenceSource[];
  researchDate: string;
  query: string;
}

export async function searchMarketNiches(
  params: ResearchQueryParams
): Promise<ResearchNichesResponse> {
  const raw = await apiPost<Partial<ResearchNichesResponse>, ResearchQueryParams>(
    '/research/niches',
    params
  );
  const sources = Array.isArray(raw?.sources) ? raw.sources : [];
  const rawNiches = Array.isArray(raw?.niches) ? raw.niches : [];
  const today = raw?.researchDate || new Date().toISOString().split('T')[0];

  const niches: NicheOpportunity[] = rawNiches.map((item, idx) => ({
    id: item?.id || `niche_${Date.now()}_${idx}`,
    nicheName: item?.nicheName || 'Untitled KDP Niche',
    category: item?.category || 'Non-Fiction Guides',
    targetAudience: item?.targetAudience || params.targetAudience || 'General',
    marketplace: item?.marketplace || params.marketplace || 'amazon.com',
    researchDate: item?.researchDate || today,
    aiEstimates: {
      demandScore: Number(item?.aiEstimates?.demandScore ?? 0),
      competitionScore: Number(item?.aiEstimates?.competitionScore ?? 50),
      keywordOpportunityScore: Number(item?.aiEstimates?.keywordOpportunityScore ?? 0),
      confidenceNote: item?.aiEstimates?.confidenceNote || 'AI strategic estimate.',
    },
    measuredSignals: {
      observedCompetitors: Number(item?.measuredSignals?.observedCompetitors ?? 0),
      averageObservedReviews: Number(item?.measuredSignals?.averageObservedReviews ?? 0),
      priceRangeObserved: item?.measuredSignals?.priceRangeObserved || 'Not Available',
      sourceCount: Number(item?.measuredSignals?.sourceCount ?? sources.length),
      measurementMethod:
        item?.measuredSignals?.measurementMethod || 'Observed from web search results',
    },
    summary: item?.summary || '',
    evidenceSources: Array.isArray(item?.evidenceSources) ? item.evidenceSources : sources.slice(0, 4),
    tags: Array.isArray(item?.tags) ? item.tags : [],
  }));

  return {
    niches,
    sources,
    researchDate: today,
    query: raw?.query || params.query,
  };
}

export async function fetchNicheDetail(params: {
  nicheName: string;
  category?: string;
  marketplace: MarketplaceId;
}): Promise<NicheDetailReport> {
  return apiPost<NicheDetailReport>('/research/niche-detail', params);
}
