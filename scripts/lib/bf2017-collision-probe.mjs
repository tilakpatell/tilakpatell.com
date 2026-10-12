// The collision probe's sums (scripts/bf2017-collision-probe.mjs): a grid of
// points scanned on the page, each with what the sim says (may a soldier
// stand there, and where its feet are) and what is drawn there (the ground's
// meshes, the level's meshes over the feet), read into the two things a
// player meets: snow the body walks through, and walls nothing draws.
//
//   scan: { n (points a side), step (m), open[k] (0 | 1), feet[k] (m), truth[k] (the height map's
//     own height), ground[k] (the highest drawn ground triangle, or null), top[k] (the highest
//     drawn mesh surface from SINK to HEAD over the feet, or null), topName[k] (an index into
//     names, or −1), under[k] (the highest drawn mesh surface at or under the feet, or null),
//     above[k] (drawn mesh surfaces crossed over the chest), names }, k = row · n + column
//   buriedOf(scan) → { open, ground: { over, under, deepest }, mesh: { points, depth, byMesh }, inside, cells }
//     (ground.over: the drawn ground SINK or more over the feet; ground.under: the feet SINK or
//     more over everything drawn under them)
//   wallsOf(scan) → { blocked, drawn, bank, candidates } (candidates: nothing drawn in the
//     body's column there or beside, on ground a soldier could stand on; the page then
//     looks sideways from each, lookedAt(candidates, looks) → the bare ones)
//   clustersOf(cells, n) → [{ cells, at: [column, row] (the middle), min, max }] biggest first
//   tableOf(rows) → Markdown
//
// Pure: arrays in, numbers out.

export const SINK = 0.3; // m of drawn surface over the feet before a body is "in" it (an ankle's depth is the snow's own)
export const HEAD = 1.9; // m over the feet a surface still buries a body (the capsule's 1.7 and a hand)
export const CHEST = 1.0; // m over the feet the crossings are counted from
export const KNEE = 0.4; // m: the soldier's step; a drawn thing lower than this blocks no one
export const STEEP = 1; // rise over run: a bank past 45° is a wall anyone can see (the game's MaxAscendAngle and SlideAngle)

const DEPTHS = [
  ['0.3–0.55 m', 0.55],
  ['0.55–1 m', 1],
  ['1–1.9 m', Infinity],
];

// Where the body stands in what is drawn: the drawn ground over the feet (or
// the feet over everything drawn), and a drawn mesh's surface between the
// shin and the head. A point under one surface only (odd crossings over the
// chest, none in reach) is `inside`: the inside of a solid, or under a roof
// drawn one-sided, which the scan cannot tell apart, so it is counted alone.
export function buriedOf(scan) {
  const { n, open, feet, ground, top, topName, above, names } = scan;
  const out = { open: 0, ground: { over: 0, under: 0, deepest: 0 }, mesh: { points: 0, depth: Object.fromEntries(DEPTHS.map(([k]) => [k, 0])), byMesh: {} }, inside: 0, cells: [] };
  for (let k = 0; k < n * n; k++) {
    if (!open[k]) continue;
    out.open++;
    const f = feet[k];
    const g = ground[k];
    // (what is drawn under the feet: the ground, or a mesh's surface at or under them)
    const base = Math.max(g ?? -Infinity, scan.under?.[k] ?? -Infinity);
    if (g != null && g - f >= SINK) {
      out.ground.over++;
      if (g - f > out.ground.deepest) out.ground.deepest = g - f;
    } else if (Number.isFinite(base) && f - base >= SINK) out.ground.under++;
    const d = top[k] == null ? null : top[k] - f;
    if (d != null && d >= SINK) {
      out.mesh.points++;
      out.mesh.depth[DEPTHS.find(([, max]) => d < max)[0]]++;
      const name = names[topName[k]] ?? '?';
      out.mesh.byMesh[name] = (out.mesh.byMesh[name] ?? 0) + 1;
      out.cells.push(k);
    } else if (above[k] % 2 === 1) out.inside++;
  }
  return out;
}

// steeper than a soldier walks, by the height map's own heights at the point's four neighbours
export function steepAt(scan, k) {
  const { n, step, truth } = scan;
  const c = k % n;
  const r = (k - c) / n;
  const h = truth[k];
  for (const [dc, dr] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const cc = c + dc;
    const rr = r + dr;
    if (cc < 0 || rr < 0 || cc >= n || rr >= n) continue;
    if (Math.abs(truth[rr * n + cc] - h) > STEEP * step) return true;
  }
  return false;
}

// a drawn mesh in the body's space at k: a surface from the knee up, or the body inside one
const bodyIn = (scan, k) => (scan.top[k] != null && scan.top[k] - scan.feet[k] >= KNEE) || scan.above[k] % 2 === 1;

// The blocked points by what a player would see there: a drawn mesh in the
// body's column at the point or one of its eight neighbours; a bank too
// steep to walk; or nothing (the candidates for an invisible wall).
export function wallsOf(scan) {
  const { n, open } = scan;
  const out = { blocked: 0, drawn: 0, bank: 0, candidates: [] };
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const k = r * n + c;
      if (open[k]) continue;
      out.blocked++;
      let seen = false;
      for (let dr = -1; dr <= 1 && !seen; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
          if (bodyIn(scan, rr * n + cc)) {
            seen = true;
            break;
          }
        }
      if (seen) out.drawn++;
      else if (steepAt(scan, k)) out.bank++;
      else out.candidates.push(k);
    }
  return out;
}

// the candidates the sideways look found nothing near (looks[i]: what it met, or null)
export const lookedAt = (candidates, looks) => candidates.filter((k, i) => !looks[i]);

// Cells that touch (eight neighbours), as clusters, biggest first.
export function clustersOf(cells, n) {
  const set = new Set(cells);
  const seen = new Set();
  const out = [];
  for (const k of cells) {
    if (seen.has(k)) continue;
    const stack = [k];
    seen.add(k);
    const mine = [];
    while (stack.length) {
      const q = stack.pop();
      mine.push(q);
      const c = q % n;
      const r = (q - c) / n;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
          const j = rr * n + cc;
          if (set.has(j) && !seen.has(j)) {
            seen.add(j);
            stack.push(j);
          }
        }
    }
    const cs = mine.map((q) => q % n);
    const rs = mine.map((q) => Math.floor(q / n));
    const mid = (v) => v.reduce((a, b) => a + b, 0) / v.length;
    out.push({ cells: mine.length, at: [mid(cs), mid(rs)], min: [Math.min(...cs), Math.min(...rs)], max: [Math.max(...cs), Math.max(...rs)], members: mine });
  }
  return out.sort((a, b) => b.cells - a.cells);
}

// a Markdown table: rows of cells, the first the head
export function tableOf(rows) {
  const [head, ...body] = rows;
  return [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...body.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}
