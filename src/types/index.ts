export type AppRoute =
  | '/dashboard'
  | '/chat'
  | '/research'
  | '/niches'
  | '/intelligence'
  | '/projects'
  | '/editor'
  | '/cover-studio'
  | '/studio-tools'
  | '/seo'
  | '/compliance'
  | '/analytics'
  | '/exports'
  | '/settings'
  | '/login'
  | '/register';

export type ThemeMode = 'dark' | 'light';

export type BookCategory =
  | "Children's Books"
  | 'Coloring Books'
  | 'Activity Books'
  | 'Puzzle Books'
  | 'Journals'
  | 'Non-Fiction Guides'
  | 'Workbooks';

export type ProjectStatus =
  | 'Drafting'
  | 'Researching'
  | 'In Review'
  | 'Cover Ready'
  | 'Completed';

export interface BookProject {
  id: string;
  title: string;
  subtitle: string;
  category: BookCategory;
  status: ProjectStatus;
  progress: number;
  thumbnail: string;
  trimSize: TrimSizeId;
  pageCount: number;
  updatedAt: string;
  marketplace: MarketplaceId;
  author: string;
}

export interface ActivityEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  category: 'research' | 'editor' | 'cover' | 'export' | 'approval';
  projectId?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  route: AppRoute;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  imprint: string;
  avatar: string;
}

// Conversational AI Workspace types
export type WorkflowCardType =
  | 'research_started'
  | 'research_completed'
  | 'book_proposal'
  | 'approval_required'
  | 'book_generation_progress'
  | 'cover_generation_progress'
  | 'export_completed';

export type ApprovalState = 'pending' | 'approved' | 'rejected' | 'improving';

export interface WorkflowDownloadLink {
  id: string;
  label: string;
  fileName: string;
  fileSize: string;
  url: string;
  primary?: boolean;
}

export interface WorkflowCardData {
  id: string;
  type: WorkflowCardType;
  title: string;
  summary: string;
  progress?: number;
  metrics?: Array<{ label: string; value: string }>;
  approvalState?: ApprovalState;
  nicheQuery?: string;
  topic?: string;
  projectId?: string;
  downloadLinks?: WorkflowDownloadLink[];
  proposedBook?: {
    title: string;
    category: BookCategory;
    trimSize: TrimSizeId;
    targetAudience: string;
  };
}

export interface ChatAttachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  previewText?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  attachments?: ChatAttachment[];
  workflowCards?: WorkflowCardData[];
  isStreaming?: boolean;
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
}

// Market Research & Niche Finder types
export type MarketplaceId = 'amazon.com' | 'amazon.co.uk' | 'amazon.de' | 'amazon.ca' | 'amazon.com.au';

export interface ResearchQueryParams {
  query: string;
  category: string;
  targetAudience: string;
  marketplace: MarketplaceId;
  dateRange: '30d' | '90d' | '6m' | '12m';
}

export interface EvidenceSource {
  title: string;
  url: string;
  domain: string;
}

export interface NicheOpportunity {
  id: string;
  nicheName: string;
  category: BookCategory;
  targetAudience: string;
  marketplace: MarketplaceId;
  researchDate: string;
  // Transparent separation between AI Estimates and Measured/Observed Signals
  aiEstimates: {
    demandScore: number; // 0-100 AI estimate
    competitionScore: number; // 0-100 (lower = less saturated)
    keywordOpportunityScore: number; // 0-100 AI estimate
    confidenceNote: string;
  };
  measuredSignals: {
    observedCompetitors: number;
    averageObservedReviews: number;
    priceRangeObserved: string;
    sourceCount: number;
    measurementMethod: string;
  };
  summary: string;
  evidenceSources: EvidenceSource[];
  tags: string[];
}

export interface CompetitorEntry {
  title: string;
  format: string;
  observedPrice: string;
  observedReviews: string;
  strengths: string;
  gap: string;
}

export interface KeywordOpportunityItem {
  keyword: string;
  intent: string;
  estimatedCompetition: 'Low' | 'Moderate' | 'High';
  rationale: string;
}

