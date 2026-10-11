// The Space Cruiser and its crew, all of ./cruiser3d.js but its paint and
// its canvas: the saucer's measurements, the crew sat and fitted under the
// glass, their life in their seats, with the cast, the ink, the glass and
// the wardrobe's colours passed in (buildCruiserWith), so ./cruiser3d.js
// builds it in GLSL and ./cruiser3dNodes.js in nodes. What follows is
// cruiser3d.js's own account.
//
// The Space Cruiser in 3D for the flight down the Rick and Morty page
// (./CruiserFlight.jsx): the Meshy model of the classic saucer with Rick at
// the wheel and Morty beside him, both sat in their seats (Meshy's seated
// clip) under the glass dome, toon-shaded and
// inked like Portal panic, on a small see-through canvas that the page moves
// about. Here it only turns: pose() points the nose the way it's flying
// (swinging round through facing you as it swoops from one side to the
// other), dips it as it drops, banks it and rolls it into a portal. The
// crew sit on their animators (base 'sit'): Rick takes a pull on his flask
// now and then over the wheel, and Morty throws his hands up when it dives.
// Loaded only where 3D is on; null if anything won't start.

import * as THREE from 'three';
import { local } from '../../lib/hooks';
import { LOOK_KEY, readLooks } from './wardrobe/looks';
import { bodyAsset, bodyKind, withWardrobe } from './wardrobe/wearCore';
import { sharpen } from '../../lib/three/textures';
import { seeded } from '../../lib/seeded';
import { domeOf, fitScale } from './seatFit';

const INK = 0x1b1424;
// (the saucer's measurements are shared with the C-137 world, which draws it bigger: scale them by its height over TALL)
export const TALL = 1.7; // the saucer's height, in the scene's units (it's 2.7 across)
export const SPAN = 2.4; // half the canvas's width, in the same units
export const GLASS = 0.69; // the share of the saucer's height where the hull stops and the dome starts
// how tall Rick and Morty would stand, and where they sit: across (Rick on
// the right as you look at the nose, as in the show; their heads over it),
// forward, the height of their feet, sat, and of their hips on the seats
// (the saucer's units, nose +z)
export const CREW = { rick: [1.1, 0.22], morty: [0.92, -0.22], z: 0.05, y: 0.82, hips: 1.09 };
// how far inside the glass every bit of them stays, sat (the saucer's units):
// the width of their ink, and room for Rick's flask and Morty's fright
const SEAT_ROOM = 0.05;
// the backs of the two exhaust cans
export const CANS = [[0.87, 1.0, -1.3], [-0.87, 1.0, -1.3]];
// Rick's flask, every so often (s); a dive steep enough to frighten Morty
// (how far down the nose is, 0…1), and not again for a while (s)
const FLASK = [14, 34];
const DIVE = { on: 0.6, off: 0.35, rest: 3 };

// The crew's own life, sat in their seats: each frame, `crew` stepped on
// its animator; Rick's flask on his upper half between FLASK's seconds;
// Morty's fright on his when a dive starts (dive: 0…1). Returns the next
// state ({ flaskIn, diving, scaredAt }).
export function crewLife({ rick, morty }, st, t, dt, dive = 0, rand = Math.random) {
  const next = { ...st };
  if (rick?.play) {
    next.flaskIn = (st.flaskIn ?? FLASK[0] * rand()) - dt;
    if (next.flaskIn <= 0) {
      rick.play('drink', { layer: 'upper' });
      next.flaskIn = FLASK[0] + (FLASK[1] - FLASK[0]) * rand();
    }
  }
  if (dive >= DIVE.on && !st.diving) {
    next.diving = true;
    if (morty?.play && t - (st.scaredAt ?? -Infinity) >= DIVE.rest) {
      morty.play('scared', { layer: 'upper' });
      next.scaredAt = t;
    }
  } else if (dive <= DIVE.off) next.diving = false;
  return next;
}

// The glass's points (above the rim, GLASS of the way up each mesh, as
// glassDome has it) in `frame`'s own space, for seatFit's dome.
function glassPoints(body, frame) {
  frame.updateMatrixWorld(true);
  const into = frame.matrixWorld.clone().invert();
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const pts = [];
  body.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const { min, max } = o.geometry.boundingBox;
    const rim = min.y + (max.y - min.y) * GLASS;
    m.multiplyMatrices(into, o.matrixWorld);
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (v.y < rim) continue;
      v.applyMatrix4(m);
      pts.push(v.x, v.y, v.z);
    }
  });
  return pts;
}

