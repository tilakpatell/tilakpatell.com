// The level's reflection volumes as the scene's environment, and on ultra a
// grid of irradiance probes over the arena.
//
// Volumes. The game bakes a 128² HDR cube per reflection volume (lane G's
// probes, `textures/levels/`). The one the visitor stands in (the smallest
// that holds them) is the environment, crossfaded over FADE seconds when
// they cross into another: `scene.environmentNode` is a mix of two
// pmremTexture nodes over two slot cubes whose faces are copied in place,
// so a crossing changes their data and a uniform and compiles nothing. PMREMNode
// prefilters a plain cube itself on the node renderer, so `loadCube(volume)`
// hands back the HDR cube as loaded, not a PMREM (lane G's probeEnv.js
// prefilters with the classic renderer's PMREMGenerator and keeps one cube
// alive, which a crossfade cannot: two are on screen while it runs). The
// cubes are kept per volume once loaded (a level has a handful; each is
// 128² × 6 at half float) and freed on dispose.
//
// The grid. three's LightProbeGrid (three/addons/lighting/LightProbeGrid.js)
// is a Light: added to the scene, it lights every node material from L2
// spherical harmonics baked on the GPU at each probe. The bake needs the
// node renderer, on either backend. Baked once, after the level's near
// cells are in, never again. It ships behind the design's numbers (A3):
// under BAKE_BUDGET ms to bake and FRAME_BUDGET ms a frame on the owner's
// laptop, so applyGameLight bakes it only when asked (`grid: true`). (A
// first bake on the fixture, with three's RoomEnvironment scene as the
// environment, failed to build its materials and lit everything pink;
// with the TSL sky it bakes clean on WebGL 2 too.)
//
// The budgeted grid (GPU-first lane N3, "Mid: the probe grid, amortised"):
// with `budget`, the grid is two cascades round the player instead of one
// over the arena, at CASCADES' spacings (8 m and 32 m: _source the research
// note's DDGI section and Lumen's radiance-cache spacing), each `res` probes
// a side and re-centred on the player by whole spacings (recentre). Each
// cascade is a pair of grids: the one lit (the front) and the one being
// re-rendered (the back), a few probes a frame through LightProbeGrid's
// ranged bake (r186's `start` and `count`, which publishes the range at
// once), the stalest first and the nearest among equals (scheduleProbes),
// as many as FRAME_BUDGET allows (probesPerFrame, against lane G1's GPU
// clock where there is one). When the back is whole it crossfades in over
// FADE (the two grids' intensities, uniforms: nothing recompiles) and the
// pair swaps, so an update never pops (Review Focus 3). The near cascade
// fades out past its box over one spacing, and the far one leaves a hole of
// the same shape there (CascadeGridNode), so the two add to one.
//
// The clock: lane G1's gpuTime ({ frame(), median, p95, last, available },
// src/lib/three/gpuTime.js). Frames with no probe drawn (the crossfades)
// give the frame's base; a frame that draws probes costs its `last` less
// that base. Without the clock, the CPU's ms to issue the bakes stands in.
//
// probeFor(volumes, pos, { nearest }) → { i, blend }      (pure)
// roomNits(volume) → nits | null   (pure: the luminance of a volume's capture at its horizon, the game's own
//   picture of the room: what the exposure meters where the sky does not reach, apply.js)
// scheduleProbes(stale: [{ age, distance }], n) → indices   (pure: age −1 is done)
// probesPerFrame(lastMs, budgetMs, current, most = Infinity) → n   (pure)
// recentre(pos, spacing) → the cascade's centre   (pure)
// runsOf(indices) → [{ start, count }]; probeIndex(x, y, z, res) → index   (pure)
// createProbes(scene, volumes, loadCube, { fallback, fade, size }) → Promise<{ update(pos, dt, { nearest }), current, fade, state,
//     setFallback(tex), setScales({ probe, fallback }), dispose }>
//   (setScales: a volume's cube, in the game's units, by the light's gameToSite; the fallback, the site's own
//   sky, by the sky the view still has: the environment is the fallback's share plus the volumes')
//   A level drawn by the GPU scene (gpuScene/draws.js) draws its static groups from one render bundle,
//   which keeps the bind groups it was recorded with: a cube swapped into a pmremTexture node after
//   the bundle was recorded never reached the level's materials (the hangars drew with no environment
//   at all, whatever its scale; a bundle recorded again caught the swap only sometimes). So the
//   crossfade runs between two slots, cubes made once whose faces are copied in place: their PMREMs
//   are made again into the same targets, and nothing the materials bind changes. Where it does
//   (a new fallback, a slot resized), the scene's bundles are recorded again, then and the frame after.
// createProbeGrid(scene, renderer, bounds, res = PROBE_GRID, { cubemapSize, far, budget: { ms, gpuTime }, cascades })
//   → Promise<{ grid, bake(), update(camera, dt), stats() → { probesPerFrame, ms, sweeps, cascades }, dispose }>

