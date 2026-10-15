import fs from 'node:fs';
const m = JSON.parse(fs.readFileSync('dist/.vite/manifest.json','utf8'));
const size = (f) => { try { return fs.statSync('dist/'+f).size; } catch { return 0; } };
const rows = Object.entries(m).map(([src, e]) => [size(e.file), src, e.file, e.isEntry?'entry':'', e.isDynamicEntry?'dyn':'']);
rows.sort((a,b)=>b[0]-a[0]);
console.log('manifest entries', rows.length);
for (const r of rows.slice(0,60)) console.log(String(r[0]).padStart(9), r[1], r[3], r[4]);
// duplicate file names (same basename different hash)
const byName = {}; for (const [,e] of Object.entries(m)) { const b = e.file.replace(/-[A-Za-z0-9_-]{8}\.js$/,''); (byName[b] ??= new Set()).add(e.file); }
console.log('\n== basenames with several chunks');
for (const [b, s] of Object.entries(byName)) if (s.size>1) console.log(b, [...s].map(f=>size(f)).join(','));
// per top folder sum
const per = {}; for (const r of rows) { const k = r[1].replace(/^src\/components\/([^/]+).*/, 'components/$1').replace(/^src\/lib\/three.*/, 'lib/three').replace(/^src\/lib\/([^/]+).*/, 'lib/$1').replace(/^src\/runtime.*/, 'runtime').replace(/^node_modules\/([^/]+).*/, 'nm/$1').replace(/^src\/data.*/, 'data').replace(/^src\/pages.*/, 'pages'); per[k] = (per[k]||0) + r[0]; }
console.log('\n== bytes by area (chunk owner)');
for (const [k,v] of Object.entries(per).sort((a,b)=>b[1]-a[1]).slice(0,40)) console.log(String(v).padStart(9), k);