export interface NicheDetailReport {
  nicheName: string;
  marketplace: MarketplaceId;
  researchDate: string;
  marketOverview: string;
  measuredDataSummary: string;
  aiEstimateSummary: string;
  competitors: CompetitorEntry[];
  customerReviewInsights: {
    praisedThemes: string[];
    commonComplaints: string[];
  };
  keywordOpportunities: KeywordOpportunityItem[];
  marketGaps: string[];
  aiRecommendation: {
    verdict: string;
    suggestedTitle: string;
    suggestedSubtitle: string;
    recommendedTrimSize: TrimSizeId;
    recommendedPageCount: number;
    differentiationAngle: string;
  };
  sources: EvidenceSource[];
}

// Book Editor types
export type TrimSizeId = '6x9' | '8.5x11' | '8.5x8.5' | '5.5x8.5' | '7x10';
export type InteriorType = 'Black & White' | 'Standard Color' | 'Premium Color';
export type PaperType = 'White Paper' | 'Cream Paper';
export type TextAlign = 'left' | 'center' | 'right' | 'justify';

export interface BookSettings {
  trimSize: TrimSizeId;
  pageCount: number;
  interiorType: InteriorType;
  bleed: boolean;
  margins: {
    top: number;
    bottom: number;
    inside: number;
    outside: number;
  };
  paperType: PaperType;
}

export interface TextElement {
  id: string;
  type: 'text';
  content: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage 10-100
  fontFamily: string;
  fontSize: number; // pt
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textAlign: TextAlign;
  color: string;
  lineHeight: number;
}

export interface ImageElement {
  id: string;
  type: 'image';
  src: string;
  alt: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage 10-100
  height: number; // percentage 10-100
  naturalWidth: number; // original pixel resolution preserved
  naturalHeight: number; // original pixel resolution preserved
  lockAspectRatio: boolean;
  opacity: number;
}

export type PageElement = TextElement | ImageElement;

export interface PageBackground {
  color: string;
  pattern: 'none' | 'lined' | 'dot-grid' | 'border-frame';
}

export interface BookPage {
  id: string;
  label: string;
  background: PageBackground;
  elements: PageElement[];
}

export type ExportArtifactType =
  | 'interior_pdf'
  | 'full_cover_pdf'
  | 'metadata_json'
  | 'book_preview'
  | 'complete_zip';

export type ExportStatus = 'Generating' | 'Completed' | 'Failed';
export type ValidationStatus = 'Pending' | 'Passed' | 'Warnings' | 'Failed';

export interface ExportValidationCheck {
  label: string;
  passed: boolean;
  detail: string;
}

export interface ExportJob {
  id: string;
  projectId: string;
  projectTitle: string;
  artifactType: ExportArtifactType;
  format:
    | 'Interior PDF'
    | 'Full Cover PDF'
    | 'Metadata JSON'
    | 'Book Preview'
    | 'Complete ZIP Package';
  fileName: string;
  trimSize: TrimSizeId;
  status: ExportStatus;
  validationStatus: ValidationStatus;
  validationChecks?: ExportValidationCheck[];
  fileSize: string;
  downloadUrl?: string;
  errorMessage?: string;
  createdAt: string;
}

export type CoverTemplateId =
  | 'editorial_minimal'
  | 'classic_framed'
  | 'full_bleed_art'
  | 'split_band'
  | 'typographic_grid';

export interface CoverDesignState {
  template: CoverTemplateId;
  title: string;
  subtitle: string;
  author: string;
  spineTitle: string;
  spineAuthor: string;
  spineBgColor: string;
  spineTextColor: string;
  backHeadline: string;
  backBlurb: string;
  backAuthorBio: string;
  backBgColor: string;
  backTextColor: string;
  showIsbnBarcode: boolean;
  isbnNumber: string;
  frontBgColor: string;
  frontAccentColor: string;
  frontOverlayOpacity: number;
  titleFontFamily: string;
  titleFontSize: number;
  subtitleFontSize: number;
  textColor: string;
  textAlign: TextAlign;
  artworkSrc: string;
  imageScale: number;
  imagePosX: number;
  imagePosY: number;
  imageOpacity: number;
}

