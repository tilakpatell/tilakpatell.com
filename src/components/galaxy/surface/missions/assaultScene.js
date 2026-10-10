// A galactic assault, drawn and run in the surface scene: the soldiers of
// both sides (each kind's figure, as actors.js finds one), placed each
// frame from the rules (./assault.js), with a chevron over each in the
// side's colour; every command post as a column of its owner's light with
// a ring on the ground that fills as it's taken; the soldiers' shots as
// bolts of their side's colour through the surface's blaster, and the ones
// at you as its enemy bolts, which hit if they pass through you. The scene
// hands it the world once the things stand on it (begin), then calls
// update each frame.
//
// The soldiers' bodies show what the rules have them doing (assault.js's
// soldierBody, through lib/ai/body's bodyFrom and BATTLE_BODY), and never
// change it: down behind their cover and up to fire, the half that covers
// the other's falling back on a knee, the half going back turned to go and
// turning to fire, a flinch when they're hit, a hop when their side takes a
// post. A soldier coming back runs in from a way back instead of popping up
// where the rules put it, and its bolts leave from where it's drawn. One
// that goes down falls away from the shot: a figure with clips through its
// own fall (react's `down`), a statue (the Battlefront's, without a rig:
// gait.js sways them in step) crumpling, its knees first and quicker as it
// goes, onto its face or its back, rolled toward the side it was hit from.
// Each lies a while, sinks out of sight and is gone.
//
// createAssaultMission({ parent, world, blaster, mission, emit, say, sounds,
// kit, warm, tier, reduced }) → { begin(), restart(), update(dt, you) →
// { atYou: [{ from, spread, damage, color }] }, targets, hit(target, damage),
// running(), started(), view(), target(x, z), chooseSide(side), deploy(id),
// youDown(), force(how), dispose() }
//
// Pure, for the drawing (and tested): fallPose(k, { tall, way, side }),
// fallWay(from, at, yaw), postureOf(mode, { firing, moving, tall }),
// faceFor({ yaw, travel, speed, mode, aim, firing, runIn, rigged }),
// runInFrom(x, z, yaw, { solids, reach, back }), FALL.

import * as THREE from 'three';
import { disposeTree } from '../../../../lib/three/renderer';
import { turn } from '../../../../lib/three/gait';
import { bodyFrom } from '../../../../lib/ai/body';
import { anyFigure } from '../actors';
import { groundAt, pushOut, tooDeep } from '../walker';
import { BATTLE_BODY, RULES, SOLDIERS, battleView, chooseSide as pickSide, deploy as deployAt, endBattle, hitSoldier, newBattle, objectiveFor, soldierBody, stepBattle, youDown as putYouDown } from './assault';
import { sharpen } from '../../../../lib/three/textures';
import { loadScene, playScene } from '../../../../lib/three/scenePlayer';
import { victoryFor } from '../../../../lib/three/walrusSets/emotes';
import { OUTROS } from '../../../../lib/three/walrusSets/scenes';

const EYE = 1.4; // metres: where a soldier's bolt leaves from
const CHEST = 1.0; // metres: where one lands
export const FALL = { over: 0.62, gone: 2.5, sink: 0.6 }; // seconds: a statue going over onto the ground, the body cleared away, and sinking out of sight before that
const TRACERS = { far: 140, most: 12, hear: 40, every: 0.15 }; // metres a shot is drawn within, drawn a frame at most, heard within, heard apart
const BARK = { first: 14, every: 24, spread: 10 }; // seconds between the sides' shouts
const NEUTRAL = '#d8d8d0';
const RUN_IN = { back: 10, catch: 4.5 }; // metres back a soldier coming back runs in from, and m/s it gains on where the rules have it
const RISE = 0.25; // seconds a soldier stays up after its shot (it came up for it a moment before: soldierBody's `fire`)
const KICK = 0.07; // radians a statue's shot rocks it back
const TURN = 7; // how quickly a body comes round to face (gait.js's turn)
const POSE = 8; // how quickly a statue goes down into a crouch and back up (a second)
const HOP = { time: 0.42, high: 0.22 }; // a statue's cheer: a hop, seconds and metres
const FAR = 120; // metres: past it, the figures' legs aren't seen and rest

