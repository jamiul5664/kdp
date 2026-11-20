import { ArrowUpRight } from 'lucide-react';
import type { BookProject } from '../../types';
import { formatDateShort } from '../../utils/format';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { BookCoverImage } from '../shared/BookCoverImage';

interface RecentProjectCardProps {
  project: BookProject;
  onOpen: (projectId: string) => void;
}

const STATUS_COLOR: Record<BookProject['status'], string> = {
  Completed: 'text-emerald-400',
  'Cover Ready': 'text-teal',
  'In Review': 'text-amber-400',
  Drafting: 'text-accent',
  Researching: 'text-secondary',
};

export function RecentProjectCard({ project, onOpen }: RecentProjectCardProps) {
  return (
    <Card interactive className="p-4 flex gap-4 items-stretch">
      <div className="w-20 sm:w-24 shrink-0 aspect-[3/4] rounded-lg overflow-hidden border border-border-subtle bg-elevated">
        <BookCoverImage
          src={project.thumbnail}
          alt={`${project.title} cover preview`}
          title={project.title}
          className="w-full h-full"
        />
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-secondary flex-wrap">
            <span>{project.category}</span>
            <span aria-hidden="true">·</span>
            <span className={STATUS_COLOR[project.status]}>{project.status}</span>
          </div>

          <h3 className="font-display text-sm sm:text-base font-semibold text-foreground mt-1 line-clamp-1">
            {project.title}
          </h3>
          <p className="text-xs text-muted mt-0.5 font-mono-tabular">
            Updated {formatDateShort(project.updatedAt)} · {project.trimSize}&quot; ·{' '}
            {project.pageCount} pages
          </p>
        </div>

        <div className="space-y-2.5">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-secondary">Completion</span>
              <span className="font-mono-tabular font-medium text-foreground">
                {project.progress}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-elevated overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-200"
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button size="sm" variant="secondary" onClick={() => onOpen(project.id)}>
              Open Project
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
