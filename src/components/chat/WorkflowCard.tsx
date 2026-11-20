import {
  BookOpen,
  CheckCircle2,
  Download,
  FilePenLine,
  Palette,
  Search,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type { WorkflowCardData } from '../../types';
import { Button } from '../ui/Button';

interface WorkflowCardProps {
  card: WorkflowCardData;
  onViewResearch: (card: WorkflowCardData) => void;
  onApprove: (card: WorkflowCardData) => void;
  onReject: (card: WorkflowCardData) => void;
  onAskImprove: (card: WorkflowCardData) => void;
  onOpenEditor?: (projectId: string) => void;
  onOpenCoverStudio?: (projectId: string) => void;
}

const CARD_META: Record<
  WorkflowCardData['type'],
  { label: string; icon: typeof Search; tone: string }
> = {
  research_started: { label: 'Research Started', icon: Search, tone: 'text-accent' },
  research_completed: { label: 'Research Completed', icon: CheckCircle2, tone: 'text-teal' },
  book_proposal: { label: 'Book Proposal', icon: BookOpen, tone: 'text-accent' },
  approval_required: { label: 'Approval Required', icon: ShieldCheck, tone: 'text-amber-400' },
  book_generation_progress: {
    label: 'Book Created',
    icon: BookOpen,
    tone: 'text-accent',
  },
  cover_generation_progress: {
    label: 'Cover Direction',
    icon: Palette,
    tone: 'text-teal',
  },
  export_completed: { label: 'Ready to Download', icon: Download, tone: 'text-emerald-400' },
};

export function WorkflowCard({
  card,
  onViewResearch,
  onApprove,
  onReject,
  onAskImprove,
  onOpenEditor,
  onOpenCoverStudio,
}: WorkflowCardProps) {
  const meta = CARD_META[card.type] ?? CARD_META.book_proposal;
  const Icon = meta.icon;
  const isInteractiveApproval =
    card.type === 'approval_required' || card.type === 'book_proposal';

  return (
    <div className="mt-3 rounded-xl border border-border-strong bg-sidebar p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-surface border border-border-subtle flex items-center justify-center shrink-0 mt-0.5">
            <Icon className={`h-4 w-4 ${meta.tone}`} />
          </div>
          <div className="min-w-0">
            <p className={`text-xs font-medium ${meta.tone}`}>{meta.label}</p>
            <h4 className="font-display text-sm font-semibold text-foreground mt-0.5">
              {card.title}
            </h4>
          </div>
        </div>

        {card.approvalState && card.approvalState !== 'pending' && (
          <span
            className={`text-xs font-medium whitespace-nowrap ${
              card.approvalState === 'approved'
                ? 'text-emerald-400'
                : card.approvalState === 'rejected'
                  ? 'text-rose-400'
                  : 'text-teal'
            }`}
          >
            {card.approvalState === 'approved'
              ? 'Approved & Built'
              : card.approvalState === 'rejected'
                ? 'Rejected'
                : 'Refining with AI'}
          </span>
        )}
      </div>

      <p className="text-xs sm:text-sm text-secondary leading-relaxed">{card.summary}</p>

      {card.proposedBook && (
        <div className="rounded-lg bg-surface border border-border-subtle px-3.5 py-2.5 text-xs flex flex-wrap items-center gap-x-3 gap-y-1 text-secondary">
          <span className="font-medium text-foreground">{card.proposedBook.title}</span>
          <span aria-hidden="true">·</span>
          <span>{card.proposedBook.category}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">{card.proposedBook.trimSize}&quot;</span>
          <span aria-hidden="true">·</span>
          <span>{card.proposedBook.targetAudience}</span>
        </div>
      )}

      {card.metrics && card.metrics.length > 0 && (
        <div className="flex flex-wrap items-center gap-5 pt-1 text-xs">
          {card.metrics.map((m) => (
            <div key={m.label}>
              <span className="text-muted">{m.label}: </span>
              <span className="font-mono-tabular font-medium text-foreground">{m.value}</span>
            </div>
          ))}
        </div>
      )}

      {typeof card.progress === 'number' && !isInteractiveApproval && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Workflow progress</span>
            <span className="font-mono-tabular text-foreground">{card.progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface overflow-hidden">
            <div
              className="h-full rounded-full bg-teal transition-[width] duration-200"
              style={{ width: `${card.progress}%` }}
            />
          </div>
        </div>
      )}

      {card.downloadLinks && card.downloadLinks.length > 0 && (
        <div className="space-y-2.5 pt-1">
          <p className="text-xs font-medium text-emerald-400">
            Book Download Links (Ready Now):
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {card.downloadLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                download={link.fileName}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                  link.primary
                    ? 'border-accent bg-accent/15 hover:bg-accent/25 text-foreground font-medium'
                    : 'border-border-subtle bg-surface hover:bg-surface-hover text-foreground'
                }`}
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  <Download className={`h-3.5 w-3.5 shrink-0 ${link.primary ? 'text-accent' : 'text-teal'}`} />
                  <span className="truncate">{link.label}</span>
                </span>
                <span className="font-mono-tabular text-muted shrink-0">{link.fileSize}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {card.projectId && (onOpenEditor || onOpenCoverStudio) && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border-subtle">
          {onOpenEditor && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onOpenEditor(card.projectId!)}
            >
              <FilePenLine className="h-3.5 w-3.5" />
              Edit Manually in Book Editor
            </Button>
          )}
          {onOpenCoverStudio && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenCoverStudio(card.projectId!)}
            >
              <Palette className="h-3.5 w-3.5" />
              Customize Cover Manually
            </Button>
          )}
        </div>
      )}

      {isInteractiveApproval && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="primary"
            disabled={card.approvalState === 'approved'}
            onClick={() => onApprove(card)}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {card.approvalState === 'approved'
              ? 'Book Created'
              : 'Approve & Create Book + Download Link'}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onViewResearch(card)}>
            <Search className="h-3.5 w-3.5" />
            View Research
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAskImprove(card)}>
            <Sparkles className="h-3.5 w-3.5" />
            Ask AI to Improve
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={card.approvalState === 'rejected'}
            onClick={() => onReject(card)}
          >
            <XCircle className="h-3.5 w-3.5" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
