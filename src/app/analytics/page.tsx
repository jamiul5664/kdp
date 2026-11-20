import { useMemo, useState } from 'react';
import {
  Bell,
  Brain,
  Calculator,
  Clock,
  Download,
  FolderKanban,
  Lock,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import {
  useAdvancedStudioStore,
  type ProjectMemoryType,
} from '../../stores/useAdvancedStudioStore';
import {
  calculateKdpProfitability,
  parsePerformanceCsv,
  type ProfitabilityInput,
} from '../../utils/kdpAdvancedEngines';
import { apiPut } from '../../services/apiClient';
import type { MarketplaceId, TrimSizeId } from '../../types';

type AnalyticsTab = 'profitability' | 'performance' | 'portfolio' | 'memory' | 'notifications';

const MEMORY_TYPES: ProjectMemoryType[] = [
  'User preferences',
  'Book style profile',
  'Approved book outline',
  'Approved page content',
  'Illustration instructions',
  'Research findings',
  'Previous revisions',
  'Rejected suggestions',
  'Project decisions',
  'Export settings',
];

function downloadFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AnalyticsPortfolioPage() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('profitability');
  const { projects, activeProjectId, setActiveProjectId, user, openProjectInEditor } = useAppStore();
  const {
    performanceRows,
    importPerformanceRows,
    clearPerformanceRows,
    projectMemories,
    addProjectMemory,
    updateProjectMemory,
    researchHistory,
    scheduledRules,
    notificationPrefs,
    notificationHistory,
    addScheduledRule,
    toggleScheduledRule,
    deleteScheduledRule,
    updateNotificationPrefs,
    updateNotificationTrigger,
    pushNotificationHistory,
    markHistoryRead,
  } = useAdvancedStudioStore();

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];

  // 1. Profitability Calculator state
  const [profitInput, setProfitInput] = useState<ProfitabilityInput>({
    marketplace: 'amazon.com',
    bookFormat: 'Paperback',
    trimSize: '8.5x11',
    pageCount: 104,
    paperType: 'White Paper',
    inkType: 'Black & White',
    listPrice: 12.99,
    manualPrintingCost: null,
    productionCost: 180,
    adCostPerSale: 1.5,
  });
  const [manualPrintText, setManualPrintText] = useState('');

  const profitResult = useMemo(() => calculateKdpProfitability(profitInput), [profitInput]);

  // 2. Performance Learning CSV state
  const [perfCsvText, setPerfCsvText] = useState('');

  // 3. Portfolio filter/sort/search
  const [portfolioSearch, setPortfolioSearch] = useState('');
  const [portfolioCategory, setPortfolioCategory] = useState('All');
  const [portfolioSort, setPortfolioSort] = useState<'updated' | 'progress' | 'pages'>('updated');

  // 4. Persistent AI Project Memory state
  const [memSearch, setMemSearch] = useState('');
  const [memTypeFilter, setMemTypeFilter] = useState<'All' | ProjectMemoryType>('All');
  const [newMemType, setNewMemType] = useState<ProjectMemoryType>('Project decisions');
  const [newMemTitle, setNewMemTitle] = useState('');
  const [newMemContent, setNewMemContent] = useState('');
  const [newMemApproved, setNewMemApproved] = useState(true);
  const [memGuardNotice, setMemGuardNotice] = useState<string | null>(null);

  // 5. Scheduled Research & Notification System state
  const [schName, setSchName] = useState('');
  const [schQuery, setSchQuery] = useState('');
  const [schCadence, setSchCadence] = useState<'Daily' | 'Weekly' | 'Bi-Weekly' | 'Monthly'>('Weekly');
  const [schConsent, setSchConsent] = useState(false);
  const [scheduleSavedMsg, setScheduleSavedMsg] = useState<string | null>(null);

  // Performance aggregates
  const perfStats = useMemo(() => {
    const totalUnits = performanceRows.reduce((s, r) => s + r.unitsSold, 0);
    const totalRoyalty = performanceRows.reduce((s, r) => s + r.royaltyUsd, 0);
    const totalAds = performanceRows.reduce((s, r) => s + r.adSpendUsd, 0);
    const byBook = new Map<string, { units: number; royalty: number; ads: number; avgPrice: number; count: number }>();
    const byMarketplace = new Map<string, { units: number; royalty: number }>();
    const byFormat = new Map<string, { units: number; royalty: number }>();

    performanceRows.forEach((r) => {
      const b = byBook.get(r.bookTitle) ?? { units: 0, royalty: 0, ads: 0, avgPrice: 0, count: 0 };
      b.units += r.unitsSold;
      b.royalty += r.royaltyUsd;
      b.ads += r.adSpendUsd;
      b.avgPrice += r.listPrice;
      b.count += 1;
      byBook.set(r.bookTitle, b);

      const m = byMarketplace.get(r.marketplace) ?? { units: 0, royalty: 0 };
      m.units += r.unitsSold;
      m.royalty += r.royaltyUsd;
      byMarketplace.set(r.marketplace, m);

      const f = byFormat.get(r.format) ?? { units: 0, royalty: 0 };
      f.units += r.unitsSold;
      f.royalty += r.royaltyUsd;
      byFormat.set(r.format, f);
    });

    return {
      totalUnits,
      totalRoyalty,
      totalAds,
      netRoyalty: totalRoyalty - totalAds,
      byBook: Array.from(byBook.entries()).map(([title, v]) => ({
        title,
        units: v.units,
        royalty: v.royalty,
        ads: v.ads,
        avgPrice: v.count ? v.avgPrice / v.count : 0,
      })),
      byMarketplace: Array.from(byMarketplace.entries()),
      byFormat: Array.from(byFormat.entries()),
    };
  }, [performanceRows]);

  const filteredPortfolio = useMemo(() => {
    return projects
      .filter((p) => {
        const matchesCat = portfolioCategory === 'All' || p.category === portfolioCategory;
        const q = portfolioSearch.trim().toLowerCase();
        const matchesQ = !q || p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
        return matchesCat && matchesQ;
      })
      .sort((a, b) => {
        if (portfolioSort === 'progress') return b.progress - a.progress;
        if (portfolioSort === 'pages') return b.pageCount - a.pageCount;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [projects, portfolioCategory, portfolioSearch, portfolioSort]);

  // Strict User + Project isolation for Project Memory
  const isolatedMemories = useMemo(() => {
    const q = memSearch.trim().toLowerCase();
    return projectMemories.filter((m) => {
      if (m.userId !== user.id || m.projectId !== activeProject?.id) return false;
      if (memTypeFilter !== 'All' && m.memoryType !== memTypeFilter) return false;
      if (!q) return true;
      return (
        m.title.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [projectMemories, user.id, activeProject?.id, memTypeFilter, memSearch]);

  const handleSaveSchedulesBackend = async () => {
    try {
      await apiPut('/api/schedules', {
        timezone: notificationPrefs.timezone,
        inAppEnabled: notificationPrefs.inAppEnabled,
        emailEnabled: notificationPrefs.emailEnabled,
        schedules: scheduledRules.map((r) => ({
          id: r.id,
          name: r.name,
          query: r.query,
          cadence: r.cadence,
          enabled: r.enabled,
          userConsentGranted: r.userConsentGranted,
        })),
      });
      setScheduleSavedMsg('Schedule & notification preferences synced to backend.');
    } catch {
      setScheduleSavedMsg('Saved locally (backend sync unavailable).');
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-border-subtle pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Publishing Economics, Portfolio & Project Governance
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground">
            Profitability, Performance, Portfolio, Memory & Alerts
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Official KDP royalty formulas, user-imported sales analytics, multi-book portfolio tracking, isolated pgvector project memory, and opt-in scheduled alerts.
          </p>
        </div>
        <select
          value={activeProject?.id || ''}
          onChange={(e) => setActiveProjectId(e.target.value)}
          className="h-9 rounded-lg border border-border-subtle bg-surface px-3 text-xs font-medium text-foreground"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border-subtle pb-px">
        {[
          { id: 'profitability' as const, label: 'Profitability Calculator', icon: Calculator },
          { id: 'performance' as const, label: 'Performance Learning', icon: TrendingUp },
          { id: 'portfolio' as const, label: 'Portfolio Manager', icon: FolderKanban },
          { id: 'memory' as const, label: 'AI Project Memory', icon: Brain },
          { id: 'notifications' as const, label: 'Schedules & Alerts', icon: Bell },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs font-medium transition-colors ${
                active ? 'border-accent text-foreground' : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 1. KDP BOOK PROFITABILITY CALCULATOR */}
      {activeTab === 'profitability' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 rounded-xl border border-border-subtle bg-surface p-5 space-y-3 text-xs">
            <h2 className="text-sm font-semibold text-foreground">Book & Cost Parameters (User Inputs)</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-muted">Marketplace</span>
                <select
                  value={profitInput.marketplace}
                  onChange={(e) => setProfitInput({ ...profitInput, marketplace: e.target.value as MarketplaceId })}
                  className="w-full h-9 rounded-lg border border-border-subtle bg-canvas px-2 text-foreground"
                >
                  <option value="amazon.com">amazon.com ($)</option>
                  <option value="amazon.co.uk">amazon.co.uk (£)</option>
                  <option value="amazon.de">amazon.de (€)</option>
                  <option value="amazon.ca">amazon.ca (CA$)</option>
                  <option value="amazon.com.au">amazon.com.au (A$)</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-muted">Book Format</span>
                <select
                  value={profitInput.bookFormat}
                  onChange={(e) =>
                    setProfitInput({ ...profitInput, bookFormat: e.target.value as 'Paperback' | 'Hardcover' })
                  }
                  className="w-full h-9 rounded-lg border border-border-subtle bg-canvas px-2 text-foreground"
                >
                  <option value="Paperback">Paperback</option>
                  <option value="Hardcover">Hardcover (75+ pages)</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-muted">Trim Size</span>
                <select
                  value={profitInput.trimSize}
                  onChange={(e) => setProfitInput({ ...profitInput, trimSize: e.target.value as TrimSizeId })}
                  className="w-full h-9 rounded-lg border border-border-subtle bg-canvas px-2 text-foreground"
                >
                  <option value="6x9">6" × 9"</option>
                  <option value="8.5x11">8.5" × 11"</option>
                  <option value="8.5x8.5">8.5" × 8.5"</option>
                  <option value="5.5x8.5">5.5" × 8.5"</option>
                  <option value="7x10">7" × 10"</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-muted">Page Count</span>
                <input
                  type="number"
                  min={24}
                  max={828}
                  value={profitInput.pageCount}
                  onChange={(e) => setProfitInput({ ...profitInput, pageCount: Number(e.target.value) || 24 })}
                  className="w-full h-9 rounded-lg border border-border-subtle bg-canvas px-2.5 font-mono-tabular text-foreground"
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted">Paper Type</span>
                <select
                  value={profitInput.paperType}
                  onChange={(e) =>
                    setProfitInput({ ...profitInput, paperType: e.target.value as 'White Paper' | 'Cream Paper' })
                  }
                  className="w-full h-9 rounded-lg border border-border-subtle bg-canvas px-2 text-foreground"
                >
                  <option value="White Paper">White Paper</option>
                  <option value="Cream Paper">Cream Paper</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-muted">Ink Type</span>
                <select
                  value={profitInput.inkType}
                  onChange={(e) =>
                    setProfitInput({
                      ...profitInput,
                      inkType: e.target.value as ProfitabilityInput['inkType'],
                    })
                  }
                  className="w-full h-9 rounded-lg border border-border-subtle bg-canvas px-2 text-foreground"
                >
                  <option value="Black & White">Black & White</option>
                  <option value="Standard Color">Standard Color</option>
                  <option value="Premium Color">Premium Color</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-muted">List Price ({profitResult.currencySymbol})</span>
                <input
                  type="number"
                  step="0.5"
                  min={2}
                  value={profitInput.listPrice}
                  onChange={(e) => setProfitInput({ ...profitInput, listPrice: Number(e.target.value) || 0 })}
                  className="w-full h-9 rounded-lg border border-border-subtle bg-canvas px-2.5 font-mono-tabular text-foreground"
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted">Manual Print Cost Override</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Optional actual quote"
                  value={manualPrintText}
                  onChange={(e) => {
                    setManualPrintText(e.target.value);
                    const val = e.target.value.trim();
                    setProfitInput({
                      ...profitInput,
                      manualPrintingCost: val === '' ? null : Number(val),
                    });
                  }}
                  className="w-full h-9 rounded-lg border border-border-subtle bg-canvas px-2.5 font-mono-tabular text-foreground"
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted">Production Cost ({profitResult.currencySymbol})</span>
                <input
                  type="number"
                  min={0}
                  value={profitInput.productionCost}
                  onChange={(e) => setProfitInput({ ...profitInput, productionCost: Number(e.target.value) || 0 })}
                  className="w-full h-9 rounded-lg border border-border-subtle bg-canvas px-2.5 font-mono-tabular text-foreground"
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted">Est. Ad Cost / Sale ({profitResult.currencySymbol})</span>
                <input
                  type="number"
                  step="0.25"
                  min={0}
                  value={profitInput.adCostPerSale}
                  onChange={(e) => setProfitInput({ ...profitInput, adCostPerSale: Number(e.target.value) || 0 })}
                  className="w-full h-9 rounded-lg border border-border-subtle bg-canvas px-2.5 font-mono-tabular text-foreground"
                />
              </label>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-border-subtle bg-surface p-4">
                <span className="text-[11px] text-muted">Printing Cost</span>
                <p className="mt-1 font-mono-tabular text-xl font-bold text-foreground">
                  {profitResult.currencySymbol}{profitResult.printingCost.toFixed(2)}
                </p>
                <span className="text-[10px] text-muted">{profitResult.printingCostSource}</span>
              </div>
              <div className="rounded-xl border border-border-subtle bg-surface p-4">
                <span className="text-[11px] text-muted">Royalty Rate (Rule)</span>
                <p className="mt-1 font-mono-tabular text-xl font-bold text-accent">
                  {Math.round(profitResult.royaltyRate * 100)}%
                </p>
                <span className="text-[10px] text-muted">Official KDP tier</span>
              </div>
              <div className="rounded-xl border border-border-subtle bg-surface p-4">
                <span className="text-[11px] text-muted">Royalty / Sale (Est)</span>
                <p className={`mt-1 font-mono-tabular text-xl font-bold ${profitResult.royaltyPerSale > 0 ? 'text-teal' : 'text-rose-400'}`}>
                  {profitResult.currencySymbol}{profitResult.royaltyPerSale.toFixed(2)}
                </p>
                <span className="text-[10px] text-muted">Net after ads: {profitResult.currencySymbol}{profitResult.netProfitPerSale.toFixed(2)}</span>
              </div>
              <div className="rounded-xl border border-border-subtle bg-surface p-4">
                <span className="text-[11px] text-muted">Break-Even Sales</span>
                <p className="mt-1 font-mono-tabular text-xl font-bold text-foreground">
                  {profitResult.breakEvenSales !== null ? `${profitResult.breakEvenSales} units` : 'Unprofitable'}
                </p>
                <span className="text-[10px] text-muted">Recovers {profitResult.currencySymbol}{profitInput.productionCost}</span>
              </div>
            </div>

            {/* Interactive SVG Pricing Comparison Chart */}
            <div className="rounded-xl border border-border-subtle bg-surface p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Pricing Comparison & Net Margin per Sale</h3>
                <span className="text-xs text-muted">{profitResult.royaltyRateRule}</span>
              </div>
              <svg viewBox="0 0 560 150" className="mt-4 w-full h-40">
                {profitResult.priceComparisons.map((pt, idx) => {
                  const maxVal = Math.max(2, ...profitResult.priceComparisons.map((p) => Math.abs(p.royaltyPerSale)));
                  const x = 28 + idx * 106;
                  const royH = Math.max(4, (Math.max(0, pt.royaltyPerSale) / maxVal) * 90);
                  const netH = Math.max(4, (Math.max(0, pt.netPerSale) / maxVal) * 90);
                  return (
                    <g key={idx}>
                      <rect x={x} y={110 - royH} width={28} height={royH} rx={3} fill="#8B7CFF" />
                      <rect x={x + 32} y={110 - netH} width={28} height={netH} rx={3} fill="#2DD4BF" />
                      <text x={x + 30} y={128} textAnchor="middle" fill="currentColor" className="text-[10px] text-foreground">
                        {profitResult.currencySymbol}{pt.price.toFixed(2)}
                      </text>
                      <text x={x + 30} y={142} textAnchor="middle" fill="currentColor" className="text-[9px] text-muted">
                        Net {profitResult.currencySymbol}{pt.netPerSale.toFixed(2)}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <div className="mt-2 flex gap-5 text-xs text-secondary">
                <span className="text-accent">■ Gross Royalty / Sale</span>
                <span className="text-teal">■ Net Profit After Ads</span>
              </div>
            </div>

            {/* Profit Scenarios Table */}
            <div className="rounded-xl border border-border-subtle bg-surface p-5 overflow-x-auto">
              <h3 className="text-sm font-semibold text-foreground">Estimated Profit Scenarios</h3>
              <table className="mt-3 w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border-subtle text-muted">
                    <th className="pb-2">Scenario</th>
                    <th className="pb-2">Units</th>
                    <th className="pb-2">Gross Royalty</th>
                    <th className="pb-2">Est. Ad Spend</th>
                    <th className="pb-2 text-right">Net Profit (Est.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle font-mono-tabular">
                  {profitResult.scenarios.map((sc) => (
                    <tr key={sc.label}>
                      <td className="py-2.5 font-sans font-medium text-foreground">{sc.label}</td>
                      <td className="py-2.5 text-secondary">{sc.units.toLocaleString()}</td>
                      <td className="py-2.5 text-secondary">{profitResult.currencySymbol}{sc.grossRoyalty.toFixed(2)}</td>
                      <td className="py-2.5 text-secondary">{profitResult.currencySymbol}{sc.adSpend.toFixed(2)}</td>
                      <td className={`py-2.5 text-right font-semibold ${sc.netProfit >= 0 ? 'text-teal' : 'text-rose-400'}`}>
                        {profitResult.currencySymbol}{sc.netProfit.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. AI BOOK PERFORMANCE LEARNING SYSTEM */}
      {activeTab === 'performance' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border-subtle bg-surface p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">AI Book Performance Learning System (User Data Isolated)</h2>
                <p className="text-xs text-muted">
                  Import your actual KDP sales & advertising CSV reports. Metrics are never fabricated; correlation never implies causation; future sales are never guaranteed.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-white hover:opacity-90">
                  <Upload className="h-3.5 w-3.5" /> Import KDP CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        const rows = parsePerformanceCsv(String(reader.result || ''));
                        if (rows.length) importPerformanceRows(rows);
                      };
                      reader.readAsText(f);
                    }}
                  />
                </label>
                <button
                  type="button"
                  disabled={performanceRows.length === 0}
                  onClick={() =>
                    downloadFile(
                      'my-kdp-performance-export.json',
                      JSON.stringify({ userId: user.id, exportedAt: new Date().toISOString(), rows: performanceRows }, null, 2),
                      'application/json'
                    )
                  }
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-border-subtle px-2.5 text-xs text-foreground disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" /> Export Data
                </button>
                <button
                  type="button"
                  disabled={performanceRows.length === 0}
                  onClick={clearPerformanceRows}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-500/30 px-2.5 text-xs text-rose-400 disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete All
                </button>
              </div>
            </div>

            <textarea
              rows={3}
              value={perfCsvText}
              onChange={(e) => setPerfCsvText(e.target.value)}
              placeholder={'Date,Book Title,Category,Format,Marketplace,Units Sold,List Price,Royalty USD,Ad Spend USD\n2026-11-01,Mindful Botanicals,Coloring Books,Paperback,amazon.com,42,12.99,198.24,48.00'}
              className="w-full rounded-lg border border-border-subtle bg-canvas p-2.5 font-mono text-xs text-foreground"
            />
            <button
              type="button"
              disabled={!perfCsvText.trim()}
              onClick={() => {
                const rows = parsePerformanceCsv(perfCsvText);
                if (rows.length) {
                  importPerformanceRows(rows);
                  setPerfCsvText('');
                }
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-subtle bg-elevated px-3 text-xs font-medium text-foreground disabled:opacity-40"
            >
              Parse & Import Pasted CSV Rows
            </button>
          </div>

          {performanceRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-subtle p-10 text-center text-sm text-secondary">
              No historical sales data imported for <strong>{user.email}</strong> yet. Upload your own KDP CSV report above to generate trend charts and observations.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-xl border border-border-subtle bg-surface p-4">
                  <span className="text-xs text-muted">Actual Units Sold</span>
                  <p className="mt-1 font-mono-tabular text-2xl font-bold text-foreground">{perfStats.totalUnits.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface p-4">
                  <span className="text-xs text-muted">Reported Royalties</span>
                  <p className="mt-1 font-mono-tabular text-2xl font-bold text-teal">${perfStats.totalRoyalty.toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface p-4">
                  <span className="text-xs text-muted">Reported Ad Spend</span>
                  <p className="mt-1 font-mono-tabular text-2xl font-bold text-secondary">${perfStats.totalAds.toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface p-4">
                  <span className="text-xs text-muted">Net After Ads</span>
                  <p className={`mt-1 font-mono-tabular text-2xl font-bold ${perfStats.netRoyalty >= 0 ? 'text-teal' : 'text-rose-400'}`}>
                    ${perfStats.netRoyalty.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-border-subtle bg-surface p-5">
                  <h3 className="text-sm font-semibold text-foreground">Book Performance Comparison</h3>
                  <div className="mt-3 space-y-2.5 text-xs">
                    {perfStats.byBook.map((b) => (
                      <div key={b.title} className="flex items-center justify-between border-b border-border-subtle pb-2">
                        <div>
                          <p className="font-medium text-foreground">{b.title}</p>
                          <p className="text-muted">Avg Price ${b.avgPrice.toFixed(2)} · Ads ${b.ads.toFixed(2)}</p>
                        </div>
                        <div className="text-right font-mono-tabular">
                          <p className="text-teal font-semibold">${b.royalty.toFixed(2)}</p>
                          <p className="text-muted">{b.units} units</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border-subtle bg-surface p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Observed Patterns & Future Suggestions</h3>
                  <p className="text-xs text-muted">
                    Advisory note: Historical patterns reflect correlation in your uploaded records, not proven causation or guaranteed future sales.
                  </p>
                  <ul className="space-y-1.5 text-xs text-secondary">
                    {perfStats.byBook[0] && (
                      <li>· Highest observed royalty contributor in uploaded data: <strong className="text-foreground">{perfStats.byBook[0].title}</strong>.</li>
                    )}
                    {perfStats.byMarketplace.map(([mp, v]) => (
                      <li key={mp}>· Marketplace <strong className="text-foreground">{mp}</strong>: {v.units} units · ${v.royalty.toFixed(2)} reported royalties.</li>
                    ))}
                    {perfStats.byFormat.map(([fmt, v]) => (
                      <li key={fmt}>· Format <strong className="text-foreground">{fmt}</strong>: {v.units} units · ${v.royalty.toFixed(2)} reported royalties.</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. AI BOOK PORTFOLIO MANAGEMENT SYSTEM */}
      {activeTab === 'portfolio' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border-subtle bg-surface p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-muted absolute left-2.5 top-2.5" />
                <input
                  value={portfolioSearch}
                  onChange={(e) => setPortfolioSearch(e.target.value)}
                  placeholder="Search portfolio books..."
                  className="h-9 pl-8 pr-3 rounded-lg border border-border-subtle bg-canvas text-xs text-foreground"
                />
              </div>
              <select
                value={portfolioCategory}
                onChange={(e) => setPortfolioCategory(e.target.value)}
                className="h-9 rounded-lg border border-border-subtle bg-canvas px-2.5 text-xs text-foreground"
              >
                <option value="All">All Categories</option>
                <option value="Coloring Books">Coloring Books</option>
                <option value="Children's Books">Children's Books</option>
                <option value="Puzzle Books">Puzzle Books</option>
                <option value="Journals">Journals</option>
              </select>
              <select
                value={portfolioSort}
                onChange={(e) => setPortfolioSort(e.target.value as 'updated' | 'progress' | 'pages')}
                className="h-9 rounded-lg border border-border-subtle bg-canvas px-2.5 text-xs text-foreground"
              >
                <option value="updated">Sort: Recently Updated</option>
                <option value="progress">Sort: Production Progress</option>
                <option value="pages">Sort: Page Count</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() =>
                downloadFile(
                  `portfolio-report-${new Date().toISOString().split('T')[0]}.json`,
                  JSON.stringify({ exportedAt: new Date().toISOString(), projects: filteredPortfolio, researchArchive: researchHistory }, null, 2),
                  'application/json'
                )
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-xs font-semibold text-white"
            >
              <Download className="h-3.5 w-3.5" /> Portfolio Report
            </button>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface p-5 overflow-x-auto">
            <h3 className="text-sm font-semibold text-foreground">Book Collection & Project Comparison ({filteredPortfolio.length})</h3>
            <table className="mt-3 w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border-subtle text-muted">
                  <th className="pb-2 pr-3">Book Title</th>
                  <th className="pb-2 pr-3">Category</th>
                  <th className="pb-2 pr-3">Production Status</th>
                  <th className="pb-2 pr-3">Trim / Pages</th>
                  <th className="pb-2 pr-3">Marketplace</th>
                  <th className="pb-2 pr-3">Progress</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredPortfolio.map((proj) => (
                  <tr key={proj.id}>
                    <td className="py-3 pr-3 font-medium text-foreground">{proj.title}</td>
                    <td className="py-3 pr-3 text-secondary">{proj.category}</td>
                    <td className="py-3 pr-3 text-teal">{proj.status}</td>
                    <td className="py-3 pr-3 font-mono-tabular text-secondary">{proj.trimSize}" · {proj.pageCount}p</td>
                    <td className="py-3 pr-3 text-secondary">{proj.marketplace}</td>
                    <td className="py-3 pr-3 font-mono-tabular text-foreground">{proj.progress}%</td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openProjectInEditor(proj.id)}
                        className="text-accent font-medium hover:underline"
                      >
                        Open Editor
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. PERSISTENT AI PROJECT MEMORY (PGVECTOR + 10 MEMORY TYPES) */}
      {activeTab === 'memory' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-4">
            <div className="rounded-xl border border-border-subtle bg-surface p-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Isolated Project Memory · {activeProject?.title}
                </h2>
                <p className="text-xs text-muted">
                  PostgreSQL + pgvector semantic memory strictly scoped to User {user.id} & Project {activeProject?.id}. Approved decisions are locked against silent overwrites.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={memSearch}
                  onChange={(e) => setMemSearch(e.target.value)}
                  placeholder="Semantic / tag search..."
                  className="h-8 rounded-lg border border-border-subtle bg-canvas px-2.5 text-xs text-foreground"
                />
                <select
                  value={memTypeFilter}
                  onChange={(e) => setMemTypeFilter(e.target.value as 'All' | ProjectMemoryType)}
                  className="h-8 rounded-lg border border-border-subtle bg-canvas px-2 text-xs text-foreground"
                >
                  <option value="All">All 10 Memory Types</option>
                  {MEMORY_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {memGuardNotice && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
                {memGuardNotice}
              </div>
            )}

            <div className="space-y-3">
              {isolatedMemories.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border-subtle p-8 text-center text-xs text-muted">
                  No memory records found for this project/filter. Unrelated projects are strictly isolated and never retrieved here.
                </div>
              ) : (
                isolatedMemories.map((m) => (
                  <div key={m.id} className="rounded-xl border border-border-subtle bg-surface p-4 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{m.title}</span>
                        <span className="text-muted">· {m.memoryType}</span>
                        <span className="font-mono-tabular text-muted">v{m.version}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {m.approvalLocked && (
                          <span className="inline-flex items-center gap-1 text-teal font-medium">
                            <Lock className="h-3 w-3" /> Approved & Protected
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const attempt = updateProjectMemory(
                              m.id,
                              { content: `${m.content} (Audited review)` },
                              user.name,
                              false
                            );
                            setMemGuardNotice(
                              attempt.ok
                                ? `Updated memory "${m.title}" with audit log entry.`
                                : attempt.error || 'Blocked overwrite.'
                            );
                          }}
                          className="text-muted hover:text-foreground underline"
                        >
                          Test Silent Edit
                        </button>
                      </div>
                    </div>
                    <p className="text-secondary leading-relaxed">{m.content}</p>
                    <p className="text-[11px] text-muted">
                      Audit Log ({m.auditTrail.length}): Latest "{m.auditTrail[m.auditTrail.length - 1]?.action}" by{' '}
                      {m.auditTrail[m.auditTrail.length - 1]?.actor}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Add Memory Record */}
          <div className="lg:col-span-4 rounded-xl border border-border-subtle bg-surface p-5 space-y-3 text-xs h-fit">
            <h3 className="text-sm font-semibold text-foreground">Record Auditable Project Memory</h3>
            <select
              value={newMemType}
              onChange={(e) => setNewMemType(e.target.value as ProjectMemoryType)}
              className="w-full h-9 rounded-lg border border-border-subtle bg-canvas px-2.5 text-foreground"
            >
              {MEMORY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              value={newMemTitle}
              onChange={(e) => setNewMemTitle(e.target.value)}
              placeholder="Memory decision title..."
              className="w-full h-9 rounded-lg border border-border-subtle bg-canvas px-2.5 text-foreground"
            />
            <textarea
              rows={4}
              value={newMemContent}
              onChange={(e) => setNewMemContent(e.target.value)}
              placeholder="Describe preferences, rejected ideas, approved outline rules, or export settings..."
              className="w-full rounded-lg border border-border-subtle bg-canvas p-2.5 text-foreground"
            />
            <label className="inline-flex items-center gap-2 text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={newMemApproved}
                onChange={(e) => setNewMemApproved(e.target.checked)}
              />
              Lock as Approved Decision (prevent silent AI overwrite)
            </label>
            <button
              type="button"
              onClick={() => {
                if (!activeProject || !newMemTitle.trim() || !newMemContent.trim()) return;
                addProjectMemory({
                  userId: user.id,
                  projectId: activeProject.id,
                  memoryType: newMemType,
                  title: newMemTitle.trim(),
                  content: newMemContent.trim(),
                  tags: [newMemType.toLowerCase()],
                  approved: newMemApproved,
                  actor: user.name,
                });
                setNewMemTitle('');
                setNewMemContent('');
              }}
              className="w-full inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-accent font-semibold text-white hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> Save to Project Memory
            </button>
          </div>
        </div>
      )}

      {/* 5. NOTIFICATION & SCHEDULED RESEARCH SYSTEM */}
      {activeTab === 'notifications' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-5">
            {/* Scheduled Research Rules (Strict Opt-In) */}
            <div className="rounded-xl border border-border-subtle bg-surface p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Scheduled Niche Research (Strict Opt-In)</h2>
                  <p className="text-xs text-muted">
                    Scheduled research NEVER runs automatically without an explicit user-configured schedule and permission toggle.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveSchedulesBackend}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-white"
                >
                  Save Schedule Config
                </button>
              </div>
              {scheduleSavedMsg && <p className="text-xs text-teal">{scheduleSavedMsg}</p>}

              <div className="space-y-3">
                {scheduledRules.map((rule) => (
                  <div key={rule.id} className="rounded-lg border border-border-subtle bg-canvas p-3.5 text-xs space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">{rule.name}</p>
                        <p className="text-muted">Query: "{rule.query}" · {rule.marketplace}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteScheduledRule(rule.id)}
                        className="text-muted hover:text-rose-400"
                        aria-label="Delete schedule"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border-subtle">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono-tabular text-secondary">
                        <Clock className="h-3 w-3" /> {rule.nextRunLabel}
                      </span>
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.userConsentGranted}
                            onChange={(e) => toggleScheduledRule(rule.id, rule.enabled, e.target.checked)}
                          />
                          Grant Permission
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={!rule.userConsentGranted}
                            checked={rule.enabled}
                            onChange={(e) => toggleScheduledRule(rule.id, e.target.checked, rule.userConsentGranted)}
                          />
                          Enabled
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Schedule Form */}
              <div className="border-t border-border-subtle pt-4 space-y-2.5 text-xs">
                <h3 className="font-semibold text-foreground">Add User-Configured Research Schedule</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    value={schName}
                    onChange={(e) => setSchName(e.target.value)}
                    placeholder="Schedule name..."
                    className="h-9 rounded-lg border border-border-subtle bg-canvas px-2.5 text-foreground"
                  />
                  <input
                    value={schQuery}
                    onChange={(e) => setSchQuery(e.target.value)}
                    placeholder="Niche research query..."
                    className="h-9 rounded-lg border border-border-subtle bg-canvas px-2.5 text-foreground"
                  />
                  <select
                    value={schCadence}
                    onChange={(e) => setSchCadence(e.target.value as 'Daily' | 'Weekly' | 'Bi-Weekly' | 'Monthly')}
                    className="h-9 rounded-lg border border-border-subtle bg-canvas px-2 text-foreground"
                  >
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Bi-Weekly">Bi-Weekly</option>
                    <option value="Monthly">Monthly</option>
                  </select>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={schConsent}
                      onChange={(e) => setSchConsent(e.target.checked)}
                    />
                    I explicitly authorize KDP Studio AI to run this scheduled research job.
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!schName.trim() || !schQuery.trim()) return;
                      addScheduledRule({
                        name: schName.trim(),
                        query: schQuery.trim(),
                        category: 'Coloring Books',
                        marketplace: 'amazon.com',
                        cadence: schCadence,
                        dayOfWeek: 'Monday',
                        runTimeLocal: '08:00',
                        enabled: schConsent,
                        userConsentGranted: schConsent,
                      });
                      setSchName('');
                      setSchQuery('');
                      setSchConsent(false);
                    }}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-border-subtle bg-elevated px-3 font-medium text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Schedule
                  </button>
                </div>
              </div>
            </div>

            {/* Notification History */}
            <div className="rounded-xl border border-border-subtle bg-surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Notification History ({notificationHistory.length})</h3>
                <button
                  type="button"
                  onClick={() =>
                    pushNotificationHistory({
                      channel: notificationPrefs.emailEnabled ? 'In-App + Email' : 'In-App',
                      category: 'Weekly Report',
                      title: 'Weekly KDP Opportunity Digest Prepared',
                      message: `Digest generated for timezone ${notificationPrefs.timezone}.`,
                    })
                  }
                  className="text-xs text-accent hover:underline"
                >
                  Send Test Notification
                </button>
              </div>
              <div className="divide-y divide-border-subtle">
                {notificationHistory.map((item) => (
                  <div key={item.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                    <div>
                      <p className={`font-medium ${item.read ? 'text-secondary' : 'text-foreground'}`}>
                        {item.title}
                      </p>
                      <p className="text-muted mt-0.5">{item.message}</p>
                      <p className="text-[10px] font-mono-tabular text-muted mt-1">
                        {item.category} · {item.channel} · {new Date(item.timestamp).toLocaleString()}
                      </p>
                    </div>
                    {!item.read && (
                      <button
                        type="button"
                        onClick={() => markHistoryRead(item.id)}
                        className="text-[11px] text-accent shrink-0 hover:underline"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Channel, Timezone & Trigger Preferences */}
          <div className="lg:col-span-5 rounded-xl border border-border-subtle bg-surface p-5 space-y-4 text-xs h-fit">
            <h3 className="text-sm font-semibold text-foreground">Channels, Timezone & Alert Triggers</h3>
            <div className="space-y-2.5">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-foreground">In-App Notifications</span>
                <input
                  type="checkbox"
                  checked={notificationPrefs.inAppEnabled}
                  onChange={(e) => updateNotificationPrefs({ inAppEnabled: e.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-foreground">Email Notifications</span>
                <input
                  type="checkbox"
                  checked={notificationPrefs.emailEnabled}
                  onChange={(e) => updateNotificationPrefs({ emailEnabled: e.target.checked })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-muted">Notification Email</span>
                <input
                  type="email"
                  value={notificationPrefs.emailAddress}
                  onChange={(e) => updateNotificationPrefs({ emailAddress: e.target.value })}
                  className="w-full h-9 rounded-lg border border-border-subtle bg-canvas px-2.5 text-foreground"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-muted">Timezone</span>
                <select
                  value={notificationPrefs.timezone}
                  onChange={(e) => updateNotificationPrefs({ timezone: e.target.value })}
                  className="w-full h-9 rounded-lg border border-border-subtle bg-canvas px-2.5 text-foreground"
                >
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Europe/Berlin">Europe/Berlin (CET)</option>
                  <option value="Asia/Dhaka">Asia/Dhaka (BST)</option>
                  <option value="UTC">UTC</option>
                </select>
              </label>
            </div>

            <div className="border-t border-border-subtle pt-3 space-y-2">
              <p className="font-semibold text-foreground">Enabled Event Notifications</p>
              {(
                [
                  ['scheduledNicheResearch', 'Scheduled Niche Research Runs'],
                  ['weeklyOpportunityReports', 'Weekly Opportunity Reports'],
                  ['seasonalAlerts', 'Seasonal Lead-Time Alerts'],
                  ['researchCompletion', 'Research Completion Notifications'],
                  ['approvalReminders', 'Approval Checkpoint Reminders'],
                  ['failedTasks', 'Failed Task Alerts'],
                  ['exportCompletion', 'Export Completion Notifications'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between text-secondary cursor-pointer">
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={notificationPrefs.triggers[key]}
                    onChange={(e) => updateNotificationTrigger(key, e.target.checked)}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
