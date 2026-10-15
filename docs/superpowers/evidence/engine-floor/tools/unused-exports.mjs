// Exports under src/ and scripts/ that no other file names: a cheap stand-in
// for knip, which ran out of memory on this tree (8 GB, then 12 GB with the
// data ignored). Each `export function|const|let|class X` and each name in
// an `export { a, b }` list is looked for, as a whole word, in every other
// code file (tests, scripts and docs included: a name a test or a doc uses
// is kept, since lane FL1 reads each row before it cuts). Default exports,
// re-exports and names under 3 letters are left out.
//
//   node docs/superpowers/evidence/engine-floor/tools/unused-exports.mjs [--json]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const files = execFileSync('git', ['ls-files', 'src', 'scripts', 'docs', '.claude', 'index.html', 'vite.config.js'], { cwd: root, maxBuffer: 1 << 28 }).toString().split('\n').filter((f) => /\.(js|jsx|mjs|md|html|yml)$/.test(f));
const code = files.filter((f) => /\.(js|jsx|mjs)$/.test(f) && !/\.test\.(js|jsx|mjs)$/.test(f) && !/\/fixtures\//.test(f) && !/__fixtures__/.test(f) && (f.startsWith('src/') || f.startsWith('scripts/')));
const text = new Map(files.map((f) => [f, fs.readFileSync(path.join(root, f), 'utf8')]));
const reDecl = /^export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;
const reList = /^export\s*\{([^}]+)\}\s*;?\s*$/gm;
const rows = [];
for (const f of code) {
  const src = text.get(f);
  const names = new Set();
  for (const m of src.matchAll(reDecl)) names.add(m[1]);
  for (const m of src.matchAll(reList)) for (const part of m[1].split(',')) { const n = part.trim().split(/\s+as\s+/).pop(); if (n && n !== 'default') names.add(n); }
  for (const name of names) {
    if (name.length < 3) continue;
    const re = new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`);
    let used = false;
    for (const [g, t] of text) { if (g === f) continue; if (re.test(t)) { used = true; break; } }
    if (!used) rows.push({ file: f, name });
  }
}
const byFile = {};
for (const r of rows) (byFile[r.file] ??= []).push(r.name);
if (process.argv.includes('--json')) console.log(JSON.stringify(byFile, null, 2));
else {
  console.log(`exports no other file names: ${rows.length} in ${Object.keys(byFile).length} files`);
  for (const [f, names] of Object.entries(byFile).sort((a, b) => b[1].length - a[1].length)) console.log(String(names.length).padStart(4), f, names.join(' '));
}
