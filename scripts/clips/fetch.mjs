// Fetches the clips listed in scripts/clips/wanted.json from their Myinstants
// pages: `npm run clips:fetch`. Each page names its sound in an og:audio tag
// (or its play button), and the file is saved where the entry says. Files
// already there are left alone, so it's safe to run again. Listen to what it
// fetched before committing: a soundboard button is only as good as whoever
// cut it.

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const wanted = JSON.parse(await readFile(join(root, 'scripts/clips/wanted.json'), 'utf8'));
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' };

const exists = (p) =>
  stat(p).then(
    () => true,
    () => false,
  );

// the page's own sound: og:audio first, else the first play button
export function soundOnPage(html, page) {
  const og = html.match(/<meta[^>]+property=["']og:audio["'][^>]+content=["']([^"']+\.mp3)["']/i) ?? html.match(/<meta[^>]+content=["']([^"']+\.mp3)["'][^>]+property=["']og:audio["']/i);
  const button = html.match(/(\/media\/sounds\/[^"'\s)]+\.mp3)/i);
  const found = og?.[1] ?? button?.[1];
  return found ? new URL(found, page).href : null;
}

let failed = 0;
for (const w of wanted) {
  const out = join(root, w.file);
  if (await exists(out)) {
    console.log(`have   ${w.file}`);
    continue;
  }
  try {
    const page = await fetch(w.page, { headers: UA });
    if (!page.ok) throw new Error(`page ${page.status}`);
    const mp3 = soundOnPage(await page.text(), w.page);
    if (!mp3) throw new Error('no sound found on the page');
    const res = await fetch(mp3, { headers: { ...UA, Referer: w.page } });
    if (!res.ok) throw new Error(`sound ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, buf);
    console.log(`got    ${w.file}  (${Math.round(buf.length / 1024)} KB, ${mp3})  ${w.by}: “${w.line}”`);
  } catch (e) {
    failed++;
    console.log(`FAILED ${w.file}: ${e.message}  (${w.page})`);
  }
}
if (failed) process.exitCode = 1;
