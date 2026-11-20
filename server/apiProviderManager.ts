import crypto from 'crypto';
import type { Express, Request, Response } from 'express';

// ---------------------------------------------------------------------------
// 1. Authenticated Encryption Secret Manager (AES-256-GCM, Backend-Only)
// ---------------------------------------------------------------------------
const MASTER_KEY_MATERIAL =
  process.env.API_SECRET_MASTER_KEY ||
  process.env.JWT_SECRET_KEY ||
  'kdp-studio-dev-ephemeral-master-key-change-in-prod';

const DERIVED_KEY = crypto.scryptSync(MASTER_KEY_MATERIAL, 'kdp-studio-aes256gcm-salt', 32);

export interface EncryptedSecretBlob {
  iv: string;
  tag: string;
  ciphertext: string;
  keyVersion: number;
}

export function encryptApiKey(plainSecret: string, keyVersion = 1): EncryptedSecretBlob {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', DERIVED_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainSecret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    keyVersion,
  };
}

export function decryptApiKey(blob: EncryptedSecretBlob): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    DERIVED_KEY,
    Buffer.from(blob.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function maskApiKey(plainSecret: string): string {
  const trimmed = plainSecret.trim();
  if (!trimmed) return 'Not Configured';
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}••••••`;
  return `${trimmed.slice(0, 4)}••••••••${trimmed.slice(-4)}`;
}

export function fingerprintApiKey(plainSecret: string): string {
  return crypto.createHash('sha256').update(plainSecret.trim()).digest('hex').slice(0, 12);
}

// ---------------------------------------------------------------------------
// 2. SSRF & Custom Base URL Validator
// ---------------------------------------------------------------------------
function isPrivateOrRestrictedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    h === 'localhost' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h === '::' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h === 'metadata.google.internal' ||
    h === '169.254.169.254'
  ) {
    return true;
  }
  // IPv4 private / loopback / link-local / CGNAT
  const ipv4Match = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [a, b] = [Number(ipv4Match[1]), Number(ipv4Match[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  // IPv6 ULA / link-local
  if (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80:')) {
    return true;
  }
  return false;
}

export function validateProviderBaseUrl(
  rawUrl: string,
  providerType: string
): { valid: boolean; normalizedUrl?: string; error?: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { valid: false, error: 'API Base URL is required.' };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Malformed URL. Use a valid https:// endpoint.' };
  }

  const allowLocalOllama =
    providerType === 'ollama' && process.env.ALLOW_LOCAL_OLLAMA !== 'false';

  if (parsed.protocol !== 'https:' && !(allowLocalOllama && parsed.protocol === 'http:')) {
    return {
      valid: false,
      error: 'Only HTTPS endpoints are permitted (HTTP is restricted to explicitly allowed local Ollama instances).',
    };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: 'Credentials embedded in URL are not allowed.' };
  }

  if (isPrivateOrRestrictedHost(parsed.hostname)) {
    const isLoopbackOllama =
      allowLocalOllama && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
    if (!isLoopbackOllama) {
      return {
        valid: false,
        error: `SSRF Protection: Private, loopback, or metadata destination "${parsed.hostname}" is blocked.`,
      };
    }
  }

  return { valid: true, normalizedUrl: parsed.toString().replace(/\/$/, '') };
}

// ---------------------------------------------------------------------------
// 3. Built-in Provider Templates (15 Types — Unlimited Configs Allowed)
// ---------------------------------------------------------------------------
export type ModelCapability =
  | 'chat'
  | 'research'
  | 'reasoning'
  | 'writing'
  | 'coding'
  | 'image_generation'
  | 'embeddings'
  | 'vision';

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

export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    providerType: 'google_gemini',
    displayName: 'Google Gemini',
    protocol: 'gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    authHeader: 'x-goog-api-key',
    authScheme: '',
    supportsModelDiscovery: true,
    requiresApiKey: true,
    defaultCapabilities: ['chat', 'research', 'reasoning', 'writing', 'coding', 'vision', 'embeddings', 'image_generation'],
    sampleModels: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', capabilities: ['chat', 'research', 'writing', 'coding', 'vision'] },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', capabilities: ['chat', 'research', 'reasoning', 'writing', 'coding', 'vision'] },
      { id: 'imagen-3.0-generate-002', label: 'Imagen 3', capabilities: ['image_generation'] },
      { id: 'text-embedding-004', label: 'Text Embedding 004', capabilities: ['embeddings'] },
    ],
    description: 'Official Google Gemini API supporting multimodal vision, reasoning, research, and Imagen.',
  },
  {
    providerType: 'openrouter',
    displayName: 'OpenRouter',
    protocol: 'openai_compatible',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    authHeader: 'Authorization',
    authScheme: 'Bearer',
    supportsModelDiscovery: true,
    requiresApiKey: true,
    defaultCapabilities: ['chat', 'research', 'reasoning', 'writing', 'coding', 'vision'],
    sampleModels: [
      { id: 'anthropic/claude-3.7-sonnet', label: 'Claude 3.7 Sonnet (OpenRouter)', capabilities: ['chat', 'research', 'reasoning', 'writing', 'coding', 'vision'] },
      { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (OpenRouter)', capabilities: ['chat', 'research', 'reasoning', 'writing', 'vision'] },
      { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1 (OpenRouter)', capabilities: ['chat', 'reasoning', 'writing', 'coding'] },
    ],
    description: 'Unified OpenAI-compatible gateway routing across multiple foundation model vendors.',
  },
  {
    providerType: 'omniroute',
    displayName: 'OmniRoute',
    protocol: 'openai_compatible',
    defaultBaseUrl: 'https://api.omniroute.ai/v1',
    authHeader: 'Authorization',
    authScheme: 'Bearer',
    supportsModelDiscovery: true,
    requiresApiKey: true,
    defaultCapabilities: ['chat', 'research', 'reasoning', 'writing', 'coding', 'vision'],
    sampleModels: [
      { id: 'omni-auto', label: 'OmniRoute Auto', capabilities: ['chat', 'research', 'writing', 'coding'] },
    ],
    description: 'Multi-endpoint OpenAI-compatible router supporting multiple workspace endpoints.',
  },
  {
    providerType: 'openai',
    displayName: 'OpenAI',
    protocol: 'openai_compatible',
    defaultBaseUrl: 'https://api.openai.com/v1',
    authHeader: 'Authorization',
    authScheme: 'Bearer',
    supportsModelDiscovery: true,
    requiresApiKey: true,
    defaultCapabilities: ['chat', 'research', 'reasoning', 'writing', 'coding', 'vision', 'image_generation', 'embeddings'],
    sampleModels: [
      { id: 'gpt-4o', label: 'GPT-4o', capabilities: ['chat', 'research', 'writing', 'coding', 'vision'] },
      { id: 'o3-mini', label: 'o3-mini', capabilities: ['chat', 'reasoning', 'coding'] },
      { id: 'gpt-image-1', label: 'GPT Image 1', capabilities: ['image_generation'] },
      { id: 'text-embedding-3-small', label: 'Text Embedding 3 Small', capabilities: ['embeddings'] },
    ],
    description: 'Official OpenAI API with optional Organization ID header support.',
  },
  {
    providerType: 'groq',
    displayName: 'Groq',
    protocol: 'openai_compatible',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    authHeader: 'Authorization',
    authScheme: 'Bearer',
    supportsModelDiscovery: true,
    requiresApiKey: true,
    defaultCapabilities: ['chat', 'writing', 'coding', 'reasoning'],
    sampleModels: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile', capabilities: ['chat', 'writing', 'coding'] },
      { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill 70B', capabilities: ['chat', 'reasoning', 'coding'] },
    ],
    description: 'Ultra-low-latency OpenAI-compatible inference engine.',
  },
  {
    providerType: 'cerebras',
    displayName: 'Cerebras',
    protocol: 'openai_compatible',
    defaultBaseUrl: 'https://api.cerebras.ai/v1',
    authHeader: 'Authorization',
    authScheme: 'Bearer',
    supportsModelDiscovery: true,
    requiresApiKey: true,
    defaultCapabilities: ['chat', 'writing', 'coding'],
    sampleModels: [
      { id: 'llama-3.3-70b', label: 'Llama 3.3 70B (Cerebras)', capabilities: ['chat', 'writing', 'coding'] },
    ],
    description: 'Wafer-scale high-throughput OpenAI-compatible inference.',
  },
  {
    providerType: 'huggingface',
    displayName: 'Hugging Face',
    protocol: 'huggingface',
    defaultBaseUrl: 'https://router.huggingface.co/v1',
    authHeader: 'Authorization',
    authScheme: 'Bearer',
    supportsModelDiscovery: false,
    requiresApiKey: true,
    defaultCapabilities: ['chat', 'writing', 'coding', 'embeddings', 'image_generation'],
    sampleModels: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B Instruct', capabilities: ['chat', 'writing', 'coding'] },
      { id: 'black-forest-labs/FLUX.1-dev', label: 'FLUX.1-dev (Image)', capabilities: ['image_generation'] },
    ],
    description: 'Hugging Face Inference Providers supporting open-weight text and image models.',
  },
  {
    providerType: 'deepseek',
    displayName: 'DeepSeek',
    protocol: 'openai_compatible',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    authHeader: 'Authorization',
    authScheme: 'Bearer',
    supportsModelDiscovery: true,
    requiresApiKey: true,
    defaultCapabilities: ['chat', 'reasoning', 'writing', 'coding'],
    sampleModels: [
      { id: 'deepseek-chat', label: 'DeepSeek V3 Chat', capabilities: ['chat', 'writing', 'coding'] },
      { id: 'deepseek-reasoner', label: 'DeepSeek R1 Reasoner', capabilities: ['chat', 'reasoning', 'coding'] },
    ],
    description: 'DeepSeek API for long-form writing, coding, and deep reasoning.',
  },
  {
    providerType: 'qwen',
    displayName: 'Qwen (DashScope)',
    protocol: 'openai_compatible',
    defaultBaseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    authHeader: 'Authorization',
    authScheme: 'Bearer',
    supportsModelDiscovery: true,
    requiresApiKey: true,
    defaultCapabilities: ['chat', 'reasoning', 'writing', 'coding', 'vision'],
    sampleModels: [
      { id: 'qwen-max', label: 'Qwen Max', capabilities: ['chat', 'writing', 'reasoning'] },
      { id: 'qwen-vl-max', label: 'Qwen VL Max (Vision)', capabilities: ['chat', 'vision'] },
    ],
    description: 'Alibaba Cloud DashScope OpenAI-compatible Qwen models.',
  },
  {
    providerType: 'mistral',
    displayName: 'Mistral',
    protocol: 'openai_compatible',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    authHeader: 'Authorization',
    authScheme: 'Bearer',
    supportsModelDiscovery: true,
    requiresApiKey: true,
    defaultCapabilities: ['chat', 'writing', 'coding', 'vision', 'embeddings'],
    sampleModels: [
      { id: 'mistral-large-latest', label: 'Mistral Large', capabilities: ['chat', 'writing', 'coding'] },
      { id: 'pixtral-large-latest', label: 'Pixtral Large (Vision)', capabilities: ['chat', 'vision'] },
    ],
    description: 'Mistral AI API including Pixtral multimodal models.',
  },
  {
    providerType: 'together_ai',
    displayName: 'Together AI',
    protocol: 'openai_compatible',
    defaultBaseUrl: 'https://api.together.xyz/v1',
    authHeader: 'Authorization',
    authScheme: 'Bearer',
    supportsModelDiscovery: true,
    requiresApiKey: true,
    defaultCapabilities: ['chat', 'writing', 'coding', 'image_generation', 'embeddings'],
    sampleModels: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', label: 'Llama 3.3 70B Turbo', capabilities: ['chat', 'writing', 'coding'] },
      { id: 'black-forest-labs/FLUX.1-schnell', label: 'FLUX.1 Schnell (Image)', capabilities: ['image_generation'] },
    ],
    description: 'Together AI OpenAI-compatible open models and FLUX image endpoints.',
  },
  {
    providerType: 'fireworks_ai',
    displayName: 'Fireworks AI',
    protocol: 'openai_compatible',
    defaultBaseUrl: 'https://api.fireworks.ai/inference/v1',
    authHeader: 'Authorization',
    authScheme: 'Bearer',
    supportsModelDiscovery: true,
    requiresApiKey: true,
    defaultCapabilities: ['chat', 'writing', 'coding', 'image_generation'],
    sampleModels: [
      { id: 'accounts/fireworks/models/llama-v3p3-70b-instruct', label: 'Llama 3.3 70B Instruct', capabilities: ['chat', 'writing', 'coding'] },
    ],
    description: 'High-speed Fireworks AI inference endpoints.',
  },
  {
    providerType: 'ollama',
    displayName: 'Ollama',
    protocol: 'ollama',
    defaultBaseUrl: 'http://localhost:11434',
    authHeader: 'Authorization',
    authScheme: 'Bearer',
    supportsModelDiscovery: true,
    requiresApiKey: false,
    defaultCapabilities: ['chat', 'writing', 'coding', 'embeddings', 'vision'],
    sampleModels: [
      { id: 'llama3.2', label: 'Llama 3.2 (Local)', capabilities: ['chat', 'writing', 'coding'] },
      { id: 'llava', label: 'LLaVA (Vision)', capabilities: ['chat', 'vision'] },
    ],
    description: 'Local or remote Ollama server (requires explicit local permission or HTTPS remote URL).',
  },
  {
    providerType: 'openai_compatible',
    displayName: 'OpenAI-Compatible API',
    protocol: 'openai_compatible',
    defaultBaseUrl: 'https://api.example.com/v1',
    authHeader: 'Authorization',
    authScheme: 'Bearer',
    supportsModelDiscovery: true,
    requiresApiKey: true,
    defaultCapabilities: ['chat', 'writing', 'coding'],
    sampleModels: [],
    description: 'Any third-party vLLM, LiteLLM, Azure-proxy, or OpenAI-compatible inference server.',
  },
  {
    providerType: 'custom_http',
    displayName: 'Custom HTTP API Adapter',
    protocol: 'custom_http',
    defaultBaseUrl: 'https://api.custom-provider.example/v1',
    authHeader: 'Authorization',
    authScheme: 'Bearer',
    supportsModelDiscovery: false,
    requiresApiKey: true,
    defaultCapabilities: ['chat'],
    sampleModels: [],
    description: 'Custom HTTPS JSON adapter with configurable headers and manual model capabilities.',
  },
];

// ---------------------------------------------------------------------------
// 4. Data Models (Mirrors the 8 PostgreSQL Tables)
// ---------------------------------------------------------------------------
export interface StoredModel {
  id: string;
  modelId: string;
  displayName: string;
  capabilities: ModelCapability[];
  isManual: boolean;
  isDefault: boolean;
  contextWindow?: number | null;
}

export interface StoredApiConfig {
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
  priority: number; // Lower number = higher priority (1 = highest)
  enabled: boolean;
  isDefault: boolean;
  // Encrypted secret only — NEVER sent in API responses
  encryptedKey: EncryptedSecretBlob | null;
  maskedKey: string;
  keyFingerprint: string;
  keyVersion: number;
  // Health & Failover metadata
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

export interface TaskDefinition {
  taskKey: TaskKey;
  label: string;
  requiredCapability: ModelCapability;
  recommendedProviders: string;
}

export const TASK_DEFINITIONS: TaskDefinition[] = [
  { taskKey: 'market_research', label: '1. Market Research', requiredCapability: 'research', recommendedProviders: 'Gemini / OpenRouter / Custom' },
  { taskKey: 'competitor_analysis', label: '2. Competitor Analysis', requiredCapability: 'research', recommendedProviders: 'Gemini / OpenRouter' },
  { taskKey: 'book_writing', label: '3. Book Writing', requiredCapability: 'writing', recommendedProviders: 'Gemini / OpenAI / DeepSeek / Qwen' },
  { taskKey: 'book_planning', label: '4. Book Planning', requiredCapability: 'reasoning', recommendedProviders: 'Reasoning Model' },
  { taskKey: 'coloring_prompt_generation', label: '5. Coloring Page Prompt Generation', requiredCapability: 'writing', recommendedProviders: 'Gemini / OpenRouter' },
  { taskKey: 'image_generation', label: '6. Image Generation', requiredCapability: 'image_generation', recommendedProviders: 'Configured Image Provider' },
  { taskKey: 'seo_research', label: '7. SEO Research', requiredCapability: 'research', recommendedProviders: 'Gemini / OpenRouter' },
  { taskKey: 'pdf_quality_analysis', label: '8. PDF Quality Analysis', requiredCapability: 'vision', recommendedProviders: 'Vision-capable Model' },
  { taskKey: 'chat_assistant', label: '9. Chat Assistant', requiredCapability: 'chat', recommendedProviders: 'User-selected default model' },
];

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
  /** Strictly enforced invariant: never rotate keys on the same provider to bypass quotas/rate limits */
  forbidQuotaBypassKeyRotation: true;
}

export interface UsageLogEntry {
  id: string;
  userId: string;
  configId: string;
  providerName: string;
  providerType: string;
  taskKey: string;
  modelId: string;
  success: boolean;
  errorType: string | null;
  errorMessage: string | null;
  latencyMs: number;
  promptTokens: number | null; // null => Unavailable (never invented)
  completionTokens: number | null;
  estimatedCostUsd: number | null;
  fallbackUsed: boolean;
  timestamp: string;
}

export interface HealthCheckLogEntry {
  id: string;
  userId: string;
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
  userId: string;
  action: string;
  targetId: string;
  detail: string;
  timestamp: string;
}

export type FailureKind =
  | 'auth_error'
  | 'quota_or_rate_limit'
  | 'temporary_server_error'
  | 'network_timeout'
  | 'capability_mismatch'
  | 'bad_request';

export function classifyProviderError(statusCode: number | null, message: string): {
  kind: FailureKind;
  retryable: boolean;
  permanent: boolean;
} {
  const low = message.toLowerCase();
  if (statusCode === 401 || statusCode === 403 || low.includes('invalid api key') || low.includes('unauthorized') || low.includes('authentication')) {
    return { kind: 'auth_error', retryable: false, permanent: true };
  }
  if (statusCode === 429 || low.includes('rate limit') || low.includes('quota') || low.includes('too many requests')) {
    return { kind: 'quota_or_rate_limit', retryable: false, permanent: false };
  }
  if ((statusCode && statusCode >= 500) || low.includes('overloaded') || low.includes('service unavailable')) {
    return { kind: 'temporary_server_error', retryable: true, permanent: false };
  }
  if (low.includes('timeout') || low.includes('abort') || low.includes('econnreset') || low.includes('fetch failed')) {
    return { kind: 'network_timeout', retryable: true, permanent: false };
  }
  return { kind: 'bad_request', retryable: false, permanent: true };
}

export function sanitizeConfigForClient(cfg: StoredApiConfig): Omit<StoredApiConfig, 'encryptedKey'> {
  const { encryptedKey: _hidden, ...safe } = cfg;
  return safe;
}

// ---------------------------------------------------------------------------
// 5. In-Memory Multi-User Store (Backed by PostgreSQL in FastAPI Deployment)
// ---------------------------------------------------------------------------
const configsById = new Map<string, StoredApiConfig>();
const taskAssignmentsByUser = new Map<string, Map<TaskKey, TaskAssignment>>();
const healthRulesByUser = new Map<string, HealthRuleConfig>();
const usageLogs: UsageLogEntry[] = [];
const healthLogs: HealthCheckLogEntry[] = [];
const auditLogs: AuditLogEntry[] = [];

function getUserId(req: Request): string {
  const headerUser = req.headers['x-user-id'];
  if (typeof headerUser === 'string' && headerUser.trim()) return headerUser.trim();
  return 'usr_clara';
}

function getOrInitHealthRules(userId: string): HealthRuleConfig {
  let rules = healthRulesByUser.get(userId);
  if (!rules) {
    rules = {
      autoDisableOnAuthError: true,
      maxConsecutiveFailuresBeforeDisable: 3,
      cooldownSeconds: 120,
      maxRetriesPerRequest: 2,
      forbidQuotaBypassKeyRotation: true,
    };
    healthRulesByUser.set(userId, rules);
  }
  return rules;
}

function getOrInitTaskAssignments(userId: string): Map<TaskKey, TaskAssignment> {
  let map = taskAssignmentsByUser.get(userId);
  if (!map) {
    map = new Map();
    const now = new Date().toISOString();
    for (const def of TASK_DEFINITIONS) {
      map.set(def.taskKey, {
        taskKey: def.taskKey,
        mode: 'automatic',
        primaryConfigId: null,
        primaryModelId: null,
        fallbackConfigId: null,
        fallbackModelId: null,
        updatedAt: now,
      });
    }
    taskAssignmentsByUser.set(userId, map);
  }
  return map;
}

function recordAudit(userId: string, action: string, targetId: string, detail: string) {
  auditLogs.unshift({
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    userId,
    action,
    targetId,
    detail,
    timestamp: new Date().toISOString(),
  });
  if (auditLogs.length > 300) auditLogs.pop();
}

// Bootstrap one server-managed Gemini config if GEMINI_API_KEY exists (masked, never exposed)
function bootstrapServerGeminiIfAvailable() {
  if (configsById.size > 0) return;
  const envKey = process.env.GEMINI_API_KEY?.trim();
  if (!envKey) return;
  const tpl = PROVIDER_TEMPLATES[0];
  const now = new Date().toISOString();
  const id = 'cfg_server_gemini_default';
  configsById.set(id, {
    id,
    userId: 'usr_clara',
    providerName: 'Workspace Google Gemini (Server Managed)',
    providerType: 'google_gemini',
    protocol: 'gemini',
    baseUrl: tpl.defaultBaseUrl,
    apiVersion: 'v1beta',
    organizationId: '',
    customHeaders: {},
    customModelName: 'gemini-2.5-flash',
    defaultModel: 'gemini-2.5-flash',
    description: 'Server-configured Google Gemini provider authenticated via backend environment secret.',
    folder: 'Production',
    tags: ['default', 'multimodal', 'research'],
    priority: 1,
    enabled: true,
    isDefault: true,
    encryptedKey: encryptApiKey(envKey, 1),
    maskedKey: maskApiKey(envKey),
    keyFingerprint: fingerprintApiKey(envKey),
    keyVersion: 1,
    healthStatus: 'Healthy',
    authStatus: 'Verified',
    consecutiveFailures: 0,
    cooldownUntil: null,
    lastErrorType: null,
    lastErrorMessage: null,
    lastLatencyMs: null,
    lastTestedAt: null,
    models: tpl.sampleModels.map((m, idx) => ({
      id: `mdl_boot_${idx}`,
      modelId: m.id,
      displayName: m.label,
      capabilities: m.capabilities,
      isManual: false,
      isDefault: idx === 0,
    })),
    createdAt: now,
    updatedAt: now,
  });
}

// ---------------------------------------------------------------------------
// 6. Common Adapter Interface: Safe Test Connection & Model Discovery
// ---------------------------------------------------------------------------
function inferCapabilitiesFromModelId(modelId: string, fallback: ModelCapability[]): ModelCapability[] {
  const low = modelId.toLowerCase();
  if (low.includes('imagen') || low.includes('flux') || low.includes('dall-e') || low.includes('image')) {
    return ['image_generation'];
  }
  if (low.includes('embed')) {
    return ['embeddings'];
  }
  const caps = new Set<ModelCapability>(['chat']);
  if (low.includes('vision') || low.includes('-vl') || low.includes('gpt-4o') || low.includes('gemini') || low.includes('pixtral') || low.includes('llava') || low.includes('claude-3')) {
    caps.add('vision');
  }
  if (low.includes('r1') || low.includes('o1') || low.includes('o3') || low.includes('reason') || low.includes('pro') || low.includes('sonnet')) {
    caps.add('reasoning');
  }
  if (low.includes('gemini') || low.includes('claude') || low.includes('gpt-4') || low.includes('perplexity')) {
    caps.add('research');
  }
  caps.add('writing');
  caps.add('coding');
  return caps.size > 0 ? Array.from(caps) : fallback;
}

async function runAdapterConnectionTest(cfg: StoredApiConfig): Promise<{
  ok: boolean;
  statusCode: number | null;
  latencyMs: number;
  providerResponse: string;
  discoveredModels: StoredModel[];
  errorMessage: string | null;
}> {
  const urlCheck = validateProviderBaseUrl(cfg.baseUrl, cfg.providerType);
  if (!urlCheck.valid || !urlCheck.normalizedUrl) {
    return {
      ok: false,
      statusCode: 400,
      latencyMs: 0,
      providerResponse: 'Blocked by SSRF/URL validation',
      discoveredModels: [],
      errorMessage: urlCheck.error || 'Invalid base URL',
    };
  }

  let plainKey = '';
  if (cfg.encryptedKey) {
    plainKey = decryptApiKey(cfg.encryptedKey);
  }
  const tpl = PROVIDER_TEMPLATES.find((t) => t.providerType === cfg.providerType);
  if (tpl?.requiresApiKey && !plainKey) {
    return {
      ok: false,
      statusCode: 401,
      latencyMs: 0,
      providerResponse: 'Missing API key',
      discoveredModels: [],
      errorMessage: 'Authentication error: No API key stored for this configuration.',
    };
  }

  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);

  try {
    let targetUrl = `${urlCheck.normalizedUrl}/models`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...cfg.customHeaders,
    };

    if (cfg.protocol === 'gemini') {
      targetUrl = `${urlCheck.normalizedUrl}/models?pageSize=25`;
      if (plainKey) headers['x-goog-api-key'] = plainKey;
    } else if (cfg.protocol === 'ollama') {
      targetUrl = `${urlCheck.normalizedUrl}/api/tags`;
      if (plainKey) headers['Authorization'] = `Bearer ${plainKey}`;
    } else {
      if (plainKey) {
        const scheme = tpl?.authScheme ? `${tpl.authScheme} ` : '';
        headers[tpl?.authHeader || 'Authorization'] = `${scheme}${plainKey}`;
      }
      if (cfg.organizationId) {
        headers['OpenAI-Organization'] = cfg.organizationId;
      }
    }

    const res = await fetch(targetUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const errBody = (await res.text().catch(() => '')).slice(0, 240);
      return {
        ok: false,
        statusCode: res.status,
        latencyMs,
        providerResponse: `HTTP ${res.status} ${res.statusText}`,
        discoveredModels: [],
        errorMessage: errBody || `Provider returned HTTP ${res.status}`,
      };
    }

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const rawList: Array<{ id: string; displayName?: string }> = [];

    if (Array.isArray(json.models)) {
      for (const m of json.models as Array<Record<string, unknown>>) {
        const rawName = String(m.name || m.model || m.id || '').replace(/^models\//, '');
        if (rawName) rawList.push({ id: rawName, displayName: String(m.displayName || rawName) });
      }
    } else if (Array.isArray(json.data)) {
      for (const m of json.data as Array<Record<string, unknown>>) {
        const rawId = String(m.id || '');
        if (rawId) rawList.push({ id: rawId, displayName: String(m.name || rawId) });
      }
    }

    const discoveredModels: StoredModel[] = rawList.slice(0, 40).map((m, idx) => ({
      id: `mdl_${cfg.id}_${idx}`,
      modelId: m.id,
      displayName: m.displayName || m.id,
      capabilities: inferCapabilitiesFromModelId(m.id, tpl?.defaultCapabilities || ['chat']),
      isManual: false,
      isDefault: m.id === cfg.defaultModel || idx === 0,
    }));

    return {
      ok: true,
      statusCode: res.status,
      latencyMs,
      providerResponse: `HTTP ${res.status} OK · ${discoveredModels.length} models discovered`,
      discoveredModels,
      errorMessage: null,
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : 'Network error during connection test.';
    return {
      ok: false,
      statusCode: null,
      latencyMs,
      providerResponse: 'Connection error',
      discoveredModels: [],
      errorMessage: msg,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// 7. Capability Validator & Smart Router with Policy-Compliant Failover
// ---------------------------------------------------------------------------
export function validateModelCapabilityForTask(
  taskKey: TaskKey,
  model: StoredModel | undefined,
  config: StoredApiConfig
): { ok: boolean; error?: string } {
  const def = TASK_DEFINITIONS.find((t) => t.taskKey === taskKey);
  if (!def) return { ok: false, error: `Unknown task: ${taskKey}` };

  const caps = model?.capabilities ?? config.models[0]?.capabilities ?? [];
  if (def.requiredCapability === 'image_generation' && !caps.includes('image_generation')) {
    return {
      ok: false,
      error: `Capability mismatch: "${model?.modelId || config.defaultModel}" is text-only and cannot execute Image Generation tasks.`,
    };
  }
  if (def.requiredCapability === 'vision' && !caps.includes('vision')) {
    return {
      ok: false,
      error: `Capability mismatch: "${model?.modelId || config.defaultModel}" does not support Vision required for PDF Quality Analysis.`,
    };
  }
  if (!caps.includes(def.requiredCapability) && def.requiredCapability !== 'chat') {
    return {
      ok: false,
      error: `Capability mismatch: "${model?.modelId || config.defaultModel}" does not declare "${def.requiredCapability}" capability.`,
    };
  }
  return { ok: true };
}

export function selectCandidatesForTask(
  userId: string,
  taskKey: TaskKey,
  overrideConfigId?: string
): {
  requiredCapability: ModelCapability;
  candidates: Array<{ config: StoredApiConfig; model: StoredModel; role: 'primary' | 'fallback' | 'auto' }>;
  rejected: Array<{ configId: string; providerName: string; reason: string }>;
} {
  const def = TASK_DEFINITIONS.find((t) => t.taskKey === taskKey)!;
  const assignments = getOrInitTaskAssignments(userId);
  const assignment = assignments.get(taskKey);
  const now = Date.now();

  const userConfigs = Array.from(configsById.values()).filter((c) => c.userId === userId);
  const rejected: Array<{ configId: string; providerName: string; reason: string }> = [];
  const eligible: Array<{ config: StoredApiConfig; model: StoredModel }> = [];

  for (const cfg of userConfigs) {
    if (!cfg.enabled) {
      rejected.push({ configId: cfg.id, providerName: cfg.providerName, reason: 'Configuration is disabled.' });
      continue;
    }
    if (cfg.cooldownUntil && new Date(cfg.cooldownUntil).getTime() > now) {
      rejected.push({ configId: cfg.id, providerName: cfg.providerName, reason: `In cooldown until ${cfg.cooldownUntil}.` });
      continue;
    }
    const matchingModel =
      cfg.models.find((m) => m.modelId === assignment?.primaryModelId && m.capabilities.includes(def.requiredCapability)) ||
      cfg.models.find((m) => m.modelId === cfg.defaultModel && m.capabilities.includes(def.requiredCapability)) ||
      cfg.models.find((m) => m.capabilities.includes(def.requiredCapability));

    if (!matchingModel) {
      rejected.push({
        configId: cfg.id,
        providerName: cfg.providerName,
        reason: `No model with required capability "${def.requiredCapability}".`,
      });
      continue;
    }
    eligible.push({ config: cfg, model: matchingModel });
  }

  // Sort eligible by priority ascending, then health, then lowest latency
  eligible.sort((a, b) => {
    if (a.config.priority !== b.config.priority) return a.config.priority - b.config.priority;
    const score = (h: StoredApiConfig['healthStatus']) => (h === 'Healthy' ? 0 : h === 'Untested' ? 1 : 2);
    if (score(a.config.healthStatus) !== score(b.config.healthStatus)) {
      return score(a.config.healthStatus) - score(b.config.healthStatus);
    }
    return (a.config.lastLatencyMs ?? 500) - (b.config.lastLatencyMs ?? 500);
  });

  const ordered: Array<{ config: StoredApiConfig; model: StoredModel; role: 'primary' | 'fallback' | 'auto' }> = [];
  const seenIds = new Set<string>();

  const pushIfEligible = (cfgId: string | null | undefined, role: 'primary' | 'fallback' | 'auto') => {
    if (!cfgId || seenIds.has(cfgId)) return;
    const found = eligible.find((e) => e.config.id === cfgId);
    if (found) {
      seenIds.add(cfgId);
      ordered.push({ ...found, role });
    }
  };

  if (overrideConfigId) {
    pushIfEligible(overrideConfigId, 'primary');
  } else if (assignment?.mode === 'manual') {
    pushIfEligible(assignment.primaryConfigId, 'primary');
    pushIfEligible(assignment.fallbackConfigId, 'fallback');
  } else {
    pushIfEligible(assignment?.primaryConfigId, 'primary');
    pushIfEligible(assignment?.fallbackConfigId, 'fallback');
    for (const item of eligible) {
      pushIfEligible(item.config.id, 'auto');
    }
  }

  return { requiredCapability: def.requiredCapability, candidates: ordered, rejected };
}

/**
 * Policy-Compliant Failover Decision Helper:
 * - Never retries permanent auth errors.
 * - Never rotates to another key under the SAME providerType to bypass quota/rate limits.
 */
export function filterPolicyCompliantFallbacks(
  failedConfig: StoredApiConfig,
  failureKind: FailureKind,
  remainingCandidates: Array<{ config: StoredApiConfig; model: StoredModel; role: 'primary' | 'fallback' | 'auto' }>
): Array<{ config: StoredApiConfig; model: StoredModel; role: 'primary' | 'fallback' | 'auto' }> {
  if (failureKind === 'quota_or_rate_limit') {
    // Strictly exclude other keys belonging to the same providerType so quota/rate limits are never circumvented
    return remainingCandidates.filter((c) => c.config.providerType !== failedConfig.providerType);
  }
  return remainingCandidates;
}

// ---------------------------------------------------------------------------
// 8. Register Express Routes under /api/providers/*
// ---------------------------------------------------------------------------
export function registerApiProviderRoutes(app: Express) {
  bootstrapServerGeminiIfAvailable();

  // Templates & Task Definitions
  app.get('/api/providers/meta', (_req: Request, res: Response) => {
    res.json({
      templates: PROVIDER_TEMPLATES,
      tasks: TASK_DEFINITIONS,
    });
  });

  // Full Dashboard State (configs masked, assignments, health rules, usage analytics, logs)
  app.get('/api/providers/state', (req: Request, res: Response) => {
    const userId = getUserId(req);
    const configs = Array.from(configsById.values())
      .filter((c) => c.userId === userId)
      .sort((a, b) => a.priority - b.priority)
      .map(sanitizeConfigForClient);

    const assignments = Array.from(getOrInitTaskAssignments(userId).values());
    const healthRules = getOrInitHealthRules(userId);
    const userUsage = usageLogs.filter((u) => u.userId === userId);
    const userHealth = healthLogs.filter((h) => h.userId === userId);
    const userAudit = auditLogs.filter((a) => a.userId === userId);

    const totalRequests = userUsage.length;
    const successfulRequests = userUsage.filter((u) => u.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const avgLatencyMs =
      totalRequests > 0
        ? Math.round(userUsage.reduce((s, u) => s + u.latencyMs, 0) / totalRequests)
        : null;

    const tokenSamples = userUsage.filter((u) => u.promptTokens !== null || u.completionTokens !== null);
    const totalTokens =
      tokenSamples.length > 0
        ? tokenSamples.reduce((s, u) => s + (u.promptTokens ?? 0) + (u.completionTokens ?? 0), 0)
        : null;

    const costSamples = userUsage.filter((u) => u.estimatedCostUsd !== null);
    const totalEstimatedCostUsd =
      costSamples.length > 0
        ? Number(costSamples.reduce((s, u) => s + (u.estimatedCostUsd ?? 0), 0).toFixed(4))
        : null;

    res.json({
      configs,
      taskAssignments: assignments,
      healthRules,
      metrics: {
        totalConfigurations: configs.length,
        activeConfigurations: configs.filter((c) => c.enabled && c.healthStatus !== 'Failed').length,
        failedConfigurations: configs.filter((c) => c.healthStatus === 'Failed' || c.authStatus === 'Invalid Key').length,
        totalRequests,
        successfulRequests,
        failedRequests,
        avgLatencyMs,
        totalTokens,
        totalEstimatedCostUsd,
      },
      usageLogs: userUsage.slice(0, 60),
      healthLogs: userHealth.slice(0, 60),
      auditLogs: userAudit.slice(0, 40),
    });
  });

  // Create Unlimited Provider Configuration
  app.post('/api/providers/configs', (req: Request, res: Response) => {
    const userId = getUserId(req);
    const body = req.body as {
      providerName?: string;
      providerType?: string;
      apiKey?: string;
      baseUrl?: string;
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
    };

    const providerType = (body.providerType || 'openai_compatible').trim();
    const tpl = PROVIDER_TEMPLATES.find((t) => t.providerType === providerType) ?? PROVIDER_TEMPLATES[13];
    const providerName = (body.providerName || `${tpl.displayName} Key`).trim();
    const baseUrl = (body.baseUrl || tpl.defaultBaseUrl).trim();

    const urlCheck = validateProviderBaseUrl(baseUrl, providerType);
    if (!urlCheck.valid || !urlCheck.normalizedUrl) {
      res.status(400).json({ error: urlCheck.error });
      return;
    }

    const rawKey = (body.apiKey || '').trim();
    if (tpl.requiresApiKey && !rawKey) {
      res.status(400).json({ error: `API key is required for ${tpl.displayName}.` });
      return;
    }

    const now = new Date().toISOString();
    const id = `cfg_${crypto.randomUUID().slice(0, 12)}`;
    const isDefault = Boolean(body.isDefault);
    if (isDefault) {
      for (const existing of configsById.values()) {
        if (existing.userId === userId) existing.isDefault = false;
      }
    }

    const models: StoredModel[] = tpl.sampleModels.map((m, idx) => ({
      id: `mdl_${id}_${idx}`,
      modelId: m.id,
      displayName: m.label,
      capabilities: m.capabilities,
      isManual: false,
      isDefault: idx === 0 && !body.customModelName,
    }));

    const customModel = (body.customModelName || '').trim();
    if (customModel && !models.some((m) => m.modelId === customModel)) {
      models.unshift({
        id: `mdl_${id}_custom`,
        modelId: customModel,
        displayName: customModel,
        capabilities:
          Array.isArray(body.manualCapabilities) && body.manualCapabilities.length > 0
            ? body.manualCapabilities
            : inferCapabilitiesFromModelId(customModel, tpl.defaultCapabilities),
        isManual: true,
        isDefault: true,
      });
    }

    const created: StoredApiConfig = {
      id,
      userId,
      providerName,
      providerType,
      protocol: tpl.protocol,
      baseUrl: urlCheck.normalizedUrl,
      apiVersion: (body.apiVersion || '').trim(),
      organizationId: (body.organizationId || '').trim(),
      customHeaders: body.customHeaders && typeof body.customHeaders === 'object' ? body.customHeaders : {},
      customModelName: customModel,
      defaultModel: customModel || models[0]?.modelId || '',
      description: (body.description || tpl.description).trim(),
      folder: (body.folder || 'Default').trim(),
      tags: Array.isArray(body.tags) ? body.tags.map((t) => t.trim()).filter(Boolean) : [],
      priority: Math.max(1, Number(body.priority) || 10),
      enabled: body.enabled !== false,
      isDefault,
      encryptedKey: rawKey ? encryptApiKey(rawKey, 1) : null,
      maskedKey: rawKey ? maskApiKey(rawKey) : 'No Key Required',
      keyFingerprint: rawKey ? fingerprintApiKey(rawKey) : 'none',
      keyVersion: 1,
      healthStatus: 'Untested',
      authStatus: rawKey ? 'Untested' : 'Not Required',
      consecutiveFailures: 0,
      cooldownUntil: null,
      lastErrorType: null,
      lastErrorMessage: null,
      lastLatencyMs: null,
      lastTestedAt: null,
      models,
      createdAt: now,
      updatedAt: now,
    };

    configsById.set(id, created);
    recordAudit(userId, 'CONFIG_CREATED', id, `Created ${providerName} (${providerType}) with AES-256-GCM encrypted secret.`);
    res.status(201).json({ config: sanitizeConfigForClient(created) });
  });

  // Update Configuration / Rotate Secret / Toggle Enabled / Set Priority / Manual Recovery
  app.put('/api/providers/configs/:id', (req: Request, res: Response) => {
    const userId = getUserId(req);
    const existing = configsById.get(req.params.id);
    if (!existing || existing.userId !== userId) {
      res.status(404).json({ error: 'Provider configuration not found.' });
      return;
    }

    const body = req.body as Partial<{
      providerName: string;
      baseUrl: string;
      apiKey: string;
      apiVersion: string;
      organizationId: string;
      customHeaders: Record<string, string>;
      defaultModel: string;
      description: string;
      folder: string;
      tags: string[];
      priority: number;
      enabled: boolean;
      isDefault: boolean;
      recoverHealth: boolean;
    }>;

    if (typeof body.baseUrl === 'string' && body.baseUrl.trim()) {
      const check = validateProviderBaseUrl(body.baseUrl, existing.providerType);
      if (!check.valid || !check.normalizedUrl) {
        res.status(400).json({ error: check.error });
        return;
      }
      existing.baseUrl = check.normalizedUrl;
    }

    if (typeof body.providerName === 'string' && body.providerName.trim()) existing.providerName = body.providerName.trim();
    if (typeof body.apiVersion === 'string') existing.apiVersion = body.apiVersion.trim();
    if (typeof body.organizationId === 'string') existing.organizationId = body.organizationId.trim();
    if (body.customHeaders && typeof body.customHeaders === 'object') existing.customHeaders = body.customHeaders;
    if (typeof body.defaultModel === 'string') existing.defaultModel = body.defaultModel.trim();
    if (typeof body.description === 'string') existing.description = body.description.trim();
    if (typeof body.folder === 'string') existing.folder = body.folder.trim();
    if (Array.isArray(body.tags)) existing.tags = body.tags.map((t) => t.trim()).filter(Boolean);
    if (typeof body.priority === 'number') existing.priority = Math.max(1, body.priority);
    if (typeof body.enabled === 'boolean') existing.enabled = body.enabled;

    if (body.isDefault) {
      for (const c of configsById.values()) {
        if (c.userId === userId) c.isDefault = false;
      }
      existing.isDefault = true;
    }

    if (typeof body.apiKey === 'string' && body.apiKey.trim()) {
      const newKey = body.apiKey.trim();
      existing.keyVersion += 1;
      existing.encryptedKey = encryptApiKey(newKey, existing.keyVersion);
      existing.maskedKey = maskApiKey(newKey);
      existing.keyFingerprint = fingerprintApiKey(newKey);
      existing.authStatus = 'Untested';
      existing.healthStatus = 'Untested';
      existing.consecutiveFailures = 0;
      existing.cooldownUntil = null;
      recordAudit(userId, 'SECRET_ROTATED', existing.id, `Rotated API key (v${existing.keyVersion}) for ${existing.providerName}.`);
    }

    if (body.recoverHealth) {
      existing.healthStatus = 'Untested';
      existing.consecutiveFailures = 0;
      existing.cooldownUntil = null;
      existing.lastErrorMessage = null;
      existing.lastErrorType = null;
      existing.enabled = true;
      recordAudit(userId, 'MANUAL_RECOVERY', existing.id, `Manually recovered ${existing.providerName} from cooldown/failure state.`);
    }

    existing.updatedAt = new Date().toISOString();
    res.json({ config: sanitizeConfigForClient(existing) });
  });

  // Delete Configuration
  app.delete('/api/providers/configs/:id', (req: Request, res: Response) => {
    const userId = getUserId(req);
    const existing = configsById.get(req.params.id);
    if (!existing || existing.userId !== userId) {
      res.status(404).json({ error: 'Provider configuration not found.' });
      return;
    }
    configsById.delete(existing.id);
    recordAudit(userId, 'CONFIG_DELETED', existing.id, `Deleted configuration ${existing.providerName}.`);
    res.json({ deleted: true, id: existing.id });
  });

  // Add Manual Model to Configuration
  app.post('/api/providers/configs/:id/models', (req: Request, res: Response) => {
    const userId = getUserId(req);
    const existing = configsById.get(req.params.id);
    if (!existing || existing.userId !== userId) {
      res.status(404).json({ error: 'Provider configuration not found.' });
      return;
    }
    const { modelId, displayName, capabilities, isDefault } = req.body as {
      modelId?: string;
      displayName?: string;
      capabilities?: ModelCapability[];
      isDefault?: boolean;
    };
    const cleanId = (modelId || '').trim();
    if (!cleanId) {
      res.status(400).json({ error: 'modelId is required.' });
      return;
    }
    const nextModel: StoredModel = {
      id: `mdl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      modelId: cleanId,
      displayName: (displayName || cleanId).trim(),
      capabilities: Array.isArray(capabilities) && capabilities.length > 0 ? capabilities : ['chat'],
      isManual: true,
      isDefault: Boolean(isDefault),
    };
    if (nextModel.isDefault) {
      existing.models.forEach((m) => (m.isDefault = false));
      existing.defaultModel = cleanId;
    }
    existing.models.push(nextModel);
    existing.updatedAt = new Date().toISOString();
    recordAudit(userId, 'MODEL_ADDED', existing.id, `Added manual model ${cleanId} with capabilities [${nextModel.capabilities.join(', ')}].`);
    res.status(201).json({ config: sanitizeConfigForClient(existing), model: nextModel });
  });

  // Safe Test Connection + Model Discovery
  app.post('/api/providers/configs/:id/test', async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const cfg = configsById.get(req.params.id);
    if (!cfg || cfg.userId !== userId) {
      res.status(404).json({ error: 'Provider configuration not found.' });
      return;
    }

    const rules = getOrInitHealthRules(userId);
    const result = await runAdapterConnectionTest(cfg);
    const now = new Date().toISOString();

    cfg.lastLatencyMs = result.latencyMs;
    cfg.lastTestedAt = now;

    if (result.ok) {
      cfg.healthStatus = 'Healthy';
      cfg.authStatus = cfg.encryptedKey ? 'Verified' : 'Not Required';
      cfg.consecutiveFailures = 0;
      cfg.cooldownUntil = null;
      cfg.lastErrorType = null;
      cfg.lastErrorMessage = null;
      // Merge discovered models while keeping user manual models
      const manualModels = cfg.models.filter((m) => m.isManual);
      if (result.discoveredModels.length > 0) {
        const merged = [...manualModels];
        for (const dm of result.discoveredModels) {
          if (!merged.some((m) => m.modelId === dm.modelId)) merged.push(dm);
        }
        cfg.models = merged;
        if (!cfg.defaultModel && merged[0]) cfg.defaultModel = merged[0].modelId;
      }
    } else {
      const classified = classifyProviderError(result.statusCode, result.errorMessage || '');
      cfg.consecutiveFailures += 1;
      cfg.lastErrorType = classified.kind;
      cfg.lastErrorMessage = result.errorMessage;
      if (classified.kind === 'auth_error') {
        cfg.authStatus = 'Invalid Key';
        cfg.healthStatus = 'Failed';
        if (rules.autoDisableOnAuthError) cfg.enabled = false;
      } else if (classified.kind === 'quota_or_rate_limit') {
        cfg.healthStatus = 'Cooldown';
        cfg.cooldownUntil = new Date(Date.now() + rules.cooldownSeconds * 1000).toISOString();
      } else {
        cfg.healthStatus = cfg.consecutiveFailures >= rules.maxConsecutiveFailuresBeforeDisable ? 'Failed' : 'Degraded';
        if (cfg.consecutiveFailures >= rules.maxConsecutiveFailuresBeforeDisable) {
          cfg.enabled = false;
        }
      }
    }

    const healthEntry: HealthCheckLogEntry = {
      id: `hc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId,
      configId: cfg.id,
      providerName: cfg.providerName,
      status: result.ok ? 'Healthy' : cfg.healthStatus === 'Degraded' ? 'Degraded' : 'Failed',
      authStatus: cfg.authStatus,
      latencyMs: result.latencyMs,
      modelsDiscovered: result.discoveredModels.length,
      providerResponse: result.providerResponse,
      errorMessage: result.errorMessage,
      timestamp: now,
    };
    healthLogs.unshift(healthEntry);
    if (healthLogs.length > 200) healthLogs.pop();

    cfg.updatedAt = now;
    recordAudit(userId, 'CONNECTION_TESTED', cfg.id, `${cfg.providerName}: ${result.providerResponse}`);
    res.json({
      config: sanitizeConfigForClient(cfg),
      testResult: healthEntry,
    });
  });

  // Update Task-to-Provider Assignment (with strict capability validation)
  app.put('/api/providers/tasks/:taskKey', (req: Request, res: Response) => {
    const userId = getUserId(req);
    const taskKey = req.params.taskKey as TaskKey;
    const def = TASK_DEFINITIONS.find((t) => t.taskKey === taskKey);
    if (!def) {
      res.status(400).json({ error: `Unsupported taskKey: ${taskKey}` });
      return;
    }

    const body = req.body as Partial<TaskAssignment>;
    if (body.primaryConfigId) {
      const cfg = configsById.get(body.primaryConfigId);
      if (!cfg || cfg.userId !== userId) {
        res.status(404).json({ error: 'Selected primary provider configuration not found.' });
        return;
      }
      const mdl = cfg.models.find((m) => m.modelId === (body.primaryModelId || cfg.defaultModel)) ?? cfg.models[0];
      const capCheck = validateModelCapabilityForTask(taskKey, mdl, cfg);
      if (!capCheck.ok) {
        res.status(422).json({ error: capCheck.error });
        return;
      }
    }
    if (body.fallbackConfigId) {
      const fb = configsById.get(body.fallbackConfigId);
      if (!fb || fb.userId !== userId) {
        res.status(404).json({ error: 'Selected fallback provider configuration not found.' });
        return;
      }
      const mdl = fb.models.find((m) => m.modelId === (body.fallbackModelId || fb.defaultModel)) ?? fb.models[0];
      const capCheck = validateModelCapabilityForTask(taskKey, mdl, fb);
      if (!capCheck.ok) {
        res.status(422).json({ error: `Fallback invalid: ${capCheck.error}` });
        return;
      }
    }

    const map = getOrInitTaskAssignments(userId);
    const existing = map.get(taskKey)!;
    const updated: TaskAssignment = {
      ...existing,
      mode: body.mode === 'manual' ? 'manual' : 'automatic',
      primaryConfigId: body.primaryConfigId !== undefined ? body.primaryConfigId : existing.primaryConfigId,
      primaryModelId: body.primaryModelId !== undefined ? body.primaryModelId : existing.primaryModelId,
      fallbackConfigId: body.fallbackConfigId !== undefined ? body.fallbackConfigId : existing.fallbackConfigId,
      fallbackModelId: body.fallbackModelId !== undefined ? body.fallbackModelId : existing.fallbackModelId,
      updatedAt: new Date().toISOString(),
    };
    map.set(taskKey, updated);
    recordAudit(userId, 'TASK_ASSIGNED', taskKey, `Assigned ${taskKey} (${updated.mode}) -> primary ${updated.primaryConfigId || 'auto'}.`);
    res.json({ assignment: updated });
  });

  // Test Task Routing + Capability Enforcement + Policy-Compliant Failover
  app.post('/api/providers/tasks/:taskKey/test', async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const taskKey = req.params.taskKey as TaskKey;
    const def = TASK_DEFINITIONS.find((t) => t.taskKey === taskKey);
    if (!def) {
      res.status(400).json({ error: `Unsupported taskKey: ${taskKey}` });
      return;
    }
    const { overrideConfigId } = (req.body || {}) as { overrideConfigId?: string };
    const routing = selectCandidatesForTask(userId, taskKey, overrideConfigId);

    if (routing.candidates.length === 0) {
      res.status(422).json({
        ok: false,
        taskKey,
        requiredCapability: routing.requiredCapability,
        error: `No enabled compatible provider found for ${def.label} (requires "${def.requiredCapability}").`,
        rejected: routing.rejected,
      });
      return;
    }

    const attempts: Array<{
      configId: string;
      providerName: string;
      modelId: string;
      ok: boolean;
      latencyMs: number;
      errorType: string | null;
      message: string;
    }> = [];

    let queue = [...routing.candidates];
    const visited = new Set<string>(); // Prevents infinite retry loops
    let chosen: { config: StoredApiConfig; model: StoredModel; latencyMs: number; fallbackUsed: boolean } | null = null;

    while (queue.length > 0 && attempts.length < 5) {
      const current = queue.shift()!;
      if (visited.has(current.config.id)) continue;
      visited.add(current.config.id);

      const cap = validateModelCapabilityForTask(taskKey, current.model, current.config);
      if (!cap.ok) {
        attempts.push({
          configId: current.config.id,
          providerName: current.config.providerName,
          modelId: current.model.modelId,
          ok: false,
          latencyMs: 0,
          errorType: 'capability_mismatch',
          message: cap.error || 'Capability mismatch',
        });
        continue;
      }

      const probe = await runAdapterConnectionTest(current.config);
      const errInfo = probe.ok ? null : classifyProviderError(probe.statusCode, probe.errorMessage || '');
      attempts.push({
        configId: current.config.id,
        providerName: current.config.providerName,
        modelId: current.model.modelId,
        ok: probe.ok,
        latencyMs: probe.latencyMs,
        errorType: errInfo?.kind ?? null,
        message: probe.ok ? probe.providerResponse : probe.errorMessage || 'Provider failed',
      });

      usageLogs.unshift({
        id: `usg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId,
        configId: current.config.id,
        providerName: current.config.providerName,
        providerType: current.config.providerType,
        taskKey,
        modelId: current.model.modelId,
        success: probe.ok,
        errorType: errInfo?.kind ?? null,
        errorMessage: probe.errorMessage,
        latencyMs: probe.latencyMs,
        promptTokens: null, // Safe probe does not report generation tokens
        completionTokens: null,
        estimatedCostUsd: null,
        fallbackUsed: attempts.length > 1,
        timestamp: new Date().toISOString(),
      });
      if (usageLogs.length > 500) usageLogs.pop();

      if (probe.ok) {
        chosen = {
          config: current.config,
          model: current.model,
          latencyMs: probe.latencyMs,
          fallbackUsed: attempts.length > 1,
        };
        break;
      }

      if (errInfo) {
        queue = filterPolicyCompliantFallbacks(current.config, errInfo.kind, queue);
      }
    }

    if (!chosen) {
      res.status(502).json({
        ok: false,
        taskKey,
        requiredCapability: routing.requiredCapability,
        error: 'All compatible candidate providers failed health verification.',
        attempts,
      });
      return;
    }

    res.json({
      ok: true,
      taskKey,
      requiredCapability: routing.requiredCapability,
      selectedProvider: {
        configId: chosen.config.id,
        providerName: chosen.config.providerName,
        providerType: chosen.config.providerType,
        modelId: chosen.model.modelId,
        latencyMs: chosen.latencyMs,
        fallbackUsed: chosen.fallbackUsed,
      },
      attempts,
    });
  });

  // Update Health Monitoring & Failover Rules
  app.put('/api/providers/health-rules', (req: Request, res: Response) => {
    const userId = getUserId(req);
    const current = getOrInitHealthRules(userId);
    const body = req.body as Partial<HealthRuleConfig>;
    const updated: HealthRuleConfig = {
      autoDisableOnAuthError:
        typeof body.autoDisableOnAuthError === 'boolean' ? body.autoDisableOnAuthError : current.autoDisableOnAuthError,
      maxConsecutiveFailuresBeforeDisable: Math.max(
        1,
        Math.min(10, Number(body.maxConsecutiveFailuresBeforeDisable) || current.maxConsecutiveFailuresBeforeDisable)
      ),
      cooldownSeconds: Math.max(15, Math.min(3600, Number(body.cooldownSeconds) || current.cooldownSeconds)),
      maxRetriesPerRequest: Math.max(0, Math.min(3, Number(body.maxRetriesPerRequest) ?? current.maxRetriesPerRequest)),
      forbidQuotaBypassKeyRotation: true, // Immutable policy safeguard
    };
    healthRulesByUser.set(userId, updated);
    recordAudit(userId, 'HEALTH_RULES_UPDATED', userId, `Updated failover rules: cooldown=${updated.cooldownSeconds}s, maxRetries=${updated.maxRetriesPerRequest}.`);
    res.json({ healthRules: updated });
  });

  // Secret-Free Configuration Export (NEVER exports raw or encrypted API keys)
  app.get('/api/providers/export-config', (req: Request, res: Response) => {
    const userId = getUserId(req);
    const configs = Array.from(configsById.values())
      .filter((c) => c.userId === userId)
      .map((c) => ({
        providerName: c.providerName,
        providerType: c.providerType,
        baseUrl: c.baseUrl,
        apiVersion: c.apiVersion,
        organizationId: c.organizationId,
        defaultModel: c.defaultModel,
        description: c.description,
        folder: c.folder,
        tags: c.tags,
        priority: c.priority,
        enabled: c.enabled,
        isDefault: c.isDefault,
        models: c.models,
        secretIncluded: false,
      }));
    const taskAssignments = Array.from(getOrInitTaskAssignments(userId).values());
    const healthRules = getOrInitHealthRules(userId);

    res.json({
      schemaVersion: 'kdp-studio-api-config-v1',
      exportedAt: new Date().toISOString(),
      securityNote: 'Raw API secrets are intentionally omitted from export payloads. Re-enter keys securely after import.',
      configs,
      taskAssignments,
      healthRules,
    });
  });

  // Secret-Free Configuration Import
  app.post('/api/providers/import-config', (req: Request, res: Response) => {
    const userId = getUserId(req);
    const body = req.body as {
      configs?: Array<{
        providerName: string;
        providerType: string;
        baseUrl: string;
        defaultModel?: string;
        description?: string;
        folder?: string;
        tags?: string[];
        priority?: number;
        models?: StoredModel[];
      }>;
      healthRules?: Partial<HealthRuleConfig>;
    };

    const imported: Array<Omit<StoredApiConfig, 'encryptedKey'>> = [];
    const skipped: Array<{ providerName: string; reason: string }> = [];

    for (const item of body.configs || []) {
      const check = validateProviderBaseUrl(item.baseUrl || '', item.providerType || 'openai_compatible');
      if (!check.valid || !check.normalizedUrl) {
        skipped.push({ providerName: item.providerName || 'Unnamed', reason: check.error || 'Invalid URL' });
        continue;
      }
      const tpl = PROVIDER_TEMPLATES.find((t) => t.providerType === item.providerType) ?? PROVIDER_TEMPLATES[13];
      const now = new Date().toISOString();
      const id = `cfg_imp_${crypto.randomUUID().slice(0, 10)}`;
      const rec: StoredApiConfig = {
        id,
        userId,
        providerName: item.providerName || tpl.displayName,
        providerType: tpl.providerType,
        protocol: tpl.protocol,
        baseUrl: check.normalizedUrl,
        apiVersion: '',
        organizationId: '',
        customHeaders: {},
        customModelName: item.defaultModel || '',
        defaultModel: item.defaultModel || tpl.sampleModels[0]?.id || '',
        description: item.description || tpl.description,
        folder: item.folder || 'Imported',
        tags: Array.isArray(item.tags) ? item.tags : ['imported'],
        priority: Math.max(1, Number(item.priority) || 20),
        enabled: false, // Disabled until user securely enters API key
        isDefault: false,
        encryptedKey: null,
        maskedKey: 'Secret Required (Imported)',
        keyFingerprint: 'none',
        keyVersion: 0,
        healthStatus: 'Untested',
        authStatus: tpl.requiresApiKey ? 'Untested' : 'Not Required',
        consecutiveFailures: 0,
        cooldownUntil: null,
        lastErrorType: null,
        lastErrorMessage: null,
        lastLatencyMs: null,
        lastTestedAt: null,
        models: Array.isArray(item.models) ? item.models : [],
        createdAt: now,
        updatedAt: now,
      };
      configsById.set(id, rec);
      imported.push(sanitizeConfigForClient(rec));
    }

    recordAudit(userId, 'CONFIG_IMPORTED', userId, `Imported ${imported.length} secret-free provider templates (${skipped.length} skipped).`);
    res.json({ importedCount: imported.length, skipped, imported });
  });
}
