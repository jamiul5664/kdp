import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Compass,
  Download,
  ExternalLink,
  History,
  KeyRound,
  LayoutGrid,
  Loader2,
  MessageSquareQuote,
  Radar,
  Search,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import {
  useAdvancedStudioStore,
  type CompetitorGapRecord,
} from '../../stores/useAdvancedStudioStore';
import {
  analyzeCustomerReviews,
  buildSeasonalCalendar,
  buildSevenKdpKeywordSlots,
  exportKeywordsToCsv,
  parseKeywordsCsv,
  parseReviewsCsv,
  type KeywordResearchRecord,
} from '../../utils/kdpAdvancedEngines';
import { searchMarketNiches } from '../../services/researchService';
import { apiPost } from '../../services/apiClient';
import type { MarketplaceId } from '../../types';

type IntelTab =
  | 'overview'
  | 'explorer'
  | 'competitor-gap'
  | 'keywords'
  | 'reviews'
  | 'seasonal'
  | 'trends'
  | 'history';

const TABS: Array<{ id: IntelTab; label: string; icon: typeof LayoutGrid }> = [
  { id: 'overview', label: 'Market Overview', icon: LayoutGrid },
  { id: 'explorer', label: 'Niche Explorer', icon: Compass },
  { id: 'competitor-gap', label: 'Competitor Gap', icon: Radar },
  { id: 'keywords', label: 'Keywords', icon: KeyRound },
  { id: 'reviews', label: 'Review Intel', icon: MessageSquareQuote },
  { id: 'seasonal', label: 'Seasonal', icon: Calendar },
  { id: 'trends', label: 'Trends', icon: TrendingUp },
  { id: 'history', label: 'History', icon: History },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function IntelligenceHubPage() {
  const [activeTab, setActiveTab] = useState<IntelTab>('overview');
  const { researchResults, setResearchResults, setSelectedNiche, setRoute } = useAppStore();
  const {
    competitorGapReports,
    addCompetitorGapReport,
    keywordRecords,
    setKeywordRecords,
    reviewReport,
    setReviewReport,
    researchHistory,
    addResearchHistory,
  } = useAdvancedStudioStore();

  // Niche Explorer state
  const [nicheQuery, setNicheQuery] = useState('Large print cozy coloring books for adults');
  const [nicheCategory, setNicheCategory] = useState('Coloring Books');
  const [nicheMarketplace, setNicheMarketplace] = useState<MarketplaceId>('amazon.com');
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [explorerError, setExplorerError] = useState<string | null>(null);
  const [minDemandFilter, setMinDemandFilter] = useState(0);

  // Competitor Gap state
  const [gapQuery, setGapQuery] = useState('Botanical coloring books for adults');
  const [gapCsv, setGapCsv] = useState('');
  const [gapLoading, setGapLoading] = useState(false);
  const [gapError, setGapError] = useState<string | null>(null);

  // Keyword Research state
  const [kwSeed, setKwSeed] = useState('mindful wildflower coloring book');
  const [kwTitleCheck, setKwTitleCheck] = useState('Mindful Botanicals: Wildflower Line Art');
  const [kwClusterFilter, setKwClusterFilter] = useState('All');
  const [kwLoading, setKwLoading] = useState(false);
  const [kwError, setKwError] = useState<string | null>(null);

  // Review Intel state
  const [reviewCsv, setReviewCsv] = useState('');
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);

  // Seasonal state
  const seasonalEvents = useMemo(() => buildSeasonalCalendar('2026-11-20'), []);
  const [selectedEventId, setSelectedEventId] = useState<string>(seasonalEvents[0]?.id || 'christmas');
  const [seasonalMonthFilter, setSeasonalMonthFilter] = useState<number | 'all'>('all');

  // History filter
  const [historyFilter, setHistoryFilter] = useState('All');

  const activeGap = competitorGapReports[0] ?? null;
  const selectedEvent = seasonalEvents.find((e) => e.id === selectedEventId) ?? seasonalEvents[0];

  const handleRunNicheExplorer = async () => {
    if (!nicheQuery.trim()) return;
    setExplorerLoading(true);
    setExplorerError(null);
    try {
      const res = await searchMarketNiches({
        query: nicheQuery.trim(),
        category: nicheCategory,
        targetAudience: 'Adults & Gift Buyers',
        marketplace: nicheMarketplace,
        dateRange: '90d',
      });
      setResearchResults(res.niches);
      addResearchHistory({
        type: 'Niche Research',
        query: nicheQuery.trim(),
        marketplace: nicheMarketplace,
        confidenceScore: res.sources.length > 0 ? 78 : 58,
        sourceCount: res.sources.length,
        summary: `Evaluated ${res.niches.length} niche angles in ${nicheCategory}.`,
      });
    } catch (err) {
      setExplorerError(err instanceof Error ? err.message : 'Market research request failed.');
    } finally {
      setExplorerLoading(false);
    }
  };

  const handleRunCompetitorGap = async (useCsv = false) => {
    setGapLoading(true);
    setGapError(null);
    try {
      const result = await apiPost<CompetitorGapRecord>('/intelligence/competitor-gap', {
        niche: gapQuery.trim(),
        marketplace: nicheMarketplace,
        csvText: useCsv ? gapCsv : undefined,
      });
      addCompetitorGapReport(result);
      addResearchHistory({
        type: 'Competitor Gap',
        query: result.niche,
        marketplace: result.marketplace,
        confidenceScore: result.confidenceScore,
        sourceCount: result.evidenceSources.length,
        summary: `Opportunity Score ${result.opportunityScore}/100 · ${result.missingFeatures.length} missing features identified.`,
      });
    } catch (err) {
      setGapError(err instanceof Error ? err.message : 'Competitor gap analysis failed.');
    } finally {
      setGapLoading(false);
    }
  };

  const handleRunKeywords = async () => {
    if (!kwSeed.trim()) return;
    setKwLoading(true);
    setKwError(null);
    try {
      const res = await apiPost<{
        keywords: KeywordResearchRecord[];
        sources: Array<{ title: string; url: string; domain: string }>;
      }>('/intelligence/keywords', {
        seed: kwSeed.trim(),
        marketplace: nicheMarketplace,
        category: nicheCategory,
      });
      setKeywordRecords(res.keywords);
      addResearchHistory({
        type: 'Keyword Intelligence',
        query: kwSeed.trim(),
        marketplace: nicheMarketplace,
        confidenceScore: res.sources.length > 0 ? 74 : 54,
        sourceCount: res.sources.length,
        summary: `Discovered ${res.keywords.length} KDP phrases (unverified volumes explicitly marked Unavailable).`,
      });
    } catch (err) {
      setKwError(err instanceof Error ? err.message : 'Keyword discovery failed.');
    } finally {
      setKwLoading(false);
    }
  };

  const handleKeywordCsvUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const parsed = parseKeywordsCsv(text);
      if (parsed.length > 0) {
        setKeywordRecords([...parsed, ...keywordRecords]);
        addResearchHistory({
          type: 'Keyword Intelligence',
          query: `CSV Import: ${file.name}`,
          marketplace: nicheMarketplace,
          confidenceScore: 84,
          sourceCount: 1,
          summary: `Imported ${parsed.length} keyword rows from authorized user CSV.`,
        });
      }
    };
    reader.readAsText(file);
  };

  const handleAnalyzeReviews = (rawText: string) => {
    const rows = parseReviewsCsv(rawText);
    if (rows.length === 0) {
      setReviewNotice('Upload or paste at least one CSV row: Competitor Title, Rating, Review Text, Source URL');
      return;
    }
    const output = analyzeCustomerReviews(rows);
    setReviewReport(output);
    setReviewNotice(null);
    addResearchHistory({
      type: 'Review Intelligence',
      query: `${rows.length} Uploaded Customer Reviews`,
      marketplace: nicheMarketplace,
      confidenceScore: Math.min(92, 68 + rows.length * 2),
      sourceCount: output.sourceLinks.length,
      summary: `Analyzed ${output.totalReviewsAnalyzed} anonymized reviews · ${output.commonComplaints.length} pain point clusters.`,
    });
  };

  const handleExportIntelligenceReport = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      marketplace: nicheMarketplace,
      nichesEvaluated: researchResults.length,
      competitorGapReports: competitorGapReports.slice(0, 3),
      keywordsCount: keywordRecords.length,
      sevenKdpSlots: buildSevenKdpKeywordSlots(keywordRecords, kwTitleCheck),
      reviewSummary: reviewReport,
      seasonalEvents: seasonalEvents.map((e) => ({
        event: e.event,
        eventDate: e.eventDate,
        researchDeadline: e.researchDeadline,
        suggestedPrepDate: e.suggestedPrepDate,
      })),
    };
    downloadTextFile(
      `kdp-market-intelligence-${new Date().toISOString().split('T')[0]}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
  };

  const clusters = useMemo(() => {
    const map = new Map<string, number>();
    keywordRecords.forEach((k) => map.set(k.cluster, (map.get(k.cluster) || 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [keywordRecords]);

  const filteredKeywords = useMemo(
    () =>
      kwClusterFilter === 'All'
        ? keywordRecords
        : keywordRecords.filter((k) => k.cluster === kwClusterFilter),
    [keywordRecords, kwClusterFilter]
  );

  const sevenSlots = useMemo(
    () => buildSevenKdpKeywordSlots(keywordRecords, kwTitleCheck),
    [keywordRecords, kwTitleCheck]
  );

  const filteredNiches = useMemo(
    () =>
      (researchResults ?? [])
        .filter((n) => (n.aiEstimates?.demandScore ?? 0) >= minDemandFilter)
        .sort(
          (a, b) =>
            (b.aiEstimates?.demandScore ?? 0) -
            (b.aiEstimates?.competitionScore ?? 0) -
            ((a.aiEstimates?.demandScore ?? 0) - (a.aiEstimates?.competitionScore ?? 0))
        ),
    [researchResults, minDemandFilter]
  );

  const avgDemand =
    filteredNiches.length > 0
      ? Math.round(filteredNiches.reduce((s, n) => s + (n.aiEstimates?.demandScore ?? 0), 0) / filteredNiches.length)
      : null;
  const avgCompetition =
    filteredNiches.length > 0
      ? Math.round(
          filteredNiches.reduce((s, n) => s + (n.aiEstimates?.competitionScore ?? 0), 0) / filteredNiches.length
        )
      : null;

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-border-subtle pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Market Intelligence Suite · Transparent Grounded Data
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground">
            KDP Market Intelligence Hub
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Real backend API research, competitor gap tables, keyword clusters, anonymized review analysis, and seasonal publishing calendars.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={nicheMarketplace}
            onChange={(e) => setNicheMarketplace(e.target.value as MarketplaceId)}
            className="h-9 rounded-lg border border-border-subtle bg-surface px-3 text-xs font-medium text-foreground"
            aria-label="Marketplace selector"
          >
            <option value="amazon.com">amazon.com (US)</option>
            <option value="amazon.co.uk">amazon.co.uk (UK)</option>
            <option value="amazon.de">amazon.de (DE)</option>
            <option value="amazon.ca">amazon.ca (CA)</option>
            <option value="amazon.com.au">amazon.com.au (AU)</option>
          </select>
          <button
            type="button"
            onClick={handleExportIntelligenceReport}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3.5 text-xs font-medium text-foreground hover:bg-elevated transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export Report
          </button>
        </div>
      </div>

      {/* 8-Page Navigation Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border-subtle pb-px">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                active
                  ? 'border-accent text-foreground'
                  : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 1. MARKET OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Strip */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border-subtle bg-surface p-4">
              <p className="text-xs text-muted">Demand Overview (AI Estimate)</p>
              <p className="mt-2 font-mono-tabular text-2xl font-bold text-foreground">
                {avgDemand !== null ? `${avgDemand}/100` : 'Run Explorer'}
              </p>
              <p className="mt-1 text-xs text-secondary">
                {filteredNiches.length > 0
                  ? `${filteredNiches.length} niches evaluated · ${nicheMarketplace}`
                  : 'Use Niche Explorer to fetch grounded demand'}
              </p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-surface p-4">
              <p className="text-xs text-muted">Competition Analysis</p>
              <p className="mt-2 font-mono-tabular text-2xl font-bold text-foreground">
                {avgCompetition !== null ? `${avgCompetition}/100` : 'Unavailable'}
              </p>
              <p className="mt-1 text-xs text-secondary">Lower score indicates wider differentiation room</p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-surface p-4">
              <p className="text-xs text-muted">Keyword Clusters Ready</p>
              <p className="mt-2 font-mono-tabular text-2xl font-bold text-foreground">
                {keywordRecords.length}
              </p>
              <p className="mt-1 text-xs text-secondary">
                {clusters.length} intent clusters · {sevenSlots.length}/7 KDP slots drafted
              </p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-surface p-4">
              <p className="text-xs text-muted">Next Seasonal Prep Window</p>
              <p className="mt-2 font-mono-tabular text-2xl font-bold text-teal">
                {seasonalEvents[0].event}
              </p>
              <p className="mt-1 text-xs text-secondary">
                Target date {seasonalEvents[0].eventDate} · {seasonalEvents[0].leadTimeDays}d lead
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Opportunity Ranking */}
            <div className="lg:col-span-2 rounded-xl border border-border-subtle bg-surface p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Opportunity Ranking</h2>
                  <p className="text-xs text-muted">Ranked by Demand minus Competition · Grounded backend API data</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('explorer')}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  Open Niche Explorer
                </button>
              </div>
              {filteredNiches.length === 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-border-subtle p-6 text-center">
                  <p className="text-sm text-secondary">No live niche query run in this session yet.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('explorer');
                      void handleRunNicheExplorer();
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90"
                  >
                    <Search className="h-3.5 w-3.5" />
                    Run Live Market Research
                  </button>
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border-subtle text-muted">
                        <th className="pb-2 font-medium">Niche</th>
                        <th className="pb-2 font-medium">Demand</th>
                        <th className="pb-2 font-medium">Competition</th>
                        <th className="pb-2 font-medium">Price Range</th>
                        <th className="pb-2 font-medium text-right">Sources</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {filteredNiches.slice(0, 6).map((n) => (
                        <tr key={n.id} className="hover:bg-elevated/40">
                          <td className="py-2.5 pr-3 font-medium text-foreground">{n.nicheName}</td>
                          <td className="py-2.5 font-mono-tabular text-teal">{n.aiEstimates.demandScore}</td>
                          <td className="py-2.5 font-mono-tabular text-secondary">{n.aiEstimates.competitionScore}</td>
                          <td className="py-2.5 font-mono-tabular text-secondary">{n.measuredSignals.priceRangeObserved}</td>
                          <td className="py-2.5 text-right font-mono-tabular text-muted">{n.evidenceSources.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Customer Pain Points & Research Sources */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border-subtle bg-surface p-5">
                <h2 className="text-sm font-semibold text-foreground">Customer Pain Points</h2>
                {reviewReport ? (
                  <ul className="mt-3 space-y-2 text-xs text-secondary">
                    {reviewReport.commonComplaints.slice(0, 4).map((c) => (
                      <li key={c.complaint} className="flex items-start justify-between gap-2">
                        <span>{c.complaint}</span>
                        <span className="font-mono-tabular text-foreground shrink-0">{c.mentions}×</span>
                      </li>
                    ))}
                  </ul>
                ) : activeGap ? (
                  <ul className="mt-3 space-y-2 text-xs text-secondary">
                    {activeGap.customerComplaints.slice(0, 4).map((c, idx) => (
                      <li key={idx}>· {c}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted">
                    Upload customer review CSVs in Review Intel or run Competitor Gap Analysis to inspect verified pain points.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-border-subtle bg-surface p-5">
                <h2 className="text-sm font-semibold text-foreground">Recent Research Sources</h2>
                <p className="mt-1 text-xs text-muted">
                  Data freshness and source attribution are recorded on every research run.
                </p>
                <div className="mt-3 space-y-2">
                  {researchHistory.slice(0, 4).map((h) => (
                    <div key={h.id} className="border-b border-border-subtle pb-2 last:border-0 last:pb-0">
                      <p className="text-xs font-medium text-foreground truncate">{h.query}</p>
                      <p className="text-[11px] text-muted">
                        {h.type} · Confidence {h.confidenceScore}% · {h.sourceCount} sources
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. NICHE EXPLORER */}
      {activeTab === 'explorer' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border-subtle bg-surface p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <input
                type="text"
                value={nicheQuery}
                onChange={(e) => setNicheQuery(e.target.value)}
                placeholder="Search KDP niche topic or reader segment..."
                className="md:col-span-6 h-10 rounded-lg border border-border-subtle bg-canvas px-3 text-sm text-foreground"
              />
              <select
                value={nicheCategory}
                onChange={(e) => setNicheCategory(e.target.value)}
                className="md:col-span-3 h-10 rounded-lg border border-border-subtle bg-canvas px-3 text-xs text-foreground"
              >
                <option>Coloring Books</option>
                <option>Activity Books</option>
                <option>Puzzle Books</option>
                <option>Children's Books</option>
                <option>Journals</option>
                <option>Non-Fiction Guides</option>
                <option>Workbooks</option>
              </select>
              <button
                type="button"
                disabled={explorerLoading}
                onClick={handleRunNicheExplorer}
                className="md:col-span-3 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {explorerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Analyze Live Market
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
              <span>AI Demand & Competition scores are estimates; observed competitor signals cite grounded web sources.</span>
              <label className="flex items-center gap-2">
                Min Demand Score:
                <input
                  type="range"
                  min={0}
                  max={90}
                  step={10}
                  value={minDemandFilter}
                  onChange={(e) => setMinDemandFilter(Number(e.target.value))}
                />
                <span className="font-mono-tabular text-foreground">{minDemandFilter}</span>
              </label>
            </div>
            {explorerError && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-rose-400">
                <AlertCircle className="h-3.5 w-3.5" /> {explorerError}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredNiches.map((niche) => (
              <div key={niche.id} className="rounded-xl border border-border-subtle bg-surface p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{niche.nicheName}</h3>
                      <p className="mt-0.5 text-xs text-muted">
                        {niche.category} · {niche.targetAudience} · {niche.marketplace}
                      </p>
                    </div>
                    <span className="font-mono-tabular text-xs font-semibold text-teal">
                      Opp {Math.max(10, Math.min(99, niche.aiEstimates.demandScore - Math.round(niche.aiEstimates.competitionScore * 0.35) + 20))}
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-secondary">{niche.summary}</p>
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border-subtle pt-3 text-xs">
                    <div>
                      <span className="text-muted block">Demand (Est)</span>
                      <span className="font-mono-tabular font-semibold text-foreground">{niche.aiEstimates.demandScore}/100</span>
                    </div>
                    <div>
                      <span className="text-muted block">Competition</span>
                      <span className="font-mono-tabular font-semibold text-foreground">{niche.aiEstimates.competitionScore}/100</span>
                    </div>
                    <div>
                      <span className="text-muted block">Observed Price</span>
                      <span className="font-mono-tabular font-semibold text-foreground">{niche.measuredSignals.priceRangeObserved}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-3">
                  <span className="text-[11px] text-muted">{niche.evidenceSources.length} evidence sources</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setGapQuery(niche.nicheName);
                        setActiveTab('competitor-gap');
                      }}
                      className="text-xs font-medium text-secondary hover:text-foreground"
                    >
                      Gap Analysis
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedNiche(niche);
                        setRoute('/niches');
                      }}
                      className="text-xs font-semibold text-accent hover:underline"
                    >
                      Deep Report
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. COMPETITOR GAP ANALYSIS */}
      {activeTab === 'competitor-gap' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border-subtle bg-surface p-5 space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <input
                type="text"
                value={gapQuery}
                onChange={(e) => setGapQuery(e.target.value)}
                placeholder="Enter niche to run grounded competitor gap analysis..."
                className="md:col-span-8 h-10 rounded-lg border border-border-subtle bg-canvas px-3 text-sm text-foreground"
              />
              <button
                type="button"
                disabled={gapLoading}
                onClick={() => handleRunCompetitorGap(false)}
                className="md:col-span-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {gapLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
                Run Grounded Gap Analysis
              </button>
            </div>
            <details className="text-xs text-secondary">
              <summary className="cursor-pointer font-medium text-foreground">
                Or upload / paste authorized competitor CSV (Title, Subtitle, Format, Price, Reviews, Rating, Features, Gaps, Source URL)
              </summary>
              <div className="mt-3 space-y-2">
                <textarea
                  rows={4}
                  value={gapCsv}
                  onChange={(e) => setGapCsv(e.target.value)}
                  placeholder={'Title,Subtitle,Format,Price,Reviews,Rating,Features,Gaps,SourceURL\n"Wildflower Coloring","40 Floral Designs",Paperback,$9.99,312,4.4,"8.5x11; floral themes","double-sided ink bleed; small borders",https://amazon.com'}
                  className="w-full rounded-lg border border-border-subtle bg-canvas p-2.5 font-mono text-xs text-foreground"
                />
                <button
                  type="button"
                  disabled={gapLoading || !gapCsv.trim()}
                  onClick={() => handleRunCompetitorGap(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-elevated px-3 py-1.5 text-xs font-medium text-foreground hover:border-accent disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Analyze Uploaded Competitor CSV
                </button>
              </div>
            </details>
            {gapError && <p className="text-xs text-rose-400">{gapError}</p>}
          </div>

          {activeGap ? (
            <div className="space-y-5">
              {/* Summary + Opportunity Visualization */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 rounded-xl border border-border-subtle bg-surface p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-foreground">{activeGap.niche}</h2>
                    <span className="text-xs text-muted">
                      {activeGap.dataFreshness} · Confidence {activeGap.confidenceScore}%
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-secondary">{activeGap.competitorOverview}</p>

                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Common Features</h3>
                      <ul className="mt-2 space-y-1 text-xs text-secondary">
                        {activeGap.commonFeatures.map((f, i) => (
                          <li key={i}>· {f}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-teal">Missing Features & Gaps</h3>
                      <ul className="mt-2 space-y-1 text-xs text-foreground">
                        {activeGap.missingFeatures.map((f, i) => (
                          <li key={i}>· {f}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Opportunity Score Visual Bar */}
                <div className="rounded-xl border border-border-subtle bg-surface p-5 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Opportunity Visualization</h3>
                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="font-mono-tabular text-4xl font-bold text-teal">{activeGap.opportunityScore}</span>
                      <span className="text-xs text-muted">/ 100 Opportunity Index</span>
                    </div>
                    <svg viewBox="0 0 240 88" className="mt-4 w-full h-22">
                      {[
                        { label: 'Opportunity', val: activeGap.opportunityScore, color: '#2DD4BF', y: 6 },
                        { label: 'Confidence', val: activeGap.confidenceScore, color: '#8B7CFF', y: 34 },
                        { label: 'Gap Depth', val: Math.min(100, activeGap.missingFeatures.length * 18 + 20), color: '#F59E0B', y: 62 },
                      ].map((bar) => (
                        <g key={bar.label}>
                          <text x={0} y={bar.y + 11} fill="currentColor" className="text-[10px] text-muted">{bar.label}</text>
                          <rect x={78} y={bar.y} width={150} height={14} rx={4} fill="currentColor" opacity={0.12} />
                          <rect x={78} y={bar.y} width={(150 * bar.val) / 100} height={14} rx={4} fill={bar.color} />
                        </g>
                      ))}
                    </svg>
                  </div>
                  <div className="mt-4 border-t border-border-subtle pt-3">
                    <p className="text-[11px] font-semibold uppercase text-muted">Recommended Original Concept</p>
                    <p className="mt-1 text-xs font-semibold text-foreground">{activeGap.recommendedBookConcept.title}</p>
                    <p className="text-xs text-secondary">{activeGap.recommendedBookConcept.subtitle}</p>
                    <p className="mt-1 text-[11px] text-muted">
                      Format: {activeGap.recommendedBookConcept.suggestedFormat} · {activeGap.recommendedBookConcept.targetAudience}
                    </p>
                  </div>
                </div>
              </div>

              {/* Competitor Comparison Table */}
              <div className="rounded-xl border border-border-subtle bg-surface p-5">
                <h3 className="text-sm font-semibold text-foreground">Competitor Comparison Table</h3>
                <p className="text-xs text-muted">Metrics unavailable in public sources are explicitly labeled Unavailable.</p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border-subtle text-muted">
                        <th className="pb-2 pr-3 font-medium">Title & Subtitle</th>
                        <th className="pb-2 pr-3 font-medium">Format</th>
                        <th className="pb-2 pr-3 font-medium">Price</th>
                        <th className="pb-2 pr-3 font-medium">Reviews / Rating</th>
                        <th className="pb-2 pr-3 font-medium">Observed Gaps</th>
                        <th className="pb-2 font-medium">Evidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {activeGap.competitors.map((comp, idx) => (
                        <tr key={idx}>
                          <td className="py-3 pr-3">
                            <p className="font-medium text-foreground">{comp.title}</p>
                            <p className="text-[11px] text-muted">{comp.subtitle}</p>
                          </td>
                          <td className="py-3 pr-3 text-secondary">{comp.format}</td>
                          <td className="py-3 pr-3 font-mono-tabular text-foreground">{comp.observedPrice}</td>
                          <td className="py-3 pr-3 font-mono-tabular text-secondary">
                            {comp.reviewCount} · {comp.rating}
                          </td>
                          <td className="py-3 pr-3 text-secondary">{comp.gaps.join('; ')}</td>
                          <td className="py-3">
                            {comp.evidenceUrl.startsWith('http') ? (
                              <a
                                href={comp.evidenceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-accent hover:underline"
                              >
                                Source <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-muted">{comp.evidenceUrl}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Complaints, Underserved Topics & Evidence Sources */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-border-subtle bg-surface p-4">
                  <h4 className="text-xs font-semibold uppercase text-muted">Customer Complaints</h4>
                  <ul className="mt-2 space-y-1.5 text-xs text-secondary">
                    {activeGap.customerComplaints.map((c, i) => <li key={i}>· {c}</li>)}
                  </ul>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface p-4">
                  <h4 className="text-xs font-semibold uppercase text-muted">Underserved Topics</h4>
                  <ul className="mt-2 space-y-1.5 text-xs text-secondary">
                    {activeGap.underservedTopics.map((u, i) => <li key={i}>· {u}</li>)}
                  </ul>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface p-4">
                  <h4 className="text-xs font-semibold uppercase text-muted">Evidence Sources ({activeGap.evidenceSources.length})</h4>
                  <ul className="mt-2 space-y-1.5 text-xs">
                    {activeGap.evidenceSources.map((s, i) => (
                      <li key={i} className="truncate">
                        {s.url.startsWith('http') ? (
                          <a href={s.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                            {s.title || s.domain}
                          </a>
                        ) : (
                          <span className="text-secondary">{s.title}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border-subtle p-10 text-center text-sm text-secondary">
              Run a grounded Competitor Gap Analysis or upload an authorized competitor CSV to populate comparison tables and opportunity charts.
            </div>
          )}
        </div>
      )}

      {/* 4. KEYWORD INTELLIGENCE */}
      {activeTab === 'keywords' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border-subtle bg-surface p-5 space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <input
                type="text"
                value={kwSeed}
                onChange={(e) => setKwSeed(e.target.value)}
                placeholder="Seed phrase (e.g. mindful wildflower coloring book)..."
                className="md:col-span-6 h-10 rounded-lg border border-border-subtle bg-canvas px-3 text-sm text-foreground"
              />
              <button
                type="button"
                disabled={kwLoading}
                onClick={handleRunKeywords}
                className="md:col-span-3 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {kwLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Discover Keywords
              </button>
              <div className="md:col-span-3 flex items-center gap-2">
                <label className="flex-1 inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border-subtle bg-canvas px-3 text-xs font-medium text-foreground hover:bg-elevated">
                  <Upload className="h-3.5 w-3.5" />
                  Import CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleKeywordCsvUpload(f);
                    }}
                  />
                </label>
                <button
                  type="button"
                  disabled={keywordRecords.length === 0}
                  onClick={() => downloadTextFile('kdp-keywords.csv', exportKeywordsToCsv(keywordRecords), 'text/csv')}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border-subtle bg-canvas px-3 text-xs font-medium text-foreground hover:bg-elevated disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </button>
              </div>
            </div>
            <p className="text-xs text-muted">
              Policy: Unmeasured search volumes are never fabricated and are marked <strong className="text-foreground">Unavailable</strong> unless imported via authorized CSV.
            </p>
            {kwError && <p className="text-xs text-rose-400">{kwError}</p>}
          </div>

          {/* 7 KDP Backend Keyword Slots */}
          <div className="rounded-xl border border-border-subtle bg-surface p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">7 Amazon KDP Backend Keyword Slots</h2>
                <p className="text-xs text-muted">Automatically strips words already present in your book title and enforces 50-character limits.</p>
              </div>
              <input
                type="text"
                value={kwTitleCheck}
                onChange={(e) => setKwTitleCheck(e.target.value)}
                placeholder="Book title for duplicate stripping..."
                className="h-8 w-full sm:w-72 rounded-lg border border-border-subtle bg-canvas px-2.5 text-xs text-foreground"
              />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
              {Array.from({ length: 7 }).map((_, idx) => {
                const slot = sevenSlots[idx] || '';
                return (
                  <div key={idx} className="rounded-lg border border-border-subtle bg-canvas p-2.5">
                    <span className="text-[10px] font-mono-tabular text-muted">Slot {idx + 1} · {slot.length}/50</span>
                    <p className="mt-1 text-xs font-medium text-foreground break-words">
                      {slot || 'Discover or import keywords'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cluster Filter & Table */}
          <div className="rounded-xl border border-border-subtle bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border-subtle">
              <h3 className="text-sm font-semibold text-foreground">Keyword Clusters & Opportunity Scores ({filteredKeywords.length})</h3>
              <select
                value={kwClusterFilter}
                onChange={(e) => setKwClusterFilter(e.target.value)}
                className="h-8 rounded-lg border border-border-subtle bg-canvas px-2.5 text-xs text-foreground"
              >
                <option value="All">All Clusters ({keywordRecords.length})</option>
                {clusters.map(([name, count]) => (
                  <option key={name} value={name}>{name} ({count})</option>
                ))}
              </select>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border-subtle text-muted">
                    <th className="pb-2 pr-3 font-medium">Keyword Phrase</th>
                    <th className="pb-2 pr-3 font-medium">Cluster</th>
                    <th className="pb-2 pr-3 font-medium">Intent</th>
                    <th className="pb-2 pr-3 font-medium">Search Volume</th>
                    <th className="pb-2 pr-3 font-medium">Trend</th>
                    <th className="pb-2 pr-3 font-medium">Competition</th>
                    <th className="pb-2 font-medium text-right">Opp / Conf</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredKeywords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted">
                        No keywords loaded yet. Run Keyword Discovery or import a CSV file.
                      </td>
                    </tr>
                  ) : (
                    filteredKeywords.map((kw) => (
                      <tr key={kw.id} className="hover:bg-elevated/40">
                        <td className="py-2.5 pr-3 font-medium text-foreground">{kw.keyword}</td>
                        <td className="py-2.5 pr-3 text-secondary">{kw.cluster}</td>
                        <td className="py-2.5 pr-3 text-secondary">{kw.intent}</td>
                        <td className="py-2.5 pr-3 font-mono-tabular text-muted">
                          {kw.searchVolume === null ? 'Unavailable' : kw.searchVolume.toLocaleString()}
                        </td>
                        <td className="py-2.5 pr-3 text-secondary">{kw.trendDirection}</td>
                        <td className="py-2.5 pr-3 text-secondary">{kw.competitionEstimate}</td>
                        <td className="py-2.5 text-right font-mono-tabular text-teal">
                          {kw.opportunityScore} · {kw.dataConfidence}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. REVIEW INTELLIGENCE */}
      {activeTab === 'reviews' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border-subtle bg-surface p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Customer Review Intelligence (PII-Stripped)</h2>
                <p className="text-xs text-muted">
                  Upload lawfully obtained CSV review exports. Reviewer names, emails, and handles are automatically anonymized before analysis. Reviews are never fabricated.
                </p>
              </div>
              <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border-subtle bg-canvas px-3 text-xs font-medium text-foreground hover:bg-elevated">
                <Upload className="h-3.5 w-3.5" />
                Upload Reviews CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const txt = String(reader.result || '');
                      setReviewCsv(txt);
                      handleAnalyzeReviews(txt);
                    };
                    reader.readAsText(f);
                  }}
                />
              </label>
            </div>
            <textarea
              rows={4}
              value={reviewCsv}
              onChange={(e) => setReviewCsv(e.target.value)}
              placeholder={'Competitor Title,Rating,Review Text,Source URL\n"Floral Calm Vol 1",2,"Paper is thin and markers bleed through to the back side. Text is too small.",https://example.com/review-export'}
              className="w-full rounded-lg border border-border-subtle bg-canvas p-3 font-mono text-xs text-foreground"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-muted">
                Columns: Competitor Title, Rating (1-5), Review Text, Source URL
              </span>
              <button
                type="button"
                onClick={() => handleAnalyzeReviews(reviewCsv)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-semibold text-white hover:opacity-90"
              >
                Analyze Anonymized Reviews
              </button>
            </div>
            {reviewNotice && <p className="text-xs text-amber-400">{reviewNotice}</p>}
          </div>

          {reviewReport && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border-subtle bg-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Sentiment Breakdown ({reviewReport.totalReviewsAnalyzed} reviews analyzed)
                  </h3>
                  <span className="text-xs text-muted">{reviewReport.privacyNotice}</span>
                </div>
                <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-canvas">
                  <div
                    className="bg-teal"
                    style={{ width: `${reviewReport.sentimentBreakdown.positive}%` }}
                  />
                  <div
                    className="bg-zinc-500"
                    style={{ width: `${reviewReport.sentimentBreakdown.neutral}%` }}
                  />
                  <div
                    className="bg-rose-500"
                    style={{ width: `${reviewReport.sentimentBreakdown.negative}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center gap-6 text-xs font-mono-tabular">
                  <span className="text-teal">Positive {reviewReport.sentimentBreakdown.positive}%</span>
                  <span className="text-secondary">Neutral {reviewReport.sentimentBreakdown.neutral}%</span>
                  <span className="text-rose-400">Negative {reviewReport.sentimentBreakdown.negative}%</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border-subtle bg-surface p-5">
                  <h4 className="text-xs font-semibold uppercase text-muted">Most Appreciated Features</h4>
                  <div className="mt-3 space-y-2.5 text-xs">
                    {reviewReport.mostAppreciatedFeatures.map((f) => (
                      <div key={f.feature} className="border-b border-border-subtle pb-2 last:border-0">
                        <div className="flex justify-between font-medium text-foreground">
                          <span>{f.feature}</span>
                          <span className="font-mono-tabular text-teal">{f.mentions} mentions</span>
                        </div>
                        <p className="mt-0.5 text-muted italic">"{f.snippet}"</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border-subtle bg-surface p-5">
                  <h4 className="text-xs font-semibold uppercase text-muted">Common Complaints & Suggested Fixes</h4>
                  <div className="mt-3 space-y-2.5 text-xs">
                    {reviewReport.commonComplaints.map((c) => (
                      <div key={c.complaint} className="border-b border-border-subtle pb-2 last:border-0">
                        <div className="flex justify-between font-medium text-foreground">
                          <span>{c.complaint}</span>
                          <span className="font-mono-tabular text-rose-400">{c.mentions} mentions</span>
                        </div>
                        <p className="mt-0.5 text-muted italic">"{c.snippet}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border-subtle bg-surface p-5">
                <h4 className="text-xs font-semibold uppercase text-muted">Competitor Review Comparison</h4>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border-subtle text-muted">
                        <th className="pb-2 font-medium">Competitor</th>
                        <th className="pb-2 font-medium">Reviews</th>
                        <th className="pb-2 font-medium">Avg Rating</th>
                        <th className="pb-2 font-medium">Primary Pain Point</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {reviewReport.competitorComparison.map((c) => (
                        <tr key={c.competitorTitle}>
                          <td className="py-2.5 font-medium text-foreground">{c.competitorTitle}</td>
                          <td className="py-2.5 font-mono-tabular text-secondary">{c.reviewCount}</td>
                          <td className="py-2.5 font-mono-tabular text-foreground">{c.avgRating}</td>
                          <td className="py-2.5 text-secondary">{c.topComplaint}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. SEASONAL OPPORTUNITIES */}
      {activeTab === 'seasonal' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface p-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Annual KDP Seasonal Calendar (11 Recurring Events)</h2>
              <p className="text-xs text-muted">
                Historical seasonality patterns help plan production lead times and never constitute guaranteed sales forecasts.
              </p>
            </div>
            <select
              value={seasonalMonthFilter}
              onChange={(e) => setSeasonalMonthFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="h-9 rounded-lg border border-border-subtle bg-canvas px-3 text-xs text-foreground"
            >
              <option value="all">All 12 Months</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Calendar Grid */}
            <div className="lg:col-span-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {seasonalEvents
                .filter((ev) => seasonalMonthFilter === 'all' || ev.monthIndex === seasonalMonthFilter)
                .map((ev) => {
                  const selected = ev.id === selectedEvent?.id;
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => setSelectedEventId(ev.id)}
                      className={`text-left rounded-xl border p-4 transition-colors ${
                        selected
                          ? 'border-accent bg-elevated/60'
                          : 'border-border-subtle bg-surface hover:border-border-strong'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">{ev.event}</span>
                        <span className="font-mono-tabular text-xs text-teal">{ev.eventDate}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        Research by <strong className="text-foreground">{ev.researchDeadline}</strong> · Prep {ev.suggestedPrepDate}
                      </p>
                      <p className="mt-2 text-[11px] text-secondary">
                        Lead time {ev.leadTimeDays}d · {ev.estimatedSeasonality} · Confidence {ev.dataConfidence}%
                      </p>
                    </button>
                  );
                })}
            </div>

            {/* Selected Event Historical Curve & Details */}
            {selectedEvent && (
              <div className="lg:col-span-5 rounded-xl border border-border-subtle bg-surface p-5 space-y-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted">
                    Historical Interest Curve · Source {selectedEvent.sourceTimestamp.split('T')[0]}
                  </p>
                  <h3 className="mt-1 font-display text-lg font-bold text-foreground">{selectedEvent.event}</h3>
                  <p className="text-xs text-secondary">{selectedEvent.sourceNote}</p>
                </div>

                {/* SVG 12-Month Historical Curve */}
                <svg viewBox="0 0 360 130" className="w-full h-36">
                  {selectedEvent.historicalTrend.map((val, idx) => {
                    const x = 14 + idx * 29;
                    const barH = Math.max(4, (val / 100) * 92);
                    const y = 104 - barH;
                    const peak = idx === selectedEvent.monthIndex;
                    return (
                      <g key={idx}>
                        <rect
                          x={x}
                          y={y}
                          width={18}
                          height={barH}
                          rx={3}
                          fill={peak ? '#2DD4BF' : '#8B7CFF'}
                          opacity={peak ? 1 : 0.65}
                        />
                        <text x={x + 9} y={120} textAnchor="middle" fill="currentColor" className="text-[9px] text-muted">
                          {MONTHS[idx]}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                <div className="grid grid-cols-2 gap-3 border-t border-border-subtle pt-3 text-xs">
                  <div>
                    <span className="text-muted block">Research Deadline</span>
                    <span className="font-mono-tabular font-semibold text-foreground">{selectedEvent.researchDeadline}</span>
                  </div>
                  <div>
                    <span className="text-muted block">Publishing Prep Date</span>
                    <span className="font-mono-tabular font-semibold text-foreground">{selectedEvent.suggestedPrepDate}</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted">Related Niches</h4>
                  <ul className="mt-1.5 space-y-1 text-xs text-secondary">
                    {selectedEvent.relatedNiches.map((n) => <li key={n}>· {n}</li>)}
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted">Seasonal Keywords</h4>
                  <p className="mt-1 text-xs text-foreground">{selectedEvent.seasonalKeywords.join(' · ')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. TREND DASHBOARD */}
      {activeTab === 'trends' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border-subtle bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Multi-Event Historical Interest Overlay (12 Months)</h2>
                <p className="text-xs text-muted">Compares Q1 New Year, Q2 Mother's Day, Q3 Back to School, and Q4 Christmas recurring curves.</p>
              </div>
              <span className="text-xs text-muted">Relative Historical Index (0–100) · Non-Forecasting</span>
            </div>
            <svg viewBox="0 0 720 200" className="mt-4 w-full h-52">
              {[0, 25, 50, 75, 100].map((v) => {
                const y = 170 - (v / 100) * 145;
                return (
                  <g key={v}>
                    <line x1={32} y1={y} x2={700} y2={y} stroke="currentColor" opacity={0.1} />
                    <text x={4} y={y + 4} fill="currentColor" className="text-[10px] text-muted">{v}</text>
                  </g>
                );
              })}
              {[
                { id: 'christmas', color: '#2DD4BF' },
                { id: 'new_year', color: '#8B7CFF' },
                { id: 'back_to_school', color: '#F59E0B' },
                { id: 'halloween', color: '#FB7185' },
              ].map((series) => {
                const ev = seasonalEvents.find((e) => e.id === series.id);
                if (!ev) return null;
                const pts = ev.historicalTrend
                  .map((v, idx) => `${44 + idx * 58},${170 - (v / 100) * 145}`)
                  .join(' ');
                return (
                  <polyline
                    key={series.id}
                    fill="none"
                    stroke={series.color}
                    strokeWidth={2.2}
                    points={pts}
                  />
                );
              })}
              {MONTHS.map((m, idx) => (
                <text key={m} x={44 + idx * 58} y={190} textAnchor="middle" fill="currentColor" className="text-[10px] text-muted">
                  {m}
                </text>
              ))}
            </svg>
            <div className="mt-2 flex flex-wrap gap-5 text-xs text-secondary">
              <span className="text-teal">● Christmas</span>
              <span className="text-accent">● New Year</span>
              <span className="text-amber-400">● Back to School</span>
              <span className="text-rose-400">● Halloween</span>
            </div>
          </div>
        </div>
      )}

      {/* 8. RESEARCH HISTORY */}
      {activeTab === 'history' && (
        <div className="rounded-xl border border-border-subtle bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border-subtle">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Research History & Provenance Log</h2>
              <p className="text-xs text-muted">Auditable timeline of grounded queries, CSV uploads, and confidence scores.</p>
            </div>
            <select
              value={historyFilter}
              onChange={(e) => setHistoryFilter(e.target.value)}
              className="h-8 rounded-lg border border-border-subtle bg-canvas px-2.5 text-xs text-foreground"
            >
              <option value="All">All Types</option>
              <option value="Niche Research">Niche Research</option>
              <option value="Competitor Gap">Competitor Gap</option>
              <option value="Keyword Intelligence">Keyword Intelligence</option>
              <option value="Review Intelligence">Review Intelligence</option>
              <option value="Seasonal Check">Seasonal Check</option>
            </select>
          </div>
          <div className="mt-3 divide-y divide-border-subtle">
            {researchHistory
              .filter((item) => historyFilter === 'All' || item.type === historyFilter)
              .map((item) => (
                <div key={item.id} className="py-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{item.query}</p>
                    <p className="text-xs text-secondary">{item.summary}</p>
                  </div>
                  <div className="text-left sm:text-right text-[11px] font-mono-tabular text-muted shrink-0">
                    <div>{item.type} · {item.marketplace}</div>
                    <div>Conf {item.confidenceScore}% · {item.sourceCount} sources · {new Date(item.timestamp).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
