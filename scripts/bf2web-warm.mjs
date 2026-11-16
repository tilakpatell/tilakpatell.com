// After a deploy, the boot of every build the Worker serves, warmed before anyone is told it is up (tilak-06, 16 Nov: every
// black-page boot on record came shortly after a Worker deploy; a deploy starts every Worker isolate cold, and an isolate's first
// request a browser makes (Accept-Encoding br) reads the build's 5.4 MB manifest and its encodings list from R2 before it answers;
// the edge cache answers only after that). This asks for each build's boot files as a browser does, over fresh connections so the
// asks land on many isolates, round after round, until every file answers fast in `rounds` rounds in a row.
//
//   node scripts/bf2web-warm.mjs [--build <id> ...] [--rounds 3] [--parallel 12] [--fast 1500] [--max 600]
//     builds: the current one and every staged one in src/data/bf2web/play.json, unless named
//     fast: a first byte under this many ms and a 200 (the cold cost is before the first byte: an isolate's manifest read); a large
//     file (the wasm) is dropped after its first byte, so a round costs kilobytes, not its 50 MB per ask; max: seconds before giving up
// Exit 0 when warm; 1 when a build never answered fast within --max (say so before announcing it); 2 on a usage error.
// It only reads (GET): what a visitor's first visit would ask anyway.
import { readFileSync } from 'node:fs';
import { request } from 'node:https';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ORIGIN = 'https://tilakpatell.com';
export const ENGINE = '/battlefront/engine/';
// (what Chrome sends: the encodings decide the Worker's path, br the one through the manifest)
export const BROWSER = { 'accept-encoding': 'gzip, deflate, br, zstd', 'user-agent': 'tilakpatell-warm/1 (post-deploy)', accept: '*/*' };

// the boot of a build: its page, the engine's parser-blocking module and its wasm, the build's file list, and what the page loads first
export function bootPaths(build, pageHtml = '') {
  // (its tags' files, and its inline module's static imports: `from './runtime/world-startup.mjs'`; the dynamic import()s load later)
  const own = [...pageHtml.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"|\bfrom\s*['"](\.\/[^'"]+)['"]/g)].map((m) => (m[1] ?? m[2]).replace(/^\.\//, ''))
    .filter((u) => !/^(?:[a-z]+:)?\/\//i.test(u) && !u.startsWith('/') && !u.startsWith('data:') && !u.startsWith('#'));
  return [...new Set(['', 'original-frame-graph.js', 'original-frame-graph.wasm', 'tp-files.json', ...own])].map((p) => `${ENGINE}${build}/${p}`);
}

// one GET on a connection of its own: {path, status, ttfb, ms, bytes}
export const FIRST_BYTE_ONLY = /\.wasm$/;
export function get(path, { origin = ORIGIN, headers = BROWSER, timeout = 30000, firstByteOnly = FIRST_BYTE_ONLY.test(path) } = {}) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    let ttfb = null, bytes = 0, done = false;
    const end = (status, error) => { if (done) return; done = true; clearTimeout(timer); resolve({ path, status, ttfb, ms: Math.round(performance.now() - t0), bytes, ...(error ? { error } : {}) }); };
    const req = request(origin + path, { headers, agent: false }, (res) => {
      ttfb = Math.round(performance.now() - t0);
      if (firstByteOnly) { res.destroy(); end(res.statusCode); return; }
      res.on('data', (c) => { bytes += c.length; });
      res.on('end', () => end(res.statusCode));
      res.on('error', (e) => end(res.statusCode, e.code ?? e.message));
    });
    const timer = setTimeout(() => { req.destroy(); end(null, 'timeout'); }, timeout);
    req.on('error', (e) => end(null, e.code ?? e.message));
    req.end();
  });
}

// rounds of `parallel` asks spread over the paths until `rounds` rounds in a row are all fast; injectable for the tests
export async function warm({ paths, rounds = 3, parallel = 12, fast = 1500, maxSeconds = 600, ask = get, log = console.log, now = () => Date.now() }) {
  const started = now(), history = [];
  let streak = 0;
  for (let round = 1; ; round++) {
    const batch = Array.from({ length: Math.max(parallel, paths.length) }, (_, i) => paths[i % paths.length]);
    const results = await Promise.all(batch.map((p) => ask(p)));
    const slow = results.filter((r) => r.status !== 200 || r.ttfb === null || r.ttfb > fast);
    const ttfbs = results.map((r) => r.ttfb ?? Infinity).sort((a, b) => a - b);
    const row = { round, asks: results.length, slow: slow.length, ttfbMedian: ttfbs[ttfbs.length >> 1], ttfbMax: ttfbs.at(-1),
      statuses: Object.fromEntries([...new Set(results.map((r) => r.status ?? r.error))].map((s) => [s, results.filter((r) => (r.status ?? r.error) === s).length])),
      slowPaths: [...new Set(slow.map((r) => r.path))].slice(0, 5) };
    history.push(row);
    log(JSON.stringify(row));
    streak = slow.length ? 0 : streak + 1;
    if (streak >= rounds) return { warm: true, rounds: round, seconds: Math.round((now() - started) / 1000), history };
    if ((now() - started) / 1000 > maxSeconds) return { warm: false, rounds: round, seconds: Math.round((now() - started) / 1000), history };
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const all = (k) => args.flatMap((a, i) => (a === k ? [args[i + 1]] : []));
  const num = (k, d) => (args.includes(k) ? Number(args[args.indexOf(k) + 1]) : d);
  const play = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src/data/bf2web/play.json'), 'utf8'));
  const builds = all('--build').length ? all('--build') : [play.build, ...Object.keys(play.stagedBuilds ?? {})].filter(Boolean);
  if (!builds.length || builds.some((b) => !/^[A-Za-z0-9._-]+$/.test(b))) { console.error('usage: bf2web-warm.mjs [--build <id> ...]'); process.exit(2); }
  let ok = true;
  for (const build of builds) {
    const page = await new Promise((resolve) => {
      // (the page asked for uncompressed, to read what it loads first; the warm-up's own asks are a browser's)
      request(`${ORIGIN}${ENGINE}${build}/`, { headers: { ...BROWSER, 'accept-encoding': 'identity' }, agent: false }, (res) => {
        let text = '';
        if (res.headers['content-encoding']) { res.resume(); res.on('end', () => resolve('')); return; }
        res.setEncoding('utf8'); res.on('data', (c) => { text += c; }); res.on('end', () => resolve(text));
      }).on('error', () => resolve('')).end();
    });
    const paths = bootPaths(build, page);
    console.log(`warming ${build}: ${paths.length} boot files`);
    const r = await warm({ paths, rounds: num('--rounds', 3), parallel: num('--parallel', 12), fast: num('--fast', 1500), maxSeconds: num('--max', 600) });
    console.log(`${build}: ${r.warm ? 'WARM' : 'NOT WARM'} after ${r.rounds} rounds, ${r.seconds} s`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      const { appendFileSync } = await import('node:fs');
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `- warm-up ${build}: ${r.warm ? 'warm' : '**NOT WARM**'} after ${r.rounds} rounds (${r.seconds} s); first round median ${r.history[0].ttfbMedian} ms, max ${r.history[0].ttfbMax} ms\n`);
    }
    ok &&= r.warm;
  }
  process.exit(ok ? 0 : 1);
}
