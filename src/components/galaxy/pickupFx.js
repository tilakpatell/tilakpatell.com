// The pickups' drawing (pickups.js keeps the rules): each one a copy of its
// kind's model from pickups.glb (Quaternius's Ultimate Space Kit, CC0),
// spinning and bobbing where it floats, blinking through its last seconds,
// with a soft glow in its kind's colour behind it so it reads across a fight.
// With reduced motion they sit still and don't blink; they are there all
// the same. At most four are out, so each is a copy and a sprite, made as it
// is first wanted and kept for the next.
//
// createPickupFx(parent, { load, prepare, reduced }) → { sync(list, t), busy, dispose() }
//   load(url) → Promise<GLTF | null>: the site's cache by default (lib/three/gltfCache)
//   prepare(object) → Promise: what the scene sends new things to the graphics chip with (galaxy/scene.js's warm)
//   sync(list, t): the frame's `pickups.list` and the scene's clock, in seconds
// poseOf(p, t, reduced, out) → { spin, bob, shown }: where in its turn, how far up or down and whether to draw it, pure

import * as THREE from 'three';
import { cloneScene, loadGLTF } from '../../lib/three/gltfCache';
import { disposeTree } from '../../lib/three/renderer';
import { PICKUP_RULES } from './pickups';

const PICKUP_MODEL = '/models/galaxy/pickups.glb';
export const LOOK = { size: 1.1, glow: 2.4, spin: 1.2, bob: 0.15, bobHz: 1.4, blinkHz: 4, emissive: 0.55 };
export const GLOW = { repair: '#6dff9a', overcharge: '#ffb347', rapid: '#ff6a5c', bubble: '#7fd6ff', charge: '#c7a6ff' };

export function poseOf(p, t, reduced, out = { spin: 0, bob: 0, shown: true }) {
  out.spin = reduced ? 0 : t * LOOK.spin;
  out.bob = reduced ? 0 : Math.sin(t * LOOK.bobHz * Math.PI * 2) * LOOK.bob;
  // (its last seconds: off and on four times a second)
  out.shown = reduced || p.life - p.age >= PICKUP_RULES.blink || Math.floor(t * LOOK.blinkHz * 2) % 2 === 0;
  return out;
}

// a soft round glow: white in the middle, nothing at the rim (tinted by the sprite's colour)
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.4)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createPickupFx(parent, { load = loadGLTF, prepare = null, reduced = false } = {}) {
  const root = new THREE.Group();
  root.visible = false;
  parent.add(root);
  const templates = new Map(); // kind → its model, once the file's here
  const glows = new Map(); // kind → the one sprite material for it
  const live = new Map(); // id → { holder, model, kind }
  const spare = []; // holders taken off, for the next pickup
  const seen = new Set();
  const pose = { spin: 0, bob: 0, shown: true };
  let tex = null;
  let loaded = null; // the file's scene, ours to free
  let dead = false;

  const glowFor = (kind) => {
    let m = glows.get(kind);
    if (!m) {
      tex ??= glowTexture();
      m = new THREE.SpriteMaterial({ map: tex, color: GLOW[kind], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.8 });
      glows.set(kind, m);
    }
    return m;
  };

  load(PICKUP_MODEL)
    .then(async (gltf) => {
      if (!gltf?.scene || dead) return;
      loaded = cloneScene(gltf);
      loaded.traverse((o) => {
        // (a little of the atlas shows through the dark: they glow a little on their own)
        const m = o.isMesh ? o.material : null;
        if (m?.map && 'emissive' in m) {
          m.emissive.set('#ffffff');
          m.emissiveMap = m.map;
          m.emissiveIntensity = LOOK.emissive;
        }
      });
      for (const k of Object.keys(GLOW)) {
        const node = loaded.getObjectByName(k);
        if (node) templates.set(k, node);
      }
      // sent to the graphics chip with the rest, before the first drop: the models, and the sprite's shader (one for every colour)
      if (prepare) await prepare(new THREE.Group().add(loaded, new THREE.Sprite(glowFor('repair'))));
    })
    .catch(() => {});

  // the holder dressed for a kind: its glow, and its model once the file's here
  const dress = (it, kind) => {
    it.holder.clear();
    it.model = null;
    it.kind = kind;
    const sprite = new THREE.Sprite(glowFor(kind));
    sprite.scale.setScalar(LOOK.glow);
    it.holder.add(sprite);
  };
  const take = (p) => {
    let it = live.get(p.id);
    if (!it) {
      it = { holder: spare.pop() ?? new THREE.Group(), model: null, kind: null };
      live.set(p.id, it);
      root.add(it.holder);
    }
    if (it.kind !== p.kind) dress(it, p.kind);
    return it;
  };

  return {
    // whether it has something to draw (the scene keeps drawing while it does)
    get busy() {
      return live.size > 0;
    },
    sync(list, t) {
      if (!list.length && !live.size) {
        if (root.visible) root.visible = false;
        return;
      }
      root.visible = true;
      seen.clear();
      for (const p of list) {
        seen.add(p.id);
        const it = take(p);
        if (!it.model) {
          const tpl = templates.get(p.kind);
          if (tpl) {
            it.model = tpl.clone();
            it.model.position.set(0, 0, 0); // (the template's own centring is in its child: the holder's the one that's put)
            it.model.scale.setScalar(LOOK.size);
            it.holder.add(it.model);
          }
        }
        poseOf(p, t, reduced, pose);
        it.holder.position.set(p.at.x, p.at.y + pose.bob, p.at.z);
        if (it.model) it.model.rotation.y = pose.spin;
        it.holder.visible = pose.shown;
      }
      for (const [id, it] of live) {
        if (seen.has(id)) continue;
        root.remove(it.holder);
        live.delete(id);
        spare.push(it.holder);
      }
    },
    dispose() {
      dead = true;
      parent.remove(root);
      for (const m of glows.values()) m.dispose();
      tex?.dispose();
      if (loaded) disposeTree(loaded);
    },
  };
}