const smooth = (k) => k * k * (3 - 2 * k);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ── the drawing's arithmetic (pure) ──

// A statue going down, k seconds after it was hit: its knees going as it
// tips (it drops a little, then lies on the ground rather than through
// it), over quicker as it goes, as a body falls, a bounce as it lands, its
// feet slipping back the way it fell from so it crumples rather than
// toppling like a plank, rolled toward the side it was pushed to; then sunk
// out of sight before it's gone. way: +1 onto its face, −1 onto its back;
// side: −1…1, + toward its right. → { pitch (rad, + onto its face), roll
// (rad, + toward its right), lift (m), slide (m, its feet back from where
// they stood, against `way`), sunk (m), gone }
export function fallPose(k, { tall = 1.8, way = -1, side = 0 } = {}) {
  const u = clamp(k / FALL.over, 0, 1);
  let tip = u * u;
  // (a bounce as it lands)
  const v = (k - FALL.over) / 0.25;
  if (v > 0 && v < 1) tip -= 0.05 * Math.sin(Math.PI * v);
  const sinking = clamp((k - (FALL.gone - FALL.sink)) / FALL.sink, 0, 1);
  return {
    pitch: way * (Math.PI / 2) * 0.97 * tip,
    roll: side * 0.35 * smooth(u),
    lift: -0.08 * tall * Math.sin(Math.PI * u) + 0.05 * tall * u * u,
    slide: 0.25 * tall * smooth(u),
    sunk: 0.5 * smooth(sinking),
    gone: k >= FALL.gone,
  };
}

// Which way a shot from `from` ([x, z], or null) pushes a soldier at `at`
// facing `yaw`: onto its face (way +1) if it came from behind, else onto
// its back, and how far toward its right (side, −1…1). Its right is
// (−cos yaw, sin yaw), as lib/ai/body reads it.
export function fallWay(from, at, yaw) {
  if (!from) return { way: -1, side: 0 };
  const dx = at[0] - from[0];
  const dz = at[1] - from[1];
  const l = Math.hypot(dx, dz);
  if (l < 1e-6) return { way: -1, side: 0 };
  const ahead = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / l;
  const side = (-dx * Math.cos(yaw) + dz * Math.sin(yaw)) / l;
  return { way: ahead >= 0 ? 1 : -1, side };
}

// How low a statue keeps (sink, metres into the ground; only standing
// still, where its feet won't show it) and how far it leans forward (rad),
// by its mode: down behind its cover and up to fire, the half covering the
// other's going on a knee, its head down when it's pinned, hunched on the
// run, upright otherwise.
export function postureOf(mode, { firing = false, moving = false, tall = 1.8 } = {}) {
  if (mode === 'cover') return moving ? { sink: 0, lean: 0.2 } : firing ? { sink: 0, lean: 0.04 } : { sink: 0.2 * tall, lean: 0.12 };
  if (mode === 'covering') return moving ? { sink: 0, lean: 0.1 } : { sink: 0.08 * tall, lean: 0.06 };
  if (mode === 'pinned') return moving ? { sink: 0, lean: 0.22 } : { sink: 0.05 * tall, lean: 0.2 };
  if (moving && (mode === 'flank' || mode === 'advance' || mode === 'retreat')) return { sink: 0, lean: 0.08 };
  return { sink: 0, lean: 0 };
}

