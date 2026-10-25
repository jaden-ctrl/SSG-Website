import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { POST as postLead } from '@/app/api/lead/route';
import { privateJsonStore, type JsonStore } from '@/lib/blob-store';
import { createFailingCrm, createMemoryCrm, type Crm } from '@/lib/lead/crm';
import { acceptLead, type IntakeOptions } from '@/lib/lead/intake';
import { createMailer, type Mail } from '@/lib/lead/notify';
import { resetOwnerCache } from '@/lib/lead/owners';
import { runDue } from '@/lib/lead/processor';
import { submissionKey } from '@/lib/lead/subkey';
import type { SubmissionRecord } from '@/lib/lead/types';
import { validateLead } from '@/lib/lead/validate';
import { buildWebhookBody, signWebhook, webhookGate } from '@/lib/lead/webhook';

const KEY = Buffer.alloc(32, 7).toString('base64');
const SALT = 's'.repeat(32);
const CID = '11111111-1111-4111-8111-111111111111';
const CID_2 = '22222222-2222-4222-8222-222222222222';
const CID_3 = '33333333-3333-4333-8333-333333333333';

function env(extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    LEAD_STORE_KEY: KEY,
    LEAD_HASH_SALT: SALT,
    LEAD_AUTOMATION_ENABLED: 'true',
    HUBSPOT_DEFAULT_OWNER_ID: '94663488',
    NOTIFY_EMAIL_TO: 'owner@example.com',
    NOTIFY_EMAIL_FROM: 'SSG <leads@example.com>',
    LEAD_MAX_ATTEMPTS: '6',
    LEAD_LOCK_RETRY_MS: '200',
    LEAD_RL_IP: '5',
    LEAD_RL_EMAIL: '3',
    LEAD_RL_GLOBAL: '60',
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

function spyMailer() {
  const sent: Mail[] = [];
  return {
    sent,
    mailer: {
      async send(mail: Mail) {
        sent.push(mail);
        return { id: `m-${sent.length}`, status: 200 };
      },
    },
  };
}

function options(store: JsonStore, crm: Crm, extra: IntakeOptions = {}): IntakeOptions {
  const clock = extra.now ?? (() => 1_700_000_000_000);
  return {
    env: env(),
    store,
    crm,
    decision: { mode: 'mock', block: null },
    now: clock,
    mailer: spyMailer().mailer,
    ...extra,
  };
}

test('submission keys follow the client id, and the fallback bucket changes on the 10-minute boundary', () => {
  const first = submissionKey({ clientSubmissionId: CID, email: 'QA@Example.com', formVariant: 'contact', message: 'Hello there friend', receivedAtMs: 1_000 });
  const edited = submissionKey({ clientSubmissionId: CID, email: 'qa@example.com', formVariant: 'contact', message: 'Different message', receivedAtMs: 9_000 });
  assert.equal(first, edited);
  const early = submissionKey({ email: 'qa@example.com', formVariant: 'contact', message: 'Hello there friend', receivedAtMs: 599_999 });
  const later = submissionKey({ email: 'qa@example.com', formVariant: 'contact', message: 'Hello   there friend', receivedAtMs: 600_000 });
  assert.notEqual(early, later);
});

test('form rules: website review does not require project type, message minimum is 10, and timeline labels and codes both parse', () => {
  const now = 1_700_000_000_000;
  const review = validateLead({
    email: 'qa@example.com', first_name: 'QA', company: 'QA Co', website: 'example.com',
    message: 'Improve the homepage', consent: 'true', form_variant: 'website_review',
  }, { now, minFillMs: 2500, origins: ['example.com'] });
  assert.equal(review.ok, true);
  if (!review.ok) return;
  assert.equal(review.lead.project_type, '');
  assert.equal(review.lead.website, 'https://example.com/');

  const short = validateLead({ ...leadBody(), message: 'too short' }, { now, minFillMs: 2500, origins: [] });
  assert.equal(short.ok, false);

  const labels: Record<string, string> = {
    'Not sure yet': 'not_sure',
    not_sure: 'not_sure',
    'As soon as practical': 'asap',
    asap: 'asap',
    'Within 1–3 months': '1_3_months',
    'Within 1-3 months': '1_3_months',
    '1_3_months': '1_3_months',
    'More than 3 months away': '3_plus_months',
    '3_plus_months': '3_plus_months',
  };
  for (const [timeline, slug] of Object.entries(labels)) {
    const parsed = validateLead({ ...leadBody(), timeline }, { now, minFillMs: 2500, origins: [] });
    assert.equal(parsed.ok, true, timeline);
    if (parsed.ok) assert.equal(parsed.lead.timeline, slug);
  }

  const script = validateLead({ ...leadBody(), website: 'javascript:alert(1)' }, { now, minFillMs: 2500, origins: [] });
  assert.equal(script.ok, false);
  if (!script.ok) assert.deepEqual(script.fields, ['website']);
  const dataUrl = validateLead({ ...leadBody(), website: 'data:text/html,hi' }, { now, minFillMs: 2500, origins: [] });
  assert.equal(dataUrl.ok, false);
  const foreign = validateLead({ ...leadBody(), landing_page: 'https://evil.example/phish' }, { now, minFillMs: 2500, origins: ['shipleysolutionsgroup.com'] });
  assert.equal(foreign.ok && foreign.lead.landing_page, '');
});

test('a contact form without project type is rejected and honeypot or fast fill does not call the CRM', async () => {
  resetOwnerCache();
  const missing = await acceptLead(JSON.stringify({ ...leadBody(), project_type: '' }), null, headers(), options(privateJsonStore(), createMemoryCrm({ permissiveOwners: true })));
  assert.equal(missing.status, 400);
  assert.deepEqual((missing.body.fields as string[]).includes('project_type'), true);

  const crm = createMemoryCrm({ permissiveOwners: true });
  const honeypot = await acceptLead(JSON.stringify({ ...leadBody(), faxNumber: '555' }), null, headers(), options(privateJsonStore(), crm));
  assert.equal(honeypot.status, 200);
  assert.equal(honeypot.body.ok, true);
  assert.equal(crm.state.calls.length, 0);

  const fast = await acceptLead(JSON.stringify({ ...leadBody(), form_started_at: 1_700_000_000_000 - 100 }), null, headers(), options(privateJsonStore(), crm, { now: () => 1_700_000_000_000 }));
  assert.equal(fast.status, 200);
  assert.equal(crm.state.calls.length, 0);
  assert.equal('contactId' in fast.body, false);
});

test('unknown fields are stripped, oversized bodies are rejected, and the response has no contact id', async () => {
  resetOwnerCache();
  const logs: string[] = [];
  const original = console.info;
  console.info = (chunk?: unknown) => { logs.push(String(chunk)); };
  try {
    const store = privateJsonStore();
    const crm = createMemoryCrm({ permissiveOwners: true });
    const result = await acceptLead(JSON.stringify({ ...leadBody(), favoriteColor: 'blue' }), null, headers(), options(store, crm));
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { ok: true, status: 'received' });
    assert.equal(JSON.stringify(result.body).includes('qa@example.com'), false);
    assert.match(logs.join('\n'), /lead_unknown_fields_stripped/);
    assert.match(logs.join('\n'), /favoriteColor/);
    assert.equal(logs.join('\n').includes('qa@example.com'), false);
  } finally {
    console.info = original;
  }
  const huge = await acceptLead('{"email":"qa@example.com"}', '99999', headers(), options(privateJsonStore(), createMemoryCrm()));
  assert.equal(huge.status, 413);
});

