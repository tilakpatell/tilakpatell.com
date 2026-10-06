// The shipyard's modules in 3D, and a build put together from them: each
// module made in code the way hulls.js makes the X-wing and the Falcon
// (lofted and turned hulls with chamfered edges that catch the light,
// bevelled plates, panel-lined skins), in its own frame, then set on the
// socket the hull has for it (parts.js), the wings and paired engines
// mirrored. Everything of one material is merged into one mesh, so a whole
// ship is a handful of draws.
//
// assemble(build, { maps }) → { group, stand, glow: [{ mat, color }],
//   glowMesh, glowFixed, engines (where each exhaust leaves), mounts (the
//   hull's hardpoints, for modules.js), nose: 0, update(t), dispose() }:
// the face shipModels.js's built ships have. `maps` are the panel skins
// (hulls.js panelMaps); without them (in Node, in the tests) the materials
// are plain.
//
// BUILT units throughout, nose −z, x to the right, y up.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { detail, seg as segments } from '../../../lib/detail';
import { flipped, glassMaterial, loft, merge, paintMaterial, plate, turned } from '../hulls';
import { BUILD_SLOTS, moduleById } from './parts';
import { STOCK_BUILD } from './build';

// the engines' glow, by the set fitted
const GLOW = { twincans: '#ffb35c', quad: '#8fd3ff', ring: '#7dff5c' };
const LAY = [Math.PI / 2, 0, 0]; // (a CylinderGeometry laid along z, its top toward +z)
const tube = (r0, r1, len, seg = 24) => new THREE.CylinderGeometry(r1, r0, len, segments(seg)); // (r0 at −z once laid; lib/detail: rounder at ultra)
const rounded = (w, h, d, r = Math.min(w, h, d) * 0.3) => new RoundedBoxGeometry(w, h, d, Math.max(2, Math.round(3 * detail().seg)), r);

// ── hulls ──

