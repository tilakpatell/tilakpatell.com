// Heroes vs Villains, drawn and run in the surface scene (./hvv.js has the
// rules): the bots as the crew's own hero figures (crew.js's crewFigure: a
// 2017 hero on the game's rig, its far cut past the level's mid, cutAt),
// a saber hero's blade lit in its own hand and stroking the clips its mind
// picks (heldBlade.js's bladeInHand), a blaster hero's gun raised on its
// mark (gunplay.js) and its bolts as the side's tracers; over each a
// chevron in its side's colour, and over each side's target the target
// mark, larger; the arena's edge as a soft wall of light on the ground.
// Its interface is assaultScene.js's, so the surface scene runs either the
// same way: begin, restart, update(dt, you, { sim, swinging }) → { atYou } (sim: your saber's engine, swinging: your
// strike as their minds read it, duellists.js's swingingOf), targets, hit,
// running, started, view, target, chooseSide, deploy, youDown, force,
// dispose. A saber's stroke on you comes back in atYou as `melee` (met by
// your guard as a duellist's is, then the scene's hurt, not a bolt; parried,
// `parried()` staggers it), and so does the out-of-bounds count's end (`oob`).
//
// createHvvMission({ parent, world, blaster, mission, emit, say, sounds,
// warm, who }) → that; who() is the hero you're playing (the scene's lead).
// Pure, for the drawing (and tested): wallGeometry(points, heightAt, high).

import * as THREE from 'three';
import { disposeTree } from '../../../../lib/three/renderer';
import { turn } from '../../../../lib/three/gait';
import { sharpen } from '../../../../lib/three/textures';
import { guarding } from '../../../../lib/combat/duel';
import { createGunplay } from '../../../universe/gunplay';
import { crewFigure } from '../crew';
import { bladeInHand } from '../heldBlade';
import { groundAt } from '../walker';
import { SABER_COLORS, heroById } from '../../heroes';
import { gameHealth } from '../abilityRules';
import { groundFor } from './arenas';
import { wallMaterial } from '../nodes/hvv';
import { RULES, canDeploy, chooseSide as pick, deploy as deployAt, endHvv, hitFighter, hvvView, newHvv, stepHvv, youDown as putDown } from './hvv';

const EYE = 1.45; // metres: where a bolt leaves from
const CHEST = 1.1;
const WALL = 2.6; // metres: the arena's edge, how high its light stands
const TRACERS = { far: 140, hear: 40, every: 0.15 };
const BARK = { first: 18, every: 30, spread: 10 };
const TURN = 8;
const FAR = 120;
const UP = new THREE.Vector3(0, 1, 0);

