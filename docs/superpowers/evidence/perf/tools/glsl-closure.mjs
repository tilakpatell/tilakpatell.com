import { existsSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
const { closure, glslSites } = await import(pathToFileURL(resolve('src/runtime/shadingClosure.js')).href);
const root = resolve('src');
const disk = { read: (p) => readFileSync(p, 'utf8'), exists: (p) => existsSync(p) && statSync(p).isFile() };
const EXEMPT = ['lib/three/frameGuard.js', 'lib/three/renderer.js', 'lib/three/gpuWork.js'];
const why = process.argv.includes('--why');
for (const entry of process.argv.slice(2).filter((a) => !a.startsWith('--'))) {
  const files = new Map();
  const all = closure(resolve(entry), disk);
  for (const p of all) {
    const rel = relative(root, p).split(sep).join('/');
    if (EXEMPT.includes(rel) || rel.startsWith('runtime/')) continue;
    const sites = glslSites(readFileSync(p, 'utf8'));
    if (sites.length) files.set(rel, sites);
  }
  console.log(`\n${entry}: ${all.size} files reached, ${files.size} with GLSL`);
  for (const [f, s] of files) console.log(`  ${f}: ${[...new Set(s)].join(', ')}`);
}
