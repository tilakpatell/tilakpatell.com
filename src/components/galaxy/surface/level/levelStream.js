// Which of a level pack's files are fetched, in what order, and when a cell
// goes (lane L, "How a level draws"; lane N4, "the stream that feels like
// one"). In phases, every file through one queue (levelQueue.js):
//
//   horizon  the coarse grid (the pack's `coarse`, scripts/bf2017-horizon.mjs):
//            its index, then its 512 m cells nearest first, the tier's cut
//            and reach (lib/level/priority.js's coarseReach), so the horizon
//            is whole in the first seconds; a pack without one skips it
//   boot     the far list (the whole arena's table), your cell and its eight
//            neighbours' collision, and every file the loader asks for a
//            mesh standing in those nine cells (its maps at their first
//            row): `ready()` is true once it is all in, or once the boot has
//            pulled the tier's `bootMB`
//   detail   everything else by projected size along the heading
//            (priorityOf); the cells to the mid band as they are needed;
//            two cells beyond, ahead on the heading, prefetched (a turn
//            drops what was waiting, never what was in flight); the horizon
//            list last. Past the tier's `visitMB` the finer rows and LODs
//            wait (`status().paused`) and the cells keep coming; a higher
//            quality level's budget lets them go.
//
// A cell outside the bands is handed back (onDrop) and its bytes kept, so
// walking back is free. A cell that cannot be had is asked again after 10 s,
// then 20, 40 … (a missing file is not asked for every frame), and holds
// back nothing else. Every fetch is aborted at dispose; nothing arriving
// after that is handed on.
//
//   createLevelStream({ pack, fetch, wanted, tier, onFar, onHorizon, onCell, onDrop, onCoarse, onHorizonCell,
//     budgets, busy, signal, parallel, now })
//     → { update(position, tier), fetch(path, { glb, promote }), shows(glb), ready(), progress(), status(), dispose() }
//   (fetch: the loader's way in, its GLBs and maps ranked by the mesh they
//   are for; status() → { phase, bytes, bootDone, paused }; busy() → the
//   loader's loads not yet bound, which the boot waits for; budgets(tier) →
//   { bootMB, visitMB }, the budget row's by default)
//
// fetch(path, { signal }) → Promise<ArrayBuffer> (index.js: the asset base's)

import { budget } from '../../../../lib/budgets.js';
import { readInstances } from '../../../../lib/level/instances.js';
import { bootCells, coarseReach, headingOf, prefetchAhead, priorityOf } from '../../../../lib/level/priority.js';
import { bandOf } from './levelPack.js';
import { createFetchQueue } from './levelQueue.js';

const RETRY_MS = 10000;
// metres walked before the heading is read again (a step's jitter is not a turn)
const STRIDE = 8;
const LO = new Set(['low', 'mid']);
// The boot ends at this share of its bytes, so what is in flight then lands
// under them. _source: Hoth on high at 20 Mbit/s ended its boot 0.02 MB past
// 12 MB with the files in flight (docs/superpowers/evidence/gpu-first/n4/README.md)
const BOOT_SHARE = 0.95;
const rowBudgets = (t) => {
  const r = budget(t);
  return { bootMB: r.bootMB ?? Infinity, visitMB: r.visitMB ?? Infinity };
};