test('one open inquiry task is reused for a later submission, and a completed task allows a new one', async () => {
  resetOwnerCache();
  const store = privateJsonStore();
  const crm = createMemoryCrm({ permissiveOwners: true });
  const mail = spyMailer();
  const base = options(store, crm, { mailer: mail.mailer, now: () => 1_700_000_000_000 });
  const first = await acceptLead(JSON.stringify(leadBody({ message: 'First inquiry message for the team.', client_submission_id: CID })), null, headers(), base);
  const second = await acceptLead(JSON.stringify(leadBody({ message: 'A genuinely new follow-up inquiry.', client_submission_id: CID_2 })), null, headers(), base);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(crm.state.tasks.length, 1);
  assert.equal(crm.state.tasks[0].properties.hubspot_owner_id, '94663488');
  assert.match(crm.state.tasks[0].properties.hs_task_body, /Follow-up inquiry/);
  assert.ok(crm.state.notes.length >= 1);
  const notices = mail.sent.filter((message) => message.subject.startsWith('Follow-up inquiry') || message.subject.startsWith('New web inquiry'));
  assert.equal(notices.length, 2);

  crm.state.tasks[0].properties.hs_task_status = 'COMPLETED';
  const third = await acceptLead(JSON.stringify(leadBody({ message: 'The earlier task is finished now.', client_submission_id: CID_3 })), null, headers(), base);
  assert.equal(third.status, 200);
  assert.equal(crm.state.tasks.filter((task) => task.properties.hs_task_status !== 'COMPLETED').length, 1);
  assert.equal(crm.state.tasks.length, 2);
});