// Which way a soldier's body wants to face: as the rules face it (its
// target, else where it's going), unless it's running in (where it runs),
// or its half's falling back (turned to go, and back round to fire). A
// statue can't walk sideways or backward on its sway, so on the move it
// turns part way to its travel, and wholly when it's walking away from
// what it faces and not firing; a figure with clips keeps its chest on
// its target and lets its hips turn. yaw: the rules'; travel: the way it's
// going; speed: m/s; aim: the yaw to its target, or null.
export function faceFor({ yaw, travel = yaw, speed = 0, mode = 'advance', aim = null, firing = false, runIn = false, rigged = false }) {
  if (runIn) return travel;
  if (speed < 0.6) return yaw;
  if (mode === 'retreat') return firing && aim != null ? aim : travel;
  if (rigged) return yaw;
  const d = wrap(travel - yaw);
  if (Math.abs(d) > 1.9 && !firing) return travel;
  return yaw + clamp(d, -0.6, 0.6);
}

// Where a soldier coming back onto the field runs in from: up to `back`
// metres behind where it comes on (the way it faces is its objective), short
// of anything solid in the way and inside the world's reach.
export function runInFrom(x, z, yaw, { solids = null, reach = 0, back = RUN_IN.back } = {}) {
  const bx = -Math.sin(yaw);
  const bz = -Math.cos(yaw);
  let d = 0;
  for (let s = 1; s <= back; s++) {
    const px = x + bx * s;
    const pz = z + bz * s;
    if (reach && Math.hypot(px, pz) > reach) break;
    if (solids?.near(px, pz, 2).some((sol) => pushOut(sol, px, pz, 0.5))) break;
    d = s;
  }
  return [x + bx * d, z + bz * d];
}

