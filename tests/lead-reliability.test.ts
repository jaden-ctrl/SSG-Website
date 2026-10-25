import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { GET as listDlq, POST as requeueDlq } from '@/app/api/admin/lead-dlq/route';
import { memoryJsonStore, planBlobStore, privateJsonStore, resetMemoryStoresForTests, type JsonStore } from '@/lib/blob-store';
import { LEAD_FORM_ERROR, leadFormResult } from '@/components/lead-form-status';
import { createFailingCrm, createLiveCrm, createMemoryCrm, type Crm } from '@/lib/lead/crm';
import { listDeadLetters, requeueDeadLetter } from '@/lib/lead/dlq';
import { handleLeadAdmission } from '@/lib/lead/admission';
import { acceptLead, type IntakeOptions } from '@/lib/lead/intake';
import { resetOpsAlerts } from '@/lib/lead/ops-alert';
import { resetOwnerCache } from '@/lib/lead/owners';
import { runDue } from '@/lib/lead/processor';
import { emptySteps, type SubmissionRecord } from '@/lib/lead/types';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const KEY = Buffer.alloc(32, 9).toString('base64');
const SALT = 's'.repeat(32);
const CID = '11111111-1111-4111-8111-111111111111';
const CID_2 = '22222222-2222-4222-8222-222222222222';
const CID_3 = '33333333-3333-4333-8333-333333333333';

function env(extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    LEAD_STORE_KEY: KEY,
    LEAD_HASH_SALT: SALT,
    LEAD_AUTOMATION_ENABLED: 'true',
    HUBSPOT_ACCESS_TOKEN: 'prod-token',
    HUBSPOT_DEFAULT_OWNER_ID: '94663488',
    NOTIFY_EMAIL_TO: 'owner@example.com',
    NOTIFY_EMAIL_FROM: 'SSG <leads@example.com>',
    LEAD_MAX_ATTEMPTS: '6',
    LEAD_LOCK_RETRY_MS: '50',
    ...extra,
  } as unknown as NodeJS.ProcessEnv;
}

function leadBody(extra: Record<string, unknown> = {}) {
  return {
    email: 'qa@example.com',
    first_name: 'QA',
    last_name: 'Synthetic',
    company: 'QA Synthetic Co',
    message: 'Please review this preview isolation submission.',
    consent: 'true',
    form_variant: 'contact',
    project_type: 'A new website',
    client_submission_id: CID,
    ...extra,
  };
}

function headers(ip = '203.0.113.10') {
  return new Headers({ 'x-nf-client-connection-ip': ip });
}

function options(store: JsonStore, crm: Crm, extra: IntakeOptions = {}): IntakeOptions {
  return {
    env: env(),
    store,
    crm,
    decision: { mode: 'mock', block: null },
    now: () => 1_700_000_000_000,
    mailer: { async send() { return { id: 'm', status: 200 }; } },
    ...extra,
  };
}

function openTasks(crm: ReturnType<typeof createMemoryCrm>) {
  return crm.state.tasks.filter((task) => task.properties.hs_task_status !== 'COMPLETED');
}

async function post(host: string, buildContext: string, body: Record<string, unknown> = leadBody()) {
  return handleLeadAdmission(new NextRequest(`https://${host}/api/lead`, {
    method: 'POST',
    headers: { host, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }), buildContext);
}

test('C1 and C2: mock mode on a production host is 503 lead_mode_mismatch', async () => {
  resetOpsAlerts();
  const logs: string[] = [];
  const original = console.error;
  const originalFetch = globalThis.fetch;
  let calls = 0;
  console.error = (chunk?: unknown) => { logs.push(String(chunk)); };
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error('outbound');
  };
  try {
    for (const host of ['shipleysolutionsgroup.com', 'www.shipleysolutionsgroup.com', 'ssg-site.netlify.app']) {
      const response = await post(host, 'non-production');
      const body = await response.json() as { ok?: boolean; code?: string };
      assert.equal(response.status, 503, host);
      assert.equal(body.ok, false, host);
      assert.equal(body.code, 'lead_mode_mismatch', host);
      const outcome = leadFormResult({ httpOk: response.ok, parsed: body });
      assert.equal(outcome.failed, true, host);
      assert.equal(outcome.succeeded, false, host);
      assert.equal(outcome.status, LEAD_FORM_ERROR, host);
    }
    assert.equal(calls, 0);
    assert.ok(logs.some((line) => line.includes('lead_mode_mismatch')));
    assert.ok(logs.some((line) => line.includes('lead_ops_alert')));
  } finally {
    console.error = original;
    globalThis.fetch = originalFetch;
  }
});

