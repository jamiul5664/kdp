import { create } from 'zustand';
import type { BookPage, TrimSizeId } from '../types';
import {
  DEFAULT_KDP_TEMPLATES,
  type KdpBookTemplate,
  type KeywordResearchRecord,
  type PerformanceSaleRow,
  type ReviewIntelligenceOutput,
} from '../utils/kdpAdvancedEngines';
import { generateId } from '../utils/format';

// ---------------------------------------------------------------------------
// 1. Global Book Style Profile & Consistency Memory
// ---------------------------------------------------------------------------
export interface CharacterMemoryEntry {
  id: string;
  name: string;
  visualTraits: string;
  wardrobe: string;
  personality: string;
}

export interface BookStyleProfile {
  projectId: string;
  artStyle: string;
  lineWeight: string;
  colorPalette: string[];
  characterDescriptions: CharacterMemoryEntry[];
  backgroundStyleMemory: string;
  illustrationRules: string;
  typographyRules: string;
  pageLayoutRules: string;
  writingTone: string;
  targetAudience: string;
  approvedAt: string;
  version: number;
  approvedPageIds: string[]; // Approved pages are never modified automatically
}

// ---------------------------------------------------------------------------
// 2. Batch Book Page Generation Engine
// ---------------------------------------------------------------------------
export type BatchPageStatus = 'Queued' | 'Generating' | 'Completed' | 'Failed' | 'Paused';
export type BatchApprovalStatus = 'Pending Review' | 'Approved' | 'Changes Requested';

export interface BatchGeneratedPage {
  id: string;
  pageNumber: number;
  pageType: 'Title' | 'Story / Content' | 'Activity / Plate' | 'Reflection' | 'Back Matter';
  title: string;
  content: string;
  illustrationPrompt: string;
  imageAssetUrl: string | null;
  generationStatus: BatchPageStatus;
  approvalStatus: BatchApprovalStatus;
  versionNumber: number;
  contentHash: string;
  errorMessage?: string;
  updatedAt: string;
}

export interface BatchGenerationJobState {
  jobId: string;
  projectId: string;
  status: 'Idle' | 'Running' | 'Paused' | 'Completed' | 'Awaiting Approval';
  concurrencyLimit: number;
  rateLimitPerMinute: number;
  pages: BatchGeneratedPage[];
  startedAt: string | null;
  completedAt: string | null;
}

// ---------------------------------------------------------------------------
// 3. Asset Provenance Database
// ---------------------------------------------------------------------------
export interface AssetProvenanceRecord {
  assetId: string;
  projectId: string;
  assetName: string;
  assetType: 'Illustration' | 'Font' | 'Cover Artwork' | 'Text Reference' | 'Template Element';
  creationMethod: 'AI Generated' | 'Original Author Work' | 'Licensed Stock' | 'Open Font License';
  provider: string;
  originalPrompt: string;
  sourceReference: string;
  licenseInformation: string;
  creationDate: string;
}

// ---------------------------------------------------------------------------
// 4. Persistent AI Project Memory (10 Memory Types, User + Project Isolated)
// ---------------------------------------------------------------------------
export type ProjectMemoryType =
  | 'User preferences'
  | 'Book style profile'
  | 'Approved book outline'
  | 'Approved page content'
  | 'Illustration instructions'
  | 'Research findings'
  | 'Previous revisions'
  | 'Rejected suggestions'
  | 'Project decisions'
  | 'Export settings';

export interface ProjectMemoryRecord {
  id: string;
  userId: string;
  projectId: string;
  memoryType: ProjectMemoryType;
  title: string;
  content: string;
  tags: string[];
  approved: boolean;
  approvalLocked: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  auditTrail: Array<{ timestamp: string; action: string; actor: string; note: string }>;
}

// ---------------------------------------------------------------------------
// 5. Durable AI Workflow Automation Engine
// ---------------------------------------------------------------------------
export type WorkflowStatus =
  | 'Pending'
  | 'Running'
  | 'Paused'
  | 'Waiting Approval'
  | 'Completed'
  | 'Failed'
  | 'Cancelled';

export type WorkflowStepStatus =
  | 'Pending'
  | 'Running'
  | 'Waiting Approval'
  | 'Completed'
  | 'Failed'
  | 'Skipped'
  | 'Cancelled';

export interface WorkflowStepRecord {
  taskId: string;
  idempotencyKey: string;
  agentName: string;
  label: string;
  dependsOn: string[];
  inputSummary: string;
  outputSummary: string | null;
  status: WorkflowStepStatus;
  startTime: string | null;
  completionTime: string | null;
  errorDetails: string | null;
  approvalRequired: boolean;
  approvalGranted: boolean;
  attempts: number;
}

export interface BookWorkflowRun {
  id: string;
  projectId: string;
  bookTitle: string;
  source: 'Chat' | 'Workflow Studio' | 'Scheduled';
  idempotencyKey: string;
  status: WorkflowStatus;
  checkpointStepIndex: number;
  createdAt: string;
  updatedAt: string;
  steps: WorkflowStepRecord[];
  interruptedRecoverable?: boolean;
}

// ---------------------------------------------------------------------------
// 6. Notification & Scheduled Research System
// ---------------------------------------------------------------------------
export interface ScheduledResearchRule {
  id: string;
  name: string;
  query: string;
  category: string;
  marketplace: string;
  cadence: 'Daily' | 'Weekly' | 'Bi-Weekly' | 'Monthly';
  dayOfWeek: string;
  runTimeLocal: string;
  enabled: boolean;
  userConsentGranted: boolean;
  lastRunAt: string | null;
  nextRunLabel: string;
}

export interface NotificationPreferences {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  emailAddress: string;
  timezone: string;
  triggers: {
    scheduledNicheResearch: boolean;
    weeklyOpportunityReports: boolean;
    seasonalAlerts: boolean;
    researchCompletion: boolean;
    approvalReminders: boolean;
    failedTasks: boolean;
    exportCompletion: boolean;
  };
}

