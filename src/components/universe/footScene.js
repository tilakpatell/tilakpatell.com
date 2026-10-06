// On foot, drawn and run: the ship comes down on a planet, its crew step out
// (Rick and Morty, Walt and Jesse, Chewie and Han, Luke and Artoo), and you
// walk them about on the ground, shoot it out with the Federation's squads
// that come over the horizon, and get back in and take off again. foot.js
// has the rules; this has the people, the ground under them and the camera
// behind them, all in the map's space.
//
// The people: Rick, Morty and the Federation's troops are the Portal panic
// cast (rickmorty/portal/meshyCast.js), with their own clips; Walt, Jesse,
// Chewie, Han and Luke are the site's Meshy figures (Albuquerque's, the
// cockpits', the galaxy's: scripts/meshy-galaxy.mjs), walking and running on
// Rick's clips (one skeleton for every Meshy figure); Artoo, who has no
// figure here, is built from shapes (and anyone whose model won't load). Each
// holds the gun they'd carry (gunplay.js: built in code, set in the hand,
// brought up and aimed with the arms, chest and head, kicking when fired).
//
// The ground: the planets are drawn as spheres with a map, which up close is
// a blur. Round where you are, a patch of ground takes over: the same map,
// with the planet's turn held while you're down, and fine detail over it
// (grit, stones, rocks to walk round), and the air of the planet in its
// colour along the horizon, by day. A station (the Death Star: `plated` in
// universes.js) is hull plating instead, panels and seams and vents and the
// odd lit window, with blocks and towers standing on it for rocks, and no
// air; and where it has a trench round its middle, the ship comes down by
// it (foot.js byTrench), the ground stops at its rim, and its walls go down
// to where the trench run's own (trench.js) take over. Down there the
// station's own model, which has its trench painted on rather than cut
// into it, isn't drawn: the patch reaches past the horizon.
//
// Other pilots' crews down on the same planet (multiplayer: the scene hands
// them in each frame, guests()) walk about with yours, a tag over each with
// who they are and whose crew; and where two of a person meet (your Rick
// and theirs, or two pilots' Walts) the other one is that person from
// another dimension: their dimension's code on the tag (dimensionOf, from
// their pilot) and a tint of its own. crew() is yours, for sending.
//
// Each planet's own ground, sky and things round where you come down are
// its landing's (landings/: the Shire on Middle-earth's, the desert and the
// RV on Breaking Bad's, the Smiths' street on C-137's), and the place's name
// comes up as you land (an 'arrive' event).
//
// createFoot({ map, emit, reduced, small, planetOf, renderer, warm }) → { phase, begin(...),
//   update(dt, t, input), view(dt) → camera, fire(), cycle(), swap(),
//   board(), look(dx, dy), first(), aimPoint(), info(), crew(),
//   guests(list), end(), dispose() }

import * as THREE from 'three';
import { gltfLoader } from '../../lib/three/gltf';
import { sharpen } from '../../lib/three/textures';
import { createMeshyCast } from '../rickmorty/portal/meshyCast';
import { LOOK_KEY, readLooks } from '../rickmorty/wardrobe/looks';
import { bodyAsset, bodyKind, dress, withWardrobe } from '../rickmorty/wardrobe/wear';
import { local } from '../../lib/hooks';
import { smoothNormals } from '../cockpit/crew';
import { GUNS, buildGun, createGunplay } from './gunplay';
import { createGunFx } from './gunfx';
import { createLocomotion, fallTurn } from './locomotion';
import { frameFrom, spring } from '../../lib/three/ik';
import { FOOT, METRE, PARKED, TROOPS, aimAt, apart, at, bearing, bolt as makeBolt, byTrench, facingAlong, fly as flyBolt, inTrench, landingSpot, march, offset, person, rightOf, squad, turnToward, vec, walk } from './foot';
import { TRENCH_MODEL, trenchOf } from './deep';
import { POSITIONS } from './layout';
import { byId } from './universes';
import { landingOf } from './landings/landings';
import { styleOf } from './landings/ground';
import { createSky } from './landings/sky';
import { furnish, furnished } from './landings/furnish';

const V = THREE.Vector3;
const arr = (v) => [v.x, v.y, v.z];
const smooth = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

// who steps out of each ship: the one you play first, and who comes along
// (tall in metres; src: a Portal panic figure, a model of the site's, or
// one built here; the gun they carry (gunplay.js's GUNS), and the colour of
// its bolts)
export const PARTY = {
  cruiser: [
    { id: 'rick', name: 'Rick', tall: 1.88, src: { meshy: 'rick' }, gun: 'portal', bolt: '#8dff5a' },
    { id: 'morty', name: 'Morty', tall: 1.6, src: { meshy: 'morty' }, gun: 'laser', bolt: '#8dff5a' },
  ],
  rv: [
    { id: 'walt', name: 'Walt', tall: 1.79, src: { url: '/models/albuquerque/walt.glb' }, gun: 'revolver', bolt: '#ffd36b' },
    { id: 'jesse', name: 'Jesse', tall: 1.73, src: { url: '/models/albuquerque/jesse.glb' }, gun: 'pistol', bolt: '#ffd36b' },
  ],
  falcon: [
    { id: 'chewie', name: 'Chewie', tall: 2.28, src: { url: '/models/cockpit/chewie.glb' }, gun: 'bowcaster', bolt: '#ff4a3d' },
    { id: 'han', name: 'Han', tall: 1.85, src: { url: '/models/galaxy/crew/han.glb' }, gun: 'blaster', bolt: '#ff4a3d' },
  ],
  xwing: [
    { id: 'luke', name: 'Luke', tall: 1.72, src: { url: '/models/galaxy/crew/luke.glb' }, gun: 'blaster', bolt: '#ff3b30' },
    { id: 'artoo', name: 'Artoo', tall: 1.09, src: { built: 'artoo' }, gun: null, bolt: null },
  ],
};
const TROOP_BOLT = '#62c8ff';
const SPEC = Object.fromEntries(Object.values(PARTY).flat().map((s) => [s.id, s])); // everyone, by id
const GUEST_FAR = 90; // metres: no tag on someone further off than this

// the dimension a pilot's crew come from: a code of its own, made from the
// pilot's id (the same for everyone who meets them), and a hue to go with it
const GREEK = 'αβγδεζηθκλμξπστφχψω';
export function dimensionOf(id) {
  let h = 2166136261;
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h >>>= 0;
  const code = `${String.fromCharCode(65 + (h % 26))}-${10 + ((h >>> 5) % 290)}${GREEK[(h >>> 14) % GREEK.length]}${(h >>> 19) % 10}`;
  return { code, hue: ((h >>> 9) % 360) / 360 };
}
const LAND = { down: 3.4, out: 1.3, board: 0.8, lift: 2.4, fall: 2.6 }; // seconds
const CAM = { dist: 3.4, up: 0.55, pitch: [-0.25, 0.75], look: 1.6 }; // metres, radians

// ── Loading the people ──

const getLoader = () => gltfLoader();

// Rick's clips, for every Meshy figure without its own: the bones' turns,
// and the hips' height scaled to the figure's (no other bone's length)
let rickClips = null;
const borrowClips = () => {
  if (!rickClips) {
    rickClips = Promise.all(['idle', 'walk', 'run'].map((c) => getLoader().loadAsync(`/games/meshy/rick-${c}.glb`).then((g) => g.animations[0] ?? null, () => null))).then(([idle, walk, run]) => ({ idle, walk, run }));
  }
  return rickClips;
};
const RICK_HIPS = 90.233;
function retarget(clip, hipsY) {
  if (!clip) return null;
  const k = hipsY / RICK_HIPS;
  const tracks = [];
  for (const tr of clip.tracks) {
    if (/\.quaternion$/.test(tr.name)) tracks.push(tr.clone());
    else if (/^Hips\.position$/.test(tr.name)) {
      const t = tr.clone();
      for (let i = 0; i < t.values.length; i++) t.values[i] *= k;
      tracks.push(t);
    }
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}
// Meshy's idle stands turned off to one side: turn a clip's hips about the
// up axis so its mean heading matches the walk's (as meshyCast does)
const hipsTrack = (clip) => clip?.tracks.find((t) => /^hips\.quaternion$/i.test(t.name));
function headingOf(clip, up) {
  const v = hipsTrack(clip)?.values;
  if (!v) return null;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < v.length; i += 4) {
    const a = 2 * Math.atan2(v[i] * up.x + v[i + 1] * up.y + v[i + 2] * up.z, v[i + 3]);
    sx += Math.cos(a);
    sy += Math.sin(a);
  }
  return Math.atan2(sy, sx);
}
function faceForward(clip, up, target) {
  const v = hipsTrack(clip)?.values;
  const now = headingOf(clip, up);
  if (!v || now == null) return;
  const fix = new THREE.Quaternion().setFromAxisAngle(up, target - now);
  const q = new THREE.Quaternion();
  for (let i = 0; i < v.length; i += 4) {
    q.set(v[i], v[i + 1], v[i + 2], v[i + 3]).premultiply(fix);
    v[i] = q.x;
    v[i + 1] = q.y;
    v[i + 2] = q.z;
    v[i + 3] = q.w;
  }
}

// idle, walking and running by how fast (move 0…1)
function blend(act, move) {
  const run = smooth(0.55, 0.9, move);
  const idle = 1 - smooth(0.04, 0.3, move);
  const w = Math.max(0, 1 - run - idle);
  act.idle?.setEffectiveWeight(idle);
  act.walk?.setEffectiveWeight(w);
  act.run?.setEffectiveWeight(run);
  const pace = 0.8 + move * 0.4;
  if (act.walk) act.walk.timeScale = pace;
  if (act.run) act.run.timeScale = pace;
}

// a rigged figure: { model (feet on y = 0, facing +z, `tall` metres in map
// units), bones, update(dt, move, motion?), after(dt, motion, frame), loco,
// dispose }. With `motion` (locomotion.js: how fast it's going which way,
// turning, in the air, hit, going down) its clips are paced to the ground
// and posed on top by `after`, once it's placed; without, they play at the
// old pace (the galaxy's worlds, until they hand it over too).
function rigged(model, clips, tall, owned) {
  const bones = {};
  model.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
  });
  // how tall it stands, from its skeleton at rest: the top of the head to the toes
  model.updateMatrixWorld(true);
  const y = (n) => bones[n]?.getWorldPosition(new V()).y;
  const top = y('head_end') ?? y('Head');
  const toes = Math.min(y('LeftToeBase') ?? 0, y('RightToeBase') ?? 0);
  const box = new THREE.Box3().setFromObject(model);
  const height = top != null ? top - toes : box.getSize(new V()).y;
  const k = (tall * METRE) / Math.max(height, 1e-6);
  model.scale.multiplyScalar(k);
  model.position.y -= (top != null ? toes : box.min.y) * k;
  const mixer = new THREE.AnimationMixer(model);
  const act = {};
  for (const [name, clip] of Object.entries(clips)) {
    if (!clip) continue;
    const a = mixer.clipAction(clip);
    a.play();
    a.setEffectiveWeight(name === 'idle' ? 1 : 0);
    a.time = Math.random() * clip.duration;
    act[name] = a;
  }
  const loco = createLocomotion({ model, bones }, { mixer, act, root: model, unit: METRE });
  return {
    model,
    bones,
    loco,
    mixer,
    act,
    update(dt, move, motion) {
      if (motion) loco.update(dt, { move, ...motion });
      else blend(act, move);
      mixer.update(dt);
    },
    after: (dt, motion, frame) => loco.after(dt, motion, frame),
    dispose() {
      mixer.stopAllAction();
      for (const o of owned) o?.dispose?.();
    },
  };
}

// the wardrobe's look for the cruiser's Rick or Morty (as kept, or as given)
const WEARS = new Set(['rick', 'morty']);
const HAND_GUNS = { portalgun: 'portal', laserpistol: 'laser' }; // the wardrobe's hand gear that's a gun on foot
async function loadModel(spec, cast, looks = null) {
  if (spec.src.meshy) {
    const look = WEARS.has(spec.src.meshy) ? (looks ?? readLooks(local.get(LOOK_KEY)))[spec.src.meshy] : null;
    let c = null;
    if (look) {
      const asset = bodyAsset(look);
      if (asset !== spec.src.meshy) await cast.load(null, [asset]).catch(() => {});
      c = cast.make(bodyKind(look));
    }
    c ??= cast.make(spec.src.meshy);
    if (!c) return null;
    // (on foot they carry a gun of their own, gunplay.js's: the look's
    // portal gun or laser pistol is that gun, held and fired; anything else
    // in the hand stays in the wardrobe)
    const gun = HAND_GUNS[look?.gear?.hand] ?? null;
    const undress = look ? dress(c, spec.gun ? { ...look, gear: { ...look.gear, hand: 'none' } } : look) : () => {};
    // the cast stands c.height tall in its own units: to metres, in map units
    c.group.scale.setScalar((spec.tall * METRE) / c.height);
    const bones = {};
    c.group.traverse((o) => {
      if (o.isBone) bones[o.name] = o;
    });
    const loco = c.mixer ? createLocomotion({ model: c.group, bones }, { mixer: c.mixer, act: c.act, root: c.group, unit: METRE }) : null;
    return {
      model: c.group,
      bones,
      loco,
      mixer: c.mixer ?? null,
      act: c.act ?? null,
      update(dt, move, motion) {
        if (!c.mixer) return;
        if (motion) loco.update(dt, { move, ...motion });
        else blend(c.act, move);
        c.mixer.update(dt);
      },
      after: (dt, motion, frame) => loco?.after(dt, motion, frame),
      gun,
      dispose: undress,
    };
  }
  if (spec.src.url) {
    const [gltf, clips] = await Promise.all([getLoader().loadAsync(spec.src.url), borrowClips()]);
    const model = gltf.scene;
    const owned = [];
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false; // a skinned mesh's bounds don't follow its pose
      const m = o.material;
      if (m) {
        // Meshy's colours carry their own shading: keep them matte
        m.roughness = 0.85;
        m.metalness = 0;
        owned.push(m, m.map);
      }
      smoothNormals(o.geometry);
      owned.push(o.geometry);
    });
    const hips = model.getObjectByName('Hips');
    const hipsY = hips?.position.y ?? RICK_HIPS;
    const own = { idle: retarget(clips.idle, hipsY), walk: retarget(clips.walk, hipsY), run: retarget(clips.run, hipsY) };
    if (hips?.parent && own.walk) {
      const up = new V(0, 1, 0).applyQuaternion(hips.parent.getWorldQuaternion(new THREE.Quaternion()).invert());
      const ahead = headingOf(own.walk, up);
      if (ahead != null) for (const n of ['idle', 'run']) if (own[n]) faceForward(own[n], up, ahead);
    }
    return rigged(model, own, spec.tall, owned);
  }
  return built(spec);
}

