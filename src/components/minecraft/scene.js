// Minecraft, the scene: the terrain's sections (scene/chunks.js) in the one
// block material's three passes (scene/nodes.js) over the pack's texture
// array (scene/atlasTexture.js), under the sky (scene/sky.js), seen from
// the player's eyes at 70° as the game's default. sync(g, alpha) puts the
// camera between the last two ticks, so it's smooth at any frame rate;
// under water the fog closes in blue, as the game's does. The others online
// in your world (sync's `travellers`, ../rules/online.js) walk it as pale
// Steves (scene/others.js).
//
// createScene(rt, { manifest }) → { ready, camera, chunks, sync(g, alpha, travellers?),
//   render(renderer), resize, setRenderDistance, dispose }

import * as THREE from 'three';
import { byName } from './rules/blocks.js';
import { sunBrightness } from './rules/time.js';
import { EYE } from './rules/player.js';
import { BIOME_CLIMATE, colormapAt } from './pack/colormap.js';
import { MC, loadBlockArray, loadItemArray, loadSprite, pixels } from './scene/atlasTexture.js';
import { createChunks } from './scene/chunks.js';
import { createCursor } from './scene/cursor.js';
import { createDrops } from './scene/drops.js';
import { createIcons } from './scene/icons.js';
import { TINT_COLOURS, blockMaterial, setFrames } from './scene/nodes.js';
import { createSky } from './scene/sky.js';
import { ghostLight, lightGhosts, makeSteve, stride } from './scene/others.js';
import { ghostNodeMaterial } from '../middleearth/shared/ghostNodes';
import { ABOVE } from './rules/online.js';
import { createGhostsOf } from '../middleearth/shared/ghostsOf';

const WATER = byName.get('water').id;
const UNDERWATER = new THREE.Vector3(0.02, 0.06, 0.24);

export function createScene(rt, { manifest }) {
  const anims = Object.values(manifest.anim ?? {});
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 1000);
  camera.rotation.order = 'YXZ';
  let distance = 10;
  let materials = null;
  let chunks = null;
  let sky = null;
  let cursor = null;
  let drops = null;
  // the others online here: on the world's own ground where they stand, put
  // back to the height over it they sent (the generator's, the same on the seed)
  let ground = null;
  const others = createGhostsOf({ paint: ghostNodeMaterial, height: (x, z) => (ground ? ABOVE(ground, x, z) : 0), make: makeSteve, animate: stride, tag: 0.3, halo: 0.9 });
  // (and the sky's light on them, theirs alone: scene/others.js)
  const othersLight = ghostLight();
  others.group.add(othersLight);
  scene.add(others.group);
  let othersAt = null;

  const ready = (async () => {
    const map = (name) => pixels(`${MC}sprites/${name}.webp`).catch(() => null);
    const [array, items, sun, moon, clouds, grassMap, foliageMap] = await Promise.all([
      loadBlockArray(manifest),
      manifest.items?.length ? loadItemArray(manifest).catch(() => null) : null,
      loadSprite('sun').catch(() => null),
      loadSprite('moon_phases').catch(() => null),
      loadSprite('clouds').catch(() => null),
      map('colormap_grass'),
      map('colormap_foliage'),
    ]);
    // the pack's own greens, for plains until the biomes tint by place (Phase 6)
    const climate = BIOME_CLIMATE.plains;
    const colours = {};
    if (grassMap) colours.grass = colormapAt(grassMap, ...climate);
    if (foliageMap) colours.foliage = colormapAt(foliageMap, ...climate);
    materials = { opaque: blockMaterial({ array, pass: 'opaque', colours }), cutout: blockMaterial({ array, pass: 'cutout', colours }), water: blockMaterial({ array, pass: 'water', colours }) };
    chunks = createChunks(scene, { materials });
    sky = createSky(scene, { sun, moon, clouds });
    const blockLayers = new Map(manifest.blocks.map((t, i) => [t, i]));
    const itemLayers = new Map((manifest.items ?? []).map((t, i) => [t, i]));
    const tints = { ...TINT_COLOURS, ...colours };
    cursor = createCursor(scene, { array, layers: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => blockLayers.get(`destroy_stage_${i}`)) });
    drops = createDrops(scene, { blocks: array, items, blockLayers, itemLayers, colours: tints });
    api.icons = createIcons({ blocks: array.userData.strip, blockLayers, items: items?.userData.strip, itemLayers, tints });
    api.chunks = chunks;
    setRenderDistance(distance);
  })();

  function setRenderDistance(n) {
    distance = n;
    camera.far = Math.max(600, (n + 2) * 16 * 1.5);
    camera.updateProjectionMatrix();
    if (!materials) return;
    sky.setFog(n);
    for (const m of Object.values(materials)) {
      m.u.fogNear.value = n * 16 * 0.8;
      m.u.fogFar.value = n * 16;
      m.u.fogColour.value.copy(sky.fog);
    }
  }

  function sync(g, alpha, travellers = []) {
    const p = g.player;
    ground = g.gen?.height ?? null;
    // (their clock in seconds, from the game's ticks)
    const t = (g.ticks + alpha) / 20;
    others.update(travellers, t, othersAt === null ? 0 : Math.max(0, Math.min(0.25, t - othersAt)));
    othersAt = t;
    const prev = g.prev ?? p;
    const eye = p.sneak ? EYE.sneak : EYE.stand;
    camera.position.set(prev.x + (p.x - prev.x) * alpha, prev.y + (p.y - prev.y) * alpha + eye, prev.z + (p.z - prev.z) * alpha);
    camera.rotation.set(p.pitch, p.yaw, 0);
    if (!materials) return;
    // the hour: the sky, and how much of the sky's light reaches the blocks
    sky.update(g.time + alpha, camera, distance * 16, g.ticks + alpha);
    const sun = sunBrightness(g.time + alpha);
    lightGhosts(othersLight, sun);
    for (const m of Object.values(materials)) {
      m.u.sun.value = sun;
      setFrames(m, anims, g.ticks);
    }
    // the block under the crosshair, and its crack while it's being broken
    const br = g.breaking;
    cursor.set(g.cursor, br && g.cursor && br.x === g.cursor.x && br.y === g.cursor.y && br.z === g.cursor.z ? Math.min(9, Math.floor(br.progress * 10)) : -1);
    drops.sync(g.drops, g.ticks + alpha);
    // the eye under water: a close blue fog
    const wet = g.world.get(camera.position.x, camera.position.y, camera.position.z) === WATER;
    for (const m of Object.values(materials)) {
      m.u.fogColour.value.copy(wet ? UNDERWATER : sky.fog);
      m.u.fogNear.value = wet ? 0 : distance * 16 * 0.8;
      m.u.fogFar.value = wet ? 14 : distance * 16;
    }
  }

  const api = {
    scene,
    camera,
    ready,
    chunks: null,
    icons: null,
    get materials() {
      return materials;
    },
    sync,
    setRenderDistance,
    render(renderer) {
      chunks?.flush();
      renderer.render(scene, camera);
    },
    resize(w, h) {
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    },
    dispose() {
      others.dispose();
      othersLight.dispose();
      chunks?.dispose();
      sky?.dispose();
      cursor?.dispose();
      drops?.dispose();
      for (const m of Object.values(materials ?? {})) {
        m.u.atlas.value?.dispose();
        m.dispose();
      }
    },
  };
  return api;
}
