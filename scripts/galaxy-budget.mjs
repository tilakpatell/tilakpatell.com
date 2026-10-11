// What scripts/galaxy-check.mjs holds a world to at a quality level (pure,
// tested): its baseline's draw calls and triangles +10%, never over the
// level's row of the budget table (src/lib/budgets.js), the row's model
// megabytes, and at ultra no triangle ceiling but, on a real graphics chip,
// a frame p95 of 16.7 ms.
//
// KNOWN_OVER: worlds whose baseline is already over their row's triangles,
// as main stands. Each is held to its own baseline +10% (it may not grow)
// instead of the row, until its content is trimmed and it comes off the list.

export const KNOWN_OVER = {
  endor: 'TODO: 4.32M triangles at high on 2026-10-08 (3.35M when first listed), over the 3M row; the far redwoods are 0.1M of it: the near full redwoods (1.1M with their shadow pass), the crew figures (0.73M), the ground (0.58M) and the built ferns (0.52M) are where it goes (docs/superpowers/HANDOFF-galaxy-asset-upgrade.md, Phase 4); trim those and take it off this list',
};

// What a world's models are counted as: every .glb, .ktx2 and .bin it
// fetches (lane D2: a level pack's maps and cells weigh as its meshes do),
// and whether the public bucket served any of them.
export const MODEL_FILE = /\.(glb|ktx2|bin)(\?|$)/;
export const BUCKET_URL = /\/storage\/v1\/object\/public\//;

// The models row when the bucket serves the world, as a visitor gets it
// (VITE_ASSET_BASE set): the row's megabytes were written for a dev server
// with no base, where the native figures' full cuts and the published packs
// are never fetched. Measured, not guessed: main's Hoth (00843045b, #890),
// the heaviest world, through a dev server pointed at the bucket, software
// GL, every .glb, .ktx2 and .bin counted, 2026-10-11: low 39.1, mid 60.7,
// high 142.4, ultra 258.6 MB; each row that +10% (the calls' and
// triangles' rule), rounded up to 5 MB.
export const BUCKET_MB = { low: 45, mid: 70, high: 160, ultra: 285 };
export const BUCKET_SOURCE = {
  _source: "lane D2: BUDGET=1 QUALITY=<tier> galaxy-check surface hoth on origin/main 00843045b with VITE_ASSET_BASE at the public bucket, 2026-10-11 (docs/superpowers/evidence/bf2017-picture/d2/README.md)",
  measured: { low: 39.1, mid: 60.7, high: 142.4, ultra: 258.6 },
};

export function limitsFor({ id, quality, row, base, scale = 1, realGpu = false, bucket = false }) {
  const known = base ? (KNOWN_OVER[id] ?? null) : null;
  const calls = Math.min(row.calls, (base?.calls ?? row.calls) * 1.1) * scale;
  const ownTris = (base?.triangles ?? row.tris) * 1.1;
  const tris = row.tris === Infinity ? Infinity : (known ? ownTris : Math.min(row.tris, ownTris)) * scale;
  const frame = quality === 'ultra' && realGpu ? 16.7 * scale : Infinity;
  // (a quarter of the baseline's calls: fewer is a world held back while
  // measured, the frame guard or a cover, not one made lighter)
  const mb = (bucket && BUCKET_MB[quality]) || row.modelsMB;
  return { calls, tris, mb: mb * scale, bucket: Boolean(bucket && BUCKET_MB[quality]), frame, known, baseCalls: base?.calls ?? null, floor: base ? base.calls * 0.25 : 0 };
}

// What a run went over, as short phrases; none means it passes. A run that
// drew nothing, or far less than its baseline, while it was measured (the
// world still held back behind its cover or the frame guard) has no numbers
// to hold to a budget, so it fails too.
export const overBy = (r, l) =>
  [
    r.calls === 0 && 'drew nothing (no draw calls in the measured frames)',
    r.calls > 0 && r.calls < l.floor && `drew far less than its baseline (${r.calls} of ${l.baseCalls} draw calls): held back while measured`,
    r.calls > l.calls && `calls ${r.calls} > ${Math.round(l.calls)}`,
    r.triangles > l.tris && `tris ${r.triangles} > ${Math.round(l.tris)}`,
    r.glbMB > l.mb && `models ${r.glbMB} MB > ${l.mb}`,
    r.p95 > l.frame && `frame p95 ${r.p95} ms > ${l.frame.toFixed(1)}`,
  ].filter(Boolean);
