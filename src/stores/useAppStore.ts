import { create } from 'zustand';
import type {
  ActivityEvent,
  AppRoute,
  BookCategory,
  BookProject,
  ExportJob,
  NicheOpportunity,
  NotificationItem,
  ThemeMode,
  TrimSizeId,
  UserProfile,
} from '../types';
import { generateId } from '../utils/format';

export const COVER_ASSETS = {
  botanicals: '/src/assets/images/book_cover_mindful_botanicals_1795165697281.jpg',
  forest: '/src/assets/images/book_cover_forest_friends_1795165518608.jpg',
  puzzles: '/src/assets/images/book_cover_logic_puzzles_1795165505937.jpg',
  journal: '/src/assets/images/book_cover_gratitude_journal_1795165505705.jpg',
  avatar: '/src/assets/images/avatar_publisher_1795165507175.jpg',
};

const INITIAL_PROJECTS: BookProject[] = [
  {
    id: 'proj_botanicals',
    title: 'Mindful Botanicals: Wildflower Line Art',
    subtitle: '50 Single-Sided Botanical Coloring Plates for Stress Relief',
    category: 'Coloring Books',
    status: 'Drafting',
    progress: 74,
    thumbnail: COVER_ASSETS.botanicals,
    trimSize: '8.5x11',
    pageCount: 104,
    updatedAt: '2026-11-19T16:40:00Z',
    marketplace: 'amazon.com',
    author: 'Clara Vance',
  },
  {
    id: 'proj_forest',
    title: 'Lanterns in the Pine Clearing',
    subtitle: 'A Bedtime Woodland Story for Curious Young Readers',
    category: "Children's Books",
    status: 'Cover Ready',
    progress: 92,
    thumbnail: COVER_ASSETS.forest,
    trimSize: '8.5x8.5',
    pageCount: 36,
    updatedAt: '2026-11-18T11:15:00Z',
    marketplace: 'amazon.com',
    author: 'Clara Vance',
  },
  {
    id: 'proj_puzzles',
    title: 'Architectural Logic & Labyrinth Puzzles',
    subtitle: '120 Progressive Spatial Reasoning Challenges for Adults',
    category: 'Puzzle Books',
    status: 'Completed',
    progress: 100,
    thumbnail: COVER_ASSETS.puzzles,
    trimSize: '6x9',
    pageCount: 148,
    updatedAt: '2026-11-15T09:30:00Z',
    marketplace: 'amazon.co.uk',
    author: 'Clara Vance',
  },
  {
    id: 'proj_journal',
    title: 'Quiet Mornings: 90-Day Reflection Journal',
    subtitle: 'Guided Prompts for Focus, Clarity, and Weekly Review',
    category: 'Journals',
    status: 'In Review',
    progress: 86,
    thumbnail: COVER_ASSETS.journal,
    trimSize: '6x9',
    pageCount: 196,
    updatedAt: '2026-11-12T14:05:00Z',
    marketplace: 'amazon.com',
    author: 'Clara Vance',
  },
];

const INITIAL_ACTIVITIES: ActivityEvent[] = [
  {
    id: 'act_1',
    title: 'Manuscript auto-saved in Book Editor',
    description: 'Updated interior typography and page 4 margins on Mindful Botanicals.',
    timestamp: '2026-11-20T00:35:00Z',
    category: 'editor',
    projectId: 'proj_botanicals',
  },
  {
    id: 'act_2',
    title: 'Approval pending for niche proposal',
    description: 'AI prepared a book angle for Large-Print Cryptogram Puzzles for Seniors.',
    timestamp: '2026-11-19T21:10:00Z',
    category: 'approval',
  },
  {
    id: 'act_3',
    title: 'Cover wrap dimensions validated',
    description: '8.5" × 8.5" bleed and spine calculation verified for Lanterns in the Pine Clearing.',
    timestamp: '2026-11-19T18:22:00Z',
    category: 'cover',
    projectId: 'proj_forest',
  },
  {
    id: 'act_4',
    title: 'Print-ready export completed',
    description: 'Generated 300 DPI interior layout package for Architectural Logic & Labyrinth Puzzles.',
    timestamp: '2026-11-18T15:05:00Z',
    category: 'export',
    projectId: 'proj_puzzles',
  },
];

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif_1',
    title: 'Approval required on book proposal',
    description: 'Review 5 niche opportunities before starting manuscript generation.',
    timestamp: '25m ago',
    read: false,
    route: '/chat',
  },
  {
    id: 'notif_2',
    title: 'Cover spine width recalculated',
    description: 'Quiet Mornings (196 pages, cream paper) updated to 0.490" spine.',
    timestamp: '2h ago',
    read: false,
    route: '/cover-studio',
  },
  {
    id: 'notif_3',
    title: 'KDP preflight check passed',
    description: 'Architectural Logic & Labyrinth Puzzles passed bleed and margin checks.',
    timestamp: '1d ago',
    read: true,
    route: '/exports',
  },
];

const INITIAL_EXPORTS: ExportJob[] = [];

interface AppState {
  route: AppRoute;
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  isAuthenticated: boolean;
  user: UserProfile;
  projects: BookProject[];
  activeProjectId: string;
  activities: ActivityEvent[];
  notifications: NotificationItem[];
  exports: ExportJob[];
  activeResearchTasks: number;
  pendingApprovals: number;
  createModalOpen: boolean;
  researchResults: NicheOpportunity[];
  selectedNiche: NicheOpportunity | null;
  pendingResearchQuery: string | null;
  dashboardLoading: boolean;