const HULLS = {
  // a fighter's fuselage: fine at the nose, broad at the back, an intake
  // either side and a spine down its back
  dart() {
    const P = { paint: [], trim: [], dark: [], metal: [] };
    P.paint.push([
      loft([
        { z: -0.17, w: 0.004, h: 0.004, y: -0.002, c: 0.5 },
        { z: -0.15, w: 0.018, h: 0.014, y: -0.002 },
        { z: -0.11, w: 0.036, h: 0.026 },
        { z: -0.06, w: 0.054, h: 0.036 },
        { z: 0.0, w: 0.064, h: 0.04 },
        { z: 0.06, w: 0.07, h: 0.042 },
        { z: 0.1, w: 0.066, h: 0.038 },
        { z: 0.12, w: 0.058, h: 0.032 },
      ]),
    ]);
    // a band round the nose, in the trim
    P.trim.push([
      loft([
        { z: -0.135, w: 0.0264, h: 0.0201, y: -0.00125 },
        { z: -0.122, w: 0.0322, h: 0.024, y: -0.0006 },
      ]),
    ]);
    // the intakes, a scoop each side
    for (const sx of [-1, 1]) {
      P.paint.push([
        loft([
          { z: -0.03, w: 0.012, h: 0.016, c: 0.4 },
          { z: 0.01, w: 0.016, h: 0.02, c: 0.4 },
          { z: 0.05, w: 0.014, h: 0.018, c: 0.4 },
        ]),
        [sx * 0.036, -0.006, 0],
      ]);
      P.dark.push([new THREE.PlaneGeometry(0.0095, 0.012), [sx * 0.036, -0.006, -0.0302], [0, Math.PI, 0]]);
    }
    // the spine, from behind the cockpit to the tail
    P.paint.push([plate([[-0.005, -0.04], [0.005, -0.04], [0.008, 0.1], [-0.008, 0.1]], 0.008), [0, 0.02, 0]]);
    // the back plate, round the engines
    P.metal.push([new THREE.CircleGeometry(0.026, segments(24)), [0, 0, 0.1202], [0, 0, 0], [1.15, 0.62, 1]]);
    return P;
  },
  // a flying saucer's hull, Rick's way: a disc, a band round its rim, two
  // headlights on stalks at the front
  saucer() {
    const P = { paint: [], trim: [], dark: [], metal: [], lamp: [] };
    const profile = [
      [0.0, -0.023],
      [0.05, -0.024],
      [0.09, -0.019],
      [0.112, -0.01],
      [0.121, -0.002],
      [0.121, 0.002],
      [0.112, 0.008],
      [0.085, 0.016],
      [0.045, 0.022],
      [0.0, 0.024],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    P.paint.push([new THREE.LatheGeometry(profile, segments(64))]);
    P.trim.push([new THREE.TorusGeometry(0.1215, 0.0028, segments(10), segments(96)), [0, 0, 0], [Math.PI / 2, 0, 0]]);
    P.dark.push([new THREE.CircleGeometry(0.045, segments(40)), [0, -0.0241, 0], [Math.PI / 2, 0, 0]]);
    for (const sx of [-1, 1]) {
      P.metal.push([tube(0.0035, 0.0035, 0.02, 12), [sx * 0.04, 0.004, -0.112], [Math.PI / 2 + 0.25, 0, 0]]);
      P.metal.push([new THREE.SphereGeometry(0.0085, segments(16), segments(12)), [sx * 0.04, 0.008, -0.124]]);
      P.lamp.push([new THREE.CircleGeometry(0.0062, segments(16)), [sx * 0.04, 0.008, -0.1326], [0, Math.PI, 0]]);
    }
    return P;
  },
  // a freighter's box: chamfered, with dark ribs round it and skids under
  hauler() {
    const P = { paint: [], trim: [], dark: [], metal: [] };
    P.paint.push([
      loft(
        [
          { z: -0.15, w: 0.07, h: 0.05, y: -0.006, c: 0.35 },
          { z: -0.13, w: 0.096, h: 0.07, c: 0.25 },
          { z: -0.1, w: 0.11, h: 0.08, c: 0.22 },
          { z: 0.1, w: 0.11, h: 0.08, c: 0.22 },
          { z: 0.13, w: 0.1, h: 0.072, c: 0.22 },
        ],
        { uvAlong: 2 },
      ),
    ]);
    for (const z of [-0.06, 0.0, 0.06]) {
      P.dark.push([
        loft([
          { z: z - 0.005, w: 0.1135, h: 0.0835, c: 0.22 },
          { z: z + 0.005, w: 0.1135, h: 0.0835, c: 0.22 },
        ]),
      ]);
    }
    P.trim.push([
      loft([
        { z: -0.098, w: 0.1128, h: 0.0828, c: 0.22 },
        { z: -0.084, w: 0.1128, h: 0.0828, c: 0.22 },
      ]),
    ]);
    for (const sx of [-1, 1]) P.metal.push([rounded(0.012, 0.008, 0.2), [sx * 0.035, -0.043, 0.0]]);
    P.metal.push([rounded(0.08, 0.05, 0.004, 0.0015), [0, 0, 0.1305]]);
    return P;
  },
  // a racer's needle: long and thin, a stripe down its back, strakes along
  // its flanks
  needle() {
    const P = { paint: [], trim: [], dark: [], metal: [] };
    P.paint.push([
      loft([
        { z: -0.19, w: 0.002, h: 0.002, c: 0.5 },
        { z: -0.16, w: 0.012, h: 0.01 },
        { z: -0.1, w: 0.03, h: 0.026 },
        { z: 0.0, w: 0.04, h: 0.034 },
        { z: 0.1, w: 0.04, h: 0.032 },
        { z: 0.13, w: 0.034, h: 0.028 },
      ]),
    ]);
    P.trim.push([plate([[-0.0035, -0.15], [0.0035, -0.15], [0.006, 0.12], [-0.006, 0.12]], 0.0024), [0, 0.0166, 0], [0, 0, 0], [1, 1, 1]]);
    for (const sx of [-1, 1]) P.dark.push([plate([[0, -0.08], [0.006, -0.06], [0.006, 0.1], [0, 0.11]], 0.003), [sx * 0.019, -0.004, 0], [0, 0, sx * 0.2], [sx, 1, 1]]);
    P.metal.push([new THREE.CircleGeometry(0.017, segments(24)), [0, 0, 0.1302], [0, 0, 0], [1, 0.8, 1]]);
    return P;
  },
};

// ── cockpits (the plug where the cockpit's floor meets the hull's top) ──

const COCKPITS = {
  bubble() {
    const P = { glass: [], metal: [], dark: [] };
    P.glass.push([new THREE.SphereGeometry(0.022, segments(32), segments(16), 0, Math.PI * 2, 0, Math.PI / 2), [0, 0, 0], [0, 0, 0], [1, 0.95, 1.1]]);
    P.metal.push([new THREE.TorusGeometry(0.0222, 0.0022, segments(10), segments(48)), [0, 0.0005, 0], [Math.PI / 2, 0, 0], [1, 1.1, 1]]);
    P.dark.push([rounded(0.012, 0.008, 0.01, 0.003), [0, 0.004, 0.007]]); // (the seat)
    return P;
  },
  canopy() {
    const P = { glass: [], metal: [], paint: [] };
    P.paint.push([
      loft([
        { z: -0.03, w: 0.014, h: 0.006, y: -0.001, c: 0.45 },
        { z: 0.0, w: 0.026, h: 0.01, c: 0.45 },
        { z: 0.05, w: 0.016, h: 0.008, y: -0.001, c: 0.45 },
      ]),
    ]);
    P.glass.push([new THREE.SphereGeometry(0.014, segments(28), segments(14), 0, Math.PI * 2, 0, Math.PI / 2), [0, 0.003, 0.004], [0, 0, 0], [0.95, 1, 2.6]]);
    P.metal.push([plate([[-0.0012, -0.032], [0.0012, -0.032], [0.0012, 0.04], [-0.0012, 0.04]], 0.0016), [0, 0.0172, 0.004]]);
    return P;
  },
  // an armoured hump with a band of glass wrapped round its front
  visor() {
    const P = { paint: [], glass: [], metal: [] };
    P.paint.push([
      loft([
        { z: -0.032, w: 0.024, h: 0.004, y: 0.0, c: 0.5 },
        { z: -0.02, w: 0.038, h: 0.02, y: 0.007, c: 0.45 },
        { z: 0.02, w: 0.042, h: 0.024, y: 0.009, c: 0.45 },
        { z: 0.042, w: 0.03, h: 0.01, y: 0.003, c: 0.45 },
      ]),
    ]);
    P.glass.push([
      loft([
        { z: -0.0215, w: 0.0372, h: 0.0196, y: 0.0076, c: 0.45 },
        { z: -0.004, w: 0.0418, h: 0.0236, y: 0.0094, c: 0.45 },
      ]),
      [0, 0.0006, 0],
      [0, 0, 0],
      [1.03, 1.03, 1],
    ]);
    P.metal.push([plate([[-0.0015, -0.003], [0.0015, -0.003], [0.0015, 0.036], [-0.0015, 0.036]], 0.0014), [0, 0.0212, 0]]);
    return P;
  },
};

// ── wings (the right one, its root at the plug; the left's mirrored) ──

// a wing plate thinning toward its tip: thickness × (1 − taper × x / span)
function wingPlate(outline, t, span, taper = 0.55) {
  const g = plate(outline, t, t * 0.45, 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * (1 - taper * Math.min(1, Math.max(0, p.getX(i) / span))));
  g.computeVertexNormals();
  return g;
}

const WINGS = {
  swept() {
    const P = { paint: [], trim: [], dark: [] };
    P.paint.push([wingPlate([[0, -0.03], [0.13, 0.04], [0.13, 0.068], [0, 0.052]], 0.009, 0.13)]);
    P.trim.push([wingPlate([[0.085, 0.011], [0.13, 0.04], [0.13, 0.05], [0.085, 0.024]], 0.0062, 0.13, 0.3), [0, 0.0012, 0]]);
    P.dark.push([rounded(0.008, 0.012, 0.06, 0.003), [0.004, -0.001, 0.012]]); // (the root's fairing)
    return P;
  },
  delta() {
    const P = { paint: [], trim: [], dark: [] };
    P.paint.push([wingPlate([[0, -0.055], [0.1, 0.06], [0.1, 0.078], [0, 0.072]], 0.01, 0.1)]);
    P.trim.push([wingPlate([[0.06, 0.02], [0.1, 0.06], [0.1, 0.07], [0.06, 0.04]], 0.0068, 0.1, 0.3), [0, 0.0012, 0]]);
    // a winglet turned down at the tip
    P.paint.push([plate([[0, 0.045], [0.022, 0.06], [0.022, 0.078], [0, 0.078]], 0.0035), [0.1, 0, 0], [0, 0, -Math.PI / 2 + 0.25]]);
    return P;
  },
  twinboom() {
    const P = { paint: [], trim: [], dark: [], metal: [] };
    P.paint.push([wingPlate([[0, -0.016], [0.12, -0.01], [0.12, 0.02], [0, 0.026]], 0.008, 0.12, 0.35)]);
    // the boom at the tip, running back past the tail, with a fin on its end
    P.paint.push([
      turned(
        [
          [0.0, -0.04],
          [0.006, -0.036],
          [0.0095, -0.022],
          [0.0095, 0.09],
          [0.007, 0.112],
          [0.0, 0.116],
        ],
        28,
      ),
      [0.12, 0, 0],
    ]);
    P.trim.push([tube(0.0098, 0.0098, 0.012, 28), [0.12, 0, -0.012], LAY]);
    P.paint.push([plate([[0, 0.07], [0.028, 0.098], [0.028, 0.112], [0, 0.11]], 0.0034), [0.12, 0.004, 0], [0, 0, Math.PI / 2]]);
    return P;
  },
  stub() {
    const P = { paint: [], trim: [], dark: [], metal: [] };
    P.paint.push([wingPlate([[0, -0.02], [0.054, -0.012], [0.054, 0.022], [0, 0.032]], 0.012, 0.054, 0.3)]);
    // a pod at the end: a capsule with an intake and a little glow aft
    P.paint.push([
      turned(
        [
          [0.0, -0.034],
          [0.006, -0.031],
          [0.011, -0.02],
          [0.0115, 0.018],
          [0.009, 0.032],
          [0.0, 0.034],
        ],
        28,
      ),
      [0.064, 0, 0],
    ]);
    P.dark.push([new THREE.CircleGeometry(0.0062, segments(20)), [0.064, 0, -0.0315], [0, Math.PI, 0]]);
    P.trim.push([tube(0.0118, 0.0118, 0.008, 28), [0.064, 0, -0.006], LAY]);
    return P;
  },
};

// ── engines (one unit, its exhaust toward +z from the plug; returns where
// the exhaust leaves, along z) ──

const ENGINE_UNITS = {
  twincans(P) {
    P.metal.push([
      turned(
        [
          [0.011, -0.02],
          [0.0155, -0.012],
          [0.0165, 0.0],
          [0.0165, 0.032],
          [0.015, 0.038],
          [0.018, 0.052],
          [0.0168, 0.054],
        ],
        32,
      ),
    ]);
    for (const z of [0.006, 0.02]) P.dark.push([new THREE.TorusGeometry(0.0167, 0.0016, segments(8), segments(32)), [0, 0, z]]);
    P.dark.push([new THREE.CircleGeometry(0.0158, segments(28)), [0, 0, 0.0505]]);
    P.glow.push([new THREE.CircleGeometry(0.0122, segments(28)), [0, 0, 0.0525]]);
    return 0.054;
  },
  quad(P) {
    P.metal.push([
      turned(
        [
          [0.006, -0.012],
          [0.0095, -0.006],
          [0.01, 0.018],
          [0.0118, 0.032],
          [0.0108, 0.034],
        ],
        24,
      ),
    ]);
    P.dark.push([new THREE.CircleGeometry(0.0098, segments(20)), [0, 0, 0.0305]]);
    P.glow.push([new THREE.CircleGeometry(0.0078, segments(20)), [0, 0, 0.0325]]);
    return 0.034;
  },
  // a ring of portal fluid round a burning core, held off the hull by four struts
  ring(P) {
    P.metal.push([turned([[0.008, -0.016], [0.013, -0.008], [0.013, 0.02], [0.009, 0.03]], 28)]);
    P.metal.push([new THREE.TorusGeometry(0.03, 0.0055, segments(14), segments(64)), [0, 0, 0.024]]);
    P.trim.push([new THREE.TorusGeometry(0.03, 0.0058, segments(14), segments(64), Math.PI * 2), [0, 0, 0.024], [0, 0, 0], [1, 1, 0.45]]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      P.dark.push([new THREE.BoxGeometry(0.0025, 0.022, 0.006), [Math.cos(a) * 0.02, Math.sin(a) * 0.02, 0.016], [0, 0, a - Math.PI / 2]]);
    }
    P.glow.push([new THREE.CircleGeometry(0.0255, segments(40)), [0, 0, 0.0245]]);
    P.glow.push([new THREE.CircleGeometry(0.0095, segments(24)), [0, 0, 0.0305]]);
    return 0.031;
  },
};

// ── tails (on the hull's tail socket, standing up from it) ──

// a fin: its outline in (along the ship, up), stood on its edge
const fin = (outline, t) => {
  const g = plate(
    outline.map(([z, y]) => [y, z]),
    t,
  );
  g.rotateZ(Math.PI / 2);
  return g;
};
const TAILS = {
  fin() {
    const P = { paint: [], trim: [] };
    P.paint.push([fin([[-0.025, 0], [0.012, 0.05], [0.028, 0.052], [0.03, 0]], 0.005)]);
    P.trim.push([fin([[0.004, 0.034], [0.012, 0.05], [0.028, 0.052], [0.026, 0.034]], 0.0056)]);
    return P;
  },
  twinfin() {
    const P = { paint: [], trim: [] };
    for (const sx of [-1, 1]) {
      P.paint.push([fin([[-0.018, 0], [0.012, 0.04], [0.026, 0.042], [0.028, 0]], 0.0042), [sx * 0.014, 0, 0], [0, 0, -sx * 0.4]]);
      P.trim.push([fin([[0.006, 0.028], [0.012, 0.04], [0.026, 0.042], [0.025, 0.028]], 0.0048), [sx * 0.014, 0, 0], [0, 0, -sx * 0.4]]);
    }
    return P;
  },
  none: () => ({}),
};

// ── extras (on the top socket, or the wings' tips) ──

const EXTRAS = {
  none: () => ({}),
  antenna() {
    const P = { dark: [], metal: [], red: [] };
    P.dark.push([tube(0.004, 0.003, 0.004, 16), [0, 0.002, 0]]);
    P.metal.push([tube(0.0009, 0.0005, 0.07, 8), [0, 0.037, 0.004], [-0.12, 0, 0]]);
    P.red.push([new THREE.SphereGeometry(0.0022, segments(12), segments(8)), [0, 0.072, 0.0125]]);
    return P;
  },
  dish() {
    const P = { dark: [], metal: [] };
    P.dark.push([tube(0.004, 0.003, 0.012, 16), [0, 0.006, 0]]);
    return P;
  },
  lights: () => ({}), // (at the wingtips: see assemble)
};

// the radar dish, on its own so it can turn
function dishMesh(mat) {
  const g = merge([
    [new THREE.SphereGeometry(0.02, segments(28), segments(10), 0, Math.PI * 2, 0, 0.75), [0, -0.0145, 0], [0, 0, 0], [1, 1, 1]],
    [new THREE.SphereGeometry(0.0198, segments(28), segments(10), 0, Math.PI * 2, 0, 0.75), [0, -0.0143, 0], [Math.PI, 0, 0], [1, -1, 1]],
    [tube(0.0008, 0.0008, 0.016, 8), [0, 0.006, 0]],
  ]);
  const m = new THREE.Mesh(g, mat);
  m.rotation.x = -0.9;
  const pivot = new THREE.Group();
  pivot.add(m);
  return pivot;
}

// ── materials ──

function makeMaterials(maps, glowColor) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const skin = maps ? { map: maps.map, normalMap: maps.normalMap, normalScale: new THREE.Vector2(0.55, 0.55), roughnessMap: maps.roughnessMap } : {};
  const M = {
    // (at ultra, lib/detail, the paint wears a thin clear coat and the canopy a crisp one)
    paint: paintMaterial({ color: '#ffffff', ...skin, roughness: 0.6, metalness: 0.2 }),
    trim: paintMaterial({ color: '#d9661f', ...(maps ? { map: maps.map } : {}), roughness: 0.5, metalness: 0.15 }),
    dark: std({ color: '#1d2025', roughness: 0.45, metalness: 0.6 }),
    metal: std({ color: '#5a6069', roughness: 0.34, metalness: 0.8 }),
    glass: glassMaterial({ color: '#8fd0f0', emissive: '#0b3a52', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.55, envMapIntensity: 1.8, depthWrite: false }),
    glow: new THREE.MeshBasicMaterial({ color: glowColor, toneMapped: false, side: THREE.DoubleSide }),
    lamp: new THREE.MeshBasicMaterial({ color: '#fff6d8', toneMapped: false }),
    red: new THREE.MeshBasicMaterial({ color: '#ff3b2e', toneMapped: false }),
    green: new THREE.MeshBasicMaterial({ color: '#39ff6a', toneMapped: false }),
  };
  // glass, the dark machinery, the metal and the lights keep their colours under a paint job
  for (const k of ['dark', 'metal', 'glass', 'glow', 'lamp', 'red', 'green']) M[k].userData.keep = true;
  return M;
}

