// No file the repository tracks may hold a merge's conflict markers: a
// resolution that left them in (the handoff's status table did, once) breaks
// whatever reads the file, and a docs table breaks without a test noticing.
//
//   node scripts/conflict-markers.mjs → prints each file:line, exits 1 if any
//   markedLines(text) → [line numbers] (pure)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// the opening and closing markers, at a line's start, alone or with a branch's name
// (the middle `=======` is left out: Markdown underlines a heading with it)
const MARK = /^(<{7}|>{7})(?: \S.*)?$/;

export const markedLines = (text) => text.split('\n').flatMap((line, i) => (MARK.test(line) ? [i + 1] : []));

export function scan(root = process.cwd()) {
  // (the listing passed Node's 1 MB default with the space levels' packs: room to grow)
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 }).split('\0').filter(Boolean);
  const out = [];
  for (const f of files) {
    if (/\.(png|jpe?g|webp|gif|glb|ktx2|bin|mp3|ogg|wav|woff2?|ttf|pdf|zip|ico)$/i.test(f)) continue;
    let text;
    try {
      text = readFileSync(`${root}/${f}`, 'utf8');
    } catch {
      continue;
    }
    for (const n of markedLines(text)) out.push(`${f}:${n}`);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const found = scan();
  for (const at of found) console.log(at);
  process.exit(found.length ? 1 : 0);
}
