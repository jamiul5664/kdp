import * as React from 'react';
import {
  ArrowRight,
  BookCheck,
  BookOpen,
  Clock,
  Compass,
  FolderKanban,
  MessageSquare,
  Palette,
  Plus,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { formatTimeRelative } from '../../utils/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { RecentProjectCard } from '../../components/books/RecentProjectCard';
import { EmptyState } from '../../components/shared/EmptyState';

const BASELINE_OPPORTUNITIES = [
  {
    id: 'opp_1',
    title: 'Large-Print Botanical Word Search for Seniors',
    category: 'Puzzle Books',
    marketplace: 'amazon.com',
    query: 'large print botanical word search books for seniors',
    note: 'AI research cue · Run live search in Market Research to inspect current web signals',
  },
  {
    id: 'opp_2',
    title: 'Single-Sided Pressed Wildflower Coloring Plates',
    category: 'Coloring Books',
    marketplace: 'amazon.com',
    query: 'wildflower botanical coloring book single sided adults',
    note: 'AI research cue · Strong gift seasonality and clear anti-bleed gap',
  },
  {
    id: 'opp_3',
    title: 'Screen-Free Rainy Day Logic Mazes (Ages 6–9)',
    category: 'Activity Books',
    marketplace: 'amazon.co.uk',
    query: 'logic maze activity book kids ages 6 to 9',
    note: 'AI research cue · Compact 6×9 travel format underrepresented',
  },
];

export default function DashboardPage() {
  const user = useAppStore((s) => s.user);
  const projects = useAppStore((s) => s.projects);
  const activities = useAppStore((s) => s.activities);
  const activeResearchTasks = useAppStore((s) => s.activeResearchTasks);
  const pendingApprovals = useAppStore((s) => s.pendingApprovals);
  const researchResults = useAppStore((s) => s.researchResults);
  const setRoute = useAppStore((s) => s.setRoute);
  const setCreateModalOpen = useAppStore((s) => s.setCreateModalOpen);
  const openProjectInEditor = useAppStore((s) => s.openProjectInEditor);
  const setPendingResearchQuery = useAppStore((s) => s.setPendingResearchQuery);
  const ensureDocument = useEditorStore((s) => s.ensureDocument);

  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 320);
    return () => window.clearTimeout(timer);
  }, []);

  const completedBooks = projects.filter((p) => p.status === 'Completed').length;

  const handleOpenProject = (projectId: string) => {
    const proj = projects.find((p) => p.id === projectId);
    if (proj) {
      ensureDocument(proj.id, proj.title, proj.trimSize, proj.pageCount);
    }
    openProjectInEditor(projectId);
  };

  const quickActions = [
    {
      label: 'Research a Niche',
      description: 'Run search-grounded KDP market & competitor analysis',
      icon: Search,
      onClick: () => setRoute('/research'),
    },
    {
      label: 'Create a Book',
      description: 'Configure trim size, page count, and interior specs',
      icon: Plus,
      onClick: () => setCreateModalOpen(true),
    },
    {
      label: 'Generate a Cover',
      description: 'Design front, spine, and back full-wrap KDP covers',
      icon: Palette,
      onClick: () => setRoute('/cover-studio'),
    },
    {
      label: 'AI Chat → Download Book',
      description: 'Type a topic in chat to auto-research, create & get download links',
      icon: MessageSquare,
      onClick: () => setRoute('/chat'),
    },
  ];

  const kpis = [
    {
      label: 'Total Projects',
      value: projects.length,
      detail: 'Active catalog manuscripts',
      icon: FolderKanban,
    },
    {
      label: 'Completed Books',
      value: completedBooks,
      detail: 'Ready for KDP upload',
      icon: BookCheck,
    },
    {
      label: 'Active Research Tasks',
      value: activeResearchTasks,
      detail: 'Monitored publishing niches',
      icon: Compass,
    },
    {
      label: 'Pending Approvals',
      value: pendingApprovals,
      detail: 'Awaiting your review in AI Chat',
      icon: ShieldAlert,
      action: () => setRoute('/chat'),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-8">
      {/* 1. Welcome Header + Create New Book Button */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-border-subtle">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted">
            {user.imprint} · Publishing Workspace
          </p>
          <h1
            className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground"
            style={{ textWrap: 'balance' }}
          >
            Welcome back, {user.name.split(' ')[0]}
          </h1>
          <p className="text-sm text-secondary">
            Track book production, inspect niche research signals, and approve AI publishing
            proposals.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Button variant="secondary" onClick={() => setRoute('/chat')}>
            <MessageSquare className="h-4 w-4" />
            Create via AI Chat
          </Button>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Create Manually
          </Button>
        </div>
      </section>

      {/* 2. KPI Metrics Strip */}
      <section aria-label="Workspace metrics">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="p-5 space-y-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3.5 w-36" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <Card
                  key={kpi.label}
                  interactive={Boolean(kpi.action)}
                  onClick={kpi.action}
                  className={`p-5 ${kpi.action ? 'cursor-pointer' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-secondary">{kpi.label}</span>
                    <Icon className="h-4 w-4 text-accent" />
                  </div>
                  <p className="font-mono-tabular text-3xl font-bold text-foreground mt-2">
                    {kpi.value}
                  </p>
                  <p className="text-xs text-muted mt-1">{kpi.detail}</p>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Quick Actions */}
      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold text-foreground">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {quickActions.map((act) => {
            const Icon = act.icon;
            return (
              <button
                key={act.label}
                type="button"
                onClick={act.onClick}
                className="text-left rounded-xl bg-surface border border-border-subtle hover:border-border-strong hover:bg-surface-hover p-4 transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <div className="h-9 w-9 rounded-lg bg-accent/12 border border-accent/25 flex items-center justify-center text-accent">
                    <Icon className="h-4 w-4" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground transition-colors" />
                </div>
                <p className="font-display text-sm font-semibold text-foreground mt-3">
                  {act.label}
                </p>
                <p className="text-xs text-secondary mt-1">{act.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. Recent Projects */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">
              Recent Projects
            </h2>
            <p className="text-xs text-secondary">
              Continue editing manuscripts or open trim specifications
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setRoute('/projects')}>
            View all projects
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="p-4 flex gap-4">
                <Skeleton className="w-24 aspect-[3/4] shrink-0" />
                <div className="flex-1 space-y-2.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-5 w-4/5" />
                  <Skeleton className="h-3.5 w-44" />
                  <Skeleton className="h-2 w-full mt-4" />
                </div>
              </Card>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            title="No book projects yet"
            description="Create your first KDP project to configure trim dimensions, interior pages, and cover wrap specs."
            actionLabel="Create New Book"
            onAction={() => setCreateModalOpen(true)}
            icon={<BookOpen className="h-5 w-5" />}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.slice(0, 4).map((project) => (
              <RecentProjectCard
                key={project.id}
                project={project}
                onOpen={handleOpenProject}
              />
            ))}
          </div>
        )}
      </section>

      {/* 5. Latest Market Opportunities + AI Activity Timeline */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Latest Market Opportunities</CardTitle>
              <CardDescription>
                {researchResults.length > 0
                  ? 'Recent search-grounded niche results from your session'
                  : 'Suggested KDP research leads ready for live web verification'}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setRoute('/research')}>
              Open Research
            </Button>
          </CardHeader>
          <CardContent className="divide-y divide-border-subtle">
            {researchResults.length > 0
              ? researchResults.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <span>{item.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">{item.marketplace}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular text-teal">
                          Est. Demand {item.aiEstimates.demandScore}/100
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground mt-0.5 truncate">
                        {item.nicheName}
                      </p>
                      <p className="text-xs text-secondary mt-0.5 font-mono-tabular">
                        Observed competitors: {item.measuredSignals.observedCompetitors} · Avg
                        reviews: {item.measuredSignals.averageObservedReviews}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        useAppStore.getState().setSelectedNiche(item);
                        setRoute('/niches');
                      }}
                    >
                      Inspect
                    </Button>
                  </div>
                ))
              : BASELINE_OPPORTUNITIES.map((opp) => (
                  <div
                    key={opp.id}
                    className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <span>{opp.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">{opp.marketplace}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground mt-0.5">{opp.title}</p>
                      <p className="text-xs text-secondary mt-0.5">{opp.note}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setPendingResearchQuery(opp.query);
                        setRoute('/research');
                      }}
                    >
                      Run Research
                    </Button>
                  </div>
                ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>AI Activity Timeline</CardTitle>
            <CardDescription>Recent publishing, research, and export milestones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activities.length === 0 ? (
              <p className="text-sm text-secondary">No activity recorded yet.</p>
            ) : (
              activities.slice(0, 6).map((ev) => (
                <div key={ev.id} className="flex gap-3 pb-3.5 border-b border-border-subtle last:border-b-0 last:pb-0">
                  <div className="h-7 w-7 rounded-lg bg-elevated border border-border-subtle flex items-center justify-center text-secondary shrink-0 mt-0.5">
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-foreground leading-snug">{ev.title}</p>
                      <span className="text-[11px] font-mono-tabular text-muted shrink-0">
                        {formatTimeRelative(ev.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-secondary mt-0.5 leading-relaxed">
                      {ev.description}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
