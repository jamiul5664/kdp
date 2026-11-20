import * as React from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Cpu,
  Download,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  Layers,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Search,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  ALL_CAPABILITIES,
  addManualModelToConfig,
  createProviderConfig,
  deleteProviderConfig,
  exportSecretFreeConfig,
  fetchProviderMeta,
  fetchProviderState,
  importSecretFreeConfig,
  testProviderConnection,
  testTaskRouting,
  updateHealthRules,
  updateProviderConfig,
  updateTaskAssignment,
  type HealthRuleConfig,
  type ModelCapability,
  type ProviderStateResponse,
  type ProviderTemplate,
  type PublicApiConfig,
  type TaskAssignment,
  type TaskDefinition,
  type TaskKey,
  type TestTaskResponse,
} from '../../services/providerService';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';

type SectionId =
  | 'overview'
  | 'providers'
  | 'keys'
  | 'models'
  | 'tasks'
  | 'routing'
  | 'usage'
  | 'logs';

const NAV_ITEMS: Array<{ id: SectionId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'providers', label: 'Providers', icon: Server },
  { id: 'keys', label: 'API Keys', icon: KeyRound },
  { id: 'models', label: 'Models', icon: Cpu },
  { id: 'tasks', label: 'Task Assignments', icon: Layers },
  { id: 'routing', label: 'Routing & Health', icon: SlidersHorizontal },
  { id: 'usage', label: 'Usage & Analytics', icon: BarChart3 },
  { id: 'logs', label: 'Connection Logs', icon: ScrollText },
];

function healthStatusColor(status: PublicApiConfig['healthStatus']): string {
  switch (status) {
    case 'Healthy':
      return 'text-emerald-500';
    case 'Degraded':
    case 'Cooldown':
      return 'text-amber-500';
    case 'Failed':
      return 'text-rose-500';
    default:
      return 'text-secondary';
  }
}

