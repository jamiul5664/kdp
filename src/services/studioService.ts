import type {
  BookPage,
  BookSettings,
  ExportArtifactType,
  ExportValidationCheck,
  TrimSizeId,
  ValidationStatus,
} from '../types';
import { apiPost, getApiBaseUrl } from './apiClient';

export interface SeoOptimizationResult {
  optimizedTitle: string;
  optimizedSubtitle: string;
  backendKeywords: string[];
  bisacCategories: string[];
  htmlDescription: string;
}

export interface CoverConcept {
  name: string;
  palette: string[];
  typography: string;
  layoutNotes: string;
}

export interface GeneratedCoverArtwork {
  dataUrl: string;
  promptUsed: string;
  format: 'svg';
}

export interface BackendExportResponse {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  fileSizeLabel: string;
  status: 'Completed';
  validationStatus: ValidationStatus;
  validationChecks: ExportValidationCheck[];
  downloadUrl: string;
  createdAt: string;
}

export async function optimizeKdpListing(payload: {
  title: string;
  subtitle?: string;
  category: string;
  audience: string;
  author?: string;
  notes: string;
}): Promise<SeoOptimizationResult> {
  return apiPost<SeoOptimizationResult>('/seo/optimize', payload);
}

export async function generateCoverConcepts(payload: {
  title: string;
  subtitle: string;
  category: string;
  mood: string;
}): Promise<{ concepts: CoverConcept[] }> {
  return apiPost<{ concepts: CoverConcept[] }>('/cover/concepts', payload);
}

export async function generateCoverArtwork(payload: {
  prompt: string;
  title: string;
  category: string;
  palette?: string;
}): Promise<GeneratedCoverArtwork> {
  return apiPost<GeneratedCoverArtwork>('/cover/generate-artwork', payload);
}

export async function requestBackendExport(payload: {
  projectId: string;
  projectTitle: string;
  author: string;
  subtitle: string;
  artifactType: ExportArtifactType;
  trimSize: TrimSizeId;
  settings: BookSettings;
  pages: BookPage[];
  coverSpec: {
    fullWidthIn: number;
    fullHeightIn: number;
    spineWidthIn: number;
    bleedIn: number;
    fullWidthPx300: number;
    fullHeightPx300: number;
    spineTextAllowed: boolean;
  };
  seoMetadata?: Record<string, unknown>;
}): Promise<BackendExportResponse> {
  const res = await apiPost<BackendExportResponse>('/exports/generate', payload);
  return {
    ...res,
    downloadUrl: res.downloadUrl.startsWith('http')
      ? res.downloadUrl
      : `${getApiBaseUrl().replace(/\/api$/, '')}${res.downloadUrl}`,
  };
}
