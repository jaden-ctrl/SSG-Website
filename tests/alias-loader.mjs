import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const serverOnly = pathToFileURL(path.join(root, 'node_modules/next/dist/compiled/server-only/empty.js')).href;

function resolveFile(file) {
  if (existsSync(file) && statSync(file).isFile()) return file;
  for (const suffix of ['.ts', '.tsx', '.mts', '.mjs', '.js', '.json']) {
    if (existsSync(file + suffix) && statSync(file + suffix).isFile()) return file + suffix;
  }
  for (const suffix of ['/index.ts', '/index.tsx', '/index.js', '/index.mjs']) {
    if (existsSync(file + suffix)) return file + suffix;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') return nextResolve(serverOnly, context);
  let absolute = null;
  if (specifier.startsWith('@/')) absolute = path.join(root, specifier.slice(2));
  else if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const parent = context.parentURL ? path.dirname(fileURLToPath(context.parentURL)) : root;
    absolute = path.resolve(parent, specifier);
  }
  if (absolute) {
    const file = resolveFile(absolute);
    if (file) return nextResolve(pathToFileURL(file).href, context);
  }
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (error && typeof error === 'object' && 'url' in error && typeof error.url === 'string') {
      const file = fileURLToPath(error.url);
      if (existsSync(`${file}.js`)) return nextResolve(pathToFileURL(`${file}.js`).href, context);
    }
    throw error;
  }
}
