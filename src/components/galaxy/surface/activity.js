// What's out in the world for the quest you're on (quests.js says where you
// are in it): a beam of light where it wants you to go, the things to pick
// up, the gates of a race (the next one lit), and what's to be shot at
// (targets, womp rats, droids, troopers who shoot back), each a figure
// that wanders or holds its ground and goes down when it's hit enough.
//
// createActivity({ parent, world, warm, beam color }) → { show(quest,
// progress), update(dt, you, t) → events (pickups and kills, for the
// quest), targets (what the blaster can hit: { x, y, z, r, hit(damage) }),
// kill(tag), shooters (who fire back, or swipe: { from, spread, damage,
// melee }), clear(), dispose() }
//
// A step's spawn: { kind, n, at, spread, roam, speed, hp, tag, scale,
// model, still, face, y, level (the height it's on, where there are
// floors over floors: a pit under a throne room), leash, hostile: { range, every, spread, damage,
// burst, strafe, shield (hostiles.js's: bursts of fire, circling you, a shield that soaks hits),
// blade ({ color, hilt?, stance? }: a lit saber in its hand, and it fences: duellists.js), parry (the share of your strokes a
// duellist blocks), riposte (the share of those it parries), guard (strokes it turns before its guard breaks and it reels),
// delay (before its first shot), chase (m/s: it comes for you), melee,
// reach (how close it has to be to hit), cone, far, smell, memory (what it
// perceives: hostiles.js's sensesFor), force ({ every, push }: a duellist's
// shove at you, every so often, close to) }, side ('yours': it fights beside
// you, at the nearest hostile, and the hostiles fire at it; a shot's `at`
// and `victim` say so) }
//
// Every figure has a head (hostiles.js's hostileStep, on lib/ai): it
// knows you only as it perceives you (the world's solids are its line of
// sight: walker.js's lineClear), weighs what to do with you in sight (hold
// and fire, strafe, close, back off, take cover from your line of fire or
// flank round when it has no shot: `shot` tokens, SHOTS at once across the
// world, and `melee` tokens, one swing at a time), goes to look where it
// last had you, and joins its group's search (one lib/ai/search a tag: the
// spots that could hide you round where you were lost, shared) before it
// goes back to its wander. Its shots go to what it believes (a shot's `to`,
// which the scene aims at; `guessed` when it can only guess). An `update`
// event { type: 'search', tag } says a group has started looking.
//
// And a body that shows it (hostiles.js's hostileBody, the seam from
// brain to body): its feet paced to the ground its head moves it over (a
// strafer's hips toward its travel, its chest on you), its head on what it
// watches or sweeping as it searches, with a '?' over it while it looks
// for you and a '!' when it has you again; crouched in cover once it's
// there, standing to fire. A rigged one holds its gun in its hand and
// raises it to aim and fire from the muzzle (universe/gunplay.js, as
// yours), or plays the pistol's aim and shot on its upper half; a
// duellist's saber is in its own hand, held at guard and swung in its
// strokes (heldBlade.js's bladeInHand; duellists.js fences with it: what
// lands on you is what its blade sweeps, handed to the scene through
// shooters as a melee contact). It flinches by where it's hit, goes down by
// the way the shot went (die.fwd, die.back, die.blown) and lies a while
// before it goes; one with no clips falls over about its feet that way. A
// Tusken brandishes its rifle over its head when it sees you. Bodies never
// change what the heads decide: every shot, kill and event is as it was.
// hit(t, damage, { at }) takes where it landed (a point in the world: the
// head or the chest).

import * as THREE from 'three';
import { buildFigure } from './figures';
import { anyFigure, modelFigure } from './actors';
import { crewFigure } from './crew';
import { PROPS } from './props';
import { groundAt, shoreStep, turnToward } from './walker';
import { stepTarget } from './quests';
import { rng } from './noise';

