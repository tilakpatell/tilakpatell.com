// The other travellers (./travellers.js), drawn in your town: each a Frodo
// from another world, pale and shimmering, lit from the edges, with their
// name over their head and a faint ring of light where they stand. They're
// not in your story: nothing bumps into them and nothing sees them. One
// wearing the Ring shows only while you wear it too.
//
// createGhosts({ height, make, animate, tag, halo, snap }) → { group,
// update(list, t, dt, { ringOn }), dispose() }; add `group` to the town (the
// scene's layer()). `make` builds the figure ({ group, top }: a Shire Frodo
// unless it says; the map's are its own big-headed toys; a figure whose
// geometry is shared with others brings its own `dispose`, and one whose
// materials are, `shared`, so they're left alone: Albuquerque's copy of
// Walt's Aztek), `animate(f, t, p, dt)` moves it (a Frodo's walk unless it
// says), `tag` is the name card's height and `halo` the size of the ring of
// light, in the scene's units, and `snap` how far behind it can be before
// it's put straight there (further for a car). A traveller who jumps (`y`,
// from a world that sends it) leaves the ground.

import * as THREE from 'three';
import { pose } from '../mapFigures';
import { makePerson } from '../shire/people';

const TINT = new THREE.Color(0xcfe0ff);
const GLOW = new THREE.Color(0x6a8cff);

// pale, see-through, brighter at the edges (a rim of light, as the Ring's
// world shows things)
function ghostMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: TINT, emissive: GLOW, emissiveIntensity: 0.55, roughness: 0.5, transparent: true, opacity: 0, depthWrite: false });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      float rim = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
      totalEmissiveRadiance += vec3(0.55, 0.7, 1.0) * pow(rim, 2.2) * 1.6;`,
    );
  };
  return m;
}

// a name, on a little card that faces the camera
function nameTag(name, size = 0.42) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const font = '600 30px system-ui, sans-serif';
  g.font = font;
  const w = Math.ceil(g.measureText(name).width) + 28;
  c.width = w;
  c.height = 44;
  g.font = font;
  g.fillStyle = 'rgba(20, 28, 52, 0.62)';
  g.beginPath();
  g.roundRect(0, 0, w, 44, 12);
  g.fill();
  g.fillStyle = '#e6eeff';
  g.textBaseline = 'middle';
  g.fillText(name, 14, 23);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
  sp.scale.set((w / 44) * size, size, 1);
  sp.renderOrder = 5;
  return sp;
}

export function createGhosts({ height = () => 0, make: build = () => makePerson('frodo'), animate = (f, t, p) => pose(f, t, { moving: p.moving }), tag: tagSize = 0.42, halo: haloSize = 1, snap = 8 } = {}) {
  const group = new THREE.Group();
  group.name = 'travellers';
  const ringGeo = new THREE.RingGeometry(0.28, 0.44, 28).rotateX(-Math.PI / 2);
  const ghosts = new Map();

  const make = (p) => {
    const f = build();
    const mat = ghostMaterial();
    const old = new Set();
    f.group.traverse((o) => {
      if (!o.isMesh) return;
      old.add(o.material);
      o.material = mat;
      o.castShadow = false;
      o.receiveShadow = false;
    });
    if (!f.shared) for (const m of old) m.dispose();
    if (f.ringMesh) f.ringMesh.visible = false;
    const root = new THREE.Group();
    const halo = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x9ab8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.y = 0.04;
    halo.scale.setScalar(haloSize);
    const tag = nameTag(p.name, tagSize);
    tag.position.y = (f.top ?? 1.6) + tagSize * 0.85;
    root.add(f.group, halo, tag);
    group.add(root);
    return { f, mat, root, halo, tag, name: p.name, x: p.x, z: p.z, y: p.y ?? 0, face: p.face, fade: 0 }; // (first seen up high: there at once, not rising from the ground)
  };

  const drop = (id, g) => {
    group.remove(g.root);
    if (g.f.dispose) g.f.dispose();
    else g.f.group.traverse((o) => o.geometry?.dispose());
    g.mat.dispose();
    g.halo.material.dispose();
    g.tag.material.map.dispose();
    g.tag.material.dispose();
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
        if (g.name !== p.name) {
          g.root.remove(g.tag);
          g.tag.material.map.dispose();
          g.tag.material.dispose();
          g.tag = nameTag(p.name, tagSize);
          g.tag.position.y = (g.f.top ?? 1.6) + tagSize * 0.85;
          g.root.add(g.tag);
          g.name = p.name;
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
        animate(g.f, t + g.x, p, dt);
        const shimmer = 0.85 + Math.sin(t * 2.6 + g.x) * 0.08 + Math.sin(t * 7.1 + g.z) * 0.04;
        g.mat.opacity = 0.42 * g.fade * shimmer;
        g.halo.material.opacity = 0.5 * g.fade * (0.7 + Math.sin(t * 3 + g.z) * 0.3);
        g.tag.material.opacity = 0.95 * g.fade;
        g.root.visible = g.fade > 0.02;
      }
      for (const [id, g] of ghosts) {
        if (here.has(id)) continue;
        // gone: fade out, then let go
        g.fade -= dt * 2;
        g.mat.opacity = 0.42 * Math.max(0, g.fade);
        g.tag.material.opacity = Math.max(0, g.fade);
        g.halo.material.opacity = 0.5 * Math.max(0, g.fade);
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
