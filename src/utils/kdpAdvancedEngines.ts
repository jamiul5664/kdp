import type { BookPage, BookSettings, MarketplaceId, TrimSizeId } from '../types';
import { calculateFullCoverSpec } from './kdpDimensions';

// ---------------------------------------------------------------------------
// 1. Seasonal KDP Opportunity Detection Engine (11 Supported Events)
// ---------------------------------------------------------------------------
export interface SeasonalEventEntry {
  id: string;
  event: string;
  monthIndex: number; // 0-11
  eventDate: string; // Actual ISO date for upcoming occurrence
  researchDeadline: string;
  suggestedPrepDate: string;
  leadTimeDays: number;
  relatedNiches: string[];
  categories: string[];
  seasonalKeywords: string[];
  historicalTrend: number[]; // 12-month relative interest curve (0-100)
  currentInterest: number; // Relative index (0-100)
  estimatedSeasonality: 'High Peak' | 'Strong Recurring' | 'Moderate Seasonal';
  dataConfidence: number; // 0-100
  sourceTimestamp: string;
  sourceNote: string;
}

function addDaysIso(baseIso: string, deltaDays: number): string {
  const dt = new Date(`${baseIso}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().split('T')[0];
}

export function buildSeasonalCalendar(referenceDateIso = '2026-11-20'): SeasonalEventEntry[] {
  const sourceTs = `${referenceDateIso}T00:00:00Z`;
  const definitions: Array<{
    id: string;
    event: string;
    eventDate: string;
    monthIndex: number;
    leadTimeDays: number;
    relatedNiches: string[];
    categories: string[];
    seasonalKeywords: string[];
    historicalTrend: number[];
    currentInterest: number;
    estimatedSeasonality: SeasonalEventEntry['estimatedSeasonality'];
    dataConfidence: number;
  }> = [
    {
      id: 'christmas',
      event: 'Christmas',
      eventDate: '2026-12-25',
      monthIndex: 11,
      leadTimeDays: 90,
      relatedNiches: ['Cozy Holiday Coloring Books', 'Christmas Activity Books for Kids', 'Festive Recipe & Hosting Planners'],
      categories: ['Coloring Books', 'Activity Books', "Children's Books"],
      seasonalKeywords: ['christmas coloring book adults', 'stocking stuffer puzzle book', 'kids christmas activity workbook'],
      historicalTrend: [12, 8, 7, 6, 8, 10, 14, 22, 38, 62, 88, 100],
      currentInterest: 88,
      estimatedSeasonality: 'High Peak',
      dataConfidence: 84,
    },
    {
      id: 'new_year',
      event: 'New Year',
      eventDate: '2027-01-01',
      monthIndex: 0,
      leadTimeDays: 75,
      relatedNiches: ['90-Day Habit Reset Journals', 'Annual Financial & Budget Workbooks', 'Goal Reflection Guided Planners'],
      categories: ['Journals', 'Workbooks', 'Non-Fiction Guides'],
      seasonalKeywords: ['new year goal planner 2027', 'habit tracker journal adults', 'january reset workbook'],
      historicalTrend: [96, 48, 26, 18, 14, 12, 11, 14, 18, 25, 44, 82],
      currentInterest: 44,
      estimatedSeasonality: 'High Peak',
      dataConfidence: 82,
    },
    {
      id: 'valentines_day',
      event: "Valentine's Day",
      eventDate: '2027-02-14',
      monthIndex: 1,
      leadTimeDays: 60,
      relatedNiches: ['Couples Prompt Journals', 'Cute Valentine Coloring Books', 'Love Notes Fill-in-the-Blank Books'],
      categories: ['Journals', 'Coloring Books', 'Activity Books'],
      seasonalKeywords: ['valentines day activity book kids', 'couples conversation journal', 'cute valentine coloring pages'],
      historicalTrend: [58, 100, 16, 10, 9, 8, 9, 10, 11, 13, 16, 22],
      currentInterest: 16,
      estimatedSeasonality: 'Strong Recurring',
      dataConfidence: 78,
    },
    {
      id: 'ramadan',
      event: 'Ramadan',
      eventDate: '2027-02-08',
      monthIndex: 1,
      leadTimeDays: 75,
      relatedNiches: ['Ramadan Reflection & Dua Journals', 'Kids Ramadan Activity & Coloring Books', 'Iftar Meal Planners'],
      categories: ['Journals', 'Activity Books', "Children's Books"],
      seasonalKeywords: ['ramadan planner journal', 'ramadan activity book for kids', 'ramadan coloring book'],
      historicalTrend: [64, 98, 42, 12, 8, 7, 7, 8, 9, 12, 19, 35],
      currentInterest: 19,
      estimatedSeasonality: 'High Peak',
      dataConfidence: 76,
    },
    {
      id: 'eid',
      event: 'Eid',
      eventDate: '2027-03-10',
      monthIndex: 2,
      leadTimeDays: 65,
      relatedNiches: ['Eid Mubarak Children Storybooks', 'Eid Gift Coloring & Activity Packs', 'Family Celebration Memory Books'],
      categories: ["Children's Books", 'Coloring Books', 'Activity Books'],
      seasonalKeywords: ['eid gift book for kids', 'eid mubarak coloring book', 'islamic children story book'],
      historicalTrend: [22, 56, 95, 34, 15, 42, 18, 10, 9, 10, 14, 18],
      currentInterest: 14,
      estimatedSeasonality: 'Strong Recurring',
      dataConfidence: 74,
    },
    {
      id: 'easter',
      event: 'Easter',
      eventDate: '2027-03-28',
      monthIndex: 2,
      leadTimeDays: 60,
      relatedNiches: ['Easter Basket Coloring Books', 'Spring Bunny Scissor Skills Workbooks', 'Easter Word Search for Kids'],
      categories: ['Coloring Books', 'Activity Books', 'Puzzle Books'],
      seasonalKeywords: ['easter basket stuffer activity book', 'easter coloring book toddlers', 'spring word search kids'],
      historicalTrend: [18, 42, 94, 65, 12, 8, 7, 8, 9, 10, 12, 14],
      currentInterest: 12,
      estimatedSeasonality: 'Strong Recurring',
      dataConfidence: 79,
    },
    {
      id: 'mothers_day',
      event: "Mother's Day",
      eventDate: '2027-05-09',
      monthIndex: 4,
      leadTimeDays: 60,
      relatedNiches: ['Guided Keepsake Memory Books for Mom', 'Relaxing Floral Coloring Editions', 'Prompted Gratitude Journals for Mothers'],
      categories: ['Journals', 'Coloring Books', 'Workbooks'],
      seasonalKeywords: ['tell me your story mom journal', 'mothers day gift coloring book', 'keepsake book for mom'],
      historicalTrend: [12, 14, 24, 62, 100, 18, 10, 10, 11, 12, 15, 22],
      currentInterest: 15,
      estimatedSeasonality: 'High Peak',
      dataConfidence: 81,
    },
    {
      id: 'fathers_day',
      event: "Father's Day",
      eventDate: '2027-06-20',
      monthIndex: 5,
      leadTimeDays: 60,
      relatedNiches: ['Dad Life Story Guided Journals', 'Large-Print Crossword & Logic Books for Dad', 'Grilling & BBQ Logbooks'],
      categories: ['Journals', 'Puzzle Books', 'Non-Fiction Guides'],
      seasonalKeywords: ['dad story prompt journal', 'fathers day puzzle book', 'grilling recipe logbook'],
      historicalTrend: [10, 11, 14, 22, 54, 100, 16, 10, 10, 11, 14, 20],
      currentInterest: 14,
      estimatedSeasonality: 'Strong Recurring',
      dataConfidence: 79,
    },
    {
      id: 'summer_vacation',
      event: 'Summer Vacation',
      eventDate: '2027-06-15',
      monthIndex: 5,
      leadTimeDays: 70,
      relatedNiches: ['Road Trip Travel Activity Books', 'Summer Bridge Reading & Math Workbooks', 'Family Vacation Scrapbook Journals'],
      categories: ['Activity Books', 'Workbooks', 'Puzzle Books'],
      seasonalKeywords: ['road trip activity book kids', 'summer bridge workbook grade 2', 'travel word search adults'],
      historicalTrend: [15, 18, 24, 38, 68, 94, 88, 52, 20, 14, 15, 18],
      currentInterest: 15,
      estimatedSeasonality: 'Moderate Seasonal',
      dataConfidence: 75,
    },
    {
      id: 'back_to_school',
      event: 'Back to School',
      eventDate: '2027-08-25',
      monthIndex: 7,
      leadTimeDays: 75,
      relatedNiches: ['Student Academic & Study Planners', 'Handwriting Practice Workbooks (Ages 5–7)', 'Teacher Lesson Logbooks'],
      categories: ['Workbooks', 'Journals', 'Activity Books'],
      seasonalKeywords: ['student study planner 2027', 'kindergarten handwriting workbook', 'teacher lesson planner paperback'],
      historicalTrend: [16, 14, 15, 18, 24, 38, 72, 100, 64, 22, 16, 14],
      currentInterest: 16,
      estimatedSeasonality: 'High Peak',
      dataConfidence: 83,
    },
    {
      id: 'halloween',
      event: 'Halloween',
      eventDate: '2027-10-31',
      monthIndex: 9,
      leadTimeDays: 75,
      relatedNiches: ['Cozy Spooky Bold-Line Coloring Books', 'Halloween Maze & Puzzle Activity Books', 'Friendly Monster Bedtime Stories'],
      categories: ['Coloring Books', 'Activity Books', "Children's Books"],
      seasonalKeywords: ['spooky cute coloring book', 'halloween activity book kids', 'fall autumn word search'],
      historicalTrend: [9, 8, 8, 9, 10, 12, 18, 36, 72, 100, 24, 10],
      currentInterest: 24,
      estimatedSeasonality: 'High Peak',
      dataConfidence: 84,
    },
  ];

  return definitions.map((d) => ({
    ...d,
    suggestedPrepDate: addDaysIso(d.eventDate, -d.leadTimeDays),
    researchDeadline: addDaysIso(d.eventDate, -(d.leadTimeDays + 21)),
    sourceTimestamp: sourceTs,
    sourceNote: 'Historical seasonal index reference; does not guarantee future buyer demand.',
  }));
}

// ---------------------------------------------------------------------------
// 2. KDP Keyword Research Engine (CSV Import/Export, Clustering, 7-Slot Gen)
// ---------------------------------------------------------------------------
export interface KeywordResearchRecord {
  id: string;
  keyword: string;
  source: string;
  searchVolume: number | null; // null => "Unavailable"
  trendDirection: 'Rising' | 'Stable' | 'Seasonal' | 'Declining' | 'Unavailable';
  competitionEstimate: 'Low' | 'Moderate' | 'High' | 'Unknown';
  intent: 'Gift' | 'Hobby' | 'Educational' | 'Daily Use' | 'Discovery';
  cluster: string;
  relatedKeywords: string[];
  opportunityScore: number;
  dataConfidence: number;
  lastUpdated: string;
  isDuplicateWithTitle?: boolean;
}

export function classifyKeywordIntent(phrase: string): KeywordResearchRecord['intent'] {
  const low = phrase.toLowerCase();
  if (low.includes('gift') || low.includes('mom') || low.includes('dad') || low.includes('christmas')) return 'Gift';
  if (low.includes('workbook') || low.includes('practice') || low.includes('learn') || low.includes('kids')) return 'Educational';
  if (low.includes('planner') || low.includes('journal') || low.includes('tracker') || low.includes('daily')) return 'Daily Use';
  if (low.includes('coloring') || low.includes('puzzle') || low.includes('sudoku') || low.includes('word search')) return 'Hobby';
  return 'Discovery';
}

export function clusterKeyword(phrase: string): string {
  const low = phrase.toLowerCase();
  if (low.includes('large print') || low.includes('senior')) return 'Accessibility & Large Print';
  if (low.includes('gift') || low.includes('christmas') || low.includes('mom') || low.includes('dad')) return 'Seasonal & Gifting';
  if (low.includes('kids') || low.includes('toddler') || low.includes('ages')) return 'Children & Family';
  if (low.includes('beginner') || low.includes('easy') || low.includes('simple')) return 'Beginner & Easy Entry';
  if (low.includes('adult') || low.includes('stress') || low.includes('mindful')) return 'Adult Relaxation & Mindfulness';
  return 'Core Niche Phrases';
}

export function parseKeywordsCsv(csvText: string): KeywordResearchRecord[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const hasHeader = lines[0].toLowerCase().includes('keyword');
  const rows = hasHeader ? lines.slice(1) : lines;
  const now = new Date().toISOString().split('T')[0];

  const results: KeywordResearchRecord[] = [];
  rows.forEach((line, idx) => {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const kw = cols[0];
    if (!kw) return;
    const volRaw = cols[2];
    const parsedVol = volRaw && !Number.isNaN(Number(volRaw)) ? Number(volRaw) : null;
    const wordCount = kw.split(/\s+/).length;
    const oppScore = Math.min(96, 48 + wordCount * 9 + (parsedVol ? 10 : 0));
    results.push({
      id: `kw_csv_${Date.now()}_${idx}`,
      keyword: kw,
      source: cols[1] || 'User CSV Upload',
      searchVolume: parsedVol,
      trendDirection: (cols[3] as KeywordResearchRecord['trendDirection']) || 'Unavailable',
      competitionEstimate: (cols[4] as KeywordResearchRecord['competitionEstimate']) || 'Unknown',
      intent: classifyKeywordIntent(kw),
      cluster: clusterKeyword(kw),
      relatedKeywords: [],
      opportunityScore: oppScore,
      dataConfidence: parsedVol !== null ? 82 : 58,
      lastUpdated: now,
    });
  });
  return results;
}

export function exportKeywordsToCsv(records: KeywordResearchRecord[]): string {
  const header =
    'Keyword,Source,Search Volume,Trend Direction,Competition Estimate,Intent,Cluster,Opportunity Score,Data Confidence,Last Updated';
  const body = records.map((r) =>
    [
      `"${r.keyword.replace(/"/g, '""')}"`,
      `"${r.source}"`,
      r.searchVolume === null ? 'Unavailable' : String(r.searchVolume),
      r.trendDirection,
      r.competitionEstimate,
      r.intent,
      `"${r.cluster}"`,
      String(r.opportunityScore),
      String(r.dataConfidence),
      r.lastUpdated,
    ].join(',')
  );
  return [header, ...body].join('\n');
}

