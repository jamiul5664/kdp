import assert from 'node:assert/strict';
import {
  analyzeCustomerReviews,
  buildSeasonalCalendar,
  buildSevenKdpKeywordSlots,
  calculateKdpProfitability,
  DEFAULT_KDP_TEMPLATES,
  exportKeywordsToCsv,
  parseKeywordsCsv,
  parsePerformanceCsv,
  parseReviewsCsv,
  runComprehensiveKdpComplianceCheck,
  runOriginalityAudit,
  stripReviewerPii,
} from '../src/utils/kdpAdvancedEngines.ts';
import { calculateFullCoverSpec } from '../src/utils/kdpDimensions.ts';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(err);
  }
}

test('Seasonal Calendar covers all 11 required events with dates and deadlines', () => {
  const events = buildSeasonalCalendar('2026-11-20');
  assert.equal(events.length, 11);
  const names = events.map((e) => e.event);
  for (const required of ['Christmas', 'Halloween', 'Easter', "Valentine's Day", "Mother's Day", "Father's Day", 'Ramadan', 'Eid', 'Summer Vacation', 'Back to School', 'New Year']) {
    assert.ok(names.includes(required), `Missing event ${required}`);
  }
  assert.ok(events.every((e) => e.historicalTrend.length === 12 && e.researchDeadline < e.eventDate));
});

test('Keyword CSV import/export marks unavailable volumes cleanly and builds 7 KDP slots', () => {
  const csv = 'Keyword,Source,Search Volume,Trend,Competition\n"botanical coloring book adults",UserCSV,,Seasonal,Moderate\n"large print floral gift",UserCSV,1400,Rising,Low';
  const rows = parseKeywordsCsv(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].searchVolume, null);
  assert.equal(rows[1].searchVolume, 1400);
  const exported = exportKeywordsToCsv(rows);
  assert.ok(exported.includes('Unavailable'));
  const slots = buildSevenKdpKeywordSlots(rows, 'Botanical Coloring Book');
  assert.ok(slots.length >= 1);
  assert.ok(slots.every((s) => s.length <= 50 && !s.includes('botanical')));
});

test('Review Intelligence strips reviewer emails, handles, and names (PII)', () => {
  const sanitized = stripReviewerPii('Posted by John Doe (@johndoe, john@example.com): Paper is thin and markers bleed through.');
  assert.ok(!sanitized.includes('john@example.com'));
  assert.ok(!sanitized.includes('@johndoe'));
  assert.ok(!sanitized.includes('John Doe'));
  const rows = parseReviewsCsv('Title,Rating,Review,URL\n"Floral Book",2,"Paper is thin and bleed through ruined next page",https://example.com');
  const analysis = analyzeCustomerReviews(rows);
  assert.equal(analysis.totalReviewsAnalyzed, 1);
  assert.ok(analysis.commonComplaints.length >= 1);
});

test('Reusable KDP Book Template Library ships all 10 required book types', () => {
  assert.equal(DEFAULT_KDP_TEMPLATES.length, 10);
  const types = new Set(DEFAULT_KDP_TEMPLATES.map((t) => t.bookType));
  assert.equal(types.size, 10);
});

test('15-Point Amazon KDP Compliance Checker evaluates all 15 specifications', () => {
  const audit = runComprehensiveKdpComplianceCheck({
    title: 'Mindful Botanicals',
    subtitle: '50 Single-Sided Floral Coloring Plates',
    settings: {
      trimSize: '8.5x11',
      pageCount: 104,
      interiorType: 'Black & White',
      bleed: true,
      margins: { top: 0.5, bottom: 0.5, inside: 0.625, outside: 0.5 },
      paperType: 'White Paper',
    },
    pages: [
      {
        id: 'p1',
        label: 'Title',
        background: { color: '#FFFFFF', pattern: 'none' },
        elements: [
          {
            id: 'e1',
            type: 'text',
            content: 'Mindful Botanicals',
            x: 10,
            y: 20,
            width: 80,
            fontFamily: 'serif',
            fontSize: 24,
            fontWeight: 'bold',
            fontStyle: 'normal',
            textAlign: 'center',
            color: '#111827',
            lineHeight: 1.3,
          },
        ],
      },
    ],
    aiDisclosureDeclared: true,
    includeBarcodeSafeArea: true,
    fontsEmbedded: true,
  });
  assert.equal(audit.checks.length, 15);
  assert.equal(audit.failedCount, 0);
  assert.ok(audit.disclaimer.includes('never guarantee'));
});

