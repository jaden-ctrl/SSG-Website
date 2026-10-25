import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planBlobStore } from '@/lib/blob-store';

test('preview and non-production plans never use the production blob store name', () => {
  const preview = planBlobStore('lead-intake', {
    NETLIFY: 'true',
    CONTEXT: 'deploy-preview',
    URL: 'https://www.shipleysolutionsgroup.com',
    HUBSPOT_ACCESS_TOKEN: 'prod-token',
  }, 'non-production');
  assert.equal(preview.kind, 'memory');
  assert.notEqual(preview.kind === 'memory' ? preview.name : '', 'lead-intake');

  const bakedPreview = planBlobStore('ssgai-cases', {
    NETLIFY: 'true',
    URL: 'https://deploy-preview-4--ssg.netlify.app',
  }, 'deploy-preview');
  assert.equal(bakedPreview.kind, 'memory');

  const leads = planBlobStore('ssgai-leads', { NETLIFY: 'true', CONTEXT: 'branch-deploy' }, 'production');
  assert.equal(leads.kind, 'memory');
});

test('production plan keeps the existing site-wide store name', () => {
  const plan = planBlobStore('lead-intake', {
    NETLIFY: 'true',
    URL: 'https://www.shipleysolutionsgroup.com',
  }, 'production');
  assert.deepEqual(plan, { kind: 'site', name: 'lead-intake' });

  const cases = planBlobStore('ssgai-cases', {
    NETLIFY: 'true',
    URL: 'https://shipleysolutionsgroup.com',
  }, 'production');
  assert.deepEqual(cases, { kind: 'site', name: 'ssgai-cases' });
});

test('a live test uses a deploy-scoped store name, not the production store', () => {
  const plan = planBlobStore('lead-intake', {
    NETLIFY: 'true',
    URL: 'https://deploy-preview-2--ssg.netlify.app',
    LEAD_LIVE_TEST: 'true',
    HUBSPOT_TEST_ACCESS_TOKEN: 'test-token',
    HUBSPOT_TEST_PORTAL_ID: '999',
  }, 'non-production');
  assert.equal(plan.kind, 'deploy');
  assert.equal(plan.kind === 'deploy' ? plan.name : '', 'lead-intake--livetest');
});
