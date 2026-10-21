// The Citadel's crowds: every kind of Rick and Morty the site has, standing
// where ./layout.js's crowdFor(mood) puts them. Each kind is one light,
// still copy (scripts/crowd.mjs) drawn as an instanced mesh, so a rally of
// forty costs no more than a few figures. Neighbours are always different
// kinds, Ricks four to one Morty or so, as in the show's crowd scenes.
//
// None of them is a statue: each still copy breathes in the vertex shader,
// its chest rising and falling in a time and place of its own (a phase
// from where it stands), and on election day the rally bounces on its toes
// on the beats of Candidate Morty's campaign (a cheer every so often, and
// one at the ballot and the count), the hop on its instance's matrix so
// the ink line goes with it. The dozen nearest the camera whose kinds have
// a rigged model (./people.js's LIVE) are promoted to live figures in their
// places (`live`), each on its animator and stepped as animBudget.js says:
// breathing on its own idle, watching what its group watches (the holo-ads,
// the booth, the city, each other), looking round at Rick as he passes,
// talking with its hands in a three, and cheering on the beats.
//
// createCrowd(parent, { tier }) → Promise<{ setMood(mood), live(provider,
//   kinds), update(t, dt, { camera, budget, view, rick, cues }), dispose() }>
//   provider: { make(kind) → figure | null, free(figure) } (./people.js's
//   live and unlive); kinds: the kinds it can make (people.js's LIVE);
//   cues: the world's ({ type: 'beat' | 'vote' })

import * as THREE from 'three';
import { toon } from '../portal/toon';
import { lightRamp } from '../portal/meshyCastCore'; // (Meshy's textures carry their own shading: the cast's light ramp)
import { BOOTH, crowdFor } from './layout';
import { gltfLoader } from '../../../lib/three/gltf';
import { seeded } from '../../../lib/seeded';
import { createBeats, lookAt, nearestN, yawOf } from './bodies';
import { breathing, standing } from '../portal/crowdPaint';

const BASE = '/games/meshy/crowd';
// (the Ricklantis Mixup's last, after the rest: a phone's few are the first ones)
const RICKS = ['rick', 'cowboyrick', 'factoryrick', 'constructionrick', 'sweaterrick', 'suitrick', 'detectiverick', 'cop', 'wizardrick', 'hazmatrick', 'sheriffrick', 'retrorick', 'visorrick', 'doofusrick', 'mulletrick', 'chefrick', 'pilotrick', 'punkrick', 'rickd3', 'simplerick', 'evilrick', 'supremeguard', 'garmentrick'];
const MORTYS = ['morty', 'copmorty', 'hobbitmorty', 'beaniemorty', 'sheriffmorty', 'overallsmorty', 'maskmorty', 'glassesmorty', 'astronautmorty', 'punkmorty', 'bigmorty', 'slickmorty'];
// how tall each stands, in metres (a hat or a mohawk on top)
const TALL = { rick: 1.85, morty: 1.5, cowboyrick: 1.97, wizardrick: 2.15, chefrick: 2.05, detectiverick: 1.92, hazmatrick: 1.9, astronautmorty: 1.5, punkmorty: 1.62, sheriffmorty: 1.6, punkrick: 1.85, rickd3: 2.15, garmentrick: 1.92, bigmorty: 1.56 };
const heightOf = (n) => TALL[n] ?? (MORTYS.includes(n) ? 1.5 : 1.85);
// how many of each kind a device draws from
const KINDS_BY_TIER = { high: [...RICKS, ...MORTYS], mid: [...RICKS.slice(0, 12), ...MORTYS.slice(0, 6)], low: [...RICKS.slice(0, 7), ...MORTYS.slice(0, 3)] };
// how many are promoted to live figures, near the camera, by the device
const LIVE_N = { high: 12, mid: 6, low: 0 };
const LIVE_REACH = 28; // metres: none further than this is worth a figure
const PICK_EVERY = 0.4; // seconds between looks at who's nearest
const HOP = { len: 0.6, high: 0.11, spread: 0.7 }; // a cheer's bounce: seconds, metres, and how far it ripples (s)
const EYES = 1.72;

const hash = (i, k = 0) => (((Math.sin(i * 91.345 + k * 47.853) * 43758.5453) % 1) + 1) % 1;

// (each copy stood on the floor, and its breath: ../portal/crowdPaint.js,
// which the dimensions' crowds stand on too)
export { BREATH, breathing, standing } from '../portal/crowdPaint';

