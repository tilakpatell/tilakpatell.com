// A system's space level from Battlefront II (2017), drawn (lane Q:
// scripts/bf2017-space.mjs makes the files, places.js's piecesFor places
// them): the game's Star Destroyer, MC80, Venators, Lucrehulk, corvettes,
// dry docks and satellites where its starfighter assault map stands them,
// the debris of the second Death Star turning on the game's asteroid tracks
// (rocksPlaced.js), and the backdrop wrecks and debris belts. Static: the
// level's hulls are scenery, never the war's ships (models.js's slots), so
// nothing the war flies is drawn twice.
//
// What each quality level draws (the space layer's budget rows unmoved):
//   low    nothing (a phone keeps the system as it was)
//   mid    the capitals and docks, as their far-off copies only
//   high   everything: a capital its plain cut near and its far copy past
//          NEAR times its size; half the rocks, the biggest
//   ultra  the same, every rock
//
// createSpacePieces(sysId, { detail, load }) → { group, goals, ready, update(t), dispose() }
//   goals: the level, for the autopilot (places.js's spaceGoals), known at once
//   ready: a promise, when what this level draws is placed
//   load(url) → Promise<gltf | null> (gltfCache's loadGLTF; a test's stand-in)
// TIERS: the rows above

import * as THREE from 'three';
import { device } from '../../lib/device';
import { cloneScene, loadGLTF } from '../../lib/three/gltfCache';
import { piecesFor, spaceGoals } from './places';
import { createRocks } from './rocks';
import TRACKS from '../../data/galaxy/space/tracks.json';

export const NEAR = 8; // a capital's plain cut inside this many times its size
export const TIERS = {
  low: null,
  mid: { kinds: ['capital', 'dock'], farOnly: true, rocks: 0 },
  high: { kinds: ['capital', 'dock', 'station', 'backdrop'], farOnly: false, rocks: 0.5 },
  ultra: { kinds: ['capital', 'dock', 'station', 'backdrop'], farOnly: false, rocks: 1 },
};

const farMaterial = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 });

export function createSpacePieces(sysId, { detail = device().detail, load = (url) => loadGLTF(url) } = {}) {
  const group = new THREE.Group();
  group.name = `space-level-${sysId}`;
  const tier = TIERS[detail] ?? TIERS.high;
  const goals = tier ? spaceGoals(sysId) : [];
  let rocks = null;
  let dead = false;
  const made = [];
  const far = farMaterial();
  made.push(far);
  const scale = (p) => Math.max(...p.scale.map(Math.abs));
  const loadFar = (url) =>
    load(url).then((gltf) => {
      if (!gltf) return null;
      const root = gltf.scene.clone(true);
      root.traverse((o) => {
        if (!o.isMesh) return;
        if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
        o.material = far;
      });
      return root;
    });
  const ready = !tier
    ? Promise.resolve()
    : piecesFor(sysId).then(async (pieces) => {
        if (dead) return;
        const shown = pieces.filter((p) => tier.kinds.includes(p.kind));
        const urls = new Map();
        const want = (url, how) => url && !urls.has(url) && urls.set(url, how(url).catch(() => null));
        for (const p of shown) {
          if (!tier.farOnly || !p.far) want(p.url, load);
          if (p.far) want(p.far, loadFar);
        }
        const rockPieces = tier.rocks > 0 ? pieces.filter((p) => p.kind === 'rock') : [];
        for (const p of rockPieces) want(p.url, load);
        const got = new Map(await Promise.all([...urls].map(async ([url, p]) => [url, await p])));
        if (dead) return;
        for (const p of shown) {
          const full = !tier.farOnly || !p.far ? got.get(p.url) : null;
          const farOne = p.far ? got.get(p.far) : null;
          if (!full && !farOne) continue;
          const holder = new THREE.Group();
          holder.position.fromArray(p.at);
          holder.quaternion.fromArray(p.quaternion);
          holder.scale.fromArray(p.scale);
          if (full && farOne && (p.kind === 'capital' || p.kind === 'dock')) {
            const lod = new THREE.LOD();
            lod.addLevel(cloneScene(full), 0);
            lod.addLevel(farOne.clone(true), p.size * scale(p) * NEAR); // (in the world's units: its size is metres, its scale a hundredth)
            holder.add(lod);
          } else holder.add(full ? cloneScene(full) : farOne.clone(true));
          holder.userData.piece = p.model;
          group.add(holder);
        }
        if (rockPieces.length) {
          const models = {};
          for (const p of rockPieces) if (!models[p.model] && got.get(p.url)) models[p.model] = { scene: got.get(p.url).scene, size: p.size };
          rocks = createRocks({ kind: 'placed', pieces: rockPieces, models, tracks: TRACKS, keep: tier.rocks });
          group.add(rocks.group);
        }
      });
  return {
    group,
    goals,
    ready,
    update(t) {
      rocks?.update(t);
    },
    dispose() {
      dead = true;
      rocks?.dispose();
      for (const x of made) x.dispose();
      group.removeFromParent();
    },
  };
}
