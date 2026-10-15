// Files under src/ that nothing imports (static scan of import/export-from/dynamic import strings).
import fs from 'node:fs'; import path from 'node:path';
const root = process.cwd();
const files = [];
(function walk(d){ for (const e of fs.readdirSync(d,{withFileTypes:true})) { const p=path.join(d,e.name); if(e.isDirectory()) walk(p); else if(/\.(js|jsx|mjs|ts|tsx|css|json)$/.test(e.name)) files.push(p);} })(path.join(root,'src'));
const srcFiles = new Set(files.map(f=>path.relative(root,f)));
const imported = new Set();
const re = /(?:from\s*|import\s*\(\s*|import\s+|require\s*\(\s*)['"]([^'"]+)['"]/g;
const exts = ['', '.js', '.jsx', '.mjs', '.ts', '.tsx', '.json', '.css', '/index.js', '/index.jsx'];
function resolve(fromFile, spec){ if(!spec.startsWith('.') && !spec.startsWith('/src')) return null; let base = spec.startsWith('/src') ? path.join(root, spec) : path.resolve(path.dirname(fromFile), spec); base = base.split('?')[0]; for (const e of exts){ const c = base+e; if (fs.existsSync(c) && fs.statSync(c).isFile()) return path.relative(root,c);} return null; }
const allScan = [...files, ...(function(){ const o=[]; for (const d of ['scripts','.github','docs','index.html','vite.config.js','vitest.ai.config.js','vitest.render.config.js','tailwind.config.js']) { const p=path.join(root,d); if(!fs.existsSync(p)) continue; if (fs.statSync(p).isFile()) { o.push(p); continue; } (function w(dd){ for (const e of fs.readdirSync(dd,{withFileTypes:true})){ const pp=path.join(dd,e.name); if(e.isDirectory()) w(pp); else if(/\.(js|jsx|mjs|md|yml|html)$/.test(e.name)) o.push(pp);} })(p);} return o; })()];
for (const f of allScan) { let t; try { t = fs.readFileSync(f,'utf8'); } catch { continue; } let m; while((m=re.exec(t))) { const r = resolve(f, m[1]); if (r) imported.add(r); } }
// also css url() and index.html script src
const html = fs.readFileSync(path.join(root,'index.html'),'utf8'); for (const m of html.matchAll(/src=["']\/?(src\/[^"']+)["']/g)) imported.add(m[1]);
const unused = [...srcFiles].filter(f => !imported.has(f) && !/\.test\.(js|jsx|mjs)$/.test(f) && !/\/fixtures\//.test(f) && !/__fixtures__/.test(f) && !/\.d\.ts$/.test(f));
let lines = 0; const rows = unused.map(f => { const n = fs.readFileSync(path.join(root,f),'utf8').split('\n').length; lines += n; return [n,f]; }).sort((a,b)=>b[0]-a[0]);
console.log(`unimported non-test files under src: ${unused.length}, ${lines} lines`);
for (const [n,f] of rows) console.log(String(n).padStart(6), f);
