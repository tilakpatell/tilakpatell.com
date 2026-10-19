// The other travellers drawn, whatever they're drawn in: ./ghosts.js's
// createGhosts with no figure, no material and no shader of its own, for a
// world that can't take the GLSL rim (one on the node renderer: Minecraft's
// tribute) or has no use for a Shire Frodo. ghosts.js says what a ghost
// does (its card, its ring, its fade, its emotes); this is all of it but
// the defaults.
//
// createGhostsOf({ paint, make, animate, height, tag, halo, snap }) → as
// createGhosts; `paint()` makes a ghost's one material (transparent, its
// opacity the ghost's to set), and `make` and `animate` are required.
//
// A row's `quip` (travellers.js: their quick-chat line, while it shows) is a
// bubble over the name card (lib/three/quipSprite.js), as faded in as they
// are. It's made the first time they say something and hidden between
// lines, so a town of quiet ghosts has no bubble to draw.

import * as THREE from 'three';
import { sharpen } from '../../../lib/three/textures';
import { createQuipSprite } from '../../../lib/three/quipSprite';
import { seeded } from '../../../lib/seeded';
import { applyEmote, heardEmote, readEmote } from '../../../lib/emote';

// a traveller's id as a number, so each starts their stride somewhere of
// their own (and the same somewhere every visit)
function idHash(id) {
  let h = 0x811c9dc5;
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  return h;
}

export const GHOST_HALO = 0x9ab8ff; // the ring of light under a stranger
export const ALLY_HALO = 0x8dffad; // and under an ally: the site's ally green (online.css)
const ALLY_INK = '#8dffad';
const ALLY_CARD = 'rgba(14, 44, 28, 0.66)';

// a name, on a little card that faces the camera (an ally's in the ally green)
function nameTag(name, size = 0.42, ally = false) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const font = '600 30px system-ui, sans-serif';
  g.font = font;
  const w = Math.ceil(g.measureText(name).width) + 28;
  c.width = w;
  c.height = 44;
  g.font = font;
  g.fillStyle = ally ? ALLY_CARD : 'rgba(20, 28, 52, 0.62)';
  g.beginPath();
  g.roundRect(0, 0, w, 44, 12);
  g.fill();
  g.fillStyle = ally ? ALLY_INK : '#e6eeff';
  g.textBaseline = 'middle';
  g.fillText(name, 14, 23);
  const tex = new THREE.CanvasTexture(c);
  sharpen(tex);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
  sp.scale.set((w / 44) * size, size, 1);
  sp.renderOrder = 5;
  return sp;
}

