import { create } from 'zustand';
import type {
  ApprovalState,
  ChatAttachment,
  ChatMessage,
  Conversation,
  WorkflowCardData,
} from '../types';
import { generateId } from '../utils/format';

const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv_niche_plan',
    title: 'Q4 Low-Competition Coloring Niches',
    updatedAt: '2026-11-19T20:45:00Z',
    messages: [
      {
        id: 'msg_init_1',
        role: 'user',
        content:
          'Analyze seasonal KDP opportunities for botanical coloring books and recommend an actionable differentiation angle.',
        createdAt: '2026-11-19T20:42:00Z',
      },
      {
        id: 'msg_init_2',
        role: 'assistant',
        content:
          'I evaluated buyer intent across adult botanical coloring sub-niches and identified **5 differentiated book opportunities** with manageable review thresholds.\n\n### Top Opportunity Highlight\n- **Concept:** *Pressed Wildflower & Herbarium Line Art*\n- **Trim & Interior:** `8.5" × 11"`, single-sided plates with subtle dark reverse backing to prevent marker bleed-through.\n- **Reader Gap:** Many top listings cram intricate florals onto thin double-sided spreads without plant species captions.\n\nReview the proposal card below to inspect live market research, approve this direction into a book project, or ask me to refine the angle.',
        createdAt: '2026-11-19T20:45:00Z',
        workflowCards: [
          {
            id: 'wf_demo_research_done',
            type: 'research_completed',
            title: 'Research Completed',
            summary: 'Synthesized 5 sub-niche opportunities across adult botanical & mindfulness coloring.',
            progress: 100,
            metrics: [
              { label: 'Opportunities', value: '5 concepts' },
              { label: 'Suggested Trim', value: '8.5" × 11"' },
            ],
          },
          {
            id: 'wf_demo_approval',
            type: 'approval_required',
            title: 'Approval Required — Book Opportunity Proposal',
            summary:
              'I found 5 possible book opportunities. Approve "Herbarium Botanical Line Art" to initialize a project, inspect deeper market research, or ask AI to refine the positioning.',
            approvalState: 'pending',
            nicheQuery: 'botanical wildflower coloring books for adults',
            proposedBook: {
              title: 'Herbarium Botanicals: Calm Line-Art Coloring Book',
              category: 'Coloring Books',
              trimSize: '8.5x11',
              targetAudience: 'Adults & Stress-Relief Colorists',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'conv_trim_specs',
    title: 'KDP Bleed & Margin Spec Check',
    updatedAt: '2026-11-18T14:15:00Z',
    messages: [
      {
        id: 'msg_init_3',
        role: 'user',
        content: 'What are the exact full-bleed dimensions for an 8.5 x 8.5 children book on KDP?',
        createdAt: '2026-11-18T14:14:00Z',
      },
      {
        id: 'msg_init_4',
        role: 'assistant',
        content:
          'For an **8.5" × 8.5"** KDP paperback with full bleed:\n\n```text\nTrim Size:   8.500" × 8.500"\nWith Bleed:  8.625" × 8.750" (+0.125" outer width, +0.250" total height)\nAt 300 DPI:  2588 px × 2625 px\nSafe Margin: Keep text at least 0.375" inside the trim edge\n```\n\nYou can apply these settings directly inside the **Book Editor → Book Settings** panel.',
        createdAt: '2026-11-18T14:15:00Z',
      },
    ],
  },
];

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string;
  searchQuery: string;
  isStreaming: boolean;

  setActiveConversation: (id: string) => void;
  setSearchQuery: (q: string) => void;
  createConversation: (title?: string) => string;
  renameConversation: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
  appendUserMessage: (conversationId: string, content: string, attachments?: ChatAttachment[]) => string;
  createAssistantPlaceholder: (conversationId: string) => string;
  appendAssistantToken: (conversationId: string, messageId: string, token: string) => void;
  addWorkflowCard: (conversationId: string, messageId: string, card: WorkflowCardData) => void;
  finishAssistantMessage: (conversationId: string, messageId: string, error?: string) => void;
  updateWorkflowApproval: (
    conversationId: string,
    messageId: string,
    cardId: string,
    state: ApprovalState
  ) => void;
  setStreaming: (streaming: boolean) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: INITIAL_CONVERSATIONS,
  activeConversationId: INITIAL_CONVERSATIONS[0].id,
  searchQuery: '',
  isStreaming: false,

  setActiveConversation: (id) => set({ activeConversationId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  createConversation: (title = 'New Publishing Session') => {
    const newConv: Conversation = {
      id: generateId('conv'),
      title,
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    set((state) => ({
      conversations: [newConv, ...state.conversations],
      activeConversationId: newConv.id,
    }));
    return newConv.id;
  },

  renameConversation: (id, title) => {
    const clean = title.trim();
    if (!clean) return;
    set((state) => ({
      conversations: state.conversations.map((c) => (c.id === id ? { ...c, title: clean } : c)),
    }));
  },

  deleteConversation: (id) => {
    const remaining = get().conversations.filter((c) => c.id !== id);
    if (remaining.length === 0) {
      const fresh: Conversation = {
        id: generateId('conv'),
        title: 'New Publishing Session',
        updatedAt: new Date().toISOString(),
        messages: [],
      };
      set({ conversations: [fresh], activeConversationId: fresh.id });
      return;
    }
    set((state) => ({
      conversations: remaining,
      activeConversationId:
        state.activeConversationId === id ? remaining[0].id : state.activeConversationId,
    }));
  },

  appendUserMessage: (conversationId, content, attachments) => {
    const msgId = generateId('msg');
    const now = new Date().toISOString();
    const msg: ChatMessage = {
      id: msgId,
      role: 'user',
      content,
      createdAt: now,
      attachments,
    };
    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        const shouldAutoTitle = c.messages.length === 0 && c.title === 'New Publishing Session';
        return {
          ...c,
          title: shouldAutoTitle ? content.slice(0, 44).trim() || c.title : c.title,
          updatedAt: now,
          messages: [...c.messages, msg],
        };
      }),
    }));
    return msgId;
  },

  createAssistantPlaceholder: (conversationId) => {
    const msgId = generateId('msg');
    const now = new Date().toISOString();
    const placeholder: ChatMessage = {
      id: msgId,
      role: 'assistant',
      content: '',
      createdAt: now,
      workflowCards: [],
      isStreaming: true,
    };
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, updatedAt: now, messages: [...c.messages, placeholder] }
          : c
      ),
    }));
    return msgId;
  },

  appendAssistantToken: (conversationId, messageId, token) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id !== conversationId
          ? c
          : {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, content: m.content + token } : m
              ),
            }
      ),
    }));
  },

  addWorkflowCard: (conversationId, messageId, card) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id !== conversationId
          ? c
          : {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      workflowCards: [...(m.workflowCards ?? []), card],
                    }
                  : m
              ),
            }
      ),
    }));
  },

  finishAssistantMessage: (conversationId, messageId, error) => {
    set((state) => ({
      isStreaming: false,
      conversations: state.conversations.map((c) =>
        c.id !== conversationId
          ? c
          : {
              ...c,
              updatedAt: new Date().toISOString(),
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, isStreaming: false, error } : m
              ),
            }
      ),
    }));
  },

  updateWorkflowApproval: (conversationId, messageId, cardId, approvalState) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id !== conversationId
          ? c
          : {
              ...c,
              messages: c.messages.map((m) =>
                m.id !== messageId
                  ? m
                  : {
                      ...m,
                      workflowCards: (m.workflowCards ?? []).map((card) =>
                        card.id === cardId ? { ...card, approvalState } : card
                      ),
                    }
              ),
            }
      ),
    }));
  },

  setStreaming: (streaming) => set({ isStreaming: streaming }),
}));