test('concurrent creates share one task and a commit timeout is adopted without a second POST', async () => {
  resetOwnerCache();
  const store = privateJsonStore();
  const crm = createMemoryCrm({ permissiveOwners: true, createDelayMs: 30 });
  const base = options(store, crm, { env: env({ LEAD_LOCK_RETRY_MS: '200' }) });
  await Promise.all([
    acceptLead(JSON.stringify(leadBody({ message: 'Concurrent inquiry number one.', client_submission_id: CID })), null, headers('203.0.113.21'), base),
    acceptLead(JSON.stringify(leadBody({ message: 'Concurrent inquiry number two.', client_submission_id: CID_2 })), null, headers('203.0.113.22'), base),
  ]);
  assert.equal(crm.state.tasks.length, 1);

  resetOwnerCache();
  const failing = createFailingCrm('commit-timeout');
  const retryStore = privateJsonStore();
  const clock = { now: 1_700_000_000_000 };
  const retryOptions = options(retryStore, failing, { now: () => clock.now, env: env({ LEAD_MAX_ATTEMPTS: '4' }) });
  await acceptLead(JSON.stringify(leadBody()), null, headers(), retryOptions);
  const posts = () => failing.state.calls.filter((call) => call.method === 'POST' && call.path === '/crm/v3/objects/tasks').length;
  assert.equal(posts(), 1);
  clock.now += 6 * 60_000;
  await runDue({
    store: retryStore,
    crm: failing,
    mailer: spyMailer().mailer,
    env: env({ LEAD_MAX_ATTEMPTS: '4' }),
    now: () => clock.now,
    decision: { mode: 'mock', block: null },
  });
  assert.equal(failing.state.tasks.length, 1);
  assert.equal(posts(), 1);
});

test('a missing owner blocks the task, keeps the contact, and alerts once', async () => {
  resetOwnerCache();
  const store = privateJsonStore();
  const crm = createMemoryCrm();
  const mail = spyMailer();
  const result = await acceptLead(JSON.stringify(leadBody()), null, headers(), options(store, crm, {
    mailer: mail.mailer,
    env: env({ HUBSPOT_DEFAULT_OWNER_ID: '' }),
  }));
  assert.equal(result.status, 200);
  assert.equal(crm.state.contacts.length, 1);
  assert.equal(crm.state.tasks.length, 0);
  assert.equal(mail.sent.filter((message) => message.idempotencyKey.includes(':needs_owner')).length, 1);
  const saved = [...(await store.list({ prefix: 'sub/' })).blobs];
  assert.equal(saved.length, 1);
  const record = await store.get(saved[0].key) as SubmissionRecord;
  assert.equal(record.steps.owner.status, 'blocked_needs_owner');
  assert.notEqual(record.state, 'completed');
});

