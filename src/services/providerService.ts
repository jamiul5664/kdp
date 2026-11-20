import { apiDelete, apiGet, apiPost, apiPut } from './apiClient';

export type ModelCapability =
  | 'chat'
  | 'research'
  | 'reasoning'
  | 'writing'
  | 'coding'
  | 'image_generation'
  | 'embeddings'
  | 'vision';

export type TaskKey =
  | 'market_research'
  | 'competitor_analysis'
  | 'book_writing'
  | 'book_planning'
  | 'coloring_prompt_generation'
  | 'image_generation'
  | 'seo_research'
  | 'pdf_quality_analysis'
  | 'chat_assistant';

export interface ProviderTemplate {
  providerType: string;
  displayName: string;
  protocol: 'gemini' | 'openai_compatible' | 'huggingface' | 'ollama' | 'custom_http';
  defaultBaseUrl: string;
  authHeader: string;
  authScheme: string;
  supportsModelDiscovery: boolean;
  requiresApiKey: boolean;
  defaultCapabilities: ModelCapability[];
  sampleModels: Array<{ id: string; label: string; capabilities: ModelCapability[] }>;
  description: string;
}

export interface TaskDefinition {
  taskKey: TaskKey;
  label: string;
  requiredCapability: ModelCapability;
  recommendedProviders: string;
}

export interface StoredModel {
  id: string;
  modelId: string;
  displayName: string;
  capabilities: ModelCapability[];
  isManual: boolean;
  isDefault: boolean;
  contextWindow?: number | null;
}