function formatShortTime(iso: string | null): string {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function AiProvidersManager() {
  const [section, setSection] = React.useState<SectionId>('overview');
  const [templates, setTemplates] = React.useState<ProviderTemplate[]>([]);
  const [tasks, setTasks] = React.useState<TaskDefinition[]>([]);
  const [state, setState] = React.useState<ProviderStateResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [errorBanner, setErrorBanner] = React.useState<string | null>(null);
  const [noticeBanner, setNoticeBanner] = React.useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState('');
  const [folderFilter, setFolderFilter] = React.useState('All');
  const [typeFilter, setTypeFilter] = React.useState('All');

  // Interactive states
  const [testingConfigId, setTestingConfigId] = React.useState<string | null>(null);
  const [testingTaskKey, setTestingTaskKey] = React.useState<TaskKey | null>(null);
  const [taskTestResults, setTaskTestResults] = React.useState<Partial<Record<TaskKey, TestTaskResponse>>>({});

  // Add Provider Modal
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [formType, setFormType] = React.useState('google_gemini');
  const [formName, setFormName] = React.useState('');
  const [formKey, setFormKey] = React.useState('');
  const [formBaseUrl, setFormBaseUrl] = React.useState('https://generativelanguage.googleapis.com/v1beta');
  const [formApiVersion, setFormApiVersion] = React.useState('');
  const [formOrgId, setFormOrgId] = React.useState('');
  const [formCustomHeaders, setFormCustomHeaders] = React.useState('');
  const [formCustomModel, setFormCustomModel] = React.useState('');
  const [formDescription, setFormDescription] = React.useState('');
  const [formFolder, setFormFolder] = React.useState('Production');
  const [formTags, setFormTags] = React.useState('');
  const [formPriority, setFormPriority] = React.useState(10);
  const [formEnabled, setFormEnabled] = React.useState(true);
  const [formDefault, setFormDefault] = React.useState(false);
  const [formCapabilities, setFormCapabilities] = React.useState<ModelCapability[]>(['chat', 'writing']);
  const [submittingAdd, setSubmittingAdd] = React.useState(false);

  // Edit / Rotate Key modal
  const [editingConfig, setEditingConfig] = React.useState<PublicApiConfig | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editBaseUrl, setEditBaseUrl] = React.useState('');
  const [editRotateKey, setEditRotateKey] = React.useState('');
  const [editFolder, setEditFolder] = React.useState('');
  const [editTags, setEditTags] = React.useState('');
  const [editPriority, setEditPriority] = React.useState(10);

  // Add Manual Model form
  const [modelTargetConfigId, setModelTargetConfigId] = React.useState('');
  const [manualModelId, setManualModelId] = React.useState('');
  const [manualModelLabel, setManualModelLabel] = React.useState('');
  const [manualModelCaps, setManualModelCaps] = React.useState<ModelCapability[]>(['chat', 'writing']);
  const [manualModelDefault, setManualModelDefault] = React.useState(false);

  // Health Rules form
  const [rulesDraft, setRulesDraft] = React.useState<HealthRuleConfig | null>(null);

  // Import JSON input
  const [importJsonText, setImportJsonText] = React.useState('');

  const showNotice = (msg: string) => {
    setNoticeBanner(msg);
    setErrorBanner(null);
    window.setTimeout(() => setNoticeBanner(null), 4000);
  };

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    try {
      const [metaRes, stateRes] = await Promise.all([fetchProviderMeta(), fetchProviderState()]);
      setTemplates(metaRes.templates);
      setTasks(metaRes.tasks);
      setState(stateRes);
      setRulesDraft(stateRes.healthRules);
      if (stateRes.configs.length > 0 && !modelTargetConfigId) {
        setModelTargetConfigId(stateRes.configs[0].id);
      }
      setErrorBanner(null);
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to load AI provider manager.');
    } finally {
      setLoading(false);
    }
  }, [modelTargetConfigId]);

  React.useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const selectedTemplate = React.useMemo(
    () => templates.find((t) => t.providerType === formType) ?? templates[0],
    [templates, formType]
  );

  const handleSelectTemplate = (nextType: string) => {
    setFormType(nextType);
    const tpl = templates.find((t) => t.providerType === nextType);
    if (tpl) {
      setFormBaseUrl(tpl.defaultBaseUrl);
      setFormDescription(tpl.description);
      setFormCapabilities(tpl.defaultCapabilities.slice(0, 4));
      if (!formName.trim()) {
        setFormName(`${tpl.displayName} Key ${(state?.configs.filter((c) => c.providerType === nextType).length ?? 0) + 1}`);
      }
    }
  };

  const openAddModal = (presetType?: string) => {
    const targetType = presetType || 'google_gemini';
    const tpl = templates.find((t) => t.providerType === targetType) ?? templates[0];
    const countForType = (state?.configs.filter((c) => c.providerType === targetType).length ?? 0) + 1;
    setFormType(targetType);
    setFormName(tpl ? `${tpl.displayName} Key ${countForType}` : 'Custom Provider Key');
    setFormKey('');
    setFormBaseUrl(tpl?.defaultBaseUrl || 'https://api.example.com/v1');
    setFormApiVersion('');
    setFormOrgId('');
    setFormCustomHeaders('');
    setFormCustomModel('');
    setFormDescription(tpl?.description || '');
    setFormFolder('Production');
    setFormTags(targetType);
    setFormPriority((state?.configs.length ?? 0) * 5 + 10);
    setFormEnabled(true);
    setFormDefault(false);
    setFormCapabilities(tpl?.defaultCapabilities.slice(0, 4) || ['chat']);
    setShowAddModal(true);
  };

  const handleCreateProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingAdd(true);
    setErrorBanner(null);
    try {
      let parsedHeaders: Record<string, string> | undefined;
      if (formCustomHeaders.trim()) {
        parsedHeaders = JSON.parse(formCustomHeaders.trim()) as Record<string, string>;
      }
      await createProviderConfig({
        providerName: formName.trim(),
        providerType: formType,
        apiKey: formKey.trim() || undefined,
        baseUrl: formBaseUrl.trim(),
        apiVersion: formApiVersion.trim() || undefined,
        organizationId: formOrgId.trim() || undefined,
        customHeaders: parsedHeaders,
        customModelName: formCustomModel.trim() || undefined,
        description: formDescription.trim() || undefined,
        folder: formFolder.trim() || 'Default',
        tags: formTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        priority: Number(formPriority) || 10,
        enabled: formEnabled,
        isDefault: formDefault,
        manualCapabilities: formCapabilities,
      });
      setFormKey(''); // Clear secret immediately from component memory
      setShowAddModal(false);
      await loadAll();
      showNotice(`Added "${formName.trim()}" with AES-256-GCM encrypted key storage.`);
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to create provider configuration.');
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleTestConfig = async (cfg: PublicApiConfig) => {
    setTestingConfigId(cfg.id);
    setErrorBanner(null);
    try {
      const res = await testProviderConnection(cfg.id);
      await loadAll();
      if (res.testResult.status === 'Healthy') {
        showNotice(
          `${cfg.providerName}: ${res.testResult.providerResponse} (${res.testResult.latencyMs} ms)`
        );
      } else {
        setErrorBanner(
          `${cfg.providerName} test failed (${res.testResult.authStatus}): ${res.testResult.errorMessage || res.testResult.providerResponse}`
        );
      }
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Connection test failed.');
    } finally {
      setTestingConfigId(null);
    }
  };

  const handleToggleEnabled = async (cfg: PublicApiConfig) => {
    try {
      await updateProviderConfig(cfg.id, { enabled: !cfg.enabled });
      await loadAll();
      showNotice(`${cfg.providerName} ${cfg.enabled ? 'disabled' : 'enabled'}.`);
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to toggle configuration.');
    }
  };

  const handleSetDefault = async (cfg: PublicApiConfig) => {
    try {
      await updateProviderConfig(cfg.id, { isDefault: true });
      await loadAll();
      showNotice(`Set "${cfg.providerName}" as workspace default provider.`);
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to set default provider.');
    }
  };

  const handleRecoverConfig = async (cfg: PublicApiConfig) => {
    try {
      await updateProviderConfig(cfg.id, { recoverHealth: true });
      await loadAll();
      showNotice(`Recovered "${cfg.providerName}" from cooldown/failure state. Re-test to verify.`);
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to recover provider.');
    }
  };

  const handleDeleteConfig = async (cfg: PublicApiConfig) => {
    try {
      await deleteProviderConfig(cfg.id);
      await loadAll();
      showNotice(`Deleted "${cfg.providerName}".`);
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to delete configuration.');
    }
  };

  const openEditConfig = (cfg: PublicApiConfig) => {
    setEditingConfig(cfg);
    setEditName(cfg.providerName);
    setEditBaseUrl(cfg.baseUrl);
    setEditRotateKey('');
    setEditFolder(cfg.folder);
    setEditTags(cfg.tags.join(', '));
    setEditPriority(cfg.priority);
  };

  const handleSaveEditConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConfig) return;
    try {
      await updateProviderConfig(editingConfig.id, {
        providerName: editName.trim(),
        baseUrl: editBaseUrl.trim(),
        apiKey: editRotateKey.trim() || undefined,
        folder: editFolder.trim() || 'Default',
        tags: editTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        priority: Number(editPriority) || 10,
      });
      setEditRotateKey('');
      setEditingConfig(null);
      await loadAll();
      showNotice(
        editRotateKey.trim()
          ? `Updated "${editName.trim()}" and securely rotated API key.`
          : `Updated "${editName.trim()}".`
      );
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to save changes.');
    }
  };

  const handleAddManualModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelTargetConfigId || !manualModelId.trim()) return;
    try {
      await addManualModelToConfig(modelTargetConfigId, {
        modelId: manualModelId.trim(),
        displayName: manualModelLabel.trim() || manualModelId.trim(),
        capabilities: manualModelCaps.length > 0 ? manualModelCaps : ['chat'],
        isDefault: manualModelDefault,
      });
      setManualModelId('');
      setManualModelLabel('');
      setManualModelDefault(false);
      await loadAll();
      showNotice(`Added manual model "${manualModelId.trim()}".`);
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to add model.');
    }
  };

  const handleUpdateTask = async (taskKey: TaskKey, patch: Partial<TaskAssignment>) => {
    setErrorBanner(null);
    try {
      await updateTaskAssignment(taskKey, patch);
      await loadAll();
      showNotice(`Saved task assignment for ${taskKey.replace(/_/g, ' ')}.`);
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Capability validation rejected assignment.');
    }
  };

  const handleTestTask = async (taskKey: TaskKey) => {
    setTestingTaskKey(taskKey);
    setErrorBanner(null);
    try {
      const res = await testTaskRouting(taskKey);
      setTaskTestResults((prev) => ({ ...prev, [taskKey]: res }));
      await loadAll();
      if (res.ok && res.selectedProvider) {
        showNotice(
          `Task verified via ${res.selectedProvider.providerName} (${res.selectedProvider.modelId}) in ${res.selectedProvider.latencyMs} ms.`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Task routing test failed.';
      setTaskTestResults((prev) => ({
        ...prev,
        [taskKey]: { ok: false, taskKey, requiredCapability: 'chat', error: msg },
      }));
      setErrorBanner(msg);
    } finally {
      setTestingTaskKey(null);
    }
  };

  const handleSaveHealthRules = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rulesDraft) return;
    try {
      await updateHealthRules(rulesDraft);
      await loadAll();
      showNotice('Updated health monitoring and failover policy rules.');
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to update health rules.');
    }
  };

  const handleExportConfig = async () => {
    try {
      const data = await exportSecretFreeConfig();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kdp-studio-api-config-secret-free-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showNotice('Exported secret-free provider and task configuration JSON.');
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Export failed.');
    }
  };

  const handleImportConfig = async () => {
    if (!importJsonText.trim()) return;
    try {
      const parsed = JSON.parse(importJsonText.trim()) as Record<string, unknown>;
      const res = await importSecretFreeConfig(parsed);
      setImportJsonText('');
      await loadAll();
      showNotice(
        `Imported ${res.importedCount} provider template(s) (disabled until API keys are entered). ${res.skipped.length} skipped.`
      );
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Invalid JSON or SSRF-blocked import URL.');
    }
  };

  const configs = state?.configs ?? [];
  const folders = React.useMemo(
    () => ['All', ...Array.from(new Set(configs.map((c) => c.folder).filter(Boolean)))],
    [configs]
  );
  const providerTypesPresent = React.useMemo(
    () => ['All', ...Array.from(new Set(configs.map((c) => c.providerType)))],
    [configs]
  );

  const filteredConfigs = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return configs.filter((c) => {
      if (folderFilter !== 'All' && c.folder !== folderFilter) return false;
      if (typeFilter !== 'All' && c.providerType !== typeFilter) return false;
      if (!q) return true;
      return (
        c.providerName.toLowerCase().includes(q) ||
        c.providerType.toLowerCase().includes(q) ||
        c.baseUrl.toLowerCase().includes(q) ||
        c.folder.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)) ||
        c.models.some((m) => m.modelId.toLowerCase().includes(q))
      );
    });
  }, [configs, folderFilter, typeFilter, searchQuery]);

  // Group configs by provider type for API Keys multi-key view
  const groupedByProvider = React.useMemo(() => {
    const map = new Map<string, PublicApiConfig[]>();
    for (const cfg of filteredConfigs) {
      const list = map.get(cfg.providerType) ?? [];
      list.push(cfg);
      map.set(cfg.providerType, list);
    }
    return Array.from(map.entries());
  }, [filteredConfigs]);

  // Provider-wise usage breakdown
  const providerUsageSummary = React.useMemo(() => {
    const logs = state?.usageLogs ?? [];
    const map = new Map<
      string,
      { providerName: string; total: number; success: number; failed: number; avgLatencyMs: number }
    >();
    for (const log of logs) {
      const cur = map.get(log.configId) ?? {
        providerName: log.providerName,
        total: 0,
        success: 0,
        failed: 0,
        avgLatencyMs: 0,
      };
      cur.total += 1;
      if (log.success) cur.success += 1;
      else cur.failed += 1;
      cur.avgLatencyMs += log.latencyMs;
      map.set(log.configId, cur);
    }
    return Array.from(map.values()).map((row) => ({
      ...row,
      avgLatencyMs: row.total > 0 ? Math.round(row.avgLatencyMs / row.total) : 0,
    }));
  }, [state?.usageLogs]);

  // Daily chart bars from actual usageLogs
  const dailySeries = React.useMemo(() => {
    const logs = state?.usageLogs ?? [];
    const byDay = new Map<string, { day: string; ok: number; fail: number }>();
    for (const log of logs) {
      const day = log.timestamp.slice(0, 10);
      const cur = byDay.get(day) ?? { day, ok: 0, fail: 0 };
      if (log.success) cur.ok += 1;
      else cur.fail += 1;
      byDay.set(day, cur);
    }
    return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day)).slice(-10);
  }, [state?.usageLogs]);

  const metrics = state?.metrics;

  return (
    <div className="space-y-6">
      {/* Header action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div className="space-y-1">
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
            AI Providers &amp; API Manager
          </h2>
          <p className="text-sm text-secondary">
            Manage unlimited API providers, encrypted keys, model capabilities, 9-task agent routing, and policy-compliant failover.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <Button variant="secondary" size="sm" onClick={() => void loadAll()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => openAddModal()}>
            <Plus className="h-3.5 w-3.5" />
            Add Provider
          </Button>
        </div>
      </div>

      {/* Feedback banners */}
      {errorBanner && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button type="button" onClick={() => setErrorBanner(null)} className="cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {noticeBanner && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{noticeBanner}</span>
          </div>
          <button type="button" onClick={() => setNoticeBanner(null)} className="cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Split Workspace: Internal Sidebar + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-[224px_minmax(0,1fr)] gap-6 items-start">
        {/* Internal Sidebar Navigation */}
        <nav
          aria-label="AI Provider Manager Sections"
          className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0 lg:border-r lg:border-border-subtle lg:pr-4"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-accent text-white'
                    : 'text-secondary hover:text-foreground hover:bg-surface-hover'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Active Section Viewport */}
        <div className="min-w-0 space-y-6">
          {/* ==================== 1. OVERVIEW ==================== */}
          {section === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-border-subtle bg-surface p-4 space-y-1">
                  <p className="text-xs text-secondary">Total Configurations</p>
                  <p className="font-mono-tabular text-2xl font-semibold text-foreground">
                    {metrics?.totalConfigurations ?? 0}
                  </p>
                  <p className="text-xs text-muted">
                    {metrics?.activeConfigurations ?? 0} active · {metrics?.failedConfigurations ?? 0} failed
                  </p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface p-4 space-y-1">
                  <p className="text-xs text-secondary">Requests Executed</p>
                  <p className="font-mono-tabular text-2xl font-semibold text-foreground">
                    {metrics?.totalRequests ?? 0}
                  </p>
                  <p className="text-xs text-muted">
                    {metrics?.successfulRequests ?? 0} ok · {metrics?.failedRequests ?? 0} failed
                  </p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface p-4 space-y-1">
                  <p className="text-xs text-secondary">Average Latency</p>
                  <p className="font-mono-tabular text-2xl font-semibold text-foreground">
                    {metrics?.avgLatencyMs !== null && metrics?.avgLatencyMs !== undefined
                      ? `${metrics.avgLatencyMs} ms`
                      : 'Unavailable'}
                  </p>
                  <p className="text-xs text-muted">Measured from live tests &amp; calls</p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface p-4 space-y-1">
                  <p className="text-xs text-secondary">Tokens &amp; Est. Cost</p>
                  <p className="font-mono-tabular text-2xl font-semibold text-foreground">
                    {metrics?.totalEstimatedCostUsd !== null && metrics?.totalEstimatedCostUsd !== undefined
                      ? `$${metrics.totalEstimatedCostUsd.toFixed(4)}`
                      : 'Unavailable'}
                  </p>
                  <p className="text-xs text-muted">
                    Tokens:{' '}
                    <span className="font-mono-tabular">
                      {metrics?.totalTokens !== null && metrics?.totalTokens !== undefined
                        ? metrics.totalTokens.toLocaleString()
                        : 'Unavailable'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border-subtle bg-surface p-5 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-accent" />
                    <h3 className="font-display text-sm font-semibold text-foreground">
                      Security &amp; Policy Safeguards
                    </h3>
                  </div>
                  <span className="text-xs text-secondary">AES-256-GCM at rest · Masked display only</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-secondary pt-1">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Zero Browser Secret Exposure</p>
                    <p>
                      API keys are encrypted server-side and never written to browser storage or returned in full to the frontend.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Strict Capability Validation</p>
                    <p>
                      Image generation tasks are blocked from text-only models; PDF Quality Analysis requires verified vision support.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Policy-Compliant Failover</p>
                    <p>
                      Failover routes only to legitimately available backup providers and never rotates same-provider keys to bypass quotas.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Template Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    Supported Provider Templates ({templates.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSection('providers')}
                    className="text-xs text-accent hover:underline cursor-pointer"
                  >
                    Manage all configured providers
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {templates.map((tpl) => {
                    const count = configs.filter((c) => c.providerType === tpl.providerType).length;
                    return (
                      <div
                        key={tpl.providerType}
                        className="rounded-xl border border-border-subtle bg-surface p-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{tpl.displayName}</p>
                          <p className="text-xs text-muted truncate">
                            {count} configured · {tpl.supportsModelDiscovery ? 'Discovery supported' : 'Manual models'}
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openAddModal(tpl.providerType)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ==================== 2. PROVIDERS ==================== */}
          {section === 'providers' && (
            <div className="space-y-4">
              {/* Search & Filter Toolbar */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search provider name, endpoint, tag, or model..."
                    className="pl-9"
                  />
                </div>
                <Select value={folderFilter} onChange={(e) => setFolderFilter(e.target.value)} className="sm:w-40">
                  {folders.map((f) => (
                    <option key={f} value={f}>
                      Folder: {f}
                    </option>
                  ))}
                </Select>
                <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="sm:w-44">
                  {providerTypesPresent.map((t) => (
                    <option key={t} value={t}>
                      Type: {t}
                    </option>
                  ))}
                </Select>
              </div>

              {filteredConfigs.length === 0 ? (
                <div className="rounded-xl border border-border-subtle bg-surface p-8 text-center space-y-3">
                  <p className="text-sm font-medium text-foreground">No API provider configurations match your filter.</p>
                  <p className="text-xs text-secondary">
                    Add unlimited provider configurations across Gemini, OpenRouter, OmniRoute, OpenAI, Groq, DeepSeek, Ollama, or custom HTTPS endpoints.
                  </p>
                  <Button size="sm" onClick={() => openAddModal()}>
                    <Plus className="h-3.5 w-3.5" />
                    Add First Provider
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {filteredConfigs.map((cfg) => (
                    <div
                      key={cfg.id}
                      className="rounded-xl border border-border-subtle bg-surface p-4 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="font-display text-sm font-semibold text-foreground truncate">
                              {cfg.providerName}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-secondary mt-0.5">
                              <span>{cfg.providerType}</span>
                              <span aria-hidden="true">·</span>
                              <span className={healthStatusColor(cfg.healthStatus)}>
                                {cfg.healthStatus}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>Auth: {cfg.authStatus}</span>
                              {cfg.isDefault && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-accent font-medium">Default</span>
                                </>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleToggleEnabled(cfg)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer shrink-0 ${
                              cfg.enabled
                                ? 'border-emerald-500/40 text-emerald-500 bg-emerald-500/10'
                                : 'border-border-subtle text-muted bg-canvas'
                            }`}
                          >
                            {cfg.enabled ? 'Enabled' : 'Disabled'}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs pt-2 border-t border-border-subtle">
                          <div className="truncate">
                            <span className="text-muted">Endpoint: </span>
                            <span className="font-mono-tabular text-foreground">{cfg.baseUrl}</span>
                          </div>
                          <div className="truncate">
                            <span className="text-muted">Masked Key: </span>
                            <span className="font-mono-tabular text-foreground">{cfg.maskedKey}</span>
                          </div>
                          <div>
                            <span className="text-muted">Default Model: </span>
                            <span className="font-mono-tabular text-foreground">
                              {cfg.defaultModel || 'None'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted">Models / Priority: </span>
                            <span className="font-mono-tabular text-foreground">
                              {cfg.models.length} models · P{cfg.priority}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted">Last Tested: </span>
                            <span className="font-mono-tabular text-secondary">
                              {formatShortTime(cfg.lastTestedAt)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted">Latency: </span>
                            <span className="font-mono-tabular text-secondary">
                              {cfg.lastLatencyMs !== null ? `${cfg.lastLatencyMs} ms` : 'Unavailable'}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                          <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                          <span>{cfg.folder}</span>
                          {cfg.tags.length > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{cfg.tags.join(' / ')}</span>
                            </>
                          )}
                        </div>

                        {cfg.lastErrorMessage && (
                          <p className="text-xs text-rose-500 bg-rose-500/10 rounded-lg px-3 py-2">
                            {cfg.lastErrorType ? `[${cfg.lastErrorType}] ` : ''}
                            {cfg.lastErrorMessage}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border-subtle">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleTestConfig(cfg)}
                            disabled={testingConfigId === cfg.id}
                          >
                            <Activity className="h-3.5 w-3.5" />
                            {testingConfigId === cfg.id ? 'Testing...' : 'Test Connection'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEditConfig(cfg)}>
                            Manage
                          </Button>
                          {!cfg.isDefault && (
                            <Button variant="ghost" size="sm" onClick={() => void handleSetDefault(cfg)}>
                              Set Default
                            </Button>
                          )}
                          {(cfg.healthStatus === 'Failed' || cfg.healthStatus === 'Cooldown' || !cfg.enabled) && (
                            <Button variant="ghost" size="sm" onClick={() => void handleRecoverConfig(cfg)}>
                              <RotateCcw className="h-3.5 w-3.5" />
                              Recover
                            </Button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteConfig(cfg)}
                          aria-label={`Delete ${cfg.providerName}`}
                          className="p-1.5 text-muted hover:text-rose-500 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ==================== 3. API KEYS (Unlimited Multi-Key Registry) ==================== */}
          {section === 'keys' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    Dynamic Unlimited API Key Vault
                  </h3>
                  <p className="text-xs text-secondary">
                    Store multiple independent keys per provider (e.g., Gemini Key 1, Key 2, Key 3; OpenRouter Key 1, Key 2). Only masked previews and SHA-256 fingerprints are displayed.
                  </p>
                </div>
                <Button size="sm" onClick={() => openAddModal()}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Key
                </Button>
              </div>

              {groupedByProvider.map(([pType, group]) => (
                <div key={pType} className="rounded-xl border border-border-subtle bg-surface overflow-hidden">
                  <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
                    <div className="text-sm font-semibold text-foreground">
                      {templates.find((t) => t.providerType === pType)?.displayName || pType}
                      <span className="ml-2 text-xs font-normal text-secondary font-mono-tabular">
                        ({group.length} key{group.length === 1 ? '' : 's'})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openAddModal(pType)}
                      className="text-xs text-accent hover:underline cursor-pointer"
                    >
                      + Add another key
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border-subtle text-muted">
                          <th className="py-2.5 px-4 font-medium">Configuration</th>
                          <th className="py-2.5 px-4 font-medium">Masked Secret</th>
                          <th className="py-2.5 px-4 font-medium">Fingerprint / Ver</th>
                          <th className="py-2.5 px-4 font-medium">Folder</th>
                          <th className="py-2.5 px-4 font-medium text-right">Priority</th>
                          <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {group.map((cfg) => (
                          <tr key={cfg.id} className="hover:bg-surface-hover/50">
                            <td className="py-2.5 px-4 font-medium text-foreground">
                              {cfg.providerName}
                              <span className={`ml-2 font-normal ${healthStatusColor(cfg.healthStatus)}`}>
                                {cfg.healthStatus}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 font-mono-tabular text-foreground">
                              {cfg.maskedKey}
                            </td>
                            <td className="py-2.5 px-4 font-mono-tabular text-secondary">
                              {cfg.keyFingerprint} · v{cfg.keyVersion}
                            </td>
                            <td className="py-2.5 px-4 text-secondary">{cfg.folder}</td>
                            <td className="py-2.5 px-4 text-right font-mono-tabular text-foreground">
                              P{cfg.priority}
                            </td>
                            <td className="py-2.5 px-4 text-right whitespace-nowrap space-x-2">
                              <button
                                type="button"
                                onClick={() => openEditConfig(cfg)}
                                className="text-accent hover:underline cursor-pointer"
                              >
                                Rotate / Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleToggleEnabled(cfg)}
                                className="text-secondary hover:text-foreground cursor-pointer"
                              >
                                {cfg.enabled ? 'Disable' : 'Enable'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ==================== 4. MODELS & CAPABILITIES ==================== */}
          {section === 'models' && (
            <div className="space-y-6">
              <form
                onSubmit={handleAddManualModel}
                className="rounded-xl border border-border-subtle bg-surface p-5 space-y-4"
              >
                <div>
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    Manual Model Entry &amp; Capability Declaration
                  </h3>
                  <p className="text-xs text-secondary mt-0.5">
                    Add custom or newly released model IDs to any provider configuration and declare exact task capabilities.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-secondary">Provider Configuration</label>
                    <Select
                      value={modelTargetConfigId}
                      onChange={(e) => setModelTargetConfigId(e.target.value)}
                    >
                      {configs.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.providerName}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-secondary">Model ID</label>
                    <Input
                      value={manualModelId}
                      onChange={(e) => setManualModelId(e.target.value)}
                      placeholder="e.g. deepseek-r1 or imagen-3.0-generate-002"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-secondary">Display Label (optional)</label>
                    <Input
                      value={manualModelLabel}
                      onChange={(e) => setManualModelLabel(e.target.value)}
                      placeholder="Human-friendly name"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-secondary">Supported Capabilities</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_CAPABILITIES.map((cap) => {
                      const checked = manualModelCaps.includes(cap);
                      return (
                        <button
                          key={cap}
                          type="button"
                          onClick={() =>
                            setManualModelCaps((prev) =>
                              prev.includes(cap) ? prev.filter((x) => x !== cap) : [...prev, cap]
                            )
                          }
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                            checked
                              ? 'border-accent bg-accent/15 text-foreground'
                              : 'border-border-subtle bg-canvas text-secondary hover:text-foreground'
                          }`}
                        >
                          {cap}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="inline-flex items-center gap-2 text-xs text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={manualModelDefault}
                      onChange={(e) => setManualModelDefault(e.target.checked)}
                    />
                    Set as default model for this provider
                  </label>
                  <Button type="submit" size="sm" disabled={!modelTargetConfigId || !manualModelId.trim()}>
                    <Plus className="h-3.5 w-3.5" />
                    Add Model
                  </Button>
                </div>
              </form>

              <div className="rounded-xl border border-border-subtle bg-surface overflow-hidden">
                <div className="px-4 py-3 border-b border-border-subtle">
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    Discovered &amp; Manual Model Registry
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border-subtle text-muted">
                        <th className="py-2.5 px-4 font-medium">Model ID</th>
                        <th className="py-2.5 px-4 font-medium">Provider</th>
                        <th className="py-2.5 px-4 font-medium">Origin</th>
                        <th className="py-2.5 px-4 font-medium">Declared Capabilities</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {configs.flatMap((cfg) =>
                        cfg.models.map((m) => (
                          <tr key={`${cfg.id}_${m.id}`} className="hover:bg-surface-hover/50">
                            <td className="py-2.5 px-4 font-mono-tabular text-foreground">
                              {m.modelId}
                              {cfg.defaultModel === m.modelId && (
                                <span className="ml-2 text-accent font-sans font-medium">Default</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-secondary">{cfg.providerName}</td>
                            <td className="py-2.5 px-4 text-secondary">
                              {m.isManual ? 'Manual' : 'Template / Discovered'}
                            </td>
                            <td className="py-2.5 px-4 text-secondary">
                              {m.capabilities.join(' · ')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==================== 5. TASK ASSIGNMENTS (9 KDP TASKS) ==================== */}
          {section === 'tasks' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="font-display text-sm font-semibold text-foreground">
                  AI Task-to-Provider Assignment Matrix
                </h3>
                <p className="text-xs text-secondary">
                  Assign independent primary and fallback providers/models for every KDP workflow agent. Capability mismatches (such as text-only models for Image Generation or non-vision models for PDF Quality Analysis) are strictly blocked.
                </p>
              </div>

              <div className="space-y-3">
                {tasks.map((taskDef) => {
                  const current = state?.taskAssignments.find((a) => a.taskKey === taskDef.taskKey);
                  const primaryCfg = configs.find((c) => c.id === current?.primaryConfigId);
                  const fallbackCfg = configs.find((c) => c.id === current?.fallbackConfigId);
                  const testResult = taskTestResults[taskDef.taskKey];

                  return (
                    <div
                      key={taskDef.taskKey}
                      className="rounded-xl border border-border-subtle bg-surface p-4 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="font-display text-sm font-semibold text-foreground">
                            {taskDef.label}
                          </p>
                          <p className="text-xs text-secondary">
                            Required capability: <span className="font-mono-tabular text-foreground">{taskDef.requiredCapability}</span> · Recommended: {taskDef.recommendedProviders}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="inline-flex rounded-lg border border-border-subtle bg-canvas p-0.5 text-xs">
                            <button
                              type="button"
                              onClick={() =>
                                void handleUpdateTask(taskDef.taskKey, { mode: 'automatic' })
                              }
                              className={`px-2.5 py-1 rounded-md cursor-pointer ${
                                (current?.mode ?? 'automatic') === 'automatic'
                                  ? 'bg-accent text-white'
                                  : 'text-secondary hover:text-foreground'
                              }`}
                            >
                              Automatic
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void handleUpdateTask(taskDef.taskKey, { mode: 'manual' })
                              }
                              className={`px-2.5 py-1 rounded-md cursor-pointer ${
                                current?.mode === 'manual'
                                  ? 'bg-accent text-white'
                                  : 'text-secondary hover:text-foreground'
                              }`}
                            >
                              Manual
                            </button>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleTestTask(taskDef.taskKey)}
                            disabled={testingTaskKey === taskDef.taskKey}
                          >
                            <Play className="h-3.5 w-3.5" />
                            {testingTaskKey === taskDef.taskKey ? 'Testing...' : 'Test Task'}
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted">Primary Provider</label>
                          <Select
                            value={current?.primaryConfigId || ''}
                            onChange={(e) => {
                              const nextCfgId = e.target.value || null;
                              const nextCfg = configs.find((c) => c.id === nextCfgId);
                              const compatibleModel = nextCfg?.models.find((m) =>
                                m.capabilities.includes(taskDef.requiredCapability)
                              );
                              void handleUpdateTask(taskDef.taskKey, {
                                mode: current?.mode ?? 'manual',
                                primaryConfigId: nextCfgId,
                                primaryModelId: compatibleModel?.modelId ?? nextCfg?.defaultModel ?? null,
                              });
                            }}
                          >
                            <option value="">Smart Router Auto-Select</option>
                            {configs.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.providerName}
                              </option>
                            ))}
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-muted">Primary Model</label>
                          <Select
                            value={current?.primaryModelId || ''}
                            disabled={!primaryCfg}
                            onChange={(e) =>
                              void handleUpdateTask(taskDef.taskKey, {
                                mode: current?.mode ?? 'manual',
                                primaryConfigId: current?.primaryConfigId ?? null,
                                primaryModelId: e.target.value || null,
                              })
                            }
                          >
                            <option value="">Default compatible model</option>
                            {(primaryCfg?.models ?? []).map((m) => (
                              <option key={m.id} value={m.modelId}>
                                {m.modelId} ({m.capabilities.join(', ')})
                              </option>
                            ))}
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-muted">Fallback Provider</label>
                          <Select
                            value={current?.fallbackConfigId || ''}
                            onChange={(e) => {
                              const nextFbId = e.target.value || null;
                              const nextFb = configs.find((c) => c.id === nextFbId);
                              const compatibleModel = nextFb?.models.find((m) =>
                                m.capabilities.includes(taskDef.requiredCapability)
                              );
                              void handleUpdateTask(taskDef.taskKey, {
                                mode: current?.mode ?? 'automatic',
                                fallbackConfigId: nextFbId,
                                fallbackModelId: compatibleModel?.modelId ?? nextFb?.defaultModel ?? null,
                              });
                            }}
                          >
                            <option value="">None / Next Eligible Provider</option>
                            {configs.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.providerName}
                              </option>
                            ))}
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-muted">Fallback Model</label>
                          <Select
                            value={current?.fallbackModelId || ''}
                            disabled={!fallbackCfg}
                            onChange={(e) =>
                              void handleUpdateTask(taskDef.taskKey, {
                                mode: current?.mode ?? 'automatic',
                                fallbackConfigId: current?.fallbackConfigId ?? null,
                                fallbackModelId: e.target.value || null,
                              })
                            }
                          >
                            <option value="">Default compatible model</option>
                            {(fallbackCfg?.models ?? []).map((m) => (
                              <option key={m.id} value={m.modelId}>
                                {m.modelId} ({m.capabilities.join(', ')})
                              </option>
                            ))}
                          </Select>
                        </div>
                      </div>

                      {testResult && (
                        <div
                          className={`text-xs rounded-lg px-3 py-2 ${
                            testResult.ok
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-rose-500/10 text-rose-500'
                          }`}
                        >
                          {testResult.ok && testResult.selectedProvider ? (
                            <span>
                              Routed to <strong>{testResult.selectedProvider.providerName}</strong> · model{' '}
                              <span className="font-mono-tabular">{testResult.selectedProvider.modelId}</span> ·{' '}
                              <span className="font-mono-tabular">{testResult.selectedProvider.latencyMs} ms</span>
                              {testResult.selectedProvider.fallbackUsed ? ' · Failover used' : ''}
                            </span>
                          ) : (
                            <span>{testResult.error || 'Task routing test failed.'}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==================== 6. ROUTING RULES, HEALTH & EXPORT/IMPORT ==================== */}
          {section === 'routing' && rulesDraft && (
            <div className="space-y-6">
              <form
                onSubmit={handleSaveHealthRules}
                className="rounded-xl border border-border-subtle bg-surface p-5 space-y-4"
              >
                <div>
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    Health Monitoring &amp; Failover Policy
                  </h3>
                  <p className="text-xs text-secondary mt-0.5">
                    Configure automatic disable thresholds, cooldown durations, and bounded retries to prevent infinite retry loops.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-secondary">Failures Before Auto-Disable</label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={rulesDraft.maxConsecutiveFailuresBeforeDisable}
                      onChange={(e) =>
                        setRulesDraft({
                          ...rulesDraft,
                          maxConsecutiveFailuresBeforeDisable: Number(e.target.value) || 3,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-secondary">Cooldown Period (seconds)</label>
                    <Input
                      type="number"
                      min={15}
                      max={3600}
                      value={rulesDraft.cooldownSeconds}
                      onChange={(e) =>
                        setRulesDraft({
                          ...rulesDraft,
                          cooldownSeconds: Number(e.target.value) || 120,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-secondary">Max Retries (Transient 5xx/Timeout)</label>
                    <Input
                      type="number"
                      min={0}
                      max={3}
                      value={rulesDraft.maxRetriesPerRequest}
                      onChange={(e) =>
                        setRulesDraft({
                          ...rulesDraft,
                          maxRetriesPerRequest: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-1 text-xs">
                  <label className="flex items-center gap-2 text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rulesDraft.autoDisableOnAuthError}
                      onChange={(e) =>
                        setRulesDraft({
                          ...rulesDraft,
                          autoDisableOnAuthError: e.target.checked,
                        })
                      }
                    />
                    Auto-disable configuration immediately on permanent authentication error (401/403)
                  </label>
                  <p className="text-secondary">
                    Immutable Policy Safeguard: Same-provider key rotation on quota or rate-limit errors (HTTP 429) is strictly disabled. Failover switches only to a separate, legitimately available compatible provider.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" size="sm">
                    Save Failover Rules
                  </Button>
                </div>
              </form>

              {/* Secret-Free Export / Import */}
              <div className="rounded-xl border border-border-subtle bg-surface p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-foreground">
                      Secret-Free Configuration Export &amp; Import
                    </h3>
                    <p className="text-xs text-secondary mt-0.5">
                      Export provider templates, models, task assignments, and health rules as JSON without ever exporting raw or encrypted API keys.
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => void handleExportConfig()}>
                    <Download className="h-3.5 w-3.5" />
                    Export Secret-Free JSON
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-secondary">Paste Exported JSON to Import Templates</label>
                  <textarea
                    rows={4}
                    value={importJsonText}
                    onChange={(e) => setImportJsonText(e.target.value)}
                    placeholder='{"configs": [{"providerName": "OpenRouter Team", "providerType": "openrouter", "baseUrl": "https://openrouter.ai/api/v1"}]}'
                    className="w-full rounded-lg border border-border-subtle bg-canvas px-3 py-2 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleImportConfig()}
                      disabled={!importJsonText.trim()}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Import Configuration
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== 7. USAGE & ANALYTICS ==================== */}
          {section === 'usage' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-border-subtle bg-surface p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-foreground">
                      Daily Request Volume (Live Recorded Activity)
                    </h3>
                    <p className="text-xs text-secondary">
                      Token usage and cost show &quot;Unavailable&quot; whenever a provider response does not supply usage telemetry.
                    </p>
                  </div>
                  <span className="font-mono-tabular text-xs text-secondary">
                    {metrics?.totalRequests ?? 0} total logged
                  </span>
                </div>

                {dailySeries.length === 0 ? (
                  <p className="text-xs text-muted py-6 text-center">
                    No API task executions recorded yet. Run a Test Task or Chat request to populate live usage charts.
                  </p>
                ) : (
                  <div className="w-full overflow-x-auto">
                    <svg viewBox="0 0 600 170" className="w-full h-44" role="img" aria-label="Daily API request counts">
                      {(() => {
                        const maxVal = Math.max(...dailySeries.map((d) => d.ok + d.fail), 1);
                        const barW = Math.min(48, Math.floor(520 / dailySeries.length) - 10);
                        return dailySeries.map((d, idx) => {
                          const x = 40 + idx * (520 / dailySeries.length);
                          const okH = (d.ok / maxVal) * 115;
                          const failH = (d.fail / maxVal) * 115;
                          return (
                            <g key={d.day}>
                              <rect
                                x={x}
                                y={135 - okH}
                                width={barW}
                                height={okH}
                                rx={3}
                                className="fill-accent"
                              />
                              {failH > 0 && (
                                <rect
                                  x={x}
                                  y={135 - okH - failH}
                                  width={barW}
                                  height={failH}
                                  rx={3}
                                  className="fill-rose-500"
                                />
                              )}
                              <text
                                x={x + barW / 2}
                                y={154}
                                textAnchor="middle"
                                className="fill-current text-muted text-[10px] font-mono-tabular"
                              >
                                {d.day.slice(5)}
                              </text>
                            </g>
                          );
                        });
                      })()}
                    </svg>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border-subtle bg-surface overflow-hidden">
                <div className="px-4 py-3 border-b border-border-subtle">
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    Provider-Wise Usage Breakdown
                  </h3>
                </div>
                {providerUsageSummary.length === 0 ? (
                  <p className="text-xs text-muted p-6 text-center">No provider usage logged yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border-subtle text-muted">
                          <th className="py-2.5 px-4 font-medium">Provider</th>
                          <th className="py-2.5 px-4 font-medium text-right">Total</th>
                          <th className="py-2.5 px-4 font-medium text-right">Succeeded</th>
                          <th className="py-2.5 px-4 font-medium text-right">Failed</th>
                          <th className="py-2.5 px-4 font-medium text-right">Avg Latency</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {providerUsageSummary.map((row) => (
                          <tr key={row.providerName}>
                            <td className="py-2.5 px-4 font-medium text-foreground">{row.providerName}</td>
                            <td className="py-2.5 px-4 text-right font-mono-tabular">{row.total}</td>
                            <td className="py-2.5 px-4 text-right font-mono-tabular text-emerald-500">
                              {row.success}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono-tabular text-rose-500">
                              {row.failed}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono-tabular text-secondary">
                              {row.avgLatencyMs} ms
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== 8. CONNECTION & AUDIT LOGS ==================== */}
          {section === 'logs' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-border-subtle bg-surface overflow-hidden">
                <div className="px-4 py-3 border-b border-border-subtle">
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    Connection Health Check History
                  </h3>
                </div>
                {(state?.healthLogs.length ?? 0) === 0 ? (
                  <p className="text-xs text-muted p-6 text-center">
                    No connection tests recorded yet. Click Test Connection on any provider.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border-subtle text-muted">
                          <th className="py-2.5 px-4 font-medium">Timestamp</th>
                          <th className="py-2.5 px-4 font-medium">Provider</th>
                          <th className="py-2.5 px-4 font-medium">Status / Auth</th>
                          <th className="py-2.5 px-4 font-medium text-right">Latency</th>
                          <th className="py-2.5 px-4 font-medium">Response / Error</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {(state?.healthLogs ?? []).map((log) => (
                          <tr key={log.id}>
                            <td className="py-2.5 px-4 font-mono-tabular text-secondary whitespace-nowrap">
                              {formatShortTime(log.timestamp)}
                            </td>
                            <td className="py-2.5 px-4 font-medium text-foreground">{log.providerName}</td>
                            <td className="py-2.5 px-4">
                              <span
                                className={
                                  log.status === 'Healthy'
                                    ? 'text-emerald-500'
                                    : log.status === 'Degraded'
                                      ? 'text-amber-500'
                                      : 'text-rose-500'
                                }
                              >
                                {log.status}
                              </span>
                              <span className="text-muted"> · {log.authStatus}</span>
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono-tabular text-secondary">
                              {log.latencyMs} ms
                            </td>
                            <td className="py-2.5 px-4 text-secondary">
                              {log.errorMessage || log.providerResponse}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border-subtle bg-surface overflow-hidden">
                <div className="px-4 py-3 border-b border-border-subtle">
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    Security &amp; Configuration Audit Trail
                  </h3>
                </div>
                {(state?.auditLogs.length ?? 0) === 0 ? (
                  <p className="text-xs text-muted p-6 text-center">No configuration audit events yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border-subtle text-muted">
                          <th className="py-2.5 px-4 font-medium">Timestamp</th>
                          <th className="py-2.5 px-4 font-medium">Action</th>
                          <th className="py-2.5 px-4 font-medium">Detail</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {(state?.auditLogs ?? []).map((aud) => (
                          <tr key={aud.id}>
                            <td className="py-2.5 px-4 font-mono-tabular text-secondary whitespace-nowrap">
                              {formatShortTime(aud.timestamp)}
                            </td>
                            <td className="py-2.5 px-4 font-mono-tabular text-foreground">{aud.action}</td>
                            <td className="py-2.5 px-4 text-secondary">{aud.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================== ADD PROVIDER MODAL ==================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border-strong bg-surface p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">
                  Add AI Provider Configuration
                </h3>
                <p className="text-xs text-secondary mt-0.5">
                  Add unlimited configurations and multiple API keys per provider. Secrets are encrypted with AES-256-GCM on the server.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-muted hover:text-foreground cursor-pointer"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProvider} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-secondary">Provider Type</label>
                  <Select value={formType} onChange={(e) => handleSelectTemplate(e.target.value)}>
                    {templates.map((t) => (
                      <option key={t.providerType} value={t.providerType}>
                        {t.displayName}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-secondary">Configuration Name</label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Gemini API Key 2 or OmniRoute EU"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-secondary">
                    API Key {selectedTemplate?.requiresApiKey === false ? '(Optional for Ollama)' : '(Encrypted at rest)'}
                  </label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={formKey}
                    onChange={(e) => setFormKey(e.target.value)}
                    placeholder="Paste API key — never stored in browser"
                    required={selectedTemplate?.requiresApiKey !== false}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-secondary">API Base URL (HTTPS enforced)</label>
                  <Input
                    value={formBaseUrl}
                    onChange={(e) => setFormBaseUrl(e.target.value)}
                    placeholder="https://..."
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-secondary">Custom Model Name (optional)</label>
                  <Input
                    value={formCustomModel}
                    onChange={(e) => setFormCustomModel(e.target.value)}
                    placeholder="e.g. gpt-4o or deepseek-r1"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-secondary">API Version (optional)</label>
                  <Input
                    value={formApiVersion}
                    onChange={(e) => setFormApiVersion(e.target.value)}
                    placeholder="e.g. v1beta"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-secondary">Organization ID (optional)</label>
                  <Input
                    value={formOrgId}
                    onChange={(e) => setFormOrgId(e.target.value)}
                    placeholder="org-..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-secondary">Folder</label>
                  <Input value={formFolder} onChange={(e) => setFormFolder(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-secondary">Tags (comma-separated)</label>
                  <Input
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="writing, backup, vision"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-secondary">Priority (1 = highest)</label>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={formPriority}
                    onChange={(e) => setFormPriority(Number(e.target.value) || 10)}
                  />
                </div>
              </div>

              {formCustomModel.trim() && (
                <div className="space-y-1.5">
                  <label className="text-xs text-secondary">Custom Model Capabilities</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_CAPABILITIES.map((cap) => {
                      const active = formCapabilities.includes(cap);
                      return (
                        <button
                          key={cap}
                          type="button"
                          onClick={() =>
                            setFormCapabilities((prev) =>
                              prev.includes(cap) ? prev.filter((x) => x !== cap) : [...prev, cap]
                            )
                          }
                          className={`px-2.5 py-1 rounded-md text-xs border cursor-pointer ${
                            active
                              ? 'border-accent bg-accent/15 text-foreground'
                              : 'border-border-subtle bg-canvas text-secondary'
                          }`}
                        >
                          {cap}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-secondary">Description</label>
                  <Input
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Purpose or billing account notes"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-secondary">Custom Headers JSON (optional)</label>
                  <Input
                    value={formCustomHeaders}
                    onChange={(e) => setFormCustomHeaders(e.target.value)}
                    placeholder='{"HTTP-Referer": "https://kdpstudio.app"}'
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-5 text-xs text-secondary pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formEnabled}
                    onChange={(e) => setFormEnabled(e.target.checked)}
                  />
                  Enable immediately
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formDefault}
                    onChange={(e) => setFormDefault(e.target.checked)}
                  />
                  Set as default provider
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
                <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingAdd}>
                  {submittingAdd ? 'Saving...' : 'Save Provider Configuration'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== EDIT / ROTATE SECRET MODAL ==================== */}
      {editingConfig && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border-strong bg-surface p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-base font-bold text-foreground">
                  Manage Configuration &amp; Rotate Key
                </h3>
                <p className="text-xs text-secondary mt-0.5">
                  Current masked key: <span className="font-mono-tabular">{editingConfig.maskedKey}</span> (v{editingConfig.keyVersion})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingConfig(null)}
                className="text-muted hover:text-foreground cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditConfig} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-secondary">Configuration Name</label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-secondary">API Base URL</label>
                <Input value={editBaseUrl} onChange={(e) => setEditBaseUrl(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-secondary">Rotate API Key (leave blank to keep existing key)</label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={editRotateKey}
                  onChange={(e) => setEditRotateKey(e.target.value)}
                  placeholder="Enter new secret to rotate key version..."
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-secondary">Folder</label>
                  <Input value={editFolder} onChange={(e) => setEditFolder(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-secondary">Tags</label>
                  <Input value={editTags} onChange={(e) => setEditTags(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-secondary">Priority</label>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={editPriority}
                    onChange={(e) => setEditPriority(Number(e.target.value) || 10)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
                <Button type="button" variant="ghost" onClick={() => setEditingConfig(null)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