// ── People built from shapes (no figure of their own) ──

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...extra });
function built(spec) {
  const owned = [];
  const mat = (c, extra) => {
    const m = std(c, extra);
    owned.push(m);
    return m;
  };
  const geo = (g) => {
    owned.push(g);
    return g;
  };
  const model = new THREE.Group();
  const s = spec.tall * METRE; // everything below in shares of their height
  if (spec.src.built === 'artoo') {
    // a white barrel with blue panels, a silver dome, a leg each side and a third under him
    const white = mat('#e9edf2');
    const blue = mat('#2f62c9');
    const silver = mat('#c9ced6', { metalness: 0.6, roughness: 0.35 });
    const body = new THREE.Group();
    const barrel = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.2, 0.19, 0.5, 20)), white);
    barrel.position.y = 0.55;
    body.add(barrel);
    for (const [a, h] of [
      [0, 0.12],
      [0.5, 0.2],
      [-0.6, 0.16],
    ]) {
      const p = new THREE.Mesh(geo(new THREE.BoxGeometry(0.08, h, 0.02)), blue);
      p.position.set(Math.sin(a) * 0.2, 0.55 + (h - 0.15) * 0.3, Math.cos(a) * 0.2);
      p.rotation.y = a;
      body.add(p);
    }
    const dome = new THREE.Mesh(geo(new THREE.SphereGeometry(0.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), silver);
    dome.position.y = 0.8;
    body.add(dome);
    const eye = new THREE.Mesh(geo(new THREE.SphereGeometry(0.035, 10, 8)), mat('#111', { emissive: new THREE.Color('#ff3030'), emissiveIntensity: 2 }));
    eye.position.set(0, 0.9, 0.17);
    body.add(eye);
    for (const x of [-0.24, 0.24]) {
      const leg = new THREE.Mesh(geo(new THREE.BoxGeometry(0.07, 0.62, 0.12)), white);
      leg.position.set(x, 0.38, -0.02);
      leg.rotation.x = 0.12;
      model.add(leg);
      const foot = new THREE.Mesh(geo(new THREE.BoxGeometry(0.1, 0.06, 0.2)), blue);
      foot.position.set(x, 0.03, 0.02);
      model.add(foot);
    }
    model.add(body);
    model.scale.setScalar(s / 0.98);
    let t = 0;
    return {
      model,
      bones: {},
      hand: null,
      update(dt, move) {
        t += dt;
        body.rotation.z = Math.sin(t * 9) * 0.05 * move; // he rocks as he rolls
        dome.rotation.y = Math.sin(t * 0.7) * 0.9;
      },
      dispose() {
        for (const o of owned) o.dispose();
      },
    };
  }
  // a person: legs, a body, arms that swing, a head; the groups named as
  // Meshy's bones are (Spine, Head, RightArm, RightForeArm, RightHand…) so
  // gunplay.js poses them the same way
  const look =
    spec.src.built === 'luke'
      ? { suit: '#e8742a', top: '#e8742a', legs: '#e8742a', boots: '#2a2622', skin: '#f0c7a5', hair: '#e9edf2', helmet: true, vest: '#f2f2ee' }
      : { suit: '#f3f1ea', top: '#f3f1ea', legs: '#1d2a44', boots: '#2b1d14', skin: '#e9be98', hair: '#5a3a22', helmet: false, vest: '#151515' };
  const limb = (r, l, m) => {
    const g = geo(new THREE.CapsuleGeometry(r, l, 4, 10));
    g.translate(0, -l / 2 - r * 0.5, 0); // hangs from its joint
    return new THREE.Mesh(g, m);
  };
  const legs = [];
  for (const x of [-0.075, 0.075]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.52, 0);
    const thigh = limb(0.055, 0.2, mat(look.legs));
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.26;
    const shin = limb(0.048, 0.2, mat(look.legs));
    knee.add(shin);
    const boot = new THREE.Mesh(geo(new THREE.BoxGeometry(0.1, 0.07, 0.17)), mat(look.boots));
    boot.position.set(0, -0.26, 0.03);
    knee.add(boot);
    hip.add(knee);
    model.add(hip);
    legs.push({ hip, knee });
  }
  // the upper body turns at the waist
  const WAIST = 0.58;
  const spine = new THREE.Group();
  spine.name = 'Spine';
  spine.position.y = WAIST;
  model.add(spine);
  const torso = new THREE.Mesh(geo(new THREE.CapsuleGeometry(0.13, 0.22, 4, 12)), mat(look.top));
  torso.position.y = 0.72 - WAIST;
  torso.scale.set(1, 1, 0.72);
  spine.add(torso);
  const vest = new THREE.Mesh(geo(new THREE.CapsuleGeometry(0.135, 0.16, 4, 12)), mat(look.vest));
  vest.position.y = 0.75 - WAIST;
  vest.scale.set(1.02, 1, 0.76);
  if (spec.src.built !== 'han') vest.scale.set(1.03, 0.75, 0.77); // Luke's harness: a white vest over the flight suit
  spine.add(vest);
  const headG = new THREE.Group();
  headG.name = 'Head';
  headG.position.y = 0.99 - WAIST;
  spine.add(headG);
  const head = new THREE.Mesh(geo(new THREE.SphereGeometry(0.095, 16, 12)), mat(look.skin));
  headG.add(head);
  const hair = new THREE.Mesh(geo(new THREE.SphereGeometry(look.helmet ? 0.112 : 0.1, 16, 10, 0, Math.PI * 2, 0, look.helmet ? Math.PI * 0.62 : Math.PI * 0.45)), mat(look.hair, look.helmet ? { roughness: 0.4 } : {}));
  hair.position.set(0, 0.01, look.helmet ? 0 : -0.012);
  headG.add(hair);
  if (look.helmet) {
    const visor = new THREE.Mesh(geo(new THREE.BoxGeometry(0.15, 0.035, 0.03)), mat('#2a3340', { roughness: 0.2, metalness: 0.5 }));
    visor.position.set(0, 0.06, 0.1);
    headG.add(visor);
  }
  const arms = [];
  for (const [x, side] of [
    [-0.165, 'Right'], // (facing +z, the figure's right is −x)
    [0.165, 'Left'],
  ]) {
    const shoulder = new THREE.Group();
    shoulder.name = `${side}Arm`;
    shoulder.position.set(x, 0.9 - WAIST, 0);
    shoulder.add(limb(0.042, 0.17, mat(look.suit)));
    const elbow = new THREE.Group();
    elbow.name = `${side}ForeArm`;
    elbow.position.y = -0.23;
    elbow.add(limb(0.038, 0.15, mat(look.suit)));
    const wrist = new THREE.Group();
    wrist.name = `${side}Hand`;
    wrist.position.y = -0.19;
    const hand = new THREE.Mesh(geo(new THREE.SphereGeometry(0.04, 10, 8)), mat(look.skin));
    hand.position.y = -0.03;
    wrist.add(hand);
    elbow.add(wrist);
    shoulder.add(elbow);
    spine.add(shoulder);
    arms.push({ shoulder, elbow, wrist, hand });
  }
  model.scale.setScalar(s / 1.1);
  const bones = { Hips: model, Spine: spine, Head: headG, RightArm: arms[0].shoulder, RightForeArm: arms[0].elbow, RightHand: arms[0].wrist, LeftArm: arms[1].shoulder, LeftForeArm: arms[1].elbow, LeftHand: arms[1].wrist };
  let phase = 0;
  return {
    model,
    bones,
    built: true,
    // the right hand
    hand: arms[0].hand,
    update(dt, move) {
      phase += dt * (3 + move * 7);
      const swing = Math.sin(phase) * (0.15 + move * 0.55) * Math.min(1, move * 6);
      // (every turn set whole, each frame: gunplay.js and locomotion.js turn
      // these groups too, and a turn left over would add up)
      legs[0].hip.rotation.set(swing, 0, 0);
      legs[1].hip.rotation.set(-swing, 0, 0);
      legs[0].knee.rotation.set(Math.max(0, -Math.sin(phase + 0.6)) * move * 0.9, 0, 0);
      legs[1].knee.rotation.set(Math.max(0, Math.sin(phase + 0.6)) * move * 0.9, 0, 0);
      spine.rotation.set(0, 0, 0);
      headG.rotation.set(0, 0, 0);
      // the arms swing against the legs (gunplay.js brings the gun arm up over this)
      arms[0].shoulder.rotation.set(-swing * 0.8, 0, 0);
      arms[1].shoulder.rotation.set(swing * 0.8, 0, 0);
      arms[0].elbow.rotation.set(-0.25, 0, 0);
      arms[1].elbow.rotation.set(-0.25, 0, 0);
      arms[0].wrist.rotation.set(0, 0, 0);
      arms[1].wrist.rotation.set(0, 0, 0);
      torso.position.y = 0.72 - WAIST + Math.abs(Math.sin(phase)) * 0.012 * move;
    },
    dispose() {
      for (const o of owned) o.dispose();
    },
  };
}

// ── Your hands, out of your own eyes ──

// what each of the crew's forearms and hands look like from behind the gun:
// a sleeve (or bare skin, or fur) and a hand (or a glove)
const VIEW_ARMS = {
  rick: { sleeve: '#e6e9ea', cuff: '#9fd2e6', hand: '#f0d8c8' }, // the lab coat over the blue shirt
  morty: { sleeve: null, hand: '#f4d1b4' }, // bare arms under the T-shirt
  walt: { sleeve: '#d9c12a', hand: '#1a1a1c' }, // the yellow suit, black gloves
  jesse: { sleeve: '#a8331f', hand: '#e6b590' }, // the red hoodie
  chewie: { sleeve: '#7b5428', hand: '#5c3f24', fur: true },
  han: { sleeve: '#efede6', hand: '#dfae88' },
  luke: { sleeve: '#c9c3b8', hand: '#dfae88' }, // the farmboy's tunic, bare hands
};
// The forearms and hands for a gun seen out of your own eyes, built in the
// gun's frame (metres; +z its muzzle, +y its sights, −x its right) so they
// move with it: the gun hand round the grip, its forearm going back and
// down out of the view to the right; and the other hand on the foregrip of
// a long gun or cupping the gun hand on a pistol, its arm out to the left.
function viewArms(gun, spec, look, owned) {
  const mat = (c, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: look.fur ? 0.95 : 0.78, metalness: 0, ...extra });
    owned.push(m);
    return m;
  };
  const skin = mat(look.hand);
  const sleeve = look.sleeve ? mat(look.sleeve) : skin;
  const cuff = look.cuff ? mat(look.cuff) : null;
  const add = (geo, m, at, toward = null) => {
    owned.push(geo);
    const o = new THREE.Mesh(geo, m);
    o.position.set(...at);
    if (toward) o.quaternion.setFromUnitVectors(new V(0, 1, 0), new V(...toward).normalize());
    o.castShadow = false;
    o.frustumCulled = false;
    gun.add(o);
    return o;
  };
  // a hand: a fist round a grip at `at` (the knuckles to `side`, + its left)
  const fist = (at, side, wide = 1) => {
    const f = add(new THREE.SphereGeometry(0.042, 12, 10).scale(0.9 * wide, 1.25, 1.05), skin, at);
    add(new THREE.CapsuleGeometry(0.012, 0.035, 4, 8), skin, [at[0] + side * 0.028, at[1] + 0.03, at[2] + 0.02], [0, 0.4, 1]); // the thumb, along the gun
    return f;
  };
  // a forearm from the wrist at `from`, back the way `back` points, out of the view
  const forearm = (from, back) => {
    const d = new V(...back).normalize();
    const len = 0.32;
    const mid = new V(...from).addScaledVector(d, len / 2 + 0.03);
    add(new THREE.CapsuleGeometry(look.fur ? 0.05 : 0.04, len, 6, 12), sleeve, mid.toArray(), d.toArray());
    if (cuff) add(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 12), cuff, new V(...from).addScaledVector(d, 0.04).toArray(), d.toArray());
    else if (!look.sleeve) add(new THREE.CapsuleGeometry(0.034, 0.05, 4, 10), skin, new V(...from).addScaledVector(d, 0.04).toArray(), d.toArray()); // a wrist
  };
  // the gun hand, round the grip (just under the gun's origin), its arm back, down and out right
  fist([0, -0.03, -0.01], 1);
  forearm([-0.005, -0.06, -0.04], [-0.35, -0.55, -1]);
  if (spec.hands === 2 && gun.getObjectByName('foregrip')) {
    const fg = gun.getObjectByName('foregrip').position;
    fist([fg.x, fg.y - 0.015, fg.z], -1, 1.05);
    forearm([fg.x + 0.01, fg.y - 0.05, fg.z - 0.03], [0.55, -0.6, -1]);
  } else if (spec.support) {
    // cupping the gun hand from below and the left
    fist([0.03, -0.06, 0.0], -1, 0.95);
    forearm([0.04, -0.09, -0.02], [0.6, -0.55, -1]);
  }
}

// ── The ground round you ──

const NOISE_N = 256;
let noiseTex = null;
function noiseTexture() {
  if (noiseTex) return noiseTex;
  // a tiling value noise, a few octaves, for grit and stones
  const N = NOISE_N;
  let seed = 9;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const grid = (p) => {
    const g = new Float32Array(p * p);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    return (x, y) => {
      const x0 = Math.floor(x) % p;
      const y0 = Math.floor(y) % p;
      const x1 = (x0 + 1) % p;
      const y1 = (y0 + 1) % p;
      const fx = x - Math.floor(x);
      const fy = y - Math.floor(y);
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const a = g[y0 * p + x0] + (g[y0 * p + x1] - g[y0 * p + x0]) * sx;
      const b = g[y1 * p + x0] + (g[y1 * p + x1] - g[y1 * p + x0]) * sx;
      return a + (b - a) * sy;
    };
  };
  const octaves = [8, 16, 32, 64, 128].map((p) => [p, grid(p)]);
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let v = 0;
      let amp = 0.5;
      let sum = 0;
      for (const [p, f] of octaves) {
        v += f((x / N) * p, (y / N) * p) * amp;
        sum += amp;
        amp *= 0.55;
      }
      v /= sum;
      // pebbles: dark specks where the finest octave peaks
      const fine = octaves[4][1]((x / N) * 128, (y / N) * 128);
      const speck = fine > 0.82 ? 0.55 : 1;
      const c = Math.round(Math.min(255, Math.max(0, (v * 1.25 - 0.12) * speck * 255)));
      data.set([c, c, c, 255], (y * N + x) * 4);
    }
  }
  noiseTex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
  noiseTex.magFilter = THREE.LinearFilter;
  noiseTex.minFilter = THREE.LinearMipmapLinearFilter;
  noiseTex.generateMipmaps = true;
  sharpen(noiseTex);
  noiseTex.needsUpdate = true;
  return noiseTex;
}