// Every third point of a mesh as it's posed, into `into`'s frame, pushed
// onto `out` ([x, y, z, …]). A skinned mesh is skinned here as its shader
// does it, with each bone's matrix made once a pose (three's
// getVertexPosition makes them again for every point: too slow for
// thousands, eight poses over).
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
function posedPoints(o, into, out, every = 3) {
  const pos = o.geometry.attributes.position;
  if (!o.isSkinnedMesh) {
    _m.multiplyMatrices(into, o.matrixWorld);
    for (let i = 0; i < pos.count; i += every) {
      _p.fromBufferAttribute(pos, i).applyMatrix4(_m);
      out.push(_p.x, _p.y, _p.z);
    }
    return;
  }
  o.skeleton.update();
  const { boneMatrices, bones } = o.skeleton;
  // into × the mesh × its bind inverse × each bone × its bind
  const lead = new THREE.Matrix4().multiplyMatrices(into, o.matrixWorld).multiply(o.bindMatrixInverse);
  const mats = bones.map((_, j) => new THREE.Matrix4().fromArray(boneMatrices, j * 16).premultiply(lead).multiply(o.bindMatrix).elements);
  const idx = o.geometry.attributes.skinIndex;
  const wt = o.geometry.attributes.skinWeight;
  for (let i = 0; i < pos.count; i += every) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    let [sx, sy, sz] = [0, 0, 0];
    for (let k = 0; k < 4; k++) {
      const w = wt.getComponent(i, k);
      if (w === 0) continue;
      const e = mats[idx.getComponent(i, k)];
      sx += w * (e[0] * x + e[4] * y + e[8] * z + e[12]);
      sy += w * (e[1] * x + e[5] * y + e[9] * z + e[13]);
      sz += w * (e[2] * x + e[6] * y + e[10] * z + e[14]);
    }
    out.push(sx, sy, sz);
  }
}

// A figure sat on his seat in `frame` (his group's parent, the hull): his
// hips on it (CREW.hips high, whatever his size: a figure placed by his
// feet sits as high as his legs are long) and his head over its `x` (a sat
// clip leans him off it). Returns how far he'd have to shrink about his
// hips for every bit of him (hair, hat, gear), all the way through his sat
// clip (SEAT_POSES of it: Morty hunches, a Councillor sits up), to stay
// SEAT_ROOM inside the dome (1: he fits as he is), and where he is:
// { fit, at (his hips), pos, scale }.
const SEAT_POSES = 8;
function sitUnder(c, x, dome, frame) {
  frame.updateMatrixWorld(true);
  const into = frame.matrixWorld.clone().invert();
  const where = (name) => c.group.getObjectByName(name)?.getWorldPosition(new THREE.Vector3()).applyMatrix4(into) ?? null;
  const hips = where('Hips');
  const head = where('Head');
  const pts = [];
  const pose = () => {
    frame.updateMatrixWorld(true);
    c.group.traverse((o) => {
      if (!o.isMesh || o.userData.ink) return;
      posedPoints(o, into, pts);
    });
  };
  // his sat clip at SEAT_POSES times through it, and back where it was
  const mixer = c.anim?.mixer ?? c.mixer;
  const sat = Object.values(c.anim?.actions ?? c.act ?? {}).find((a) => a.getEffectiveWeight() > 0.5);
  if (mixer && sat) {
    const was = sat.time;
    for (let i = 0; i < SEAT_POSES; i++) {
      sat.time = (i / SEAT_POSES) * sat.getClip().duration;
      mixer.update(0);
      pose();
    }
    sat.time = was;
    mixer.update(0);
  } else pose();
  let from = head?.x;
  if (from == null && pts.length) {
    let [x0, x1] = [Infinity, -Infinity];
    for (let i = 0; i < pts.length; i += 3) [x0, x1] = [Math.min(x0, pts[i]), Math.max(x1, pts[i])];
    from = (x0 + x1) / 2;
  }
  const move = new THREE.Vector3(from == null ? 0 : x - from, hips ? CREW.hips - hips.y : 0, 0);
  c.group.position.add(move);
  for (let i = 0; i < pts.length; i += 3) [pts[i], pts[i + 1]] = [pts[i] + move.x, pts[i + 1] + move.y];
  const at = hips ? hips.add(move) : c.group.position.clone();
  const fit = pts.length ? fitScale(pts, at.toArray(), dome, { margin: SEAT_ROOM }) : 1;
  return { fit, at, pos: c.group.position.clone(), scale: c.group.scale.x };
}