test('Copyright & Originality Auditor detects restricted brands and duplicate text', () => {
  const res = runOriginalityAudit({
    title: 'Unofficial Disney Adventure Coloring',
    subtitle: 'Original fun',
    pages: [
      {
        id: 'p1',
        label: 'P1',
        background: { color: '#fff', pattern: 'none' },
        elements: [
          {
            id: 't1',
            type: 'text',
            content: 'Repeated woodland meadow lantern story chapter text across multiple pages',
            x: 10, y: 10, width: 80, fontFamily: 'sans', fontSize: 12,
            fontWeight: 'normal', fontStyle: 'normal', textAlign: 'left', color: '#000', lineHeight: 1.5,
          },
        ],
      },
      {
        id: 'p2',
        label: 'P2',
        background: { color: '#fff', pattern: 'none' },
        elements: [
          {
            id: 't2',
            type: 'text',
            content: 'Repeated woodland meadow lantern story chapter text across multiple pages',
            x: 10, y: 10, width: 80, fontFamily: 'sans', fontSize: 12,
            fontWeight: 'normal', fontStyle: 'normal', textAlign: 'left', color: '#000', lineHeight: 1.5,
          },
        ],
      },
    ],
  });
  assert.ok(res.trademarkFlags.includes('disney'));
  assert.equal(res.repeatedTextPairs.length, 1);
  assert.equal(res.humanReviewRequired, true);
});

test('KDP Profitability Calculator computes paperback/hardcover royalties and honors manual override', () => {
  const auto = calculateKdpProfitability({
    marketplace: 'amazon.com',
    bookFormat: 'Paperback',
    trimSize: '8.5x11',
    pageCount: 104,
    paperType: 'White Paper',
    inkType: 'Black & White',
    listPrice: 12.99,
    manualPrintingCost: null,
    productionCost: 150,
    adCostPerSale: 1.0,
  });
  assert.equal(auto.royaltyRate, 0.6);
  assert.ok(auto.printingCost > 2 && auto.royaltyPerSale > 4);
  assert.ok(auto.breakEvenSales !== null && auto.breakEvenSales > 0);

  const manual = calculateKdpProfitability({
    marketplace: 'amazon.com',
    bookFormat: 'Hardcover',
    trimSize: '6x9',
    pageCount: 120,
    paperType: 'White Paper',
    inkType: 'Black & White',
    listPrice: 19.99,
    manualPrintingCost: 7.25,
    productionCost: 200,
    adCostPerSale: 0,
  });
  assert.equal(manual.printingCost, 7.25);
  assert.equal(manual.printingCostSource, 'User Input (Manual Override)');
});

test('Cover wrap dimensions & Performance CSV parser compute accurately', () => {
  const spec = calculateFullCoverSpec({
    trimSize: '6x9',
    pageCount: 200,
    paperType: 'Cream Paper',
    interiorType: 'Black & White',
    bleed: true,
  });
  assert.equal(spec.spineWidthIn, 0.5);
  assert.equal(spec.fullWidthIn, 12.75);
  assert.equal(spec.fullHeightIn, 9.25);

  const perf = parsePerformanceCsv('Date,Book Title,Category,Format,Marketplace,Units,Price,Royalty,Ads\n2026-11-10,Botanicals,Coloring,Paperback,amazon.com,25,12.99,120.50,20.00');
  assert.equal(perf.length, 1);
  assert.equal(perf[0].unitsSold, 25);
});

console.log(`\nUnit Test Summary: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
