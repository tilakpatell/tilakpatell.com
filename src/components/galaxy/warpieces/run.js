// A reactor run: in through a mouth in a hull, down a tunnel (galaxy/
// tunnel.js) to a reactor, shoot it, and out again before it goes. The
// second Death Star's at Endor (endor.js) and any Star Destroyer's from its
// belly hangar (hangar.js) are runs.
//
// It's shut till it's open (the Death Star's shield down; a Star Destroyer
// near enough). Near its mouth the hull it's in lets the ship through
// (ctx.solidsOff), and once in, the ship's kept inside the tunnel (a wall
// is a bump, and costs shields) and slowed to what it can be flown at. Its
// reactor, once you're in, is a target: its damage is shared with the
// pilots in the system (the battle's tally: `key`), counted only from the
// side it's `team`'s to take (ctx.mineAs). When it's gone the
// lights go red and there's `escape` seconds to get out; then it blows
// (onBlown), and anyone still inside goes with it. In the battle every
// pilot shares (a plan's run: Endor's), whether it's gone and how much of
// it's left are the director's (`down()`, `left()`: a share of it).
//
// createRun(ctx, { key, team, name, mouth, inward, up, path, radius, chamber,
//   look, hp, escape, speed, open(), solidsOff(off), onBlown(), enter, down?(),
//   left?() })
//   → { update(dt, t, live) → { ship?, hurt?, speedCap?, kill? }, hit(from, to,
//   damage), targets, markers, state, inside, dispose() }

import * as THREE from 'three';
import { sweptHit } from '../../universe/targeting';
import { buildTunnel, frameOf, keepIn } from '../nodes/tunnel';

const ZERO = { x: 0, y: 0, z: 0 };
const OPEN = '#ffb347';
const HOT = '#ff5a4a';

