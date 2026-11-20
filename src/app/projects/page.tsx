import * as React from 'react';
import { Download, FileEdit, Palette, Plus, Search, Tag } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { useEditorStore } from '../../stores/useEditorStore';
import type { ProjectStatus } from '../../types';
import { formatDateShort } from '../../utils/format';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { BookCoverImage } from '../../components/shared/BookCoverImage';
import { EmptyState } from '../../components/shared/EmptyState';
import { cn } from '../../utils/cn';

const STATUS_TABS: Array<'All' | ProjectStatus> = [
  'All',
  'Drafting',
  'Researching',
  'In Review',
  'Cover Ready',
  'Completed',
];

export default function ProjectsPage() {
  const projects = useAppStore((s) => s.projects);
  const setCreateModalOpen = useAppStore((s) => s.setCreateModalOpen);
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const setRoute = useAppStore((s) => s.setRoute);
  const ensureDocument = useEditorStore((s) => s.ensureDocument);

  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'All' | ProjectStatus>('All');

  const filtered = React.useMemo(() => {
    return projects.filter((p) => {
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [projects, query, statusFilter]);

  const navigateWithProject = (
    projectId: string,
    target: '/editor' | '/cover-studio' | '/seo' | '/exports'
  ) => {
    const proj = projects.find((p) => p.id === projectId);
    if (proj) {
      ensureDocument(proj.id, proj.title, proj.trimSize, proj.pageCount);
    }
    setActiveProjectId(projectId);
    setRoute(target);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Book Projects
          </h1>
          <p className="text-sm text-secondary">
            Manage manuscripts, jump directly into interior page editing, cover design, SEO, or
            exports.
          </p>
        </div>

        <Button onClick={() => setCreateModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Create New Book
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative w-full md:max-w-sm">
          <Search className="h-4 w-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects by title or category..."
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-1 flex-wrap p-1 rounded-xl bg-sidebar border border-border-subtle">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
                statusFilter === tab
                  ? 'bg-accent text-white'
                  : 'text-secondary hover:text-foreground hover:bg-surface-hover'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No matching projects"
          description="Try clearing your search filter or create a new book project."
          actionLabel="Create New Book"
          onAction={() => setCreateModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((project) => (
            <Card key={project.id} className="p-4 flex flex-col sm:flex-row gap-4">
              <div className="w-24 shrink-0 aspect-[3/4] rounded-lg overflow-hidden border border-border-subtle bg-elevated">
                <BookCoverImage
                  src={project.thumbnail}
                  alt={project.title}
                  title={project.title}
                  className="w-full h-full"
                />
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
                <div>
                  <p className="text-xs text-secondary">
                    {project.category} · {project.status} · {project.marketplace}
                  </p>
                  <h3 className="font-display text-base font-semibold text-foreground mt-1">
                    {project.title}
                  </h3>
                  {project.subtitle && (
                    <p className="text-xs text-secondary mt-0.5 line-clamp-1">{project.subtitle}</p>
                  )}
                  <p className="text-xs font-mono-tabular text-muted mt-1.5">
                    {project.trimSize}&quot; · {project.pageCount} pages · Updated{' '}
                    {formatDateShort(project.updatedAt)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => navigateWithProject(project.id, '/editor')}
                  >
                    <FileEdit className="h-3.5 w-3.5" />
                    Editor
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigateWithProject(project.id, '/cover-studio')}
                  >
                    <Palette className="h-3.5 w-3.5" />
                    Cover
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigateWithProject(project.id, '/seo')}
                  >
                    <Tag className="h-3.5 w-3.5" />
                    SEO
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigateWithProject(project.id, '/exports')}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