// ── putting it together ──

const m4 = (pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) => new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));

export function assemble(raw = STOCK_BUILD, { maps = null } = {}) {
  const build = Object.fromEntries(BUILD_SLOTS.map((slot) => [slot, moduleById(slot, raw?.[slot]) ? raw[slot] : STOCK_BUILD[slot]]));
  const hull = moduleById('hull', build.hull);
  const S = hull.sockets;
  const scale = hull.scale ?? 1;
  const M = makeMaterials(maps, GLOW[build.engines] ?? GLOW.twincans);
  const bins = Object.fromEntries(Object.keys(M).map((k) => [k, []]));

  // a module's parts, by material, placed by `at` (its socket) into the bins
  const place = (P, at) => {
    const mirrored = at.determinant() < 0;
    for (const [k, list] of Object.entries(P)) {
      for (const [geo, pos, rot, sc] of list) {
        const g = geo.index ? geo.toNonIndexed() : geo.clone();
        geo.dispose();
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(at, m4(pos, rot, sc)));
        bins[k].push([mirrored ? flipped(g) : g]);
      }
    }
  };
  const both = (fn, [x, y, z], extra = new THREE.Matrix4()) => {
    place(fn(), new THREE.Matrix4().multiplyMatrices(m4([x, y, z]), extra));
    place(fn(), new THREE.Matrix4().multiplyMatrices(m4([-x, y, z], [0, 0, 0], [-1, 1, 1]), extra));
  };

  place(HULLS[build.hull](), new THREE.Matrix4());
  place(COCKPITS[build.cockpit](), m4(S.cockpit, [0, 0, 0], [scale, scale, scale]));
  const [wx, wy, wz] = S.wing;
  both(WINGS[build.wings], [wx, wy, wz]);
  place(TAILS[build.tail](), m4(S.tail, [0, 0, 0], [scale, scale, scale]));
  place(EXTRAS[build.extras](), m4(S.top, [0, 0, 0], [scale, scale, scale]));

  // the engines: the hull's layout for as many as the set has (or the
  // largest it has room for)
  const want = moduleById('engines', build.engines).count;
  const fits = Object.keys(S.engine)
    .map(Number)
    .filter((n) => n <= want)
    .sort((a, b) => b - a)[0];
  const layout = S.engine[fits ?? Math.min(...Object.keys(S.engine).map(Number))];
  const exhaust = [];
  for (const [x, y, z] of layout) {
    const P = { metal: [], dark: [], glow: [], trim: [] };
    const out = ENGINE_UNITS[build.engines](P);
    const mirrored = x < 0;
    place(P, m4([x, y, z], [0, 0, 0], [mirrored ? -1 : 1, 1, 1]));
    exhaust.push([x, y, z + out + 0.002]);
  }

  // the running lights at the wingtips: red to port (left), green to starboard
  const tip = moduleById('wings', build.wings).sockets.tip;
  if (build.extras === 'lights') {
    const tipAt = [wx + tip[0], wy + tip[1], wz + tip[2]];
    bins.green.push([new THREE.SphereGeometry(0.0034, segments(12), segments(8)).toNonIndexed().translate(...tipAt)]);
    bins.red.push([new THREE.SphereGeometry(0.0034, segments(12), segments(8)).toNonIndexed().translate(-tipAt[0], tipAt[1], tipAt[2])]);
  }

  const group = new THREE.Group();
  group.name = 'garage-build';
  const stand = new THREE.Group();
  group.add(stand);
  const made = [];
  let glowMesh = null;
  for (const [k, list] of Object.entries(bins)) {
    if (!list.length) continue;
    const geo = merge(list);
    made.push(geo);
    const mesh = new THREE.Mesh(geo, M[k]);
    mesh.name = k;
    if (M[k].userData.keep) mesh.userData.noPaint = true;
    if (k === 'glass') mesh.renderOrder = 2;
    if (k === 'glow') glowMesh = mesh;
    mesh.castShadow = k !== 'glass' && k !== 'glow';
    (k === 'glow' ? group : stand).add(mesh);
  }

  // the dish turns, and the lights blink
  let dish = null;
  if (build.extras === 'dish') {
    dish = dishMesh(M.metal);
    dish.position.set(S.top[0], S.top[1] + 0.012 * scale, S.top[2]);
    dish.scale.setScalar(scale);
    dish.traverse((o) => o.isMesh && ((o.userData.noPaint = true), made.push(o.geometry)));
    stand.add(dish);
  }

  return {
    group,
    stand,
    glow: [{ mat: M.glow, color: new THREE.Color(GLOW[build.engines] ?? GLOW.twincans) }],
    glowMesh,
    glowFixed: true, // (its glow is on its own engines; nothing moves it)
    engines: exhaust,
    mounts: S.mounts,
    nose: 0,
    update(t) {
      if (dish) dish.rotation.y = t * 1.6;
      const blink = Math.sin(t * 5.5) > 0.6 ? 1 : 0.18;
      M.red.color.set('#ff3b2e').multiplyScalar(build.extras === 'lights' ? blink : 1);
      M.green.color.set('#39ff6a').multiplyScalar(blink);
    },
    dispose() {
      for (const g of made) g.dispose();
      for (const m of Object.values(M)) m.dispose();
    },
  };
}