export function createRun(ctx, o) {
  const { key, team, name, mouth, inward, up, path, radius, chamber, look = 'ds2', hp, escape = 20, speed = 9 } = o;
  const frame = frameOf(mouth, inward, up);
  const tube = { path, radius, chamber };
  let state = 'shut'; // 'open', 'blown', 'done'
  let drawn = null;
  let inside = false;
  let zone = false;
  let bumpCool = 0;
  let left = 0; // seconds to get out, once it's blown
  let mineBlown = false;
  let where = null; // where in it the ship was last: 'tube', 'chamber'
  const core = { x: 0, y: 0, z: 0 };
  const mouthAt = { x: mouth[0], y: mouth[1], z: mouth[2] };
  const coreR = chamber * 0.26;

  const build = () => {
    if (drawn) return;
    drawn = buildTunnel(path, { radius, chamber, look, small: ctx.small });
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...frame.x), new THREE.Vector3(...frame.y), new THREE.Vector3(...frame.z));
    drawn.group.quaternion.setFromRotationMatrix(m);
    drawn.group.position.set(...mouth);
    ctx.scene?.add(drawn.group);
    const c = frame.toWorld(drawn.centre);
    core.x = c[0];
    core.y = c[1];
    core.z = c[2];
  };

  const blow = (mine) => {
    if (state === 'blown' || state === 'done') return;
    state = 'blown';
    left = escape;
    mineBlown = mine;
    ctx.draw?.flash(core, { size: chamber * 1.2, life: 1.4, color: [3, 1.6, 0.6], bright: 1.4 });
    ctx.event?.('gcw-reactor');
    o.onHit?.(mine);
  };

  const tgt = { id: o.id ?? 5e6, at: core, vel: ZERO, size: coreR, kind: 'reactor', name, hp, hpMax: hp, threat: 0 };
  // gone, and how much is left (the director's, if it's a plan's run)
  const gone = () => (o.down ? o.down() : ctx.shared(key) >= hp);
  const hpLeft = () => (o.left ? o.left() * hp : Math.max(0, hp - ctx.shared(key)));
  const run = {
    get state() {
      return state;
    },
    get inside() {
      return inside;
    },
    get core() {
      return core;
    },
    get left() {
      return left;
    },
    get where() {
      return inside ? where : null;
    },
    // (a dev hook, for the browser checks: the escape's seconds cut short)
    hurry() {
      if (state === 'blown') left = Math.min(left, 1.5);
    },
    update(dt, t, live) {
      if (state === 'done') return {};
      if (state === 'shut' && o.open()) state = 'open';
      // near enough to matter: the tunnel's drawn (only then: they're not cheap)
      const near = live && Math.hypot(live.x - mouth[0], live.y - mouth[1], live.z - mouth[2]) < (o.drawWithin ?? 400);
      if (state !== 'shut' && (near || inside)) build();
      // what's been done to the reactor, here and by the pilots in the system
      if (state === 'open' && gone()) blow(false);
      drawn?.update(t, state === 'blown' ? 1 : 0);
      bumpCool -= dt;
      const out = {};
      if (state === 'blown') {
        left -= dt;
        if (left <= 0) {
          state = 'done';
          if (inside) out.kill = true;
          inside = false;
          if (zone) o.solidsOff(false);
          zone = false;
          o.onBlown?.(mineBlown);
          drawn?.dispose();
          drawn = null;
          return out;
        }
      }
      if (!live || state === 'shut') return out;
      const l = frame.toLocal([live.x, live.y, live.z]);
      const across = Math.hypot(l[0], l[1]);
      // the mouth: the hull lets you through here
      const atMouth = across < radius * 1.8 && l[2] > -radius * 4 && l[2] < radius * 2.5;
      if (!inside && atMouth !== zone) {
        zone = atMouth;
        o.solidsOff(zone);
      }
      if (!inside && zone && l[2] > 0.15 && across < radius) {
        inside = true;
        o.enter?.();
      }
      if (!inside) return out;
      const k = keepIn(tube, l, 0.18);
      where = k.where;
      if (k.where === 'out' || k.where === 'away') {
        inside = false;
        if (k.where === 'away' && zone) {
          zone = false;
          o.solidsOff(false);
        }
        return out;
      }
      if (k.bumped) {
        const w = frame.toWorld(k.p);
        out.ship = { x: w[0], y: w[1], z: w[2] };
        if (bumpCool <= 0) {
          out.hurt = 4;
          bumpCool = 0.35;
        }
      }
      out.speedCap = speed;
      return out;
    },
    // your shot: the reactor, if you're in there to see it
    hit(from, to, damage) {
      if (state !== 'open' || !inside || !drawn) return null;
      const k = sweptHit(from, to, core, core, coreR);
      if (k === null) return null;
      ctx.mineAs(team, key, damage);
      if (gone()) blow(true);
      return { id: tgt.id, kind: 'reactor', at: { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, z: from.z + (to.z - from.z) * k }, size: coreR, down: false, sub: key };
    },
    get targets() {
      if (state !== 'open' || !inside || !drawn) return [];
      tgt.hp = hpLeft();
      return [tgt];
    },
    // what's marked: the way in, the reactor, the way out
    markers(live) {
      if (state === 'shut' || state === 'done' || !live) return [];
      const d = Math.hypot(live.x - mouth[0], live.y - mouth[1], live.z - mouth[2]);
      if (state === 'blown') return [{ key: `${key}-out`, pos: mouthAt, title: `Get out: ${Math.ceil(left)} s`, colour: HOT }];
      if (inside) return drawn ? [{ key: `${key}-core`, pos: core, title: `Destroy: ${name}`, hp: hpLeft() / hp, colour: OPEN }] : [];
      return d < (o.markWithin ?? 260) ? [{ key: `${key}-in`, pos: mouthAt, title: o.wayIn ?? `Fly in: ${name}`, colour: OPEN }] : [];
    },
    dispose() {
      if (zone) o.solidsOff(false);
      drawn?.dispose();
      drawn = null;
    },
  };
  return run;
}
