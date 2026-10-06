import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const retiredBranding = /atlas|brain|hologram|particle-field|energy-reform/i;
const textExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.html', '.svg', '.json']);
const violations = [];

function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const name = relative(root, path).split('\\').join('/');
    // Internal audit orchestration is separate from the public design contract.
    if (name === 'app/api') continue;
    if (retiredBranding.test(name)) violations.push(name);
    if (entry.isDirectory()) {
      inspect(path);
    } else if (textExtensions.has(extname(entry.name)) && retiredBranding.test(readFileSync(path, 'utf8'))) {
      violations.push(name);
    }
  }
}

for (const directory of ['app', 'components', 'public']) inspect(join(root, directory));
if (violations.length) {
  console.error('Retired Atlas/brain presentation found in public site source:');
  for (const name of new Set(violations)) console.error(`- ${name}`);
  process.exitCode = 1;
} else {
  console.log('Public site check passed: no retired Atlas/brain presentation.');
}