export interface NotificationHistoryEntry {
  id: string;
  channel: 'In-App' | 'Email' | 'In-App + Email';
  category:
    | 'Scheduled Research'
    | 'Weekly Report'
    | 'Seasonal Alert'
    | 'Research Complete'
    | 'Approval Reminder'
    | 'Task Failure'
    | 'Export Complete';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

// ---------------------------------------------------------------------------
// 7. Market Intelligence History & Competitor Gap Snapshot
// ---------------------------------------------------------------------------
export interface CompetitorGapRecord {
  id: string;
  niche: string;
  marketplace: string;
  generatedAt: string;
  dataFreshness: string;
  confidenceScore: number;
  opportunityScore: number;
  competitorOverview: string;
  competitors: Array<{
    title: string;
    subtitle: string;
    format: string;
    observedPrice: string;
    reviewCount: string;
    rating: string;
    keyFeatures: string[];
    gaps: string[];
    evidenceUrl: string;
  }>;
  commonFeatures: string[];
  missingFeatures: string[];
  customerComplaints: string[];
  underservedTopics: string[];
  recommendedBookConcept: {
    title: string;
    subtitle: string;
    targetAudience: string;
    differentiationStrategy: string;
    suggestedFormat: string;
  };
  evidenceSources: Array<{ title: string; url: string; domain: string }>;
}

export interface ResearchHistoryItem {
  id: string;
  type: 'Niche Research' | 'Competitor Gap' | 'Keyword Intelligence' | 'Review Intelligence' | 'Seasonal Check';
  query: string;
  marketplace: string;
  timestamp: string;
  confidenceScore: number;
  sourceCount: number;
  summary: string;
}

function simpleHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

const DEFAULT_STYLE_PROFILES: Record<string, BookStyleProfile> = {
  proj_botanicals: {
    projectId: 'proj_botanicals',
    artStyle: 'Fine botanical ink line-art on crisp white background, single-sided composition',
    lineWeight: '2.2pt uniform exterior contour with 1.0pt leaf vein detailing',
    colorPalette: ['#111827', '#374151', '#FAF9F5', '#0D9488'],
    characterDescriptions: [
      {
        id: 'char_bot_1',
        name: 'Meadow Botanical Motif',
        visualTraits: 'Symmetrical wildflower bouquets with open white spaces suitable for alcohol markers',
        wardrobe: 'N/A — Floral & Woodland Specimen Series',
        personality: 'Serene, organic, stress-relieving rhythm',
      },
    ],
    backgroundStyleMemory: 'Pure white unshaded canvas with delicate 0.35" botanical corner frames',
    illustrationRules: 'Zero gray halftone shading; pure black ink (#000000) lines; minimum 300 DPI vector-crisp edges.',
    typographyRules: 'Playfair Display headings (20–30pt), DM Sans body (12–13pt), Lora italic captions (11pt).',
    pageLayoutRules: 'Single-sided art plates on odd recto pages; protective blank or soft-frame verso pages.',
    writingTone: 'Calm, mindful, editorial, concise encouragement without clichés',
    targetAudience: 'Adults seeking relaxing botanical coloring & stress relief',
    approvedAt: '2026-11-18T14:20:00Z',
    version: 2,
    approvedPageIds: [],
  },
  proj_forest: {
    projectId: 'proj_forest',
    artStyle: 'Warm gouache & watercolor woodland picture-book illustration with soft lantern glow',
    lineWeight: 'Soft colored-pencil outlines (1.5pt warm umber)',
    colorPalette: ['#1E3A2F', '#D97706', '#FEF3C7', '#4B5563'],
    characterDescriptions: [
      {
        id: 'char_pippa',
        name: 'Pippa the Fox Cub',
        visualTraits: 'Russet fur, cream ear tips, bright amber eyes, carrying a small brass lantern',
        wardrobe: 'Knitted moss-green scarf with two tiny wooden buttons',
        personality: 'Curious, gentle, reassuring bedtime narrator',
      },
    ],
    backgroundStyleMemory: 'Twilight pine clearings with starry indigo skies and dappled golden lantern light',
    illustrationRules: 'Keep bottom 25% of spreads calm and uncluttered for high-contrast read-aloud typography.',
    typographyRules: 'Playfair Display titles, Lora 16pt body text, 1.55 line-height for effortless parent read-aloud.',
    pageLayoutRules: '8.5" × 8.5" full-bleed spreads with 0.5" text safe margin inside trim.',
    writingTone: 'Lyrical, soothing, rhythmic bedtime storytelling for ages 4–8',
    targetAudience: 'Children ages 4–8 and parents reading at bedtime',
    approvedAt: '2026-11-17T09:15:00Z',
    version: 1,
    approvedPageIds: [],
  },
};

const INITIAL_PROVENANCE: AssetProvenanceRecord[] = [
  {
    assetId: 'ast_font_playfair',
    projectId: 'proj_botanicals',
    assetName: 'Playfair Display Typography Family',
    assetType: 'Font',
    creationMethod: 'Open Font License',
    provider: 'Google Fonts (Claus Eggers Sørensen)',
    originalPrompt: 'N/A — SIL Open Font License 1.1',
    sourceReference: 'https://fonts.google.com/specimen/Playfair+Display',
    licenseInformation: 'SIL Open Font License 1.1 — Commercial print & PDF embedding permitted.',
    creationDate: '2026-11-10',
  },
  {
    assetId: 'ast_font_dmsans',
    projectId: 'proj_botanicals',
    assetName: 'DM Sans Body Font',
    assetType: 'Font',
    creationMethod: 'Open Font License',
    provider: 'Google Fonts (Colophon Foundry)',
    originalPrompt: 'N/A — SIL Open Font License 1.1',
    sourceReference: 'https://fonts.google.com/specimen/DM+Sans',
    licenseInformation: 'SIL Open Font License 1.1 — Commercial print & KDP embedding permitted.',
    creationDate: '2026-11-10',
  },
  {
    assetId: 'ast_art_botanical_cover',
    projectId: 'proj_botanicals',
    assetName: 'Mindful Botanicals Cover Plate',
    assetType: 'Cover Artwork',
    creationMethod: 'AI Generated',
    provider: 'KDP Studio AI Image Pipeline',
    originalPrompt: 'Minimalist fine-line botanical wildflower editorial book cover composition, high contrast, print-ready',
    sourceReference: 'Internal Asset Registry / proj_botanicals',
    licenseInformation: 'Commercial publishing usage subject to KDP AI-generated content disclosure policy.',
    creationDate: '2026-11-16',
  },
];

const INITIAL_MEMORIES: ProjectMemoryRecord[] = [
  {
    id: 'mem_1',
    userId: 'usr_clara',
    projectId: 'proj_botanicals',
    memoryType: 'Book style profile',
    title: 'Single-sided botanical line art specification',
    content: 'Maintain 2.2pt bold exterior lines with zero gray halftone fills so alcohol markers remain clean on KDP white paper.',
    tags: ['style', 'line-art', 'coloring'],
    approved: true,
    approvalLocked: true,
    version: 2,
    createdAt: '2026-11-15T10:00:00Z',
    updatedAt: '2026-11-18T14:20:00Z',
    auditTrail: [
      { timestamp: '2026-11-15T10:00:00Z', action: 'Created', actor: 'Clara Vance', note: 'Initial style baseline' },
      { timestamp: '2026-11-18T14:20:00Z', action: 'Approved & Locked', actor: 'Clara Vance', note: 'Confirmed line weight at 2.2pt' },
    ],
  },
  {
    id: 'mem_2',
    userId: 'usr_clara',
    projectId: 'proj_botanicals',
    memoryType: 'Rejected suggestions',
    title: 'Rejected double-sided dense mandalas',
    content: 'User rejected double-sided printing and ultra-thin mandala details due to customer bleed-through complaints.',
    tags: ['rejected', 'bleed-through', 'review-insight'],
    approved: true,
    approvalLocked: true,
    version: 1,
    createdAt: '2026-11-16T11:30:00Z',
    updatedAt: '2026-11-16T11:30:00Z',
    auditTrail: [
      { timestamp: '2026-11-16T11:30:00Z', action: 'Recorded Rejection', actor: 'Clara Vance', note: 'Prevent agents from proposing double-sided art' },
    ],
  },
  {
    id: 'mem_3',
    userId: 'usr_clara',
    projectId: 'proj_botanicals',
    memoryType: 'Export settings',
    title: 'KDP 8.5x11 Full Bleed Print Config',
    content: '8.5" × 11" trim, bleed enabled (+0.125" outer, +0.25" vertical), 104 pages, white paper, B&W interior, 0.625" inside gutter.',
    tags: ['export', 'kdp', '8.5x11'],
    approved: true,
    approvalLocked: false,
    version: 1,
    createdAt: '2026-11-17T08:45:00Z',
    updatedAt: '2026-11-17T08:45:00Z',
    auditTrail: [
      { timestamp: '2026-11-17T08:45:00Z', action: 'Saved Export Spec', actor: 'Clara Vance', note: 'Synced with KDP trim calculator' },
    ],
  },
  {
    id: 'mem_4',
    userId: 'usr_clara',
    projectId: 'proj_forest',
    memoryType: 'Illustration instructions',
    title: 'Pippa the Fox Cub continuity rules',
    content: 'Pippa always wears the moss-green knitted scarf with two wooden buttons and carries the warm brass lantern in twilight scenes.',
    tags: ['character', 'continuity', 'pippa'],
    approved: true,
    approvalLocked: true,
    version: 1,
    createdAt: '2026-11-17T09:15:00Z',
    updatedAt: '2026-11-17T09:15:00Z',
    auditTrail: [
      { timestamp: '2026-11-17T09:15:00Z', action: 'Approved Character Spec', actor: 'Clara Vance', note: 'Locked for all 36 pages' },
    ],
  },
];

const INITIAL_WORKFLOWS: BookWorkflowRun[] = [
  {
    id: 'wf_run_botanicals_01',
    projectId: 'proj_botanicals',
    bookTitle: 'Mindful Botanicals: Wildflower Line Art',
    source: 'Chat',
    idempotencyKey: 'idem_botanicals_v1',
    status: 'Waiting Approval',
    checkpointStepIndex: 2,
    createdAt: '2026-11-19T14:00:00Z',
    updatedAt: '2026-11-19T14:18:00Z',
    steps: [
      {
        taskId: 'tsk_01_research',
        idempotencyKey: 'idem_botanicals_v1:research',
        agentName: 'Market Research Agent',
        label: 'Grounded Niche & Competitor Gap Analysis',
        dependsOn: [],
        inputSummary: 'Topic: Mindful Botanicals · amazon.com · Coloring Books',
        outputSummary: 'Identified single-sided marker bleed-through gap (Confidence 82%)',
        status: 'Completed',
        startTime: '2026-11-19T14:00:05Z',
        completionTime: '2026-11-19T14:02:14Z',
        errorDetails: null,
        approvalRequired: false,
        approvalGranted: true,
        attempts: 1,
      },
      {
        taskId: 'tsk_02_architect',
        idempotencyKey: 'idem_botanicals_v1:outline',
        agentName: 'Book Architect Agent',
        label: 'Generate 50-Plate Botanical Outline & Style Profile',
        dependsOn: ['tsk_01_research'],
        inputSummary: '8.5x11 trim · 104 pages · single-sided spec',
        outputSummary: 'Created 50 distinct seasonal botanical plate themes + color test sheet',
        status: 'Completed',
        startTime: '2026-11-19T14:02:20Z',
        completionTime: '2026-11-19T14:05:40Z',
        errorDetails: null,
        approvalRequired: false,
        approvalGranted: true,
        attempts: 1,
      },
      {
        taskId: 'tsk_03_outline_gate',
        idempotencyKey: 'idem_botanicals_v1:approval_outline',
        agentName: 'Human Approval Checkpoint',
        label: 'User Approval: Outline & Book Style Profile',
        dependsOn: ['tsk_02_architect'],
        inputSummary: 'Review 50 plate themes & 2.2pt line-weight profile before batch generation',
        outputSummary: null,
        status: 'Waiting Approval',
        startTime: '2026-11-19T14:05:41Z',
        completionTime: null,
        errorDetails: null,
        approvalRequired: true,
        approvalGranted: false,
        attempts: 1,
      },
      {
        taskId: 'tsk_04_batch_pages',
        idempotencyKey: 'idem_botanicals_v1:batch_gen',
        agentName: 'Batch Page & Illustration Agent',
        label: 'Generate Pages & 300 DPI Illustration Prompts',
        dependsOn: ['tsk_03_outline_gate'],
        inputSummary: 'Approved Book Style Profile + Rate limit 10 req/min',
        outputSummary: null,
        status: 'Pending',
        startTime: null,
        completionTime: null,
        errorDetails: null,
        approvalRequired: false,
        approvalGranted: false,
        attempts: 0,
      },
      {
        taskId: 'tsk_05_compliance_export',
        idempotencyKey: 'idem_botanicals_v1:export',
        agentName: 'KDP Compliance & Export Agent',
        label: '15-Point KDP Preflight & Final Export Package',
        dependsOn: ['tsk_04_batch_pages'],
        inputSummary: 'Interior PDF + Full Cover Wrap + Metadata JSON',
        outputSummary: null,
        status: 'Pending',
        startTime: null,
        completionTime: null,
        errorDetails: null,
        approvalRequired: true,
        approvalGranted: false,
        attempts: 0,
      },
    ],
  },
];

const INITIAL_SCHEDULES: ScheduledResearchRule[] = [
  {
    id: 'sch_weekly_coloring',
    name: 'Weekly Adult Coloring Niche Watch',
    query: 'botanical and cozy stress relief coloring books',
    category: 'Coloring Books',
    marketplace: 'amazon.com',
    cadence: 'Weekly',
    dayOfWeek: 'Monday',
    runTimeLocal: '08:00',
    enabled: false, // Opt-in by default — never runs without user schedule + permission
    userConsentGranted: false,
    lastRunAt: null,
    nextRunLabel: 'Disabled (Enable & Grant Permission)',
  },
  {
    id: 'sch_seasonal_alerts',
    name: 'Seasonal Lead-Time Publishing Alerts',
    query: 'upcoming Q1-Q4 seasonal KDP niches',
    category: 'Activity Books',
    marketplace: 'amazon.com',
    cadence: 'Bi-Weekly',
    dayOfWeek: 'Thursday',
    runTimeLocal: '09:30',
    enabled: false,
    userConsentGranted: false,
    lastRunAt: null,
    nextRunLabel: 'Disabled (Enable & Grant Permission)',
  },
];

const INITIAL_NOTIF_HISTORY: NotificationHistoryEntry[] = [
  {
    id: 'nh_1',
    channel: 'In-App',
    category: 'Approval Reminder',
    title: 'Workflow checkpoint waiting for approval',
    message: 'Mindful Botanicals: Wildflower Line Art is paused at Outline & Style Profile approval.',
    timestamp: '2026-11-19T14:18:00Z',
    read: false,
  },
  {
    id: 'nh_2',
    channel: 'In-App',
    category: 'Seasonal Alert',
    title: 'New Year & Valentine lead-time window open',
    message: 'New Year (75-day prep) and Ramadan/Valentine research deadlines are approaching.',
    timestamp: '2026-11-19T09:00:00Z',
    read: false,
  },
  {
    id: 'nh_3',
    channel: 'In-App + Email',
    category: 'Export Complete',
    title: 'Architectural Logic & Labyrinth Puzzles export ready',
    message: '300 DPI Interior PDF and cover wrap verified against KDP trim specifications.',
    timestamp: '2026-11-18T15:06:00Z',
    read: true,
  },
];

interface AdvancedStudioState {
  // Style Profiles
  styleProfiles: Record<string, BookStyleProfile>;
  updateStyleProfile: (projectId: string, patch: Partial<BookStyleProfile>, approveChange?: boolean) => void;
  toggleApprovedPageLock: (projectId: string, pageId: string) => void;