// ── the pure parts ──
// a duellist's Force: its push falls due every `force.every` seconds while
// you're within 8 m of it (t.forceAt: when it last pushed)
export const nextForce = (t, h, dYou, time) => Boolean(h?.force) && dYou <= 8 && time - (t.forceAt ?? -99) >= (h.force.every ?? 7);
// one on your side (spec.side: 'yours') fights the nearest hostile that's
// up, never you and never its own side
export function friendlyAim(t, targets) {
  if (t.spec?.side !== 'yours') return null;
  let best = null;
  let bd = Infinity;
  for (const o of targets) {
    if (o === t || o.down || !o.hostile || o.spec?.side === 'yours') continue;
    const d = Math.hypot(o.b.x - t.b.x, o.b.z - t.b.z);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}
// a hostile's mark: you, or a friend of yours nearer to it than you are
// ({ x, z, victim }: the friend, or null when it's you; null with nobody)
export function hostileAim(t, you, targets) {
  let best = you ? { x: you.x, z: you.z, victim: null } : null;
  let bd = you ? Math.hypot(you.x - t.b.x, you.z - t.b.z) : Infinity;
  for (const o of targets) {
    if (o === t || o.down || o.spec?.side !== 'yours') continue;
    const d = Math.hypot(o.b.x - t.b.x, o.b.z - t.b.z);
    if (d < bd) {
      bd = d;
      best = { x: o.b.x, z: o.b.z, victim: o };
    }
  }
  return best;
}
// What a hostile carries, by kind (universe/gunplay.js's GUNS): a Tusken's
// long cycler rifle, Jango's WESTAR-34, the troopers' E-11s, the clones'
// DC-15As, the battle droids' E-5s, a Rebel's A280; a blaster pistol for
// anyone else with a gun (a spawn's own `gun` first). A duellist carries
// its saber; a brawler, a beast or a target that doesn't fight back, nothing.
export { ARMS }; // (ground/troops.js's: the one table)
export function armsOf(s) {
  const h = s?.hostile;
  if (!h) return null;
  if (h.blade) return 'saber';
  if (h.melee) return null;
  return s.gun ?? ARMS[s.kind] ?? 'blaster';
}
// how one starts when it sees you, by kind, in place of react.js's alert:
// a Tusken's cry, its rifle brandished over its head (a clip on its upper
// half, so long, the gun's own pose let go meanwhile)
const STARTS = { tusken: { clip: 'cheer', for: 1.6 } };
// up to fire: its next shot due within half a second (and not left waiting
// long for its turn), or one just fired: what stands it out of its crouch
// and brings the gun up, ahead of the shot rather than after it
export const upToFire = (t, time) => Boolean(t.aim && t.cool < 0.5 && t.cool > -0.4) || time - (t.firedAt ?? -Infinity) < 0.9;
// going down: a fall over `fall` seconds about its feet (for one with no
// clip to fall on; a clip's own length otherwise), then lying `lie`, then
// sinking `deep` metres over `sink` and gone
export const DEATH = { fall: 0.9, lie: 2, sink: 0.6, deep: 0.35 };
// `down` seconds after it went (len: its clip's length, null for the tip)
// → { k (0…1 of the tip), sink (metres), gone }
export function fallen(down, len = null) {
  const lain = (len ?? DEATH.fall) + DEATH.lie;
  return { k: Math.min(1, down / DEATH.fall), sink: down > lain ? Math.min(1, (down - lain) / DEATH.sink) * DEATH.deep : 0, gone: down > lain + DEATH.sink };
}
import { absorb, ALERT_CLIP, bodyClip, createPosture, fallOf, hostileBody, hostileStep, startBurst, stepBurst, whereHit } from './hostiles';
import { lineClear } from './walker';
import { createTokens } from '../../../lib/ai/squad';
import { createSearch } from '../../../lib/ai/search';
import { candidates } from '../../../lib/ai/spatial';
import { createPortalFx, meshyJoints } from '../../../lib/three/portalFx';
import { createGadgetFx } from '../../../lib/three/gadgetFx';
import { fallTurn } from '../../../lib/three/locomotion';
import { preload } from '../../../lib/three/clipLibrary';
import { createGunplay } from '../../universe/gunplay';
import { SHOW_KILLS } from './weaponRules';
import { bladeInHand } from './heldBlade';
import { blastClass } from './walkers';
import { asTarget, clashes, duelFor, fence, landed, reeling, stun, turnOf } from './duellists';
import { onHit } from '../../../lib/combat/duel';
import { sharpen } from '../../../lib/three/textures';
import { ARMS } from './ground/troops';
import { hitSide } from '../../../lib/three/walrusSets/additive';
import { detailLevel } from '../../../lib/detail';
import { loadScene, playScene } from '../../../lib/three/scenePlayer';
import { richClips } from '../../../lib/three/walrus';
import { introScene } from '../../../lib/three/walrusSets/scenes';

const SHOTS = 3; // enemies firing at you at once, across a world (the rest move)
const UP = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _from = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _yq = new THREE.Quaternion();

const BEAM_VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BEAM_FRAG = `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uTime;
void main() {
  float edge = 1.0 - abs(vUv.x - 0.5) * 2.0;
  float a = pow(edge, 2.0) * (1.0 - vUv.y) * (0.55 + 0.25 * sin(uTime * 3.0 - vUv.y * 12.0));
  gl_FragColor = vec4(uColor * 2.2, a);
}`;

// a beam of light standing on a spot, and a ring round it on the ground
function beam(color) {
  const g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({ vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const geo = new THREE.CylinderGeometry(1.1, 1.1, 60, 20, 1, true).translate(0, 30, 0);
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 6;
  g.add(m);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.9, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.5), toneMapped: false, transparent: true, opacity: 0.8, depthWrite: false }));
  ring.position.y = 0.08;
  g.add(ring);
  g.userData = { mat, ring };
  return g;
}

// something to pick up: a glowing crate (or a droid part, a power cell)
function pickupMesh(color) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: '#c8c2b6', roughness: 0.5, metalness: 0.4, emissive: new THREE.Color(color), emissiveIntensity: 0.6 }));
  box.position.y = 0.6;
  box.castShadow = true;
  g.add(box);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.5), transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.y = 0.6;
  g.add(glow);
  return g;
}

// a gate of a race: a ring standing across the way, lit when it's next
function gateMesh() {
  const m = new THREE.Mesh(new THREE.TorusGeometry(6, 0.35, 10, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, transparent: true, opacity: 0.85 }));
  m.position.y = 5;
  return m;
}

// a training remote, hovering and darting (for blaster practice)
function remote() {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), new THREE.MeshStandardMaterial({ color: '#6a6e74', metalness: 0.7, roughness: 0.3 }));
  g.add(ball);
  for (let i = 0; i < 6; i++) {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 6), new THREE.MeshBasicMaterial({ color: '#ff5a3a' }));
    const a = (i / 6) * Math.PI * 2;
    n.position.set(Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22);
    n.rotation.z = Math.PI / 2;
    n.rotation.y = -a;
    g.add(n);
  }
  return { model: g, tall: 0.45, update() {}, dispose() {}, hover: 1.6 };
}

// (the womp rats are the catalogue's model now: catalog/library.js)
const SPECIAL = { remote };

// A health bar over a hostile's head: a sprite with a small canvas, red
// for what's left, blue over it for a shield, redrawn only when they change
export function healthBar() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 10;
  const c = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  sharpen(texture);
  texture.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }));
  sprite.scale.set(0.9, 0.14, 1);
  sprite.renderOrder = 5;
  return {
    sprite,
    draw(hp, shield, guard = 0) {
      c.clearRect(0, 0, 64, 10);
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.fillRect(0, 2, 64, 6);
      c.fillStyle = '#ff4a3d';
      c.fillRect(1, 3, Math.round(62 * Math.max(0, Math.min(1, hp))), 4);
      if (shield > 0) {
        c.fillStyle = '#7fd0ff';
        c.fillRect(1, 0, Math.round(62 * Math.min(1, shield)), 2);
      }
      // (a duellist's guard: white over the top, gone when it's broken)
      if (guard > 0) {
        c.fillStyle = '#ffffff';
        c.fillRect(1, 0, Math.round(62 * Math.min(1, guard)), 2);
      }
      texture.needsUpdate = true;
    },
    dispose() {
      texture.dispose();
      sprite.material.dispose();
    },
  };
}

// The marks over a hostile's head: '?' while it looks for you, '!' when it
// has you again. One canvas each, shared by every head that shows it.
export function markMaterials() {
  const made = {};
  return {
    of(ch) {
      if (made[ch]) return made[ch];
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const c = canvas.getContext('2d');
      c.font = 'bold 54px system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 7;
      c.strokeStyle = 'rgba(0,0,0,0.75)';
      c.strokeText(ch, 32, 35);
      c.fillStyle = ch === '!' ? '#ff5a3d' : '#ffd36a';
      c.fillText(ch, 32, 35);
      const texture = new THREE.CanvasTexture(canvas);
      sharpen(texture);
      made[ch] = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
      return made[ch];
    },
    dispose() {
      for (const m of Object.values(made)) {
        m.map.dispose();
        m.dispose();
      }
    },
  };
}