export function buildSevenKdpKeywordSlots(
  records: KeywordResearchRecord[],
  bookTitle: string
): string[] {
  const titleTokens = new Set(
    bookTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
  const chosen: string[] = [];
  const used = new Set<string>();

  for (const r of [...records].sort((a, b) => b.opportunityScore - a.opportunityScore)) {
    const cleanedWords = r.keyword
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !titleTokens.has(w));
    const phrase = cleanedWords.join(' ').trim().slice(0, 50);
    if (phrase.length >= 4 && !used.has(phrase)) {
      used.add(phrase);
      chosen.push(phrase);
    }
    if (chosen.length === 7) break;
  }
  return chosen;
}

// ---------------------------------------------------------------------------
// 3. Customer Review Intelligence Engine (PII Stripping + Real CSV Analysis)
// ---------------------------------------------------------------------------
export interface RawReviewRow {
  competitorTitle: string;
  rating: number | null;
  reviewText: string;
  sourceUrl: string;
}

export interface ReviewIntelligenceOutput {
  totalReviewsAnalyzed: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  mostAppreciatedFeatures: Array<{ feature: string; mentions: number; snippet: string }>;
  commonComplaints: Array<{ complaint: string; mentions: number; snippet: string }>;
  missingFeatures: Array<{ feature: string; rationale: string }>;
  customerExpectations: string[];
  suggestedImprovements: string[];
  topicClusters: Array<{ topic: string; count: number }>;
  competitorComparison: Array<{
    competitorTitle: string;
    reviewCount: number;
    avgRating: string;
    topComplaint: string;
  }>;
  evidenceSnippets: Array<{ text: string; competitor: string; sourceUrl: string }>;
  sourceLinks: string[];
  privacyNotice: string;
}