// A station's hull plating, tiling: panels of a few sizes packed on a grid
// (seams between them), some with a plate inset, some vents, some greebles,
// and here and there a lit window. r: height (for the bump), g: shade, b:
// light
const PLATE_N = 512;
let plateTex = null;
function platingTexture() {
  if (plateTex) return plateTex;
  const N = PLATE_N;
  const CELLS = 16;
  const C = N / CELLS;
  let seed = 17;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const hgt = new Float32Array(N * N);
  const shade = new Float32Array(N * N);
  const glow = new Float32Array(N * N);
  const fill = (x0, y0, w, h, f) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) f(y * N + x, x - x0, y - y0);
  };
  const used = new Uint8Array(CELLS * CELLS);
  const sizes = [
    [1, 1],
    [2, 1],
    [1, 2],
    [2, 2],
    [3, 2],
    [2, 3],
    [4, 2],
    [4, 4],
  ];
  for (let cy = 0; cy < CELLS; cy++) {
    for (let cx = 0; cx < CELLS; cx++) {
      if (used[cy * CELLS + cx]) continue;
      // the biggest of a random pick that fits here
      let [w, h] = sizes[Math.floor(rand() ** 1.4 * sizes.length)];
      const fits = (w, h) => {
        if (cx + w > CELLS || cy + h > CELLS) return false;
        for (let y = cy; y < cy + h; y++) for (let x = cx; x < cx + w; x++) if (used[y * CELLS + x]) return false;
        return true;
      };
      while (!fits(w, h)) {
        if (w >= h && w > 1) w--;
        else h--;
      }
      for (let y = cy; y < cy + h; y++) for (let x = cx; x < cx + w; x++) used[y * CELLS + x] = 1;
      const X = cx * C;
      const Y = cy * C;
      const W = w * C;
      const H = h * C;
      const base = 0.5 + rand() * 0.18;
      const tone = rand() < 0.12 ? 0.62 + rand() * 0.1 : 0.84 + rand() * 0.24;
      fill(X, Y, W, H, (i) => {
        hgt[i] = base;
        shade[i] = tone;
      });
      const kind = rand();
      if (kind < 0.16) {
        // a plate inset, raised, with its own seam
        const m = Math.round(C * 0.18);
        fill(X + m, Y + m, W - 2 * m, H - 2 * m, (i, x, y) => {
          const edge = x < 2 || y < 2 || x >= W - 2 * m - 2 || y >= H - 2 * m - 2;
          hgt[i] = edge ? base - 0.12 : base + 0.1;
          shade[i] = edge ? tone * 0.7 : tone * 1.04;
        });
      } else if (kind < 0.3) {
        // a vent: grooves across it
        const across = W >= H;
        const m = Math.round(C * 0.22);
        fill(X + m, Y + m, W - 2 * m, H - 2 * m, (i, x, y) => {
          const k = (across ? x : y) % 6 < 2;
          hgt[i] = k ? base - 0.2 : base;
          shade[i] = tone * (k ? 0.55 : 0.92);
        });
      } else if (kind < 0.4) {
        // greebles: little boxes standing on it
        const n = 2 + Math.floor(rand() * 5);
        for (let j = 0; j < n; j++) {
          const bw = 3 + Math.floor(rand() * C * 0.4);
          const bh = 3 + Math.floor(rand() * C * 0.4);
          const bx = X + 3 + Math.floor(rand() * Math.max(1, W - bw - 6));
          const by = Y + 3 + Math.floor(rand() * Math.max(1, H - bh - 6));
          const up = base + 0.1 + rand() * 0.25;
          const t2 = tone * (0.75 + rand() * 0.35);
          fill(bx, by, bw, bh, (i) => {
            hgt[i] = up;
            shade[i] = t2;
          });
        }
      } else if (kind < 0.46) {
        // a lit window or two: a strip, dark round it
        const lw = Math.max(4, Math.round(W * (0.3 + rand() * 0.4)));
        const lh = 3 + Math.floor(rand() * 3);
        const lx = X + Math.floor((W - lw) / 2);
        const ly = Y + Math.floor(H * (0.25 + rand() * 0.5));
        fill(lx - 2, ly - 2, lw + 4, lh + 4, (i) => {
          hgt[i] = base - 0.08;
          shade[i] = 0.3;
        });
        if (rand() < 0.7) fill(lx, ly, lw, lh, (i) => (glow[i] = 1));
      }
      // the seams round it
      fill(X, Y, W, H, (i, x, y) => {
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) {
          hgt[i] = 0.12;
          shade[i] = 0.45;
        } else if (x < 2 || y < 2) shade[i] *= 1.08; // (a lit edge)
      });
    }
  }
  const data = new Uint8Array(N * N * 4);
  const to8 = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  for (let i = 0; i < N * N; i++) data.set([to8(hgt[i]), to8(shade[i] * 0.8), to8(glow[i]), 255], i * 4);
  plateTex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  plateTex.wrapS = plateTex.wrapT = THREE.RepeatWrapping;
  plateTex.magFilter = THREE.LinearFilter;
  plateTex.minFilter = THREE.LinearMipmapLinearFilter;
  plateTex.generateMipmaps = true;
  sharpen(plateTex);
  plateTex.needsUpdate = true;
  return plateTex;
}

// (in a shader with the plating as its bumpMap: its shade on diffuseColor,
// a second, bigger lay of it for blocks of a different grey, and its lit
// windows, brighter by night)
const PLATE_DETAIL = `
          vec4 pl = texture2D(bumpMap, vBumpMapUv);
          float blocks = texture2D(bumpMap, vBumpMapUv * 0.137 + 0.29).g;
          float detail = pl.g * 1.25 * (0.86 + 0.28 * blocks);`;
const PLATE_GLOW = `
          totalEmissiveRadiance += vec3(1.0, 0.86, 0.62) * texture2D(bumpMap, vBumpMapUv).b * 1.4;`;

// The patch reaches past the horizon (on a station, much further: its model
// isn't drawn while you're down, so there's nothing past the patch's edge)
const PATCH = { radius: 110 * METRE, rings: 46, segs: 72, lift: 0.025 * METRE, tile: 9 };
const HULL_PATCH = { ...PATCH, radius: 900 * METRE, rings: 64, segs: 96, tile: 32 };

// `trench`: the trench's rim (footScene's band: { half, home, arc }), if the
// ground stops at one; `look`: a landing's ground (landings.js: its style
// and colours), the planet's own up close
function createGround(planet, u, R, trench = null, look = null) {
  const plated = Boolean(u.plated);
  const P = plated ? HULL_PATCH : PATCH;
  const style = plated ? null : styleOf(look);
  const g = new THREE.BufferGeometry();
  const count = (P.rings + 1) * P.segs;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const edge = new Float32Array(count);
  const idx = [];
  for (let i = 0; i < P.rings; i++) {
    for (let j = 0; j < P.segs; j++) {
      const a = i * P.segs + j;
      const b = i * P.segs + ((j + 1) % P.segs);
      const c = a + P.segs;
      const d = b + P.segs;
      idx.push(a, c, b, b, c, d);
    }
  }
  g.setIndex(idx);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1));
  // (a station's own grey, not its map: up close the map's a blur of its
  // painted trench and dish)
  const body = plated ? null : (planet.body?.material ?? null);
  const tint = new THREE.Color(plated ? (u.palette?.base ?? '#8d939c') : (body?.color ?? u.palette?.base ?? '#888888'));
  if (plated) tint.lerp(new THREE.Color(u.palette?.light ?? '#c9ced6'), 0.25);
  const uniforms = {
    uPlanet: { value: body?.map ?? null },
    uHasMap: { value: body?.map ? 1 : 0 },
    uToBody: { value: new THREE.Matrix3() },
    uTint: { value: tint },
    // the trench: sin of its rim's angle off the middle (0: none), and its arc
    uBand: { value: trench ? Math.sin(trench.half / R) : 0 },
    uHome: { value: trench?.home ?? 0 },
    uArc: { value: trench?.arc ?? Math.PI },
    // a landing's colours, how many metres its bump map's uv is, the time (for a glow that pulses)
    uA: { value: new THREE.Color(look?.colors?.[0] ?? '#808080') },
    uB: { value: new THREE.Color(look?.colors?.[1] ?? '#808080') },
    uC: { value: new THREE.Color(look?.colors?.[2] ?? '#808080') },
    uMetres: { value: P.tile / (style?.repeat ?? 1) },
    uTime: { value: 0 },
  };
  let bump = plated || style?.bump === 'plating' ? platingTexture() : noiseTexture();
  if (style?.repeat) {
    bump = bump.clone();
    bump.repeat.setScalar(style.repeat);
    bump.needsUpdate = true;
  }
  const mat = plated
    ? new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.62, metalness: 0.35, bumpMap: bump, bumpScale: 2.2, envMapIntensity: 0.5 })
    : new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: style?.roughness ?? 0.96, metalness: style?.metalness ?? 0, bumpMap: bump, bumpScale: style?.bumpScale ?? 1.6, envMapIntensity: 0.35 });
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aEdge;\nvarying vec3 vDir;\nvarying float vEdge;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDir = normalize(position);\nvEdge = aEdge;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uPlanet;\nuniform float uHasMap;\nuniform mat3 uToBody;\nuniform vec3 uTint;\nuniform float uBand;\nuniform float uHome;\nuniform float uArc;\nuniform vec3 uA;\nuniform vec3 uB;\nuniform vec3 uC;\nuniform float uMetres;\nuniform float uTime;\nvarying vec3 vDir;\nvarying float vEdge;')
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        // none over the trench: it stops at the rim
        if (abs(vDir.y) < uBand && (uArc >= 3.14159 || abs(mod(atan(vDir.z, vDir.x) - uHome + 3.1415927, 6.2831853) - 3.1415927) <= uArc)) discard;`,
      )
      .replace(
        '#include <map_fragment>',
        `{
          // the planet's own map, where this is on it (its turn held)
          vec3 d = normalize(uToBody * vDir);
          float lon = atan(d.z, -d.x) / 6.2831853;
          vec2 uvA = vec2(fract(lon), 1.0 - acos(clamp(d.y, -1.0, 1.0)) / 3.1415927);
          vec2 uvB = vec2(fract(lon + 0.5) - 0.5, uvA.y);
          vec2 dx = dFdx(uvA), dy = dFdy(uvA), dxB = dFdx(uvB), dyB = dFdy(uvB);
          if (dot(dxB, dxB) + dot(dyB, dyB) < dot(dx, dx) + dot(dy, dy)) { dx = dxB; dy = dyB; }
          vec3 base = uTint;
          if (uHasMap > 0.5) base *= textureGrad(uPlanet, uvA, dx, dy).rgb;
          ${
            plated
              ? `// the plating, out to the patch's edge (its far side's past the horizon)
          ${PLATE_DETAIL}
          diffuseColor.rgb *= base * detail;`
              : style
                ? `// the landing's own ground (landings/ground.js), the planet's map toward the patch's edge
          vec2 m = vBumpMapUv * uMetres;
          vec3 near = vec3(1.0);
          ${style.bump === 'plating' ? 'vec4 pl = texture2D(bumpMap, vBumpMapUv);\n          float blocks = texture2D(bumpMap, vBumpMapUv * 0.137 + 0.29).g;' : 'float n1 = texture2D(bumpMap, vBumpMapUv).r;\n          float n2 = texture2D(bumpMap, vBumpMapUv * 7.31 + 0.37).r;\n          float n3 = texture2D(bumpMap, vBumpMapUv * 0.117 + 0.71).r;'}
          ${style.glsl}
          diffuseColor.rgb *= mix(near, base, smoothstep(0.8, 1.0, vEdge));`
                : `// grit, stones and patches over it, fading out toward the patch's edge
          float n1 = texture2D(bumpMap, vBumpMapUv).r;
          float n2 = texture2D(bumpMap, vBumpMapUv * 7.31 + 0.37).r;
          float n3 = texture2D(bumpMap, vBumpMapUv * 0.117 + 0.71).r;
          float detail = (0.55 + 0.6 * n2) * (0.78 + 0.44 * n1) * (0.8 + 0.4 * n3);
          diffuseColor.rgb *= base * mix(1.0, detail, 1.0 - vEdge);`
          }
        }`,
      )
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>${plated ? PLATE_GLOW : style?.glow ? `\n{${style.glow}\n}` : ''}`);
  };
  mat.customProgramCacheKey = () => (plated ? 'foot-ground-plated' : style ? `foot-ground-${look.style}` : 'foot-ground');
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  const centre = new V();
  const t1 = new V();
  const t2 = new V();
  const g1 = new V(); // the grit's own axes: those of the first lay, kept
  const g2 = new V();
  const dir = new V();
  // laid round `n` (a unit vector out from the planet's middle)
  const lay = (n) => {
    centre.set(...n);
    const any = Math.abs(centre.y) < 0.9 ? new V(0, 1, 0) : new V(1, 0, 0);
    t1.crossVectors(any, centre).normalize();
    t2.crossVectors(centre, t1);
    if (!laidAt) {
      g1.copy(t1);
      g2.copy(t2);
    }
    let v = 0;
    for (let i = 0; i <= P.rings; i++) {
      const rho = P.radius * (i / P.rings) ** 1.7;
      const ang = rho / R;
      for (let j = 0; j < P.segs; j++, v++) {
        const th = (j / P.segs) * Math.PI * 2;
        const c = Math.cos(th);
        const s = Math.sin(th);
        dir.copy(t1).multiplyScalar(c).addScaledVector(t2, s).multiplyScalar(Math.sin(ang)).addScaledVector(centre, Math.cos(ang)).normalize();
        const r = R + P.lift * (1 - smooth(0.85, 1, i / P.rings));
        pos.set([dir.x * r, dir.y * r, dir.z * r], v * 3);
        nor.set([dir.x, dir.y, dir.z], v * 3);
        // the ground's own tiling, in metres along it (on axes that stay
        // put, so the grit doesn't slide as the patch moves on)
        uv.set([(dir.dot(g1) * R) / (P.tile * METRE), (dir.dot(g2) * R) / (P.tile * METRE)], v * 2);
        edge[v] = smooth(0.55, 1, i / P.rings);
      }
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.normal.needsUpdate = true;
    g.attributes.uv.needsUpdate = true;
    g.attributes.aEdge.needsUpdate = true;
    g.computeBoundingSphere();
  };
  let laidAt = null;
  return {
    mesh,
    // round n, if it's moved far enough from where the patch was laid
    follow(n) {
      if (laidAt && vec.dot(laidAt, n) > Math.cos((P.radius * 0.3) / R)) return;
      lay(n);
      laidAt = [...n];
    },
    // the planet's turn (held), so the map lines up with the planet's own
    sync(toBody) {
      uniforms.uToBody.value.copy(toBody);
    },
    tick(t) {
      uniforms.uTime.value = t;
    },
    dispose() {
      g.dispose();
      mat.dispose();
      if (bump !== noiseTex && bump !== plateTex) bump.dispose();
    },
  };
}

// rocks about the landing spot, in the planet's colours, to walk round and
// see the ground go by
function createRocks(n0, R, u, small) {
  const N = small ? 70 : 160;
  let seed = 31;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const p = geo.attributes.position;
  const v = new V();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const k = 1 + 0.18 * Math.sin(v.x * 3.1 + 1.3) * Math.cos(v.y * 2.7) + 0.14 * Math.sin(v.z * 4.3 + v.x * 2);
    v.multiplyScalar(k).multiply(new V(1, 0.6, 0.85));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.93, metalness: 0.02, flatShading: true, envMapIntensity: 0.3 });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  const tones = [u.palette?.base, u.palette?.dark ?? u.palette?.base, u.palette?.light ?? u.palette?.base, '#6b625a', '#4f4a46'].filter(Boolean);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new V();
  const c = new THREE.Color();
  const solids = [];
  const base = person(n0, Math.abs(n0[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
  for (let i = 0; i < N; i++) {
    const d = (6 + rand() ** 0.8 * 95) * METRE;
    const a = rand() * Math.PI * 2;
    const spot = offset(base, Math.cos(a) * d, Math.sin(a) * d, R);
    const size = (0.15 + rand() ** 3 * 2.4) * METRE;
    const up = new V(...spot.n);
    q.setFromUnitVectors(new V(0, 1, 0), up).multiply(new THREE.Quaternion().setFromAxisAngle(new V(0, 1, 0), rand() * 6.3));
    sc.set(size, size * (0.6 + rand() * 0.6), size * (0.8 + rand() * 0.5));
    const at = up.clone().multiplyScalar(R + size * 0.12);
    mesh.setMatrixAt(i, m.compose(at, q, sc));
    mesh.setColorAt(i, c.set(tones[Math.floor(rand() * tones.length)]).multiplyScalar(0.55 + rand() * 0.35));
    if (size > 0.9 * METRE) solids.push({ n: spot.n, r: size * 0.85 });
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return {
    mesh,
    solids,
    dispose() {
      geo.dispose();
      mat.dispose();
      mesh.dispose();
    },
  };
}

// a plated material of its own (the walls of the trench, the blocks on a
// station): `color` times the plating's shade, and its lit windows. Its uvs
// are in plating tiles, or (`boxes`, for instanced boxes) laid on each face
// from the box's own size, so a big one's plates are the size a small one's are
function platedMaterial(color, { lights = true, vertexColors = false, boxes = false, flatShading = false } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: boxes ? 0.12 : 0.3, bumpMap: platingTexture(), bumpScale: 2.2, envMapIntensity: 0.5, vertexColors, flatShading });
  const tile = (HULL_PATCH.tile * METRE).toFixed(5);
  mat.onBeforeCompile = (sh) => {
    if (boxes)
      sh.vertexShader = sh.vertexShader.replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        {
          vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
          vec3 lp = position * sc;
          vec3 an = abs(normal);
          vec2 fuv = an.y > 0.5 ? lp.xz : an.x > 0.5 ? lp.zy : lp.xy;
          vBumpMapUv = fuv / ${tile} + vec2(instanceMatrix[3].x, instanceMatrix[3].z) * 3.1;
        }`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>\n{${PLATE_DETAIL}\n          diffuseColor.rgb *= detail;\n}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>${lights ? PLATE_GLOW : ''}`);
  };
  mat.customProgramCacheKey = () => `foot-plated-${lights ? 1 : 0}${boxes ? 'b' : ''}${flatShading ? 'f' : ''}`;
  return mat;
}

