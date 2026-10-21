// A repair changes no pixel (docs/health/RULES.md): the Invincible world's
// shots before and after a split, compared. For each inv-<name>.png in both
// folders, the share of pixels that differ by more than 8/255 in any channel
// and the largest single-channel difference; a mission shot (maulers,
// seismic) moves on its own between two runs of the same tree (the title
// card's camera swing, the fight), so judge those against a same-tree
// re-take.
//   node scripts/inv-world-diff.mjs <before dir> <after dir> [name …]
import sharp from 'sharp';
import { readdirSync } from 'node:fs';
const [a, b, ...only] = process.argv.slice(2);
const names = readdirSync(a).filter((f) => /^inv-.*\.png$/.test(f) && !f.includes('.box.')).filter((f) => !only.length || only.includes(f.replace(/^inv-|\.png$/g, '')));
let worst = 0;
for (const f of names) {
  const [x, y] = await Promise.all([a, b].map((d) => sharp(`${d}/${f}`).raw().toBuffer({ resolveWithObject: true })));
  if (x.info.width !== y.info.width || x.info.height !== y.info.height) { console.log(f, 'size differs'); worst = 1; continue; }
  const n = x.info.width * x.info.height;
  const ch = x.info.channels;
  let diff = 0;
  let max = 0;
  for (let i = 0; i < n; i++) {
    let d = 0;
    for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(x.data[i * ch + c] - y.data[i * ch + c]));
    if (d > 8) diff++;
    if (d > max) max = d;
  }
  const share = diff / n;
  worst = Math.max(worst, share);
  console.log(f.padEnd(24), 'differing', (share * 100).toFixed(3) + '%', 'max', max);
}
console.log('worst', (worst * 100).toFixed(3) + '%');
