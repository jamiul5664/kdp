import { ArrowLeft, BookPlus, ExternalLink } from 'lucide-react';
import type { NicheDetailReport } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';

interface NicheDetailViewProps {
  report: NicheDetailReport;
  onBack: () => void;
  onCreateProject: (report: NicheDetailReport) => void;
}

export function NicheDetailView({ report, onBack, onCreateProject }: NicheDetailViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Niche Results
          </button>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
            {report.nicheName}
          </h2>
          <p className="text-xs font-mono-tabular text-muted">
            {report.marketplace} · Research Date {report.researchDate} · {report.sources.length}{' '}
            web sources cited
          </p>
        </div>

        <Button onClick={() => onCreateProject(report)}>
          <BookPlus className="h-4 w-4" />
          Start Book Project
        </Button>
      </div>

      {/* Transparent Provenance Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 space-y-2">
          <p className="text-xs font-semibold text-teal">Measured & Observed Web Data</p>
          <p className="text-sm text-secondary leading-relaxed">{report.measuredDataSummary}</p>
        </Card>
        <Card className="p-5 space-y-2">
          <p className="text-xs font-semibold text-accent">AI Strategic Estimates</p>
          <p className="text-sm text-secondary leading-relaxed">{report.aiEstimateSummary}</p>
        </Card>
      </div>

      {/* Market Overview & AI Recommendation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Market Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-secondary leading-relaxed">{report.marketOverview}</p>
            <div className="pt-2 border-t border-border-subtle">
              <h4 className="font-display text-sm font-semibold text-foreground mb-2">
                Identified Market Gaps
              </h4>
              <ul className="space-y-1.5 text-sm text-secondary list-disc pl-5">
                {report.marketGaps.map((gap, i) => (
                  <li key={i}>{gap}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Recommendation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="font-medium text-accent">{report.aiRecommendation.verdict}</p>
            <div className="space-y-1 pt-1 border-t border-border-subtle">
              <p className="text-xs text-muted">Suggested Title</p>
              <p className="font-medium text-foreground">{report.aiRecommendation.suggestedTitle}</p>
              <p className="text-xs text-secondary">{report.aiRecommendation.suggestedSubtitle}</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono-tabular text-secondary pt-1">
              <span>Trim: {report.aiRecommendation.recommendedTrimSize}&quot;</span>
              <span>·</span>
              <span>{report.aiRecommendation.recommendedPageCount} pages</span>
            </div>
            <p className="text-xs text-secondary leading-relaxed">
              {report.aiRecommendation.differentiationAngle}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Competitor Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Competitor Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-xs text-muted">
                  <th className="py-2.5 pr-4 font-medium">Observed Title</th>
                  <th className="py-2.5 pr-4 font-medium">Format</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Price</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Reviews</th>
                  <th className="py-2.5 pr-4 font-medium">Strengths</th>
                  <th className="py-2.5 font-medium">Opportunity Gap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {report.competitors.map((comp, idx) => (
                  <tr key={idx} className="hover:bg-surface-hover/50">
                    <td className="py-3 pr-4 font-medium text-foreground">{comp.title}</td>
                    <td className="py-3 pr-4 text-secondary whitespace-nowrap">{comp.format}</td>
                    <td className="py-3 pr-4 text-right font-mono-tabular text-foreground whitespace-nowrap">
                      {comp.observedPrice}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono-tabular text-secondary whitespace-nowrap">
                      {comp.observedReviews}
                    </td>
                    <td className="py-3 pr-4 text-xs text-secondary">{comp.strengths}</td>
                    <td className="py-3 text-xs text-teal">{comp.gap}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Customer Review Insights & Keyword Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Customer Review Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-medium text-teal mb-1.5">What Readers Praise</p>
              <ul className="space-y-1.5 text-secondary list-disc pl-5">
                {report.customerReviewInsights.praisedThemes.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="pt-3 border-t border-border-subtle">
              <p className="text-xs font-medium text-amber-400 mb-1.5">Recurring Complaints</p>
              <ul className="space-y-1.5 text-secondary list-disc pl-5">
                {report.customerReviewInsights.commonComplaints.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Keyword Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border-subtle">
              {report.keywordOpportunities.map((kw, i) => (
                <div key={i} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{kw.keyword}</span>
                    <span className="text-xs font-mono-tabular text-secondary">
                      {kw.intent} · {kw.estimatedCompetition} comp.
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">{kw.rationale}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Source Links */}
      <Card>
        <CardHeader>
          <CardTitle>Grounded Evidence Source Links</CardTitle>
        </CardHeader>
        <CardContent>
          {report.sources.length === 0 ? (
            <p className="text-sm text-secondary">
              No direct external web URLs were returned by search grounding for this query.
            </p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {report.sources.map((src) => (
                <li key={src.url}>
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-sidebar px-3.5 py-2.5 text-sm text-foreground hover:border-border-strong hover:text-accent transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{src.title}</p>
                      <p className="text-xs font-mono-tabular text-muted truncate">{src.domain}</p>
                    </div>
                    <ExternalLink className="h-4 w-4 shrink-0 text-secondary" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