  setRoute: (route: AppRoute) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setMobileNavOpen: (open: boolean) => void;
  setCreateModalOpen: (open: boolean) => void;
  setActiveProjectId: (id: string) => void;
  openProjectInEditor: (id: string) => void;
  createProject: (input: {
    title: string;
    subtitle: string;
    category: BookCategory;
    trimSize: TrimSizeId;
    pageCount: number;
  }) => BookProject;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addActivity: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
  addExportJob: (job: ExportJob) => void;
  updateExportJob: (id: string, patch: Partial<ExportJob>) => void;
  setResearchResults: (niches: NicheOpportunity[]) => void;
  setSelectedNiche: (niche: NicheOpportunity | null) => void;
  setPendingResearchQuery: (q: string | null) => void;
  adjustPendingApprovals: (delta: number) => void;
  setDashboardLoading: (loading: boolean) => void;
  signIn: (email: string, name?: string) => void;
  signOut: () => void;
  updateUserProfile: (patch: Partial<UserProfile>) => void;
}

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem('kdp_studio_theme');
  return stored === 'light' ? 'light' : 'dark';
};

export const useAppStore = create<AppState>((set, get) => ({
  route: '/dashboard',
  theme: getInitialTheme(),
  sidebarCollapsed: false,
  mobileNavOpen: false,
  isAuthenticated: true,
  user: {
    id: 'usr_clara',
    name: 'Clara Vance',
    email: 'clara@northstarpress.io',
    role: 'Independent Publisher',
    imprint: 'Northstar Press',
    avatar: COVER_ASSETS.avatar,
  },
  projects: INITIAL_PROJECTS,
  activeProjectId: INITIAL_PROJECTS[0].id,
  activities: INITIAL_ACTIVITIES,
  notifications: INITIAL_NOTIFICATIONS,
  exports: INITIAL_EXPORTS,
  activeResearchTasks: 2,
  pendingApprovals: 3,
  createModalOpen: false,
  researchResults: [],
  selectedNiche: null,
  pendingResearchQuery: null,
  dashboardLoading: false,

  setRoute: (route) => set({ route, mobileNavOpen: false }),
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('kdp_studio_theme', theme);
    }
    set({ theme });
  },
  toggleTheme: () => {
    const next: ThemeMode = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  setCreateModalOpen: (open) => set({ createModalOpen: open }),
  setActiveProjectId: (id) => set({ activeProjectId: id }),

  openProjectInEditor: (id) => {
    set({ activeProjectId: id, route: '/editor', mobileNavOpen: false });
  },

  createProject: ({ title, subtitle, category, trimSize, pageCount }) => {
    const thumbMap: Record<BookCategory, string> = {
      'Coloring Books': COVER_ASSETS.botanicals,
      "Children's Books": COVER_ASSETS.forest,
      'Puzzle Books': COVER_ASSETS.puzzles,
      Journals: COVER_ASSETS.journal,
      'Activity Books': COVER_ASSETS.puzzles,
      'Non-Fiction Guides': COVER_ASSETS.journal,
      Workbooks: COVER_ASSETS.botanicals,
    };
    const newProject: BookProject = {
      id: generateId('proj'),
      title: title.trim() || 'Untitled KDP Book',
      subtitle: subtitle.trim(),
      category,
      status: 'Drafting',
      progress: 12,
      thumbnail: thumbMap[category] ?? COVER_ASSETS.journal,
      trimSize,
      pageCount,
      updatedAt: new Date().toISOString(),
      marketplace: 'amazon.com',
      author: get().user.name,
    };
    set((state) => ({
      projects: [newProject, ...state.projects],
      activeProjectId: newProject.id,
      activities: [
        {
          id: generateId('act'),
          title: `Created project "${newProject.title}"`,
          description: `${category} · ${trimSize} trim · ${pageCount} pages initialized.`,
          timestamp: new Date().toISOString(),
          category: 'editor',
          projectId: newProject.id,
        },
        ...state.activities,
      ],
    }));
    return newProject;
  },

  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),

  markAllNotificationsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),

  addActivity: (event) =>
    set((state) => ({
      activities: [
        {
          ...event,
          id: generateId('act'),
          timestamp: new Date().toISOString(),
        },
        ...state.activities,
      ],
    })),

  addExportJob: (job) =>
    set((state) => ({
      exports: [job, ...state.exports],
    })),

  updateExportJob: (id, patch) =>
    set((state) => ({
      exports: state.exports.map((job) => (job.id === id ? { ...job, ...patch } : job)),
    })),

  setResearchResults: (niches) =>
    set({ researchResults: Array.isArray(niches) ? niches : [] }),
  setSelectedNiche: (niche) => set({ selectedNiche: niche }),
  setPendingResearchQuery: (q) => set({ pendingResearchQuery: q }),
  adjustPendingApprovals: (delta) =>
    set((state) => ({ pendingApprovals: Math.max(0, state.pendingApprovals + delta) })),
  setDashboardLoading: (loading) => set({ dashboardLoading: loading }),

  signIn: (email, name) =>
    set((state) => ({
      isAuthenticated: true,
      route: '/dashboard',
      user: {
        ...state.user,
        email,
        name: name?.trim() || state.user.name,
      },
    })),

  signOut: () => set({ isAuthenticated: false, route: '/login', mobileNavOpen: false }),

  updateUserProfile: (patch) =>
    set((state) => ({
      user: { ...state.user, ...patch },
    })),
}));
