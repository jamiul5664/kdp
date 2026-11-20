import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Plus, Sparkles, X } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { optimizeKdpListing } from '../../services/studioService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { ErrorState } from '../../components/shared/ErrorState';

const RESTRICTED_TRADEMARK_TERMS = [
  'amazon',
  'kindle',
  'kdp',
  'bestseller',
  'best seller',
  '#1',
  'number one',
  'free',
  'discount',
  'sale',
  'disney',
  'marvel',
  'pokemon',
  'lego',
  'barbie',
  'harry potter',
  'minecraft',
  'nike',
  'coca-cola',
  'star wars',
];

const SUGGESTED_BISAC_CATEGORIES = [
  'Crafts & Hobbies / Coloring Books',
  'Games & Activities / Logic & Brain Teasers',
  'Self-Help / Journaling',
  'Juvenile Fiction / Bedtime & Dreams',
  'Body, Mind & Spirit / Mindfulness & Meditation',
  'Games & Activities / Word & Word Search',
  'Education / Workbooks & Study Guides',
];

export default function SeoPage() {
  const projects = useAppStore((s) => s.projects);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const project = projects.find((p) => p.id === activeProjectId) ?? projects[0];

  const [title, setTitle] = React.useState(project.title);
  const [subtitle, setSubtitle] = React.useState(project.subtitle);
  const [authorName, setAuthorName] = React.useState(project.author);
  const [targetAudience, setTargetAudience] = React.useState('Adults & Hobby Readers');
  const [description, setDescription] = React.useState(
    'Discover a thoughtfully structured edition built for clarity, everyday engagement, and clean Amazon KDP print readability.'
  );
  const [keywords, setKeywords] = React.useState<string[]>([
    'stress relief botanical line art',
    'single sided adult coloring book',
    'wildflower nature illustrations gift',
    'mindful relaxation drawing pages',
    'botanical garden art workbook',
    'calm evening creative hobby',
    '',
  ]);
  const [categories, setCategories] = React.useState<string[]>([
    'Crafts & Hobbies / Coloring Books',
    'Body, Mind & Spirit / Mindfulness & Meditation',
  ]);
  const [customCategory, setCustomCategory] = React.useState('');

  React.useEffect(() => {
    setTitle(project.title);
    setSubtitle(project.subtitle);
    setAuthorName(project.author);
  }, [project.id, project.title, project.subtitle, project.author]);

  const seoMutation = useMutation({
    mutationFn: () =>
      optimizeKdpListing({
        title,
        subtitle,
        category: project.category,
        audience: targetAudience,
        author: authorName,
        notes: description,
      }),
    onSuccess: (data) => {
      if (data.optimizedTitle) setTitle(data.optimizedTitle);
      if (data.optimizedSubtitle) setSubtitle(data.optimizedSubtitle);
      if (Array.isArray(data.backendKeywords)) {
        const padded = Array.from({ length: 7 }, (_, i) => data.backendKeywords[i] || '');
        setKeywords(padded);
      }
      if (Array.isArray(data.bisacCategories) && data.bisacCategories.length > 0) {
        setCategories(data.bisacCategories.slice(0, 3));
      }
      if (data.htmlDescription) {
        setDescription(data.htmlDescription);
      }
    },
  });

  // Duplicate keyword detection (across 7 fields + repeated words from title/subtitle)
  const duplicateAnalysis = React.useMemo(() => {
    const titleWords = new Set(
      `${title} ${subtitle}`
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 4)
    );
    const seenPhrases = new Map<string, number[]>();
    const repeatedTitleWords: string[] = [];

    keywords.forEach((kw, idx) => {
      const normalized = kw.trim().toLowerCase();
      if (!normalized) return;
      seenPhrases.set(normalized, [...(seenPhrases.get(normalized) ?? []), idx + 1]);

      const words = normalized.split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
      for (const w of words) {
        if (titleWords.has(w) && !repeatedTitleWords.includes(w)) {
          repeatedTitleWords.push(w);
        }
      }
    });

    const duplicateSlots = Array.from(seenPhrases.entries()).filter(
      ([, slots]) => slots.length > 1
    );

    return { duplicateSlots, repeatedTitleWords };
  }, [keywords, title, subtitle]);

  // Trademark & KDP policy warning scanner
  const trademarkWarnings = React.useMemo(() => {
    const combined = `${title} ${subtitle} ${description} ${keywords.join(' ')}`.toLowerCase();
    return RESTRICTED_TRADEMARK_TERMS.filter((term) => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|\\W)${escaped}($|\\W)`, 'i').test(combined);
    });
  }, [title, subtitle, description, keywords]);

  // Deterministic Metadata Completeness Score
  const completeness = React.useMemo(() => {
    const filledKeywords = keywords.filter((k) => k.trim().length >= 3).length;
    const checks = [
      { label: 'Title populated (<= 200 chars)', ok: title.trim().length > 3 && title.length <= 200, weight: 15 },
      { label: 'Subtitle populated', ok: subtitle.trim().length > 5 && title.length + subtitle.length <= 200, weight: 10 },
      { label: 'Author name set', ok: authorName.trim().length >= 2, weight: 10 },
      { label: 'Target audience specified', ok: targetAudience.trim().length >= 3, weight: 10 },
      { label: 'Description >= 120 chars', ok: description.trim().length >= 120 && description.length <= 4000, weight: 15 },
      { label: 'All 7 backend keyword slots filled', ok: filledKeywords === 7, weight: 20 },
      { label: '2–3 BISAC categories selected', ok: categories.length >= 2, weight: 10 },
      { label: 'Zero trademark warnings', ok: trademarkWarnings.length === 0, weight: 10 },
    ];
    const score = checks.reduce((sum, c) => sum + (c.ok ? c.weight : 0), 0);
    return { score, checks, filledKeywords };
  }, [title, subtitle, authorName, targetAudience, description, keywords, categories, trademarkWarnings]);

  const combinedTitleChars = title.length + subtitle.length;

  const addCategory = (cat: string) => {
    const clean = cat.trim();
    if (!clean || categories.includes(clean) || categories.length >= 3) return;
    setCategories((prev) => [...prev, clean]);
    setCustomCategory('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            KDP SEO Optimizer
          </h1>
          <p className="text-sm text-secondary">
            Craft compliant Amazon KDP titles, 7 backend keyword slots, BISAC categories, and check
            for duplicate keywords or restricted trademark terms.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Select
            aria-label="Select book project"
            value={project.id}
            onChange={(e) => setActiveProjectId(e.target.value)}
            className="w-56"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>

          <Button
            disabled={seoMutation.isPending}
            onClick={() => seoMutation.mutate()}
          >
            <Sparkles className="h-4 w-4" />
            {seoMutation.isPending ? 'Generating AI Suggestions...' : 'AI SEO Suggestions'}
          </Button>
        </div>
      </div>

      {seoMutation.isError && (
        <ErrorState
          title="AI SEO suggestion failed"
          message={
            seoMutation.error instanceof Error ? seoMutation.error.message : 'Request failed.'
          }
          onRetry={() => seoMutation.mutate()}
        />
      )}

      {/* Warnings Bar: Trademark & Duplicate Keyword Alerts */}
      {(trademarkWarnings.length > 0 ||
        duplicateAnalysis.duplicateSlots.length > 0 ||
        duplicateAnalysis.repeatedTitleWords.length > 0) && (
        <div className="space-y-3">
          {trademarkWarnings.length > 0 && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3.5 flex items-start gap-3 text-sm"
            >
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Trademark &amp; KDP Policy Warning</p>
                <p className="text-xs text-secondary mt-0.5">
                  Detected restricted or trademarked term(s):{' '}
                  <span className="font-mono-tabular text-rose-300">
                    {trademarkWarnings.join(', ')}
                  </span>
                  . Remove promotional claims and third-party trademarks before publishing to Amazon
                  KDP.
                </p>
              </div>
            </div>
          )}

          {(duplicateAnalysis.duplicateSlots.length > 0 ||
            duplicateAnalysis.repeatedTitleWords.length > 0) && (
            <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3.5 flex items-start gap-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-foreground text-sm">Duplicate Keyword Warning</p>
                {duplicateAnalysis.duplicateSlots.length > 0 && (
                  <p className="text-secondary">
                    Exact duplicate phrases across slots:{' '}
                    {duplicateAnalysis.duplicateSlots
                      .map(([phrase, slots]) => `"${phrase}" (slots ${slots.join(', ')})`)
                      .join('; ')}
                    .
                  </p>
                )}
                {duplicateAnalysis.repeatedTitleWords.length > 0 && (
                  <p className="text-secondary">
                    Words already indexed in your Title/Subtitle (wasting backend slot space):{' '}
                    <span className="font-mono-tabular text-amber-300">
                      {duplicateAnalysis.repeatedTitleWords.join(', ')}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Core SEO Fields */}
        <div className="xl:col-span-8 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Listing Identity &amp; Description</CardTitle>
              <CardDescription>
                Amazon KDP enforces a combined 200-character limit across Title + Subtitle and a
                4,000-character limit for Book Description.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="seo-title" className="text-secondary font-medium">
                    Book Title
                  </label>
                  <span
                    className={`font-mono-tabular ${
                      combinedTitleChars > 200 ? 'text-rose-400' : 'text-muted'
                    }`}
                  >
                    {title.length} chars (Combined {combinedTitleChars}/200)
                  </span>
                </div>
                <Input
                  id="seo-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="seo-subtitle" className="text-secondary font-medium">
                    Subtitle
                  </label>
                  <span className="font-mono-tabular text-muted">{subtitle.length} chars</span>
                </div>
                <Input
                  id="seo-subtitle"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="seo-author" className="text-xs text-secondary font-medium">
                    Author Name
                  </label>
                  <Input
                    id="seo-author"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="seo-audience" className="text-xs text-secondary font-medium">
                    Target Audience
                  </label>
                  <Input
                    id="seo-audience"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="seo-desc" className="text-secondary font-medium">
                    Book Description (KDP HTML Supported)
                  </label>
                  <span
                    className={`font-mono-tabular ${
                      description.length > 4000 ? 'text-rose-400' : 'text-muted'
                    }`}
                  >
                    {description.length} / 4,000 chars
                  </span>
                </div>
                <textarea
                  id="seo-desc"
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg bg-canvas border border-border-subtle p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </div>
            </CardContent>
          </Card>

          {/* 7 Backend Keyword Fields */}
          <Card>
            <CardHeader>
              <CardTitle>Seven Backend Keyword Fields</CardTitle>
              <CardDescription>
                Each Amazon KDP keyword box supports up to 50 characters. Avoid repeating words
                already in your title or subtitle.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {keywords.map((kw, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor={`kw-${idx}`} className="text-secondary">
                      Keyword Slot {idx + 1}
                    </label>
                    <span
                      className={`font-mono-tabular ${
                        kw.length > 50 ? 'text-rose-400' : 'text-muted'
                      }`}
                    >
                      {kw.length}/50
                    </span>
                  </div>
                  <Input
                    id={`kw-${idx}`}
                    value={kw}
                    maxLength={60}
                    placeholder={`Enter search phrase ${idx + 1}...`}
                    onChange={(e) =>
                      setKeywords((prev) =>
                        prev.map((item, i) => (i === idx ? e.target.value : item))
                      )
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Category Suggestions */}
          <Card>
            <CardHeader>
              <CardTitle>KDP Category Suggestions (Up to 3 BISAC Paths)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {categories.map((cat) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between gap-3 rounded-lg bg-sidebar border border-border-subtle px-3.5 py-2 text-sm text-foreground"
                  >
                    <span>{cat}</span>
                    <button
                      type="button"
                      onClick={() => setCategories((prev) => prev.filter((c) => c !== cat))}
                      aria-label={`Remove ${cat}`}
                      className="text-muted hover:text-rose-400 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Add custom BISAC category path..."
                  disabled={categories.length >= 3}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!customCategory.trim() || categories.length >= 3}
                  onClick={() => addCategory(customCategory)}
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>

              <div className="pt-2 border-t border-border-subtle space-y-2">
                <p className="text-xs text-muted">Suggested KDP Categories (click to add):</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_BISAC_CATEGORIES.filter((c) => !categories.includes(c)).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      disabled={categories.length >= 3}
                      onClick={() => addCategory(cat)}
                      className="rounded-lg border border-border-subtle bg-sidebar hover:bg-surface-hover px-2.5 py-1.5 text-xs text-secondary hover:text-foreground transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      + {cat}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Metadata Completeness Score Card */}
        <div className="xl:col-span-4 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Metadata Completeness</CardTitle>
              <CardDescription>
                Deterministic checklist based on Amazon KDP listing requirements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-baseline justify-between">
                <span className="font-mono-tabular text-4xl font-bold text-foreground">
                  {completeness.score}%
                </span>
                <span className="text-xs font-mono-tabular text-teal">
                  {completeness.filledKeywords}/7 keyword slots
                </span>
              </div>

              <div className="h-2 w-full rounded-full bg-elevated overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-200"
                  style={{ width: `${completeness.score}%` }}
                />
              </div>

              <ul className="space-y-2.5 pt-2 border-t border-border-subtle text-xs">
                {completeness.checks.map((check) => (
                  <li key={check.label} className="flex items-start gap-2.5">
                    {check.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-teal shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <span className={check.ok ? 'text-foreground' : 'text-secondary'}>
                      {check.label}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
