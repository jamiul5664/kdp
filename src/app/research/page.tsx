import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { Compass, Info } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { searchMarketNiches } from '../../services/researchService';
import type { NicheOpportunity, ResearchQueryParams } from '../../types';
import { ResearchSearchForm } from '../../components/research/ResearchSearchForm';
import {
  NicheFilterBar,
  type NicheFilterKey,
} from '../../components/research/NicheFilterBar';
import { NicheResultCard } from '../../components/research/NicheResultCard';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { EmptyState } from '../../components/shared/EmptyState';

export default function ResearchPage() {
  const researchResults = useAppStore((s) => s.researchResults);
  const setResearchResults = useAppStore((s) => s.setResearchResults);
  const setSelectedNiche = useAppStore((s) => s.setSelectedNiche);
  const setRoute = useAppStore((s) => s.setRoute);
  const pendingResearchQuery = useAppStore((s) => s.pendingResearchQuery);
  const setPendingResearchQuery = useAppStore((s) => s.setPendingResearchQuery);
  const addActivity = useAppStore((s) => s.addActivity);

  const [activeFilter, setActiveFilter] = React.useState<NicheFilterKey>('all');
  const [lastParams, setLastParams] = React.useState<ResearchQueryParams>({
    query: pendingResearchQuery || '',
    category: 'All Categories',
    targetAudience: 'All Audiences',
    marketplace: 'amazon.com',
    dateRange: '90d',
  });

  const safeResearchResults = Array.isArray(researchResults) ? researchResults : [];

  const researchMutation = useMutation({
    mutationFn: (params: ResearchQueryParams) => searchMarketNiches(params),
    onSuccess: (data, variables) => {
      const nextNiches = Array.isArray(data?.niches) ? data.niches : [];
      const nextSources = Array.isArray(data?.sources) ? data.sources : [];
      setResearchResults(nextNiches);
      addActivity({
        title: `Market research completed for "${variables.query}"`,
        description: `Returned ${nextNiches.length} opportunities grounded with ${nextSources.length} web sources on ${variables.marketplace}.`,
        category: 'research',
      });
    },
  });

  React.useEffect(() => {
    if (pendingResearchQuery) {
      const nextParams: ResearchQueryParams = {
        ...lastParams,
        query: pendingResearchQuery,
      };
      setLastParams(nextParams);
      setPendingResearchQuery(null);
      researchMutation.mutate(nextParams);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingResearchQuery]);

  const handleSearch = (params: ResearchQueryParams) => {
    setLastParams(params);
    setActiveFilter('all');
    researchMutation.mutate(params);
  };

  const filteredResults = React.useMemo(() => {
    return safeResearchResults.filter((niche) => {
      if (!niche) return false;
      const demand = niche.aiEstimates?.demandScore ?? 0;
      const competition = niche.aiEstimates?.competitionScore ?? 100;
      switch (activeFilter) {
        case 'high_demand':
          return demand >= 70;
        case 'low_competition':
          return competition <= 55;
        case 'childrens':
          return niche.category === "Children's Books";
        case 'coloring':
          return niche.category === 'Coloring Books';
        case 'activity':
          return niche.category === 'Activity Books';
        case 'puzzle':
          return niche.category === 'Puzzle Books';
        case 'journals':
          return niche.category === 'Journals';
        default:
          return true;
      }
    });
  }, [safeResearchResults, activeFilter]);

  const handleInspectNiche = (niche: NicheOpportunity) => {
    setSelectedNiche(niche);
    setRoute('/niches');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Market Research
        </h1>
        <p className="text-sm text-secondary">
          Search live web book listings via Gemini Search Grounding. Observed marketplace signals
          and AI-estimated scores are always separated transparently.
        </p>
      </div>

      <ResearchSearchForm
        initialValues={lastParams}
        isLoading={researchMutation.isPending}
        onSubmit={handleSearch}
      />

      {/* Transparent Scoring Methodology Note */}
      <div className="rounded-xl border border-border-subtle bg-sidebar px-4 py-3 flex items-start gap-3 text-xs text-secondary">
        <Info className="h-4 w-4 text-teal shrink-0 mt-0.5" />
        <p>
          <strong className="text-foreground font-medium">Transparent Scoring:</strong> Observed
          competitors, average observed reviews, and evidence URLs come directly from search
          grounding results. Demand, competition, and keyword opportunity scores (0–100) are
          clearly labeled as AI estimates derived from those observations.
        </p>
      </div>

      {safeResearchResults.length > 0 && (
        <NicheFilterBar activeFilter={activeFilter} onChange={setActiveFilter} />
      )}

      {researchMutation.isPending && (
        <LoadingState
          rows={4}
          label={`Running search-grounded market analysis for "${lastParams.query}" on ${lastParams.marketplace}...`}
        />
      )}

      {researchMutation.isError && (
        <ErrorState
          title="Market research request failed"
          message={
            researchMutation.error instanceof Error
              ? researchMutation.error.message
              : 'Unable to complete market research API request.'
          }
          onRetry={() => lastParams.query && researchMutation.mutate(lastParams)}
        />
      )}

      {!researchMutation.isPending && safeResearchResults.length === 0 && !researchMutation.isError && (
        <EmptyState
          title="Start a grounded KDP market research query"
          description="Enter a book category, audience, or keyword phrase above to retrieve real web evidence sources and transparent niche scoring."
          actionLabel="Try: Botanical Coloring Books"
          onAction={() =>
            handleSearch({
              query: 'botanical wildflower coloring books for adults',
              category: 'Coloring Books',
              targetAudience: 'Busy Adults',
              marketplace: 'amazon.com',
              dateRange: '90d',
            })
          }
          icon={<Compass className="h-5 w-5" />}
        />
      )}

      {!researchMutation.isPending && safeResearchResults.length > 0 && (
        <>
          {filteredResults.length === 0 ? (
            <EmptyState
              title="No niches match this filter"
              description="Clear or switch the category/score filter above to view all grounded research opportunities."
              actionLabel="Show All Results"
              onAction={() => setActiveFilter('all')}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredResults.map((niche) => (
                <NicheResultCard
                  key={niche.id}
                  niche={niche}
                  onSelect={handleInspectNiche}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
