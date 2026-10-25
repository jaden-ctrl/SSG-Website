import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decideRuntimeMode, hostFromHeaders, PRODUCTION_HUBSPOT_PORTAL_ID } from '@/lib/runtime-mode';

const productionHost = 'www.shipleysolutionsgroup.com';

test('live only when the baked build context is production and the host is allowlisted', () => {
  const live = decideRuntimeMode({
    buildContext: 'production',
    runtimeContext: undefined,
    host: productionHost,
    env: {},
  });
  assert.equal(live.mode, 'live');
  assert.equal(live.block, null);

  const unsetRuntime = decideRuntimeMode({
    buildContext: 'production',
    runtimeContext: '',
    host: 'shipleysolutionsgroup.com',
    env: {},
  });
  assert.equal(unsetRuntime.mode, 'live');
});

test('preview, missing context, and a production token cannot enable live calls', () => {
  const cases = [
    { buildContext: 'deploy-preview', runtimeContext: 'deploy-preview', host: 'deploy-preview-9--ssg.netlify.app' },
    { buildContext: 'non-production', runtimeContext: undefined, host: productionHost },
    { buildContext: undefined, runtimeContext: undefined, host: productionHost },
    { buildContext: 'production', runtimeContext: 'deploy-preview', host: productionHost },
    { buildContext: 'production', runtimeContext: undefined, host: 'deploy-preview-9--ssg.netlify.app' },
    { buildContext: 'production', runtimeContext: undefined, host: null },
    { buildContext: 'branch-deploy', runtimeContext: undefined, host: productionHost },
  ];
  for (const input of cases) {
    const decision = decideRuntimeMode({
      ...input,
      env: { HUBSPOT_ACCESS_TOKEN: 'prod-token', OPENAI_API_KEY: 'sk-test', RESEND_API_KEY: 're_test' },
    });
    assert.equal(decision.mode, 'mock', JSON.stringify(input));
    assert.equal(decision.block, null);
  }
});

test('an unparseable host list or live-test flag fails closed to mock', () => {
  const badHosts = decideRuntimeMode({
    buildContext: 'production',
    host: productionHost,
    env: { LEAD_PRODUCTION_HOSTS: 'https://evil.example/path' },
  });
  assert.equal(badHosts.mode, 'mock');

  const badFlag = decideRuntimeMode({
    buildContext: 'deploy-preview',
    host: 'deploy-preview-1--ssg.netlify.app',
    env: { LEAD_LIVE_TEST: 'yes', HUBSPOT_TEST_ACCESS_TOKEN: 'test-token', HUBSPOT_TEST_PORTAL_ID: '999' },
  });
  assert.equal(badFlag.mode, 'mock');
});

test('production build wins over LEAD_LIVE_TEST so the production token is not swapped', () => {
  const decision = decideRuntimeMode({
    buildContext: 'production',
    host: productionHost,
    env: { LEAD_LIVE_TEST: 'true', HUBSPOT_TEST_ACCESS_TOKEN: 'test-token', HUBSPOT_TEST_PORTAL_ID: '999' },
  });
  assert.equal(decision.mode, 'live');
});

test('live test requires test credentials and hard-fails the production portal', () => {
  const ready = decideRuntimeMode({
    buildContext: 'deploy-preview',
    host: 'deploy-preview-1--ssg.netlify.app',
    env: { LEAD_LIVE_TEST: 'true', HUBSPOT_TEST_ACCESS_TOKEN: 'test-token', HUBSPOT_TEST_PORTAL_ID: '999' },
  });
  assert.equal(ready.mode, 'live-test');
  assert.equal(ready.block, null);

  const incomplete = decideRuntimeMode({
    buildContext: 'deploy-preview',
    host: 'deploy-preview-1--ssg.netlify.app',
    env: { LEAD_LIVE_TEST: 'true', HUBSPOT_ACCESS_TOKEN: 'prod-token', HUBSPOT_PORTAL_ID: PRODUCTION_HUBSPOT_PORTAL_ID },
  });
  assert.equal(incomplete.mode, 'mock');
  assert.equal(incomplete.block, null);

  const blocked = decideRuntimeMode({
    buildContext: 'deploy-preview',
    host: 'deploy-preview-1--ssg.netlify.app',
    env: {
      LEAD_LIVE_TEST: 'true',
      HUBSPOT_TEST_ACCESS_TOKEN: 'test-token',
      HUBSPOT_TEST_PORTAL_ID: PRODUCTION_HUBSPOT_PORTAL_ID,
    },
  });
  assert.equal(blocked.mode, 'mock');
  assert.equal(blocked.block, 'production_portal');
});

test('a forwarded host that disagrees with Host is ignored', () => {
  const spoofed = new Headers({
    host: 'deploy-preview-1--ssg.netlify.app',
    'x-forwarded-host': 'www.shipleysolutionsgroup.com',
  });
  assert.equal(hostFromHeaders(spoofed), 'deploy-preview-1--ssg.netlify.app');

  const agreed = new Headers({
    host: 'www.shipleysolutionsgroup.com',
    'x-forwarded-host': 'www.shipleysolutionsgroup.com',
  });
  assert.equal(hostFromHeaders(agreed), 'www.shipleysolutionsgroup.com');

  const onlyForwarded = new Headers({ 'x-forwarded-host': 'www.shipleysolutionsgroup.com' });
  assert.equal(hostFromHeaders(onlyForwarded), null);
});
