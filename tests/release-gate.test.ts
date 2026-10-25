import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { POST as postReview } from '@/app/api/admin/reviews/route';
import { handleLeadAdmission } from '@/lib/lead/admission';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function resolveImport(fromFile: string, spec: string): string | null {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.mts`, `${base}.mjs`, `${base}.js`];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

test('the scheduled retry graph does not use path aliases', () => {
  const start = path.join(root, 'netlify/functions/lead-retry.mts');
  const seen = new Set<string>();
  const violations: string[] = [];
  const queue = [start];
  while (queue.length) {
    const file = queue.pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    if (/from\s+['"]@\//.test(text)) violations.push(path.relative(root, file));
    for (const match of text.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      const next = resolveImport(file, match[1]);
      if (next) queue.push(next);
      else violations.push(`${path.relative(root, file)} unresolved ${match[1]}`);
    }
  }
  assert.deepEqual(violations, []);
  assert.ok(seen.has(path.join(root, 'lib/lead/processor.ts')));
});

test('legacy SSGAI webhook is gone', () => {
  const leads = readFileSync(path.join(root, 'lib/actions/leads.ts'), 'utf8');
  const gateway = readFileSync(path.join(root, 'lib/gateway.ts'), 'utf8');
  const example = readFileSync(path.join(root, '.env.example'), 'utf8');
  assert.equal(leads.includes('SSGAI_LEAD_WEBHOOK'), false);
  assert.equal(gateway.includes('SSGAI_LEAD_WEBHOOK'), false);
  assert.equal(gateway.includes('legacy-ssgai'), false);
  assert.equal(example.includes('SSGAI_LEAD_WEBHOOK'), false);
  assert.equal(example.includes('LEAD_TASK_DEDUPE_DAYS'), false);
});

test('production bake check fails when CONTEXT is production but the baked value is not', () => {
  const script = `
    import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
    import { tmpdir } from 'node:os';
    import { join } from 'node:path';
    import { bakedContextValue, main, productionBakeFailed } from './scripts/write-build-context.mjs';
    if (bakedContextValue('production') !== 'production') process.exit(2);
    if (bakedContextValue('deploy-preview') !== 'non-production') process.exit(3);
    if (!productionBakeFailed('production', 'non-production')) process.exit(4);
    if (productionBakeFailed('production', 'production')) process.exit(5);
    if (productionBakeFailed('deploy-preview', 'non-production')) process.exit(6);
    const dir = mkdtempSync(join(tmpdir(), 'ssg-bake-'));
    const file = join(dir, 'build-context.generated.ts');
    if (main({ CONTEXT: 'production' }, file) !== 0) process.exit(7);
    if (!readFileSync(file, 'utf8').includes('"production"')) process.exit(8);
    if (main({}, file) !== 0) process.exit(9);
    if (!readFileSync(file, 'utf8').includes('"non-production"')) process.exit(10);
    rmSync(dir, { recursive: true, force: true });
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('production bake that resolves to mock returns lead_mode_mismatch', async () => {
  const logs: string[] = [];
  const originalError = console.error;
  const originalFetch = globalThis.fetch;
  let calls = 0;
  console.error = (chunk?: unknown) => { logs.push(String(chunk)); };
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error('unexpected outbound');
  };
  try {
    const response = await handleLeadAdmission(new NextRequest('https://ssg-site.netlify.app/api/lead', {
      method: 'POST',
      headers: { host: 'ssg-site.netlify.app', 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'qa@example.com',
        first_name: 'QA',
        company: 'QA Synthetic Co',
        message: 'Please review this preview isolation submission.',
        consent: 'true',
        form_variant: 'contact',
        project_type: 'A new website',
        client_submission_id: '11111111-1111-4111-8111-111111111111',
      }),
    }), 'production');
    const body = await response.json() as { ok?: boolean };
    assert.equal(response.status, 503);
    assert.equal(body.ok, false);
    assert.equal(calls, 0);
    assert.ok(logs.some((line) => line.includes('lead_mode_mismatch')));
  } finally {
    console.error = originalError;
    globalThis.fetch = originalFetch;
  }
});

test('admin review rejects a bad body with 400 and a bad token with 401', async () => {
  const previous = process.env.SSGAI_REVIEW_TOKEN;
  process.env.SSGAI_REVIEW_TOKEN = 'review-token';
  try {
    const denied = await postReview(new Request('https://www.shipleysolutionsgroup.com/api/admin/reviews', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong-token', 'content-type': 'application/json' },
      body: '{}',
    }));
    assert.equal(denied.status, 401);

    const invalid = await postReview(new Request('https://www.shipleysolutionsgroup.com/api/admin/reviews', {
      method: 'POST',
      headers: { authorization: 'Bearer review-token', 'content-type': 'application/json' },
      body: '{"decision":"approved"}',
    }));
    assert.equal(invalid.status, 400);
    const body = await invalid.json() as { error?: string };
    assert.equal(body.error, 'Invalid request body');
  } finally {
    if (previous === undefined) delete process.env.SSGAI_REVIEW_TOKEN;
    else process.env.SSGAI_REVIEW_TOKEN = previous;
  }
});
