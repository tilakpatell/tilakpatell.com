// The perf probe’s arithmetic (scripts/perf-probe.mjs), pure and tested
// beside, so the numbers a port is judged by (the performance lanes’ P0:
// docs/superpowers/HANDOFF-performance-lanes.md) are worked out the same
// way on every machine.
//
// frameStdev(deltas, { drop = DROP_MS }) → ms | null (fewer than two frames)
//   the pacing column (the GPU-first design’s G1): how even the frames came,
//   since pacing is what the eye reads and a p95 hides an alternating 12 and
//   22 ms
// median(xs) → number | null, worstShare(ms, share = 0.01) → ms | null
// summarise({ frames, marks, loaf }) → a row a phase
// playOf(marks) → [t0, t1] | null, late(frames, marks, afterMs) → count | null
// mdRow(name, run) → a row of docs/superpowers/evidence/perf/README.md’s table
//
// A number nobody measured is null and printed as a dash, never 0: a world
// off the runtime has no GPU clock, and “0 ms on the chip” would read as
// free (the research note’s method, S13: “not assessed” never passes).

// a gap longer than this is a pause (a tab in the background, the scene
// resting), not a frame: lib/three/pace.js drops it the same way
export const DROP_MS = 250; // _source: src/lib/three/pace.js (`dt > 250`: nothing to judge)

// The fields of a frame record as the page’s recorder writes them, one
// array a frame (an object a frame was a heap of garbage over a long run):
// shaders linked, picture uploads and their MB, buffer MB, draws and
// triangles, ms in the costly GL calls and in draws, the slow calls named,
// the frame guard’s mid-frame compiles so far, canvases resized, the ms spent
// in requestAnimationFrame callbacks (the main thread’s share of the frame),
// the chip’s ms by the G1 clock (null off it), pipelines made, live programs
export const F = { t: 0, links: 1, tex: 2, texMB: 3, bufMB: 4, draws: 5, tris: 6, glMs: 7, drawMs: 8, slow: 9, mid: 10, sizes: 11, main: 12, gpu: 13, pipes: 14, progs: 15 };

export function frameStdev(deltas, { drop = DROP_MS } = {}) {
  const kept = deltas.filter((d) => Number.isFinite(d) && d > 0 && d <= drop);
  if (kept.length < 2) return null;
  const mean = kept.reduce((s, d) => s + d, 0) / kept.length;
  return Math.sqrt(kept.reduce((s, d) => s + (d - mean) ** 2, 0) / kept.length);
}

export function median(xs) {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// the mean of the slowest share of the frames, at least one frame: the
// “1 % low” a game’s benchmark reports, as frame time
export function worstShare(ms, share = 0.01) {
  if (!ms.length) return null;
  const n = Math.max(1, Math.ceil(ms.length * share));
  const worst = ms
    .slice()
    .sort((a, b) => b - a)
    .slice(0, n);
  return worst.reduce((s, m) => s + m, 0) / n;
}

const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0);
const r1 = (n) => (n == null ? null : Math.round(n * 10) / 10);

