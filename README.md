# KDP Studio AI — Frontend & Publishing Workspace

A professional dark-mode-first AI SaaS workspace for Amazon KDP publishers covering niche market research, conversational AI publishing workflows, multi-page interior book editing, 3-panel KDP cover design, SEO metadata compliance, and backend-confirmed print exports.

## Folder Structure

```text
kdp-studio-frontend/
├── public/
│   ├── icons/               # Brand mark SVG icons
│   └── images/              # Blueprint & static graphic assets
├── src/
│   ├── app/
│   │   ├── login/           # Sign in screen
│   │   ├── register/        # Account registration screen
│   │   ├── dashboard/       # KPI overview, recent projects, opportunities & timeline
│   │   ├── chat/            # SSE streaming AI chat & interactive workflow approval cards
│   │   ├── research/        # Grounded KDP market research & transparent niche scoring
│   │   ├── niches/          # Niche finder filters & deep niche detail report
│   │   ├── projects/        # Catalog project manager
│   │   ├── editor/          # 3-panel per-page Book Editor with KDP settings & undo/redo
│   │   ├── cover-studio/    # 3-panel AI Book Cover Designer & dynamic spine calculator
│   │   ├── seo/             # KDP SEO metadata, 7 keywords, duplicate & trademark checks
│   │   ├── exports/         # Backend-confirmed PDF, JSON, Preview & ZIP Export Center
│   │   └── settings/        # Light/Dark theme & publisher imprint preferences
│   ├── components/
│   │   ├── layout/          # AppShell, collapsible Sidebar, TopNav, MobileNav, menus
│   │   ├── chat/            # ChatSidebar, MessageList, Composer, WorkflowCard
│   │   ├── research/        # ResearchSearchForm, NicheFilterBar, NicheResultCard, DetailView
│   │   ├── books/           # RecentProjectCard, CreateBookModal
│   │   ├── editor/          # PageThumbnailPanel, BookCanvas, PropertiesPanel, PreviewModal
│   │   ├── cover/           # CoverPreviewCanvas (Back + Spine + Front wrap)
│   │   ├── shared/          # EmptyState, ErrorState, LoadingState, BookCoverImage
│   │   └── ui/              # Reusable Button, Card, Modal, Dropdown, Input, Skeleton
│   ├── hooks/               # useTheme, useKeyboardShortcuts, useAutoSave, useUnsavedWarning
│   ├── services/            # Typed API client, SSE chatService, researchService, studioService
│   ├── stores/              # Zustand stores (useAppStore, useChatStore, useEditorStore)
│   ├── types/               # Strict TypeScript domain interfaces
│   ├── utils/               # Class merge helper, date/size formatters, KDP dimension math
│   └── styles/              # Dark (#0B0D12/#11141C/#171B25) & Light CSS variable tokens
├── server.ts                # Express server mounting Vite dev middleware & /api/* routes
├── .env.local.example       # Environment variable reference
└── package.json
```

## Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS v4** with custom `.dark` light/dark theme tokens (`#0B0D12` canvas, `#11141C` sidebar, `#171B25` surface, `#8B7CFF` primary accent, `#36CFC9` secondary accent)
- **Zustand** for application, chat, and per-page book editor state
- **TanStack Query** for API caching, mutations, and loading/error lifecycles
- **Lucide React** icons & **react-markdown** + **remark-gfm**
- **Express** + **@google/genai** server-side proxy for SSE streaming chat, Google Search grounded market research, AI cover artwork generation, and backend-confirmed export packaging

## Installation & Development Commands

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.local.example .env.local

# 3. Start full-stack development server on http://localhost:3000
npm run dev

# 4. Run TypeScript type checking
npm run lint

# 5. Build for production
npm run build
```
