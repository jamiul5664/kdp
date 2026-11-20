import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, FileText, AlertTriangle } from 'lucide-react';
import type { ChatMessage, WorkflowCardData } from '../../types';
import { formatFileSize, formatTimeRelative } from '../../utils/format';
import { WorkflowCard } from './WorkflowCard';

interface ChatMessageListProps {
  messages: ChatMessage[];
  onViewResearch: (card: WorkflowCardData) => void;
  onApprove: (messageId: string, card: WorkflowCardData) => void;
  onReject: (messageId: string, card: WorkflowCardData) => void;
  onAskImprove: (messageId: string, card: WorkflowCardData) => void;
  onOpenEditor: (projectId: string) => void;
  onOpenCoverStudio: (projectId: string) => void;
  onQuickPrompt: (prompt: string) => void;
}

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = React.useState(false);
  const codeText = String(children ?? '').replace(/\n$/, '');
  const language = className?.replace('language-', '') || 'text';

  const handleCopy = () => {
    navigator.clipboard?.writeText(codeText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="my-3 rounded-lg border border-border-strong bg-canvas overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-subtle bg-sidebar text-xs text-muted">
        <span className="font-mono-tabular">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-secondary hover:text-foreground transition-colors cursor-pointer"
        >
          {copied ? <Check className="h-3 w-3 text-teal" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-xs font-mono-tabular leading-relaxed text-foreground">
        <code>{codeText}</code>
      </pre>
    </div>
  );
}

const STARTER_PROMPTS = [
  'Cozy Cottagecore Botanical Coloring Book for Stress Relief',
  'Bedtime Woodland Adventure Storybook for Kids Ages 4-8',
  '90-Day Morning Gratitude & Habit Reflection Journal for Busy Professionals',
  'Large-Print Word Search & Logic Puzzle Book for Seniors',
];

export function ChatMessageList({
  messages,
  onViewResearch,
  onApprove,
  onReject,
  onAskImprove,
  onOpenEditor,
  onOpenCoverStudio,
  onQuickPrompt,
}: ChatMessageListProps) {
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-10 flex items-center justify-center">
        <div className="max-w-2xl w-full space-y-6">
          <div className="space-y-2">
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Type a Topic — Get a Ready-to-Download KDP Book
            </h2>
            <p className="text-sm text-secondary">
              Enter any book topic below to automatically research the niche, write the pages,
              calculate KDP cover specs, and generate direct PDF/ZIP download links — or open any
              project manually in the Book Editor.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onQuickPrompt(prompt)}
                className="text-left rounded-xl border border-border-subtle bg-surface hover:bg-surface-hover hover:border-border-strong p-4 text-sm text-foreground transition-colors cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-2 text-xs text-muted mb-1.5 px-1">
                <span className="font-medium text-secondary">
                  {isUser ? 'You' : 'KDP Studio AI'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">{formatTimeRelative(msg.createdAt)}</span>
              </div>

              <div
                className={
                  isUser
                    ? 'max-w-[85%] rounded-xl bg-accent/16 border border-accent/30 px-4 py-3 text-sm text-foreground'
                    : 'w-full rounded-xl bg-surface border border-border-subtle px-5 py-4 text-sm text-foreground'
                }
              >
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {msg.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-canvas border border-border-subtle px-2.5 py-1.5 text-xs text-secondary"
                      >
                        <FileText className="h-3.5 w-3.5 text-accent" />
                        <span className="truncate max-w-[180px] text-foreground">{att.name}</span>
                        <span className="font-mono-tabular text-muted">
                          {formatFileSize(att.size)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {isUser ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                ) : (
                  <>
                    {msg.content ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed space-y-2.5 [&_h1]:font-display [&_h2]:font-display [&_h3]:font-display [&_h3]:text-base [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border-subtle [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:bg-sidebar [&_td]:border [&_td]:border-border-subtle [&_td]:px-3 [&_td]:py-1.5">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({ className, children, ...props }) {
                              const isBlock = Boolean(className) || String(children).includes('\n');
                              if (isBlock) {
                                return <CodeBlock className={className}>{children}</CodeBlock>;
                              }
                              return (
                                <code
                                  className="rounded bg-elevated px-1.5 py-0.5 text-xs font-mono-tabular text-teal"
                                  {...props}
                                >
                                  {children}
                                </code>
                              );
                            },
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : msg.isStreaming ? (
                      <div className="flex items-center gap-2 text-xs text-secondary py-1">
                        <span className="inline-flex gap-1" aria-hidden="true">
                          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce [animation-delay:-0.2s]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce [animation-delay:-0.1s]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" />
                        </span>
                        <span>Researching market &amp; building your KDP book...</span>
                      </div>
                    ) : null}

                    {msg.error && (
                      <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-300">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{msg.error}</span>
                      </div>
                    )}

                    {msg.workflowCards && msg.workflowCards.length > 0 && (
                      <div className="space-y-3 mt-3">
                        {msg.workflowCards.map((card) => (
                          <WorkflowCard
                            key={card.id}
                            card={card}
                            onViewResearch={onViewResearch}
                            onApprove={(c) => onApprove(msg.id, c)}
                            onReject={(c) => onReject(msg.id, c)}
                            onAskImprove={(c) => onAskImprove(msg.id, c)}
                            onOpenEditor={onOpenEditor}
                            onOpenCoverStudio={onOpenCoverStudio}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}
