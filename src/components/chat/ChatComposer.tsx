import * as React from 'react';
import { FilePenLine, FileText, Paperclip, Send, Sparkles, Square, X } from 'lucide-react';
import type { ChatAttachment } from '../../types';
import { formatFileSize, generateId } from '../../utils/format';
import { Button } from '../ui/Button';

export type ChatComposeMode = 'auto_book' | 'chat';

interface ChatComposerProps {
  isStreaming: boolean;
  mode: ChatComposeMode;
  onModeChange: (mode: ChatComposeMode) => void;
  onSend: (text: string, attachments: ChatAttachment[]) => void;
  onAutoCreateBook: (topic: string) => void;
  onOpenManualEditor: () => void;
  onStop: () => void;
}

export function ChatComposer({
  isStreaming,
  mode,
  onModeChange,
  onSend,
  onAutoCreateBook,
  onOpenManualEditor,
  onStop,
}: ChatComposerProps) {
  const [input, setInput] = React.useState('');
  const [attachments, setAttachments] = React.useState<ChatAttachment[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const next: ChatAttachment[] = [];

    for (const file of files) {
      let previewText: string | undefined;
      if (
        file.type.startsWith('text/') ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.csv') ||
        file.name.endsWith('.json')
      ) {
        try {
          previewText = (await file.text()).slice(0, 2000);
        } catch {
          previewText = undefined;
        }
      }
      next.push({
        id: generateId('att'),
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        previewText,
      });
    }

    setAttachments((prev) => [...prev, ...next]);
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isStreaming) return;
    const trimmed = input.trim();
    if (!trimmed && attachments.length === 0) return;

    if (mode === 'auto_book' && trimmed) {
      onAutoCreateBook(trimmed);
    } else {
      onSend(trimmed || 'Analyze the attached file(s) for KDP publishing.', attachments);
    }
    setInput('');
    setAttachments([]);
  };

  return (
    <div className="border-t border-border-subtle bg-sidebar px-4 sm:px-6 py-3.5 shrink-0">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="inline-flex items-center rounded-lg border border-border-subtle bg-canvas p-0.5">
            <button
              type="button"
              onClick={() => onModeChange('auto_book')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                mode === 'auto_book'
                  ? 'bg-accent text-white'
                  : 'text-secondary hover:text-foreground'
              }`}
            >
              <Sparkles className="h-3 w-3" />
              Auto: Research → Create → Download Link
            </button>
            <button
              type="button"
              onClick={() => onModeChange('chat')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                mode === 'chat'
                  ? 'bg-surface text-foreground'
                  : 'text-secondary hover:text-foreground'
              }`}
            >
              Chat &amp; Approve
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenManualEditor}
            className="inline-flex items-center gap-1.5 text-secondary hover:text-foreground transition-colors cursor-pointer"
          >
            <FilePenLine className="h-3.5 w-3.5 text-teal" />
            <span>Or work manually in Book Editor</span>
          </button>
        </div>

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="inline-flex items-center gap-2 rounded-lg bg-surface border border-border-subtle px-2.5 py-1.5 text-xs text-foreground"
              >
                <FileText className="h-3.5 w-3.5 text-accent" />
                <span className="max-w-[160px] truncate">{att.name}</span>
                <span className="font-mono-tabular text-muted">{formatFileSize(att.size)}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  aria-label={`Remove ${att.name}`}
                  className="text-muted hover:text-foreground cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-xl border border-border-strong bg-canvas p-2 focus-within:ring-2 focus-within:ring-accent">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.csv,.json,.pdf,image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach reference file"
            title="Attach manuscript notes, CSV keywords, or brief"
            className="h-9 w-9 rounded-lg inline-flex items-center justify-center text-secondary hover:text-foreground hover:bg-surface-hover transition-colors shrink-0 cursor-pointer"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={
              mode === 'auto_book'
                ? 'Type any book topic (e.g., Cozy Botanical Coloring Book for Adults) — AI will research, create & give download link...'
                : 'Ask KDP Studio AI to research niches, propose book concepts, or check trim specs...'
            }
            className="flex-1 resize-none bg-transparent py-2 px-1 text-sm text-foreground placeholder:text-muted focus:outline-none max-h-36"
          />

          {isStreaming ? (
            <Button type="button" variant="danger" size="sm" onClick={onStop}>
              <Square className="h-3.5 w-3.5 fill-current" />
              Stop
            </Button>
          ) : (
            <Button
              type="submit"
              size="sm"
              disabled={!input.trim() && attachments.length === 0}
            >
              {mode === 'auto_book' ? (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Create Book
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Send
                </>
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