test('rate limit rejects the 6th IP and 4th email, a duplicate does not consume a slot, and a store error fails open', async () => {
  resetOwnerCache();
  const store = privateJsonStore();
  const crm = createMemoryCrm({ permissiveOwners: true });
  const base = options(store, crm);
  for (let i = 0; i < 5; i += 1) {
    const result = await acceptLead(JSON.stringify(leadBody({
      email: `person${i}@example.com`,
      message: `Inquiry number ${i} from this network.`,
      client_submission_id: `1111111${i}-1111-4111-8111-111111111111`,
    })), null, headers('203.0.113.40'), base);
    assert.equal(result.status, 200, `request ${i}`);
  }
  const limited = await acceptLead(JSON.stringify(leadBody({
    email: 'extra@example.com',
    message: 'This sixth network request should wait.',
    client_submission_id: CID_3,
  })), null, headers('203.0.113.40'), base);
  assert.equal(limited.status, 429);
  assert.ok((limited.retryAfter || 0) > 0);

  const emailStore = privateJsonStore();
  const emailCrm = createMemoryCrm({ permissiveOwners: true });
  const emailOptions = options(emailStore, emailCrm);
  for (let i = 0; i < 3; i += 1) {
    const result = await acceptLead(JSON.stringify(leadBody({
      message: `Email limited inquiry number ${i}.`,
      client_submission_id: `4444444${i}-4444-4444-8444-444444444444`,
    })), null, headers(`203.0.113.5${i}`), emailOptions);
    assert.equal(result.status, 200);
  }
  const emailLimited = await acceptLead(JSON.stringify(leadBody({
    message: 'Fourth email in this window should wait.',
    client_submission_id: '55555555-5555-4555-8555-555555555555',
  })), null, headers('203.0.113.59'), emailOptions);
  assert.equal(emailLimited.status, 429);

  const duplicate = await acceptLead(JSON.stringify(leadBody({
    message: 'Email limited inquiry number 0.',
    client_submission_id: '44444440-4444-4444-8444-444444444444',
  })), null, headers('203.0.113.50'), emailOptions);
  assert.equal(duplicate.status, 200);

  const openStore = privateJsonStore();
  openStore.getWithMetadata = async () => { throw new Error('store down'); };
  const opened = await acceptLead(JSON.stringify(leadBody({ email: 'open@example.com', client_submission_id: CID_2 })), null, headers('203.0.113.77'), options(openStore, createMemoryCrm({ permissiveOwners: true }), { env: env({ LEAD_STORE_KEY: '' }) }));
  assert.equal(opened.status, 200);
});

