import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Compass } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { fetchNicheDetail } from '../../services/researchService';
import type { NicheDetailReport } from '../../types';
import { NicheDetailView } from '../../components/research/NicheDetailView';
import { NicheResultCard } from '../../components/research/NicheResultCard';
import {
  NicheFilterBar,
  type NicheFilterKey,
} from '../../components/research/NicheFilterBar';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { EmptyState } from '../../components/shared/EmptyState';

export default function NichesPage() {
  const researchResults = useAppStore((s) => s.researchResults);
  const selectedNiche = useAppStore((s) => s.selectedNiche);
  const setSelectedNiche = useAppStore((s) => s.setSelectedNiche);
  const setRoute = useAppStore((s) => s.setRoute);
  const createProject = useAppStore((s) => s.createProject);
  const ensureDocument = useEditorStore((s) => s.ensureDocument);

  const [activeFilter, setActiveFilter] = React.useState<NicheFilterKey>('all');

  const detailQuery = useQuery({
    queryKey: [
      'niche-detail',
      selectedNiche?.nicheName,
      selectedNiche?.category,
      selectedNiche?.marketplace,
    ],
    queryFn: () =>
      fetchNicheDetail({
        nicheName: selectedNiche!.nicheName,
        category: selectedNiche!.category,
        marketplace: selectedNiche!.marketplace,
      }),
    enabled: Boolean(selectedNiche),
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  const handleCreateProjectFromReport = (report: NicheDetailReport) => {
    const project = createProject({
      title: report.aiRecommendation.suggestedTitle || report.nicheName,
      subtitle: report.aiRecommendation.suggestedSubtitle || '',
      category: selectedNiche?.category || 'Non-Fiction Guides',
      trimSize: report.aiRecommendation.recommendedTrimSize || '6x9',
      pageCount: report.aiRecommendation.recommendedPageCount || 100,
    });
    ensureDocument(project.id, project.title, project.trimSize, project.pageCount);
    setRoute('/editor');
  };

  if (selectedNiche) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {detailQuery.isLoading && (
          <LoadingState
            rows={4}
            label={`Generating search-grounded Niche Detail Report for "${selectedNiche.nicheName}"...`}
          />
        )}

        {detailQuery.isError && (
          <ErrorState
            title="Could not load Niche Detail Report"
            message={
              detailQuery.error instanceof Error
                ? detailQuery.error.message
                : 'Failed to retrieve niche analysis from the server.'
            }
            onRetry={() => detailQuery.refetch()}
          />
        )}

        {detailQuery.data && (
          <NicheDetailView
            report={detailQuery.data}
            onBack={() => setSelectedNiche(null)}
            onCreateProject={handleCreateProjectFromReport}
          />
        )}
      </div>
    );
  }

  const safeResults = Array.isArray(researchResults) ? researchResults : [];
  const filtered = safeResults.filter((niche) => {
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Niche Finder
        </h1>
        <p className="text-sm text-secondary">
          Filter discovered KDP opportunities and open detailed competitor, review, keyword, and
          market gap reports.
        </p>
      </div>

      {safeResults.length === 0 ? (
        <EmptyState
          title="No researched niches loaded yet"
          description="Run a search-grounded Market Research query first so you can filter opportunities and inspect deep niche detail reports."
          actionLabel="Go to Market Research"
          onAction={() => setRoute('/research')}
          icon={<Compass className="h-5 w-5" />}
        />
      ) : (
        <>
          <NicheFilterBar activeFilter={activeFilter} onChange={setActiveFilter} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map((niche) => (
              <NicheResultCard
                key={niche.id}
                niche={niche}
                onSelect={(n) => setSelectedNiche(n)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
