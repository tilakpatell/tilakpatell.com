// A level's placed lights: the lamps, the hangar's strips, the console
// glows. lights.json (scripts/bf2017-lights.mjs) holds them per 128 m cell;
// each frame the nearest cells' lights are ranked by how much of the screen
// their reach covers and the best fill a fixed pool of three lights, moved,
// recoloured and dimmed in place. Nothing is added or removed after the
// pool is made, so no material recompiles when the visitor walks.
//
// Read from the r186 source (the design's A1): ClusteredLighting's node
// (three/addons/tsl/lighting/ClusteredLightsNode.js, setLights) clusters
// point lights that cast no shadow and nothing else; a spot goes to the
// ordinary per-light path, one shader branch each. So the points are a pool
// of POINT_POOL under ClusteredLighting, and the spots a pool of SPOT_POOL
// on the base lighting, the nearest by screen area.
//
// The clustering is a compute pass over storage buffers, which the node
// renderer's WebGL 2 backend does not run; on 'nodes-webgl' the points are a
// pool of POINT_FALLBACK on the base lighting instead (the design's A2
// fallback, the Battlefront plan's LIGHT_BUDGET).
//
// lumensToCandela(lm, kind, outer) → cd       (pure)
// cellOf([x, , z], size = 128) → "cx,cz"       (pure)
// cellsNear(pos, size, ring = 1) → keys        (pure)
// lightsFor(json, cells, camera, { max, cull, fade }) → [{ cell, i, weight, area }]   (pure)
// appendLights(placed, particle, max) → the list the point pool takes   (pure)
// createPlacedLights(scene, renderer, { points, spots, clustered, scale, source })
//   → Promise<{ set(list), update(camera, extra), setScale(k), lit, pools, clustered, dispose }>
//
// Particle lights (the GPU-first design's N5: effects.js's `lights()`, a
// spark's or an explosion's glow) join ClusteredLighting's list each frame
// after the placed lights, oldest first, and past the pool the newest are
// dropped, never a placed lamp: the level's light is the record's, and a
// burst's flash is the first thing to go (Review Focus 5). They are points
// only (the cluster takes no spot), in the same pool, so nothing recompiles.

import { backendOf, loadThree } from './three.js';

export const POINT_POOL = 1024; // ClusteredLighting's maxLights
export const SPOT_POOL = 16; // spots are not clustered: the nearest sixteen
export const POINT_FALLBACK = 64; // the base lighting's pool where clustering cannot run (A2)
export const CLUSTER = { tileSize: 32, zSlices: 24, perCluster: 64 }; // three's defaults, as the design gives them
export const CELL = 128; // m: lights.json's cell, the level pack's
export const CULL_AREA = 0.005; // the record's CullScreenArea: under this a light is not drawn
export const FADE_AREA = 0.01; // the record's FadeScreenArea: from CULL_AREA to this it fades in
// Whether the points go under ClusteredLighting where the backend can run
// it. Task 1's fixture checks the environment survives it (A2); false puts
// every backend on the fallback pool.
export const CLUSTERED = true;

// A lamp's lumens to the candela three's lights take: over the whole sphere
// for a point, over the cone's solid angle for a spot (`outer` the cone's
// full angle, radians).
export function lumensToCandela(lm, kind = 'point', outer = Math.PI) {
  if (kind === 'spot') return lm / (2 * Math.PI * (1 - Math.cos(outer / 2)));
  return lm / (4 * Math.PI);
}

export function appendLights(placed, particle, max) {
  const out = placed.length > max ? placed.slice(0, max) : [...placed];
  for (let i = 0; i < particle.length && out.length < max; i++) if (particle[i].kind !== 'spot') out.push(particle[i]);
  return out;
}

export const cellOf = (pos, size = CELL) => `${Math.floor(pos[0] / size)},${Math.floor(pos[2] / size)}`;

export function cellsNear(pos, size = CELL, ring = 1) {
  const cx = Math.floor(pos[0] / size);
  const cz = Math.floor(pos[2] / size);
  const out = [];
  for (let dz = -ring; dz <= ring; dz++) for (let dx = -ring; dx <= ring; dx++) out.push(`${cx + dx},${cz + dz}`);
  return out;
}

const xyz = (p) => (Array.isArray(p) ? p : [p.x, p.y, p.z]);

// How much of the screen's height a light's reach covers, squared: 1 when
// the camera is inside it. `fov` in degrees, as three's cameras keep it.
export function screenArea(light, camera) {
  const c = xyz(camera.position);
  const d = Math.hypot(light.pos[0] - c[0], light.pos[1] - c[1], light.pos[2] - c[2]);
  const range = light.range ?? 10;
  if (d <= range) return 1;
  const h = d * Math.tan((((camera.fov ?? 60) * Math.PI) / 180) / 2);
  return Math.min(1, (range / h) ** 2);
}

