import { ArrowRight, ExternalLink } from 'lucide-react';
import type { NicheOpportunity } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface NicheResultCardProps {
  niche: NicheOpportunity;
  onSelect: (niche: NicheOpportunity) => void;
}

export function NicheResultCard({ niche, onSelect }: NicheResultCardProps) {
  return (
    <Card interactive className="p-5 flex flex-col justify-between gap-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-secondary flex-wrap">
              <span>{niche.category}</span>
              <span aria-hidden="true">·</span>
              <span>{niche.targetAudience}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular text-muted">{niche.marketplace}</span>
            </div>
            <h3 className="font-display text-base font-semibold text-foreground mt-1">
              {niche.nicheName}
            </h3>
          </div>
          <span className="text-xs font-mono-tabular text-muted whitespace-nowrap shrink-0">
            {niche.researchDate}
          </span>
        </div>

        <p className="text-sm text-secondary leading-relaxed">{niche.summary}</p>

        {/* Transparent separation: AI Estimates vs Measured Web Signals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="rounded-lg bg-sidebar border border-border-subtle p-3 space-y-2">
            <p className="text-[11px] font-medium text-accent">AI Estimates (Model-Inferred)</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[11px] text-muted">Demand</p>
                <p className="font-mono-tabular text-sm font-semibold text-foreground">
                  {niche.aiEstimates?.demandScore ?? 0}/100
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted">Competition</p>
                <p className="font-mono-tabular text-sm font-semibold text-foreground">
                  {niche.aiEstimates?.competitionScore ?? 0}/100
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted">Keyword Opp.</p>
                <p className="font-mono-tabular text-sm font-semibold text-teal">
                  {niche.aiEstimates?.keywordOpportunityScore ?? 0}/100
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-sidebar border border-border-subtle p-3 space-y-2">
            <p className="text-[11px] font-medium text-teal">Measured Signals (Web Observed)</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[11px] text-muted">Observed Competitors</p>
                <p className="font-mono-tabular text-sm font-semibold text-foreground">
                  {niche.measuredSignals?.observedCompetitors ?? 0}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted">Avg Observed Reviews</p>
                <p className="font-mono-tabular text-sm font-semibold text-foreground">
                  {(niche.measuredSignals?.averageObservedReviews ?? 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border-subtle">
        <div className="flex items-center gap-3 text-xs text-muted min-w-0 flex-wrap">
          <span className="font-mono-tabular">
            {(niche.evidenceSources ?? []).length} evidence{' '}
            {(niche.evidenceSources ?? []).length === 1 ? 'source' : 'sources'}
          </span>
          {(niche.evidenceSources ?? []).slice(0, 2).map((src) => (
            <a
              key={src.url}
              href={src.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-secondary hover:text-accent transition-colors truncate max-w-[160px]"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{src.domain}</span>
            </a>
          ))}
        </div>

        <Button size="sm" variant="secondary" onClick={() => onSelect(niche)}>
          Inspect Niche
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
}
