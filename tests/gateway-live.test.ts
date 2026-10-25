import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { dispatchOutbound, HUBSPOT_ACCOUNT_INFO_PATH, hubspotOrigin, isPortalProof, LiveTestBlockedError, PORTAL_CACHE_TTL_MS, resendOrigin, resetLiveTestPortalCache, setPortalCacheNow } from '@/lib/gateway';
import { PRODUCTION_HUBSPOT_PORTAL_ID } from '@/lib/runtime-mode';

beforeEach(() => resetLiveTestPortalCache());

const originalFetch = globalThis.fetch;

test('live mode proves portal 246622244 before it calls HubSpot with the production token', async () => {
  const seen: { url: string; authorization: string; method: string }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const headers = new Headers(init?.headers);
    const method = init?.method || 'GET';
    seen.push({ url, authorization: headers.get('authorization') || '', method });
    if (url.endsWith(HUBSPOT_ACCOUNT_INFO_PATH)) return Response.json({ portalId: Number(PRODUCTION_HUBSPOT_PORTAL_ID) });
    return Response.json({ id: '1', results: [] });
  };
  try {
    const response = await dispatchOutbound({
      channel: 'hubspot',
      path: '/crm/v3/objects/contacts',
      method: 'POST',
      body: '{}',
    }, { mode: 'live', block: null }, {
      HUBSPOT_ACCESS_TOKEN: 'prod-token',
      HUBSPOT_TEST_ACCESS_TOKEN: 'test-token',
    });
    assert.equal(response.ok, true);
    assert.equal(seen[0].url.endsWith(HUBSPOT_ACCOUNT_INFO_PATH), true);
    assert.equal(seen[0].method, 'GET');
    assert.equal(seen[0].authorization, 'Bearer prod-token');
    const writes = seen.filter((call) => !call.url.endsWith(HUBSPOT_ACCOUNT_INFO_PATH));
    assert.equal(writes.length, 1);
    assert.equal(writes[0].url, `${hubspotOrigin}/crm/v3/objects/contacts`);
    assert.equal(writes[0].authorization, 'Bearer prod-token');
    assert.equal(writes[0].authorization.includes('test-token'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('live test uses the test token and never the production token', async () => {
  const seen: { url: string; authorization: string }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    seen.push({ url, authorization: new Headers(init?.headers).get('authorization') || '' });
    if (url.endsWith(HUBSPOT_ACCOUNT_INFO_PATH)) return Response.json({ portalId: 999 });
    return Response.json({ id: '1' });
  };
  try {
    await dispatchOutbound({
      channel: 'hubspot',
      path: '/crm/v3/objects/contacts/batch/upsert',
      method: 'POST',
      body: '{}',
    }, { mode: 'live-test', block: null }, {
      HUBSPOT_ACCESS_TOKEN: 'prod-token',
      HUBSPOT_TEST_ACCESS_TOKEN: 'test-token',
      HUBSPOT_TEST_PORTAL_ID: '999',
    });
    const writes = seen.filter((call) => !call.url.endsWith(HUBSPOT_ACCOUNT_INFO_PATH));
    const proof = seen.filter((call) => call.url.endsWith(HUBSPOT_ACCOUNT_INFO_PATH));
    assert.equal(proof.length, 1);
    assert.equal(proof[0].authorization, 'Bearer test-token');
    assert.equal(writes.length, 1);
    assert.equal(writes[0].url, `${hubspotOrigin}/crm/v3/objects/contacts/batch/upsert`);
    assert.equal(writes[0].authorization, 'Bearer test-token');
    assert.equal(writes[0].authorization.includes('prod-token'), false);

    seen.length = 0;
    const email = await dispatchOutbound({
      channel: 'resend',
      path: '/emails',
      method: 'POST',
      body: '{}',
      recipients: ['qa@example.com'],
    }, { mode: 'live-test', block: null }, {
      RESEND_API_KEY: 'prod-resend',
      RESEND_TEST_API_KEY: 'test-resend',
      NOTIFY_EMAIL_TEST_TO: 'qa@example.com',
    });
    assert.equal(email.headers.get('X-SSG-Outbound'), null);
    assert.equal(seen[0].url.startsWith(resendOrigin), true);
    assert.equal(seen[0].authorization, 'Bearer test-resend');

    seen.length = 0;
    const blockedMail = await dispatchOutbound({
      channel: 'resend',
      path: '/emails',
      method: 'POST',
      body: '{}',
      recipients: ['outsider@example.net'],
    }, { mode: 'live-test', block: null }, {
      RESEND_API_KEY: 'prod-resend',
      RESEND_TEST_API_KEY: 'test-resend',
      NOTIFY_EMAIL_TEST_TO: 'qa@example.com',
    });
    assert.equal(blockedMail.headers.get('X-SSG-Outbound'), 'mock');
    assert.equal(seen.length, 0);

    seen.length = 0;
    const webhook = await dispatchOutbound({
      channel: 'webhook',
      policy: 'lead',
      url: 'https://hooks.example/lead',
      method: 'POST',
      body: '{}',
    }, { mode: 'live-test', block: null }, {
      LEAD_WEBHOOK_URL: 'https://hooks.example/lead',
      LEAD_WEBHOOK_AUTHORIZED: 'true',
      LEAD_WEBHOOK_SECRET: 's'.repeat(32),
    });
    assert.equal(webhook.headers.get('X-SSG-Outbound'), 'mock');
    assert.equal(seen.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a live test aimed at the production portal makes no outbound call', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error('outbound');
  };
  try {
    await assert.rejects(
      () => dispatchOutbound({ channel: 'hubspot', path: '/crm/v3/objects/contacts', method: 'POST', body: '{}' }, {
        mode: 'mock',
        block: 'production_portal',
      }, { HUBSPOT_TEST_PORTAL_ID: PRODUCTION_HUBSPOT_PORTAL_ID, HUBSPOT_TEST_ACCESS_TOKEN: 'test-token' }),
      LiveTestBlockedError,
    );
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('live-test blocks a token whose account-info portal is 246622244 before any write', async () => {
  const seen: { method: string; url: string }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    seen.push({ method: init?.method || 'GET', url });
    if (url.endsWith(HUBSPOT_ACCOUNT_INFO_PATH)) return Response.json({ portalId: Number(PRODUCTION_HUBSPOT_PORTAL_ID) });
    return Response.json({ id: 'should-not-write' });
  };
  try {
    await assert.rejects(
      () => dispatchOutbound({
        channel: 'hubspot',
        path: '/crm/v3/objects/contacts',
        method: 'POST',
        body: '{}',
      }, { mode: 'live-test', block: null }, {
        HUBSPOT_ACCESS_TOKEN: 'prod-token',
        HUBSPOT_TEST_ACCESS_TOKEN: 'test-token',
        HUBSPOT_TEST_PORTAL_ID: '999',
      }),
      (error: unknown) => error instanceof LiveTestBlockedError && error.code === 'production_portal',
    );
    assert.equal(seen.length, 1);
    assert.equal(seen[0].method, 'GET');
    assert.equal(seen[0].url.endsWith(HUBSPOT_ACCOUNT_INFO_PATH), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('live-test blocks when the HubSpot portal cannot be verified', async () => {
  const cases: { name: string; body: unknown; status: number; declared: string; code: string }[] = [
    { name: 'unreadable', body: { nope: true }, status: 200, declared: '999', code: 'portal_unverified' },
    { name: 'http-500', body: { portalId: 999 }, status: 500, declared: '999', code: 'portal_unverified' },
    { name: 'mismatch', body: { portalId: 111 }, status: 200, declared: '999', code: 'portal_unverified' },
  ];
  for (const item of cases) {
    resetLiveTestPortalCache();
    const writes: string[] = [];
    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method || 'GET';
      if (method !== 'GET') writes.push(url);
      return Response.json(item.body, { status: item.status });
    };
    try {
      await assert.rejects(
        () => dispatchOutbound({
          channel: 'hubspot',
          path: '/crm/v3/objects/contacts',
          method: 'POST',
          body: '{}',
        }, { mode: 'live-test', block: null }, {
          HUBSPOT_TEST_ACCESS_TOKEN: 'test-token',
          HUBSPOT_TEST_PORTAL_ID: item.declared,
        }),
        (error: unknown) => error instanceof LiveTestBlockedError && error.code === item.code,
        item.name,
      );
      assert.deepEqual(writes, [], item.name);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
});

test('mock mode does not call fetch even when production credentials are present', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error('outbound');
  };
  try {
    const response = await dispatchOutbound({
      channel: 'hubspot',
      path: '/crm/v3/objects/contacts',
      method: 'POST',
      body: '{}',
    }, { mode: 'mock', block: null }, { HUBSPOT_ACCESS_TOKEN: 'prod-token', OPENAI_API_KEY: 'sk-test' });
    assert.equal(response.headers.get('X-SSG-Outbound'), 'mock');
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a caller cannot forge a portal proof with a purpose field', () => {
  const forged = {
    channel: 'hubspot' as const,
    path: '/crm/v3/objects/contacts',
    method: 'POST',
    body: '{}',
    purpose: 'portal-check',
  };
  assert.equal(isPortalProof(forged), false);
  assert.equal(isPortalProof({ channel: 'hubspot', path: HUBSPOT_ACCOUNT_INFO_PATH, method: 'GET' }), true);
  assert.equal(isPortalProof({ channel: 'hubspot', path: HUBSPOT_ACCOUNT_INFO_PATH, method: 'POST', body: '{}' }), false);
});

test('live mode blocks a portal mismatch, an unverifiable proof, and a network error before any write', async () => {
  const cases: { name: string; respond: () => Promise<Response> | Response; code: string }[] = [
    { name: 'wrong-portal', respond: () => Response.json({ portalId: 99999999 }), code: 'production_mismatch' },
    { name: 'string-hub-id', respond: () => Response.json({ hub_id: '111' }), code: 'production_mismatch' },
    { name: 'missing-id', respond: () => Response.json({ ok: true }), code: 'portal_unverified' },
    { name: 'http-500', respond: () => Response.json({ portalId: Number(PRODUCTION_HUBSPOT_PORTAL_ID) }, { status: 500 }), code: 'portal_unverified' },
    { name: 'network', respond: () => { throw new Error('down'); }, code: 'portal_unverified' },
    { name: 'mock-header', respond: () => Response.json({ portalId: Number(PRODUCTION_HUBSPOT_PORTAL_ID) }, { headers: { 'X-SSG-Outbound': 'mock' } }), code: 'portal_unverified' },
  ];
  for (const item of cases) {
    resetLiveTestPortalCache();
    const writes: string[] = [];
    globalThis.fetch = async (input, init) => {
      const method = init?.method || 'GET';
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (method !== 'GET') writes.push(url);
      return item.respond();
    };
    try {
      await assert.rejects(
        () => dispatchOutbound({
          channel: 'hubspot',
          path: '/crm/v3/objects/contacts',
          method: 'POST',
          body: '{}',
        }, { mode: 'live', block: null }, { HUBSPOT_ACCESS_TOKEN: 'prod-token' }),
        (error: unknown) => error instanceof LiveTestBlockedError && error.code === item.code,
        item.name,
      );
      assert.deepEqual(writes, [], item.name);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
});

test('a numeric string portal id is accepted and the cache expires', async () => {
  let now = 1_700_000_000_000;
  let proofs = 0;
  setPortalCacheNow(() => now);
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith(HUBSPOT_ACCOUNT_INFO_PATH)) {
      proofs += 1;
      return Response.json({ portalId: PRODUCTION_HUBSPOT_PORTAL_ID });
    }
    return Response.json({ id: '1' });
  };
  try {
    const env = { HUBSPOT_ACCESS_TOKEN: 'prod-token' };
    const write = () => dispatchOutbound({
      channel: 'hubspot',
      path: '/crm/v3/objects/contacts',
      method: 'POST',
      body: '{}',
    }, { mode: 'live', block: null }, env);
    await write();
    await write();
    assert.equal(proofs, 1);
    now += PORTAL_CACHE_TTL_MS + 1;
    await write();
    assert.equal(proofs, 2);
    const swapped = { HUBSPOT_ACCESS_TOKEN: 'other-token' };
    await dispatchOutbound({
      channel: 'hubspot',
      path: '/crm/v3/objects/contacts',
      method: 'POST',
      body: '{}',
    }, { mode: 'live', block: null }, swapped);
    assert.equal(proofs, 3);
  } finally {
    globalThis.fetch = originalFetch;
    resetLiveTestPortalCache();
  }
});

test('concurrent live writes both wait for a portal proof', async () => {
  const order: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method || 'GET';
    order.push(method);
    if (url.endsWith(HUBSPOT_ACCOUNT_INFO_PATH)) return Response.json({ portalId: Number(PRODUCTION_HUBSPOT_PORTAL_ID) });
    return Response.json({ id: '1' });
  };
  try {
    await Promise.all([
      dispatchOutbound({ channel: 'hubspot', path: '/crm/v3/objects/contacts', method: 'POST', body: '{}' }, { mode: 'live', block: null }, { HUBSPOT_ACCESS_TOKEN: 'prod-token' }),
      dispatchOutbound({ channel: 'hubspot', path: '/crm/v3/objects/contacts', method: 'POST', body: '{}' }, { mode: 'live', block: null }, { HUBSPOT_ACCESS_TOKEN: 'prod-token' }),
    ]);
    const firstWrite = order.indexOf('POST');
    assert.ok(order.slice(0, firstWrite).includes('GET'));
    assert.equal(order.filter((method) => method === 'POST').length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