export function createLevelStream({
  pack,
  fetch,
  wanted,
  tier: tier0 = 'high',
  onFar,
  onHorizon = () => {},
  onCell,
  onDrop = () => {},
  onCoarse = () => {},
  onHorizonCell = () => {},
  budgets = rowBudgets,
  busy = () => 0,
  signal = null,
  parallel = 4,
  now = () => performance.now(),
}) {
  const queue = createFetchQueue({ fetch, parallel, signal });
  let tier = tier0;
  let started = false;
  let coarseDone = !pack.coarse?.index;
  let farDone = false;
  let horizonAsked = false;
  let bootDone = false;
  let paused = false;
  let gone = false;
  const bins = new Map(); // key → ArrayBuffer (kept while the page is up: a few KB a cell)
  const inFlight = new Set();
  const failed = new Map(); // key → { tries, until }
  const shown = new Map(); // key → band handed on
  let want = { near: [], mid: [] };
  let at = null;
  let headAt = null; // where the heading was last read from
  let heading = null;
  let boot = new Set(); // the boot slice's cells
  let ahead = [];

  const alive = () => !gone;
  const cellOfKey = (key) => pack.cells[key];

  // the meshes standing in each fine cell (the far list's draws say where
  // each instance is), and each GLB's mesh
  const meshesIn = new Map();
  for (const d of pack.far?.draws ?? []) for (const key of Object.keys(d.cells ?? {})) (meshesIn.get(key) ?? meshesIn.set(key, new Set()).get(key)).add(d.mesh);
  const meshOfGlb = new Map();
  (pack.meshes ?? []).forEach((m, i) => (m.glb ?? []).forEach((g) => g && meshOfGlb.set(g, i)));
  // each mesh's instances as { x, z, r }, once the far list is in (for the ranking)
  let spots = null;
  function readSpots(bin) {
    try {
      const inst = readInstances(bin);
      spots = new Map();
      for (const d of pack.far?.draws ?? []) {
        const r = pack.meshes?.[d.mesh]?.radius ?? 1;
        const list = spots.get(d.mesh) ?? spots.set(d.mesh, []).get(d.mesh);
        for (let i = d.offset; i < d.offset + d.count && i < inst.count; i++) list.push({ x: inst.position[i * 3], z: inst.position[i * 3 + 2], r });
      }
    } catch {
      spots = null; // (a far list too short for its draws: ranked as equals)
    }
  }
  const rankMesh = (mesh) => {
    if (!at) return 0;
    let best = 0;
    for (const s of spots?.get(mesh) ?? []) best = Math.max(best, priorityOf(s, { position: at, heading }));
    return best;
  };
  const inBoot = (mesh) => [...boot].some((key) => meshesIn.get(key)?.has(mesh));

  function check() {
    if (bootDone || !alive()) return;
    const bytes = queue.bytes();
    const over = bytes >= budgets(tier).bootMB * 1e6 * BOOT_SHARE;
    const cellsIn = [...boot].every((k) => bins.has(k) || failed.has(k));
    if (over || (coarseDone && farDone && cellsIn && !queue.pending('boot') && !queue.pending('coarse') && !busy())) bootDone = true;
  }

  function budget_() {
    const over = queue.bytes() >= budgets(tier).visitMB * 1e6;
    if (over !== paused) {
      paused = over;
      queue.hold(paused ? ['detail', 'prefetch'] : []);
    }
  }

  function show() {
    if (!alive() || !farDone) return;
    for (const key of shown.keys()) {
      if (bandOf(want, key)) continue;
      shown.delete(key);
      onDrop(key);
    }
    for (const key of [...want.near, ...want.mid]) {
      const band = bandOf(want, key);
      if (bins.has(key) && shown.get(key) !== band) {
        shown.set(key, band);
        onCell(key, bins.get(key), band);
      }
    }
  }

  // a fine cell's collision: the boot slice's in the boot class, the rest as you walk
  function askCell(key, cls) {
    inFlight.add(key);
    queue
      .get(cellOfKey(key).bin, { cls, rank: () => priorityOf(centreOf(key), { position: at ?? [0, 0], heading }), tag: cls === 'prefetch' ? `ahead:${key}` : null })
      .then((bin) => {
        inFlight.delete(key);
        if (!alive() || !bin) return;
        bins.set(key, bin);
        failed.delete(key);
        show();
        check();
        pump();
      })
      .catch(() => {
        // (a cell that cannot be had: the far list keeps standing in for it)
        inFlight.delete(key);
        const tries = (failed.get(key)?.tries ?? 0) + 1;
        failed.set(key, { tries, until: now() + RETRY_MS * 2 ** (tries - 1) });
        check();
        pump();
      });
  }
  const cellSize = pack.cell ?? 128;
  const centreOf = (key) => {
    const [cx, cz] = key.split(',').map(Number);
    return { x: (cx + 0.5) * cellSize, z: (cz + 0.5) * cellSize, r: cellSize / 2 };
  };

  function pump() {
    if (!alive() || !farDone) return;
    const t = now();
    const ready = (k) => !bins.has(k) && !inFlight.has(k) && !(failed.get(k)?.until > t);
    for (const key of [...want.near, ...want.mid].filter(ready)) askCell(key, boot.has(key) && !bootDone ? 'boot' : 'cell');
    for (const key of ahead.filter(ready)) askCell(key, 'prefetch');
    const settled = [...want.near, ...want.mid].every((k) => bins.has(k) || failed.has(k));
    if (settled && !horizonAsked && pack.horizon?.bin && pack.horizon.draws?.length !== 0) {
      horizonAsked = true;
      queue
        .get(pack.horizon.bin, { cls: 'detail' })
        .then((bin) => bin && alive() && onHorizon(bin))
        .catch(() => {});
    }
  }

  // the coarse grid: its index, then its cells in the tier's reach, nearest first
  function startCoarse() {
    const c = pack.coarse;
    queue
      .get(c.index, { cls: 'coarse' })
      .then(async (buf) => {
        if (!buf || !alive()) return;
        const index = JSON.parse(new TextDecoder().decode(buf));
        onCoarse(index);
        const size = index.cell ?? c.cell ?? 512;
        const reach = coarseReach(tier);
        const [px, pz] = [Math.floor((at?.[0] ?? 0) / size), Math.floor((at?.[1] ?? 0) / size)];
        const cells = Object.entries(index.cells ?? {})
          .map(([key, entry]) => {
            const [cx, cz] = key.split(',').map(Number);
            return { key, entry: (LO.has(tier) ? entry.lo : null) ?? entry.plain ?? entry, ring: Math.max(Math.abs(cx - px), Math.abs(cz - pz)), d: Math.hypot(cx - px, cz - pz) };
          })
          .filter((c) => c.ring <= reach && c.entry?.glb)
          .sort((a, b) => a.d - b.d);
        const landed = Promise.all(
          cells.map(({ key, entry }, i) =>
            queue
              .get(entry.glb, { cls: 'coarse', rank: () => -i })
              .then((bin) => bin && alive() && onHorizonCell(key, bin, entry))
              .catch(() => {}),
          ),
        );
        // (the far list after the grid's cells, which are queued ahead of it)
        startFar();
        await landed;
      })
      .catch(() => {})
      .finally(() => {
        if (!farAsked) startFar();
        // (no grid, or none to be had: the far list, as before)
        coarseDone = true;
        check();
      });
  }

  let farAsked = false;
  function startFar() {
    if (farAsked) return;
    farAsked = true;
    queue
      .get(pack.far.bin, { cls: 'boot' })
      .then((bin) => {
        if (!alive() || !bin) return;
        readSpots(bin);
        onFar(bin);
        farDone = true;
        show();
        pump();
        check();
      })
      .catch(() => {
        // (no far list: the cells alone, as they come)
        farDone = true;
        pump();
        check();
      });
  }

  return {
    update(position, t = tier) {
      if (!alive()) return;
      tier = t;
      at = position;
      want = wanted(pack, at, tier);
      boot = new Set(bootCells(pack, at));
      if (!headAt || Math.hypot(at[0] - headAt[0], at[1] - headAt[1]) >= STRIDE) {
        heading = headingOf(headAt, at) ?? heading;
        headAt = at;
        const next = prefetchAhead(pack, { position: at, heading, tier });
        // (a turn: what waited for the old way ahead is dropped at the queue)
        if (next.join() !== ahead.join()) queue.abandon((item) => item.tag?.startsWith('ahead:') && !next.includes(item.tag.slice(6)));
        ahead = next;
      }
      if (!started) {
        started = true;
        if (pack.coarse?.index) startCoarse();
        else startFar();
        return;
      }
      budget_();
      show();
      pump();
      check();
    },
    // (the loader's GLBs and maps: a boot mesh's in the boot class until the
    // boot is done, a promotion always detail; ranked by the mesh it is for)
    fetch(path, { glb = path, promote = false, coarse = false } = {}) {
      const mesh = meshOfGlb.get(glb);
      const cls = coarse ? 'coarse' : !promote && !bootDone && mesh !== undefined && inBoot(mesh) ? 'boot' : 'detail';
      return queue.get(path, { cls, rank: mesh === undefined ? null : () => rankMesh(mesh) }).then((buf) => {
        if (buf) check();
        return buf;
      });
    },
    // (a GLB's mesh stands in a cell shown: its maps' finer rows may be bound)
    shows(glb) {
      const mesh = meshOfGlb.get(glb);
      if (mesh === undefined) return false;
      for (const key of shown.keys()) if (meshesIn.get(key)?.has(mesh)) return true;
      return false;
    },
    ready: () => bootDone,
    progress() {
      const all = [...want.near, ...want.mid];
      return all.length ? all.filter((k) => shown.has(k)).length / all.length : farDone ? 1 : 0;
    },
    status: () => ({ phase: !coarseDone ? 'horizon' : bootDone ? 'detail' : 'boot', bytes: queue.bytes(), bootDone, paused }),
    dispose() {
      gone = true;
      queue.dispose();
      shown.clear();
    },
  };
}