import { loadThree } from './three.js';

export const FADE = 0.5; // s: the crossfade between two volumes' cubes
export const EDGE = 4; // m: how deep into a volume `blend` reaches 1
export const PROBE_GRID = [8, 3, 8]; // probes along x, y, z over the arena
export const BAKE_BUDGET = 400; // ms: the most the grid's one bake may take (A3)
export const FRAME_BUDGET = 0.5; // ms: the most the grid may add to a frame (A3)
export const CASCADES = [8, 32]; // m: the budgeted grid's two spacings (lane N3)
const FIRST_PROBES = 4; // probes a frame before the clock has said anything
const BASE_FRAMES = 30; // idle frames the base is the median of

const inside = (v, p) => p[0] >= v.min[0] && p[0] <= v.max[0] && p[1] >= v.min[1] && p[1] <= v.max[1] && p[2] >= v.min[2] && p[2] <= v.max[2];
const volumeOf = (v) => (v.max[0] - v.min[0]) * (v.max[1] - v.min[1]) * (v.max[2] - v.min[2]);

// volumes: [{ min: [x, y, z], max: [x, y, z] }]; the smallest holding pos,
// and how far in it is (0 at a face, 1 from EDGE in); -1 when none does
// (`nearest`: where none holds it, the nearest box's, blend 0: under the rock,
// where the sky's environment does not reach, the interior's nearest capture
// stands in for the bounce the game's Enlighten gives a room with no volume of its own; hand)
export function probeFor(volumes, pos, { nearest = false } = {}) {
  let best = -1;
  for (let i = 0; i < (volumes?.length ?? 0); i++) {
    if (inside(volumes[i], pos) && (best < 0 || volumeOf(volumes[i]) < volumeOf(volumes[best]))) best = i;
  }
  if (best < 0 && nearest) {
    let far = Infinity;
    for (let i = 0; i < (volumes?.length ?? 0); i++) {
      const v = volumes[i];
      const d = Math.hypot(...[0, 1, 2].map((a) => Math.max(0, v.min[a] - pos[a], pos[a] - v.max[a])));
      if (d < far) (far = d), (best = i);
    }
    return { i: best, blend: 0 };
  }
  if (best < 0) return { i: -1, blend: 0 };
  const v = volumes[best];
  let d = Infinity;
  for (let a = 0; a < 3; a++) d = Math.min(d, pos[a] - v.min[a], v.max[a] - pos[a]);
  return { i: best, blend: Math.min(1, d / EDGE) };
}

const lumOf = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
export const roomNits = (volume) => (Array.isArray(volume?.horizon) ? lumOf(volume.horizon) : null);

export function scheduleProbes(stale, n) {
  const idx = [];
  for (let i = 0; i < (stale?.length ?? 0); i++) if (stale[i].age >= 0) idx.push(i);
  idx.sort((a, b) => stale[b].age - stale[a].age || stale[a].distance - stale[b].distance);
  return idx.slice(0, Math.max(0, n));
}

export function probesPerFrame(lastMs, budgetMs, current, most = Infinity) {
  if (lastMs === null || lastMs === undefined || !Number.isFinite(lastMs)) return Math.min(most, Math.max(1, current));
  if (lastMs > budgetMs) return Math.max(1, Math.floor(current / 2));
  if (lastMs < budgetMs / 2) return Math.min(most, current + 1);
  return Math.min(most, Math.max(1, current));
}

export const recentre = (pos, spacing) => pos.map((v) => Math.round(v / spacing) * spacing + 0);