export async function createCrowd(parent, { tier = 'high' } = {}) {
  const loader = gltfLoader();
  const kinds = KINDS_BY_TIER[tier] ?? KINDS_BY_TIER.high;
  const owned = [];
  const clock = { value: 0 };
  // each kind: its geometry (feet on the ground, centred) and material
  const loaded = await Promise.all(
    kinds.map((name) =>
      loader
        .loadAsync(`${BASE}/${name}.glb`)
        .then((g) => {
          let mesh = null;
          g.scene.traverse((o) => {
            if (o.isMesh && !mesh) mesh = o;
          });
          if (!mesh) return null;
          g.scene.updateMatrixWorld(true);
          const geo = standing(mesh.geometry, mesh.matrixWorld, heightOf(name));
          const mat = breathing(toon(0xffffff, { map: mesh.material.map ?? null, gradientMap: lightRamp() }), clock, heightOf(name));
          owned.push(geo, mat, mesh.geometry);
          if (mesh.material.map) owned.push(mesh.material.map);
          mesh.material.dispose();
          return { name, geo, mat, morty: MORTYS.includes(name) };
        })
        .catch(() => null),
    ),
  );
  const ok = loaded.filter(Boolean);
  const ricks = ok.filter((k) => !k.morty);
  const mortys = ok.filter((k) => k.morty);
  if (!ok.length) return { setMood() {}, live() {}, update() {}, dispose() {} };
  let provider = null; // (who makes the live few: ./people.js)
  let liveKind = () => false;

  // who stands where, by mood: a kind for each place, never the same as the
  // one placed just before it
  const plan = (mood) => {
    const list = crowdFor(mood);
    const thin = tier === 'low' ? list.filter((_, i) => i % 2 === 0) : list;
    let last = null;
    return thin.map((c, i) => {
      const pool = mortys.length && hash(i, 1) < 0.22 ? mortys : ricks.length ? ricks : mortys;
      let kind = pool[Math.floor(hash(i, 2) * pool.length)];
      if (kind === last && pool.length > 1) kind = pool[(pool.indexOf(kind) + 1) % pool.length];
      last = kind;
      return { ...c, kind, scale: 0.96 + hash(i, 3) * 0.08, seed: hash(i, 4) };
    });
  };
  const plans = { day: plan('day'), election: plan('election'), red: [] };
  // one instanced mesh a kind, big enough for its most in any mood
  const meshes = new Map();
  for (const k of ok) {
    const most = Math.max(...Object.values(plans).map((p) => p.filter((c) => c.kind === k).length), 0);
    if (!most) continue;
    const m = new THREE.InstancedMesh(k.geo, k.mat, most);
    m.count = 0;
    m.name = `crowd-${k.name}`;
    parent.add(m);
    meshes.set(k, m);
  }

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const at = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const GONE = new THREE.Matrix4().makeScale(0, 0, 0);
  // where each of the mood's crowd is drawn: { c, mesh, index }
  let placed = [];
  const put = (p, y = 0) => {
    const { c, mesh, index } = p;
    // a walker's heading (+x to (cos, -sin)) as a figure's turn (they face +z)
    q.setFromAxisAngle(up, yawOf(c.face));
    m4.compose(at.set(c.x, y, c.z), q, sc.setScalar(c.scale));
    mesh.setMatrixAt(index, p.fig ? GONE : m4);
    mesh.instanceMatrix.needsUpdate = true;
  };
  let current = null;
  const setMood = (mood) => {
    const key = mood === 'red' ? 'red' : mood === 'election' ? 'election' : 'day';
    if (key === current) return;
    current = key;
    // (the live ones go back to the cast, before their places change)
    for (const p of placed) if (p.fig) provider?.free(p.fig);
    placed = [];
    for (const m of meshes.values()) m.count = 0;
    for (const c of plans[key]) {
      const m = meshes.get(c.kind);
      if (!m) continue;
      const p = { c, mesh: m, index: m.count, fig: null, hop: null };
      m.count += 1;
      placed.push(p);
      put(p);
    }
    for (const m of meshes.values()) {
      m.instanceMatrix.needsUpdate = true;
      m.visible = m.count > 0;
      m.computeBoundingSphere();
    }
  };
  setMood('day');

  // ── the live few ──
  const live = (p, kinds = null) => {
    provider = p ?? null;
    liveKind = kinds ? (c) => kinds.has(c.kind.name) : () => true;
  };
  const rand = seeded(0xc40d);
  const beats = createBeats({ seed: 0x7a11, every: [9, 16] });
  const want = LIVE_N[tier] ?? LIVE_N.high;
  let pickIn = 0;
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  const rickHead = new THREE.Vector3();
  const booth = new THREE.Vector3(BOOTH.x, 1.9, BOOTH.z);
  const ads = new THREE.Vector3(0, 8, 0);
  // where a group's eyes go: the holo-ads, the booth, the city, the door, each other
  const gaze = (p) => {
    const g = p.c.group;
    if (g === 'core') return ads;
    if (g === 'rally') return booth;
    if (g === 'edge') return { x: p.c.x * 2, y: 0, z: p.c.z * 2 };
    if (g === 'talk' && p.talkTo) return { x: p.talkTo.c.x, y: EYES * p.talkTo.c.scale, z: p.talkTo.c.z };
    return null;
  };
  const promote = (p) => {
    const kind = p.c.kind.name;
    const fig = provider.make(kind);
    if (!fig) return;
    p.fig = fig;
    fig.group.position.set(p.c.x, 0, p.c.z);
    fig.group.rotation.y = yawOf(p.c.face);
    fig.group.scale.setScalar(p.c.scale);
    fig.lookAt = null;
    p.talkIn = 1 + p.c.seed * 4;
    // a three's: the next of its three round, to look at as it talks
    if (p.c.group === 'talk') {
      const i = placed.indexOf(p);
      const first = i - (placed.slice(0, i).filter((o) => o.c.group === 'talk').length % 3);
      p.talkTo = placed[first + ((i - first + 1) % 3)] ?? null;
    }
    put(p);
  };
  const demote = (p) => {
    provider?.free(p.fig);
    p.fig = null;
    put(p);
  };

  // a beat: the rally bounces and cheers, a ripple back from the front
  const cheer = (t) => {
    for (const p of placed) {
      if (p.c.group !== 'rally' || p.c.seed < 0.2) continue;
      const from = t + p.c.seed * HOP.spread;
      if (p.fig) {
        if (rand() < 0.85) p.cheerAt = from;
      } else p.hop = from;
    }
  };

  const update = (t, dt, { camera = null, budget = null, view = null, rick = null, cues = null } = {}) => {
    clock.value = t;
    // the beats: Candidate Morty's rally, on election day
    let beat = beats.tick(t, current === 'election');
    for (const c of cues ?? []) if (c.type === 'beat' || c.type === 'vote') beat = true;
    if (beat && current === 'election') cheer(t);
    // the still ones' bounce
    for (const p of placed) {
      if (p.hop == null) continue;
      const k = (t - p.hop) / HOP.len;
      if (k < 0) continue;
      if (k >= 1) {
        p.hop = null;
        put(p);
      } else put(p, Math.sin(k * Math.PI) * HOP.high);
    }
    if (!provider || !want || !camera) return;
    // who's live: the nearest of the kinds that can be, now and then
    if ((pickIn -= dt) <= 0) {
      pickIn = PICK_EVERY;
      parent.updateWorldMatrix(true, false);
      local.copy(camera.position);
      parent.worldToLocal(local);
      const now = [];
      placed.forEach((p, i) => p.fig && now.push(i));
      const pts = placed.map((p) => p.c);
      const next = new Set(nearestN(pts, local, want, now, { margin: 2, ok: (c) => provider && liveKind(c) && Math.hypot(c.x - local.x, c.z - local.z) < LIVE_REACH }));
      for (const i of now) if (!next.has(i)) demote(placed[i]);
      for (const i of next) if (!placed[i].fig) promote(placed[i]);
    }
    if (rick) rickHead.set(rick.x, EYES, rick.z);
    for (const p of placed) {
      const f = p.fig;
      if (!f) continue;
      // Rick, passing close: a look round at him; else what its group's watching
      const near = rick && Math.hypot(rick.x - p.c.x, rick.z - p.c.z) < 3.2;
      lookAt(f, near ? rickHead : gaze(p));
      if (p.cheerAt != null && t >= p.cheerAt) {
        p.cheerAt = null;
        f.play('cheer');
      }
      // a three: its turn to talk, now and then
      if (p.c.group === 'talk' && (p.talkIn -= dt) <= 0) {
        p.talkIn = 3 + rand() * 5;
        f.play('talk', { layer: 'upper', loop: true, lasts: 2 + rand() * 2.5 });
      }
      let lodRate = 1;
      if (budget) {
        f.group.getWorldPosition(world);
        lodRate = budget.rate(world, camera, view ? view(world) : true);
      }
      f.update(t, 0, 0, { lodRate });
    }
  };
  // (the live ones are the cast's, disposed with it)
  const dispose = () => {
    placed = [];
    provider = null;
    for (const m of meshes.values()) m.removeFromParent();
    meshes.clear();
    for (const o of owned) o.dispose?.();
    owned.length = 0;
  };
  return { setMood, live, update, dispose };
}
