import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { POST as postLead } from '@/app/api/lead/route';
import { POST as postAudit } from '@/app/api/audit/route';
import { GET as getHealth } from '@/app/api/health/route';
import { analyzeBusiness } from '@/lib/agent/ssgai';
import { projectReleasedLead } from '@/lib/actions/leads';
import type { Intake } from '@/lib/schemas';

const SECRET = 'prod-token-SHOULD-NOT-LEAK';
const OPENAI = 'sk-test-SHOULD-NOT-LEAK';

function previewEnv() {
  return {
    CONTEXT: 'deploy-preview',
    NETLIFY: 'true',
    URL: 'https://www.shipleysolutionsgroup.com',
    HUBSPOT_ACCESS_TOKEN: SECRET,
    HUBSPOT_DEFAULT_OWNER_ID: '94663488',
    HUBSPOT_PORTAL_ID: '246622244',
    OPENAI_API_KEY: OPENAI,
    RESEND_API_KEY: 're_prod_SHOULD-NOT-LEAK',
    NOTIFY_EMAIL_TO: 'jaden@shipleysolutionsgroup.com',
    NOTIFY_EMAIL_FROM: 'SSG Leads <leads@example.com>',
    LEAD_AUTOMATION_ENABLED: 'true',
    LEAD_WEBHOOK_URL: 'https://webhook.qa.invalid/lead',
    LEAD_WEBHOOK_AUTHORIZED: 'true',
    LEAD_WEBHOOK_SECRET: 'w'.repeat(40),
    SSGAI_LEAD_WEBHOOK_URL: 'https://webhook.qa.invalid/ssgai',
    SSGAI_LEAD_WEBHOOK_SECRET: 's'.repeat(20),
    SSGAI_REVIEW_TOKEN: 'review-token',
  };
}

async function withPreview<T>(fn: (calls: string[], logs: string[]) => Promise<T>) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(previewEnv())) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }
  const calls: string[] = [];
  const logs: string[] = [];
  const originalFetch = globalThis.fetch;
  const originalInfo = console.info;
  const originalError = console.error;
  const originalWarn = console.warn;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    throw new Error('unexpected outbound');
  };
  const capture = (chunk: unknown) => {
    logs.push(typeof chunk === 'string' ? chunk : JSON.stringify(chunk));
  };
  console.info = (...args) => capture(args.map(String).join(' '));
  console.error = (...args) => capture(args.map(String).join(' '));
  console.warn = (...args) => capture(args.map(String).join(' '));
  try {
    return await fn(calls, logs);
  } finally {
    globalThis.fetch = originalFetch;
    console.info = originalInfo;
    console.error = originalError;
    console.warn = originalWarn;
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const intake: Intake = {
  firstName: 'QA',
  lastName: 'Synthetic',
  email: 'qa@example.com',
  company: 'QA Synthetic Co',
  website: 'https://example.com',
  teamSize: '2-10',
  offer: 'A clear offer for local customers.',
  challenge: 'The follow-up process is inconsistent.',
  attempts: '',
  goal: 'A reliable way to respond to new inquiries.',
  revenueRange: 'Under $250K',
  consent: 'true',
  faxNumber: '',
};

test('deploy preview lead flow, AI, and the legacy HubSpot path make zero outbound calls', async () => {
  await withPreview(async (calls, logs) => {
    const lead = await postLead(new NextRequest('https://deploy-preview-9--ssg.netlify.app/api/lead', {
      method: 'POST',
      headers: {
        host: 'deploy-preview-9--ssg.netlify.app',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'qa-preview@example.com',
        first_name: 'QA',
        last_name: 'Synthetic',
        company: 'QA Synthetic Co',
        message: 'Please review this preview isolation submission.',
        consent: 'true',
        form_variant: 'contact',
        project_type: 'A new website',
      }),
    }));
    const leadBody = await lead.text();
    assert.equal(lead.status, 200);
    assert.equal(lead.headers.get('X-SSG-Lead-Mode'), 'mock');
    assert.equal(leadBody.includes(SECRET), false);
    assert.equal(leadBody.includes(OPENAI), false);

    const audit = await analyzeBusiness(intake);
    assert.equal(audit.confidence, 'low');

    const retired = await postAudit();
    assert.equal(retired.status, 410);

    const health = await getHealth();
    const healthBody = await health.text();
    assert.equal(health.status, 200);
    assert.equal(healthBody.includes(OPENAI), false);
    assert.equal(healthBody.includes('openaiConfigured'), true);

    await projectReleasedLead({ ...intake, id: 'case-preview', createdAt: new Date().toISOString(), status: 'analyzed' });

    assert.deepEqual(calls, []);
    const logged = logs.join('\n');
    assert.equal(logged.includes(SECRET), false);
    assert.equal(logged.includes(OPENAI), false);
    assert.equal(logged.includes('re_prod_SHOULD-NOT-LEAK'), false);
    assert.match(logged, /"event":"lead_runtime_mode","mode":"mock"/);
    assert.match(logged, /"event":"ai_runtime_mode","mode":"mock"/);
  });
});

test('an explicit live test against the production portal fails before any call', async () => {
  await withPreview(async (calls, logs) => {
    process.env.LEAD_LIVE_TEST = 'true';
    process.env.HUBSPOT_TEST_ACCESS_TOKEN = 'test-token';
    process.env.HUBSPOT_TEST_PORTAL_ID = '246622244';
    const response = await postLead(new NextRequest('https://deploy-preview-9--ssg.netlify.app/api/lead', {
      method: 'POST',
      headers: { host: 'deploy-preview-9--ssg.netlify.app', 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'qa@example.com', first_name: 'QA', consent: 'true' }),
    }));
    const body = await response.text();
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('X-SSG-Lead-Mode'), 'mock');
    assert.equal(body.includes('246622244'), false);
    assert.equal(body.includes('test-token'), false);
    assert.deepEqual(calls, []);
    assert.match(logs.join('\n'), /lead_live_test_blocked/);
  });
});