export function createGhostsOf({ paint, height = () => 0, make: build, animate, tag: tagSize = 0.42, halo: haloSize = 1, snap = 8 }) {
  const group = new THREE.Group();
  group.name = 'travellers';
  const ringGeo = new THREE.RingGeometry(0.28, 0.44, 28).rotateX(-Math.PI / 2);
  const ghosts = new Map();

  const make = (p) => {
    const f = build();
    const mat = paint();
    const old = new Set();
    const pale = () =>
      f.group.traverse((o) => {
        if (!o.isMesh || o.material === mat) return;
        old.add(o.material);
        o.material = mat;
        o.castShadow = false;
        o.receiveShadow = false;
      });
    pale();
    if (!f.shared) for (const m of old) m.dispose();
    // on the cast: drawn here, not by the town, and pale too once it's come
    if (f.cast) {
      f.cast.manual = true;
      f.cast.onReady(pale);
    }
    if (f.ringMesh) f.ringMesh.visible = false;
    const root = new THREE.Group();
    const ally = Boolean(p.ally);
    const halo = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: ally ? ALLY_HALO : GHOST_HALO, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.y = 0.04;
    halo.scale.setScalar(haloSize);
    const tag = nameTag(p.name, tagSize, ally);
    tag.position.y = (f.top ?? 1.6) + tagSize * 0.85;
    root.add(f.group, halo, tag);
    group.add(root);
    // (first seen up high: there at once, not rising from the ground; `clock`
    // is their own gait's time, so two don't step in time)
    return { f, mat, root, halo, tag, quip: null, name: p.name, ally, x: p.x, z: p.z, y: p.y ?? 0, face: p.face, fade: 0, clock: seeded(idHash(p.id))() * 10 };
  };

  const drop = (id, g) => {
    group.remove(g.root);
    g.f.cast?.dispose(); // (its geometry is the cast's, shared: only the toy's is freed below)
    if (g.f.dispose) g.f.dispose();
    else g.f.group.traverse((o) => o.geometry?.dispose());
    g.mat.dispose();
    g.halo.material.dispose();
    g.tag.material.map.dispose();
    g.tag.material.dispose();
    g.quip?.dispose();
    ghosts.delete(id);
  };

  return {
    group,
    update(list, t, dt, { ringOn = false } = {}) {
      const here = new Set();
      const k = 1 - Math.exp(-dt * 9);
      for (const p of list) {
        here.add(p.id);
        let g = ghosts.get(p.id);
        if (!g) {
          g = make(p);
          ghosts.set(p.id, g);
        }
        // a new name, or an alliance made or ended while you're both here: a new card
        const ally = Boolean(p.ally);
        if (g.name !== p.name || g.ally !== ally) {
          g.root.remove(g.tag);
          g.tag.material.map.dispose();
          g.tag.material.dispose();
          g.tag = nameTag(p.name, tagSize, ally);
          g.tag.position.y = (g.f.top ?? 1.6) + tagSize * 0.85;
          g.root.add(g.tag);
          g.halo.material.color.setHex(ally ? ALLY_HALO : GHOST_HALO);
          g.name = p.name;
          g.ally = ally;
        }
        // seen here only out of doors, and a Ring-wearer only through the Ring
        const want = !p.inside && (!p.ring || ringOn) ? 1 : 0;
        g.fade += (want - g.fade) * Math.min(1, dt * 4);
        // a jump (a new place, or a long gap): straight there
        if (Math.hypot(p.x - g.x, p.z - g.z) > snap) {
          g.x = p.x;
          g.z = p.z;
          g.y = p.y ?? 0;
        }
        g.x += (p.x - g.x) * k;
        g.z += (p.z - g.z) * k;
        let df = p.face - g.face;
        df = Math.atan2(Math.sin(df), Math.cos(df));
        g.face += df * k;
        g.y += ((p.y ?? 0) - g.y) * k;
        g.root.position.set(g.x, height(g.x, g.z), g.z);
        g.f.group.position.y = g.y;
        // the name goes up with them (a swinger's, a flyer's), the ring of light stays on the ground
        g.tag.position.y = g.y + (g.f.top ?? 1.6) + tagSize * 0.85;
        g.f.group.rotation.y = g.face;
        // their own clock, run by the frame (an offset by where they stand ran
        // it backwards for anyone walking west)
        g.clock += dt;
        // an emote they've struck: timed from when its message came in (each
        // message is a new one), the same one kept as it comes again
        if (p.emote !== g.heard) {
          g.heard = p.emote;
          g.emote = heardEmote(p.emote ?? null, g.clock, g.emote);
        }
        const emote = readEmote(g, g.clock);
        animate(g.f, g.clock, emote || p.emote ? { ...p, emote } : p, dt);
        const c = g.f.cast;
        if (c) {
          if (c.ready) g.shown = applyEmote({ play: c.play, stop: c.stop, anim: c.body?.anim }, emote, g.shown ?? null);
          c.tick(dt);
        }
        const shimmer = 0.85 + Math.sin(t * 2.6 + g.x) * 0.08 + Math.sin(t * 7.1 + g.z) * 0.04;
        g.mat.opacity = 0.42 * g.fade * shimmer;
        g.halo.material.opacity = 0.5 * g.fade * (0.7 + Math.sin(t * 3 + g.z) * 0.3);
        g.tag.material.opacity = 0.95 * g.fade;
        // what they've just said, stood on the name card (the card's as tall
        // as tagSize, about its middle: the bubble's tail a little over its top)
        if (p.quip && !g.quip) {
          g.quip = createQuipSprite({ height: tagSize });
          g.root.add(g.quip.sprite);
        }
        if (g.quip) {
          g.quip.set(p.quip ?? null);
          g.quip.sprite.position.y = g.tag.position.y + tagSize * 0.6;
          g.quip.fade(g.fade);
        }
        g.root.visible = g.fade > 0.02;
      }
      for (const [id, g] of ghosts) {
        if (here.has(id)) continue;
        // gone: fade out, then let go
        g.fade -= dt * 2;
        g.mat.opacity = 0.42 * Math.max(0, g.fade);
        g.tag.material.opacity = Math.max(0, g.fade);
        g.halo.material.opacity = 0.5 * Math.max(0, g.fade);
        g.quip?.fade(g.fade);
        if (g.fade <= 0) drop(id, g);
      }
    },
    get count() {
      return ghosts.size;
    },
    dispose() {
      for (const [id, g] of ghosts) drop(id, g);
      ringGeo.dispose();
    },
  };
}
