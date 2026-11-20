import * as React from 'react';
import { Cpu, SlidersHorizontal } from 'lucide-react';
import { useChatStore } from '../../stores/useChatStore';
import { useAppStore } from '../../stores/useAppStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useAdvancedStudioStore } from '../../stores/useAdvancedStudioStore';
import { runAutoBookPipeline, streamChatMessage } from '../../services/chatService';
import {
  fetchProviderState,
  updateTaskAssignment,
  type PublicApiConfig,
  type TaskAssignment,
} from '../../services/providerService';
import type { ChatAttachment, WorkflowCardData } from '../../types';
import { ChatSidebar } from '../../components/chat/ChatSidebar';
import { ChatMessageList } from '../../components/chat/ChatMessageList';
import { ChatComposer, type ChatComposeMode } from '../../components/chat/ChatComposer';
import { generateId } from '../../utils/format';

export default function ChatPage() {
  const [composeMode, setComposeMode] = React.useState<ChatComposeMode>('auto_book');
  const [providerConfigs, setProviderConfigs] = React.useState<PublicApiConfig[]>([]);
  const [chatAssignment, setChatAssignment] = React.useState<TaskAssignment | null>(null);
  const [switchingProvider, setSwitchingProvider] = React.useState(false);

  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeConversationId);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const appendUserMessage = useChatStore((s) => s.appendUserMessage);
  const createAssistantPlaceholder = useChatStore((s) => s.createAssistantPlaceholder);
  const appendAssistantToken = useChatStore((s) => s.appendAssistantToken);
  const addWorkflowCard = useChatStore((s) => s.addWorkflowCard);
  const finishAssistantMessage = useChatStore((s) => s.finishAssistantMessage);
  const updateWorkflowApproval = useChatStore((s) => s.updateWorkflowApproval);
  const setStreaming = useChatStore((s) => s.setStreaming);

  const user = useAppStore((s) => s.user);
  const setRoute = useAppStore((s) => s.setRoute);
  const setPendingResearchQuery = useAppStore((s) => s.setPendingResearchQuery);
  const createProject = useAppStore((s) => s.createProject);
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const openProjectInEditor = useAppStore((s) => s.openProjectInEditor);
  const adjustPendingApprovals = useAppStore((s) => s.adjustPendingApprovals);
  const addActivity = useAppStore((s) => s.addActivity);
  const addExportJob = useAppStore((s) => s.addExportJob);
  const hydrateGeneratedDocument = useEditorStore((s) => s.hydrateGeneratedDocument);

  const abortRef = React.useRef<AbortController | null>(null);

  const activeConversation =
    conversations.find((c) => c.id === activeId) ?? conversations[0];

  React.useEffect(() => {
    let active = true;
    fetchProviderState()
      .then((res) => {
        if (!active) return;
        setProviderConfigs(res.configs);
        setChatAssignment(
          res.taskAssignments.find((a) => a.taskKey === 'chat_assistant') ?? null
        );
      })
      .catch(() => {
        // Non-blocking: chat still operates with default backend provider
      });
    return () => {
      active = false;
      abortRef.current?.abort();
    };
  }, []);

  const enabledChatConfigs = React.useMemo(
    () => providerConfigs.filter((c) => c.enabled),
    [providerConfigs]
  );

  const activeChatConfig = React.useMemo(() => {
    if (chatAssignment?.primaryConfigId) {
      const matched = enabledChatConfigs.find((c) => c.id === chatAssignment.primaryConfigId);
      if (matched) return matched;
    }
    return enabledChatConfigs.find((c) => c.isDefault) ?? enabledChatConfigs[0] ?? null;
  }, [chatAssignment, enabledChatConfigs]);

  const activeChatModel =
    chatAssignment?.primaryModelId || activeChatConfig?.defaultModel || 'gemini-2.5-flash';

  const handleSwitchChatProvider = async (nextConfigId: string) => {
    const nextCfg = enabledChatConfigs.find((c) => c.id === nextConfigId);
    if (!nextCfg) return;
    setSwitchingProvider(true);
    try {
      const res = await updateTaskAssignment('chat_assistant', {
        mode: 'manual',
        primaryConfigId: nextCfg.id,
        primaryModelId: nextCfg.defaultModel || nextCfg.models[0]?.modelId || null,
      });
      setChatAssignment(res.assignment);
    } catch {
      // Keep previous assignment on error
    } finally {
      setSwitchingProvider(false);
    }
  };

  const executeTopicToBookPipeline = async (
    convId: string,
    assistantMsgId: string,
    params: {
      topic: string;
      category?: string;
      targetAudience?: string;
      trimSize?: string;
      pageCount?: number;
    }
  ) => {
    setStreaming(true);

    addWorkflowCard(convId, assistantMsgId, {
      id: generateId('wf_res_start'),
      type: 'research_started',
      title: `Researching & Building Book: "${params.topic}"`,
      summary:
        'Running KDP market research, drafting original interior pages, calculating full-wrap cover specs, and compiling downloadable PDF & ZIP files...',
      progress: 45,
    });

    try {
      const result = await runAutoBookPipeline({
        topic: params.topic,
        category: params.category,
        targetAudience: params.targetAudience,
        trimSize: params.trimSize,
        pageCount: params.pageCount,
        author: user.name,
      });

      // 1. Save as a real editable project in App Store + Manual Book Editor
      const project = createProject({
        title: result.book.title,
        subtitle: result.book.subtitle,
        category: result.book.category,
        trimSize: result.book.trimSize,
        pageCount: result.book.pageCount,
      });

      hydrateGeneratedDocument({
        projectId: project.id,
        trimSize: result.book.trimSize,
        pageCount: result.book.pageCount,
        paperType: result.book.paperType,
        interiorType: result.book.interiorType,
        bleed: result.book.bleed,
        pages: result.pages,
      });

      // 2. Register all real downloadable files in Exports Store too
      for (const dl of result.downloads) {
        addExportJob({
          id: dl.id,
          projectId: project.id,
          projectTitle: project.title,
          artifactType: dl.artifactType,
          format: dl.format,
          fileName: dl.fileName,
          trimSize: result.book.trimSize,
          status: 'Completed',
          validationStatus: 'Passed',
          fileSize: dl.fileSize,
          downloadUrl: dl.url,
          createdAt: new Date().toISOString(),
        });
      }

      const markdownReport = [
        `### Book Created: **${result.book.title}**`,
        `*${result.book.subtitle}*`,
        '',
        '#### 1. Market Research Summary',
        result.research.summary,
        `- **Differentiation / Market Gap:** ${result.research.marketGap}`,
        `- **Estimated Opportunity Score:** \`${result.research.opportunityScore}/100\` *(AI estimate; actual Amazon unit sales are Not Available from public sources)*`,
        `- **Top KDP Backend Keywords:** ${result.research.keywords.map((k) => `\`${k}\``).join(', ')}`,
        '',
        '#### 2. Generated Manuscript & KDP Specs',
        `- **Category:** ${result.book.category} · **Audience:** ${result.book.targetAudience}`,
        `- **Trim & Layout:** \`${result.book.trimSize}"\` · \`${result.book.pageCount} pages\` · \`${result.book.paperType}\` · **Spine:** \`${result.coverSpec.spineWidthIn}"\``,
        `- **Created Pages:** ${result.pages.length} editable pages saved directly to your workspace.`,
        '',
        'Download your book files directly from the card below, or click **Edit Manually in Book Editor** to customize text, pages, or cover.',
      ].join('\n');

      appendAssistantToken(convId, assistantMsgId, markdownReport);

      addWorkflowCard(convId, assistantMsgId, {
        id: generateId('wf_export_ready'),
        type: 'export_completed',
        title: `Download Ready — ${result.book.title}`,
        summary: `Researched, created ${result.pages.length} original pages, and compiled your print-ready KDP Interior PDF, Full Cover Wrap PDF, Preview HTML, and Complete ZIP package.`,
        progress: 100,
        projectId: project.id,
        metrics: [
          { label: 'Trim Size', value: `${result.book.trimSize}"` },
          { label: 'Spine Width', value: `${result.coverSpec.spineWidthIn}"` },
          { label: 'Pages Created', value: `${result.pages.length} editable` },
        ],
        downloadLinks: result.downloads.map((d) => ({
          id: d.id,
          label: d.label,
          fileName: d.fileName,
          fileSize: d.fileSize,
          url: d.url,
          primary: d.primary,
        })),
      });

      addActivity({
        title: `Auto-researched & created "${project.title}"`,
        description: `Generated KDP Interior PDF, Full Cover Wrap PDF, and Complete ZIP directly from chat.`,
        category: 'export',
        projectId: project.id,
      });

      const adv = useAdvancedStudioStore.getState();
      adv.createWorkflow({
        projectId: project.id,
        bookTitle: project.title,
        source: 'Chat',
      });
      adv.pushNotificationHistory({
        channel: adv.notificationPrefs.emailEnabled ? 'In-App + Email' : 'In-App',
        category: 'Export Complete',
        title: `Chat Book Export Ready: ${project.title}`,
        message: `Generated ${result.pages.length} editable pages, Interior PDF, Cover Wrap PDF, and Complete ZIP.`,
      });
      adv.addResearchHistory({
        type: 'Niche Research',
        query: params.topic,
        marketplace: 'amazon.com',
        confidenceScore: result.research.sources.length > 0 ? 78 : 60,
        sourceCount: result.research.sources.length,
        summary: result.research.summary,
      });

      finishAssistantMessage(convId, assistantMsgId);
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : 'Failed to research and create book.';
      finishAssistantMessage(convId, assistantMsgId, errMsg);
    }
  };

  const handleAutoCreateBook = async (topic: string) => {
    if (!activeConversation || isStreaming) return;
    const convId = activeConversation.id;
    appendUserMessage(convId, topic);
    const assistantMsgId = createAssistantPlaceholder(convId);
    await executeTopicToBookPipeline(convId, assistantMsgId, { topic });
  };

  const sendMessage = async (text: string, attachments: ChatAttachment[] = []) => {
    if (!activeConversation || isStreaming) return;
    const convId = activeConversation.id;

    const historyForApi = [
      ...activeConversation.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user' as const, content: text },
    ];

    appendUserMessage(convId, text, attachments);
    const assistantMsgId = createAssistantPlaceholder(convId);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    await streamChatMessage({
      messages: historyForApi,
      attachments,
      signal: controller.signal,
      onToken: (token) => {
        appendAssistantToken(convId, assistantMsgId, token);
      },
      onWorkflow: (card) => {
        addWorkflowCard(convId, assistantMsgId, card);
      },
      onDone: () => {
        finishAssistantMessage(convId, assistantMsgId);
        abortRef.current = null;
      },
      onError: (errMsg) => {
        finishAssistantMessage(convId, assistantMsgId, errMsg);
        abortRef.current = null;
      },
    });
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  };

  const handleViewResearch = (card: WorkflowCardData) => {
    if (card.nicheQuery) {
      setPendingResearchQuery(card.nicheQuery);
    }
    setRoute('/research');
  };

  const handleApproveIdea = async (messageId: string, card: WorkflowCardData) => {
    if (!activeConversation || isStreaming) return;
    updateWorkflowApproval(activeConversation.id, messageId, card.id, 'approved');
    adjustPendingApprovals(-1);

    const book = card.proposedBook ?? {
      title: card.topic || card.title,
      category: 'Non-Fiction Guides' as const,
      trimSize: '6x9' as const,
      targetAudience: 'General Readers',
    };

    const assistantMsgId = createAssistantPlaceholder(activeConversation.id);
    await executeTopicToBookPipeline(activeConversation.id, assistantMsgId, {
      topic: card.topic || book.title,
      category: book.category,
      targetAudience: book.targetAudience,
      trimSize: book.trimSize,
    });
  };

  const handleRejectIdea = (messageId: string, card: WorkflowCardData) => {
    if (!activeConversation) return;
    updateWorkflowApproval(activeConversation.id, messageId, card.id, 'rejected');
    adjustPendingApprovals(-1);
  };

  const handleAskImprove = (messageId: string, card: WorkflowCardData) => {
    if (!activeConversation) return;
    updateWorkflowApproval(activeConversation.id, messageId, card.id, 'improving');
    sendMessage(
      `Please improve the book proposal "${card.proposedBook?.title || card.title}" with a sharper differentiation angle, lower competition keywords, and a clearer reader promise.`
    );
  };

  const handleOpenEditor = (projectId: string) => {
    openProjectInEditor(projectId);
  };

  const handleOpenCoverStudio = (projectId: string) => {
    setActiveProjectId(projectId);
    setRoute('/cover-studio');
  };

  const handleQuickPrompt = (prompt: string) => {
    if (composeMode === 'auto_book') {
      handleAutoCreateBook(prompt);
    } else {
      sendMessage(prompt);
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden">
      <ChatSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-canvas">
        <div className="px-5 py-3 border-b border-border-subtle bg-sidebar/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h1 className="font-display text-sm font-semibold text-foreground truncate">
              {activeConversation?.title || 'AI Chat'}
            </h1>
            <p className="text-xs text-muted truncate">
              Type any topic for automated research, book creation &amp; instant download links — or switch to manual studio tools anytime
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-2 text-xs text-secondary">
              <Cpu className="h-3.5 w-3.5 text-accent shrink-0" />
              {enabledChatConfigs.length > 0 ? (
                <select
                  aria-label="Active Chat AI Provider"
                  value={activeChatConfig?.id ?? ''}
                  disabled={switchingProvider}
                  onChange={(e) => void handleSwitchChatProvider(e.target.value)}
                  className="h-8 max-w-[240px] rounded-lg border border-border-subtle bg-surface px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {enabledChatConfigs.map((cfg) => (
                    <option key={cfg.id} value={cfg.id}>
                      {cfg.providerName} · {cfg.defaultModel || cfg.models[0]?.modelId || 'default'}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-mono-tabular text-foreground whitespace-nowrap">
                  {activeChatModel}
                </span>
              )}
              <button
                type="button"
                onClick={() => setRoute('/settings')}
                className="inline-flex items-center gap-1 text-xs text-secondary hover:text-foreground transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Open AI Providers & API Manager"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>APIs</span>
              </button>
            </div>
            {isStreaming && (
              <span className="text-xs font-mono-tabular text-teal whitespace-nowrap shrink-0">
                Working on your book...
              </span>
            )}
          </div>
        </div>

        <ChatMessageList
          messages={activeConversation?.messages ?? []}
          onViewResearch={handleViewResearch}
          onApprove={handleApproveIdea}
          onReject={handleRejectIdea}
          onAskImprove={handleAskImprove}
          onOpenEditor={handleOpenEditor}
          onOpenCoverStudio={handleOpenCoverStudio}
          onQuickPrompt={handleQuickPrompt}
        />

        <ChatComposer
          isStreaming={isStreaming}
          mode={composeMode}
          onModeChange={setComposeMode}
          onSend={sendMessage}
          onAutoCreateBook={handleAutoCreateBook}
          onOpenManualEditor={() => setRoute('/editor')}
          onStop={handleStop}
        />
      </div>
    </div>
  );
}