// The trench's walls by you, from the rim down to where the trench run's
// own walls (trench.js) are (its model's laid sunk below the surface, its
// rim some way down), both sides of it and as far along as the patch goes;
// and a row of lights along each rim. band: { half (the rim), deep (how far
// down the trench run's rim is) }
function createTrenchSides(n0, R, band) {
  const group = new THREE.Group();
  const lon0 = Math.atan2(n0[2], n0[0]);
  const L = HULL_PATCH.radius / R; // (radians along, either way)
  const ALONG = 128;
  const DOWN = 6;
  const deep = band.deep + 0.25 * band.deep + 2 * METRE; // (a little past the trench run's rim)
  const pos = [];
  const nor = [];
  const uv = [];
  const col = [];
  const idx = [];
  const tile = HULL_PATCH.tile * METRE;
  for (const side of [-1, 1]) {
    const first = pos.length / 3;
    for (let i = 0; i <= ALONG; i++) {
      const lon = lon0 - L + (2 * L * i) / ALONG;
      for (let j = 0; j <= DOWN; j++) {
        const d = (deep * j) / DOWN;
        const rho = Math.sqrt(Math.max(0, (R - d) ** 2 - band.half ** 2));
        pos.push(Math.cos(lon) * rho, side * band.half, Math.sin(lon) * rho);
        nor.push(0, -side, 0); // facing across the trench
        uv.push(((lon - lon0) * R) / tile, d / tile);
        const k = 1 - 0.55 * (j / DOWN); // darker further down
        col.push(k, k, k);
      }
    }
    for (let i = 0; i < ALONG; i++) {
      for (let j = 0; j < DOWN; j++) {
        const a = first + i * (DOWN + 1) + j;
        const b = a + DOWN + 1;
        // (wound so its face is toward the trench's middle)
        if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1);
        else idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(idx);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mat = platedMaterial('#9aa0a8', { vertexColors: true });
  const walls = new THREE.Mesh(geo, mat);
  walls.frustumCulled = false;
  group.add(walls);
  // the lights along each rim, every few metres
  const EVERY = 9 * METRE;
  const count = Math.floor((2 * L * R) / EVERY);
  const lampGeo = new THREE.BoxGeometry(0.28 * METRE, 0.1 * METRE, 0.28 * METRE).translate(0, 0.05 * METRE, 0);
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff0d2').multiplyScalar(1.6), toneMapped: false });
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, count * 2);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new V(1, 1, 1);
  const up = new V();
  let k = 0;
  for (const side of [-1, 1]) {
    const lat = (band.half + 0.6 * METRE) / R;
    for (let i = 0; i < count; i++, k++) {
      const lon = lon0 - L + (2 * L * (i + 0.5)) / count;
      up.set(Math.cos(lon) * Math.cos(lat), side * Math.sin(lat), Math.sin(lon) * Math.cos(lat));
      q.setFromUnitVectors(new V(0, 1, 0), up);
      lamps.setMatrixAt(k, m.compose(up.clone().multiplyScalar(R), q, one));
    }
  }
  lamps.instanceMatrix.needsUpdate = true;
  lamps.computeBoundingSphere();
  group.add(lamps);
  return {
    mesh: group,
    dispose() {
      geo.dispose();
      mat.dispose();
      lampGeo.dispose();
      lampMat.dispose();
      lamps.dispose();
    },
  };
}

// On a station, for rocks: blocks of the hull standing on it, low ones and
// big ones and the odd tower, square to the plating (and none in the
// trench, or where the ship comes down: `clear` round n0)
function createHullBits(n0, R, u, small, band, clear) {
  const N = small ? 90 : 220;
  let seed = 47;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const mat = platedMaterial('#ffffff', { boxes: true, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  const tones = [u.palette?.base, u.palette?.light, u.palette?.base, '#9aa0a8', '#7a8089'].filter(Boolean);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new V();
  const c = new THREE.Color();
  const solids = [];
  // (square to the trench, as the plating is laid)
  const base = person(n0, band ? [-n0[2], 0, n0[0]] : Math.abs(n0[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
  let placed = 0;
  for (let tries = 0; placed < N && tries < N * 4; tries++) {
    const d = clear + (4 + rand() ** 1.3 * 560) * METRE;
    const a = rand() * Math.PI * 2;
    const spot = offset(base, Math.cos(a) * d, Math.sin(a) * d, R);
    const r = rand();
    const [w, h, l] =
      r < 0.05
        ? [3 + rand() * 4, 9 + rand() * 18, 3 + rand() * 4] // a tower
        : r < 0.2
          ? [4 + rand() * 8, 1.5 + rand() * 4, 4 + rand() * 10] // a big block
          : [0.6 + rand() * 2.6, 0.3 + rand() ** 2 * 2.2, 0.6 + rand() * 2.6];
    const half = (Math.hypot(w, l) / 2) * METRE;
    if (inTrench(spot.n, band, R, half + 2 * METRE)) continue;
    const up = new V(...spot.n);
    const along = new V(...spot.f);
    const turn = Math.floor(rand() * 4) * (Math.PI / 2);
    // y up from the ground, z along the plating, turned by a quarter now and then
    const zAxis = along.clone().applyAxisAngle(up, turn);
    const xAxis = new V().crossVectors(up, zAxis);
    q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, up, zAxis));
    sc.set(w * METRE, h * METRE, l * METRE);
    mesh.setMatrixAt(placed, m.compose(up.clone().multiplyScalar(R - 0.05 * METRE), q, sc));
    mesh.setColorAt(placed, c.set(tones[Math.floor(rand() * tones.length)]).multiplyScalar(0.8 + rand() * 0.3));
    if (Math.max(w, l) > 0.9) solids.push({ n: spot.n, r: (Math.max(w, l) / 2) * METRE });
    placed++;
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return {
    mesh,
    solids,
    dispose() {
      geo.dispose();
      mat.dispose();
      mesh.dispose();
    },
  };
}

// the planet's air along the horizon, by day: a dome round the camera,
// added over the sky (the ground's nearer, so it's left alone)
const HAZE_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const HAZE_FRAG = `
uniform vec3 uUp;
uniform vec3 uColor;
uniform float uDay;
varying vec3 vDir;
void main() {
  float e = dot(normalize(vDir), uUp);
  float horizon = exp(-max(e, 0.0) * 7.0);
  float glow = horizon * 0.8 + 0.06 * (1.0 - smoothstep(0.0, 0.6, e));
  gl_FragColor = vec4(uColor * glow * uDay, 1.0);
  #include <colorspace_fragment>
}`;
function createHaze(color) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: HAZE_VERT,
    fragmentShader: HAZE_FRAG,
    uniforms: { uUp: { value: new V(0, 1, 0) }, uColor: { value: new THREE.Color(color).multiplyScalar(0.2) }, uDay: { value: 1 } },
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  return { mesh, mat, dispose: () => (mesh.geometry.dispose(), mat.dispose()) };
}

// a soft dark spot on the ground under someone, so they stand on it
let blobTex = null;
function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.3)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}
const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const blobMat = () => new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

// ── The whole of it ──

export function createFoot({ map, emit, reduced = false, small = false, planetOf, renderer = null, warm = null }) {
  const root = new THREE.Group(); // at the planet's middle, in the map
  root.name = 'foot';
  root.visible = false;
  map.add(root);
  let cast = null;
  let party = null; // [lead, mate] once loaded: { spec, fig, group, gun, w }
  let troopFigs = new Map(); // id → { fig, group }
  let ground = null;
  let rocks = null;
  let haze = null;
  let sides = null; // a trench's walls by you
  const owned = [];
  const rand = Math.random;

  // bolts in flight: a white-hot core in a sleeve of the shot's colour,
  // its head where the bolt is and its length trailing behind (grown out
  // of the muzzle over the first of its flight, so it never pokes out of
  // the back of the gun)
  const BOLT_LEN = 0.9 * METRE;
  const boltGeo = new THREE.CylinderGeometry(0.03 * METRE, 0.03 * METRE, BOLT_LEN, 6).rotateX(Math.PI / 2).translate(0, 0, -BOLT_LEN / 2);
  const sleeveGeo = new THREE.CylinderGeometry(0.055 * METRE, 0.04 * METRE, BOLT_LEN * 1.1, 8).rotateX(Math.PI / 2).translate(0, 0, -BOLT_LEN * 0.55);
  const boltMats = new Map();
  const boltMat = (color) => {
    if (!boltMats.has(color)) {
      const c = new THREE.Color(color);
      boltMats.set(color, {
        core: new THREE.MeshBasicMaterial({ color: c.clone().lerp(new THREE.Color('#ffffff'), 0.55).multiplyScalar(4), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
        sleeve: new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.4), toneMapped: false, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
      });
    }
    return boltMats.get(color);
  };
  const boltPool = Array.from({ length: 40 }, () => {
    const mats = boltMat('#ffffff');
    const m = new THREE.Mesh(boltGeo, mats.core);
    const sleeve = new THREE.Mesh(sleeveGeo, mats.sleeve);
    sleeve.frustumCulled = false;
    m.add(sleeve);
    m.visible = false;
    m.frustumCulled = false;
    root.add(m);
    return m;
  });
  const paintBolt = (mesh, color) => {
    const mats = boltMat(color);
    mesh.material = mats.core;
    mesh.children[0].material = mats.sleeve;
    mesh.scale.set(1, 1, 0.02);
  };

  // what a shot does round the gun and where it lands (gunfx.js), in the
  // planet's space; and a light that flares with each muzzle flash, kept in
  // the map from the start and dark between shots, so the scene's count of
  // lights never changes and nothing recompiles when it fires (not on a
  // phone, nor with motion turned down)
  const flare = small || reduced ? null : new THREE.PointLight('#ffd36b', 0, 7 * METRE, 2);
  if (flare) {
    flare.userData.peak = 2.5 * METRE * METRE; // (about the key light's brightness, a metre off)
    map.add(flare);
  }
  const groundN = new V();
  const fx = createGunFx({
    parent: root,
    unit: METRE,
    ground: (p) => {
      const l = p.length() || 1;
      return { h: l - S.R, n: groundN.copy(p).divideScalar(l) };
    },
    light: flare && { obj: flare, place: (p) => flare.position.copy(p).add(S.c) },
  });

  // out of your own eyes (V): your gun in your hands at the bottom right of
  // the view, swaying as you walk, lagging a little behind a turn, coming up
  // onto the target as you shoot and kicking when it fires; the shot leaves
  // its muzzle. A copy of the gun your figure holds (that's hidden then)
  let vm = null; // { gun, kind, who, owned, muzzle, eject, look, bob }
  const viewGun = (kind, who) => {
    if (vm?.kind === kind && vm.who === who) return vm;
    if (vm) {
      vm.gun.removeFromParent();
      for (const o of vm.owned) o.dispose?.();
    }
    const owned = [];
    const gun = buildGun(kind, owned);
    viewArms(gun, GUNS[kind], VIEW_ARMS[who] ?? VIEW_ARMS.han, owned);
    gun.scale.setScalar(METRE);
    gun.visible = false;
    gun.traverse((o) => {
      if (o.isMesh) o.frustumCulled = false;
    });
    root.add(gun);
    vm = { gun, kind, who, owned, muzzle: gun.getObjectByName('muzzle'), eject: gun.getObjectByName('eject'), look: null, bob: 0 };
    return vm;
  };
  // the flash of a hit
  const puffTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,230,180,0.6)');
    g.addColorStop(1, 'rgba(255,200,120,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const puffs = Array.from({ length: 16 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.visible = false;
    s.userData.age = 1;
    root.add(s);
    return s;
  });
  const puff = (p, color, size = 1) => {
    const s = puffs.find((o) => !o.visible) ?? puffs[0];
    s.position.set(...p);
    s.material.color.set(color).multiplyScalar(3);
    s.userData = { age: 0, size: size * METRE };
    s.visible = true;
  };

  const shadowMat = blobMat();
  const blobs = new Map(); // whose → mesh
  // a shadow under w (`size` metres across), on the ground whatever their jump
  const shadow = (key, w, size) => {
    let m = blobs.get(key);
    if (!m) {
      m = new THREE.Mesh(blobGeo, shadowMat);
      m.renderOrder = 1;
      root.add(m);
      blobs.set(key, m);
    }
    m.visible = true;
    stand(m, { ...w, h: 0 }, 0.01 * METRE);
    m.scale.setScalar(size * METRE * (1 - Math.min(0.5, (w.h ?? 0) / METRE) * 0.6));
    return m;
  };
  const dropShadow = (key) => {
    const m = blobs.get(key);
    if (!m) return;
    root.remove(m);
    blobs.delete(key);
  };

  const S = {
    phase: null,
    id: null,
    R: 1,
    c: new V(),
    kind: null,
    model: null,
    t: 0,
    clock: 0,
    // the ship: where it came from, where it's down
    from: null, // { p: Vector3, q: Quaternion }
    spot: null, // { n, f }
    rest: 0,
    hover: null,
    arc: null, // the way round the planet, when the spot's a long way from where the ship came in
    band: null, // a trench round its middle: { half (its rim), home, arc, deep (how far down the trench run's rim is) }
    hideBody: 0, // a station: how low the camera's to be for its own model to go (0: it stays)
    bodyShown: true,
    // the people
    lead: 0, // which of the party you play
    me: null,
    mate: null,
    troops: [],
    bolts: [], // { b (foot.js), mesh, color }
    health: FOOT.health,
    hitAt: -1e9,
    downAt: 0,
    nextSquad: 0,
    squads: 0,
    cleared: true,
    cool: 0,
    mateCool: 1,
    aim: 0, // the gun up, 1 fading to 0 after a shot
    mateAim: 0,
    mateTarget: null, // the trooper the mate's gun is on
    knock: null, // which way the last shot that hit you was going
    lock: null, // the trooper the shot goes at
    cam: { pos: null, look: null, pitch: 0.18, first: false, kick: { x: 0, v: 0 } },
    done: null,
  };

  // stand a figure where a person is: up out from the planet, facing f
  const basis = new THREE.Matrix4();
  const stand = (group, w, extra = 0) => {
    const n = new V(...w.n);
    const f = new V(...w.f);
    basis.makeBasis(new V().crossVectors(n, f), n, f);
    group.quaternion.setFromRotationMatrix(basis);
    group.position.set(...at(w, S.R)).addScaledVector(n, extra);
  };

  const shipFrame = (n, fwd) => {
    const N = new V(...n);
    const F = new V(...fwd);
    basis.makeBasis(new V().crossVectors(F, N), N, F.clone().negate());
    return new THREE.Quaternion().setFromRotationMatrix(basis);
  };

  // the ship's resting height off the ground (its lowest point, at its parked size)
  const restOf = (model) => {
    const g = model.group;
    const keep = { p: g.position.clone(), q: g.quaternion.clone(), s: g.scale.clone(), pr: model.pivot.rotation.clone() };
    g.position.set(0, 0, 0);
    g.quaternion.identity();
    g.scale.setScalar(1);
    model.pivot.rotation.set(0, 0, 0);
    g.updateMatrixWorld(true);
    const box = new THREE.Box3();
    g.traverse((o) => {
      if (o.isMesh && o.visible && o.geometry) {
        o.geometry.computeBoundingBox?.();
        const b = o.geometry.boundingBox?.clone().applyMatrix4(o.matrixWorld);
        if (b) box.union(b);
      }
    });
    g.position.copy(keep.p);
    g.quaternion.copy(keep.q);
    g.scale.copy(keep.s);
    model.pivot.rotation.copy(keep.pr);
    g.updateMatrixWorld(true);
    return box;
  };

  // ── loading ──
  let loading = null;
  const load = (kind) => {
    const specs = PARTY[kind] ?? PARTY.rv;
    cast = createMeshyCast(withWardrobe()); // (the wardrobe's bodies too, for the cruiser's two)
    const needCast = [...new Set([...specs.filter((s) => s.src.meshy).map((s) => s.src.meshy), 'gromflomite', 'cop', 'gazorpian'])];
    const castReady = cast.load(null, needCast).catch(() => {});
    loading = (async () => {
      await castReady;
      const figs = await Promise.all(specs.map((s) => loadModel(s, cast).catch(() => null)));
      return figs.map((fig, i) => {
        const spec = specs[i];
        const f = fig ?? built({ ...spec, src: { built: spec.id === 'artoo' ? 'artoo' : 'han' } });
        const group = new THREE.Group();
        group.add(f.model);
        group.visible = false;
        root.add(group);
        const gp = spec.gun ? createGunplay(f, f.gun ?? spec.gun, { unit: METRE, who: f.built ? 'built' : spec.id }) : null;
        return { spec, fig: f, group, gp };
      });
    })();
    return loading;
  };

  // the Federation's guns: the Gromflomites' carbine, the cop's pistol (the gazorpian has hands)
  const TROOP_GUN = { gromflomite: 'rifle', cop: 'coppistol' };
  const troopFig = (t) => {
    let got = troopFigs.get(t.id);
    if (got) return got;
    const c = cast?.make(t.kind);
    const group = new THREE.Group();
    let fig = null;
    let b = null;
    let loco = null;
    if (c) {
      c.group.scale.setScalar(TROOPS[t.kind].tall / c.height);
      fig = { model: c.group };
      if (c.mixer) loco = createLocomotion(fig, { mixer: c.mixer, act: c.act, root: c.group, unit: METRE }); // (measured before it's placed)
      group.add(c.group);
    } else {
      b = built({ tall: TROOPS[t.kind].tall / METRE, src: { built: 'han' } });
      group.add(b.model);
      fig = b;
    }
    root.add(group);
    const gp = TROOP_GUN[t.kind] ? createGunplay(fig, TROOP_GUN[t.kind], { unit: METRE, who: b ? 'built' : null }) : null;
    got = { c, b, group, gp, loco, prevF: null };
    troopFigs.set(t.id, got);
    return got;
  };
  const dropTroop = (id) => {
    const got = troopFigs.get(id);
    if (!got) return;
    root.remove(got.group);
    got.gp?.dispose();
    got.b?.dispose();
    troopFigs.delete(id);
  };

  // how fast someone's turning, from the way they faced last frame (rad/s, + to the left)
  const turnRate = (holder, w, dt) => {
    const was = holder.prevF;
    holder.prevF = w.f;
    if (!was || dt <= 0) return 0;
    return Math.atan2(vec.dot(vec.cross(was, w.f), w.n), vec.dot(was, w.f)) / dt;
  };
  // the way along the ground a shot pushed someone (their back, if nothing did)
  const pushOf = (w, knock) => {
    const d = knock ? vec.add(knock, w.n, -vec.dot(knock, w.n)) : vec.scale(w.f, -1);
    return new V(...(vec.len(d) > 1e-6 ? vec.unit(d) : vec.scale(w.f, -1)));
  };

  // ── the gun: where its muzzle is, pointed where the shot goes ──
  const tmp = new V();
  const invMap = new THREE.Matrix4();
  // (bones are in the world: back into the map's space, and the other way)
  const toMap = (v) => v.applyMatrix4(invMap);
  const dirToWorld = (v) => v.transformDirection(map.matrixWorld);
  // the gun hand, in the map's space (for a figure holding nothing)
  const handAt = (p, out) => {
    const hand = p.fig.bones?.RightHand ?? p.fig.hand ?? null;
    if (hand) return toMap(hand.getWorldPosition(out));
    return out.set(...at(p.w, S.R)).add(S.c).addScaledVector(new V(...p.w.n), p.spec.tall * METRE * 0.62);
  };
  // where a shot from p goes: a trooper's chest (the lock's), or straight ahead (the planet's space)
  const shotAt = (p, target) => {
    if (target) return new V(...vec.add(at(target, S.R), target.n, TROOPS[target.kind].tall * 0.55));
    return new V(...vec.add(vec.add(at(p.w, S.R), p.w.n, p.spec.tall * METRE * 0.62), p.w.f, 40 * METRE));
  };
  // the line from p's shoulder to the mark, for aiming the gun
  const shotDir = (p, target) => {
    const from = vec.add(at(p.w, S.R), p.w.n, p.spec.tall * METRE * 0.62);
    return shotAt(p, target).sub(new V(...from)).normalize();
  };

  // a shot by p at `target` (a trooper, or null for straight ahead): the
  // gun kicks and the bolt leaves its muzzle for the mark
  const shoot = (p, target, owner, damage, jitter = 0, mark = null) => {
    let r = p.gp?.fire();
    // out of your own eyes: from the gun you can see
    if (owner === 'me' && vm?.gun.visible && vm.muzzle) {
      vm.gun.updateWorldMatrix(true, true);
      r = { muzzle: vm.muzzle.getWorldPosition(new V()), eject: vm.eject?.getWorldPosition(new V()) ?? null, gun: vm.gun };
    }
    const from = r ? toMap(r.muzzle).sub(S.c) : handAt(p, new V()).sub(S.c).addScaledVector(shotDir(p, target), 0.35 * METRE);
    const dir = (mark ? mark.clone() : shotAt(p, target)).sub(from).normalize();
    if (jitter) dir.add(new V((rand() - 0.5) * jitter, (rand() - 0.5) * jitter, (rand() - 0.5) * jitter)).normalize();
    const b = makeBolt(arr(from), arr(dir), owner, damage);
    const mesh = boltPool.find((m) => !m.visible) ?? boltPool[0];
    paintBolt(mesh, p.spec.bolt ?? '#ffffff');
    mesh.visible = true;
    S.bolts = S.bolts.filter((o) => o.mesh !== mesh);
    const near = owner === 'me' && S.cam.first;
    S.bolts.push({ b, mesh, color: p.spec.bolt ?? '#ffffff', flown: 0, hide: near ? 1.6 * METRE : 0 });
    if (near) mesh.visible = false;
    // the flash at the muzzle, the smoke after a powder gun's, its brass out of the port
    if (r) {
      const gun = p.gp.spec;
      fx.flash(from, dir, gun.flash);
      const up = new V(...vec.unit(arr(from)));
      if (gun.smoke && !near) fx.smoke(from, dir, gun.smoke);
      if (gun.casing && r.eject) fx.casing(toMap(r.eject).sub(S.c), new V(-1, 0, 0).transformDirection(r.gun.matrixWorld).transformDirection(invMap).addScaledVector(dir, -0.3).normalize(), up);
    } else puff(arr(from), p.spec.bolt ?? '#ffffff', 0.5);
  };

  // ── begin: down onto the planet `id` from where the ship is ──
  // where to come down beside a friend's ship already down (`near`, its { n,
  // f }): alongside it, a ship's length or so off its right, facing the same way
  // (by a trench, their right's toward it: behind them along it instead)
  const beside = (near, kind) => {
    const gap = 0.26 * 0.62 * ((PARKED[near.kind] ?? 1.5) + (PARKED[kind] ?? 1)) + 8 * METRE;
    const o = S.band ? offset(person(near.n, near.f), -gap * 1.6, 0, S.R) : offset(person(near.n, near.f), -2 * METRE, gap, S.R);
    return { n: o.n, f: S.band ? near.f : o.f };
  };
  const begin = ({ id, ship, model, kind, light, near = null }) => {
    const planet = planetOf[id];
    const u = byId(id);
    if (!planet || !u || u.kind === 'core' || u.portal || !model) return false; // (a station, or the gate into the galaxy: nowhere to walk)
    S.id = id;
    S.kind = kind;
    S.model = model;
    S.R = u.size;
    S.c.set(...POSITIONS[id]);
    // a trench round its middle: its rim (a little out from the trench run's
    // own walls, so the two don't fight), and how far down they start
    const tr = u.trench ? trenchOf({ at: POSITIONS[id], r: S.R, trench: u.trench }) : null;
    S.band = tr ? { half: tr.width / 2 + 0.03, home: tr.home, arc: tr.arc, deep: TRENCH_MODEL.sink * tr.scale } : null;
    const from = [ship.x, ship.y, ship.z];
    const fwd3 = [-Math.sin(ship.heading), 0, -Math.cos(ship.heading)];
    // beside a friend already down here, or wherever's below, leaning to the
    // day (by a trench: beside it, the door toward it)
    const n0 = landingSpot(from, arr(S.c), light);
    const clear = 0.62 * 0.26 * (PARKED[kind] ?? 1);
    S.spot = near ? beside(near, kind) : S.band ? byTrench(n0, S.band, S.R, clear + 12 * METRE) : { n: n0, f: facingAlong(n0, fwd3) };
    const { n } = S.spot;
    // a long way round the planet from where the ship is: it flies round over
    // the surface to get there, rather than through the planet
    const out = vec.unit(vec.add(from, arr(S.c), -1));
    const round = Math.acos(Math.min(1, Math.max(-1, vec.dot(out, n))));
    S.arc = round > 0.6 ? { n0: out, h0: vec.len(vec.add(from, arr(S.c), -1)) - S.R, a: round } : null;
    S.from = { p: model.group.position.clone(), q: model.group.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(model.pivot.rotation)) };
    model.pivot.rotation.set(0, 0, 0);
    model.group.quaternion.copy(S.from.q);
    const box = restOf(model);
    S.rest = -box.min.y * (PARKED[kind] ?? 1) + 0.04 * METRE;
    S.hover = vec.add(vec.scale(n, S.R + 14 * METRE + S.rest), [0, 0, 0]);
    S.phase = 'land';
    S.t = 0;
    S.health = FOOT.health;
    S.troops = [];
    S.lead = 0;
    S.done = null;
    S.cam.pitch = 0.22;
    S.cam.pos = null;
    // the planet holds still under you, and its air goes (you're in it)
    planet.hold?.(true);
    if (planet.air) planet.air.visible = false;
    // the ground, the rocks and the air (a station's hull, its blocks and
    // none; and a trench's walls); or the planet's own landing: its ground,
    // its sky and its things, laid out from where the first ship down here
    // came down (a friend's, if you're coming down beside them)
    const landing = u.plated ? null : landingOf(id);
    ground = createGround(planet, u, S.R, S.band, landing?.ground);
    ground.follow(n);
    root.add(ground.mesh);
    if (landing && furnished(id)) {
      const anchor = near ? { n: near.n, f: near.f } : S.spot;
      const f = furnish({ id, landing, frame: anchor, R: S.R, small, renderer, warm });
      rocks = { mesh: f.group, solids: f.solids, spots: f.spots, update: f.update, dispose: f.dispose };
    } else rocks = u.plated ? createHullBits(n, S.R, u, small, S.band, clear) : createRocks(n, S.R, u, small);
    root.add(rocks.mesh);
    haze = u.airless ? null : landing?.sky ? createSky(landing.sky, u.rim ?? u.swatch ?? '#8ab4ff') : createHaze(u.rim ?? u.swatch ?? '#8ab4ff');
    if (haze) root.add(haze.mesh);
    if (landing) emit({ type: 'foot', id: 'arrive', title: landing.title, sub: landing.sub });
    sides = S.band ? createTrenchSides(n, S.R, S.band) : null;
    if (sides) root.add(sides.mesh);
    // (a station's own model goes once the camera's low enough that the
    // patch reaches past the horizon)
    S.bodyShown = planet.body?.visible ?? true;
    S.hideBody = u.plated ? (0.8 * HULL_PATCH.radius) ** 2 / (2 * S.R) : 0;
    root.position.copy(S.c);
    root.visible = true;
    party = null;
    load(kind).then((p) => {
      if (S.id !== id || !S.phase) {
        for (const o of p) {
          root.remove(o.group);
          o.gp?.dispose();
          o.fig.dispose?.();
        }
        return;
      }
      party = p;
    });
    return true;
  };

  // the ship along its way down (k 0…1): over to above the spot, and down
  // onto it, turning to sit level on the ground, growing to its parked size
  const shipAt = (k, out = new V()) => {
    if (S.arc) {
      // round over the planet: along the great circle from above where it
      // was to the spot, up over the curve and down
      const { n0, h0, a } = S.arc;
      const s0 = Math.sin(a) || 1;
      const nk = vec.add(vec.scale(n0, Math.sin((1 - k) * a) / s0), S.spot.n, Math.sin(k * a) / s0);
      const h = h0 + (S.rest - h0) * k + Math.sin(Math.PI * k) * (S.R * a * 0.25);
      return out.set(...vec.scale(nk, S.R + h)).add(S.c);
    }
    const P0 = S.from.p.clone().sub(S.c);
    const H = new V(...S.hover);
    const P1 = new V(...S.spot.n).multiplyScalar(S.R + S.rest);
    const a = 1 - k;
    return out.copy(P0).multiplyScalar(a * a).addScaledVector(H, 2 * a * k).addScaledVector(P1, k * k).add(S.c);
  };

  const placeShip = (k) => {
    const m = S.model;
    const e = ease(k);
    shipAt(e, m.group.position);
    m.group.quaternion.copy(S.from.q).slerp(shipFrame(S.spot.n, S.spot.f), smooth(0, 0.75, k));
    m.group.scale.setScalar(1 + ((PARKED[S.kind] ?? 1) - 1) * smooth(0.2, 0.9, k));
    m.pivot.rotation.set(0, 0, 0);
  };

  // the people out of the door: beside the ship, on its right
  const doorSpot = (side = 1) => {
    const half = 0.62 * 0.26 * (PARKED[S.kind] ?? 1);
    const ship = person(S.spot.n, S.spot.f);
    const out = offset(ship, -half * 0.15, side * (half + 0.8 * METRE), S.R);
    return person(out.n, vec.add(vec.scale(rightOf(ship), side), ship.f, 0.3));
  };
  const shipObstacle = () => ({ n: S.spot.n, r: 0.62 * 0.26 * (PARKED[S.kind] ?? 1) * 0.55 });

  const startOut = () => {
    const [a, b] = party;
    S.me = { id: 'me', ...doorSpot(1) };
    S.mate = b ? { id: 'mate', ...offset(S.me, -0.9 * METRE, 1.1 * METRE, S.R), f: S.me.f, h: 0, vh: 0, speed: 0, side: 0 } : null;
    if (S.mate) S.mate = { ...person(S.mate.n, S.me.f), id: 'mate' };
    a.w = S.me;
    if (b) b.w = S.mate;
    for (const p of party) p.group.visible = true;
    S.phase = 'out';
    S.t = 0;
    S.nextSquad = S.clock + 12 + rand() * 8;
    S.cleared = true;
  };

  // who you're playing, and who's with you (the swap changes which is which)
  const meP = () => party?.[S.lead] ?? null;
  const mateP = () => party?.[1 - S.lead] ?? null;

  // (the other pilots' ships down here too)
  const obstacles = () => [shipObstacle(), ...(rocks?.solids ?? []), ...[...guests.values()].flatMap((g) => (g.ship ? [g.ship] : [])), ...(S.band ? [{ band: S.band }] : [])];

  const troopsAlive = () => S.troops.filter((t) => t.alive);

  // the nearest of the landing's spots you're within reach of (a door, someone to talk to)
  const nearSpot = () => {
    if (!S.me || !rocks?.spots?.length) return null;
    let best = null;
    let bd = Infinity;
    for (const s of rocks.spots) {
      const d = apart(S.me, s, S.R);
      if (d <= s.r && d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  };

  // ── other pilots' crews, down here too ──
  const guests = new Map(); // pilot id → { name, ally, dim, walkers: [{ who, spec, fig, group, gun, label, w, to, alt }] }
  const tagTexture = (text, colour) => {
    const c = document.createElement('canvas');
    c.width = 768;
    c.height = 96;
    const x = c.getContext('2d');
    x.font = '600 38px system-ui, -apple-system, Segoe UI, sans-serif';
    const w = Math.min(760, x.measureText(text).width + 44);
    x.fillStyle = 'rgba(8, 10, 16, 0.72)';
    x.beginPath();
    x.roundRect?.((768 - w) / 2, 14, w, 68, 34);
    if (!x.roundRect) x.rect((768 - w) / 2, 14, w, 68);
    x.fill();
    x.fillStyle = colour;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(text, 384, 49, 740);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const tagFor = (text, colour) => {
    const m = new THREE.SpriteMaterial({ map: tagTexture(text, colour), transparent: true, depthWrite: false, sizeAttenuation: false, toneMapped: false });
    const sprite = new THREE.Sprite(m);
    sprite.center.set(0.5, 0);
    sprite.scale.set(0.27, 0.034, 1); // (a share of the view's height, whatever the distance)
    sprite.renderOrder = 5;
    return sprite;
  };
  const dropTag = (sprite) => {
    root.remove(sprite);
    sprite.material.map.dispose();
    sprite.material.dispose();
  };
  // the same person from another dimension: everything they're made of in
  // that dimension's light
  const otherDimension = (group, hue, own) => {
    const tint = new THREE.Color().setHSL(hue, 0.5, 0.9); // (a wash of it: still themselves)
    const glow = new THREE.Color().setHSL(hue, 0.9, 0.4);
    const remake = (m) => {
      const c = m.clone();
      c.color?.multiply(tint);
      if (c.emissive) {
        c.emissive.copy(glow);
        c.emissiveIntensity = 0.12;
      }
      own.push(c);
      return c;
    };
    group.traverse((o) => {
      if (o.isMesh && o.material) o.material = Array.isArray(o.material) ? o.material.map(remake) : remake(o.material);
    });
  };
  const guestWalker = (g, who, alt) => {
    const spec = SPEC[who];
    const wk = { who, spec, fig: null, group: new THREE.Group(), gp: null, label: null, w: null, to: null, alt, own: [] };
    wk.group.visible = false;
    root.add(wk.group);
    (async () => {
      if (spec.src.meshy) await cast?.load(null, [spec.src.meshy]).catch(() => {});
      const fig = (cast && (await loadModel(spec, cast, g.looks ?? readLooks(null)).catch(() => null))) ?? built({ ...spec, src: { built: spec.id === 'artoo' ? 'artoo' : 'han' } }); // (in their own looks: the show's, if they've sent none)
      if (!guests.has(g.id) || !g.walkers.includes(wk)) return fig.dispose?.();
      wk.fig = fig;
      wk.group.add(fig.model);
      if (wk.alt) otherDimension(fig.model, g.dim.hue, wk.own);
      if (spec.gun) wk.gp = createGunplay(fig, fig.gun ?? spec.gun, { unit: METRE, who: fig.built ? 'built' : spec.id });
    })();
    return wk;
  };
  const dropWalker = (g, wk, i) => {
    root.remove(wk.group);
    wk.gp?.dispose();
    wk.fig?.dispose?.();
    if (wk.label) dropTag(wk.label);
    for (const o of wk.own) o?.dispose?.();
    dropShadow(`guest:${g.id}:${i}`);
  };
  const dropGuest = (g) => {
    g.walkers.forEach((wk, i) => wk && dropWalker(g, wk, i));
    guests.delete(g.id);
  };
  // who's here already, as people: yours, and every guest's met so far
  const here = (except) => {
    const out = new Set((party ?? []).map((p) => p.spec.id));
    for (const g of guests.values()) if (g !== except) for (const wk of g.walkers) if (wk) out.add(wk.who);
    return out;
  };
  // each frame: the pilots down on this planet now ({ id, name, ally, foot }),
  // their crews brought in, moved on, or gone
  const setGuests = (list) => {
    const want = new Map();
    for (const o of list ?? []) if (o.foot?.planet === S.id && o.foot.lead) want.set(o.id, o);
    for (const g of [...guests.values()]) if (!want.has(g.id)) dropGuest(g);
    if (!S.phase || S.phase === 'lift' || !party) return; // (yours first, to know who's a double)
    for (const o of want.values()) {
      let g = guests.get(o.id);
      if (!g) {
        g = { id: o.id, name: o.name, ally: o.ally, dim: dimensionOf(o.id), walkers: [null, null], said: false };
        guests.set(o.id, g);
      }
      g.name = o.name;
      g.ally = o.ally;
      g.looks = o.looks ?? null; // (how they dress their Rick and Morty)
      g.ship = { n: o.foot.ship.n, r: 0.62 * 0.26 * (PARKED[o.foot.kind] ?? 1) * 0.55 };
      [o.foot.lead, o.foot.mate].forEach((to, i) => {
        let wk = g.walkers[i];
        if (wk && (!to || to.who !== wk.who)) {
          dropWalker(g, wk, i);
          wk = g.walkers[i] = null;
        }
        if (!to || !SPEC[to.who]) return;
        if (!wk) {
          wk = g.walkers[i] = guestWalker(g, to.who, here(g).has(to.who));
          const who = `${wk.spec.name}${wk.alt ? ` of ${g.dim.code}` : ''}`;
          wk.label = tagFor(i === 0 ? `${who} · ${g.name ?? 'a pilot'}` : who, g.ally ? '#8dff9a' : wk.alt ? `hsl(${Math.round(g.dim.hue * 360)}, 90%, 72%)` : '#ffffff');
          root.add(wk.label);
        }
        wk.to = to;
      });
      // your crew have something to say about who's turned up (once you're out)
      const first = g.walkers[0];
      if (!g.said && first && S.phase === 'walk') {
        g.said = true;
        const alt = g.walkers.find((wk) => wk?.alt);
        emit({ type: 'foot', id: alt ? 'alt' : 'friend', who: (alt ?? first).who, name: g.name });
      }
    }
  };
  const guestsFrame = (dt) => {
    const k = 1 - Math.exp(-dt * 10);
    const mix = (a, b) => a + (b - a) * k;
    for (const g of guests.values()) {
      g.walkers.forEach((wk, i) => {
        if (!wk?.to) return;
        const to = wk.to;
        // eased on toward where they last said they were (a jump, straight there)
        if (!wk.w || apart(wk.w, to, S.R) > 6 * METRE) wk.w = { ...to };
        else {
          const n = vec.unit(vec.add(wk.w.n, vec.add(to.n, wk.w.n, -1), k));
          const f0 = vec.add(wk.w.f, vec.add(to.f, wk.w.f, -1), k);
          wk.w = { n, f: vec.unit(vec.add(f0, n, -vec.dot(f0, n))), h: mix(wk.w.h, to.h), speed: mix(wk.w.speed, to.speed), side: mix(wk.w.side, to.side), aim: mix(wk.w.aim, to.aim) };
        }
        const w = wk.w;
        const show = Boolean(wk.fig);
        wk.group.visible = show;
        if (show) {
          stand(wk.group, w);
          const frame = { forward: dirToWorld(new V(...w.f)), up: dirToWorld(new V(...w.n)) };
          const motion = { speed: w.speed ?? 0, side: w.side ?? 0, turn: turnRate(wk, w, dt), air: (w.h ?? 0) / METRE };
          wk.fig.update(dt, Math.min(1, Math.abs(w.speed) / FOOT.run + Math.abs(w.side) / FOOT.run), motion);
          wk.group.updateMatrixWorld(true);
          wk.fig.after?.(dt, motion, frame);
          // their gun as they said: up and along the way they face, or down
          wk.gp?.set(dt, { aim: w.aim, forward: frame.forward, up: frame.up });
        }
        shadow(`guest:${g.id}:${i}`, w, wk.spec.tall * 0.55).visible = show;
        // the tag over their head, near enough to read
        if (wk.label) {
          wk.label.position.set(...vec.add(at(w, S.R), w.n, wk.spec.tall * METRE * 1.12));
          wk.label.visible = show && Boolean(S.me) && apart(S.me, w, S.R) < GUEST_FAR * METRE;
        }
      });
    }
  };
  const walker = (w, p, aim) => (w && p ? { who: p.spec.id, n: w.n, f: w.f, h: w.h ?? 0, speed: w.speed ?? 0, side: w.side ?? 0, aim } : null);


  // ── each frame ──
  const update = (dt, t, input = {}) => {
    if (!S.phase) return false;
    S.clock += dt;
    S.t += dt;
    map.updateMatrixWorld();
    invMap.copy(map.matrixWorld).invert();
    // the ground's map follows the planet's held turn
    const planet = planetOf[S.id];
    if (ground && planet?.body) {
      planet.body.updateWorldMatrix(true, false);
      const m4 = new THREE.Matrix4().copy(invMap).multiply(planet.body.matrixWorld);
      const m3 = new THREE.Matrix3().setFromMatrix4(m4);
      // (rotation only: normalise away any scale, then invert, from map to body)
      const e = m3.elements;
      for (let c = 0; c < 3; c++) {
        const l = Math.hypot(e[c * 3], e[c * 3 + 1], e[c * 3 + 2]) || 1;
        e[c * 3] /= l;
        e[c * 3 + 1] /= l;
        e[c * 3 + 2] /= l;
      }
      ground.sync(m3.transpose());
    }
    ground?.tick(S.clock);
    rocks?.update?.(S.clock, dt);

    if (S.phase === 'land') {
      const k = Math.min(1, S.t / LAND.down);
      placeShip(k);
      if (k >= 1 && party) startOut();
      else if (k >= 1 && S.t > LAND.down + 8) {
        // they never came: take off again
        S.phase = 'lift';
        S.t = 0;
      }
    } else if (S.phase === 'out') {
      // out of the door and a few steps away
      const k = Math.min(1, S.t / LAND.out);
      S.me = walk(S.me, { move: k < 0.9 ? 0.6 : 0 }, dt, S.R, obstacles());
      if (S.mate) S.mate = walk(S.mate, { move: k < 0.8 ? 0.5 : 0 }, dt, S.R, obstacles());
      if (k >= 1) {
        S.phase = 'walk';
        S.t = 0;
        emit({ type: 'foot', id: 'out' });
      }
    } else if (S.phase === 'walk') {
      walkFrame(dt, input);
    } else if (S.phase === 'down') {
      if (S.t > LAND.fall) {
        // back on your feet by the ship
        S.me = { ...doorSpot(1), id: 'me' };
        if (S.mate) S.mate = { ...person(offset(S.me, -0.9 * METRE, 1.1 * METRE, S.R).n, S.me.f), id: 'mate' };
        S.health = FOOT.health;
        S.phase = 'walk';
        S.t = 0;
        emit({ type: 'foot', id: 'up' });
      }
    } else if (S.phase === 'board') {
      // back to the door, and in
      const door = doorSpot(1);
      for (const key of ['me', 'mate']) {
        const w = S[key];
        if (!w) continue;
        S[key] = walk(w, { move: 0.8, turn: turnToward(w, vec.add(door.n, w.n, -1), 4) }, dt, S.R);
      }
      if (S.t > LAND.board) {
        for (const p of party ?? []) p.group.visible = false;
        for (const [key, m] of blobs) if (key.startsWith('party')) m.visible = false;
        S.phase = 'lift';
        S.t = 0;
        S.from = { p: S.model.group.position.clone(), q: S.model.group.quaternion.clone() };
      }
    } else if (S.phase === 'lift') {
      liftFrame();
    }
    // the figures where the people are
    if (party && S.phase !== 'land' && S.phase !== 'lift') drawPeople(dt);
    drawTroops(dt, t);
    guestsFrame(dt);
    moveBolts(dt);
    fx.update(dt);
    spring(S.cam.kick, dt, 240, 22);
    for (const s of puffs) {
      if (!s.visible) continue;
      s.userData.age += dt / 0.35;
      if (s.userData.age >= 1) s.visible = false;
      s.scale.setScalar(s.userData.size * (0.6 + s.userData.age * 1.6));
      s.material.opacity = (1 - s.userData.age) ** 2;
    }
    if (S.me) ground?.follow(S.me.n);
    return true;
  };

  const walkFrame = (dt, input) => {
    const me = meP();
    // you: walking, turning, running, jumping
    S.me = walk(S.me, { move: input.move, strafe: input.strafe, turn: input.turn, run: input.run, jump: input.jump }, dt, S.R, obstacles());
    // the lock: the nearest trooper round the way you face (kept while it's still there)
    const alive = troopsAlive();
    if (S.lock && !alive.find((o) => o.id === S.lock)) S.lock = null;
    if (!S.lock) S.lock = aimAt(S.me, alive, S.R, { cone: 0.5 })?.id ?? null;
    // whoever's with you: follows a step behind, and shoots at what's close
    if (S.mate) {
      const mate = mateP();
      const near = alive.length ? alive.reduce((a, b) => (apart(S.mate, a, S.R) < apart(S.mate, b, S.R) ? a : b)) : null;
      const behind = offset(S.me, -1.4 * METRE, (S.lead ? -1 : 1) * 1.3 * METRE, S.R);
      const gap = apart(S.mate, behind, S.R);
      let turn = 0;
      let move = 0;
      let run = false;
      if (gap > 0.6 * METRE) {
        turn = turnToward(S.mate, vec.add(behind.n, S.mate.n, -1), 4);
        move = Math.abs(turn) < 0.8 ? 1 : 0.3;
        run = gap > 4 * METRE || Math.abs(S.me.speed) > FOOT.walk * 1.2;
      } else if (near && apart(S.mate, near, S.R) < 30 * METRE) turn = turnToward(S.mate, vec.add(near.n, S.mate.n, -1), 4);
      else turn = turnToward(S.mate, S.me.f, 2);
      S.mate = walk(S.mate, { move, turn, run }, dt, S.R, obstacles());
      S.mateCool -= dt;
      // the one they're on: gun up at it while it's near enough, a shot now and then
      S.mateTarget = near && apart(S.mate, near, S.R) < 30 * METRE ? near : null;
      if (S.mateTarget && mate?.spec.gun) S.mateAim = 1;
      if (near && mate?.spec.gun && S.mateCool <= 0 && apart(S.mate, near, S.R) < 26 * METRE && (mate.gp?.aim ?? 1) > 0.6) {
        S.mateCool = 0.9 + rand() * 0.9;
        shoot(mate, near, 'mate', 1, 0.06);
        emit({ type: 'fire', soft: true, gun: mate.spec.gun });
      }
    } else S.mateTarget = null;
    // the Federation: a squad now and then, once the last is dealt with
    if (S.cleared && S.clock > S.nextSquad) {
      const kinds = S.squads < 1 ? ['gromflomite'] : S.squads < 3 ? ['gromflomite', 'gromflomite', 'cop'] : ['gromflomite', 'cop', 'cop', 'gazorpian'];
      const count = Math.min(5, 2 + S.squads + Math.floor(rand() * 2));
      S.troops = [...S.troops.filter((o) => o.alive || o.dead < 3), ...squad(rand, S.me, S.R, { count, kinds, band: S.band })];
      S.squads++;
      S.cleared = false;
      emit({ type: 'foot', id: 'squad' });
    }
    const targets = [{ id: 'me', n: S.me.n, h: S.me.h }, ...(S.mate ? [{ id: 'mate', n: S.mate.n, h: S.mate.h }] : [])];
    const r = march(S.troops, targets, dt, S.R, rand, obstacles());
    S.troops = r.troops.filter((o) => o.alive || o.dead < 4);
    for (const id of [...troopFigs.keys()]) if (!S.troops.find((o) => o.id === id)) dropTroop(id);
    for (const s of r.shots) {
      // from the gun's muzzle, if the trooper's holding one (re-aimed at the same mark)
      let from = s.from;
      let dir = s.dir;
      const got = troopFigs.get(s.by);
      const f = got?.group.visible ? got.gp?.fire() : null;
      if (f) {
        from = arr(toMap(f.muzzle).sub(S.c));
        dir = vec.unit(vec.add(vec.add(s.from, s.dir, s.range), from, -1));
        fx.flash(new V(...from), new V(...dir), got.gp.spec.flash);
      }
      const b = makeBolt(from, dir, 'troop', s.damage);
      const mesh = boltPool.find((m) => !m.visible) ?? boltPool[0];
      paintBolt(mesh, TROOP_BOLT);
      mesh.visible = true;
      S.bolts = S.bolts.filter((o) => o.mesh !== mesh);
      S.bolts.push({ b, mesh, color: TROOP_BOLT, flown: 0 });
      emit({ type: 'shot' });
    }
    for (const h of r.hits) if (h.target === 'me') hurt(h.damage);
    if (!S.cleared && !troopsAlive().length) {
      S.cleared = true;
      S.nextSquad = S.clock + 30 + rand() * 25;
      emit({ type: 'foot', id: 'cleared' });
    }
    // health comes back once out of trouble a while
    if (S.clock - S.hitAt > 4 && S.health < FOOT.health) S.health = Math.min(FOOT.health, S.health + FOOT.heal * dt);
    S.cool -= dt;
    // the gun stays up a while after the last shot, longer with a lock still there
    S.aim = Math.max(0, S.aim - dt / (S.lock ? 6 : 2.5));
    S.mateAim = Math.max(0, S.mateAim - dt / 2.5);
    if (me && !me.spec.gun) S.aim = 0;
  };

  const hurt = (damage, knock = null) => {
    if (S.phase !== 'walk') return;
    S.knock = knock;
    S.health = Math.max(0, S.health - damage);
    S.hitAt = S.clock;
    emit({ type: 'foot', id: 'hurt', damage });
    if (S.health <= 0) {
      S.phase = 'down';
      S.t = 0;
      S.troops = S.troops.map((o) => ({ ...o, alive: false, dead: 2.5 })); // they go, their job done
      S.cleared = true;
      S.nextSquad = S.clock + 20;
      emit({ type: 'foot', id: 'down' });
    }
  };

  const moveBolts = (dt) => {
    const people = [];
    if (S.phase === 'walk') {
      people.push({ id: 'me', p: vec.add(at(S.me, S.R), S.me.n, METRE) });
      if (S.mate) people.push({ id: 'mate', p: vec.add(at(S.mate, S.R), S.mate.n, METRE) });
    }
    for (const t of S.troops) if (t.alive) people.push({ id: t.id, p: vec.add(at(t, S.R), t.n, TROOPS[t.kind].tall * 0.5), r: TROOPS[t.kind].tall * 0.24 });
    const keep = [];
    for (const o of S.bolts) {
      const mine = o.b.owner !== 'troop';
      const r = flyBolt(o.b, dt, S.R, people.filter((p) => (mine ? typeof p.id === 'number' : typeof p.id === 'string')));
      o.b = r.bolt;
      if (r.hit || o.b.life <= 0) {
        o.mesh.visible = false;
        if (r.hit) {
          puff(o.b.p, r.hit === 'ground' ? '#ffcf8a' : o.color ?? '#ffffff', r.hit === 'ground' ? 0.7 : 1.2);
          const along = tmp.set(...o.b.v).normalize();
          if (r.hit === 'ground') {
            // on the ground: where it went in, sparks off it and a burn
            const n = new V(...vec.unit(o.b.p));
            const spot = n.clone().multiplyScalar(S.R);
            fx.sparks(spot, n.clone().addScaledVector(along, 0.6).normalize(), o.color ?? '#ffd0a0', 12);
            fx.scorch(spot, n);
          } else fx.sparks(new V(...o.b.p), along.clone().negate(), o.color ?? '#ffd0a0', 9); // off whoever it hit, back the way it came
          // how near you: for the sound of it
          if (S.me) {
            const d = vec.len(vec.add(o.b.p, at(S.me, S.R), -1)) / METRE;
            if (d < 40) emit({ type: 'impact', near: Math.max(0.15, 1 - d / 40) });
          }
        }
        if (typeof r.hit === 'number') {
          const t = S.troops.find((x) => x.id === r.hit);
          if (t?.alive) {
            t.hp -= o.b.damage;
            t.hitAt = S.clock;
            t.knock = vec.unit(o.b.v); // which way the shot pushed them
            if (t.hp <= 0) {
              t.alive = false;
              t.dead = 0;
              t.fallSide = rand() < 0.5 ? -1 : 1;
              emit({ type: 'foot', id: 'kill', kind: t.kind, by: o.b.owner });
            }
          }
        } else if (r.hit === 'me') hurt(o.b.damage, vec.unit(o.b.v));
        continue;
      }
      o.mesh.position.set(...o.b.p);
      o.mesh.quaternion.setFromUnitVectors(new V(0, 0, 1), tmp.set(...o.b.v).normalize());
      // grown out of the muzzle to its full length
      o.flown += vec.len(o.b.v) * dt;
      o.mesh.scale.z = Math.min(1, Math.max(0.02, (o.flown - o.hide) / BOLT_LEN));
      if (o.hide && !o.mesh.visible && o.flown > o.hide) o.mesh.visible = true;
      keep.push(o);
    }
    S.bolts = keep;
  };

  const drawPeople = (dt) => {
    const show = S.phase === 'out' || S.phase === 'walk' || S.phase === 'board' || S.phase === 'down';
    party.forEach((p, i) => {
      const w = i === S.lead ? S.me : S.mate;
      if (!w) {
        p.group.visible = false;
        return;
      }
      p.w = w;
      p.group.visible = show && !(i === S.lead && S.cam.first);
      stand(p.group, w);
      shadow(`party${i}`, w, p.spec.tall * 0.55).visible = show;
      const n = new V(...w.n);
      const frame = { forward: dirToWorld(new V(...w.f)), up: dirToWorld(n.clone()) };
      const mine = i === S.lead;
      // knocked down: the knees go and over onto their back, then up again
      let down = 0;
      if (mine && S.phase === 'down') {
        down = Math.min(1, S.t / 0.95) * (1 - smooth(LAND.fall - 0.7, LAND.fall, S.t));
        p.group.quaternion.premultiply(fallTurn(down, pushOf(w, S.knock), n));
        p.group.position.addScaledVector(n, p.spec.tall * METRE * 0.05 * smooth(0.5, 1, down));
      }
      const move = Math.min(1, Math.abs(w.speed) / FOOT.run + Math.abs(w.side) / FOOT.run);
      const hurt = mine ? Math.max(0, 1 - (S.clock - S.hitAt) / 0.35) : 0;
      const motion = { speed: w.speed, side: w.side, turn: turnRate(p, w, dt), air: (w.h ?? 0) / METRE, hurt, knock: 0.5, down };
      p.fig.update(dt, move, motion);
      p.group.updateMatrixWorld(true);
      p.fig.after?.(dt, motion, frame);
      const drop = p.fig.loco?.drop ?? 0;
      if (drop > 1e-7 && !down) {
        p.group.position.addScaledVector(n, -drop);
        p.group.updateMatrixWorld(true);
      }
      // the gun: up at the lock (or the trooper the mate's after) while
      // there's shooting, the head on it before that, down otherwise
      if (p.gp) {
        const mine = i === S.lead;
        const target = mine ? S.troops.find((o) => o.id === S.lock && o.alive) : S.mateTarget;
        const aim = mine ? S.aim : S.mateAim;
        p.gp.set(dt, { aim: down ? 0 : aim, look: target && !down ? Math.max(aim, 0.8) : aim, dir: target ? dirToWorld(shotDir(p, target)) : null, forward: frame.forward, up: frame.up, move });
      }
    });
  };

  const drawTroops = (dt, t) => {
    for (const key of [...blobs.keys()]) if (key.startsWith('troop') && !S.troops.find((o) => `troop${o.id}` === key)) dropShadow(key);
    for (const tr of S.troops) {
      const got = troopFig(tr);
      stand(got.group, tr);
      shadow(`troop${tr.id}`, tr, (TROOPS[tr.kind].tall / METRE) * 0.5).visible = tr.alive || tr.dead < 2.4;
      const n = new V(...tr.n);
      const frame = { forward: dirToWorld(new V(...tr.f)), up: dirToWorld(n.clone()) };
      if (!tr.alive) {
        // down they go: the knees, then over the way the shot pushed them,
        // the gun out of their hand, and into the ground after a while
        const k = Math.min(1, tr.dead / 0.95);
        const tall = TROOPS[tr.kind].tall;
        got.group.quaternion.premultiply(fallTurn(k, pushOf(tr, tr.knock), n));
        got.group.position.addScaledVector(n, tall * 0.05 * smooth(0.5, 1, k) - smooth(2.4, 4, tr.dead) * tall * 0.5);
        if (got.loco) {
          got.loco.update(dt, { move: 0, down: k });
          got.c.mixer.update(dt);
          got.group.updateMatrixWorld(true);
          got.loco.after(dt, { down: k }, frame);
        } else got.c?.update?.(t, 0, 0);
        if (got.gp && !got.dropped && k > 0.3) {
          got.dropped = true;
          const g = got.gp.drop();
          if (g) fx.toss(g, pushOf(tr, tr.knock).multiplyScalar(1.2 * METRE).addScaledVector(n, 1.4 * METRE));
        }
        continue;
      }
      const move = Math.min(1, Math.abs(tr.speed) / (TROOPS[tr.kind].speed * 1.2) + Math.abs(tr.side) / FOOT.run);
      const hit = tr.hitAt ? Math.max(0, 1 - (S.clock - tr.hitAt) / 0.35) : 0;
      const motion = { speed: tr.speed, side: tr.side, turn: turnRate(got, tr, dt), hurt: hit, knock: tr.knock ? Math.sign(vec.dot(tr.knock, rightOf(tr))) || 1 : 0.4 };
      if (got.loco) {
        got.loco.update(dt, { move, ...motion });
        got.c.mixer.update(dt);
        got.group.updateMatrixWorld(true);
        got.loco.after(dt, motion, frame);
      } else if (got.c) got.c.update(t, move, hit);
      else got.b?.update(dt, move);
      if (got.gp) {
        // its gun up at whichever of you is nearer, as the rules say
        got.group.updateMatrixWorld(true);
        const who = S.me && (!S.mate || apart(tr, S.me, S.R) <= apart(tr, S.mate, S.R)) ? S.me : S.mate;
        const dir = who ? new V(...vec.unit(vec.add(vec.add(at(who, S.R), who.n, METRE * 1.1), vec.add(at(tr, S.R), tr.n, TROOPS[tr.kind].tall * 0.62), -1))) : null;
        got.gp.set(dt, { aim: tr.aim ?? 0, dir: dir && dirToWorld(dir), forward: frame.forward, up: frame.up, move });
      }
    }
  };

  const liftFrame = () => {
    const m = S.model;
    const k = Math.min(1, S.t / LAND.lift);
    const e = ease(k);
    const P0 = S.from.p.clone();
    const up = new V(...vec.scale(S.spot.n, S.R + 3.2)).add(S.c);
    m.group.position.copy(P0).lerp(up, e);
    // turning level as it rises (the map's level: that's how it flies),
    // nose the way it was facing, or else out away from the planet
    const [fx, , fz] = S.spot.f;
    const [nx, , nz] = S.spot.n;
    const heading = Math.hypot(fx, fz) > 0.25 ? Math.atan2(-fx, -fz) : Math.atan2(-nx, -nz);
    const level = new THREE.Quaternion().setFromAxisAngle(new V(0, 1, 0), heading);
    m.group.quaternion.copy(S.from.q).slerp(level, smooth(0.3, 1, k));
    m.group.scale.setScalar((PARKED[S.kind] ?? 1) + (1 - (PARKED[S.kind] ?? 1)) * smooth(0, 0.6, k));
    if (k >= 1) S.done = { x: m.group.position.x, y: m.group.position.y, z: m.group.position.z, heading };
  };

  // the gun in your hands, out of your own eyes (in the planet's space, from the eased camera)
  const vmF = new V();
  const vmR = new V();
  const vmU = new V();
  const vmQ = new THREE.Quaternion();
  const VM_CONE = 0.3; // radians
  const placeViewGun = (dt) => {
    const me = meP();
    const on = Boolean(S.cam.first && S.phase === 'walk' && me?.spec.gun && S.cam.pos);
    if (!on) {
      if (vm) vm.gun.visible = false;
      return;
    }
    const v = viewGun(me.spec.gun, me.spec.id);
    const pos = S.cam.pos.clone().sub(S.c);
    vmF.copy(S.cam.look).sub(S.cam.pos).normalize();
    vmU.copy(S.cam.up).addScaledVector(vmF, -S.cam.up.dot(vmF)).normalize();
    vmR.crossVectors(vmF, vmU).normalize();
    // what it's pointed at: the lock's chest while there's shooting, else a little low ahead
    const lock = S.troops.find((o) => o.id === S.lock && o.alive);
    const up = Math.min(1, S.aim * 1.4);
    const mark = lock && up > 0.05 ? new V(...vec.add(at(lock, S.R), lock.n, TROOPS[lock.kind].tall * 0.55)) : pos.clone().addScaledVector(vmF, 20 * METRE).addScaledVector(vmU, -(1 - up) * 6 * METRE).addScaledVector(vmR, -(1 - up) * 2.5 * METRE);
    // held: lower and further right at ease, up toward the middle of the view to shoot
    const k = S.cam.kick.x;
    v.bob += dt * (2 + Math.min(1, Math.abs(S.me.speed) / FOOT.run) * 9);
    const walking = Math.min(1, Math.abs(S.me.speed) / FOOT.walk);
    const long = GUNS[me.spec.gun]?.stock;
    // (a long gun lower and further out to the side: its stock's at your
    // shoulder, its scope and a bowcaster's bow well under your eye)
    const hold = new V()
      .copy(pos)
      .addScaledVector(vmF, ((long ? 0.36 : 0.5) - up * 0.03 - k * 0.035) * METRE)
      .addScaledVector(vmR, ((long ? 0.27 : 0.25) - up * 0.05 + Math.sin(v.bob) * 0.008 * walking) * METRE)
      .addScaledVector(vmU, ((long ? -0.4 : -0.26) + up * 0.05 + Math.abs(Math.cos(v.bob)) * 0.01 * walking) * METRE);
    v.gun.position.copy(hold);
    const dir = mark.sub(hold).normalize();
    // never pointed out of the view: within a few degrees of where you're looking
    const off = dir.angleTo(vmF);
    if (off > VM_CONE) dir.lerp(vmF, 1 - VM_CONE / off).normalize();
    if (!v.look || reduced) v.look = dir.clone();
    else v.look.lerp(dir, 1 - Math.exp(-dt * 16)).normalize(); // (a moment behind a turn)
    frameFrom(v.look, vmU, vmQ);
    v.gun.quaternion.copy(vmQ);
    v.gun.rotateX(-k * 0.12); // the kick, muzzle up
    v.gun.visible = true;
  };

  // ── the camera: behind you, over your shoulder (or out of your eyes) ──
  const view = (dt) => {
    if (!S.phase) return null;
    const out = { pos: new V(), look: new V(), up: new V() };
    if (S.phase === 'land' || S.phase === 'lift' || (S.phase === 'board' && !S.me)) {
      // over the ship, from behind and above, as it comes down (or goes up)
      const m = S.model.group;
      const n = new V(...S.spot.n);
      const f = new V(...S.spot.f);
      const p = m.position;
      out.look.copy(p);
      out.pos.copy(p).addScaledVector(f, -1.1).addScaledVector(n, 0.45);
      out.up.copy(n);
    } else {
      const w = S.me;
      const n = new V(...w.n);
      const f = new V(...w.f);
      const me = meP();
      const tall = (me?.spec.tall ?? 1.8) * METRE;
      const head = new V(...at(w, S.R)).add(S.c).addScaledVector(n, tall * 0.92);
      if (S.phase === 'down') {
        // up and away, looking down on you
        const k = smooth(0, 1, S.t);
        out.look.copy(head);
        out.pos.copy(head).addScaledVector(f, -CAM.dist * METRE).addScaledVector(n, (1.5 + k * 3) * METRE);
      } else if (S.cam.first) {
        out.pos.copy(head).addScaledVector(f, 0.15 * METRE);
        out.look.copy(out.pos).addScaledVector(f, 6 * METRE).addScaledVector(n, -S.cam.pitch * 4 * METRE);
      } else {
        const p = S.cam.pitch;
        const right = new V().crossVectors(f, n);
        out.look.copy(head).addScaledVector(f, CAM.look * METRE).addScaledVector(n, -p * 0.8 * METRE);
        out.pos
          .copy(head)
          .addScaledVector(f, -CAM.dist * METRE * Math.cos(p))
          .addScaledVector(n, CAM.dist * METRE * Math.sin(p) + CAM.up * METRE)
          .addScaledVector(right, 0.45 * METRE); // over the right shoulder
      }
      out.up.copy(n);
    }
    // your own shot kicks the view up a touch (more out of your own eyes)
    const kick = S.cam.kick.x;
    if (Math.abs(kick) > 1e-4 && S.me) {
      const k = (S.cam.first ? 1.6 : 1) * METRE;
      out.look.addScaledVector(out.up, kick * 0.35 * k);
      out.pos.addScaledVector(out.up, kick * 0.05 * k);
    }
    // never under the ground
    const rel = out.pos.clone().sub(S.c);
    const minR = S.R + 0.35 * METRE;
    if (rel.length() < minR) out.pos.copy(S.c).addScaledVector(rel.normalize(), minR);
    // eased, so it follows rather than jolts
    if (S.cam.pos) {
      const k = reduced ? 1 : 1 - Math.exp(-dt * (S.phase === 'walk' ? 12 : 3.5));
      S.cam.pos.lerp(out.pos, k);
      S.cam.look.lerp(out.look, k);
      S.cam.up.lerp(out.up, k).normalize();
    } else S.cam = { ...S.cam, pos: out.pos.clone(), look: out.look.clone(), up: out.up.clone() };
    placeViewGun(dt);
    // a station's own model: not while the camera's down by the ground
    const body = planetOf[S.id]?.body;
    if (body && S.hideBody) body.visible = S.bodyShown && S.cam.pos.distanceTo(S.c) - S.R > S.hideBody;
    // the air: round the camera, by day
    if (haze) {
      haze.mesh.position.copy(S.cam.pos).sub(S.c);
      haze.mat.uniforms.uUp.value.copy(S.cam.up);
    }
    return { pos: S.cam.pos, look: S.cam.look, up: S.cam.up };
  };

  return {
    get phase() {
      return S.phase;
    },
    // (development: the numbers, for checking from a browser)
    get debug() {
      return import.meta.env.DEV ? S : null;
    },
    // (development: the landing's doors and people, scripts/door-check.mjs)
    get spots() {
      return import.meta.env.DEV ? (rocks?.spots ?? []) : null;
    },
    get id() {
      return S.id;
    },
    begin,
    update,
    view,
    // the day where you are: how much the haze shows (light: the key light's direction, in the map's space)
    day(light) {
      if (!haze || !S.spot) return;
      const k = smooth(-0.25, 0.35, vec.dot(S.me?.n ?? S.spot.n, arr(light)));
      // (only down in the air: gone by the time you're well up)
      const high = S.cam.pos ? S.cam.pos.distanceTo(S.c) - S.R : 0;
      haze.mat.uniforms.uDay.value = (haze.set ? k : 0.12 + 0.88 * k) * (1 - smooth(20 * METRE, 300 * METRE, high));
      haze.set?.({ sun: light });
    },
    // F: a shot at the lock, or straight ahead; the gun it was (gunplay.js's kind), or false
    fire() {
      if (S.phase !== 'walk' || S.cool > 0) return false;
      const me = meP();
      if (!me?.spec.gun) return false;
      S.cool = me.spec.gun === 'bowcaster' ? 0.55 : 0.28;
      let target = S.troops.find((o) => o.id === S.lock && o.alive) ?? null;
      let mark = null;
      if (S.cam.first && S.cam.pos) {
        // out of your own eyes, the shot goes where you're looking, unless the lock's near it
        const look = S.cam.look.clone().sub(S.cam.pos).normalize();
        const to = target && new V(...vec.add(at(target, S.R), target.n, TROOPS[target.kind].tall * 0.55)).add(S.c).sub(S.cam.pos).normalize();
        if (!to || to.angleTo(look) > 0.12) {
          target = null;
          mark = S.cam.pos.clone().sub(S.c).addScaledVector(look, 40 * METRE);
        }
      }
      shoot(me, target, 'me', me.spec.gun === 'bowcaster' ? 2 : 1, 0, mark);
      S.aim = 1;
      if (!reduced) S.cam.kick.v += GUNS[me.spec.gun]?.kick.up ?? 1.5;
      return me.spec.gun;
    },
    // T: the next trooper round
    cycle() {
      const alive = troopsAlive().sort((a, b) => apart(S.me, a, S.R) - apart(S.me, b, S.R));
      if (!alive.length) return;
      const i = alive.findIndex((o) => o.id === S.lock);
      S.lock = alive[(i + 1) % alive.length].id;
    },
    // a tap on a trooper: lock on to it
    lockOn(id) {
      if (S.troops.find((o) => o.id === id && o.alive)) S.lock = id;
    },
    // Q: play the other one
    swap() {
      if (S.phase !== 'walk' || !party?.[1] || !S.mate) return false;
      [S.me, S.mate] = [{ ...S.mate, id: 'me' }, { ...S.me, id: 'mate' }];
      S.lead = 1 - S.lead;
      return party[S.lead].spec.id;
    },
    // G: back in the ship, if you're by it
    board() {
      if (S.phase !== 'walk' && S.phase !== 'out') return false;
      if (apart(S.me, S.spot, S.R) > FOOT.board + 0.26 * (PARKED[S.kind] ?? 1) * 0.6) return false;
      S.phase = 'board';
      S.t = 0;
      S.troops = S.troops.filter((o) => !o.alive);
      emit({ type: 'foot', id: 'in' });
      return true;
    },
    // a drag: turn (dx, px) and look up or down (dy, px)
    look(dx, dy) {
      if (!S.me || S.phase !== 'walk') return;
      S.me = { ...S.me, f: vec.unit(rotateAbout(S.me.f, S.me.n, -dx * 0.006)) };
      S.cam.pitch = Math.min(CAM.pitch[1], Math.max(CAM.pitch[0], S.cam.pitch + dy * 0.004));
    },
    // V on foot: out of your own eyes, or back over the shoulder
    first() {
      S.cam.first = !S.cam.first;
      return S.cam.first;
    },
    // a door you're at (a landing's: G there goes into the planet's page): { id, label } or null
    door() {
      const s = S.phase === 'walk' ? nearSpot() : null;
      return s?.label ? { id: S.id, label: s.label } : null;
    },
    // the targeting, for the HUD: what the gun's on, where it's pointed, the
    // way back to the ship, the health; and anything here that answers you
    info() {
      if (!S.phase || !S.me) return null;
      const me = meP();
      const lock = S.troops.find((o) => o.id === S.lock && o.alive) ?? null;
      const chest = (w, tall) => new V(...vec.add(at(w, S.R), w.n, tall * 0.55)).add(S.c);
      const spot = nearSpot();
      return {
        aim: chest(S.me, (me?.spec.tall ?? 1.8) * METRE).addScaledVector(new V(...S.me.f), 14 * METRE),
        lock: lock && { id: lock.id, kind: lock.kind, at: chest(lock, TROOPS[lock.kind].tall / 1), size: TROOPS[lock.kind].tall, dist: apart(S.me, lock, S.R) / METRE },
        ship: { at: new V(...S.spot.n).multiplyScalar(S.R + S.rest).add(S.c), dist: apart(S.me, S.spot, S.R) / METRE, near: apart(S.me, S.spot, S.R) <= FOOT.board + 0.26 * (PARKED[S.kind] ?? 1) * 0.6 },
        health: S.health / FOOT.health,
        hurt: Math.max(0, 1 - (S.clock - S.hitAt) / 0.4),
        who: me?.spec.name ?? null,
        mate: mateP()?.spec.name ?? null,
        troops: troopsAlive().map((o) => ({ id: o.id, at: chest(o, TROOPS[o.kind].tall) })),
        first: S.cam.first,
        near: spot && { label: spot.label, say: spot.say },
      };
    },
    // your crew as the other pilots see them (protocol.js's writeFoot):
    // where the ship is down and where you both are; null once you're
    // lifting off (or not down at all)
    crew() {
      if (!S.phase || S.phase === 'lift' || !S.spot) return null;
      const out = S.phase !== 'land';
      return {
        planet: S.id,
        kind: S.kind,
        ship: S.spot,
        lead: out ? walker(S.me, meP(), S.aim) : null,
        mate: out ? walker(S.mate, mateP(), S.mateAim) : null,
      };
    },
    guests: setGuests,
    // (for checking from a browser: who's down here with you, and as who)
    guestInfo() {
      return [...guests.values()].map((g) => ({
        id: g.id,
        name: g.name,
        dim: g.dim.code,
        walkers: g.walkers.filter(Boolean).map((wk) => ({ who: wk.who, alt: wk.alt, shown: wk.group.visible, metres: wk.w && S.me ? Math.round(apart(S.me, wk.w, S.R) / METRE) : null, bearing: wk.w && S.me ? +bearing(S.me.n, S.me.f, vec.add(wk.w.n, S.me.n, -1)).toFixed(3) : null })),
      }));
    },
    // which way is up where the camera is, and where it is (the map's space): what's below the horizon
    horizon() {
      return S.cam.pos ? { at: S.cam.pos, up: S.cam.up } : null;
    },
    // the ship's numbers to fly on from, once it's up (null until then)
    takeoff() {
      return S.done;
    },
    // all gone: the ground, the people, the planet turning again
    end() {
      const planet = planetOf[S.id];
      planet?.hold?.(false);
      if (planet?.air) planet.air.visible = true;
      if (planet?.body && S.hideBody) planet.body.visible = S.bodyShown;
      S.hideBody = 0;
      S.band = null;
      for (const p of party ?? []) {
        root.remove(p.group);
        p.gp?.dispose();
        p.fig.dispose?.();
      }
      party = null;
      for (const g of [...guests.values()]) dropGuest(g);
      for (const id of [...troopFigs.keys()]) dropTroop(id);
      for (const key of [...blobs.keys()]) dropShadow(key);
      for (const o of S.bolts) o.mesh.visible = false;
      S.bolts = [];
      fx.clear();
      if (vm) vm.gun.visible = false;
      for (const x of [ground, rocks, haze, sides]) {
        if (!x) continue;
        root.remove(x.mesh);
        x.dispose();
      }
      ground = rocks = haze = sides = null;
      cast?.dispose();
      cast = null;
      for (const o of owned) o?.dispose?.();
      owned.length = 0;
      if (S.model) S.model.group.scale.setScalar(1);
      root.visible = false;
      S.phase = null;
      S.id = null;
      S.me = S.mate = null;
      S.troops = [];
      S.done = null;
    },
    dispose() {
      this.end();
      boltGeo.dispose();
      sleeveGeo.dispose();
      fx.dispose();
      flare?.removeFromParent();
      if (vm) for (const o of vm.owned) o.dispose?.();
      shadowMat.dispose();
      for (const m of boltMats.values()) {
        m.core.dispose();
        m.sleeve.dispose();
      }
      puffTex.dispose();
      for (const s of puffs) s.material.dispose();
      map.remove(root);
    },
  };
}

const rotateAbout = (v, k, a) => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const kv = vec.cross(k, v);
  const d = vec.dot(k, v) * (1 - c);
  return [v[0] * c + kv[0] * s + k[0] * d, v[1] * c + kv[1] * s + k[1] * d, v[2] * c + kv[2] * s + k[2] * d];
};

// A crew member as a figure, for the galaxy's worlds (galaxy/surface/scene.js):
// in map units (scale by 1 / METRE for metres); `cast` is createMeshyCast()'s,
// for the cruiser's two
export { loadModel as loadPartyFigure };
