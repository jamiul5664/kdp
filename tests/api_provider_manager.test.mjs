import assert from 'node:assert/strict';

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const HEADERS = {
  'Content-Type': 'application/json',
  'x-user-id': `usr_provider_e2e_${Date.now()}`,
};

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: HEADERS,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function run() {
  console.log('Running Multi-Provider API Manager E2E integration tests...');

  // 1. Metadata: 15 provider templates & 9 KDP tasks
  const meta = await req('GET', '/api/providers/meta');
  assert.equal(meta.status, 200);
  assert.ok(meta.data.templates.length >= 15, `Expected >=15 templates, got ${meta.data.templates.length}`);
  assert.equal(meta.data.tasks.length, 9, 'Expected 9 KDP tasks');
  console.log('✓ 1. /api/providers/meta returned 15 built-in templates and 9 KDP tasks');

  // 2. SSRF protection rejects private/metadata URLs
  const ssrf = await req('POST', '/api/providers/configs', {
    providerName: 'Malicious Metadata',
    providerType: 'openai_compatible',
    baseUrl: 'http://169.254.169.254/latest/meta-data',
    apiKey: 'sk-test-ssrf-blocked',
  });
  assert.equal(ssrf.status, 400);
  console.log('✓ 2. SSRF protection blocked metadata endpoint');

  // 3. Unlimited multi-key configurations under same provider + secret masking
  const secret1 = 'AIzaSyTestFirstSecretKey987654321';
  const secret2 = 'AIzaSyTestSecondSecretKey123456789';
  const c1 = await req('POST', '/api/providers/configs', {
    providerName: 'Gemini API Key 1',
    providerType: 'google_gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: secret1,
    priority: 1,
    folder: 'Production',
    tags: ['gemini', 'primary'],
  });
  assert.equal(c1.status, 201);
  assert.ok(!JSON.stringify(c1.data).includes(secret1), 'Raw secret must NEVER be returned');
  assert.equal(c1.data.config.encryptedKey, undefined, 'Encrypted blob must NOT be sent to client');

  const c2 = await req('POST', '/api/providers/configs', {
    providerName: 'Gemini API Key 2',
    providerType: 'google_gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: secret2,
    priority: 2,
    folder: 'Backup',
  });
  assert.equal(c2.status, 201);

  const deepseekSecret = 'sk-deepseek-text-only-secret-5555';
  const c3 = await req('POST', '/api/providers/configs', {
    providerName: 'DeepSeek Writer',
    providerType: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: deepseekSecret,
    priority: 3,
    folder: 'Writing',
  });
  assert.equal(c3.status, 201);
  console.log('✓ 3. Unlimited multi-key creation works with masked secrets only');

  // 4. Key rotation increments keyVersion and never exposes new raw secret
  const rotatedSecret = 'AIzaSyRotatedSecretKey000011112222';
  const rot = await req('PUT', `/api/providers/configs/${c1.data.config.id}`, {
    apiKey: rotatedSecret,
  });
  assert.equal(rot.status, 200);
  assert.equal(rot.data.config.keyVersion, 2);
  assert.ok(!JSON.stringify(rot.data).includes(rotatedSecret));
  console.log('✓ 4. Key rotation updated version to v2 without leaking plaintext');

  // 5. Manual model addition
  const addModel = await req('POST', `/api/providers/configs/${c3.data.config.id}/models`, {
    modelId: 'deepseek-custom-v3',
    displayName: 'DeepSeek Custom V3',
    capabilities: ['chat', 'writing', 'coding'],
    isDefault: true,
  });
  assert.equal(addModel.status, 201);
  assert.equal(addModel.data.config.defaultModel, 'deepseek-custom-v3');
  console.log('✓ 5. Manual model addition & default model selection verified');

  // 6. Strict capability enforcement: block image_generation on text-only and vision on non-vision
  const badImageTask = await req('PUT', '/api/providers/tasks/image_generation', {
    mode: 'manual',
    primaryConfigId: c3.data.config.id,
    primaryModelId: 'deepseek-custom-v3',
  });
  assert.equal(badImageTask.status, 422, 'Text-only model must be rejected for image_generation');

  const badVisionTask = await req('PUT', '/api/providers/tasks/pdf_quality_analysis', {
    mode: 'manual',
    primaryConfigId: c3.data.config.id,
    primaryModelId: 'deepseek-custom-v3',
  });
  assert.equal(badVisionTask.status, 422, 'Non-vision model must be rejected for pdf_quality_analysis');

  const goodVisionTask = await req('PUT', '/api/providers/tasks/pdf_quality_analysis', {
    mode: 'manual',
    primaryConfigId: c1.data.config.id,
    primaryModelId: 'gemini-2.5-flash',
  });
  assert.equal(goodVisionTask.status, 200);
  console.log('✓ 6. Capability validation blocked text-only image_gen and non-vision PDF QA while permitting valid vision model');

  // 7. Health rules update keeps forbidQuotaBypassKeyRotation immutable = true
  const rulesRes = await req('PUT', '/api/providers/health-rules', {
    autoDisableOnAuthError: true,
    maxConsecutiveFailuresBeforeDisable: 4,
    cooldownSeconds: 180,
    maxRetriesPerRequest: 2,
  });
  assert.equal(rulesRes.status, 200);
  assert.equal(rulesRes.data.healthRules.forbidQuotaBypassKeyRotation, true);
  assert.equal(rulesRes.data.healthRules.cooldownSeconds, 180);
  console.log('✓ 7. Health policy rules updated with immutable quota-bypass safeguard');

  // 8. Secret-free Export & Import
  const exp = await req('GET', '/api/providers/export-config');
  assert.equal(exp.status, 200);
  const expText = JSON.stringify(exp.data);
  assert.ok(!expText.includes(secret1) && !expText.includes(rotatedSecret) && !expText.includes(deepseekSecret));
  assert.ok(exp.data.configs.length >= 3);

  const imp = await req('POST', '/api/providers/import-config', {
    configs: [
      {
        providerName: 'Imported OpenRouter',
        providerType: 'openrouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        defaultModel: 'anthropic/claude-3.7-sonnet',
      },
      {
        providerName: 'Blocked SSRF Import',
        providerType: 'openai_compatible',
        baseUrl: 'http://127.0.0.1:9999/v1',
      },
    ],
  });
  assert.equal(imp.status, 200);
  assert.equal(imp.data.importedCount, 1);
  assert.equal(imp.data.skipped.length, 1);
  assert.equal(imp.data.imported[0].enabled, false, 'Imported templates stay disabled until user provides API key');
  console.log('✓ 8. Secret-free Export & Import verified (SSRF blocked, secrets omitted)');

  // 9. State & Delete cleanup
  const del = await req('DELETE', `/api/providers/configs/${c2.data.config.id}`);
  assert.equal(del.status, 200);
  const state = await req('GET', '/api/providers/state');
  assert.equal(state.status, 200);
  assert.equal(state.data.metrics.totalTokens, null, 'Unreported tokens must remain null (Unavailable), never fabricated');
  assert.equal(state.data.metrics.totalEstimatedCostUsd, null, 'Unreported cost must remain null (Unavailable), never fabricated');
  console.log('✓ 9. State telemetry truthfulness & configuration deletion verified');

  console.log('\nALL 9 MULTI-PROVIDER API MANAGER E2E TESTS PASSED.');
}

run().catch((err) => {
  console.error('Multi-Provider E2E test failed:', err);
  process.exit(1);
});
