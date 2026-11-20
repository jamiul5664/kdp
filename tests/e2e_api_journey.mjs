import assert from 'node:assert/strict';

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(err);
  }
}

await test('1. Health endpoint responds 200 OK', async () => {
  const res = await fetch(`${BASE}/api/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
});

await test('2. Competitor Gap CSV analysis returns structured insights without inventing data', async () => {
  const res = await fetch(`${BASE}/api/intelligence/competitor-gap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      niche: 'Botanical Wildflower Coloring',
      marketplace: 'amazon.com',
      csvText:
        'Title,Subtitle,Format,Price,Reviews,Rating,Features,Gaps,SourceURL\n"Wildflower Art","40 Plates",Paperback,$9.99,180,4.5,"8.5x11; floral","double-sided bleed; tiny margins",https://example.com/1',
    }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.competitors.length, 1);
  assert.ok(data.missingFeatures.length >= 1);
  assert.ok(data.opportunityScore >= 50);
});

await test('3. Durable Workflow creation enforces idempotency keys & approval checkpoints', async () => {
  const idemKey = `e2e_idem_${Date.now()}`;
  const res1 = await fetch(`${BASE}/api/workflows/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: 'proj_e2e',
      bookTitle: 'E2E Woodland Story',
      idempotencyKey: idemKey,
    }),
  });
  assert.equal(res1.status, 201);
  const data1 = await res1.json();
  assert.equal(data1.deduplicated, false);
  assert.equal(data1.workflow.status, 'Waiting Approval');

  // Duplicate request with same idempotency key must deduplicate
  const res2 = await fetch(`${BASE}/api/workflows/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: 'proj_e2e',
      bookTitle: 'E2E Woodland Story',
      idempotencyKey: idemKey,
    }),
  });
  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.equal(data2.deduplicated, true);
  assert.equal(data2.workflow.id, data1.workflow.id);

  // Pause -> Resume -> Approve progression
  const pauseRes = await fetch(`${BASE}/api/workflows/${data1.workflow.id}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'pause' }),
  });
  assert.equal((await pauseRes.json()).workflow.status, 'Paused');

  const approveRes = await fetch(`${BASE}/api/workflows/${data1.workflow.id}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'approve' }),
  });
  const approved = await approveRes.json();
  assert.equal(approved.workflow.checkpoint, 3);
});

await test('4. Scheduled research refuses enabling without explicit user consent', async () => {
  const res = await fetch(`${BASE}/api/schedules`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timezone: 'America/New_York',
      inAppEnabled: true,
      emailEnabled: false,
      schedules: [
        { id: 's1', name: 'Unauthorized', query: 'coloring', cadence: 'Weekly', enabled: true, userConsentGranted: false },
        { id: 's2', name: 'Authorized', query: 'puzzles', cadence: 'Weekly', enabled: true, userConsentGranted: true },
      ],
    }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.config.schedules[0].enabled, false);
  assert.equal(data.config.schedules[1].enabled, true);
});

await test('5. Full Journey Export Pipeline: Interior PDF, Full Cover PDF, and Complete ZIP binary verification', async () => {
  const payload = {
    projectId: 'proj_e2e_export',
    projectTitle: 'E2E Verified Botanical Edition',
    author: 'QA Engineer',
    artifactType: 'complete_zip',
    settings: {
      trimSize: '8.5x11',
      pageCount: 64,
      interiorType: 'Black & White',
      bleed: true,
      margins: { top: 0.5, bottom: 0.5, inside: 0.5, outside: 0.5 },
      paperType: 'White Paper',
    },
    pages: [
      {
        id: 'p1',
        label: 'Title Page',
        background: { color: '#FFFFFF', pattern: 'none' },
        elements: [{ id: 'e1', type: 'text', content: 'E2E Verified Botanical Edition' }],
      },
      {
        id: 'p2',
        label: 'Chapter 1',
        background: { color: '#FFFFFF', pattern: 'none' },
        elements: [{ id: 'e2', type: 'text', content: 'Original verified KDP interior content.' }],
      },
    ],
  };

  const zipRes = await fetch(`${BASE}/api/exports/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(zipRes.status, 200);
  const zipMeta = await zipRes.json();
  assert.equal(zipMeta.status, 'Completed');
  assert.ok(zipMeta.downloadUrl.startsWith('/api/exports/'));

  const zipBinRes = await fetch(`${BASE}${zipMeta.downloadUrl}`);
  assert.equal(zipBinRes.status, 200);
  const zipBuf = Buffer.from(await zipBinRes.arrayBuffer());
  assert.equal(zipBuf.subarray(0, 2).toString('utf-8'), 'PK');

  const pdfRes = await fetch(`${BASE}/api/exports/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, artifactType: 'interior_pdf' }),
  });
  assert.equal(pdfRes.status, 200);
  const pdfMeta = await pdfRes.json();
  const pdfBinRes = await fetch(`${BASE}${pdfMeta.downloadUrl}`);
  assert.equal(pdfBinRes.status, 200);
  const pdfBuf = Buffer.from(await pdfBinRes.arrayBuffer());
  assert.ok(pdfBuf.subarray(0, 5).toString('utf-8').startsWith('%PDF-'));
});

console.log(`\nE2E Integration Summary: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