// A row a phase, from one mark to the next (marks: [name, ms on the page’s
// clock]); the frames’ times are the gaps between their starts. loaf: the
// browser’s long animation frames ({ t, ms, block, scripts }).
export function summarise({ frames, marks, loaf = [] }) {
  const rows = [];
  for (let i = 0; i < marks.length - 1; i++) {
    const [name, t0] = marks[i];
    const t1 = marks[i + 1][1];
    const fs = frames.filter((f) => f[F.t] > t0 && f[F.t] <= t1);
    const before = frames.filter((f) => f[F.t] <= t0).at(-1);
    const gaps = [];
    for (let k = 1; k < fs.length; k++) gaps.push({ ms: fs[k][F.t] - fs[k - 1][F.t], f: fs[k] });
    const ms = gaps.map((g) => g.ms).sort((a, b) => a - b);
    const sum = (j) => fs.reduce((s, f) => s + (f[j] || 0), 0);
    const worst = gaps
      .slice()
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 5)
      .map((g) => {
        const lf = loaf.find((l) => g.f[F.t] >= l.t && g.f[F.t] <= l.t + l.ms + 20);
        return { ms: Math.round(g.ms), links: g.f[F.links], tex: g.f[F.tex], texMB: r1(g.f[F.texMB]), bufMB: r1(g.f[F.bufMB]), glMs: Math.round(g.f[F.glMs]), drawMs: Math.round(g.f[F.drawMs]), slow: g.f[F.slow], scripts: lf?.scripts?.slice(0, 3) ?? [] };
      });
    const long = loaf.filter((l) => l.t > t0 && l.t <= t1);
    const progs = fs.filter((f) => f[F.progs] != null).at(-1)?.[F.progs] ?? null;
    rows.push({
      phase: name,
      secs: r1((t1 - t0) / 1000),
      frames: fs.length,
      fps: r1(gaps.length / Math.max(0.001, gaps.reduce((s, g) => s + g.ms, 0) / 1000)),
      p50: r1(pct(ms, 0.5)),
      p95: r1(pct(ms, 0.95)),
      // (the frame-to-frame spread, pauses over 250 ms dropped)
      stdev: r1(frameStdev(gaps.map((g) => g.ms)) ?? 0),
      p99: r1(pct(ms, 0.99)),
      w1: r1(worstShare(ms)),
      max: Math.round(ms[ms.length - 1] ?? 0),
      over50: ms.filter((m) => m > 50).length,
      over100: ms.filter((m) => m > 100).length,
      main: r1(median(fs.map((f) => f[F.main]))),
      gpu: r1(median(fs.map((f) => f[F.gpu]))),
      loafs: long.length,
      block: long.reduce((s, l) => s + (l.block || 0), 0),
      links: sum(F.links),
      pipes: sum(F.pipes),
      progs,
      mid: fs.length ? fs[fs.length - 1][F.mid] - (before?.[F.mid] ?? 0) : 0,
      texMB: r1(sum(F.texMB)),
      bufMB: r1(sum(F.bufMB)),
      draws: Math.round(sum(F.draws) / Math.max(1, fs.length)),
      ktris: Math.round(sum(F.tris) / Math.max(1, fs.length) / 1000),
      sizes: sum(F.sizes),
      worst,
    });
  }
  return rows;
}

// The play: from the mark after the settle (the world up and its arrival’s
// hitches let pass) to the last mark; from the first where a journey has
// no settle (a flown trip, whose every phase is play)
export function playOf(marks) {
  if (marks.length < 2) return null;
  const s = marks.findIndex(([n]) => n === 'settle');
  const from = s >= 0 && s + 1 < marks.length ? marks[s + 1][1] : marks[0][1];
  return [from, marks[marks.length - 1][1]];
}

// Shaders linked and pipelines made more than `afterMs` after the world
// settled: each is a hitch in play (the every-world hand-off’s item 1; zero
// is the goal); null when it never settled
export function late(frames, marks, afterMs = 1000) {
  const settle = marks.find(([n]) => n === 'settle');
  if (!settle) return null;
  const from = settle[1] + afterMs;
  return frames.filter((f) => f[F.t] > from).reduce((s, f) => s + (f[F.links] || 0) + (f[F.pipes] || 0), 0);
}

// | route | machine | drawn on | quality | ready s | fps | p50 | worst 1 % | main | gpu | draws | programs | late |
export function mdRow(name, run) {
  const dash = (v) => (v == null || v === '' ? '-' : String(v));
  const head = [run.route ?? name, run.machine, run.drawnOn, run.quality, run.readyS].map(dash);
  if (!run.play) return `| ${head.join(' | ')} | stopped: ${run.failed ?? 'no frames'} |${' |'.repeat(7)}`;
  const p = run.play;
  return `| ${[...head, p.fps, p.p50, p.w1, p.main, p.gpu, p.draws, p.progs, run.late].map(dash).join(' | ')} |`;
}
