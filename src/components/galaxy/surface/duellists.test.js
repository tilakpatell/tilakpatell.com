// A duel, headless, on the game's rules: two figures on the game's rig
// (walrusFigure.fixture.js), each its saber and its saber's engine
// (lib/combat/saber2017.js). Their strike at you lands the game's damage
// unless your block meets it from the front (your stamina pays, they
// recoil); yours at them the same; a brawler's swipe is the AI's melee
// projectile, which your block's shield turns from the front.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { saberOf } from '../../../lib/combat/saber2017';
import { createGunplay } from '../../universe/gunplay';
import { asTarget, landed, met, recoiled, swingingOf } from './duellists';
import { createSaber } from './saber';
import { walrusFigure } from './walrusFigure.fixture';

const UP = new THREE.Vector3(0, 1, 0);
const DT = 1 / 60;

// a figure with a lit saber at x, z, facing yaw
async function fighter(x, z, yaw, hero = 'luke') {
  const { fig, scene, holder } = await walrusFigure();
  const gp = createGunplay(fig, 'saber', { unit: 1 });
  const saber = createSaber(gp, { parent: scene, fig, hero, tier: 'low' });
  saber.light(true);
  const me = { x, z, yaw };
  return {
    saber,
    me,
    holder,
    fig: { tall: 1.8 },
    spec: {},
    b: me,
    get blocking() {
      return saber.sim.deflecting;
    },
    blade: { saber },
    frame(now, p = {}) {
      holder.position.set(me.x, 0, me.z);
      holder.rotation.y = me.yaw;
      scene.updateMatrixWorld(true);
      const forward = new THREE.Vector3(Math.sin(me.yaw), 0, Math.cos(me.yaw));
      gp.set(DT, { aim: 0.75, look: 0, dir: null, forward, up: UP });
      saber.update(DT, now, { forward, up: UP, me, ...p });
    },
  };
}

// they at the origin facing +z, you 2.2 m ahead facing them; both lit a moment
async function duel() {
  const them = await fighter(0, 0, 0, 'vader');
  const you = await fighter(0, 2.2, Math.PI);
  const youT = asTarget();
  let now = 0;
  const step = (fn) => fn((now += DT));
  for (let i = 0; i < 20; i++) step((t) => (them.frame(t), you.frame(t)));
  // a duellist as activity.js has one
  const t = { blade: { saber: them.saber }, hostile: {}, b: them.me, holder: them.holder, fig: them.fig };
  return { them, you, youT, t, step, get now() {
    return now;
  } };
}

// their strike at you to its end; what reached you, as the scene hears it
function theirStrike(d) {
  const sw = d.them.saber.swing(d.now, { lock: d.youT });
  expect(sw).toBeTruthy();
  const out = [];
  for (let i = 0; i < 120 && (d.them.saber.swinging || out.length === 0) && i < 120; i++)
    d.step((now) => {
      d.youT.at(d.you.me, d.you.saber.sim);
      d.you.frame(now);
      d.them.frame(now, {
        targets: [d.youT],
        hit: (x, damage, at, o) => out.push(landed(d.t, x, damage, at, o)),
        blocked: (x, at) => out.push(recoiled(d.t, x, at, 'block')),
      });
    });
  return out.filter(Boolean);
}

describe('a duellist’s strike at you', () => {
  it('lands the game’s damage with no block, the engine’s', async () => {
    const d = await duel();
    const [c] = theirStrike(d);
    expect(c).toMatchObject({ melee: true, blade: true, game: saberOf('vader').damage.hit.damage, behind: false });
  });

  it('into your held block from the front: nothing lands, your stamina pays, they recoil', async () => {
    const d = await duel();
    d.you.saber.block(true);
    const out = theirStrike(d);
    expect(out.map((c) => c.met ?? 'hit')).toEqual(['block']);
    expect(d.you.saber.view().stamina).toBeCloseTo(1 - saberOf('luke').stamina.blocked / 100);
    expect(d.them.saber.swinging).toBe(null);
  });
});

describe('your strike at a duellist', () => {
  const yours = (d, them) => {
    const hits = [];
    const met = [];
    d.you.saber.swing(d.now);
    for (let i = 0; i < 90; i++)
      d.step((now) => {
        d.them.frame(now);
        d.you.frame(now, { targets: [them], hit: (x, n) => hits.push(n), blocked: (x) => met.push(x) });
      });
    return { hits, met };
  };

  it('is met on its held block from the front, and its stamina pays', async () => {
    const d = await duel();
    d.them.saber.block(true);
    const { hits, met: m } = yours(d, d.them);
    expect(hits).toEqual([]);
    expect(m).toHaveLength(1);
    expect(d.them.saber.view().stamina).toBeCloseTo(1 - saberOf('vader').stamina.blocked / 100);
  });

  it('lands when its block isn’t up', async () => {
    const d = await duel();
    const { hits } = yours(d, d.them);
    expect(hits).toEqual([saberOf('luke').damage.hit.damage]);
  });

  it('is read by its mind with the way it cuts, where you face and your rules’ query', async () => {
    const d = await duel();
    d.you.saber.swing(d.now);
    const sw = swingingOf(d.you.saber, d.now + 0.05, Math.PI);
    expect(sw).toMatchObject({ yaw: Math.PI, query: saberOf('luke').query });
    expect(sw.t).toBeCloseTo(0.05, 5);
  });
});

describe('a brawler’s swipe', () => {
  it('is turned by your block’s shield from the front, costing the AI’s melee damage; from behind it lands', async () => {
    const you = await fighter(0, 0, 0);
    you.saber.block(true);
    you.frame(0.1);
    const front = met({ damage: 14, from: [0, 0, 2] }, { saber: you.saber, me: you.me, now: 0.1 });
    expect(front).toMatchObject({ how: 'block', damage: 0 });
    const ai = saberOf('luke').ai.melee;
    expect(you.saber.view().stamina).toBeCloseTo(1 - (saberOf('luke').stamina.bolt * ai.damage) / saberOf('luke').stamina.standardBolt / 100);
    const back = met({ damage: 14, from: [0, 0, -2] }, { saber: you.saber, me: you.me, now: 0.1 });
    expect(back).toMatchObject({ how: 'hit', damage: 14 });
  });
});