// a soft round glow, for the thruster
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(235, 255, 200, 1)');
  g.addColorStop(0.3, 'rgba(150, 255, 110, 0.7)');
  g.addColorStop(1, 'rgba(90, 230, 70, 0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The cruiser itself, crew aboard: the saucer (its nose, the headlights,
// +z) TALL high and centred, Rick at the wheel and Morty beside him in their
// seated clips, the glass dome, the ink round everything and the exhaust
// cans' glow. Shared by the flight down this page and the universe map's
// cruiser. `ink` scales the outline's width, which is in the scene's units:
// a scene that draws the cruiser smaller passes its scale. update(t) breathes
// the crew and flickers the glow. Null if the saucer won't load.
// `crewInk`: the width of Rick and Morty's own line, in the saucer's units:
// as thick as this page's little canvas wants, and thinner where the
// cruiser's drawn big (the universe map's), or it's wider than a finger or
// the tip of a spike of Rick's hair and inks them over.
// `looks`: the wardrobe's (wardrobe/looks.js), as kept if none are given:
// Rick and Morty in their seats as you've dressed them.
// (`paint`: { createMeshyCast, inkHull, glassDome, dress }, ./cruiser3d.js's
// GLSL or ./cruiser3dNodes.js's nodes)
export const buildCruiserWith = (paint) => (opts) => buildCruiser(opts, paint);

async function buildCruiser({ ink = 1, crewInk = 0.026, looks = readLooks(local.get(LOOK_KEY)) } = {}, { createMeshyCast, inkHull, glassDome, dress }) {
  const cast = createMeshyCast(withWardrobe());
  // the walk only to turn the seated clip to face ahead (see meshyCast)
  const have = new Set(['saucer', 'rick', 'morty', bodyAsset(looks.rick), bodyAsset(looks.morty)]); // (the models loaded: a cast loads one again if asked)
  await cast.load(null, [...have], { clips: ['sit', 'walk'] });
  const body = cast.prop('saucer', TALL);
  if (!body) {
    cast.dispose();
    return null;
  }
  // the nose (its headlights) is +z; centred on the hull
  const hull = new THREE.Group();
  hull.position.y = -TALL / 2;
  hull.add(body);
  // the glass they sit under, in the hull's frame
  const dome = domeOf(glassPoints(body, hull));
  // Rick at the wheel, Morty beside him, sat looking ahead, as the wardrobe
  // has them: each { c (the figure), look, fit (sitUnder's, once he's sat),
  // off (takes his look and ink off) }
  const seats = {};
  let seatedOn = true;
  let gone = false;
  // the two shrunk alike, as little as the one who'd come through the
  // glass needs, so Rick stays a head taller than Morty (each about his
  // hips); shown once both are sat
  const share = () => {
    const sat = Object.values(seats).filter(Boolean);
    const ready = sat.every((s) => s.fit);
    const k = Math.min(1, ...sat.filter((s) => s.fit).map((s) => s.fit.fit));
    for (const { c, fit } of sat) {
      if (fit) {
        c.group.scale.setScalar(fit.scale * k);
        c.group.position.copy(fit.pos).sub(fit.at).multiplyScalar(k).add(fit.at);
      }
      c.group.visible = seatedOn && ready;
    }
  };
  const seat = (kind, look) => {
    const c = cast.make(bodyKind(look)) ?? cast.make(kind);
    if (!c) return null;
    const [tall, x] = CREW[kind];
    c.group.scale.setScalar(tall / c.height);
    c.group.position.set(x, CREW.y, CREW.z);
    const undress = dress(c, look);
    c.group.traverse((o) => (o.userData.noPaint = true)); // (a paint job on the universe map's cruiser is the hull's, not theirs)
    const inkMat = inkHull(c.group, crewInk * ink, { color: INK });
    hull.add(c.group);
    c.group.visible = false; // (till he's sat)
    const s = {
      c,
      look,
      fit: null,
      off() {
        undress();
        inkMat.dispose();
        c.group.removeFromParent();
      },
    };
    // sat in his seat on his own sat clip, there at once (his animator's
    // base; a body that borrows its sat clip from the library has it a
    // moment later), then fitted under the glass, his hat and gear on
    // (and posed so now, for a page that never moves its clock: reduced motion's)
    let sitting = null;
    if (c.base) {
      sitting = c.base('sit', { fade: 0 });
      c.update(0, 0, 0, { dt: 0.1 });
    } else for (const [n, a] of Object.entries(c.act ?? {})) a.setEffectiveWeight(n === 'sit' ? 1 : 0);
    Promise.resolve(sitting).then(() => {
      if (gone || seats[kind] !== s) return;
      s.fit = sitUnder(c, x, dome, hull);
      share();
    });
    return s;
  };
  for (const kind of ['rick', 'morty']) seats[kind] = seat(kind, looks[kind]);
  const crew = () => Object.values(seats).filter(Boolean).map((s) => s.c);
  let life = {}; // (crewLife's: the flask's clock, the last fright)
  let lastT = null;
  const rand = seeded(0xf1a5);
  let latest = looks; // (the newest looks asked for: an older ask still loading gives way)
  // the dome is glass: everything above the rim, in the mesh's own units
  const glassY = glassDome(body);
  const hullInk = inkHull(body, 0.036 * ink, { clipY: glassY, color: INK });
  // the exhaust cans' glow
  const glowTex = glowTexture();
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const glows = CANS.map((p) => {
    const g = new THREE.Sprite(glowMat);
    g.position.set(...p);
    hull.add(g);
    return g;
  });

  const ship = new THREE.Group();
  ship.rotation.order = 'YXZ';
  ship.add(hull);
  return {
    group: ship,
    engines: glows, // the exhaust cans, for a scene that draws their exhaust
    // the cans' glow in another colour (a paint job's), or its own green with null
    tint(color) {
      glowMat.color.set(color ?? '#ffffff');
    },
    // Rick and Morty in their seats (false: they've got out)
    seated(on) {
      seatedOn = on;
      share();
    },
    // the wardrobe's new looks: whoever's changed is sat down again in his,
    // the cruiser and the other one as they are (a new body's model loaded
    // first; nothing else is)
    async setLooks(next) {
      latest = next;
      for (const kind of ['rick', 'morty']) {
        const look = next?.[kind];
        const was = seats[kind];
        if (!look || (was && JSON.stringify(was.look) === JSON.stringify(look))) continue;
        const asset = bodyAsset(look);
        if (!have.has(asset)) {
          await cast.load(null, [asset], { clips: ['sit', 'walk'] }).catch(() => {});
          have.add(asset);
        }
        if (gone || next !== latest) return;
        was?.off();
        seats[kind] = seat(kind, look); // (both shrunk again once he's sat: a bigger hat may need it)
        share();
      }
    },
    // t: seconds; dive: how steeply it's going down (0…1), for Morty's nerves
    update(t, { dive = 0 } = {}) {
      const dt = lastT == null ? 0 : Math.min(0.1, Math.max(0, t - lastT));
      lastT = t;
      if (seatedOn) life = crewLife({ rick: seats.rick?.c, morty: seats.morty?.c }, life, t, dt, dive, rand);
      for (const c of crew()) {
        if (c.anim) c.update(t, 0, 0);
        else {
          c.mixer?.update(c.last == null ? 0 : Math.min(0.1, Math.max(0, t - c.last)));
          c.last = t;
        }
      }
      glowMat.opacity = 0.75 + Math.sin(t * 19) * 0.15;
      glows.forEach((g, i) => g.scale.setScalar(0.7 + Math.sin(t * 13 + i * 2) * 0.06));
    },
    dispose() {
      gone = true;
      for (const s of Object.values(seats)) s?.off();
      cast.dispose();
      hullInk.dispose();
      body.traverse((o) => o.userData.glass?.dispose());
      glowTex.dispose();
      glowMat.dispose();
    },
  };
}