const COLUMN_VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const COLUMN_FRAG = `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uTime;
uniform float uAlpha;
void main() {
  float edge = 1.0 - abs(vUv.x - 0.5) * 2.0;
  float a = pow(edge, 1.6) * (1.0 - vUv.y) * (0.5 + 0.2 * sin(uTime * 2.0 - vUv.y * 10.0)) * uAlpha;
  gl_FragColor = vec4(uColor * 2.0, a);
}`;
// a ring that fills round from the top, by uFill (0…1)
const RING_VERT = `
varying float vAng;
void main() { vAng = atan(position.x, position.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RING_FRAG = `
varying float vAng;
uniform vec3 uColor;
uniform float uFill;
void main() {
  float k = (vAng + 3.14159265) / 6.2831853;
  if (k > uFill) discard;
  gl_FragColor = vec4(uColor * 2.4, 0.85);
}`;

// a chevron pointing down, in a side's colour
function chevron(colour) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = colour;
  g.strokeStyle = 'rgba(10, 10, 14, 0.8)';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(12, 14);
  g.lineTo(52, 14);
  g.lineTo(32, 48);
  g.closePath();
  g.stroke();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map: t, sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true, opacity: 0.85 });
}

export function createAssaultMission({ parent, world, blaster, mission, emit, say, sounds, kit = null, warm = (o) => Promise.resolve(o), tier = 'high', reduced = false, only = false }) {
  const group = new THREE.Group();
  group.name = 'assault';
  parent.add(group);
  const n = SOLDIERS[tier] ?? SOLDIERS.mid;
  const colourOf = (side) => (side ? mission.sides[side].colour : NEUTRAL);
  const marks = { attack: chevron(colourOf('attack')), defend: chevron(colourOf('defend')) };
  let battle = null;
  let seed = 1;
  let dead = false;
  let t = 0;
  let heardAt = -1;
  let barkAt = BARK.first;
  // (deep: water too deep to wade, the lagoon past the shallows, which the soldiers don't walk into)
  const env = { solids: world.solids, reach: world.reach, deep: (x, z) => tooDeep(world, x, z) };
  const view = () => (battle ? battleView(battle) : null);
  const tell = (event = null) => emit({ type: 'mission', event, view: view() });

  // ── the soldiers' bodies: one a soldier, by id, made once ──
  // (each: where it's drawn (at), the way it faces (yaw), how far it's still
  // to run in (lag), its crouch and lean, its shot's kick, its fall, and on
  // a figure with clips the base state it's in and whether it's aiming)
  const bodies = [];
  const fresh = (b) =>
    Object.assign(b, { down: 0, flinch: 0, at: null, yaw: 0, speed: 0, prev: null, lag: null, sink: 0, lean: 0, kick: 0, firedAt: -9, fall: null, clip: false, cheer: null });
  function makeBodies() {
    for (const s of battle.soldiers) {
      const holder = new THREE.Group();
      holder.visible = false;
      group.add(holder);
      const mark = new THREE.Sprite(marks[s.side]);
      mark.scale.setScalar(0.02);
      mark.position.y = 2.4;
      mark.renderOrder = 8;
      holder.add(mark);
      const body = fresh({ holder, mark, fig: null, kind: s.kind, ready: false, rigged: false, base: null, aiming: false });
      bodies.push(body);
      anyFigure(s.kind, {}, kit, 0, undefined, { only })
        .then((fig) => {
          if (!fig || dead) return;
          holder.add(fig.model);
          body.fig = fig;
          // (a figure on an animator plays its own falls, crouches and shots; a statue's are drawn here)
          body.rigged = Boolean(fig.anim);
          mark.position.y = (fig.tall ?? 1.8) + 0.6;
          return warm(holder).then(() => (body.ready = true));
        })
        .catch(() => {});
    }
  }
  // a figure with clips back on its feet, its shots and falls let go
  const standUp = (b) => {
    if (!b.rigged) return;
    if (b.clip) b.fig.stop?.(0.15, 'full');
    if (b.aiming) b.fig.stop?.(0.15, 'upper');
    if (b.base) b.fig.base?.(null);
    b.base = null;
    b.aiming = false;
  };

  // ── the posts: a column of light and the rings ──
  const columnGeo = new THREE.CylinderGeometry(0.7, 0.7, 36, 16, 1, true).translate(0, 18, 0);
  const posts = [];
  function makePosts() {
    for (const p of battle.posts) {
      const g = new THREE.Group();
      const y = groundAt(world, p.at[0], p.at[1]);
      g.position.set(p.at[0], y + 0.05, p.at[1]);
      group.add(g);
      const column = new THREE.Mesh(columnGeo, new THREE.ShaderMaterial({ vertexShader: COLUMN_VERT, fragmentShader: COLUMN_FRAG, uniforms: { uColor: { value: new THREE.Color(colourOf(p.owner)) }, uTime: { value: 0 }, uAlpha: { value: p.fixed ? 0.45 : 0.8 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      column.renderOrder = 6;
      g.add(column);
      const ring = new THREE.Mesh(new THREE.RingGeometry(p.r - 0.5, p.r, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(colourOf(p.owner)).multiplyScalar(2), toneMapped: false, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      g.add(ring);
      const meter = new THREE.Mesh(new THREE.RingGeometry(p.r - 1.6, p.r - 0.7, 64).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ vertexShader: RING_VERT, fragmentShader: RING_FRAG, uniforms: { uColor: { value: new THREE.Color(colourOf(p.owner)) }, uFill: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      meter.visible = !p.fixed;
      g.add(meter);
      posts.push({ id: p.id, g, column, ring, meter, colour: new THREE.Color(colourOf(p.owner)) });
    }
  }
  const tmpColour = new THREE.Color();
  function paintPosts(dt) {
    for (const v of posts) {
      const p = battle.posts.find((q) => q.id === v.id);
      // the owner's colour, eased (neutral: the side taking it, faintly)
      tmpColour.set(colourOf(p.owner ?? p.taking));
      if (!p.owner) tmpColour.lerp(new THREE.Color(NEUTRAL), 0.5);
      v.colour.lerp(tmpColour, Math.min(1, dt * 3));
      v.column.material.uniforms.uColor.value.copy(v.colour);
      v.column.material.uniforms.uTime.value = t;
      v.ring.material.color.copy(v.colour).multiplyScalar(2);
      v.meter.material.uniforms.uColor.value.set(colourOf(p.owner ?? p.taking));
      v.meter.material.uniforms.uFill.value = p.owner || p.taking ? p.meter : 0;
    }
  }

  function reset() {
    film?.stop();
    film = null;
    battleNo++;
    for (const b of bodies) {
      standUp(b);
      fresh(b);
      b.holder.rotation.set(0, 0, 0);
      b.holder.visible = false;
    }
    barkAt = t + BARK.first;
  }

  function begin() {
    battle = newBattle(mission, { n, seed });
    if (!bodies.length) makeBodies();
    if (!posts.length) makePosts();
    reset();
    tell();
  }

  const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
  const bodyOf = (id) => bodies[id];
  const tallOf = (b) => b.fig?.tall ?? 1.8;
  // a point to look or aim at: a soldier's chest, where it stands
  const chestAt = (x, z) => ({ x, y: groundAt(world, x, z) + CHEST + 0.3, z });
  // down, away from the shot (from: where it came from, [x, z], if known)
  const fell = (id, from = null) => {
    const b = bodyOf(id);
    if (!b || b.down) return;
    b.down = 0.001;
    const x = b.at?.x ?? b.holder.position.x;
    const z = b.at?.z ?? b.holder.position.z;
    const { way, side } = fallWay(from, [x, z], b.yaw);
    b.fall = { way, side, x, z, y: groundAt(world, x, z), yaw: b.yaw };
    b.mark.visible = false;
    b.cheer = null;
    if (b.rigged) {
      // (its arms down and on its feet first, so its fall is the whole of it)
      if (b.aiming) b.fig.stop?.(0.15, 'upper');
      if (b.base) b.fig.base?.(null);
      b.fig.look?.(null);
      b.base = null;
      b.aiming = false;
      const dir = from ? { x: x - from[0], z: z - from[1] } : null;
      b.clip = Boolean(b.fig.react?.('down', { dir, yaw: b.yaw, force: 0.5 }));
    }
  };
  // hit and still up: a flinch
  const flinch = (b, by = 0.18) => {
    if (!b || b.down) return;
    b.flinch = Math.max(b.flinch, by);
    if (b.rigged) b.fig.react?.('hit', { where: 'chest' });
  };
  // its shot: rocked by it (a statue), its arms up and firing (a figure with clips)
  const fired = (b, to) => {
    b.firedAt = t;
    b.kick = 1;
    if (b.rigged && b.fig.react?.('fire', { target: chestAt(to[0], to[1]) })) b.aiming = true;
  };
  // a side's soldiers glad (near: only those within it of [x, z])
  const glad = (side, hops = 1, near = null) => {
    for (const s of battle.soldiers) {
      if (!s.up || s.side !== side) continue;
      if (near && dist(s.x, s.z, near[0], near[1]) > near[2]) continue;
      const b = bodyOf(s.id);
      // (not all at once: each a moment after the last, by who it is)
      if (b && !b.down) b.cheer = { at: t + ((s.id * 0.618) % 1) * 0.5, hops };
    }
  };

  // the battle won by the side the game has a scene for: four of the winners
  // in it (lib/three/scenePlayer.js), in place of their cheer, at high and ultra
  const outro = (side) => {
    const o = OUTROS[mission.system];
    if (!o || o.side !== side || !(tier === 'high' || tier === 'ultra')) return;
    const four = battle.soldiers
      .filter((s) => s.up && s.side === side)
      .map((s) => bodyOf(s.id))
      .filter((b) => b?.rigged && !b.down)
      .slice(0, 4);
    if (!four.length) return;
    const no = battleNo;
    loadScene(o.scene).then((sc) => {
      // (a battle begun again while it came: not on the new one's soldiers)
      if (!sc || no !== battleNo) return;
      const cast = {};
      four.forEach((b, i) => {
        b.cheer = null;
        // (a victory's hold let go first, or it would cut the scene)
        b.fig.stop?.(0, 'full');
        cast[`e${i + 1}`] = b.fig;
      });
      film = playScene(sc, cast, { hold: true });
    });
  };
  // the outro playing, and which battle it is (a restart lets it go)
  let film = null;
  let battleNo = 0;

  // ── one soldier's body, where the rules have it, this frame ──
  function draw(b, s, dt, you) {
    // (still running in from where it came back, gaining on its place)
    if (b.lag) {
      const l = Math.hypot(b.lag[0], b.lag[1]);
      const k = l > 1e-6 ? Math.max(0, l - RUN_IN.catch * dt) / l : 0;
      b.lag[0] *= k;
      b.lag[1] *= k;
      if (l * k < 0.05) b.lag = null;
    }
    const x = s.x + (b.lag?.[0] ?? 0);
    const z = s.z + (b.lag?.[1] ?? 0);
    if (!b.at) {
      b.at = { x, z };
      b.yaw = s.yaw;
      b.prev = null;
    }
    const dx = x - b.at.x;
    const dz = z - b.at.z;
    let v = dt > 0 ? Math.hypot(dx, dz) / dt : 0;
    // (a leap no one runs: put there, not walked)
    if (v > 20) {
      v = 0;
      b.prev = null;
    }
    const travel = v > 0.05 ? Math.atan2(dx, dz) : b.yaw;
    b.at.x = x;
    b.at.z = z;
    b.speed += (v - b.speed) * Math.min(1, dt * 8);
    const step = soldierBody(battle, s);
    const firing = step.fire || t - b.firedAt < RISE;
    const aim = step.aim ? Math.atan2(step.aim.x - x, step.aim.z - z) : null;
    b.yaw = turn(b.yaw, faceFor({ yaw: s.yaw, travel, speed: b.speed, mode: step.mode, aim, firing, runIn: Boolean(b.lag), rigged: b.rigged }), dt, TURN);
    // (a figure with clips fires from its crouch: its base isn't taken away to fire)
    const next = { x, z, yaw: b.yaw, mode: step.mode, aim: step.aim, fire: b.rigged ? false : firing, hurt: step.hurt };
    const body = bodyFrom(b.prev, next, dt, { table: BATTLE_BODY });
    b.prev = next;
    const moving = b.speed > 0.5;

    // a statue's crouch, lean and kick; a cheer's hop
    const want = b.rigged ? { sink: 0, lean: 0 } : postureOf(step.mode, { firing, moving, tall: tallOf(b) });
    const ease = Math.min(1, dt * POSE);
    b.sink += (want.sink - b.sink) * ease;
    b.lean += (want.lean - b.lean) * ease;
    b.kick = Math.max(0, b.kick - dt * 6);
    let hop = 0;
    if (b.cheer && t >= b.cheer.at) {
      const u = (t - b.cheer.at) / HOP.time;
      if (b.rigged) {
        // (the battle won: the game's own victory pose, where the figure has the soldiers' set)
        const v = b.cheer.hops >= 2 ? victoryFor(b.fig.clips, s.id) : null;
        if (v) b.fig.play?.(v, { hold: 8 });
        else b.fig.react?.('win', {});
        b.cheer = null;
      } else if (u >= b.cheer.hops) b.cheer = null;
      else hop = HOP.high * Math.sin(Math.PI * (u % 1));
    }
    let roll = 0;
    if (b.flinch > 0) {
      b.flinch = Math.max(0, b.flinch - dt);
      roll = Math.sin(b.flinch * 60) * b.flinch * 0.3;
    }
    b.holder.position.set(x, groundAt(world, x, z) - b.sink + hop, z);
    // (yaw first, so a lean or a flinch goes about the body's own side, whichever way it faces)
    b.holder.rotation.set(b.lean - b.kick * KICK * (b.rigged ? 0 : 1), b.yaw, roll, 'YXZ');

    // a figure with clips: crouched (once it's stopped: a base state is in
    // place of its feet), its head on what it's firing at, its arms down
    // once it has nothing to fire at
    if (b.rigged) {
      const base = body.base && b.speed < 0.4 ? body.base : null;
      if (base !== b.base) {
        b.base = base;
        b.fig.base?.(base);
      }
      b.fig.look?.(body.look ? chestAt(body.look.x, body.look.z) : null);
      if (!step.aim && b.aiming) {
        b.fig.stop?.(0.3, 'upper');
        b.aiming = false;
      }
    }
    // (a full-fidelity 2017 kind draws the cut its distance wants: the
    // full one near, the far one past the level's mid; crew.js)
    if (b.fig && you) b.fig.cutAt?.(dist(x, z, you.x, you.z));
    // (the far ones' legs aren't seen: their figures rest)
    if (b.fig && (!you || dist(x, z, you.x, you.z) < FAR)) {
      if (reduced) b.fig.update(dt, s.move * 0.5);
      else b.fig.update(dt, Math.min(1, b.speed / RULES.walk), body.motion);
    }
  }

  // ── one gone down: lying where it fell, then gone ──
  function lie(b, dt) {
    b.down += dt;
    const f = b.fall;
    if (!f) return;
    const p = fallPose(b.down, { tall: tallOf(b), way: f.way, side: f.side });
    if (b.clip) {
      // (its own fall plays it down)
      b.holder.position.set(f.x, f.y - p.sunk, f.z);
      b.holder.rotation.set(0, f.yaw, 0, 'YXZ');
      b.fig.update(dt, 0, { speed: 0, side: 0, turn: 0 });
    } else {
      const back = -f.way * p.slide;
      b.holder.position.set(f.x + Math.sin(f.yaw) * back, f.y + p.lift - p.sunk, f.z + Math.cos(f.yaw) * back);
      b.holder.rotation.set(p.pitch, f.yaw, p.roll, 'YXZ');
    }
    if (p.gone) b.holder.visible = false;
  }

  return {
    begin,
    restart() {
      seed += 1;
      begin();
    },
    // the battle moved on; what's fired at you is for the scene to shoot
    update(dt, you) {
      t += dt;
      const atYou = [];
      if (!battle) return { atYou };
      const events = stepBattle(battle, dt, you ? { x: you.x, z: you.z } : null, env);
      let drawn = 0;
      for (const e of events) {
        if (e.type === 'shot') {
          // (from where its body is drawn: running in, it's a way back still; down behind its cover, a little lower)
          const sb = bodyOf(e.id);
          const fx = sb?.at?.x ?? e.from[0];
          const fz = sb?.at?.z ?? e.from[1];
          const from = [fx, groundAt(world, fx, fz) + EYE - (sb?.sink ?? 0), fz];
          if (e.atYou) atYou.push({ from, spread: 0.05, damage: RULES.atYou, color: colourOf(e.side) });
          else if (you && drawn < TRACERS.most && dist(fx, fz, you.x, you.z) < TRACERS.far) {
            drawn += 1;
            // (a miss lands off to one side of them)
            const off = e.hit ? 0 : 1.2;
            const to = [e.to[0] + (Math.random() - 0.5) * 2 * off, groundAt(world, e.to[0], e.to[1]) + CHEST + (Math.random() - 0.5) * off, e.to[1] + (Math.random() - 0.5) * 2 * off];
            blaster.tracer(from, to, colourOf(e.side));
          }
          if (you && t - heardAt > TRACERS.every && dist(fx, fz, you.x, you.z) < TRACERS.hear) {
            heardAt = t;
            sounds.blast?.();
          }
          if (sb && !sb.down) fired(sb, e.to);
          // (a hit it's still up after: a flinch; one that brings it down falls instead)
          if (e.hit && e.target != null && battle.soldiers[e.target]?.up) flinch(bodyOf(e.target));
        } else if (e.type === 'down') fell(e.id, e.from);
        else if (e.type === 'spawn') {
          const b = bodyOf(e.id);
          const s = battle.soldiers[e.id];
          if (b && s) {
            standUp(b);
            fresh(b);
            // (it runs in from a way back, rather than appearing where the rules put it)
            const [rx, rz] = runInFrom(s.x, s.z, s.yaw, { solids: world.solids, reach: world.reach });
            b.lag = [rx - s.x, rz - s.z];
            b.at = { x: rx, z: rz };
            b.yaw = s.yaw;
            b.holder.position.set(rx, groundAt(world, rx, rz), rz);
            b.holder.rotation.set(0, s.yaw, 0, 'YXZ');
            b.holder.visible = b.ready;
          }
        } else if (e.type === 'capture' || e.type === 'neutral' || e.type === 'phase') {
          tell(e);
          // (the side that took it, glad, the ones in it)
          if (e.type === 'capture') {
            const p = battle.posts.find((q) => q.id === e.post);
            if (p) glad(e.side, 1, [p.at[0], p.at[1], p.r + 4]);
          }
        } else if (e.type === 'end') {
          say(mission.lines?.[e.won ? 'won' : 'lost']);
          tell({ type: e.won ? 'won' : 'lost' });
          const mine = battle.you.side;
          const winners = mine ? (e.won ? mine : mine === 'attack' ? 'defend' : 'attack') : null;
          if (winners) glad(winners, 2);
          if (winners) outro(winners);
        }
      }
      // a shout from your side, now and then
      if (battle.phase === 'run' && !battle.result && battle.you.side && t > barkAt) {
        barkAt = t + BARK.every + (Math.random() - 0.5) * BARK.spread;
        const list = mission.barks?.[battle.you.side] ?? [];
        if (list.length) say([list[Math.floor(Math.random() * list.length)]]);
      }
      // the bodies, where the rules have them
      for (const s of battle.soldiers) {
        const b = bodies[s.id];
        if (!b) continue;
        if (!s.up && !b.down && b.holder.visible) fell(s.id);
        if (b.down) {
          if (b.holder.visible) lie(b, dt);
          continue;
        }
        if (!s.up) continue;
        if (!b.holder.visible && b.ready) b.holder.visible = true;
        b.mark.visible = true;
        draw(b, s, dt, you);
      }
      paintPosts(dt);
      return { atYou };
    },
    // what the blaster can hit: the enemy's soldiers standing
    get targets() {
      if (!battle || !battle.you.side) return [];
      const out = [];
      for (const s of battle.soldiers) {
        if (!s.up || s.side === battle.you.side) continue;
        const b = bodies[s.id];
        if (!b?.holder.visible) continue;
        out.push({ id: s.id, holder: b.holder, fig: { tall: b.fig?.tall ?? 1.8 } });
      }
      return out;
    },
    // one of yours landed
    hit(target, damage = RULES.yours) {
      const ev = hitSoldier(battle, target.id, damage, 'you');
      flinch(bodies[target.id], 0.25);
      if (ev) {
        fell(ev.id, ev.from);
        tell(ev);
      }
    },
    running: () => Boolean(battle && battle.phase === 'run' && !battle.result),
    started: () => Boolean(battle && battle.phase !== 'choose'),
    view,
    // where your side is wanted, for the compass
    target(x, z) {
      if (!battle || !battle.you.side || battle.result) return null;
      return objectiveFor(battle, battle.you.side, x, z);
    },
    chooseSide(side) {
      if (!battle || battle.phase !== 'choose') return;
      pickSide(battle, side);
      say(mission.lines?.start);
      tell({ type: 'start', side });
    },
    deploy(id) {
      if (!battle) return null;
      const at = deployAt(battle, id);
      if (at) tell({ type: 'deploy', id });
      return at;
    },
    youDown() {
      if (!battle) return;
      putYouDown(battle);
      tell({ type: 'youDown' });
    },
    // (for tests: the end, 'win' or 'lose')
    force(how) {
      if (!battle || battle.result) return;
      endBattle(battle, how === 'win', 'posts');
      say(mission.lines?.[how === 'win' ? 'won' : 'lost']);
      tell({ type: how === 'win' ? 'won' : 'lost' });
    },
    dispose() {
      dead = true;
      for (const b of bodies) b.fig?.dispose?.();
      for (const m of Object.values(marks)) {
        m.map.dispose();
        m.dispose();
      }
      columnGeo.dispose();
      disposeTree(group);
      group.removeFromParent();
    },
  };
}