export interface PublicApiConfig {
  id: string;
  userId: string;
  providerName: string;
  providerType: string;
  protocol: ProviderTemplate['protocol'];
  baseUrl: string;
  apiVersion?: string;
  organizationId?: string;
  customHeaders: Record<string, string>;
  customModelName: string;
  defaultModel: string;
  description: string;
  folder: string;
  tags: string[];
  priority: number;
  enabled: boolean;
  isDefault: boolean;
  maskedKey: string;
  keyFingerprint: string;
  keyVersion: number;
  healthStatus: 'Healthy' | 'Degraded' | 'Failed' | 'Cooldown' | 'Untested' | 'Disabled';
  authStatus: 'Verified' | 'Invalid Key' | 'Untested' | 'Not Required';
  consecutiveFailures: number;
  cooldownUntil: string | null;
  lastErrorType: string | null;
  lastErrorMessage: string | null;
  lastLatencyMs: number | null;
  lastTestedAt: string | null;
  models: StoredModel[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskAssignment {
  taskKey: TaskKey;
  mode: 'automatic' | 'manual';
  primaryConfigId: string | null;
  primaryModelId: string | null;
  fallbackConfigId: string | null;
  fallbackModelId: string | null;
  updatedAt: string;
}

export interface HealthRuleConfig {
  autoDisableOnAuthError: boolean;
  maxConsecutiveFailuresBeforeDisable: number;
  cooldownSeconds: number;
  maxRetriesPerRequest: number;
  forbidQuotaBypassKeyRotation: true;
}

export interface UsageLogEntry {
  id: string;
  configId: string;
  providerName: string;
  providerType: string;
  taskKey: string;
  modelId: string;
  success: boolean;
  errorType: string | null;
  errorMessage: string | null;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  estimatedCostUsd: number | null;
  fallbackUsed: boolean;
  timestamp: string;
}

export interface HealthCheckLogEntry {
  id: string;
  configId: string;
  providerName: string;
  status: 'Healthy' | 'Degraded' | 'Failed';
  authStatus: string;
  latencyMs: number;
  modelsDiscovered: number;
  providerResponse: string;
  errorMessage: string | null;
  timestamp: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  targetId: string;
  detail: string;
  timestamp: string;
}

export interface ProviderDashboardMetrics {
  totalConfigurations: number;
  activeConfigurations: number;
  failedConfigurations: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatencyMs: number | null;
  totalTokens: number | null;
  totalEstimatedCostUsd: number | null;
}

export interface ProviderMetaResponse {
  templates: ProviderTemplate[];
  tasks: TaskDefinition[];
}

export interface ProviderStateResponse {
  configs: PublicApiConfig[];
  taskAssignments: TaskAssignment[];
  healthRules: HealthRuleConfig;
  metrics: ProviderDashboardMetrics;
  usageLogs: UsageLogEntry[];
  healthLogs: HealthCheckLogEntry[];
  auditLogs: AuditLogEntry[];
}

export interface CreateProviderPayload {
  providerName: string;
  providerType: string;
  apiKey?: string;
  baseUrl: string;
  apiVersion?: string;
  organizationId?: string;
  customHeaders?: Record<string, string>;
  customModelName?: string;
  description?: string;
  folder?: string;
  tags?: string[];
  priority?: number;
  enabled?: boolean;
  isDefault?: boolean;
  manualCapabilities?: ModelCapability[];
}

export interface UpdateProviderPayload {
  providerName?: string;
  baseUrl?: string;
  apiKey?: string;
  apiVersion?: string;
  organizationId?: string;
  customHeaders?: Record<string, string>;
  defaultModel?: string;
  description?: string;
  folder?: string;
  tags?: string[];
  priority?: number;
  enabled?: boolean;
  isDefault?: boolean;
  recoverHealth?: boolean;
}

export interface TestTaskResponse {
  ok: boolean;
  taskKey: TaskKey;
  requiredCapability: ModelCapability;
  selectedProvider?: {
    configId: string;
    providerName: string;
    providerType: string;
    modelId: string;
    latencyMs: number;
    fallbackUsed: boolean;
  };
  attempts?: Array<{
    configId: string;
    providerName: string;
    modelId: string;
    ok: boolean;
    latencyMs: number;
    errorType: string | null;
    message: string;
  }>;
  error?: string;
}

export const ALL_CAPABILITIES: ModelCapability[] = [
  'chat',
  'research',
  'reasoning',
  'writing',
  'coding',
  'image_generation',
  'embeddings',
  'vision',
];

export async function fetchProviderMeta(): Promise<ProviderMetaResponse> {
  return apiGet<ProviderMetaResponse>('/providers/meta');
}

export async function fetchProviderState(): Promise<ProviderStateResponse> {
  return apiGet<ProviderStateResponse>('/providers/state');
}

export async function createProviderConfig(
  payload: CreateProviderPayload
): Promise<{ config: PublicApiConfig }> {
  return apiPost<{ config: PublicApiConfig }, CreateProviderPayload>('/providers/configs', payload);
}

export async function updateProviderConfig(
  id: string,
  payload: UpdateProviderPayload
): Promise<{ config: PublicApiConfig }> {
  return apiPut<{ config: PublicApiConfig }, UpdateProviderPayload>(`/providers/configs/${id}`, payload);
}

export async function deleteProviderConfig(id: string): Promise<{ deleted: boolean; id: string }> {
  return apiDelete<{ deleted: boolean; id: string }>(`/providers/configs/${id}`);
}

export async function addManualModelToConfig(
  configId: string,
  payload: {
    modelId: string;
    displayName?: string;
    capabilities: ModelCapability[];
    isDefault?: boolean;
  }
): Promise<{ config: PublicApiConfig; model: StoredModel }> {
  return apiPost<{ config: PublicApiConfig; model: StoredModel }>(
    `/providers/configs/${configId}/models`,
    payload
  );
}

export async function testProviderConnection(
  configId: string
): Promise<{ config: PublicApiConfig; testResult: HealthCheckLogEntry }> {
  return apiPost<{ config: PublicApiConfig; testResult: HealthCheckLogEntry }>(
    `/providers/configs/${configId}/test`,
    {}
  );
}

export async function updateTaskAssignment(
  taskKey: TaskKey,
  payload: Partial<TaskAssignment>
): Promise<{ assignment: TaskAssignment }> {
  return apiPut<{ assignment: TaskAssignment }, Partial<TaskAssignment>>(
    `/providers/tasks/${taskKey}`,
    payload
  );
}

export async function testTaskRouting(
  taskKey: TaskKey,
  overrideConfigId?: string
): Promise<TestTaskResponse> {
  return apiPost<TestTaskResponse>(`/providers/tasks/${taskKey}/test`, { overrideConfigId });
}

export async function updateHealthRules(
  payload: Partial<HealthRuleConfig>
): Promise<{ healthRules: HealthRuleConfig }> {
  return apiPut<{ healthRules: HealthRuleConfig }, Partial<HealthRuleConfig>>(
    '/providers/health-rules',
    payload
  );
}

export async function exportSecretFreeConfig(): Promise<Record<string, unknown>> {
  return apiGet<Record<string, unknown>>('/providers/export-config');
}

export async function importSecretFreeConfig(
  payload: Record<string, unknown>
): Promise<{ importedCount: number; skipped: Array<{ providerName: string; reason: string }> }> {
  return apiPost<{ importedCount: number; skipped: Array<{ providerName: string; reason: string }> }>(
    '/providers/import-config',
    payload
  );
}