  // Batch Generation
  batchJobs: Record<string, BatchGenerationJobState>;
  createBatchFromOutline: (projectId: string, outlineItems: Array<{ title: string; pageType: BatchGeneratedPage['pageType']; prompt: string }>) => void;
  setBatchJobStatus: (projectId: string, status: BatchGenerationJobState['status']) => void;
  updateBatchPage: (projectId: string, pageId: string, patch: Partial<BatchGeneratedPage>) => void;
  regenerateBatchPage: (projectId: string, pageId: string) => void;
  retryFailedBatchPages: (projectId: string) => void;

  // Templates
  templates: KdpBookTemplate[];
  saveCustomTemplate: (tpl: Omit<KdpBookTemplate, 'templateId' | 'isCustom'>) => KdpBookTemplate;
  duplicateTemplate: (templateId: string) => KdpBookTemplate | null;

  // Asset Provenance
  provenanceRecords: AssetProvenanceRecord[];
  addProvenanceRecord: (rec: Omit<AssetProvenanceRecord, 'assetId'>) => void;

  // Performance Learning (User CSV only — isolated by userId)
  performanceRows: PerformanceSaleRow[];
  importPerformanceRows: (rows: PerformanceSaleRow[]) => void;
  clearPerformanceRows: () => void;

  // Persistent Project Memory (10 types, isolated by userId & projectId)
  projectMemories: ProjectMemoryRecord[];
  addProjectMemory: (input: {
    userId: string;
    projectId: string;
    memoryType: ProjectMemoryType;
    title: string;
    content: string;
    tags: string[];
    approved: boolean;
    actor: string;
  }) => void;
  updateProjectMemory: (
    id: string,
    patch: { title?: string; content?: string; approved?: boolean; approvalLocked?: boolean },
    actor: string,
    explicitOverrideApproved?: boolean
  ) => { ok: boolean; error?: string };

