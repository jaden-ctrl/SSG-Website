import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const forbiddenHosts = ['api.hubapi.com', 'api.openai.com', 'api.resend.com'];
const hostAllow = new Set([
  'lib/gateway.ts',
  'tests/gateway-source.test.ts',
]);
const fetchAllow = new Set(['lib/gateway.ts']);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.git' || entry === 'data') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|mjs|js|cjs)$/.test(entry)) out.push(full);
  }
  return out;
}

test('outbound hosts and server fetch calls stay inside the gateway', () => {
  const violations: string[] = [];
  for (const file of walk(root)) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    const text = readFileSync(file, 'utf8');
    if (!hostAllow.has(rel)) {
      for (const host of forbiddenHosts) {
        if (text.includes(host)) violations.push(`${rel} references ${host}`);
      }
    }
    const serverFile = rel.startsWith('lib/') || rel.startsWith('app/api/') || rel.startsWith('netlify/');
    if (serverFile && !fetchAllow.has(rel) && /\bfetch\s*\(/.test(text)) violations.push(`${rel} calls fetch directly`);
    if (rel !== 'lib/gateway.ts' && /tls\.connect\s*\(/.test(text)) violations.push(`${rel} opens a TLS connection`);
    if (!hostAllow.has(rel) && rel !== 'tests/gateway-live.test.ts' && text.includes('dispatchOutbound')) {
      violations.push(`${rel} bypasses outboundFetch`);
    }
  }
  assert.deepEqual(violations, []);
});
