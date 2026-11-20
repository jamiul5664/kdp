import * as React from 'react';
import { Check, MessageSquare, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useChatStore } from '../../stores/useChatStore';
import { formatTimeRelative } from '../../utils/format';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';

export function ChatSidebar() {
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeConversationId);
  const searchQuery = useChatStore((s) => s.searchQuery);
  const setSearchQuery = useChatStore((s) => s.setSearchQuery);
  const setActive = useChatStore((s) => s.setActiveConversation);
  const createConversation = useChatStore((s) => s.createConversation);
  const renameConversation = useChatStore((s) => s.renameConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draftTitle, setDraftTitle] = React.useState('');

  const filtered = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [conversations, searchQuery]);

  const startRename = (id: string, currentTitle: string) => {
    setEditingId(id);
    setDraftTitle(currentTitle);
  };

  const commitRename = (id: string) => {
    if (draftTitle.trim()) {
      renameConversation(id, draftTitle);
    }
    setEditingId(null);
  };

  return (
    <aside className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-border-subtle bg-sidebar flex flex-col max-h-60 md:max-h-none">
      <div className="p-3.5 border-b border-border-subtle space-y-2.5">
        <Button className="w-full" size="sm" onClick={() => createConversation()}>
          <Plus className="h-4 w-4" />
          New Conversation
        </Button>

        <div className="relative">
          <Search className="h-3.5 w-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            aria-label="Search conversations"
            className="h-9 w-full rounded-lg bg-canvas border border-border-subtle pl-8 pr-3 text-xs text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted">No matching conversations.</p>
        ) : (
          filtered.map((conv) => {
            const isActive = conv.id === activeId;
            const isEditing = editingId === conv.id;

            return (
              <div
                key={conv.id}
                className={cn(
                  'group rounded-lg px-2.5 py-2 transition-colors',
                  isActive
                    ? 'bg-accent/14 text-foreground'
                    : 'text-secondary hover:bg-surface-hover hover:text-foreground'
                )}
              >
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(conv.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 min-w-0 h-7 rounded bg-canvas border border-border-strong px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                    />
                    <button
                      type="button"
                      onClick={() => commitRename(conv.id)}
                      aria-label="Save title"
                      className="h-7 w-7 rounded inline-flex items-center justify-center text-teal hover:bg-surface cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      aria-label="Cancel rename"
                      className="h-7 w-7 rounded inline-flex items-center justify-center text-muted hover:text-foreground cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setActive(conv.id)}
                      className="flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-accent/80" />
                        <span className="text-xs font-medium truncate">{conv.title}</span>
                      </div>
                      <p className="text-[11px] font-mono-tabular text-muted mt-0.5 pl-5">
                        {conv.messages.length} msgs · {formatTimeRelative(conv.updatedAt)}
                      </p>
                    </button>

                    <div className="flex items-center gap-0.5 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        type="button"
                        onClick={() => startRename(conv.id, conv.title)}
                        aria-label="Rename conversation"
                        className="h-6 w-6 rounded inline-flex items-center justify-center text-muted hover:text-foreground hover:bg-surface cursor-pointer"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteConversation(conv.id)}
                        aria-label="Delete conversation"
                        className="h-6 w-6 rounded inline-flex items-center justify-center text-muted hover:text-rose-400 hover:bg-surface cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
