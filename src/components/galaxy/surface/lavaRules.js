// Lava, as rules: where it is on a world, how hot it is where you stand,
// how it burns, and where you're put back after it's had you. Pure, so it's
// tested; scene.js runs it (the burn, the heat on the HUD, the sparks) and
// water.js draws it.
//
// A world's lava is its water, where that's lava (Mustafar's rivers: one
// level everywhere), and its pits that say `lava` (Nevarro's flats: a pool
// in each, that many metres under the land round it).
//
//   lavaOf(site) → { level | null, pools: [{ x, z, r, level }] } | null
//   lavaAt(lava, x, z) → the lava's level there, or null
//   heatAt(lava, heightAt, x, y, z) → 0…1: 1 standing in it, less on the
//     bank beside it (within LAVA.near), 0 clear of it
//   burn(b, inIt, dt) → { acc, damage }: whole bites of LAVA.bite, the
//     first at once
//   safeGround(was, p, heat) → [x, z]: where you last stood clear of it

import { levelled, makeRaw } from './terrain';

// burn: health a second in it; bite: a tick's worth; near: metres from it
// the bank's warm
export const LAVA = { burn: 36, bite: 9, near: 3 };
const TICK = LAVA.bite / LAVA.burn;

export function lavaOf(site) {
  const level = site.water?.kind === 'lava' ? site.water.level : null;
  const pits = (site.ground?.pits ?? []).filter((p) => p.lava != null);
  if (level == null && !pits.length) return null;
  const land = pits.length ? levelled(makeRaw(site.ground), site.ground.flats) : null;
  const pools = pits.map((p) => ({ x: p.at[0], z: p.at[1], r: p.r, level: land(p.at[0], p.at[1]) - p.lava }));
  return { level, pools };
}

export function lavaAt(lava, x, z) {
  if (!lava) return null;
  for (const p of lava.pools) if (Math.hypot(x - p.x, z - p.z) < p.r) return p.level;
  return lava.level;
}

// in it: the ground under you below its level, and you no higher than wading
// in it; else how near the nearest point of the ground under it is (two rings
// round you, eight ways)
const WAYS = 8;
export function heatAt(lava, heightAt, x, y, z) {
  if (!lava) return 0;
  const here = lavaAt(lava, x, z);
  if (here != null && heightAt(x, z) < here && y < here + 0.3) return 1;
  for (const k of [0.25, 0.5, 0.75, 1]) {
    const d = LAVA.near * k;
    for (let i = 0; i < WAYS; i++) {
      const a = (i / WAYS) * Math.PI * 2;
      const px = x + Math.cos(a) * d;
      const pz = z + Math.sin(a) * d;
      const l = lavaAt(lava, px, pz);
      if (l != null && heightAt(px, pz) < l) return 0.6 * (1 - k) + 0.15;
    }
  }
  return 0;
}

export function burn(b, inIt, dt) {
  if (!inIt) return { acc: TICK, damage: 0 };
  let acc = (b?.acc ?? TICK) + dt;
  let damage = 0;
  while (acc >= TICK) {
    acc -= TICK;
    damage += LAVA.bite;
  }
  return { acc, damage };
}

export const safeGround = (was, p, heat) => (p.grounded && heat === 0 ? [p.x, p.z] : was);

// The lava field: a picture over the walkable square, two bytes a texel. R:
// how deep the lava is there (0 to `max` metres; 0 where it's dry), which
// the lava draws its crust and its bright seam at the bank by. G: on the dry
// side, how far it is to the lava (0 to `reach` metres; a chamfer distance
// to the nearest texel under it, less half a texel, so to its edge), which
// the ground draws the heat glowing on the bank by.
//   bakeLavaField(heightAt, levelAt, { half, n, max, reach }) → { rg, n, half,
//     max, reach, depthAt(x, z), nearAt(x, z) }
export function bakeLavaField(heightAt, levelAt, { half = 640, n = 256, max = 8, reach = 8 } = {}) {
  const step = (half * 2) / n;
  const depth = new Uint8Array(n * n);
  const far = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    const z = -half + (j + 0.5) * step;
    for (let i = 0; i < n; i++) {
      const x = -half + (i + 0.5) * step;
      const l = levelAt(x, z);
      const d = l == null ? 0 : l - heightAt(x, z);
      depth[j * n + i] = d > 0 ? Math.max(1, Math.round((Math.min(max, d) / max) * 255)) : 0;
      far[j * n + i] = d > 0 ? 0 : Infinity;
    }
  }
  const D = Math.SQRT2;
  const relax = (i, j, di, dj, w) => {
    const a = i + di;
    const b = j + dj;
    if (a < 0 || b < 0 || a >= n || b >= n) return;
    const v = far[b * n + a] + w;
    if (v < far[j * n + i]) far[j * n + i] = v;
  };
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      relax(i, j, -1, 0, 1);
      relax(i, j, 0, -1, 1);
      relax(i, j, -1, -1, D);
      relax(i, j, 1, -1, D);
    }
  for (let j = n - 1; j >= 0; j--)
    for (let i = n - 1; i >= 0; i--) {
      relax(i, j, 1, 0, 1);
      relax(i, j, 0, 1, 1);
      relax(i, j, 1, 1, D);
      relax(i, j, -1, 1, D);
    }
  const rg = new Uint8Array(n * n * 2);
  for (let k = 0; k < n * n; k++) {
    const m = far[k] === 0 ? 0 : Math.max(0, far[k] - 0.5) * step;
    rg[k * 2] = depth[k];
    rg[k * 2 + 1] = Math.round((Math.min(reach, m) / reach) * 255);
  }
  // (read back as the GPU reads it: the four texels about a point, weighted)
  const read = (c, top, x, z, outside) => {
    if (Math.abs(x) > half || Math.abs(z) > half) return outside;
    const u = Math.min(n - 1, Math.max(0, (x + half) / step - 0.5));
    const v = Math.min(n - 1, Math.max(0, (z + half) / step - 0.5));
    const i = Math.floor(u);
    const j = Math.floor(v);
    const i1 = Math.min(n - 1, i + 1);
    const j1 = Math.min(n - 1, j + 1);
    const at = (a, b) => rg[(b * n + a) * 2 + c];
    const fu = u - i;
    const fv = v - j;
    const top0 = at(i, j) * (1 - fu) + at(i1, j) * fu;
    const bot = at(i, j1) * (1 - fu) + at(i1, j1) * fu;
    return ((top0 * (1 - fv) + bot * fv) / 255) * top;
  };
  return { rg, n, half, max, reach, depthAt: (x, z) => read(0, max, x, z, 0), nearAt: (x, z) => read(1, reach, x, z, reach) };
}