test('HubSpot downtime persists then recovers, both stores failing is a 502, and dead letter alerts once', async () => {
  resetOwnerCache();
  const store = privateJsonStore();
  const down = createFailingCrm('down');
  const clock = { now: 1_700_000_000_000 };
  const mail = spyMailer();
  const first = await acceptLead(JSON.stringify(leadBody()), null, headers(), options(store, down, { now: () => clock.now, mailer: mail.mailer }));
  assert.equal(first.status, 200);
  const queued = await store.list({ prefix: 'sub/' });
  assert.equal(queued.blobs.length, 1);
  const waiting = await store.get(queued.blobs[0].key) as SubmissionRecord;
  assert.equal(waiting.steps.contact.status, 'failed');
  assert.equal(waiting.state, 'retry_scheduled');
  assert.equal(down.state.contacts.length, 0);

  const healthy = createMemoryCrm({ permissiveOwners: true });
  clock.now += 6 * 60_000;
  const processed = await runDue({
    store,
    crm: healthy,
    mailer: mail.mailer,
    env: env(),
    now: () => clock.now,
    decision: { mode: 'mock', block: null },
  });
  assert.equal(processed, 1);
  assert.equal(healthy.state.contacts.length, 1);
  const done = await store.get(queued.blobs[0].key) as SubmissionRecord;
  assert.equal(done.state, 'completed');

  const broken = privateJsonStore();
  const original = broken.setJSON.bind(broken);
  broken.setJSON = async (key, value, write) => {
    if (key.startsWith('sub/') || key.startsWith('queue/')) throw new Error('blobs down');
    return original(key, value, write);
  };
  const both = await acceptLead(JSON.stringify(leadBody({ client_submission_id: CID_2 })), null, headers(), options(broken, createFailingCrm('down'), { now: () => clock.now }));
  assert.equal(both.status, 502);

  resetOwnerCache();
  const dlqStore = privateJsonStore();
  const dlqMail = spyMailer();
  const dlqClock = { now: 1_800_000_000_000 };
  const dlqOptions = options(dlqStore, createFailingCrm('down'), {
    now: () => dlqClock.now,
    mailer: dlqMail.mailer,
    env: env({ LEAD_MAX_ATTEMPTS: '2' }),
  });
  assert.equal((await acceptLead(JSON.stringify(leadBody({ client_submission_id: CID_3 })), null, headers(), dlqOptions)).status, 200);
  dlqClock.now += 6 * 60_000;
  await runDue({
    store: dlqStore,
    crm: createFailingCrm('down'),
    mailer: dlqMail.mailer,
    env: env({ LEAD_MAX_ATTEMPTS: '2' }),
    now: () => dlqClock.now,
    decision: { mode: 'mock', block: null },
  });
  const letters = await dlqStore.list({ prefix: 'dlq/' });
  assert.equal(letters.blobs.length, 1);
  const alerts = dlqMail.sent.filter((message) => message.subject === '[SSG intake] Lead needs attention');
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].idempotencyKey, /^alert:/);
  assert.equal(alerts[0].text.includes('qa@example.com'), false);
  assert.equal(alerts[0].text.includes('Please review'), false);
});

test('webhook stays off outside production and the signed body is an allowlist', async () => {
  resetOwnerCache();
  const store = privateJsonStore();
  const crm = createMemoryCrm({ permissiveOwners: true });
  await acceptLead(JSON.stringify(leadBody()), null, headers(), options(store, crm, {
    env: env({
      LEAD_WEBHOOK_URL: 'https://hooks.example/lead',
      LEAD_WEBHOOK_AUTHORIZED: 'true',
      LEAD_WEBHOOK_SECRET: 'w'.repeat(40),
    }),
  }));
  const saved = await store.get((await store.list({ prefix: 'sub/' })).blobs[0].key) as SubmissionRecord;
  assert.equal(saved.steps.webhook.status, 'skipped');
  assert.equal(saved.steps.webhook.err, 'webhook_disabled');
  assert.equal(webhookGate({ LEAD_WEBHOOK_URL: 'http://hooks.example/lead', LEAD_WEBHOOK_AUTHORIZED: 'true', LEAD_WEBHOOK_SECRET: 'w'.repeat(40) }).enabled, false);
  const raw = buildWebhookBody({
    subKey: 'a'.repeat(64),
    occurredAt: '2026-10-25T00:00:00.000Z',
    lead: {
      first_name: 'QA', last_name: 'Synthetic', email: 'qa@example.com', phone: '555', company: 'QA Synthetic Co',
      website: '', project_type: 'A new website', timeline: 'not_sure', budget: '', message: 'Please review this preview isolation submission.',
      consent: true, form_variant: 'contact', source: 'website-quote-request', utm_source: '', utm_medium: '',
      utm_campaign: '', landing_page: '', client_submission_id: CID,
    },
    includeContact: false,
  });
  const body = JSON.parse(raw) as Record<string, string>;
  assert.equal(body.event, 'lead.received');
  assert.equal('message' in body, false);
  assert.equal('email' in body, false);
  assert.equal('phone' in body, false);
  assert.match(signWebhook('w'.repeat(40), '100', raw), /^v1=[0-9a-f]{64}$/);
});