  // Workflows (Durable Orchestration)
  workflows: BookWorkflowRun[];
  createWorkflow: (input: {
    projectId: string;
    bookTitle: string;
    source: BookWorkflowRun['source'];
    idempotencyKey?: string;
  }) => { workflow: BookWorkflowRun; deduplicated: boolean };
  pauseWorkflow: (workflowId: string) => void;
  resumeWorkflow: (workflowId: string) => void;
  cancelWorkflow: (workflowId: string) => void;
  approveWorkflowStep: (workflowId: string, taskId: string) => void;
  retryWorkflowStep: (workflowId: string, taskId: string) => void;
  simulateStepFailure: (workflowId: string, taskId: string, reason: string) => void;
  recoverInterruptedWorkflow: (workflowId: string) => void;

  // Notification & Scheduled Research System
  scheduledRules: ScheduledResearchRule[];
  notificationPrefs: NotificationPreferences;
  notificationHistory: NotificationHistoryEntry[];
  addScheduledRule: (rule: Omit<ScheduledResearchRule, 'id' | 'lastRunAt' | 'nextRunLabel'>) => void;
  toggleScheduledRule: (id: string, enabled: boolean, consentGranted: boolean) => void;
  deleteScheduledRule: (id: string) => void;
  updateNotificationPrefs: (patch: Partial<NotificationPreferences>) => void;
  updateNotificationTrigger: (key: keyof NotificationPreferences['triggers'], value: boolean) => void;
  pushNotificationHistory: (entry: Omit<NotificationHistoryEntry, 'id' | 'timestamp' | 'read'>) => void;
  markHistoryRead: (id: string) => void;