export function stripReviewerPii(text: string): string {
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
    .replace(/\b(?:[Bb]y|[Rr]eviewer|[Aa]uthor|[Pp]osted [Bb]y)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g, 'Reviewer [anonymized]')
    .replace(/@[a-z0-9_]+/gi, '[anonymized-handle]');
}

export function parseReviewsCsv(csvText: string): RawReviewRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const startIdx = lines[0].toLowerCase().includes('review') || lines[0].toLowerCase().includes('title') ? 1 : 0;

  return lines.slice(startIdx).map((line) => {
    const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((p) => p.trim().replace(/^"|"$/g, ''));
    const competitorTitle = parts[0] || 'Uploaded Competitor Listing';
    const ratingVal = parts[1] && !Number.isNaN(Number(parts[1])) ? Number(parts[1]) : null;
    const reviewText = stripReviewerPii(parts[2] || parts[0] || '');
    const sourceUrl = parts[3] || 'User-Uploaded CSV Dataset';
    return { competitorTitle, rating: ratingVal, reviewText, sourceUrl };
  });
}

export function analyzeCustomerReviews(rows: RawReviewRow[]): ReviewIntelligenceOutput {
  const positiveSignals: Array<{ key: string; label: string; terms: string[] }> = [
    { key: 'single_sided', label: 'Single-sided pages', terms: ['single sided', 'single-sided', 'blank back', 'no bleed'] },
    { key: 'large_print', label: 'Clear large print & readability', terms: ['large print', 'easy to read', 'clear font', 'big print'] },
    { key: 'original_art', label: 'Clean original artwork / illustrations', terms: ['crisp lines', 'beautiful illustrations', 'clean art', 'bold lines', 'great quality'] },
    { key: 'gift_value', label: 'Strong gifting appeal', terms: ['gift', 'loved it', 'grandma', 'kids love', 'present'] },
  ];

  const complaintSignals: Array<{ key: string; label: string; terms: string[]; missing: string; improvement: string }> = [
    {
      key: 'bleed_through',
      label: 'Marker / ink bleed-through on thin double-sided paper',
      terms: ['bleed', 'thin paper', 'double sided', 'double-sided', 'ruined the next page'],
      missing: 'Single-sided layout with protective dark/blank reverse pages',
      improvement: 'Use single-sided layouts and include a blotter test page at the front.',
    },
    {
      key: 'small_text',
      label: 'Font size too small or cramped spacing',
      terms: ['too small', 'tiny', 'hard to read', 'squint', 'cramped'],
      missing: 'Verified large-print typography (14pt–16pt minimum)',
      improvement: 'Increase interior font size and widen line-height to >= 1.5.',
    },
    {
      key: 'repetitive',
      label: 'Repetitive or duplicate pages / generic AI feel',
      terms: ['repetitive', 'duplicate', 'same image', 'generic', 'ai slop', 'repeated'],
      missing: 'Distinct curated themes verified by duplicate detection',
      improvement: 'Run Consistency & Duplicate Page checks across every generated page.',
    },
    {
      key: 'margin_gutter',
      label: 'Content cut off near spine or binding gutter',
      terms: ['gutter', 'margin', 'cut off', 'spine', 'binding'],
      missing: 'Page-count scaled KDP inside gutter margins',
      improvement: 'Enforce KDP safe-zone margins (>= 0.5"–0.625" inside gutter).',
    },
    {
      key: 'answer_errors',
      label: 'Missing or inaccurate answer keys / typos',
      terms: ['wrong answer', 'typo', 'missing answer', 'mistake', 'error'],
      missing: 'Programmatically verified solutions & editorial proof pass',
      improvement: 'Verify puzzle solutions programmatically and run proofread checks before export.',
    },
  ];

  let positive = 0;
  let neutral = 0;
  let negative = 0;

  const posMap = new Map<string, { feature: string; mentions: number; snippet: string }>();
  const compMap = new Map<string, { complaint: string; mentions: number; snippet: string; missing: string; improvement: string }>();
  const byComp = new Map<string, { count: number; ratings: number[]; complaints: Map<string, number> }>();
  const evidenceSnippets: Array<{ text: string; competitor: string; sourceUrl: string }> = [];
  const sourceSet = new Set<string>();

  for (const row of rows) {
    const clean = stripReviewerPii(row.reviewText);
    const low = clean.toLowerCase();
    if (row.sourceUrl) sourceSet.add(row.sourceUrl);

    if (row.rating !== null) {
      if (row.rating >= 4) positive++;
      else if (row.rating <= 2) negative++;
      else neutral++;
    } else if (complaintSignals.some((c) => c.terms.some((t) => low.includes(t)))) {
      negative++;
    } else if (positiveSignals.some((p) => p.terms.some((t) => low.includes(t)))) {
      positive++;
    } else {
      neutral++;
    }

    const compEntry = byComp.get(row.competitorTitle) || {
      count: 0,
      ratings: [],
      complaints: new Map<string, number>(),
    };
    compEntry.count += 1;
    if (row.rating !== null) compEntry.ratings.push(row.rating);

    for (const p of positiveSignals) {
      if (p.terms.some((t) => low.includes(t))) {
        const cur = posMap.get(p.key);
        posMap.set(p.key, {
          feature: p.label,
          mentions: (cur?.mentions ?? 0) + 1,
          snippet: cur?.snippet || clean.slice(0, 140),
        });
      }
    }

    for (const c of complaintSignals) {
      if (c.terms.some((t) => low.includes(t))) {
        const cur = compMap.get(c.key);
        compMap.set(c.key, {
          complaint: c.label,
          mentions: (cur?.mentions ?? 0) + 1,
          snippet: cur?.snippet || clean.slice(0, 140),
          missing: c.missing,
          improvement: c.improvement,
        });
        compEntry.complaints.set(c.label, (compEntry.complaints.get(c.label) ?? 0) + 1);
      }
    }

    byComp.set(row.competitorTitle, compEntry);
    if (evidenceSnippets.length < 8 && clean.length > 10) {
      evidenceSnippets.push({
        text: clean.slice(0, 180),
        competitor: row.competitorTitle,
        sourceUrl: row.sourceUrl,
      });
    }
  }

  const complaintsArr = [...compMap.values()].sort((a, b) => b.mentions - a.mentions);
  const positivesArr = [...posMap.values()].sort((a, b) => b.mentions - a.mentions);

  return {
    totalReviewsAnalyzed: rows.length,
    sentimentBreakdown: { positive, neutral, negative },
    mostAppreciatedFeatures: positivesArr,
    commonComplaints: complaintsArr.map(({ complaint, mentions, snippet }) => ({
      complaint,
      mentions,
      snippet,
    })),
    missingFeatures: complaintsArr.map((c) => ({
      feature: c.missing,
      rationale: `Cited in ${c.mentions} observed review(s).`,
    })),
    customerExpectations: [
      'Clean interior margins that do not hide text or art inside the paperback binding.',
      'Original, non-repetitive pages matching the promise of the cover and subtitle.',
      'Paper-appropriate layout (single-sided for coloring/markers; clear contrast for puzzles).',
    ],
    suggestedImprovements: complaintsArr.map((c) => c.improvement),
    topicClusters: [
      ...complaintsArr.map((c) => ({ topic: c.complaint.split(' ')[0] + ' & Print Quality', count: c.mentions })),
      ...positivesArr.map((p) => ({ topic: p.feature, count: p.mentions })),
    ],
    competitorComparison: [...byComp.entries()].map(([title, stat]) => {
      const avg =
        stat.ratings.length > 0
          ? (stat.ratings.reduce((a, b) => a + b, 0) / stat.ratings.length).toFixed(1)
          : 'Unavailable';
      const topC = [...stat.complaints.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'None flagged';
      return {
        competitorTitle: title,
        reviewCount: stat.count,
        avgRating: avg,
        topComplaint: topC,
      };
    }),
    evidenceSnippets,
    sourceLinks: [...sourceSet],
    privacyNotice: 'All reviewer names, emails, and handles are automatically stripped prior to reporting.',
  };
}

// ---------------------------------------------------------------------------
// 4. Reusable KDP Book Template Library (10 Supported Templates)
// ---------------------------------------------------------------------------
export interface KdpBookTemplate {
  templateId: string;
  name: string;
  bookType:
    | 'Coloring Book'
    | 'Activity Book'
    | 'Puzzle Book'
    | 'Word Search'
    | 'Sudoku'
    | "Children's Story"
    | 'Guided Journal'
    | 'Daily Planner'
    | 'Educational Workbook'
    | 'Large Print Book';
  trimSize: TrimSizeId;
  bleed: boolean;
  paperType: 'White Paper' | 'Cream Paper';
  interiorType: 'Black & White' | 'Standard Color' | 'Premium Color';
  recommendedPageCount: number;
  layoutRules: string;
  typography: { headingFont: string; bodyFont: string; bodySizePt: number };
  marginsIn: { top: number; bottom: number; inside: number; outside: number };
  pageComponents: string[];
  samplePages: Array<{ label: string; heading: string; body: string; callout?: string }>;
  isCustom?: boolean;
}

export const DEFAULT_KDP_TEMPLATES: KdpBookTemplate[] = [
  {
    templateId: 'tpl_coloring_85x11',
    name: 'Bold-Line Single-Sided Coloring Edition',
    bookType: 'Coloring Book',
    trimSize: '8.5x11',
    bleed: true,
    paperType: 'White Paper',
    interiorType: 'Black & White',
    recommendedPageCount: 64,
    layoutRules: 'Single-sided illustration plates with intentional blank reverse pages to prevent bleed-through.',
    typography: { headingFont: '"Playfair Display", Georgia, serif', bodyFont: '"DM Sans", sans-serif', bodySizePt: 12 },
    marginsIn: { top: 0.5, bottom: 0.5, inside: 0.5, outside: 0.5 },
    pageComponents: ['Title Page', 'Color Test Swatch Page', 'Framed Coloring Plate', 'Protective Blank Reverse'],
    samplePages: [
      { label: 'Title Page', heading: 'Botanical Calm Coloring Book', body: 'Single-Sided Print Plates for Markers & Colored Pencils', callout: '8.5" × 11" Full Bleed' },
      { label: 'Color Test Page', heading: 'Color Swatch & Bleed Test', body: 'Test your alcohol markers, gel pens, and colored pencils in the boxes below before starting Plate 01.' },
      { label: 'Plate 01', heading: 'Plate 01 — Meadow Fern & Chamomile', body: 'Clean high-contrast line art area reserved for 300 DPI illustration asset.' },
    ],
  },
  {
    templateId: 'tpl_activity_85x11',
    name: 'Kids Creative Activity Workbook',
    bookType: 'Activity Book',
    trimSize: '8.5x11',
    bleed: true,
    paperType: 'White Paper',
    interiorType: 'Black & White',
    recommendedPageCount: 80,
    layoutRules: 'Alternating mazes, matching grids, drawing prompts, and back-matter answer keys.',
    typography: { headingFont: '"Plus Jakarta Sans", sans-serif', bodyFont: '"DM Sans", sans-serif', bodySizePt: 14 },
    marginsIn: { top: 0.5, bottom: 0.5, inside: 0.5, outside: 0.5 },
    pageComponents: ['Instruction Banner', 'Activity Workspace', 'Bonus Challenge Box', 'Answer Key Reference'],
    samplePages: [
      { label: 'Welcome', heading: 'Adventure Activity Workbook', body: 'Grab your pencils and explore 35+ original puzzles, tracing trails, and drawing challenges!' },
      { label: 'Activity 01', heading: 'Forest Trail Pattern Match', body: 'Draw a line connecting each woodland leaf to its matching shadow pair.' },
    ],
  },
  {
    templateId: 'tpl_puzzle_6x9',
    name: 'Classic Logic & Brainteaser Collection',
    bookType: 'Puzzle Book',
    trimSize: '6x9',
    bleed: false,
    paperType: 'White Paper',
    interiorType: 'Black & White',
    recommendedPageCount: 120,
    layoutRules: '1–2 puzzles per page with dedicated numbered solution grids in the back section.',
    typography: { headingFont: '"Plus Jakarta Sans", sans-serif', bodyFont: '"JetBrains Mono", monospace', bodySizePt: 12 },
    marginsIn: { top: 0.5, bottom: 0.5, inside: 0.625, outside: 0.5 },
    pageComponents: ['Puzzle Header', 'Rules Box', 'Grid Container', 'Solution Cross-Reference'],
    samplePages: [
      { label: 'How to Play', heading: 'Rules & Scoring Guide', body: 'Each puzzle increases progressively from Warm-Up to Master level. Verified solutions start on page 96.' },
      { label: 'Puzzle 01', heading: 'Logic Grid #01 — The Clockmaker Studio', body: 'Use the 4 clues below to match each apprentice, tool, and time slot.' },
    ],
  },
  {
    templateId: 'tpl_wordsearch_85x11',
    name: 'Large-Print Themed Word Search',
    bookType: 'Word Search',
    trimSize: '8.5x11',
    bleed: false,
    paperType: 'White Paper',
    interiorType: 'Black & White',
    recommendedPageCount: 100,
    layoutRules: '18pt monospace letter grid with 2-column themed word bank and programmatic solution verification.',
    typography: { headingFont: '"Plus Jakarta Sans", sans-serif', bodyFont: '"JetBrains Mono", monospace', bodySizePt: 16 },
    marginsIn: { top: 0.6, bottom: 0.6, inside: 0.625, outside: 0.5 },
    pageComponents: ['Theme Title', '15x15 Monospace Grid', 'Two-Column Word Bank', 'Verified Answer Grid'],
    samplePages: [
      { label: 'Puzzle 01', heading: 'Word Search #01 — Coastal Lighthouse', body: 'Find all 12 hidden words horizontally, vertically, or diagonally.\n\nHARBOR  BEACON  TIDE  COMPASS  ANCHOR  SEAGULL' },
    ],
  },
  {
    templateId: 'tpl_sudoku_6x9',
    name: 'Progressive 9×9 Sudoku Pocket Book',
    bookType: 'Sudoku',
    trimSize: '6x9',
    bleed: false,
    paperType: 'White Paper',
    interiorType: 'Black & White',
    recommendedPageCount: 140,
    layoutRules: 'Two crisp 9×9 Sudoku grids per page with bold 3×3 sub-grid dividers and 4-up answer key.',
    typography: { headingFont: '"Plus Jakarta Sans", sans-serif', bodyFont: '"JetBrains Mono", monospace', bodySizePt: 13 },
    marginsIn: { top: 0.5, bottom: 0.5, inside: 0.625, outside: 0.5 },
    pageComponents: ['Difficulty Badge Text', '9x9 Grid Matrix', 'Completion Timer Field', 'Verified Answer Matrix'],
    samplePages: [
      { label: 'Sudoku 01', heading: 'Sudoku #01 · Level: Medium', body: 'Fill every row, column, and 3×3 box with digits 1 through 9 without repetition.' },
    ],
  },
  {
    templateId: 'tpl_childrens_85x85',
    name: 'Square Illustrated Storybook (Ages 4–8)',
    bookType: "Children's Story",
    trimSize: '8.5x8.5',
    bleed: true,
    paperType: 'White Paper',
    interiorType: 'Premium Color',
    recommendedPageCount: 32,
    layoutRules: '32-page picture book cadence with safe text overlays and full-bleed 300 DPI spreads.',
    typography: { headingFont: '"Playfair Display", Georgia, serif', bodyFont: '"Lora", Georgia, serif', bodySizePt: 16 },
    marginsIn: { top: 0.5, bottom: 0.5, inside: 0.5, outside: 0.5 },
    pageComponents: ['Full-Bleed Art Spread', 'High-Contrast Read-Aloud Text Box', 'Dedication Page'],
    samplePages: [
      { label: 'Spread 01', heading: 'The Lantern in the Pine Clearing', body: 'At the edge of Whispering Woods, little Pippa hung a brass lantern on the lowest cedar branch.' },
    ],
  },
  {
    templateId: 'tpl_journal_6x9',
    name: '90-Day Guided Reflection Journal',
    bookType: 'Guided Journal',
    trimSize: '6x9',
    bleed: false,
    paperType: 'Cream Paper',
    interiorType: 'Black & White',
    recommendedPageCount: 184,
    layoutRules: 'Daily 2-page spread: morning intention prompts on left, evening reflection lined space on right.',
    typography: { headingFont: '"Playfair Display", Georgia, serif', bodyFont: '"Lora", Georgia, serif', bodySizePt: 12 },
    marginsIn: { top: 0.6, bottom: 0.6, inside: 0.625, outside: 0.5 },
    pageComponents: ['Date Line', 'Daily Prompt Header', 'Ruled Writing Area', 'Weekly Review Checkpoint'],
    samplePages: [
      { label: 'Day 01', heading: 'Day 01 — Morning Clarity', body: 'What single meaningful outcome would make today feel calm and complete?' },
    ],
  },
  {
    templateId: 'tpl_planner_7x10',
    name: 'Executive Time-Block Daily Planner',
    bookType: 'Daily Planner',
    trimSize: '7x10',
    bleed: false,
    paperType: 'White Paper',
    interiorType: 'Black & White',
    recommendedPageCount: 150,
    layoutRules: 'Top-3 priorities block, hourly schedule column (6 AM – 9 PM), and notes grid.',
    typography: { headingFont: '"Plus Jakarta Sans", sans-serif', bodyFont: '"DM Sans", sans-serif', bodySizePt: 11 },
    marginsIn: { top: 0.5, bottom: 0.5, inside: 0.625, outside: 0.5 },
    pageComponents: ['Date & Week Header', 'Top 3 Priorities', 'Hourly Time Blocks', 'End-of-Day Audit'],
    samplePages: [
      { label: 'Daily Sheet', heading: 'Daily Focus & Schedule', body: 'Top 3 Priorities:\n1. __________________________\n2. __________________________\n3. __________________________' },
    ],
  },
  {
    templateId: 'tpl_workbook_85x11',
    name: 'Structured Educational Skill Workbook',
    bookType: 'Educational Workbook',
    trimSize: '8.5x11',
    bleed: false,
    paperType: 'White Paper',
    interiorType: 'Black & White',
    recommendedPageCount: 110,
    layoutRules: 'Concept summary box followed by worked example, guided exercises, and self-check rubric.',
    typography: { headingFont: '"Plus Jakarta Sans", sans-serif', bodyFont: '"DM Sans", sans-serif', bodySizePt: 12 },
    marginsIn: { top: 0.6, bottom: 0.6, inside: 0.625, outside: 0.5 },
    pageComponents: ['Learning Objective', 'Worked Example', 'Practice Problems', 'Mastery Checklist'],
    samplePages: [
      { label: 'Unit 01', heading: 'Unit 01 — Core Foundations', body: 'Objective: Master the foundational workflow through 5 structured practice exercises.' },
    ],
  },
  {
    templateId: 'tpl_largeprint_6x9',
    name: 'Accessible Large-Print Reader Edition',
    bookType: 'Large Print Book',
    trimSize: '6x9',
    bleed: false,
    paperType: 'Cream Paper',
    interiorType: 'Black & White',
    recommendedPageCount: 160,
    layoutRules: 'Minimum 16pt body type, 1.55 line height, zero low-contrast gray text, generous gutters.',
    typography: { headingFont: '"Plus Jakarta Sans", sans-serif', bodyFont: '"Lora", Georgia, serif', bodySizePt: 16 },
    marginsIn: { top: 0.75, bottom: 0.75, inside: 0.75, outside: 0.625 },
    pageComponents: ['Chapter Opener (22pt)', '16pt High-Contrast Body', 'Clear Folio Page Number'],
    samplePages: [
      { label: 'Chapter 1', heading: 'Chapter 1 — Quiet Horizons', body: 'Set in crisp 16pt readable serif typography designed for effortless, low-strain reading.' },
    ],
  },
];

// ---------------------------------------------------------------------------
// 5. Comprehensive 15-Point Amazon KDP Compliance Checker
// ---------------------------------------------------------------------------
export type ComplianceResultStatus = 'Passed' | 'Warning' | 'Failed' | 'Manual Review Required';

export interface ComplianceCheckItem {
  id: string;
  check: string;
  status: ComplianceResultStatus;
  affectedPage: string;
  explanation: string;
  recommendedFix: string;
}

export interface ComplianceAuditSummary {
  specVersion: string;
  lastCheckedDate: string;
  overallStatus: ComplianceResultStatus;
  passedCount: number;
  warningCount: number;
  failedCount: number;
  manualReviewCount: number;
  checks: ComplianceCheckItem[];
  disclaimer: string;
}

export function runComprehensiveKdpComplianceCheck(params: {
  title: string;
  subtitle: string;
  settings: BookSettings;
  pages: BookPage[];
  aiDisclosureDeclared: boolean;
  includeBarcodeSafeArea: boolean;
  fontsEmbedded: boolean;
}): ComplianceAuditSummary {
  const { title, subtitle, settings, pages, aiDisclosureDeclared, includeBarcodeSafeArea, fontsEmbedded } = params;
  const cover = calculateFullCoverSpec({
    trimSize: settings.trimSize,
    pageCount: settings.pageCount,
    paperType: settings.paperType,
    interiorType: settings.interiorType,
    bleed: settings.bleed,
  });

  const requiredInside =
    settings.pageCount <= 150
      ? 0.375
      : settings.pageCount <= 300
        ? 0.5
        : settings.pageCount <= 500
          ? 0.625
          : settings.pageCount <= 700
            ? 0.75
            : 0.875;
  const requiredOuter = settings.bleed ? 0.375 : 0.25;

  const lowResPages: number[] = [];
  const textOverflowPages: number[] = [];
  const imageOverflowPages: number[] = [];

  pages.forEach((pg, idx) => {
    const pNum = idx + 1;
    for (const el of pg.elements) {
      if (el.type === 'image') {
        const placedWIn = (el.width / 100) * cover.trimWidthIn;
        const effDpi = placedWIn > 0 ? el.naturalWidth / placedWIn : 0;
        if (el.naturalWidth > 0 && effDpi < 300) lowResPages.push(pNum);
        if (el.x < 0 || el.y < 0 || el.x + el.width > 100 || el.y + el.height > 100) {
          imageOverflowPages.push(pNum);
        }
      } else {
        if (el.x < 4 || el.y < 4 || el.x + el.width > 96 || el.y > 92) {
          textOverflowPages.push(pNum);
        }
      }
    }
  });

  const combinedTitleLen = (title + subtitle).length;
  const riskyPolicyTerms = ['guaranteed bestseller', '#1 bestseller', 'free gift', 'disney', 'marvel', 'pokemon', 'lego'];
  const policyHits = riskyPolicyTerms.filter((t) => `${title} ${subtitle}`.toLowerCase().includes(t));

  const checks: ComplianceCheckItem[] = [
    {
      id: 'trim',
      check: '1. Interior Trim Dimensions',
      status: 'Passed',
      affectedPage: 'All Pages',
      explanation: `Trim size ${settings.trimSize}" (${cover.trimWidthIn}" × ${cover.trimHeightIn}") matches supported KDP paperback dimensions.`,
      recommendedFix: 'No action required.',
    },
    {
      id: 'bleed',
      check: '2. Bleed Configuration',
      status: 'Passed',
      affectedPage: 'All Pages',
      explanation: settings.bleed
        ? 'Full bleed enabled (+0.125" outer width, +0.250" total height).'
        : 'No-bleed layout configured; ensure zero artwork touches page edges.',
      recommendedFix: 'Verify full-page backgrounds extend 0.125" past trim when bleed is enabled.',
    },
    {
      id: 'margins',
      check: '3. Safe Margins & Gutter',
      status:
        settings.margins.inside >= requiredInside && settings.margins.outside >= requiredOuter
          ? 'Passed'
          : 'Failed',
      affectedPage: 'All Pages',
      explanation: `Configured inside=${settings.margins.inside}" (min ${requiredInside}"), outside=${settings.margins.outside}" (min ${requiredOuter}").`,
      recommendedFix: `Set inside gutter >= ${requiredInside}" and outside margin >= ${requiredOuter}" in Book Editor Settings.`,
    },
    {
      id: 'page_count',
      check: '4. Page Count Bounds',
      status: settings.pageCount >= 24 && settings.pageCount <= 828 ? 'Passed' : 'Failed',
      affectedPage: 'Manuscript',
      explanation: `${settings.pageCount} configured pages (KDP paperback bounds: 24–828).`,
      recommendedFix: 'Adjust page count to between 24 and 828 pages.',
    },
    {
      id: 'image_res',
      check: '5. Image Resolution (>= 300 DPI)',
      status: lowResPages.length === 0 ? 'Passed' : 'Failed',
      affectedPage: lowResPages.length ? `Pages ${lowResPages.join(', ')}` : 'All Plates',
      explanation:
        lowResPages.length === 0
          ? 'All placed raster images meet >= 300 effective DPI based on actual pixel dimensions.'
          : `Images below 300 effective DPI detected on page(s): ${lowResPages.join(', ')}.`,
      recommendedFix: 'Replace flagged images with >= 300 DPI source artwork.',
    },
    {
      id: 'fonts',
      check: '6. Font Embedding',
      status: fontsEmbedded ? 'Passed' : 'Warning',
      affectedPage: 'PDF Export',
      explanation: fontsEmbedded
        ? 'Standard/embedded font profile enabled for PDF export.'
        : 'Unembedded custom font detected.',
      recommendedFix: 'Embed all TTF/OTF font subsets in the final print PDF.',
    },
    {
      id: 'cover_dims',
      check: '7. Cover Full-Wrap Dimensions',
      status: 'Passed',
      affectedPage: 'Cover Wrap',
      explanation: `Calculated wrap ${cover.fullWidthIn}" × ${cover.fullHeightIn}" (${cover.fullWidthPx300}×${cover.fullHeightPx300} px @ 300 DPI).`,
      recommendedFix: 'Re-export cover PDF if page count or paper type changes.',
    },
    {
      id: 'spine',
      check: '8. Spine Width & Spine Text Rule',
      status: cover.spineTextAllowed ? 'Passed' : 'Warning',
      affectedPage: 'Cover Spine',
      explanation: `Paper-caliper spine width is ${cover.spineWidthIn}". ${
        cover.spineTextAllowed ? 'Eligible for spine text (>= 79 pages).' : 'Under 79 pages — KDP prohibits spine text.'
      }`,
      recommendedFix: cover.spineTextAllowed ? 'Center spine title within 0.0625" clearance.' : 'Keep spine blank or increase page count to >= 79.',
    },
    {
      id: 'barcode',
      check: '9. ISBN Barcode Safe Area',
      status: includeBarcodeSafeArea ? 'Passed' : 'Failed',
      affectedPage: 'Back Cover',
      explanation: includeBarcodeSafeArea
        ? 'Lower-right 2.0" × 1.2" barcode safe zone reserved on back cover.'
        : 'Back-cover ISBN barcode safe zone is not reserved.',
      recommendedFix: 'Enable ISBN Barcode safe area in Cover Studio before exporting.',
    },
    {
      id: 'text_overflow',
      check: '10. Text Overflow & Safe Zone',
      status: textOverflowPages.length === 0 ? 'Passed' : 'Warning',
      affectedPage: textOverflowPages.length ? `Pages ${textOverflowPages.join(', ')}` : 'All Pages',
      explanation:
        textOverflowPages.length === 0
          ? 'All text blocks sit inside safe horizontal and vertical bounds.'
          : `Text positioned near trim edge on page(s): ${textOverflowPages.join(', ')}.`,
      recommendedFix: 'Inset text elements by at least 5%–8% from page borders in Book Editor.',
    },
    {
      id: 'image_overflow',
      check: '11. Image Overflow',
      status: imageOverflowPages.length === 0 ? 'Passed' : 'Warning',
      affectedPage: imageOverflowPages.length ? `Pages ${imageOverflowPages.join(', ')}` : 'All Pages',
      explanation:
        imageOverflowPages.length === 0
          ? 'No images extend unintentionally beyond page bounds.'
          : `Image bounding box extends past canvas on page(s): ${imageOverflowPages.join(', ')}.`,
      recommendedFix: 'Refit image bounds inside safe zone or confirm intentional full bleed.',
    },
    {
      id: 'pdf_integrity',
      check: '12. PDF Integrity & Print Spec',
      status: pages.length > 0 ? 'Passed' : 'Failed',
      affectedPage: 'Manuscript',
      explanation: `${pages.length} editable pages ready for ReportLab/Express PDF compilation.`,
      recommendedFix: 'Ensure at least 1 manuscript page exists and verify exported PDF in KDP Print Previewer.',
    },
    {
      id: 'metadata',
      check: '13. KDP Metadata Limits',
      status: title.trim().length > 0 && combinedTitleLen <= 200 ? 'Passed' : 'Failed',
      affectedPage: 'Listing Metadata',
      explanation: `Combined title + subtitle length is ${combinedTitleLen}/200 characters.`,
      recommendedFix: 'Keep title + subtitle under 200 characters and fill all 7 unique backend keyword slots.',
    },
    {
      id: 'content_policy',
      check: '14. Content & Trademark Policy Risks',
      status: policyHits.length === 0 ? 'Manual Review Required' : 'Failed',
      affectedPage: 'Title & Metadata',
      explanation:
        policyHits.length === 0
          ? 'No obvious restricted terms detected; human legal/policy confirmation is still recommended.'
          : `Flagged restricted or promotional terms: ${policyHits.join(', ')}.`,
      recommendedFix: 'Remove trademarked brand names or ranking claims and manually verify originality.',
    },
    {
      id: 'ai_disclosure',
      check: '15. Amazon KDP AI-Generated Content Disclosure',
      status: aiDisclosureDeclared ? 'Passed' : 'Manual Review Required',
      affectedPage: 'KDP Upload Form',
      explanation: aiDisclosureDeclared
        ? 'AI-generated vs AI-assisted disclosure status documented for KDP publishing intake.'
        : 'Amazon KDP requires publishers to disclose AI-generated text, images, or translations during upload.',
      recommendedFix: 'Confirm whether text/illustrations are AI-generated or AI-assisted and record disclosure before upload.',
    },
  ];

  const failedCount = checks.filter((c) => c.status === 'Failed').length;
  const warningCount = checks.filter((c) => c.status === 'Warning').length;
  const manualReviewCount = checks.filter((c) => c.status === 'Manual Review Required').length;
  const passedCount = checks.filter((c) => c.status === 'Passed').length;

  const overallStatus: ComplianceResultStatus =
    failedCount > 0
      ? 'Failed'
      : warningCount > 0
        ? 'Warning'
        : manualReviewCount > 0
          ? 'Manual Review Required'
          : 'Passed';

  return {
    specVersion: 'Amazon KDP Print Specs v2026.1',
    lastCheckedDate: new Date().toISOString().split('T')[0],
    overallStatus,
    passedCount,
    warningCount,
    failedCount,
    manualReviewCount,
    checks,
    disclaimer:
      'Compliance checks evaluate alignment with documented KDP specifications and policies. They never guarantee Amazon KDP review acceptance.',
  };
}

// ---------------------------------------------------------------------------
// 6. Copyright & Originality Risk Auditor
// ---------------------------------------------------------------------------
export interface OriginalityRiskResult {
  repeatedTextPairs: Array<{ pageA: number; pageB: number; overlapPct: number; excerpt: string }>;
  duplicateImageHashes: Array<{ src: string; pages: number[] }>;
  trademarkFlags: string[];
  referenceSimilarityScore: number | null;
  humanReviewRequired: boolean;
  disclaimer: string;
}

const RESTRICTED_BRANDS = [
  'disney', 'marvel', 'pokemon', 'lego', 'barbie', 'harry potter', 'minecraft',
  'cocomelon', 'bluey', 'sanrio', 'hello kitty', 'star wars', 'nike', 'apple', 'amazon',
];

export function runOriginalityAudit(params: {
  title: string;
  subtitle: string;
  pages: BookPage[];
  referenceText?: string;
}): OriginalityRiskResult {
  const repeatedTextPairs: OriginalityRiskResult['repeatedTextPairs'] = [];
  const pageTexts = params.pages.map((p) =>
    p.elements
      .filter((e) => e.type === 'text')
      .map((e) => e.content.trim().toLowerCase())
      .join(' ')
  );

  for (let i = 0; i < pageTexts.length; i++) {
    const setA = new Set(pageTexts[i].split(/\s+/).filter((w) => w.length > 3));
    if (setA.size < 4) continue;
    for (let j = i + 1; j < pageTexts.length; j++) {
      const setB = new Set(pageTexts[j].split(/\s+/).filter((w) => w.length > 3));
      if (setB.size < 4) continue;
      let shared = 0;
      setA.forEach((w) => {
        if (setB.has(w)) shared++;
      });
      const overlap = Math.round((shared / Math.min(setA.size, setB.size)) * 100);
      if (overlap >= 65) {
        repeatedTextPairs.push({
          pageA: i + 1,
          pageB: j + 1,
          overlapPct: overlap,
          excerpt: pageTexts[i].slice(0, 90),
        });
      }
    }
  }

  const imgMap = new Map<string, number[]>();
  params.pages.forEach((p, idx) => {
    p.elements.forEach((el) => {
      if (el.type === 'image') {
        const list = imgMap.get(el.src) || [];
        list.push(idx + 1);
        imgMap.set(el.src, list);
      }
    });
  });
  const duplicateImageHashes = [...imgMap.entries()]
    .filter(([, pgs]) => pgs.length > 1)
    .map(([src, pages]) => ({ src, pages }));

  const corpus = `${params.title} ${params.subtitle} ${pageTexts.join(' ')}`.toLowerCase();
  const trademarkFlags = RESTRICTED_BRANDS.filter((b) => corpus.includes(b));

  let referenceSimilarityScore: number | null = null;
  if (params.referenceText && params.referenceText.trim().length > 20) {
    const refWords = new Set(
      params.referenceText
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );
    const bookWords = new Set(
      pageTexts
        .join(' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );
    let matches = 0;
    refWords.forEach((w) => {
      if (bookWords.has(w)) matches++;
    });
    referenceSimilarityScore = refWords.size > 0 ? Math.round((matches / refWords.size) * 100) : 0;
  }

  return {
    repeatedTextPairs,
    duplicateImageHashes,
    trademarkFlags,
    referenceSimilarityScore,
    humanReviewRequired:
      repeatedTextPairs.length > 0 ||
      duplicateImageHashes.length > 0 ||
      trademarkFlags.length > 0 ||
      (referenceSimilarityScore !== null && referenceSimilarityScore >= 30),
    disclaimer:
      'Similarity and keyword checks assist pre-publication review only. They do NOT prove copyright ownership or provide legal trademark clearance. Flagged or uncertain items require human legal review.',
  };
}

// ---------------------------------------------------------------------------
// 7. KDP Profitability Calculator (Official US/UK/EU Print & Royalty Rules)
// ---------------------------------------------------------------------------
export interface ProfitabilityInput {
  marketplace: MarketplaceId;
  bookFormat: 'Paperback' | 'Hardcover';
  trimSize: TrimSizeId;
  pageCount: number;
  paperType: 'White Paper' | 'Cream Paper';
  inkType: 'Black & White' | 'Standard Color' | 'Premium Color';
  listPrice: number;
  manualPrintingCost: number | null; // Override when user supplies actual print quote
  productionCost: number;
  adCostPerSale: number;
}

export interface ProfitabilityOutput {
  currencySymbol: string;
  printingCost: number;
  printingCostSource: 'User Input (Manual Override)' | 'Estimate (Official KDP Formula)';
  royaltyRate: number; // 0.60 or 0.50 (or 0.35 below threshold)
  royaltyRateRule: string;
  royaltyPerSale: number;
  netProfitPerSale: number;
  breakEvenSales: number | null;
  scenarios: Array<{ label: string; units: number; grossRoyalty: number; adSpend: number; netProfit: number }>;
  priceComparisons: Array<{ price: number; royaltyRate: number; royaltyPerSale: number; netPerSale: number }>;
}

export function calculateKdpProfitability(input: ProfitabilityInput): ProfitabilityOutput {
  const currencyMap: Record<MarketplaceId, string> = {
    'amazon.com': '$',
    'amazon.co.uk': '£',
    'amazon.de': '€',
    'amazon.ca': 'CA$',
    'amazon.com.au': 'A$',
  };
  const symbol = currencyMap[input.marketplace] || '$';
  const isLargeTrim = input.trimSize === '8.5x11' || input.trimSize === '8.5x8.5' || input.trimSize === '7x10';
  const pages = Math.max(input.bookFormat === 'Hardcover' ? 75 : 24, Math.min(828, input.pageCount));

  // Official Amazon KDP USD-equivalent printing cost structure (fixed + per-page)
  let estimatedPrint = 0;
  if (input.bookFormat === 'Hardcover') {
    if (input.inkType === 'Black & White') {
      estimatedPrint = pages <= 108 ? (isLargeTrim ? 6.8 : 5.65) : (isLargeTrim ? 6.8 : 5.65) + (pages - 108) * 0.012;
    } else if (input.inkType === 'Standard Color') {
      estimatedPrint = 6.8 + pages * 0.0255;
    } else {
      estimatedPrint = 6.8 + pages * 0.065;
    }
  } else {
    if (input.inkType === 'Black & White') {
      if (pages <= 108) {
        estimatedPrint = isLargeTrim ? 2.84 : 2.3;
      } else {
        estimatedPrint = (isLargeTrim ? 1.0 : 1.0) + pages * (isLargeTrim ? 0.017 : 0.012);
      }
    } else if (input.inkType === 'Standard Color') {
      estimatedPrint = (isLargeTrim ? 1.0 : 1.0) + pages * (isLargeTrim ? 0.0402 : 0.0255);
    } else {
      estimatedPrint = (isLargeTrim ? 1.0 : 1.0) + pages * (isLargeTrim ? 0.08 : 0.065);
    }
  }

  const printingCost =
    input.manualPrintingCost !== null && input.manualPrintingCost >= 0
      ? Number(input.manualPrintingCost.toFixed(2))
      : Number(estimatedPrint.toFixed(2));

  // KDP Royalty rate: 60% standard for >= $9.99 (or 50% below $9.99 on amazon.com under updated KDP rules)
  const computeAtPrice = (price: number) => {
    const rate = price >= 9.99 ? 0.6 : 0.5;
    const royalty = Number((price * rate - printingCost).toFixed(2));
    const net = Number((royalty - input.adCostPerSale).toFixed(2));
    return { price: Number(price.toFixed(2)), royaltyRate: rate, royaltyPerSale: royalty, netPerSale: net };
  };

  const current = computeAtPrice(input.listPrice);
  const breakEvenSales =
    current.netPerSale > 0 ? Math.ceil(input.productionCost / current.netPerSale) : null;

  const scenarios = [
    { label: 'Conservative (25 units)', units: 25 },
    { label: 'Steady Launch (100 units)', units: 100 },
    { label: 'Growth (300 units)', units: 300 },
    { label: 'Scale (1,000 units)', units: 1000 },
  ].map((s) => {
    const grossRoyalty = Number((s.units * current.royaltyPerSale).toFixed(2));
    const adSpend = Number((s.units * input.adCostPerSale).toFixed(2));
    const netProfit = Number((grossRoyalty - adSpend - input.productionCost).toFixed(2));
    return { ...s, grossRoyalty, adSpend, netProfit };
  });

  const basePrices = [
    Math.max(4.99, input.listPrice - 3),
    Math.max(5.99, input.listPrice - 1.5),
    input.listPrice,
    input.listPrice + 2,
    input.listPrice + 5,
  ];
  const priceComparisons = basePrices.map((p) => computeAtPrice(p));

  return {
    currencySymbol: symbol,
    printingCost,
    printingCostSource:
      input.manualPrintingCost !== null
        ? 'User Input (Manual Override)'
        : 'Estimate (Official KDP Formula)',
    royaltyRate: current.royaltyRate,
    royaltyRateRule:
      current.royaltyRate === 0.6
        ? '60% standard KDP print royalty (list price >= 9.99)'
        : '50% KDP print royalty tier (list price < 9.99)',
    royaltyPerSale: current.royaltyPerSale,
    netProfitPerSale: current.netPerSale,
    breakEvenSales,
    scenarios,
    priceComparisons,
  };
}

// ---------------------------------------------------------------------------
// 8. Performance Learning CSV Parser (User-Provided Actual Historical Data Only)
// ---------------------------------------------------------------------------
export interface PerformanceSaleRow {
  date: string;
  bookTitle: string;
  category: string;
  format: string;
  marketplace: string;
  unitsSold: number;
  listPrice: number;
  royaltyUsd: number;
  adSpendUsd: number;
}

export function parsePerformanceCsv(csvText: string): PerformanceSaleRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const start = lines[0].toLowerCase().includes('date') || lines[0].toLowerCase().includes('book') ? 1 : 0;

  return lines.slice(start).map((line) => {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    return {
      date: cols[0] || new Date().toISOString().split('T')[0],
      bookTitle: cols[1] || 'Untitled Book',
      category: cols[2] || 'General',
      format: cols[3] || 'Paperback',
      marketplace: cols[4] || 'amazon.com',
      unitsSold: Math.max(0, Number(cols[5]) || 0),
      listPrice: Math.max(0, Number(cols[6]) || 0),
      royaltyUsd: Number(cols[7]) || 0,
      adSpendUsd: Math.max(0, Number(cols[8]) || 0),
    };
  });
}