test('completed and dead-letter records age out, and an unconfigured mailer does not throw', async () => {
  const store = privateJsonStore();
  const now = 1_900_000_000_000;
  const old = new Date(now - 40 * 86_400_000).toISOString();
  const recent = new Date(now - 86_400_000).toISOString();
  const shell = { v: 1, attempts: 1, nextAttemptAt: 0, steps: {}, payload: { iv: '', tag: '', data: '' } };
  await store.setJSON('sub/old-done', { ...shell, subKey: 'old-done', state: 'completed', createdAt: old, updatedAt: old });
  await store.setJSON('sub/fresh-done', { ...shell, subKey: 'fresh-done', state: 'completed', createdAt: recent, updatedAt: recent });
  await store.setJSON('sub/old-dlq', { ...shell, subKey: 'old-dlq', state: 'dead_letter', createdAt: old, updatedAt: old });
  await store.setJSON('dlq/old-dlq', { reason: 'attempts', at: old });
  await store.setJSON('spam/bot', { at: old, reason: 'honeypot' });
  await runDue({
    store,
    crm: createMemoryCrm(),
    mailer: spyMailer().mailer,
    env: env(),
    now: () => now,
    decision: { mode: 'mock', block: null },
  });
  assert.equal(await store.get('sub/old-done'), null);
  assert.ok(await store.get('sub/fresh-done'));
  assert.equal(await store.get('sub/old-dlq'), null);
  assert.equal(await store.get('dlq/old-dlq'), null);
  assert.equal(await store.get('spam/bot'), null);

  const mailer = createMailer({ mode: 'live', block: null }, {} as NodeJS.ProcessEnv);
  const skipped = await mailer.send({ to: ['a@example.com'], from: 'b@example.com', subject: 'x', text: 'y', idempotencyKey: 'notify:test' });
  assert.equal(skipped.skipped, 'notify_unconfigured');
});

test('the route reports mock mode without a contact id and does not call the legacy search dedupe', async () => {
  const previous = new Map<string, string | undefined>();
  const values: Record<string, string> = {
    CONTEXT: 'deploy-preview',
    NETLIFY: 'true',
    URL: 'https://www.shipleysolutionsgroup.com',
    HUBSPOT_ACCESS_TOKEN: 'prod-token-SHOULD-NOT-LEAK',
    OPENAI_API_KEY: 'sk-test-SHOULD-NOT-LEAK',
    LEAD_AUTOMATION_ENABLED: 'true',
    HUBSPOT_DEFAULT_OWNER_ID: '94663488',
  };
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    calls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    throw new Error('unexpected outbound');
  };
  try {
    const response = await postLead(new NextRequest('https://deploy-preview-9--ssg.netlify.app/api/lead', {
      method: 'POST',
      headers: { host: 'deploy-preview-9--ssg.netlify.app', 'content-type': 'application/json' },
      body: JSON.stringify(leadBody()),
    }));
    const body = await response.json() as Record<string, unknown>;
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-SSG-Lead-Mode'), 'mock');
    assert.equal('contactId' in body, false);
    assert.equal(body.status, 'received');
    assert.deepEqual(calls, []);
  } finally {
    globalThis.fetch = original;
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  const route = readFileSync(new URL('../app/api/lead/route.ts', import.meta.url), 'utf8');
  assert.equal(route.includes('runLeadAutomation'), false);
  assert.equal(route.includes('findOpenFollowUpTask'), false);
  const scheduled = readFileSync(new URL('../netlify/functions/lead-retry.mts', import.meta.url), 'utf8');
  assert.match(scheduled, /schedule:\s*"\*\/10 \* \* \* \*"/);
  assert.match(scheduled, /runDue/);
});