  // Market Intelligence shared state
  competitorGapReports: CompetitorGapRecord[];
  addCompetitorGapReport: (report: CompetitorGapRecord) => void;
  keywordRecords: KeywordResearchRecord[];
  setKeywordRecords: (records: KeywordResearchRecord[]) => void;
  reviewReport: ReviewIntelligenceOutput | null;
  setReviewReport: (report: ReviewIntelligenceOutput | null) => void;
  researchHistory: ResearchHistoryItem[];
  addResearchHistory: (item: Omit<ResearchHistoryItem, 'id' | 'timestamp'>) => void;
}

export const useAdvancedStudioStore = create<AdvancedStudioState>((set, get) => ({
  styleProfiles: DEFAULT_STYLE_PROFILES,

  updateStyleProfile: (projectId, patch, approveChange = false) =>
    set((state) => {
      const existing: BookStyleProfile = state.styleProfiles[projectId] ?? {
        projectId,
        artStyle: 'Clean editorial print-ready vector & line art',
        lineWeight: '2.0pt crisp ink contour',
        colorPalette: ['#111827', '#4B5563', '#FAF9F5', '#8B7CFF'],
        characterDescriptions: [],
        backgroundStyleMemory: 'Clean white margin-safe publishing canvas',
        illustrationRules: '300 DPI minimum, no text inside artwork, bleed-safe edges.',
        typographyRules: 'Playfair Display headings + DM Sans body at >= 12pt.',
        pageLayoutRules: 'Consistent gutter margins and balanced vertical rhythm.',
        writingTone: 'Clear, engaging, original editorial voice',
        targetAudience: 'General KDP Readers',
        approvedAt: new Date().toISOString(),
        version: 1,
        approvedPageIds: [],
      };
      return {
        styleProfiles: {
          ...state.styleProfiles,
          [projectId]: {
            ...existing,
            ...patch,
            version: approveChange ? existing.version + 1 : existing.version,
            approvedAt: approveChange ? new Date().toISOString() : existing.approvedAt,
          },
        },
      };
    }),

  toggleApprovedPageLock: (projectId, pageId) =>
    set((state) => {
      const profile = state.styleProfiles[projectId];
      if (!profile) return state;
      const exists = profile.approvedPageIds.includes(pageId);
      const nextIds = exists
        ? profile.approvedPageIds.filter((id) => id !== pageId)
        : [...profile.approvedPageIds, pageId];
      return {
        styleProfiles: {
          ...state.styleProfiles,
          [projectId]: { ...profile, approvedPageIds: nextIds },
        },
      };
    }),

  batchJobs: {},

  createBatchFromOutline: (projectId, outlineItems) => {
    const profile = get().styleProfiles[projectId];
    const seenHashes = new Set<string>();
    const pages: BatchGeneratedPage[] = [];

    outlineItems.forEach((item, idx) => {
      const content = `${item.title}\n\nWritten in alignment with Book Style Profile (${profile?.writingTone || 'clear editorial voice'}) for ${profile?.targetAudience || 'readers'}. Designed to avoid repetition and maintain consistent page hierarchy.`;
      const hash = simpleHash(`${item.title.toLowerCase()}::${item.prompt.toLowerCase()}`);
      if (seenHashes.has(hash)) return; // Prevent accidental duplicate pages
      seenHashes.add(hash);
      pages.push({
        id: generateId('bpg'),
        pageNumber: pages.length + 1,
        pageType: item.pageType,
        title: item.title,
        content,
        illustrationPrompt: `${item.prompt} | Art style: ${profile?.artStyle || 'clean print art'} | Line weight: ${profile?.lineWeight || '2pt'}`,
        imageAssetUrl: null,
        generationStatus: 'Completed',
        approvalStatus: 'Pending Review',
        versionNumber: 1,
        contentHash: hash,
        updatedAt: new Date().toISOString(),
      });
    });

    set((state) => ({
      batchJobs: {
        ...state.batchJobs,
        [projectId]: {
          jobId: generateId('batch'),
          projectId,
          status: 'Awaiting Approval',
          concurrencyLimit: 2,
          rateLimitPerMinute: 10,
          pages,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      },
    }));
  },

  setBatchJobStatus: (projectId, status) =>
    set((state) => {
      const job = state.batchJobs[projectId];
      if (!job) return state;
      return {
        batchJobs: {
          ...state.batchJobs,
          [projectId]: { ...job, status },
        },
      };
    }),

  updateBatchPage: (projectId, pageId, patch) =>
    set((state) => {
      const job = state.batchJobs[projectId];
      if (!job) return state;
      return {
        batchJobs: {
          ...state.batchJobs,
          [projectId]: {
            ...job,
            pages: job.pages.map((p) =>
              p.id === pageId ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
            ),
          },
        },
      };
    }),

  regenerateBatchPage: (projectId, pageId) =>
    set((state) => {
      const job = state.batchJobs[projectId];
      if (!job) return state;
      return {
        batchJobs: {
          ...state.batchJobs,
          [projectId]: {
            ...job,
            pages: job.pages.map((p) => {
              if (p.id !== pageId) return p;
              const nextVer = p.versionNumber + 1;
              return {
                ...p,
                versionNumber: nextVer,
                generationStatus: 'Completed',
                approvalStatus: 'Pending Review',
                errorMessage: undefined,
                content: `${p.content.split('\n\n[Revision')[0]}\n\n[Revision v${nextVer} — Regenerated with locked Book Style Profile consistency rules]`,
                updatedAt: new Date().toISOString(),
              };
            }),
          },
        },
      };
    }),

  retryFailedBatchPages: (projectId) =>
    set((state) => {
      const job = state.batchJobs[projectId];
      if (!job) return state;
      return {
        batchJobs: {
          ...state.batchJobs,
          [projectId]: {
            ...job,
            status: 'Awaiting Approval',
            pages: job.pages.map((p) =>
              p.generationStatus === 'Failed'
                ? {
                    ...p,
                    generationStatus: 'Completed',
                    versionNumber: p.versionNumber + 1,
                    errorMessage: undefined,
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          },
        },
      };
    }),

  templates: DEFAULT_KDP_TEMPLATES,

  saveCustomTemplate: (tpl) => {
    const created: KdpBookTemplate = {
      ...tpl,
      templateId: generateId('tpl_custom'),
      isCustom: true,
    };
    set((state) => ({ templates: [created, ...state.templates] }));
    return created;
  },

  duplicateTemplate: (templateId) => {
    const src = get().templates.find((t) => t.templateId === templateId);
    if (!src) return null;
    const copy: KdpBookTemplate = {
      ...structuredClone(src),
      templateId: generateId('tpl_copy'),
      name: `${src.name} (Copy)`,
      isCustom: true,
    };
    set((state) => ({ templates: [copy, ...state.templates] }));
    return copy;
  },

  provenanceRecords: INITIAL_PROVENANCE,

  addProvenanceRecord: (rec) =>
    set((state) => ({
      provenanceRecords: [{ ...rec, assetId: generateId('ast') }, ...state.provenanceRecords],
    })),

  performanceRows: [],
  importPerformanceRows: (rows) =>
    set((state) => ({
      performanceRows: [...state.performanceRows, ...rows],
    })),
  clearPerformanceRows: () => set({ performanceRows: [] }),

  projectMemories: INITIAL_MEMORIES,

  addProjectMemory: ({ userId, projectId, memoryType, title, content, tags, approved, actor }) =>
    set((state) => {
      const now = new Date().toISOString();
      const entry: ProjectMemoryRecord = {
        id: generateId('mem'),
        userId,
        projectId,
        memoryType,
        title,
        content,
        tags,
        approved,
        approvalLocked: approved,
        version: 1,
        createdAt: now,
        updatedAt: now,
        auditTrail: [{ timestamp: now, action: approved ? 'Created & Approved' : 'Created', actor, note: memoryType }],
      };
      return { projectMemories: [entry, ...state.projectMemories] };
    }),

  updateProjectMemory: (id, patch, actor, explicitOverrideApproved = false) => {
    const existing = get().projectMemories.find((m) => m.id === id);
    if (!existing) return { ok: false, error: 'Memory record not found.' };
    if (existing.approvalLocked && !explicitOverrideApproved) {
      return {
        ok: false,
        error: 'Approved memory decisions cannot be overwritten silently. Confirm explicit revision override.',
      };
    }
    const now = new Date().toISOString();
    set((state) => ({
      projectMemories: state.projectMemories.map((m) =>
        m.id !== id
          ? m
          : {
              ...m,
              ...patch,
              version: m.version + 1,
              updatedAt: now,
              auditTrail: [
                ...m.auditTrail,
                {
                  timestamp: now,
                  action: explicitOverrideApproved ? 'Explicit Approved Revision' : 'Updated',
                  actor,
                  note: patch.title || 'Memory content revised',
                },
              ],
            }
      ),
    }));
    return { ok: true };
  },

  workflows: INITIAL_WORKFLOWS,

  createWorkflow: ({ projectId, bookTitle, source, idempotencyKey }) => {
    const key = idempotencyKey || `idem_${projectId}_${simpleHash(bookTitle.toLowerCase())}`;
    const existing = get().workflows.find((w) => w.idempotencyKey === key && w.status !== 'Cancelled');
    if (existing) {
      return { workflow: existing, deduplicated: true };
    }
    const now = new Date().toISOString();
    const run: BookWorkflowRun = {
      id: generateId('wf_run'),
      projectId,
      bookTitle,
      source,
      idempotencyKey: key,
      status: 'Waiting Approval',
      checkpointStepIndex: 2,
      createdAt: now,
      updatedAt: now,
      steps: [
        {
          taskId: generateId('tsk'),
          idempotencyKey: `${key}:research`,
          agentName: 'Market Research Agent',
          label: 'Market Research & Competitor Gap Discovery',
          dependsOn: [],
          inputSummary: `Topic: ${bookTitle} · Grounded research`,
          outputSummary: 'Collected demand signals, audience expectations, and differentiation gaps.',
          status: 'Completed',
          startTime: now,
          completionTime: now,
          errorDetails: null,
          approvalRequired: false,
          approvalGranted: true,
          attempts: 1,
        },
        {
          taskId: generateId('tsk'),
          idempotencyKey: `${key}:architect`,
          agentName: 'Book Architect Agent',
          label: 'Book Outline & Style Profile Specification',
          dependsOn: ['Market Research Agent'],
          inputSummary: 'Style consistency rules + KDP trim specification',
          outputSummary: 'Generated structured chapter outline and locked Book Style Profile draft.',
          status: 'Completed',
          startTime: now,
          completionTime: now,
          errorDetails: null,
          approvalRequired: false,
          approvalGranted: true,
          attempts: 1,
        },
        {
          taskId: generateId('tsk'),
          idempotencyKey: `${key}:outline_approval`,
          agentName: 'Human Approval Checkpoint',
          label: 'User Approval: Outline & Niche Selection',
          dependsOn: ['Book Architect Agent'],
          inputSummary: 'Mandatory human approval gate — cannot be bypassed.',
          outputSummary: null,
          status: 'Waiting Approval',
          startTime: now,
          completionTime: null,
          errorDetails: null,
          approvalRequired: true,
          approvalGranted: false,
          attempts: 1,
        },
        {
          taskId: generateId('tsk'),
          idempotencyKey: `${key}:content_batch`,
          agentName: 'Content & Illustration Batch Agent',
          label: 'Batch Page Content & Art Prompt Generation',
          dependsOn: ['Human Approval Checkpoint'],
          inputSummary: 'Rate-limited page generation honoring approved Book Style Profile',
          outputSummary: null,
          status: 'Pending',
          startTime: null,
          completionTime: null,
          errorDetails: null,
          approvalRequired: false,
          approvalGranted: false,
          attempts: 0,
        },
        {
          taskId: generateId('tsk'),
          idempotencyKey: `${key}:final_qa`,
          agentName: 'Quality, Compliance & Export Agent',
          label: '15-Point KDP Validation, Final Approval & Export',
          dependsOn: ['Content & Illustration Batch Agent'],
          inputSummary: 'Preflight checks + Interior PDF + Cover Wrap PDF + ZIP',
          outputSummary: null,
          status: 'Pending',
          startTime: null,
          completionTime: null,
          errorDetails: null,
          approvalRequired: true,
          approvalGranted: false,
          attempts: 0,
        },
      ],
    };
    set((state) => ({ workflows: [run, ...state.workflows] }));
    return { workflow: run, deduplicated: false };
  },

  pauseWorkflow: (workflowId) =>
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === workflowId && w.status !== 'Completed' && w.status !== 'Cancelled'
          ? { ...w, status: 'Paused', updatedAt: new Date().toISOString() }
          : w
      ),
    })),

  resumeWorkflow: (workflowId) =>
    set((state) => ({
      workflows: state.workflows.map((w) => {
        if (w.id !== workflowId || w.status !== 'Paused') return w;
        const waitingApproval = w.steps.some((s) => s.status === 'Waiting Approval');
        return {
          ...w,
          status: waitingApproval ? 'Waiting Approval' : 'Running',
          updatedAt: new Date().toISOString(),
        };
      }),
    })),

  cancelWorkflow: (workflowId) =>
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id !== workflowId
          ? w
          : {
              ...w,
              status: 'Cancelled',
              updatedAt: new Date().toISOString(),
              steps: w.steps.map((s) =>
                s.status === 'Pending' || s.status === 'Waiting Approval' || s.status === 'Running'
                  ? { ...s, status: 'Cancelled' }
                  : s
              ),
            }
      ),
    })),

  approveWorkflowStep: (workflowId, taskId) =>
    set((state) => {
      const now = new Date().toISOString();
      return {
        workflows: state.workflows.map((w) => {
          if (w.id !== workflowId) return w;
          const idx = w.steps.findIndex((s) => s.taskId === taskId);
          if (idx === -1) return w;
          const nextSteps = w.steps.map((s) => ({ ...s }));
          nextSteps[idx] = {
            ...nextSteps[idx],
            approvalGranted: true,
            status: 'Completed',
            completionTime: now,
            outputSummary: 'Explicit user approval recorded in durable checkpoint log.',
          };

          // Advance downstream non-approval steps automatically until next approval gate or completion
          let checkpoint = idx + 1;
          let overallStatus: WorkflowStatus = 'Completed';
          for (let i = idx + 1; i < nextSteps.length; i++) {
            if (nextSteps[i].approvalRequired && !nextSteps[i].approvalGranted) {
              nextSteps[i].status = 'Waiting Approval';
              nextSteps[i].startTime = now;
              nextSteps[i].attempts = Math.max(1, nextSteps[i].attempts);
              checkpoint = i;
              overallStatus = 'Waiting Approval';
              break;
            } else {
              nextSteps[i].status = 'Completed';
              nextSteps[i].startTime = now;
              nextSteps[i].completionTime = now;
              nextSteps[i].attempts = Math.max(1, nextSteps[i].attempts);
              nextSteps[i].outputSummary = `${nextSteps[i].label} completed using idempotency key ${nextSteps[i].idempotencyKey}.`;
              checkpoint = i;
            }
          }

          return {
            ...w,
            status: overallStatus,
            checkpointStepIndex: checkpoint,
            updatedAt: now,
            steps: nextSteps,
          };
        }),
      };
    }),

  retryWorkflowStep: (workflowId, taskId) =>
    set((state) => {
      const now = new Date().toISOString();
      return {
        workflows: state.workflows.map((w) => {
          if (w.id !== workflowId) return w;
          const nextSteps = w.steps.map((s) =>
            s.taskId === taskId
              ? {
                  ...s,
                  status: s.approvalRequired && !s.approvalGranted ? ('Waiting Approval' as const) : ('Completed' as const),
                  errorDetails: null,
                  attempts: s.attempts + 1,
                  completionTime: s.approvalRequired && !s.approvalGranted ? null : now,
                  outputSummary:
                    s.approvalRequired && !s.approvalGranted
                      ? null
                      : `Recovered on attempt #${s.attempts + 1} from durable checkpoint.`,
                }
              : s
          );
          const hasWaiting = nextSteps.some((s) => s.status === 'Waiting Approval');
          const hasFailed = nextSteps.some((s) => s.status === 'Failed');
          return {
            ...w,
            status: hasFailed ? 'Failed' : hasWaiting ? 'Waiting Approval' : 'Completed',
            updatedAt: now,
            steps: nextSteps,
          };
        }),
      };
    }),

  simulateStepFailure: (workflowId, taskId, reason) =>
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id !== workflowId
          ? w
          : {
              ...w,
              status: 'Failed',
              interruptedRecoverable: true,
              updatedAt: new Date().toISOString(),
              steps: w.steps.map((s) =>
                s.taskId === taskId
                  ? { ...s, status: 'Failed', errorDetails: reason, attempts: Math.max(1, s.attempts) }
                  : s
              ),
            }
      ),
    })),

  recoverInterruptedWorkflow: (workflowId) =>
    set((state) => {
      const now = new Date().toISOString();
      return {
        workflows: state.workflows.map((w) => {
          if (w.id !== workflowId) return w;
          const nextSteps = w.steps.map((s) =>
            s.status === 'Failed'
              ? {
                  ...s,
                  status: s.approvalRequired && !s.approvalGranted ? ('Waiting Approval' as const) : ('Completed' as const),
                  errorDetails: null,
                  attempts: s.attempts + 1,
                  completionTime: s.approvalRequired && !s.approvalGranted ? null : now,
                  outputSummary:
                    s.approvalRequired && !s.approvalGranted
                      ? null
                      : 'Recovered cleanly from last saved checkpoint without duplicate execution.',
                }
              : s
          );
          const hasWaiting = nextSteps.some((s) => s.status === 'Waiting Approval');
          return {
            ...w,
            status: hasWaiting ? 'Waiting Approval' : 'Completed',
            interruptedRecoverable: false,
            updatedAt: now,
            steps: nextSteps,
          };
        }),
      };
    }),

  scheduledRules: INITIAL_SCHEDULES,

  notificationPrefs: {
    inAppEnabled: true,
    emailEnabled: false,
    emailAddress: 'clara@northstarpress.io',
    timezone: 'America/New_York',
    triggers: {
      scheduledNicheResearch: false,
      weeklyOpportunityReports: true,
      seasonalAlerts: true,
      researchCompletion: true,
      approvalReminders: true,
      failedTasks: true,
      exportCompletion: true,
    },
  },

  notificationHistory: INITIAL_NOTIF_HISTORY,

  addScheduledRule: (rule) =>
    set((state) => {
      const active = rule.enabled && rule.userConsentGranted;
      const created: ScheduledResearchRule = {
        ...rule,
        id: generateId('sch'),
        enabled: active,
        lastRunAt: null,
        nextRunLabel: active
          ? `${rule.cadence} · ${rule.dayOfWeek} ${rule.runTimeLocal} (${state.notificationPrefs.timezone})`
          : 'Disabled (Permission Required)',
      };
      return { scheduledRules: [created, ...state.scheduledRules] };
    }),

  toggleScheduledRule: (id, enabled, consentGranted) =>
    set((state) => ({
      scheduledRules: state.scheduledRules.map((r) => {
        if (r.id !== id) return r;
        const active = enabled && consentGranted;
        return {
          ...r,
          enabled: active,
          userConsentGranted: consentGranted,
          nextRunLabel: active
            ? `${r.cadence} · ${r.dayOfWeek} ${r.runTimeLocal} (${state.notificationPrefs.timezone})`
            : 'Disabled (Enable & Grant Permission)',
        };
      }),
    })),

  deleteScheduledRule: (id) =>
    set((state) => ({
      scheduledRules: state.scheduledRules.filter((r) => r.id !== id),
    })),

  updateNotificationPrefs: (patch) =>
    set((state) => ({
      notificationPrefs: { ...state.notificationPrefs, ...patch },
    })),

  updateNotificationTrigger: (key, value) =>
    set((state) => ({
      notificationPrefs: {
        ...state.notificationPrefs,
        triggers: { ...state.notificationPrefs.triggers, [key]: value },
      },
    })),

  pushNotificationHistory: (entry) =>
    set((state) => ({
      notificationHistory: [
        {
          ...entry,
          id: generateId('nh'),
          timestamp: new Date().toISOString(),
          read: false,
        },
        ...state.notificationHistory,
      ],
    })),

  markHistoryRead: (id) =>
    set((state) => ({
      notificationHistory: state.notificationHistory.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),

  competitorGapReports: [],
  addCompetitorGapReport: (report) =>
    set((state) => ({
      competitorGapReports: [report, ...state.competitorGapReports.slice(0, 14)],
    })),

  keywordRecords: [],
  setKeywordRecords: (records) => set({ keywordRecords: records }),

  reviewReport: null,
  setReviewReport: (report) => set({ reviewReport: report }),

  researchHistory: [
    {
      id: 'rh_seed_1',
      type: 'Niche Research',
      query: 'Botanical Wildflower Coloring Books for Adults',
      marketplace: 'amazon.com',
      timestamp: '2026-11-19T14:02:14Z',
      confidenceScore: 82,
      sourceCount: 5,
      summary: 'Identified single-sided marker bleed-through gap and giftable floral themes.',
    },
    {
      id: 'rh_seed_2',
      type: 'Seasonal Check',
      query: 'Q4 Christmas & Q1 New Year Publishing Windows',
      marketplace: 'amazon.com',
      timestamp: '2026-11-18T11:20:00Z',
      confidenceScore: 84,
      sourceCount: 4,
      summary: 'Mapped 11 annual seasonal events with exact research deadlines and prep dates.',
    },
  ],
  addResearchHistory: (item) =>
    set((state) => ({
      researchHistory: [
        {
          ...item,
          id: generateId('rh'),
          timestamp: new Date().toISOString(),
        },
        ...state.researchHistory,
      ],
    })),
}));