export function lightsFor(json, cells, camera, { max = POINT_POOL, cull = CULL_AREA, fade = FADE_AREA, kind = null } = {}) {
  const picked = [];
  for (const cell of cells) {
    const list = json?.cells?.[cell];
    if (!list) continue;
    for (let i = 0; i < list.length; i++) {
      if (kind && list[i].kind !== kind) continue;
      const area = screenArea(list[i], camera);
      if (area <= cull) continue;
      picked.push({ cell, i, area, weight: Math.min(1, (area - cull) / (fade - cull)) });
    }
  }
  picked.sort((a, b) => b.area - a.area);
  if (picked.length > max) picked.length = max;
  return picked;
}

// (`clustered: 'force'` clusters on any backend: the fixture's way of trying
// it where it is not expected to run)
export async function createPlacedLights(scene, renderer, { points, spots = SPOT_POOL, clustered, scale = 1, source = null, cell = CELL } = {}) {
  const { THREE, ClusteredLighting } = await loadThree();
  const canCluster = clustered === 'force' || ((clustered ?? CLUSTERED) && backendOf(renderer) === 'webgpu');
  const nPoints = points ?? (canCluster ? POINT_POOL : POINT_FALLBACK);
  const before = renderer?.lighting;
  const lighting = canCluster && renderer ? new ClusteredLighting(nPoints, CLUSTER.tileSize, CLUSTER.zSlices, CLUSTER.perCluster) : null;
  if (lighting) renderer.lighting = lighting;
  const group = new THREE.Group();
  group.name = 'placed-lights';
  const pointPool = [];
  const spotPool = [];
  for (let i = 0; i < nPoints; i++) {
    const l = new THREE.PointLight(0xffffff, 0, 1, 2);
    l.castShadow = false;
    pointPool.push(l);
    group.add(l);
  }
  for (let i = 0; i < spots; i++) {
    const l = new THREE.SpotLight(0xffffff, 0, 1, Math.PI / 4, 0.5, 2);
    l.castShadow = false;
    spotPool.push(l);
    group.add(l, l.target);
  }
  scene.add(group);

  let lit = 0;
  let last = [];
  let extraLast = false; // (particle lights last frame: a frame without them puts them out)
  // list: [{ kind, pos, color, candela, range, cone: [inner, outer], dir, weight? }]
  function set(list) {
    last = list;
    let p = 0;
    let s = 0;
    for (const rec of list) {
      const w = rec.weight ?? 1;
      if (rec.kind === 'spot') {
        if (s >= spotPool.length) continue;
        const l = spotPool[s++];
        const [inner, outer] = rec.cone ?? [Math.PI / 4, Math.PI / 3];
        l.position.set(...rec.pos);
        l.target.position.set(rec.pos[0] + (rec.dir?.[0] ?? 0), rec.pos[1] + (rec.dir?.[1] ?? -1), rec.pos[2] + (rec.dir?.[2] ?? 0));
        l.angle = outer / 2;
        l.penumbra = outer > 0 ? Math.min(1, Math.max(0, 1 - inner / outer)) : 0;
        l.distance = rec.range ?? 10;
        l.color.setRGB(...(rec.color ?? [1, 1, 1]));
        l.intensity = (rec.candela ?? 0) * w * scale;
      } else {
        if (p >= pointPool.length) continue;
        const l = pointPool[p++];
        l.position.set(...rec.pos);
        l.distance = rec.range ?? 10;
        l.color.setRGB(...(rec.color ?? [1, 1, 1]));
        l.intensity = (rec.candela ?? 0) * w * scale;
      }
    }
    // (the rest go dark where they are: a light switched off by `visible`
    // would leave the scene's light list, and the list's length is in the
    // shader's key)
    for (let i = p; i < pointPool.length; i++) pointPool[i].intensity = 0;
    for (let i = s; i < spotPool.length; i++) spotPool[i].intensity = 0;
    lit = p + s;
    return lit;
  }

  return {
    set,
    // the lights of the cells round the camera, best first, into the pools,
    // and `extra` (particle lights, oldest first) in what the points leave
    update(camera, extra = null) {
      if (!camera || (!source && !extra?.length && !extraLast)) return lit;
      extraLast = !!extra?.length;
      const cells = source ? cellsNear(xyz(camera.position), cell) : [];
      const pick = (kind, max) => (source ? lightsFor(source, cells, camera, { max, kind }).map((p) => ({ ...source.cells[p.cell][p.i], weight: p.weight })) : []);
      return set([...appendLights(pick('point', pointPool.length), extra ?? [], pointPool.length), ...pick('spot', spotPool.length)]);
    },
    get lit() {
      return lit;
    },
    // the game's units to the site's: a weather change moves it with the sun
    setScale(k) {
      if (k === scale) return;
      scale = k;
      set(last);
    },
    pools: { points: pointPool, spots: spotPool },
    clustered: canCluster,
    dispose() {
      group.removeFromParent();
      for (const l of [...pointPool, ...spotPool]) l.dispose();
      if (lighting) {
        // (the scene's lights node holds the clusters' storage and compute;
        // the Lighting itself has no dispose)
        renderer.lighting = before;
        if (scene.isScene) lighting.getNode(scene)?.dispose?.();
      }
    },
  };
}