export function createActivity({ parent, world, warm = (o) => Promise.resolve(o), color = '#ffd36a', kit = null, onShow = null, blast = null }) {
  const group = new THREE.Group();
  group.name = 'activity';
  parent.add(group);
  // Rick's guns' kills: through a portal, frozen and shattered, shrunk and
  // popped (onShow(how, event) for the sounds of them)
  const pfx = createPortalFx({ parent: group });
  const gfx = createGadgetFx({ parent: group });
  const marker = beam(color);
  marker.visible = false;
  group.add(marker);
  let pickups = []; // { mesh, at, item, taken }
  let gates = []; // meshes
  let targets = []; // { tag, holder, fig, b, hp, hostile, down, spec }
  let shown = { quest: null, step: -1 };
  let dead = false;
  const r = rng(7);
  const tokens = createTokens({ pools: { shot: SHOTS, melee: 1 }, timeout: 0.9 }); // (a shot's token frees itself a moment after the shot)
  const searches = new Map(); // tag → the group's search (lib/ai/search)
  const stims = []; // (your shots, heard: the scene may push them; cleared each update)
  const seesThrough = (a, b) => lineClear(world.solids, a, b);
  // the spots a search looks in: round where you were lost, out of sight of it
  const hidingSpots = (b) => [...candidates(b.at, { ring: 8, n: 8 }), ...candidates(b.at, { ring: 16, n: 12 })].filter((p) => !seesThrough(b.at, p));
  const searchFor = (tag) => {
    if (!searches.has(tag)) searches.set(tag, createSearch({ rand: r, spots: hidingSpots, time: 30 }));
    return searches.get(tag);
  };
  const marks = markMaterials();

  // (the pickups and gates are made here for the step, each its own
  // geometry and materials: gone with it)
  const release = (o) =>
    o.traverse((m) => {
      if (!m.isMesh) return;
      m.geometry.dispose();
      for (const mat of [m.material].flat()) mat.dispose();
    });
  const clearStep = () => {
    searches.clear();
    tokens.clear();
    for (const t of targets) {
      t.show?.dispose();
      t.bar?.dispose();
      t.blade?.dispose();
      t.gp?.dispose();
    }
    for (const p of pickups) {
      p.mesh.removeFromParent();
      release(p.mesh);
    }
    for (const g of gates) {
      g.removeFromParent();
      release(g);
    }
    for (const t of targets) {
      t.holder.removeFromParent();
      t.fig?.dispose?.();
    }
    pickups = [];
    gates = [];
    targets = [];
  };

  // (a world that takes models only: api.modelsOnly(), cast.js)
  let only = false;
  const figure = async (kind, spec) => {
    if (SPECIAL[kind]) return SPECIAL[kind]();
    // (a world that takes models only: a model, a stand-in or nothing; cast.js)
    if (only) return anyFigure(kind, spec, kit, 0, undefined, { only });
    if (spec.model !== false) {
      // (a walking crew figure first: a rigged one holds its gun or its blade
      // in its own hand; else the catalogue's model, which holds a blade
      // where its hand would hang)
      const crew = () => crewFigure(kind).catch(() => null);
      const still = () => modelFigure(kind).catch(() => null);
      const m = (await crew()) ?? (await still());
      if (m) return m;
    }
    const f = buildFigure(kind);
    if (f) return f;
    if (PROPS[kind] && kit) {
      const made = PROPS[kind](kit, spec.opts ?? {});
      // (it walks: its scans go with it, kit.js's twins)
      kit.moving?.(made.object);
      let t = 0;
      return { model: made.object, tall: 4, update: (dt, move) => made.update?.((t += dt), dt, move), dispose() {} };
    }
    return null;
  };

  // what it carries, in its hand: a rigged figure's gun in its own right
  // hand (gunplay.js, raised to aim), its lightsaber lit there (heldBlade.js's
  // bladeInHand) and a duellist's mind to fence with it (duellists.js); a
  // figure without hand bones carries neither (every duellist is a rigged
  // crew figure: crewList.js)
  const armed = (t, fig) => {
    const s = t.spec;
    const kind = armsOf(s);
    if (!kind) return;
    t.holder.updateMatrixWorld(true);
    if (kind === 'saber') {
      t.blade = bladeInHand(fig, s.hostile.blade, { parent: group, stance: s.hostile.blade.stance ?? 'single', who: s.kind });
      if (t.blade) t.duel = duelFor(s, Math.round(t.home[0] * 13) * 31 + Math.round(t.home[1] * 17) + targets.indexOf(t) * 7919 + 1);
      return;
    }
    if (fig.model?.getObjectByName('RightHand')?.isBone) t.gp = createGunplay({ model: fig.model, bones: fig.bones, sockets: fig.sockets, stance: fig.stance, aimAt: fig.aimAt }, kind, { unit: 1, who: s.kind });
  };

  // a duellist's entrance, the game's own for its kind, on a device that loads the extras
  const entrance = (t) => {
    const id = t.fig?.anim && richClips(detailLevel()) ? introScene(t.spec.kind) : null;
    if (id) loadScene(id).then((sc) => sc && t.fig && !t.down && playScene(sc, { [t.spec.kind]: t.fig }));
  };

  // the step's own things, put out
  const build = (quest, progress) => {
    clearStep();
    const step = quest?.steps[progress?.step];
    if (!step) return;
    if (step.type === 'collect')
      pickups = step.spots.map((at) => {
        const mesh = pickupMesh(step.color ?? color);
        mesh.position.set(at[0], groundAt(world, at[0], at[1], step.level ?? Infinity), at[1]);
        group.add(mesh);
        return { mesh, at, item: step.item, taken: false };
      });
    if (step.type === 'race')
      gates = step.gates.map((at, i) => {
        const g = gateMesh();
        const next = step.gates[i + 1] ?? step.gates[i - 1] ?? [at[0], at[1] + 1];
        const holder = new THREE.Group();
        holder.position.set(at[0], groundAt(world, at[0], at[1]), at[1]);
        holder.rotation.y = Math.atan2(next[0] - at[0], next[1] - at[1]) * (step.gates[i + 1] ? 1 : -1);
        holder.add(g);
        group.add(holder);
        return holder;
      });
    if (step.spawn)
      for (const s of [].concat(step.spawn)) {
        for (let i = 0; i < (s.n ?? 1); i++) {
          const a = r() * Math.PI * 2;
          const d = Math.sqrt(r()) * (s.spread ?? 0);
          const home = [s.at[0] + Math.cos(a) * d, s.at[1] + Math.sin(a) * d];
          const holder = new THREE.Group();
          holder.visible = false;
          group.add(holder);
          const t = { tag: s.tag ?? step.tag, holder, fig: null, b: { x: home[0], z: home[1], yaw: s.face ?? r() * 6.28, to: null, wait: r() * 2 }, home, hp: s.hp ?? 1, hostile: s.hostile ?? null, down: 0, spec: s, cool: s.hostile?.delay ?? 1 + r() * 2, flinch: 0, shield: s.hostile?.shield ?? 0, burst: null, bubble: null, stagger: 0, knock: null, bar: null, barAt: null, guard: s.hostile?.guard ?? 0, guardAt: -99 };
          // its body's own (no draw from r: the spawns and their heads are as they were)
          Object.assign(t, { posture: createPosture({ seed: targets.length * 7919 + Math.round(home[0] * 13) * 31 + Math.round(home[1] * 17) }), pose: null, gp: null, blade: null, firedAt: -99, kick: 0, death: null, reacted: false, mark: null, based: null, looked: null, duel: null, duelMark: null, engaged: false, blocking: false, contacts: [] });
          targets.push(t);
          if (t.shield) {
            // its shield: a bubble round it, bright for a moment where it's hit
            const bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), new THREE.MeshBasicMaterial({ color: '#7fd0ff', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
            const tall = (s.tall ?? 1.8) * (s.scale ?? 1);
            bubble.position.y = tall * 0.5;
            bubble.scale.setScalar(tall * 0.75);
            bubble.userData.flash = 0;
            holder.add(bubble);
            t.bubble = bubble;
          }
          figure(s.kind, s).then((fig) => {
            if (!fig || dead || !holder.parent) return;
            fig.model.scale.multiplyScalar(s.scale ?? 1);
            holder.add(fig.model);
            t.fig = fig;
            armed(t, fig);
            fetchFight(fig);
            warm(holder).then(() => (holder.visible = true));
          });
        }
      }
  };

  // gone down: which way (the way the shot went, else away from you, else
  // back) and how hard (a blast or a shove takes it off its feet), for its body
  let lastYou = null;
  const fell = (t, { push = null, blown = false } = {}) => {
    t.down = 0.001;
    if (t.duel) onHit(t.duel, { dead: true });
    t.death = { dir: fallOf({ push, from: lastYou, at: t.b, yaw: t.b.yaw }), force: blown || t.knock ? 1 : 0.3, clip: null, started: false, y: null };
  };
  // hit and still up: a flinch by where (the head, high up; else the chest),
  // on its upper half so its feet keep on as its head has them
  const flinched = (t, at = null) => {
    if (t.down) return;
    const tall = (t.fig?.tall ?? 1.8) * (t.spec.scale ?? 1);
    // (and the side it came in from, round the way it faces: a 2017 figure's additive flinch, lib/three/additiveLayer.js)
    const side = at ? hitSide([at.x - t.b.x, at.z - t.b.z], t.b.yaw) : null;
    if (t.fig?.react?.('hit', { where: whereHit(at?.y, t.holder.position.y, tall), side, moving: true })) t.reacted = true;
  };

  // its guard broken by a heavy stroke, or spent: it reels 2 s
  const broke = (t) => {
    t.stagger = Math.max(t.stagger, 2);
    stun(t, t.stagger);
    flinched(t);
  };

  // the line from its chest to a point (y: the point's height, else level)
  const lineTo = (t, p) => {
    const tall = (t.fig?.tall ?? 1.8) * (t.spec.scale ?? 1);
    _from.set(t.b.x, t.holder.position.y + tall * 0.78, t.b.z);
    _dir.set(p.x, p.y ?? _from.y, p.z).sub(_from);
    return _dir.lengthSq() > 1e-6 ? _dir.normalize() : null;
  };
  // the clips a rigged one plays in a fight, fetched once its first figure's in
  let fetched = false;
  const fetchFight = (fig) => {
    if (fetched || !fig.anim) return;
    fetched = true;
    preload(['die.fwd', 'die.back', 'die.blown', 'hit.chest', 'hit.head', 'crouch', 'shoot.pistol', 'aim.pistol', 'jab', 'cheer']).catch(() => {});
  };

  // a duellist's blade through someone: you, for the scene (shooters hands
  // it on, and your block decides it); a friend of yours, as any hit
  const struckBy = (t, x, damage, at, o) => {
    const c = landed(t, x, damage, at, o);
    if (c) t.contacts.push(c);
    else if (!x.down && targets.includes(x)) api.hit(x, damage, { at });
  };
  const youT = asTarget();

  // A figure's body for its step, once the step's placed its holder: its
  // feet on the ground the step covers, its crouch, its head, its start on
  // seeing you, then (after its own bones are laid) its gun or its blade
  const body = (t, pose, move, dt, time, you, eye) => {
    const fig = t.fig;
    const b = t.b;
    // crouched in cover (a base state: only ever while its feet are still)
    if (pose.base !== t.based) {
      t.based = pose.base;
      fig.base?.(bodyClip(fig, pose.clip, pose.base));
    }
    // where its head goes: its mark at the height it stands (you, or a
    // friend of yours), else a spot at its own eyes' height
    const p = pose.look;
    const onMark = p && t.aim && Math.abs(p.x - t.aim.x) + Math.abs(p.z - t.aim.z) < 0.01;
    const want = p ? { x: p.x, y: onMark ? (t.victim ? t.victim.holder.position.y + 1.4 : you ? (you.y ?? 0) + 1.5 : undefined) : undefined, z: p.z } : null;
    const was = t.looked;
    if (!want !== !was || (want && (Math.hypot(want.x - was.x, want.z - was.z) > 0.25 || Math.abs((want.y ?? 0) - (was.y ?? 0)) > 0.2))) {
      t.looked = want;
      fig.look?.(want);
    }
    // seeing you: a Tusken's cry, its rifle over its head; anyone else's own start (react.js's alert)
    if (pose.alert && t.hostile && t.spec.side !== 'yours' && fig.anim) {
      const start = STARTS[t.spec.kind];
      if (start && fig.play) {
        t.startUntil = time + start.for;
        fig.play(start.clip, { layer: 'upper' }).then((ok) => !ok && (t.startUntil = 0));
      } else if (fig.clips?.[ALERT_CLIP] && fig.play) fig.play(ALERT_CLIP, { layer: 'upper' });
      else fig.react?.('alert', { target: want });
    }
    // its feet on the ground the step covers (and, on a figure that lays
    // them in its update, the bones over its clips: crew.js's)
    fig.update(dt, move, pose.motion);
    _fwd.set(Math.sin(b.yaw), 0, Math.cos(b.yaw));
    t.blade?.stand(dt, time, move);
    if (fig.anim || fig.after || t.gp || t.blade) t.holder.updateMatrixWorld(true);
    fig.after?.(dt, pose.motion, { forward: _fwd, up: UP });
    // its gun: up on its mark, or carried with its head and chest toward
    // where it looks (fired from the muzzle: shooters)
    const dir = want ? lineTo(t, want) : null;
    if (t.gp && !(time < (t.startUntil ?? 0))) t.gp.set(dt, { aim: pose.aim, look: dir ? 1 : 0, dir, forward: _fwd, up: UP });
    if (t.blade) {
      // (its stroke's root travel and its turn to its lock write into its own walk: b)
      t.blade.block(t.blocking, t.blockSide);
      t.blade.pose(dt, time, { forward: _fwd, up: UP, me: b, dir, eye, targets: t.duelMark ? [t.duelMark] : [], hit: (x, damage, at, o) => struckBy(t, x, damage, at, o) });
    }
    // the pistol's aim, held on its upper half since its last shot (a rigged
    // one with no gun of its own to raise), let down a while after
    if (t.aimHeld && !pose.aim && time - t.firedAt > 2) {
      t.aimHeld = false;
      fig.stop?.(0.3, 'upper');
    }
  };

  // Going down: on its own clip by the way it was struck (react.js's down:
  // die.fwd, die.back, die.blown, else a fall), or with none to play, over
  // about its feet that way; carried on along a shove that took it; lying a
  // while, then into the ground and gone
  const STOOD = { speed: 0, side: 0, turn: 0 };
  const dying = (t, dt, time, eye) => {
    const d = (t.death ??= { dir: fallOf({ from: lastYou, at: t.b, yaw: t.b.yaw }), force: 0.3, clip: null, started: false, y: null });
    const fig = t.fig;
    const hover = fig?.hover ?? t.spec.y ?? 0;
    if (!d.started) {
      d.started = true;
      if (t.bar) t.bar.sprite.visible = false;
      if (t.mark) t.mark.visible = false;
      t.holder.rotation.set(0, t.b.yaw, 0);
      // (up out of a crouch, so it falls on its whole body; whatever its upper
      // half held let go, its head no longer on anything)
      if (t.based) fig?.base?.(null);
      t.based = null;
      fig?.stop?.(0.15, 'upper');
      fig?.look?.(null);
      d.clip = fig?.react?.('down', { dir: d.dir, yaw: t.b.yaw, force: d.force })?.clip ?? null;
      // (a walker or droideka goes up in lane F's blast for its class as it falls: walkers.js's blastClass)
      const cls = blastClass(t.spec.kind);
      if (cls && blast) blast(new THREE.Vector3(t.b.x, groundAt(world, t.b.x, t.b.z, t.spec.level ?? Infinity) + (fig?.tall ?? 2) * 0.5, t.b.z), cls);
      d.y = groundAt(world, t.b.x, t.b.z, t.spec.level ?? Infinity) + hover;
    }
    const k = t.knock;
    if (k) {
      t.b.x += k.vx * dt;
      t.b.z += k.vz * dt;
      k.vy -= 14 * dt;
      k.y = Math.max(0, k.y + k.vy * dt);
      k.vx *= 1 - Math.min(1, dt * 2.5);
      k.vz *= 1 - Math.min(1, dt * 2.5);
      d.y = groundAt(world, t.b.x, t.b.z, t.spec.level ?? Infinity) + hover;
      if (k.y <= 0 && k.vy < 0) t.knock = null;
    }
    // (a clip that never came, fetched and failed: over about its feet from now)
    if (d.clip && fig?.anim && t.down > 1.5 && fig.anim.playing?.('full') !== d.clip) {
      d.clip = null;
      d.tipAt = t.down;
      fig.stop?.(0.1, 'full');
    }
    const f = d.clip ? fallen(t.down, fig.anim?.actions?.[d.clip]?.getClip().duration ?? 2) : fallen(t.down - (d.tipAt ?? 0));
    _fwd.set(Math.sin(t.b.yaw), 0, Math.cos(t.b.yaw));
    if (d.clip) {
      fig.update(dt, 0, STOOD);
      t.holder.updateMatrixWorld(true);
      fig.after?.(dt, STOOD, { forward: _fwd, up: UP });
    } else {
      fallTurn(f.k, _dir.set(d.dir.x, 0, d.dir.z), UP, _q);
      t.holder.quaternion.copy(_q.multiply(_yq.setFromAxisAngle(UP, t.b.yaw)));
    }
    t.blade?.out(dt, time, { forward: _fwd, up: UP, eye });
    t.holder.position.set(t.b.x, d.y + (t.knock?.y ?? 0) - f.sink, t.b.z);
    if (f.gone) t.holder.visible = false;
  };

  const api = {
    // a world that takes models only: what's spawned is a model, a stand-in or nothing (cast.js)
    modelsOnly() {
      only = true;
    },
    group,
    show(quest, progress) {
      const key = quest && progress ? `${quest.id}:${progress.step}` : null;
      if (key !== shown.key) {
        shown = { key };
        build(quest, progress);
      }
      shown.quest = quest;
      shown.progress = progress;
    },
    // what the blaster can hit
    get targets() {
      return targets.filter((t) => !t.down && t.fig && t.spec.side !== 'yours');
    },
    // `how`: the gun (a kill by one of SHOW_KILLS plays its show), `push` the
    // way the shot went, `at` where it landed (a point in the world)
    hit(t, damage = 1, { breaks = false, how = null, push = null, at = null } = {}) {
      if (SHOW_KILLS.includes(how) && t.hp - damage <= 0 && !t.down && t.fig) {
        t.how = how;
        t.push = push?.clone() ?? null;
      }
      if (t.shield > 0 && breaks) {
        // (a heavy stroke, or a blast: the shield goes at once, and the rest lands)
        t.shield = 0;
        if (t.bubble) t.bubble.visible = false;
        t.stagger = Math.max(t.stagger, 1.2);
        damage = Math.max(1, damage - 1);
      }
      if (t.shield > 0) {
        const after = absorb(t, damage);
        t.shield = after.shield;
        t.hp = after.hp;
        if (t.bubble) t.bubble.userData.flash = 0.35;
        if (!t.shield && t.bubble) t.bubble.visible = false;
        if (t.hp <= 0 && !t.down) fell(t, { push, blown: breaks });
        return;
      }
      t.hp -= damage;
      t.flinch = 0.25;
      if (t.hp <= 0 && !t.down) fell(t, { push, blown: breaks });
      else {
        if (t.duel) onHit(t.duel, {});
        flinched(t, at);
      }
    },
    // your stroke on a duellist: turned by its blade when it's up (its mind's
    // block or parry, raised as your stroke began: duellists.js's turnOf);
    // its guard gone, it reels. Returns { parried, broke, perfect }
    parry(t, { heavy = false } = {}) {
      const turn = turnOf(t, { heavy });
      if (turn.broke) broke(t);
      return turn;
    },
    // its stroke parried by you: it reels (a duellist PARRY's 0.6 s, then
    // comes again; anything else `secs`)
    parried(t, secs) {
      if (t.down) return;
      if (t.duel) stun(t, 0.6, 'attack');
      t.stagger = Math.max(t.stagger, t.duel ? 0.6 : secs);
      t.burst = null;
      flinched(t);
    },
    // shoved (the Force, a blast): off its feet along `v` ({ vx, vz, vy })
    knock(t, v) {
      if (t.down) return;
      t.knock = { vx: v.vx, vz: v.vz, vy: v.vy ?? 0, y: 0 };
      t.stagger = Math.max(t.stagger, 1.4);
      if (t.duel) stun(t, t.stagger);
      t.burst = null;
      flinched(t);
    },
    // staggered: no shooting, no moving, for `secs`
    stagger(t, secs) {
      if (t.down) return;
      t.stagger = Math.max(t.stagger, secs);
      if (t.duel) stun(t, t.stagger);
      t.burst = null;
      flinched(t);
    },
    // everything tagged so, down at once (a gate dropped on it)
    kill(tag) {
      for (const t of targets) if (t.tag === tag && !t.down) fell(t);
    },
    // swinging: your stroke (duellists.js's swingingOf), for the duellists to read; eye: the camera's position (their blades' light: saberLight.js)
    update(dt, you, time, { actors, door, swinging = null, eye = null } = {}) {
      const events = [];
      const { quest, progress } = shown;
      const step = quest?.steps[progress?.step];
      // the beam, on where it wants you (or on the door in, for a step
      // inside somewhere you aren't)
      const into = door?.(step) ?? null;
      const at = into ?? stepTarget(step, progress, actors);
      marker.visible = Boolean(at) && step.type !== 'race';
      if (at) {
        marker.position.set(at[0], groundAt(world, at[0], at[1], into ? Infinity : (step.level ?? Infinity)), at[1]);
        marker.userData.mat.uniforms.uTime.value = time;
        marker.userData.ring.scale.setScalar(1 + 0.12 * Math.sin(time * 4));
      }
      // pickups: walk over them
      for (const p of pickups) {
        if (p.taken) continue;
        p.mesh.rotation.y += dt * 1.5;
        p.mesh.children[0].position.y = 0.6 + Math.sin(time * 2 + p.at[0]) * 0.12;
        if (you && Math.hypot(you.x - p.at[0], you.z - p.at[1]) < 1.6 && Math.abs(you.y - p.mesh.position.y) < 2.5) {
          p.taken = true;
          p.mesh.visible = false;
          events.push({ type: 'pickup', item: p.item });
        }
      }
      // the race's gates: the next one bright, the ones done dim
      gates.forEach((g, i) => {
        const m = g.children[0];
        const next = i === (progress?.count ?? 0);
        m.material.color.set(i < (progress?.count ?? 0) ? '#4a4a4a' : next ? '#ffd36a' : '#9fd0ff').multiplyScalar(next ? 3 : 1);
        m.material.opacity = i < (progress?.count ?? 0) ? 0.25 : 0.85;
        m.rotation.z = time * (next ? 1.5 : 0.3);
      });
      // targets: about their business, or going down
      lastYou = you ? { x: you.x, z: you.z } : lastYou;
      if (you) youT.at(you);
      let downed = false; // (a hostile counted down this frame)
      for (const t of targets) {
        const b = t.b;
        t.contacts.length = 0; // (last frame's, handed on by shooters)
        if (t.down && t.how) {
          // the show owns the figure from the moment it starts
          t.down += dt;
          if (!t.show) {
            const tall = (t.fig.tall ?? 1.8) * (t.spec.scale ?? 1);
            const up = new THREE.Vector3(0, 1, 0);
            const push = t.push ?? new THREE.Vector3(Math.sin(b.yaw), 0, Math.cos(b.yaw)).negate();
            const on = (ev) => onShow?.(t.how, ev);
            if (t.blade) { t.blade.gun.visible = false; t.blade.dark?.(); } // (no update reaches it now: its light goes)
            if (t.bubble) t.bubble.visible = false;
            if (t.bar) t.bar.sprite.visible = false;
            if (t.mark) t.mark.visible = false;
            if (t.how === 'freeze') t.show = gfx.freeze({ root: t.holder, tall, up, push, on });
            else if (t.how === 'shrink') t.show = gfx.shrink({ root: t.holder, tall, up, on });
            else t.show = pfx.swallow({ root: t.holder, tall, up, push, joints: meshyJoints(t.holder, 1, tall), on });
            t.holder.userData.show = t.show; // (for the QA scripts: the show's handle)
            onShow?.(t.how, 'hit');
          }
          if (t.down > 0.3 && !t.counted) {
            t.counted = true;
            events.push({ type: 'kill', tag: t.tag });
          }
          continue;
        }
        if (t.down) {
          t.down += dt;
          dying(t, dt, time, eye);
          if (t.down > 0.3 && !t.counted) {
            t.counted = true;
            events.push({ type: 'kill', tag: t.tag });
            if (t.hostile && t.spec.side !== 'yours') downed = true;
          }
          continue;
        }
        const s = t.spec;
        const dYou = you ? Math.hypot(you.x - b.x, you.z - b.z) : Infinity;
        const near = Boolean(t.aim); // (it has you, as it believes, in range)
        let moving = 0;
        if (t.knock) {
          // off its feet: along the shove, up and down again, slowing
          const k = t.knock;
          b.x += k.vx * dt;
          b.z += k.vz * dt;
          k.vy -= 14 * dt;
          k.y = Math.max(0, k.y + k.vy * dt);
          k.vx *= 1 - Math.min(1, dt * 2.5);
          k.vz *= 1 - Math.min(1, dt * 2.5);
          if (k.y <= 0 && k.vy < 0 && Math.hypot(k.vx, k.vz) < 0.8) t.knock = null;
          b.yaw = you ? turnToward(b.yaw, Math.atan2(you.x - b.x, you.z - b.z), dt * 2) : b.yaw;
        } else if (t.stagger > 0) {
          // reeling: it stands where it is
          t.stagger -= dt;
          reeling(t, dt);
        } else {
          // its head: what it knows of you, and what it does about it (hostiles.js)
          const tag = t.tag ?? '';
          const allies = targets.filter((o) => o !== t && !o.down && (o.tag === t.tag || (t.spec.side === 'yours' && o.spec.side === 'yours'))).map((o) => ({ x: o.b.x, z: o.b.z }));
          // (its mark: a friend of yours fights the nearest hostile; a hostile, you or a friend of yours nearer to it)
          const mark = t.spec.side === 'yours' ? friendlyAim(t, targets) : null;
          const aim = t.hostile ? (mark ? { x: mark.b.x, z: mark.b.z, victim: mark } : hostileAim(t, you, targets)) : you && { x: you.x, z: you.z, victim: null };
          t.victim = t.hostile && aim?.victim ? aim.victim : null;
          const seen = t.victim ? { x: aim.x, z: aim.z } : you ? { x: you.x, z: you.z, vel: Number.isFinite(you.vx) ? { x: you.vx, z: you.vz } : null } : null;
          // a duellist with its mark near fences it (duellists.js); otherwise it hunts as the rest do
          const fenced = fence(t, aim, { you: youT, swinging }, dt, time, world);
          // (squaring up to its mark the first time: its entrance from the game, lib/three/scenePlayer.js)
          if (fenced != null && !t.introduced) {
            t.introduced = true;
            entrance(t);
          }
          if (fenced != null) moving = fenced;
          else {
            const step = hostileStep(t, { you: t.spec.side === 'yours' && !mark ? null : seen, allies, seesThrough, tokens: t.hostile ? tokens : null, who: t, search: t.hostile ? searchFor(tag) : null, stims }, dt, r);
            // (a droid doesn't wade out into the deep water after you: it holds at the shallows)
            const held = shoreStep(world, b, step.x, step.z);
            b.x = held ? held[0] : step.x;
            b.z = held ? held[1] : step.z;
            b.yaw = step.yaw;
            moving = step.moving;
            t.aim = step.aim;
            t.guessed = step.guessed;
            if (step.mode === 'search' && !t.searchSaid) {
              t.searchSaid = true;
              events.push({ type: 'search', tag: t.tag });
            } else if (step.mode !== 'search') t.searchSaid = false;
          }
        }
        // what that step looks like (hostiles.js's hostileBody): off its feet
        // or reeling, it's going nowhere on them
        if (t.knock || t.stagger > 0) t.posture.prev = null;
        const pose = hostileBody(t.posture, { x: b.x, z: b.z, yaw: b.yaw, mode: t.mind?.mode ?? 'wander', aim: t.aim ?? null, guessed: Boolean(t.guessed), belief: t.belief ?? null, sees: Boolean(t.sees) }, dt, { t: time, firing: Boolean(t.hostile) && upToFire(t, time) });
        t.pose = pose;
        const hover = t.fig?.hover ?? s.y ?? 0;
        t.holder.position.set(b.x, groundAt(world, b.x, b.z, s.level ?? Infinity) + hover + (hover ? Math.sin(time * 3 + t.home[0]) * 0.2 : 0) + (t.knock?.y ?? 0), b.z);
        t.holder.rotation.y = b.yaw;
        // (knocked: tipped back off its feet; staggered: bent back, straightening;
        // a shot from one with no arms to raise: a little kick back)
        t.kick = Math.max(0, t.kick - dt * 7);
        t.holder.rotation.x = t.knock ? -0.9 : t.stagger > 0 ? -0.35 * Math.min(1, t.stagger) : -0.06 * t.kick;
        // its guard, back to full a while after it broke
        if (t.hostile?.guard && t.guard <= 0 && t.stagger <= 0) {
          if (t.guardAt < 0) t.guardAt = time;
          else if (time - t.guardAt > 7) {
            t.guard = t.hostile.guard;
            t.guardAt = -99;
          }
        }
        // its health over its head, while you're near and it's been hurt
        const hpMax = s.hp ?? 1;
        const show = you && dYou < 45 && t.hostile && (t.hp < hpMax || t.shield > 0 || dYou < 16);
        if (show) {
          if (!t.bar) {
            t.bar = healthBar();
            t.holder.add(t.bar.sprite);
          }
          t.bar.sprite.visible = true;
          const tall = (t.fig?.tall ?? 1.6) * (s.scale ?? 1);
          t.bar.sprite.position.y = tall + 0.45;
          const key = `${Math.max(0, t.hp)}/${hpMax}/${t.shield}/${t.guard}`;
          if (key !== t.barAt) {
            t.barAt = key;
            t.bar.draw(Math.max(0, t.hp) / hpMax, t.shield / Math.max(1, s.hostile?.shield ?? 1), s.hostile?.guard ? t.guard / s.hostile.guard : 0);
          }
        } else if (t.bar) t.bar.sprite.visible = false;
        // over a hostile's head: '?' while it looks for you, '!' when it has you again
        const mark = t.hostile && s.side !== 'yours' && dYou < 60 ? pose.mark : null;
        if (mark && !t.mark) {
          t.mark = new THREE.Sprite(marks.of(mark));
          t.mark.scale.setScalar(0.42);
          t.mark.renderOrder = 5;
          t.holder.add(t.mark);
        }
        if (t.mark) {
          t.mark.visible = Boolean(mark);
          if (mark) {
            t.mark.material = marks.of(mark);
            t.mark.position.y = (t.fig?.tall ?? 1.6) * (s.scale ?? 1) + 0.8 + Math.sin(time * 3 + t.home[0]) * 0.05;
          }
        }
        // (a flinch where it's hit and doesn't go down: the holder's shake,
        // for a figure with no flinch of its own to play)
        if (t.flinch > 0) {
          t.flinch -= dt;
          t.holder.rotation.z = t.reacted ? 0 : Math.sin(t.flinch * 60) * t.flinch * 0.3;
        } else t.holder.rotation.z = 0;
        if (t.fig) body(t, pose, moving || (b.to && !near) ? 0.6 : 0, dt, time, you, eye);
        if (t.bubble?.visible) {
          const f = t.bubble.userData;
          f.flash = Math.max(0, f.flash - dt);
          t.bubble.material.opacity = 0.1 + f.flash * 1.6 + 0.03 * Math.sin(time * 9 + t.home[0]);
        }
      }
      // the last of the step's hostiles down: those on your side cheer
      if (downed && !targets.some((o) => !o.down && o.hostile && o.spec.side !== 'yours')) for (const o of targets) if (!o.down && o.spec.side === 'yours') o.fig?.react?.('win', {});
      pfx.update(dt);
      for (const sr of searches.values()) sr.update(dt);
      tokens.audit(dt, (who) => !who.down && targets.includes(who));
      stims.length = 0;
      gfx.update(dt);
      return events;
    },
    // the hostile ones ready to fire at you this frame: at what each believes
    // you to be (to: [x, z]; guessed: it can only guess), so many at once
    shooters(dt, you, time = 0) {
      const out = [];
      // a duellist's blade on you this frame (struckBy's), as a melee contact
      for (const t of targets) out.push(...t.contacts);
      for (const t of targets) {
        if (t.down || !t.hostile || !t.fig || !you || t.stagger > 0 || t.knock) continue;
        const at = t.aim;
        const d = at ? Math.hypot(at.x - t.b.x, at.z - t.b.z) : Infinity;
        // a duellist's Force: a shove at you, every so often, when you're close
        const dYou = Math.hypot(you.x - t.b.x, you.z - t.b.z);
        if (nextForce(t, t.hostile, dYou, time) && t.spec.side !== 'yours') {
          t.forceAt = time;
          out.push({ force: true, push: t.hostile.force.push ?? 9, from: [t.b.x, t.holder.position.y, t.b.z], who: t });
          continue;
        }
        if (t.duel) continue; // (its strokes land through its blade, above)
        if (!at || d > (t.hostile.melee ? t.hostile.reach ?? 2 : t.hostile.range)) {
          if (t.hostile.melee) t.cool = Math.max(t.cool, 0.4);
          continue;
        }
        const v = t.victim && !t.victim.down ? t.victim : null;
        // (fired: from the muzzle of a gun that's up, kicking; or from where
        // it stands, as ever: a rigged one with no gun to raise plays the
        // pistol's shot and holds its aim, react.js's fire; one with no arms
        // at all kicks back a little)
        const fired = () => {
          t.firedAt = time;
          if (t.gp?.aim > 0.5 && !(time < (t.startUntil ?? 0))) {
            const m = t.gp.fire().muzzle;
            return [m.x, m.y, m.z];
          }
          if (t.gp) return null;
          if (t.fig.react?.('fire', { target: { x: at.x, z: at.z } })) t.aimHeld = true;
          else t.kick = 1;
          return null;
        };
        const shot = () => ({ from: fired() ?? [t.b.x, t.holder.position.y + 1.4, t.b.z], to: [at.x, at.z], guessed: Boolean(t.guessed), spread: t.hostile.spread ?? 0.06, damage: t.hostile.damage ?? 8, who: t, at: v ? [v.b.x, v.holder.position.y + 1.1, v.b.z] : null, victim: v });
        // the rest of a burst, as its shots fall due
        if (t.burst) {
          for (let i = stepBurst(t.burst, dt, t.hostile.burst.gap); i > 0; i--) out.push(shot());
          if (t.burst.left <= 0) t.burst = null;
        }
        t.cool -= dt;
        if (t.cool > 0) continue;
        // its turn: so many fire (or swing) at once; the rest keep moving
        if (!tokens.claim(t.hostile.melee ? 'melee' : 'shot', t)) continue;
        t.cool = t.hostile.every * (0.7 + r() * 0.6);
        // in arm's reach, a swipe (a rancor's, a blade's), or a shot from where it stands
        if (t.hostile.melee) {
          // (a brawler's jab, react.js's caught: it lands as it's decided)
          t.fig.react?.('caught', { target: { x: at.x, z: at.z } });
          out.push({ melee: true, damage: t.hostile.damage ?? 25, from: [t.b.x, t.holder.position.y, t.b.z], who: t, at: v ? [v.b.x, v.holder.position.y + 1.1, v.b.z] : null, victim: v });
        }
        else if (t.hostile.burst) {
          t.burst = startBurst(t.hostile);
          out.push(shot());
          t.burst.left--;
        } else out.push(shot());
      }
      return out;
    },
    clear: clearStep,
    // your blade crossing a duellist's (duellists.js's clashes)
    clashes: (saber, now) => clashes(saber, targets, now),
    // (for tests: who's out, and what each is at)
    // (body: how it's drawn, crouched, its gun up, its mark, what it carries, the clip it went down on)
    debug: () => targets.map((t) => ({ tag: t.tag, side: t.spec.side ?? null, hp: t.hp, down: t.down > 0, fig: Boolean(t.fig), aim: Boolean(t.aim), victim: t.victim?.tag ?? null, mode: t.mind?.mode ?? null, at: [+t.b.x.toFixed(1), +t.b.z.toFixed(1)], body: { base: t.pose?.base ?? null, gun: t.gp ? t.gp.kind : t.blade ? 'saber:hand' : null, duel: t.duel?.state ?? null, up: t.gp ? +t.gp.aim.toFixed(2) : null, mark: t.pose?.mark ?? null, rigged: Boolean(t.fig?.anim), death: t.death?.clip ?? null } })),
    // your shot, for the enemies to hear (lib/ai/perception's stims): from where, aimed where
    heard(from, aim) {
      stims.push({ type: 'shot', at: { x: from.x, y: 0, z: from.z }, aim: { x: aim.x, y: 0, z: aim.z }, radius: 60, from: 'you', loudness: 1 });
    },
    dispose() {
      dead = true;
      clearStep();
      pfx.dispose();
      gfx.dispose();
      marks.dispose();
      group.removeFromParent();
    },
  };
  return api;
}