test('C5: LEAD_LIVE_TEST never applies on a production host', async () => {
  const previous = {
    LEAD_LIVE_TEST: process.env.LEAD_LIVE_TEST,
    HUBSPOT_TEST_ACCESS_TOKEN: process.env.HUBSPOT_TEST_ACCESS_TOKEN,
    HUBSPOT_TEST_PORTAL_ID: process.env.HUBSPOT_TEST_PORTAL_ID,
  };
  process.env.LEAD_LIVE_TEST = 'true';
  process.env.HUBSPOT_TEST_ACCESS_TOKEN = 'test-token';
  process.env.HUBSPOT_TEST_PORTAL_ID = '999';
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error('outbound');
  };
  try {
    const apex = await post('shipleysolutionsgroup.com', 'non-production');
    const netlify = await post('ssg-site.netlify.app', 'production');
    for (const response of [apex, netlify]) {
      const body = await response.json() as { ok?: boolean; code?: string };
      assert.equal(response.status, 503);
      assert.equal(body.ok, false);
      assert.equal(body.code, 'lead_live_test_on_prod_host');
      assert.equal(leadFormResult({ httpOk: response.ok, parsed: body }).failed, true);
    }
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('C6: a Netlify build fails when CONTEXT is missing or not exactly production', () => {
  const script = `
    import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
    import { tmpdir } from 'node:os';
    import { join } from 'node:path';
    import { main, netlifyContextProblem } from './scripts/write-build-context.mjs';
    const missing = netlifyContextProblem({ NETLIFY: 'true' });
    if (!missing || missing.code !== 'build_context_invalid' || missing.context !== 'missing') process.exit(2);
    const capital = netlifyContextProblem({ NETLIFY: 'true', CONTEXT: 'Production' });
    if (!capital || capital.context !== 'unrecognized') process.exit(3);
    if (netlifyContextProblem({ NETLIFY: 'true', CONTEXT: 'deploy-preview' })) process.exit(4);
    if (netlifyContextProblem({ NETLIFY: 'true', CONTEXT: 'production' })) process.exit(5);
    if (netlifyContextProblem({ CONTEXT: '' })) process.exit(6);
    const dir = mkdtempSync(join(tmpdir(), 'ssg-bake-'));
    const file = join(dir, 'build-context.generated.ts');
    if (main({ NETLIFY: 'true' }, file) === 0) process.exit(7);
    if (existsSync(file)) process.exit(8);
    if (main({ NETLIFY: 'true', CONTEXT: 'Production' }, file) === 0) process.exit(9);
    if (main({ NETLIFY: 'true', CONTEXT: 'deploy-preview' }, file) !== 0) process.exit(10);
    if (!readFileSync(file, 'utf8').includes('"non-production"')) process.exit(11);
    if (main({ NETLIFY: 'true', CONTEXT: 'production' }, file) !== 0) process.exit(12);
    if (!readFileSync(file, 'utf8').includes('"production"')) process.exit(13);
    rmSync(dir, { recursive: true, force: true });
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('a production bake on a non-allowlisted host is 503 and a preview host stays 200', async () => {
  const blocked = await post('deploy-preview-42--ssg-site.netlify.app', 'production');
  const blockedBody = await blocked.json() as { ok?: boolean; code?: string };
  assert.equal(blocked.status, 503);
  assert.equal(blockedBody.code, 'lead_mode_mismatch');

  const preview = await post('deploy-preview-42--ssg-site.netlify.app', 'non-production');
  const previewBody = await preview.json() as { ok?: boolean; status?: string };
  assert.equal(preview.status, 200);
  assert.equal(previewBody.ok, true);
  assert.equal(previewBody.status, 'received');

  const previous = process.env.LEAD_PRODUCTION_HOSTS;
  process.env.LEAD_PRODUCTION_HOSTS = 'https://evil.example/path';
  try {
    const broken = await post('shipleysolutionsgroup.com', 'non-production');
    const body = await broken.json() as { code?: string };
    assert.equal(broken.status, 503);
    assert.equal(body.code, 'lead_mode_mismatch');
  } finally {
    if (previous === undefined) delete process.env.LEAD_PRODUCTION_HOSTS;
    else process.env.LEAD_PRODUCTION_HOSTS = previous;
  }
});

test('normal submission, duplicates, and a timeout retry keep one contact and one task', async () => {
  resetOwnerCache();
  const store = privateJsonStore();
  const crm = createMemoryCrm({ permissiveOwners: true });
  const clock = { now: 1_700_000_000_000 };
  const base = options(store, crm, { now: () => clock.now });
  const first = await acceptLead(JSON.stringify(leadBody()), null, headers(), base);
  const again = await acceptLead(JSON.stringify(leadBody()), null, headers(), base);
  assert.equal(first.status, 200);
  assert.equal(first.body.status, 'received');
  assert.equal(again.status, 200);
  assert.equal(again.body.code, 'lead_duplicate');
  assert.equal(crm.state.contacts.length, 1);
  assert.equal(openTasks(crm).length, 1);

  const follow = await acceptLead(JSON.stringify(leadBody({
    message: 'A second visit from the same email inside the window.',
    client_submission_id: CID_2,
  })), null, headers('203.0.113.11'), base);
  assert.equal(follow.status, 200);
  assert.equal(crm.state.contacts.length, 1);
  assert.equal(openTasks(crm).length, 1);

  const down = createFailingCrm('down');
  const retryStore = privateJsonStore();
  const queued = await acceptLead(JSON.stringify(leadBody({ client_submission_id: CID_3, email: 'retry@example.com' })), null, headers('203.0.113.12'), options(retryStore, down, { now: () => clock.now }));
  assert.equal(queued.status, 200);
  assert.equal(down.state.contacts.length, 0);
  clock.now += 6 * 60_000;
  const healthy = createMemoryCrm({ permissiveOwners: true });
  const recovered = await acceptLead(JSON.stringify(leadBody({ client_submission_id: CID_3, email: 'retry@example.com' })), null, headers('203.0.113.12'), options(retryStore, healthy, { now: () => clock.now }));
  assert.equal(recovered.status, 200);
  assert.equal(healthy.state.contacts.length, 1);
  assert.equal(openTasks(healthy).length, 1);
});

test('HubSpot down with the store up is queued 200, and both down is 502', async () => {
  resetOwnerCache();
  const store = privateJsonStore();
  const clock = { now: 1_700_000_000_000 };
  const queued = await acceptLead(JSON.stringify(leadBody()), null, headers(), options(store, createFailingCrm('down'), {
    decision: { mode: 'live', block: null },
    now: () => clock.now,
  }));
  assert.equal(queued.status, 200);
  assert.equal(queued.body.ok, true);
  assert.equal(queued.body.status, 'queued');
  const subs = await store.list({ prefix: 'sub/' });
  const queues = await store.list({ prefix: 'queue/' });
  assert.equal(subs.blobs.length, 1);
  assert.equal(queues.blobs.length, 1);

  const broken = privateJsonStore();
  const original = broken.setJSON.bind(broken);
  broken.setJSON = async (key, value, write) => {
    if (key.startsWith('sub/') || key.startsWith('queue/')) throw new Error('blobs down');
    return original(key, value, write);
  };
  const both = await acceptLead(JSON.stringify(leadBody({ client_submission_id: CID_2 })), null, headers(), options(broken, createFailingCrm('down'), {
    decision: { mode: 'live', block: null },
    now: () => clock.now,
  }));
  assert.equal(both.status, 502);
  assert.equal(both.body.ok, false);
  assert.equal(both.body.code, 'lead_store_unavailable');
  assert.equal(leadFormResult({ httpOk: false, parsed: both.body }).failed, true);
});

test('store down with HubSpot up still confirms the contact', async () => {
  resetOwnerCache();
  const broken = privateJsonStore();
  const original = broken.setJSON.bind(broken);
  broken.setJSON = async (key, value, write) => {
    if (key.startsWith('sub/') || key.startsWith('queue/')) throw new Error('blobs down');
    return original(key, value, write);
  };
  const crm = createMemoryCrm({ permissiveOwners: true });
  const saved = await acceptLead(JSON.stringify(leadBody()), null, headers(), options(broken, crm, {
    decision: { mode: 'live', block: null },
  }));
  assert.equal(saved.status, 200);
  assert.equal(saved.body.ok, true);
  assert.equal(crm.state.contacts.length, 1);
  assert.equal(openTasks(crm).length, 1);
});

test('C4: a live portal mismatch does not write and does not return success', async () => {
  resetOwnerCache();
  resetOpsAlerts();
  const store = privateJsonStore();
  const seen: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method || 'GET';
    seen.push(`${method} ${url}`);
    if (url.includes('/account-info/')) return Response.json({ portalId: 99999999 });
    return Response.json({ id: 'should-not-write' });
  };
  try {
    const decision = { mode: 'live' as const, block: null };
    const result = await acceptLead(JSON.stringify(leadBody()), null, headers(), options(store, createLiveCrm(decision, env()), {
      decision,
      env: env(),
    }));
    assert.equal(result.status, 503);
    assert.equal(result.body.ok, false);
    assert.equal(result.body.code, 'lead_portal_mismatch');
    assert.equal(seen.some((line) => line.startsWith('POST')), false);
    assert.equal((await store.list({ prefix: 'queue/' })).blobs.length, 1);
    assert.equal(leadFormResult({ httpOk: false, parsed: result.body }).status, LEAD_FORM_ERROR);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('missing and invalid credentials fail closed unless HubSpot already verified the contact', async () => {
  resetOwnerCache();
  const logs: string[] = [];
  const original = console.error;
  console.error = (chunk?: unknown) => { logs.push(String(chunk)); };
  try {
    const missingToken = await acceptLead(JSON.stringify(leadBody()), null, headers(), options(privateJsonStore(), createMemoryCrm(), {
      decision: { mode: 'live', block: null },
      env: env({ HUBSPOT_ACCESS_TOKEN: '' }),
    }));
    assert.equal(missingToken.status, 503);
    assert.equal(missingToken.body.code, 'lead_hubspot_unconfigured');

    const invalidSaved = await acceptLead(JSON.stringify(leadBody()), null, headers(), options(privateJsonStore(), createMemoryCrm({ permissiveOwners: true }), {
      decision: { mode: 'live', block: null },
      env: env({ LEAD_STORE_KEY: 'not-a-valid-key' }),
    }));
    assert.equal(invalidSaved.status, 200);
    assert.equal(invalidSaved.body.ok, true);

    const invalidDown = await acceptLead(JSON.stringify(leadBody({ client_submission_id: CID_2 })), null, headers('203.0.113.70'), options(privateJsonStore(), createFailingCrm('down'), {
      decision: { mode: 'live', block: null },
      env: env({ LEAD_STORE_KEY: 'not-a-valid-key' }),
    }));
    assert.equal(invalidDown.status, 502);
    assert.equal(invalidDown.body.ok, false);
    assert.notEqual(invalidDown.body.code, undefined);
  } finally {
    console.error = original;
  }
  assert.ok(logs.some((line) => line.includes('lead_store_key_invalid')));
  assert.ok(logs.some((line) => line.includes('lead_ops_alert')));
});

test('C3: one poison record is dead-lettered and does not block a healthy lead', async () => {
  resetOwnerCache();
  const store = privateJsonStore();
  const clock = { now: 1_700_000_000_000 };
  const healthyCrm = createMemoryCrm({ permissiveOwners: true });
  await acceptLead(JSON.stringify(leadBody({ email: 'healthy@example.com', client_submission_id: CID_2 })), null, headers('203.0.113.80'), options(store, createFailingCrm('down'), { now: () => clock.now }));
  const blobs = await store.list({ prefix: 'sub/' });
  const healthyKey = blobs.blobs[0].key;
  const healthy = await store.get(healthyKey) as SubmissionRecord;
  healthy.nextAttemptAt = 0;
  await store.setJSON(healthyKey, healthy);

  const poisonKey = 'a'.repeat(64);
  const old = new Date(clock.now - 60_000).toISOString();
  await store.setJSON(`sub/${poisonKey}`, {
    v: 1,
    subKey: poisonKey,
    state: 'queued',
    attempts: 0,
    nextAttemptAt: 0,
    createdAt: old,
    updatedAt: old,
    steps: emptySteps(),
    payload: { iv: 'bad', tag: 'bad', data: 'bad' },
  });
  await store.setJSON(`queue/${poisonKey}`, { at: old });
  await store.setJSON('spam/old', { at: new Date(clock.now - 8 * 86_400_000).toISOString(), reason: 'honeypot' });

  const processed = await runDue({
    store,
    crm: healthyCrm,
    mailer: { async send() { return { id: 'a', status: 200 }; } },
    env: env(),
    now: () => clock.now,
    decision: { mode: 'mock', block: null },
  }, { limit: 8 });
  assert.equal(processed, 1);
  assert.equal(healthyCrm.state.contacts.length, 1);
  assert.equal(openTasks(healthyCrm).length, 1);
  const letters = await listDeadLetters(store);
  assert.equal(letters.some((row) => row.subKey === poisonKey), true);
  assert.equal(await store.get('spam/old'), null);

  for (let index = 0; index < 9; index += 1) {
    const id = `poison-${index}`;
    await store.setJSON(`sub/${id}`, {
      v: 1,
      subKey: id,
      state: 'queued',
      attempts: 0,
      nextAttemptAt: Number.NaN,
      createdAt: old,
      updatedAt: old,
      steps: emptySteps(),
      payload: { iv: '', tag: '', data: '' },
    });
    await store.setJSON(`queue/${id}`, { at: old });
  }
  const before = new Set((await store.list({ prefix: 'sub/' })).blobs.map((blob) => blob.key));
  const second = createMemoryCrm({ permissiveOwners: true });
  await acceptLead(JSON.stringify(leadBody({ email: 'later@example.com', client_submission_id: CID_3 })), null, headers('203.0.113.81'), options(store, createFailingCrm('down'), { now: () => clock.now }));
  const created = (await store.list({ prefix: 'sub/' })).blobs.map((blob) => blob.key).filter((key) => !before.has(key));
  assert.equal(created.length, 1);
  const later = await store.get(created[0]) as SubmissionRecord;
  later.nextAttemptAt = 0;
  await store.setJSON(created[0], later);
  const ran = await runDue({
    store,
    crm: second,
    mailer: { async send() { return { id: 'b', status: 200 }; } },
    env: env(),
    now: () => clock.now,
    decision: { mode: 'mock', block: null },
  }, { limit: 8 });
  assert.ok(ran >= 1);
  assert.equal(second.state.contacts.length, 1);
});

test('dead letters can be listed and requeued, then a healthy retry delivers the contact', async () => {
  resetOwnerCache();
  const store = privateJsonStore();
  const clock = { now: 1_800_000_000_000 };
  const first = await acceptLead(JSON.stringify(leadBody()), null, headers(), options(store, createFailingCrm('down'), {
    now: () => clock.now,
    env: env({ LEAD_MAX_ATTEMPTS: '1' }),
  }));
  assert.equal(first.status, 200);
  const record = await store.get((await store.list({ prefix: 'sub/' })).blobs[0].key) as SubmissionRecord;
  assert.equal(record.state, 'dead_letter');
  const listed = await listDeadLetters(store);
  assert.equal(listed.length, 1);
  assert.equal(await requeueDeadLetter(store, listed[0].subKey, clock.now), true);
  const restored = await store.get(`sub/${listed[0].subKey}`) as SubmissionRecord;
  assert.equal(restored.state, 'queued');
  assert.equal(restored.attempts, 0);
  const healthy = createMemoryCrm({ permissiveOwners: true });
  const ran = await runDue({
    store,
    crm: healthy,
    mailer: { async send() { return { id: 'c', status: 200 }; } },
    env: env({ LEAD_MAX_ATTEMPTS: '1' }),
    now: () => clock.now,
    decision: { mode: 'mock', block: null },
  });
  assert.equal(ran, 1);
  assert.equal(healthy.state.contacts.length, 1);
  assert.equal(openTasks(healthy).length, 1);
  assert.equal((await listDeadLetters(store)).length, 0);
});

test('the admin dead-letter route requires the review token', async () => {
  const previousToken = process.env.SSGAI_REVIEW_TOKEN;
  const previousUrl = process.env.URL;
  const previousNetlify = process.env.NETLIFY;
  const previousContext = process.env.CONTEXT;
  process.env.SSGAI_REVIEW_TOKEN = 'review-token';
  process.env.URL = 'http://localhost:3000';
  delete process.env.NETLIFY;
  delete process.env.CONTEXT;
  resetMemoryStoresForTests();
  const plan = planBlobStore('lead-intake');
  const bucketName = plan.kind === 'local' ? 'lead-intake--local' : plan.name;
  const bucket = memoryJsonStore(bucketName);
  const subKey = 'b'.repeat(64);
  const now = new Date().toISOString();
  await bucket.setJSON(`sub/${subKey}`, {
    v: 1,
    subKey,
    state: 'dead_letter',
    attempts: 2,
    nextAttemptAt: 0,
    createdAt: now,
    updatedAt: now,
    steps: emptySteps(),
    payload: { iv: 'aa', tag: 'bb', data: 'cc' },
  });
  await bucket.setJSON(`dlq/${subKey}`, { reason: 'attempts', at: now, code: 'lead_dead_letter' });
  try {
    const denied = await listDlq(new Request('http://localhost:3000/api/admin/lead-dlq'));
    assert.equal(denied.status, 401);
    const listed = await listDlq(new Request('http://localhost:3000/api/admin/lead-dlq', {
      headers: { authorization: 'Bearer review-token' },
    }));
    const body = await listed.json() as { ok?: boolean; records?: { subKey: string }[] };
    assert.equal(listed.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.records?.some((row) => row.subKey === subKey), true);
    const moved = await requeueDlq(new Request('http://localhost:3000/api/admin/lead-dlq', {
      method: 'POST',
      headers: { authorization: 'Bearer review-token', 'content-type': 'application/json' },
      body: JSON.stringify({ subKey }),
    }));
    assert.equal(moved.status, 200);
    const restored = await bucket.get(`sub/${subKey}`) as SubmissionRecord;
    assert.equal(restored.state, 'queued');
  } finally {
    if (previousToken === undefined) delete process.env.SSGAI_REVIEW_TOKEN;
    else process.env.SSGAI_REVIEW_TOKEN = previousToken;
    if (previousUrl === undefined) delete process.env.URL;
    else process.env.URL = previousUrl;
    if (previousNetlify === undefined) delete process.env.NETLIFY;
    else process.env.NETLIFY = previousNetlify;
    if (previousContext === undefined) delete process.env.CONTEXT;
    else process.env.CONTEXT = previousContext;
  }
});

test('the scheduled retry logs when it skips mock mode', () => {
  const script = `
    const logs = [];
    console.error = (chunk) => { logs.push(String(chunk)); };
    const mod = await import('./netlify/functions/lead-retry.mts');
    await mod.default();
    if (!logs.some((line) => line.includes('lead_retry_skipped'))) process.exit(2);
  `;
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--import', './tests/register.mjs', '--input-type=module', '-e', script], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('the form shows an error for non-success responses and success only for ok true', () => {
  assert.equal(leadFormResult({ httpOk: true, parsed: { ok: true } }).succeeded, true);
  for (const input of [
    { httpOk: false, parsed: { ok: false, code: 'lead_mode_mismatch' } },
    { httpOk: false, parsed: { ok: false, code: 'lead_store_unavailable' } },
    { httpOk: true, parsed: { ok: false } },
    { httpOk: true, parsed: null },
    { httpOk: true, parseError: true, parsed: null },
    { networkError: true },
  ]) {
    const outcome = leadFormResult(input);
    assert.equal(outcome.failed, true);
    assert.equal(outcome.succeeded, false);
    assert.equal(outcome.status, LEAD_FORM_ERROR);
  }
  assert.match(leadFormResult({ websiteError: true }).status, /website/i);
});

test('honeypot is the 200 exception and writes no contact', async () => {
  const crm = createMemoryCrm({ permissiveOwners: true });
  const result = await acceptLead(JSON.stringify(leadBody({ faxNumber: '555' })), null, headers(), options(privateJsonStore(), crm));
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(crm.state.contacts.length, 0);
  assert.equal(crm.state.tasks.length, 0);
  assert.equal(leadFormResult({ httpOk: true, parsed: result.body }).succeeded, true);
});