// The arena's edge as a strip of quads standing on the ground: x, y, z a
// vertex, v 0 at the foot and 1 at the top. heightAt(x, z) is the ground's.
export function wallGeometry(points, heightAt, high = WALL) {
  const pos = [];
  const v = [];
  const index = [];
  const n = points.length;
  for (let i = 0; i <= n; i++) {
    const [x, z] = points[i % n];
    const y = heightAt(x, z);
    pos.push(x, y, z, x, y + high, z);
    v.push(0, 1);
    if (i < n) {
      const a = i * 2;
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('v', new THREE.Float32BufferAttribute(v, 1));
  g.setIndex(index);
  return g;
}

// a side's chevron, or the target mark (a ring round a dot, the game's)
function sprite(colour, kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = colour;
  g.strokeStyle = 'rgba(10, 10, 14, 0.85)';
  g.lineWidth = 5;
  if (kind === 'target') {
    g.beginPath();
    g.arc(32, 32, 22, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 7;
    g.strokeStyle = colour;
    g.beginPath();
    g.arc(32, 32, 22, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(32, 32, 8, 0, Math.PI * 2);
    g.fill();
  } else {
    g.beginPath();
    g.moveTo(14, 18);
    g.lineTo(50, 18);
    g.lineTo(32, 46);
    g.closePath();
    g.stroke();
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map: t, sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true, opacity: 0.9 });
}

export function createHvvMission({ parent, world, blaster, mission, emit, say, sounds, warm = (o) => Promise.resolve(o), who = () => null }) {
  const group = new THREE.Group();
  group.name = 'hvv';
  parent.add(group);
  const ground = groundFor(mission.system, 'hvv');
  const colourOf = (side) => mission.sides[side].colour;
  const mats = { light: sprite(colourOf('light'), 'chevron'), dark: sprite(colourOf('dark'), 'chevron'), tlight: sprite(colourOf('light'), 'target'), tdark: sprite(colourOf('dark'), 'target') };
  const env = { solids: world.solids };
  let b = null;
  let seed = 1;
  let dead = false;
  let t = 0;
  let heardAt = -1;
  let barkAt = BARK.first;
  const view = () => (b ? hvvView(b) : null);
  const tell = (event = null) => emit({ type: 'mission', event, view: view() });
  // (a hit in the game's numbers, as a share of your health: the scene's is out of 100)
  const yours = (n) => (n / (gameHealth(b?.fighters[b.you.id]?.hero ?? who()) ?? 700)) * 100;

  // ── the edge ──
  const wall = new THREE.Mesh(wallGeometry(ground.points, (x, z) => groundAt(world, x, z)), wallMaterial());
  wall.renderOrder = 5;
  group.add(wall);

  // ── the bots' bodies, one a fighter, made as the sides are chosen ──
  const bodies = new Map();
  const fwd = new THREE.Vector3();
  const dir = new THREE.Vector3();
  function makeBody(f) {
    const holder = new THREE.Group();
    holder.visible = false;
    group.add(holder);
    const mark = new THREE.Sprite(mats[f.side]);
    mark.scale.setScalar(0.018);
    mark.renderOrder = 8;
    holder.add(mark);
    const tmark = new THREE.Sprite(mats[`t${f.side}`]);
    tmark.scale.setScalar(0.034);
    tmark.renderOrder = 9;
    tmark.visible = false;
    holder.add(tmark);
    const body = { holder, mark, tmark, fig: null, blade: null, gp: null, ready: false, yaw: f.yaw, at: null, speed: 0, down: 0, me: { x: 0, z: 0, yaw: 0 } };
    bodies.set(f.id, body);
    const hero = heroById(f.hero);
    crewFigure(f.hero)
      .then((fig) => {
        if (!fig || dead) return;
        holder.add(fig.model);
        body.fig = fig;
        const tall = fig.tall ?? hero?.tall ?? 1.8;
        mark.position.y = tall + 0.55;
        tmark.position.y = tall + 0.95;
        holder.updateMatrixWorld(true);
        if (hero?.weapon === 'saber') body.blade = bladeInHand(fig, { color: hero.saber?.color ? hexOf(hero.saber.color) : '#ff3b3b', hilt: hero.saber?.hilt ?? null }, { parent: group, stance: hero.saber?.stance ?? 'single', who: f.hero });
        else if (fig.model?.getObjectByName('RightHand')?.isBone) body.gp = createGunplay({ model: fig.model, bones: fig.bones, sockets: fig.sockets }, hero?.weapon ?? 'blaster', { unit: 1, who: f.hero });
        // (hidden till the figure's seen: they hang from the scene, not from it)
        if (body.blade) body.blade.gun.visible = false;
        if (body.gp?.gun) body.gp.gun.visible = false;
        return warm(holder).then(() => (body.ready = true));
      })
      .catch(() => {});
  }

  function draw(body, f, dt, you) {
    if (!body.at) body.at = { x: f.x, z: f.z };
    const dx = f.x - body.at.x;
    const dz = f.z - body.at.z;
    let v = dt > 0 ? Math.hypot(dx, dz) / dt : 0;
    if (v > 20) v = 0; // (put there, not walked)
    body.at.x = f.x;
    body.at.z = f.z;
    body.speed += (v - body.speed) * Math.min(1, dt * 8);
    body.yaw = turn(body.yaw, f.yaw, dt, TURN);
    body.holder.position.set(f.x, groundAt(world, f.x, f.z), f.z);
    body.holder.rotation.set(0, body.yaw, 0, 'YXZ');
    body.tmark.visible = b.targets[f.side] === f.id;
    const fig = body.fig;
    if (!fig) return;
    const near = !you || Math.hypot(f.x - you.x, f.z - you.z) < FAR;
    if (you) fig.cutAt?.(Math.hypot(f.x - you.x, f.z - you.z));
    if (!near) return;
    const pace = f.saber ? RULES.saber.pace : RULES.blaster.pace;
    fig.update(dt, Math.min(1, body.speed / pace));
    fwd.set(Math.sin(body.yaw), 0, Math.cos(body.yaw));
    const m = f.mark != null ? b.fighters[f.mark] : null;
    if (body.blade) {
      body.blade.stand(dt, t, Math.min(1, body.speed / pace));
      body.holder.updateMatrixWorld(true);
      body.blade.block(Boolean(f.mind && guarding(f.mind)));
      // (its stroke's own travel written into a copy, not the rules' place for it)
      Object.assign(body.me, { x: f.x, z: f.z, yaw: body.yaw });
      body.blade.pose(dt, t, { forward: fwd, up: UP, me: body.me, dir: null, targets: [] });
    } else if (body.gp) {
      body.holder.updateMatrixWorld(true);
      let aim = null;
      if (m?.up) {
        dir.set(m.x - f.x, CHEST + 0.3 - EYE, m.z - f.z);
        aim = dir.lengthSq() > 1e-6 ? dir.normalize() : null;
      }
      body.gp.set(dt, { aim: aim ? 1 : 0, look: aim ? 1 : 0, dir: aim, forward: fwd, up: UP });
    }
  }

  // down: it reels into its own fall (a figure with clips), then it's gone till it's back
  const fell = (id, from = null) => {
    const body = bodies.get(id);
    if (!body || body.down) return;
    body.down = 0.001;
    body.mark.visible = false;
    body.tmark.visible = false;
    body.blade?.light(false);
    const f = b.fighters[id];
    if (body.fig?.react) body.fig.react('down', { dir: from ? { x: f.x - from[0], z: f.z - from[1] } : null, yaw: body.yaw, force: 0.5 });
  };
  const back = (id) => {
    const body = bodies.get(id);
    const f = b.fighters[id];
    if (!body || !f) return;
    body.fig?.stop?.(0.1, 'full');
    body.down = 0;
    body.at = null;
    body.yaw = f.yaw;
    body.mark.visible = true;
    body.blade?.light(true);
    body.holder.visible = body.ready;
  };

  function reset() {
    for (const body of bodies.values()) {
      body.blade?.dispose();
      body.gp?.dispose?.();
      body.fig?.dispose?.();
      disposeTree(body.holder);
      body.holder.removeFromParent();
    }
    bodies.clear();
    barkAt = t + BARK.first;
  }

  function begin() {
    reset();
    b = newHvv(ground, { seed, stars: mission.stars });
    tell();
  }

  return {
    begin,
    restart() {
      seed += 1;
      begin();
    },
    update(dt, you, { sim = null, swinging = null } = {}) {
      t += dt;
      wall.material.uniforms.uTime.value = t;
      const atYou = [];
      if (!b) return { atYou };
      const events = stepHvv(b, dt, you ? { x: you.x, z: you.z, yaw: you.yaw, swinging, sim } : null, env);
      for (const e of events) {
        if (e.type === 'shot') {
          const f = b.fighters[e.id];
          const from = [e.from[0], groundAt(world, e.from[0], e.from[1]) + EYE, e.from[1]];
          if (e.atYou) atYou.push({ from, spread: 0.05, damage: yours(e.damage), color: colourOf(f.side) });
          else if (you && Math.hypot(e.from[0] - you.x, e.from[1] - you.z) < TRACERS.far) {
            const off = e.hit ? 0 : 1;
            const to = [e.to[0] + (Math.random() - 0.5) * 2 * off, groundAt(world, e.to[0], e.to[1]) + CHEST + (Math.random() - 0.5) * off, e.to[1] + (Math.random() - 0.5) * 2 * off];
            blaster.tracer(from, to, colourOf(f.side));
          }
          if (you && t - heardAt > TRACERS.every && Math.hypot(e.from[0] - you.x, e.from[1] - you.z) < TRACERS.hear) {
            heardAt = t;
            sounds.blast?.();
          }
        } else if (e.type === 'stroke') {
          const body = bodies.get(e.id);
          if (body?.blade && body.ready) body.blade.swing(t, { clip: e.clip, lock: null });
        } else if (e.type === 'hit' && e.you) {
          // (its engine and yours decided it: it lands)
          atYou.push({ melee: true, blade: true, damage: yours(e.damage), from: e.from });
        }
        else if (e.type === 'down') fell(e.id, e.from);
        else if (e.type === 'spawn') back(e.id);
        else if (e.type === 'oob') atYou.push({ melee: true, oob: true, damage: 1000, from: null });
        else if (e.type === 'score' || e.type === 'target') tell(e);
        else if (e.type === 'end') {
          say(mission.lines?.[e.won ? 'won' : 'lost']);
          tell({ type: e.won ? 'won' : 'lost' });
        }
      }
      // one of your side's heroes, now and then, in their own words
      if (b.phase === 'run' && !b.result && b.you.side && t > barkAt) {
        barkAt = t + BARK.every + (Math.random() - 0.5) * BARK.spread;
        const mates = b.fighters.filter((f) => f.side === b.you.side && !f.you && f.up);
        const f = mates[Math.floor(Math.random() * mates.length)];
        const line = f && heroById(f.hero)?.lines?.ours;
        if (line) say([[heroById(f.hero).name, line]]);
      }
      for (const f of b.fighters) {
        const body = bodies.get(f.id);
        if (!body) continue;
        // (its blade or gun hangs from the scene, not the figure: seen only with it)
        const armed = body.holder.visible && !body.down;
        if (body.blade) body.blade.gun.visible = armed;
        if (body.gp?.gun) body.gp.gun.visible = armed;
        if (!f.up) {
          if (body.down) {
            body.down += dt;
            body.fig?.update(dt, 0, { speed: 0, side: 0, turn: 0 });
            if (body.down > 2.5) body.holder.visible = false;
          }
          continue;
        }
        if (!body.holder.visible && body.ready && !body.down) body.holder.visible = true;
        draw(body, f, dt, you);
      }
      return { atYou };
    },
    // what your blaster or blade can hit: the other side's heroes standing
    get targets() {
      if (!b || !b.you.side) return [];
      const out = [];
      for (const f of b.fighters) {
        if (!f.up || f.you || f.side === b.you.side) continue;
        const body = bodies.get(f.id);
        if (!body?.holder.visible) continue;
        // (with its saber's engine and its facing: your strike's meets its block there, saber.js)
        out.push({ id: f.id, holder: body.holder, fig: { tall: body.fig?.tall ?? 1.8 }, spec: { kind: f.hero }, sim: f.sim ?? null, b: { x: f.x, z: f.z, yaw: f.yaw } });
      }
      return out;
    },
    // one of yours landed: a bolt on a raised guard turned; a strike as your
    // saber's engine landed it, the game's damage (its block decided there)
    hit(target, damage = null) {
      const f = b?.fighters[target.id];
      if (!f?.up) return;
      if (damage == null && f.mind && guarding(f.mind)) {
        tell({ type: 'block', id: f.id });
        return;
      }
      const ev = hitFighter(b, f.id, damage != null ? (f.sim ? f.sim.taken(damage, b.t) : damage) : RULES.yours);
      bodies.get(f.id)?.fig?.react?.('hit', { where: 'chest' });
      if (ev) {
        fell(ev.id, ev.from);
        tell(ev);
      }
    },
    running: () => Boolean(b && b.phase === 'run' && !b.result),
    started: () => Boolean(b && b.phase !== 'choose'),
    view,
    // the compass: the other side's target
    target() {
      if (!b || !b.you.side || b.result) return null;
      const f = b.fighters[b.targets[b.you.side === 'light' ? 'dark' : 'light']];
      return f?.up ? [f.x, f.z] : null;
    },
    chooseSide(side) {
      if (!b || b.phase !== 'choose') return;
      pick(b, side, who());
      for (const f of b.fighters) if (!f.you) makeBody(f);
      say(mission.lines?.start);
      tell({ type: 'start', side });
    },
    deploy() {
      if (!b || !canDeploy(b)) return null;
      const at = deployAt(b);
      if (at) tell({ type: 'deploy' });
      return at;
    },
    youDown() {
      if (!b) return;
      putDown(b);
      tell({ type: 'youDown' });
    },
    force(how) {
      if (!b || b.result) return;
      endHvv(b, how === 'win', 'points');
      say(mission.lines?.[how === 'win' ? 'won' : 'lost']);
      tell({ type: how === 'win' ? 'won' : 'lost' });
    },
    // (dev: a point to a side, as if its foe's target fell)
    score(side) {
      if (!b || b.result) return;
      const foe = side === 'light' ? 'dark' : 'light';
      const id = b.targets[foe];
      const f = b.fighters[id];
      if (f.you) putDown(b);
      else hitFighter(b, id, 1e6, null);
      if (!f.you) fell(id);
      tell({ type: 'score', side });
    },
    dispose() {
      dead = true;
      reset();
      for (const m of Object.values(mats)) {
        m.map.dispose();
        m.dispose();
      }
      disposeTree(group);
      group.removeFromParent();
    },
  };
}

// a hero's blade colour id to its hex (heroes.js's SABER_COLORS)
const hexOf = (id) => SABER_COLORS.find((c) => c.id === id)?.hex ?? id;