export function runsOf(indices) {
  const out = [];
  for (const i of [...indices].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && last.start + last.count === i) last.count++;
    else out.push({ start: i, count: 1 });
  }
  return out;
}

// LightProbeGrid's order: along x, then z, then y (its bake's `start`)
export const probeIndex = (x, y, z, res) => x + z * res[0] + y * res[0] * res[2];

export async function createProbes(scene, volumes, loadCube, { fallback = scene.environment, fade = FADE, size = null, renderer = null } = {}) {
  const { THREE, tsl } = await loadThree();
  const cubes = new Map(); // volume → its cube, once loaded
  let base = fallback;
  // The two slots the crossfade runs between: cubes made once, at the volumes'
  // face size, whose faces are copied in place (`size`: the faces' width; else
  // the first volume's cube, loaded now, says it). Their PMREMs are made into
  // the same targets each time, so the textures the materials bind never change.
  let faceSize = size;
  if (!faceSize && volumes?.length) {
    const first = await Promise.resolve(loadCube(volumes[0], 0)).catch(() => null);
    if (first) cubes.set(0, Promise.resolve(first));
    faceSize = widthOf(first) ?? 64;
  }
  const blank = () => {
    const n = faceSize ?? 1;
    const d = new THREE.DataTexture(new Uint16Array(n * n * 4), n, n, THREE.RGBAFormat, THREE.HalfFloatType);
    d.needsUpdate = true;
    return d;
  };
  const slot = () => {
    const c = new THREE.CubeTexture([0, 1, 2, 3, 4, 5].map(blank));
    Object.assign(c, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, colorSpace: THREE.LinearSRGBColorSpace, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
    c.needsUpdate = true;
    return c;
  };
  const slots = volumes?.length ? [slot(), slot()] : null;
  // (with the renderer: each slot's PMREM made here, into a target of its own the node reads as it is, so
  // the texture the materials bind is that target's from their first build on; made again a moment
  // after each copy, since a PMREM drawn while its pipelines are still being made is left black)
  const gen = slots && renderer?.backend && THREE.PMREMGenerator ? new THREE.PMREMGenerator(renderer) : null;
  const targets = gen ? slots.map((c) => gen.fromCubemap(c)) : null;
  const nodes = slots ? slots.map((c, k) => tsl.pmremTexture(targets ? targets[k].texture : c)) : null;
  const again = []; // [{ k, at }]: the slots' PMREMs to make again
  let clock = 0;
  const remake = (k) => {
    if (!gen) {
      slots[k].needsPMREMUpdate = true;
      return;
    }
    gen.fromCubemap(slots[k], targets[k]);
  };
  const f = base ? tsl.pmremTexture(base) : null;
  const t = tsl.uniform(0); // 0: slot 0 shows, 1: slot 1
  const sp = tsl.uniform(0); // the slots' scale: the light's gameToSite × how much a volume shows
  const sf = tsl.uniform(1); // the fallback's
  const scales = { probe: 1, fallback: 1 };
  let weight = 0; // (how much a volume shows: 0 where none does, eased over FADE)
  const shows = [-1, -1];
  let front = 0; // (the slot the fade rests on)
  let toward = 0;
  let want = -1;
  let showing = -1;
  let disposed = false;
  const before = scene.environmentNode;
  // (the bundles to record again: at a change of the textures bound, and the frame after)
  let rebind = 0;
  const swapped = () => (rebind = 2);
  const parts = [f ? f.mul(sf) : null, nodes ? tsl.mix(nodes[0], nodes[1], t).mul(sp) : null].filter(Boolean);
  // (made once, before the level's bundle settles: the GPU scene records it again as its parts stream in)
  if (parts.length) scene.environmentNode = parts.length > 1 ? parts[0].add(parts[1]) : parts[0];
  const scale = () => {
    sp.value = scales.probe * weight;
    sf.value = scales.fallback;
  };
  scale();

  // a cube's faces into a slot, in place (a cube of another size: the slot's PMREM made anew, so bound again)
  const copyInto = (k, cube) => {
    const c = slots[k];
    if (widthOf(cube) !== widthOf(c)) swapped();
    c.images = cube.images.slice(0, 6);
    c.needsUpdate = true;
    remake(k);
    for (const dt of [0.25, 1, 3]) again.push({ k, at: clock + dt });
  };

  const show = (i, tex) => {
    if (!nodes) return;
    showing = i;
    if (i < 0 || !tex) return;
    // (a crossing mid-fade keeps whichever slot shows more and fades on from it)
    if (t.value !== front) front = t.value >= 0.5 ? 1 : 0;
    if (shows[front] === i) {
      toward = front;
      return;
    }
    const back = 1 - front;
    copyInto(back, tex);
    shows[back] = i;
    toward = back;
    // (the first volume shown comes in by the volumes' share alone: the slots were empty before it)
    if (weight === 0) {
      t.value = back;
      front = back;
    }
  };

  async function pick(i) {
    if (i < 0) return show(-1, null);
    if (!cubes.has(i)) cubes.set(i, Promise.resolve(loadCube(volumes[i], i)));
    const tex = await cubes.get(i);
    if (!disposed && want === i) show(i, tex);
  }

  return {
    update(pos, dt, { nearest = false } = {}) {
      clock += dt;
      for (let n = again.length - 1; n >= 0; n--) {
        if (again[n].at > clock) continue;
        remake(again[n].k);
        again.splice(n, 1);
      }
      const { i } = probeFor(volumes, pos, { nearest });
      if (i !== want) {
        want = i;
        pick(i);
      }
      const step = fade > 0 ? dt / fade : 1;
      // (the crossfade between the slots; the slot it reaches is the front)
      if (t.value !== toward) {
        t.value = toward > t.value ? Math.min(toward, t.value + step) : Math.max(toward, t.value - step);
        if (t.value === toward) front = toward;
      }
      // (the volumes' share: in as one shows, out where none does)
      const goal = showing >= 0 && shows[toward] >= 0 ? 1 : 0;
      if (weight !== goal) {
        weight = goal > weight ? Math.min(goal, weight + step) : Math.max(goal, weight - step);
        scale();
      }
      if (rebind > 0) {
        rebind--;
        scene.traverse?.((o) => {
          if (o.isBundleGroup) o.needsUpdate = true;
        });
      }
      return showing;
    },
    get current() {
      return showing;
    },
    get fade() {
      return t.value;
    },
    // (for a check: the slots, the volume each holds, the volumes' share)
    get state() {
      return { shows: shows.slice(), front, toward, t: t.value, weight, probe: sp.value, fallback: sf.value };
    },
    // a new fallback (the sky's environment after a weather change)
    setFallback(tex) {
      base = tex;
      if (f && tex && f.value !== tex) {
        f.value = tex;
        swapped();
      }
    },
    setScales({ probe = scales.probe, fallback: fb = scales.fallback } = {}) {
      scales.probe = probe;
      scales.fallback = fb;
      scale();
    },
    async dispose() {
      disposed = true;
      scene.environmentNode = before;
      nodes?.forEach((n) => n.dispose());
      f?.dispose();
      for (const c of slots ?? []) c.dispose();
      for (const t of targets ?? []) t.dispose();
      gen?.dispose();
      for (const p of cubes.values()) (await p)?.dispose?.();
      cubes.clear();
    },
  };
}

const widthOf = (cube) => cube?.images?.[0]?.image?.width ?? cube?.images?.[0]?.width ?? null;

// bounds: { min, max } (the pack's arena); res: probes per axis
export async function createProbeGrid(scene, renderer, bounds, res = PROBE_GRID, { cubemapSize = 8, far = 600, budget = null, cascades = null } = {}) {
  if (budget) return createCascadeGrid(scene, renderer, res, { cubemapSize, far, budget, spacings: cascades ?? CASCADES });
  const { LightProbeGrid } = await import('three/addons/lighting/LightProbeGrid.js');
  const size = [0, 1, 2].map((k) => bounds.max[k] - bounds.min[k]);
  const grid = new LightProbeGrid(size[0], size[1], size[2], res[0], res[1], res[2]);
  grid.position.set(...[0, 1, 2].map((k) => (bounds.min[k] + bounds.max[k]) / 2));
  grid.updateMatrixWorld();
  scene.add(grid);
  return {
    grid,
    // one bake; the CPU's ms to issue it (the caller waits on the GPU)
    bake() {
      const t0 = performance.now();
      grid.bake(renderer, scene, { cubemapSize, near: 0.1, far });
      return performance.now() - t0;
    },
    update() {},
    stats: () => ({ probesPerFrame: 0, ms: null, sweeps: 0, cascades: 0 }),
    dispose() {
      grid.removeFromParent();
      grid.dispose();
    },
  };
}

// The grid classes of the budgeted grid, made once: a LightProbeGrid whose
// light node can leave a hole where the near cascade lights (`hole`: the
// near front's box and its falloff), so the near and far add to one
let Cascade = null;
async function cascadeClasses(renderer) {
  if (!Cascade) {
    const [{ LightProbeGrid }, { LightProbeGridNode }, { tsl }] = await Promise.all([import('three/addons/lighting/LightProbeGrid.js'), import('three/addons/tsl/lighting/LightProbeGridNode.js'), loadThree()]);
    const { THREE } = await loadThree();
    const { positionWorld, uniform, vec3 } = tsl;
    class CascadeGridNode extends LightProbeGridNode {
      constructor(light) {
        super(light);
        this._holeMin = uniform(new THREE.Vector3());
        this._holeMax = uniform(new THREE.Vector3());
        this._holeFalloff = uniform(1);
      }

      update(frame) {
        super.update(frame);
        const h = this.light.hole;
        if (!h) return;
        this._holeMin.value.copy(h.min);
        this._holeMax.value.copy(h.max);
        this._holeFalloff.value = h.falloff;
      }

      setup(builder) {
        if (!this.light.hole) return super.setup(builder);
        // (the parent adds its irradiance to the context's; it is caught
        // here and added back weighted by how far outside the near box)
        const outer = builder.context.irradiance;
        const mine = vec3(0).toVar();
        builder.context.irradiance = mine;
        try {
          super.setup(builder);
        } finally {
          builder.context.irradiance = outer;
        }
        const out = this._holeMin.sub(positionWorld).max(0).add(positionWorld.sub(this._holeMax).max(0));
        outer.addAssign(mine.mul(out.length().smoothstep(0, this._holeFalloff)));
      }
    }
    class CascadeGrid extends LightProbeGrid {
      constructor(...a) {
        super(...a);
        this.hole = null;
      }
    }
    Cascade = { CascadeGrid, CascadeGridNode };
  }
  if (renderer?.library?.getLightNodeClass?.(Cascade.CascadeGrid) === null) renderer.library.addLight(Cascade.CascadeGridNode, Cascade.CascadeGrid);
  return Cascade;
}

// The grid's frame budget against the GPU clock (lane G1's gpuTime face),
// or the CPU's ms to issue the bakes without it. after(drew, cpuMs) once a
// frame, after the frame's bakes; n is the probes the next frame may draw.
//   createBudget({ ms, gpuTime, first, most }) → { after(drew, cpuMs), n, ms, base }
export function createBudget({ ms = FRAME_BUDGET, gpuTime = null, first = FIRST_PROBES, most = Infinity } = {}) {
  let n = Math.min(most, first);
  let lastMs = null;
  const base = [];
  return {
    after(drew, cpuMs) {
      if (gpuTime?.available && Number.isFinite(gpuTime.last)) {
        // (a frame with nothing drawn is the base; one that drew costs the rest)
        if (!drew) {
          base.push(gpuTime.last);
          if (base.length > BASE_FRAMES) base.shift();
        } else lastMs = base.length ? Math.max(0, gpuTime.last - median(base)) : null;
      } else if (drew) lastMs = cpuMs;
      if (drew) n = probesPerFrame(lastMs, ms, n, most);
      return n;
    },
    get n() {
      return n;
    },
    get ms() {
      return lastMs;
    },
    get base() {
      return median(base);
    },
  };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};

async function createCascadeGrid(scene, renderer, res, { cubemapSize, far, budget, spacings }) {
  const { CascadeGrid } = await cascadeClasses(renderer);
  const { THREE } = await loadThree();
  const clock = budget.gpuTime ?? null;
  const total = res[0] * res[1] * res[2];
  const plan = createBudget({ ms: budget.ms ?? FRAME_BUDGET, gpuTime: clock, most: total });
  const opts = { cubemapSize, near: 0.1, far };
  const at = new THREE.Vector3();
  const cam = [0, 0, 0];
  let sweeps = 0;

  const made = spacings.map((spacing, ci) => {
    const size = res.map((r) => spacing * (r - 1));
    const pair = [0, 1].map(() => {
      const g = new CascadeGrid(size[0], size[1], size[2], res[0], res[1], res[2]);
      g.intensity = 0;
      // (the near cascade fades out over one spacing past its box)
      g.falloff = ci === 0 && spacings.length > 1 ? spacing : 0;
      return g;
    });
    return { spacing, front: pair[0], back: pair[1], age: new Int32Array(total), fade: null, ready: false };
  });

  // a range of a grid baked (its box moved with it: bake updates it)
  const bake = (grid, start, count) => grid.bake(renderer, scene, { ...opts, start, count });

  // a cascade's back placed round the player, every probe stale again
  const restart = (c) => {
    c.back.position.set(...recentre(cam, c.spacing));
    c.back.updateMatrixWorld();
    c.age.fill(0);
  };

  // the near front's box, as the far cascades' hole
  const holeOf = () => {
    const near = made[0].front;
    near.updateBoundingBox();
    return { min: near.boundingBox.min.clone(), max: near.boundingBox.max.clone(), falloff: made[0].spacing };
  };

  let started = false;
  const start = (camera) => {
    started = true;
    cam[0] = camera.position.x;
    cam[1] = camera.position.y;
    cam[2] = camera.position.z;
    // (each grid gets its textures with one probe before it joins the scene:
    // a light node set up before its grid has a texture adds nothing for good)
    for (const c of made) {
      for (const g of [c.front, c.back]) {
        g.position.set(...recentre(cam, c.spacing));
        g.updateMatrixWorld();
        bake(g, 0, 1);
        scene.add(g);
      }
      c.front.intensity = 1;
      restart(c);
    }
    for (const c of made.slice(1)) c.front.hole = c.back.hole = holeOf();
  };

  return {
    grid: made[0]?.front ?? null,
    // the whole of every cascade at once, front and back (a tier that bakes once: T0)
    bake() {
      const t0 = performance.now();
      for (const c of made) for (const g of [c.front, c.back]) bake(g, 0, total);
      return performance.now() - t0;
    },
    update(camera, dt) {
      if (!camera) return;
      if (!started) return start(camera);
      cam[0] = camera.position.x;
      cam[1] = camera.position.y;
      cam[2] = camera.position.z;
      clock?.frame?.();
      let drew = 0;
      const t0 = performance.now();
      let left = plan.n;
      for (const c of made) {
        if (c.fade !== null) {
          c.fade = Math.min(1, c.fade + dt / FADE);
          c.front.intensity = 1 - c.fade;
          c.back.intensity = c.fade;
          if (c.fade >= 1) {
            [c.front, c.back] = [c.back, c.front];
            c.front.intensity = 1;
            c.back.intensity = 0;
            c.fade = null;
            sweeps++;
            if (c === made[0]) for (const f of made.slice(1)) f.front.hole = f.back.hole = holeOf();
            restart(c);
          }
          continue;
        }
        if (left <= 0) continue;
        const stale = [];
        for (let y = 0; y < res[1]; y++) {
          for (let z = 0; z < res[2]; z++) {
            for (let x = 0; x < res[0]; x++) {
              const i = probeIndex(x, y, z, res);
              c.back.getProbePosition(x, y, z, at);
              stale[i] = { age: c.age[i], distance: Math.hypot(at.x - cam[0], at.y - cam[1], at.z - cam[2]) };
            }
          }
        }
        const pick = scheduleProbes(stale, left);
        for (const r of runsOf(pick)) bake(c.back, r.start, r.count);
        for (let i = 0; i < total; i++) if (c.age[i] >= 0) c.age[i]++;
        for (const i of pick) c.age[i] = -1;
        left -= pick.length;
        drew += pick.length;
        if (pick.length && c.age.every((a) => a < 0)) c.fade = 0;
      }
      plan.after(drew, performance.now() - t0);
    },
    stats: () => ({ probesPerFrame: plan.n, ms: plan.ms, base: plan.base, sweeps, cascades: made.length, spacings }),
    dispose() {
      for (const c of made) {
        for (const g of [c.front, c.back]) {
          g.removeFromParent();
          g.dispose();
        }
      }
    },
  };
}