// Helper to check a BookDocument against its BookStyleProfile
export function auditPagesAgainstStyleProfile(
  pages: BookPage[],
  profile: BookStyleProfile
): Array<{
  pageIndex: number;
  pageLabel: string;
  pageId: string;
  isApprovedLocked: boolean;
  issues: string[];
}> {
  const expectedPalette = new Set(profile.colorPalette.map((c) => c.toLowerCase()));
  return pages.map((page, idx) => {
    const issues: string[] = [];
    const textEls = page.elements.filter((e) => e.type === 'text');
    if (textEls.length === 0) {
      issues.push('No text elements found — verify typography and folio consistency.');
    }
    for (const el of textEls) {
      if (el.fontSize < 10) {
        issues.push(`Font size ${el.fontSize}pt is below readable KDP typography threshold.`);
      }
      if (expectedPalette.size > 0 && !expectedPalette.has(el.color.toLowerCase()) && el.color.toLowerCase() !== '#000000' && el.color.toLowerCase() !== '#1f2937' && el.color.toLowerCase() !== '#6b7280') {
        issues.push(`Text color ${el.color} deviates from Book Style Profile palette.`);
      }
    }
    return {
      pageIndex: idx + 1,
      pageLabel: page.label,
      pageId: page.id,
      isApprovedLocked: profile.approvedPageIds.includes(page.id),
      issues,
    };
  });
}

export function getTrimAspectRatio(trim: TrimSizeId): number {
  switch (trim) {
    case '8.5x8.5':
      return 1;
    case '8.5x11':
      return 8.5 / 11;
    case '7x10':
      return 7 / 10;
    case '5.5x8.5':
      return 5.5 / 8.5;
    case '6x9':
    default:
      return 6 / 9;
  }
}
