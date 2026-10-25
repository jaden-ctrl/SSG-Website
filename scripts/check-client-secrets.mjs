import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), '.next', 'static');
const needles = [
  'HUBSPOT_ACCESS_TOKEN',
  'HUBSPOT_TEST_ACCESS_TOKEN',
  'OPENAI_API_KEY',
  'RESEND_API_KEY',
  'RESEND_TEST_API_KEY',
  'SSGAI_REVIEW_TOKEN',
  'SSG_AI_REVIEW_TOKEN',
  'LEAD_WEBHOOK_SECRET',
  'LEAD_STORE_KEY',
  'LEAD_HASH_SALT',
  'NETLIFY_AUTH_TOKEN',
  'SSGAI_LEAD_WEBHOOK_SECRET',
  'SMTP_PASS',
];

function files(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...files(path));
    else out.push(path);
  }
  return out;
}

let failed = false;
try {
  statSync(root);
} catch {
  console.error('Client bundle secret check: .next/static is missing. Run the production build first.');
  process.exit(1);
}

for (const file of files(root)) {
  const text = readFileSync(file);
  const source = text.toString('utf8');
  for (const needle of needles) {
    if (source.includes(needle)) {
      console.error(`Secret env name ${needle} is present in client bundle ${file}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log('Client bundle secret check passed.');
