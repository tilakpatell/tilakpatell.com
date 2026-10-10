import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ARMS, DEATH, armsOf, createActivity, fallen, friendlyAim, hostileAim, nextForce, upToFire } from './activity';
import { GUNS } from '../../universe/gunplay';

// The figures, for the body's tests: a Tusken and Vader on Meshy's skeleton
// (the fixture's, on the catalogue's animator, as a rigged crew figure
// would be), and nobody else (a stormtrooper is then built from shapes)
const made = vi.hoisted(() => ({ n: 0 }));
vi.mock('./crew', () => ({
  crewFigure: async (kind) => {
    if (!['tusken', 'vader'].includes(kind)) return null;
    const { modelFigureOf } = await vi.importActual('./actors');
    // (Vader on the game's rig: the only figure that fences)
    if (kind === 'vader') {
      const { walrusFigure } = await import('./walrusFigure.fixture');
      const w = (await walrusFigure()).fig;
      const fig = modelFigureOf(w.model, { animations: Object.values(w.clips), anim: { idle: 'idle', walk: 'walk', run: 'run' }, seed: ++made.n });
      return { ...fig, tall: 1.8, bones: w.bones, sockets: w.sockets, rig: 'walrus', clips: w.clips };
    }
    const { meshyRig } = await import('../../../lib/three/meshyRig.fixture');
    const rig = meshyRig();
    const fig = modelFigureOf(rig.model, { animations: Object.values(rig.clips), anim: { idle: 'idle', walk: 'walk', run: 'run' }, seed: ++made.n });
    return { ...fig, tall: 1.8, bones: rig.bones };
  },
}));
vi.mock('./actors', async () => ({ ...(await vi.importActual('./actors')), modelFigure: async () => null }));

const one = (x, z, over = {}) => ({ b: { x, z, yaw: 0 }, hostile: { range: 20, every: 2, damage: 8 }, spec: {}, down: 0, fig: {}, holder: { position: { x, y: 1500, z } }, ...over });

describe('a duellist’s Force', () => {
  it('a force push falls due every `force.every` seconds within 8 m and never beyond', () => {
    const h = { force: { every: 7, push: 9 } };
    const t = { forceAt: -99 };
    expect(nextForce(t, h, 5, 10)).toBe(true);
    t.forceAt = 10;
    expect(nextForce(t, h, 5, 12)).toBe(false);
    expect(nextForce(t, h, 5, 16.9)).toBe(false);
    expect(nextForce(t, h, 5, 17.1)).toBe(true);
    expect(nextForce(t, h, 8.5, 40)).toBe(false);
    expect(nextForce(t, {}, 2, 40)).toBe(false);
    expect(nextForce(t, null, 2, 40)).toBe(false);
  });
});

describe('a friend who fights beside you', () => {
  it('a friendly spawn’s shot is at the nearest hostile, not you', () => {
    const me = one(0, 0, { spec: { side: 'yours' } });
    const far = one(15, 0);
    const near = one(4, 3);
    const down = one(1, 1, { down: 2 });
    const friend = one(2, 0, { spec: { side: 'yours' } });
    const civil = one(1, 0, { hostile: null });
    expect(friendlyAim(me, [far, near, down, friend, civil, me])).toBe(near);
    expect(friendlyAim(me, [down, friend, civil])).toBe(null);
    // (a hostile isn't a friend: nothing for it here)
    expect(friendlyAim(far, [me, near])).toBe(null);
  });
  it('a hostile fires at the friend nearer than you, else at you', () => {
    const trooper = one(0, 0);
    const friend = one(3, 0, { spec: { side: 'yours' } });
    const you = { x: 10, z: 0 };
    expect(hostileAim(trooper, you, [trooper, friend])).toEqual({ x: 3, z: 0, victim: friend });
    expect(hostileAim(trooper, you, [trooper, one(12, 0, { spec: { side: 'yours' } })])).toEqual({ x: 10, z: 0, victim: null });
    expect(hostileAim(trooper, null, [trooper, friend]).victim).toBe(friend);
    expect(hostileAim(trooper, null, [trooper])).toBe(null);
    // (a friend down is no target)
    expect(hostileAim(trooper, you, [trooper, one(3, 0, { spec: { side: 'yours' }, down: 1 })]).victim).toBe(null);
  });
});

describe('what a hostile carries', () => {
  it('a Tusken its long rifle, Jango his WESTAR, a duellist its saber, a brawler or a beast nothing', () => {
    expect(armsOf({ kind: 'tusken', hostile: { range: 45 } })).toBe('sniper');
    expect(armsOf({ kind: 'jango', hostile: { range: 30 } })).toBe('westar');
    expect(armsOf({ kind: 'greedo', hostile: { range: 14 } })).toBe('blaster');
    expect(armsOf({ kind: 'vader', hostile: { melee: true, blade: { color: '#f00' } } })).toBe('saber');
    expect(armsOf({ kind: 'ugnaught', hostile: { melee: true, chase: 2.4 } })).toBe(null);
    expect(armsOf({ kind: 'rancor', hostile: { melee: true } })).toBe(null);
    expect(armsOf({ kind: 'womprat' })).toBe(null);
    // (anyone else with a gun: a blaster; a spawn may say its own)
    expect(armsOf({ kind: 'someone', hostile: { range: 20 } })).toBe('blaster');
    expect(armsOf({ kind: 'tusken', gun: 'a280', hostile: { range: 20 } })).toBe('a280');
    // (the soldiers their own: the troopers' E-11, the clones' DC-15A, the B1s' E-5)
    for (const kind of ['stormtrooper', 'sandtrooper', 'snowtrooper', 'shoretrooper', 'deathtrooper']) expect(armsOf({ kind, hostile: { range: 30 } }), kind).toBe('e11');
    expect(armsOf({ kind: 'clone', hostile: { range: 30 } })).toBe('dc15');
    expect(armsOf({ kind: 'battledroid', hostile: { range: 30 } })).toBe('e5');
    for (const g of Object.values(ARMS)) expect(GUNS[g]).toBeDefined();
  });
});

describe('a body that’s gone down', () => {
  it('falls over its clip’s length (or a tip’s), lies two seconds, sinks, and is gone', () => {
    const tip = fallen(0.45);
    expect(tip.k).toBeCloseTo(0.5, 5);
    expect(tip.sink).toBe(0);
    expect(fallen(DEATH.fall).k).toBe(1);
    // lying: still there two seconds after its fall
    expect(fallen(DEATH.fall + DEATH.lie - 0.01).sink).toBe(0);
    expect(fallen(DEATH.fall + DEATH.lie - 0.01).gone).toBe(false);
    // then into the ground, and gone
    expect(fallen(DEATH.fall + DEATH.lie + DEATH.sink / 2).sink).toBeCloseTo(DEATH.deep / 2, 5);
    expect(fallen(DEATH.fall + DEATH.lie + DEATH.sink + 0.01).gone).toBe(true);
    // on a clip of its own: two seconds after the clip's end
    expect(fallen(2.4 + DEATH.lie - 0.01, 2.4).gone).toBe(false);
    expect(fallen(2.4 + DEATH.lie - 0.01, 2.4).sink).toBe(0);
    expect(fallen(2.4 + DEATH.lie + DEATH.sink + 0.01, 2.4).gone).toBe(true);
  });
});

describe('up to fire', () => {
  it('stands and brings the gun up just before its shot, and stays up a moment after', () => {
    const t = { aim: { x: 0, z: 9 }, cool: 2, firedAt: -99 };
    expect(upToFire(t, 10)).toBe(false);
    t.cool = 0.3;
    expect(upToFire(t, 10)).toBe(true);
    // (left waiting for its turn to shoot: back down)
    t.cool = -1;
    expect(upToFire(t, 10)).toBe(false);
    t.firedAt = 9.5;
    expect(upToFire(t, 10)).toBe(true);
    expect(upToFire(t, 10.5)).toBe(false);
    // nothing to shoot at: not up for a shot that won't come
    expect(upToFire({ aim: null, cool: 0.2, firedAt: -99 }, 10)).toBe(false);
  });
});

describe('a hostile’s body in the world', () => {
  // (a page's canvas, for the health bars and the marks over heads)
  const had = globalThis.document;
  beforeAll(() => {
    const pen = new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => pen) });
    globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => pen }) };
  });
  afterAll(() => {
    globalThis.document = had;
  });
  const DT = 1 / 30;
  const world = { heightAt: () => 0, solids: null };
  // (until its figure's in: the model loads off disk, slower with the whole suite running beside it)
  const settle = async (a) => {
    for (let i = 0; i < 2000 && !a.debug().every((t) => t.fig); i++) await new Promise((r) => setTimeout(r, 1));
  };
  const out = (kind, over = {}) => {
    const a = createActivity({ parent: new THREE.Group(), world });
    const quest = { id: 'q', steps: [{ type: 'shoot', tag: 'foe', n: 1, spawn: { kind, at: [0, 12], hp: 2, tag: 'foe', face: Math.PI, still: true, hostile: { range: 40, every: 1.2, damage: 5, delay: 0.4 }, ...over } }] };
    a.show(quest, { step: 0, count: 0 });
    return a;
  };
  const run = (a, you, from, seconds, each = null) => {
    const events = [];
    const shots = [];
    for (let t = from; t < from + seconds; t += DT) {
      events.push(...a.update(DT, you, t));
      shots.push(...a.shooters(DT, you, t));
      each?.(t);
    }
    return { events, shots };
  };

  it('a rigged Tusken raises its rifle on you and fires from the muzzle; shot, it goes down the way the shot went, lies, and is gone', async () => {
    const a = out('tusken');
    await settle(a);
    const t = a.targets[0];
    expect(t.gp?.kind).toBe('sniper');
    const you = { x: 0, y: 0, z: 0 };
    const { shots } = run(a, you, 0, 3);
    const d = a.debug()[0];
    expect(d.body.gun).toBe('sniper');
    expect(d.body.rigged).toBe(true);
    expect(d.body.up).toBeGreaterThan(0.5);
    expect(shots.length).toBeGreaterThan(0);
    // (from its muzzle, out ahead of it toward you, not from its middle as before)
    const s = shots.at(-1);
    expect(s.from[2]).toBeLessThan(12 - 0.2);
    expect(s.to).toEqual([0, 0]);
    // shot from in front: it goes down backward, the kill counted as ever
    a.hit(t, 5, { push: new THREE.Vector3(0, 0, 1), at: new THREE.Vector3(0, 1.75, 12) });
    expect(t.down).toBeGreaterThan(0);
    expect(t.death.dir.z).toBeCloseTo(1, 5);
    const { events } = run(a, you, 3, 0.5);
    expect(events.filter((e) => e.type === 'kill')).toEqual([{ type: 'kill', tag: 'foe' }]);
    // its clip asked for (die.fwd or die.back, by the way it was shot); here,
    // with none fetched, it stands a moment, then goes over about its feet
    // from then, the way the shot went
    expect(t.death.clip).toMatch(/^die\./);
    run(a, you, 3.5, 1.2);
    expect(t.death.clip).toBe(null);
    const up = () => new THREE.Vector3(0, 1, 0).applyQuaternion(t.holder.quaternion);
    expect(up().y).toBeGreaterThan(0.8);
    run(a, you, 4.7, 1.2);
    expect(up().z).toBeGreaterThan(0.95);
    expect(t.holder.visible).toBe(true);
    run(a, you, 5.9, 3.2);
    expect(t.holder.visible).toBe(false);
    a.dispose();
  });

  it('a duellist holds its saber in its own hand; one built from shapes holds no gun and goes down as before, without its clip', async () => {
    const v = out('vader', { hostile: { range: 16, chase: 2, melee: true, reach: 2.6, every: 1.5, damage: 16, parry: 0.8, guard: 4, blade: { color: '#ff3b3b' } } });
    await settle(v);
    expect(v.debug()[0].body.gun).toBe('saber:hand');
    // (in the game's weapon socket)
    expect(v.targets[0].blade.gun.parent).toBe(v.targets[0].blade.gp.socket);
    // it fences you (duellists.js): closes from 12 m, circles at its reach, strokes; nothing lands on the decision
    const seen = new Set();
    const fought = run(v, { x: 0, y: 0, z: 0 }, 0, 8, () => seen.add(v.debug()[0].body.duel)).shots;
    expect([...seen]).toEqual(expect.arrayContaining(['approach', 'circle', 'attack']));
    expect(Math.hypot(v.targets[0].b.x, v.targets[0].b.z)).toBeLessThan(5);
    expect(fought.filter((x) => x.melee && !x.blade)).toEqual([]);
    v.dispose();
    const s = out('stormtrooper');
    await settle(s);
    const t = s.targets[0];
    expect(s.debug()[0].body.gun).toBe(null);
    const { shots } = run(s, { x: 0, y: 0, z: 0 }, 0, 3);
    // (its shots from where they always came)
    expect(shots.length).toBeGreaterThan(0);
    expect(shots[0].from).toEqual([t.b.x, t.holder.position.y + 1.4, t.b.z]);
    s.kill('foe');
    const { events } = run(s, { x: 0, y: 0, z: 0 }, 3, 0.4);
    expect(events.some((e) => e.type === 'kill')).toBe(true);
    s.dispose();
  });

  it('hands the camera’s position (update’s eye) to a duellist’s blade, standing and going down', async () => {
    const v = out('vader', { hostile: { range: 16, chase: 2, melee: true, reach: 2.6, every: 1.5, damage: 16, blade: { color: '#ff3b3b' } } });
    await settle(v);
    const blade = v.targets[0].blade;
    const pose = vi.spyOn(blade, 'pose');
    const down = vi.spyOn(blade, 'out');
    const eye = new THREE.Vector3(0, 1.6, -3);
    const you = { x: 0, y: 0, z: 0 };
    v.update(DT, you, 0, { eye });
    expect(pose.mock.calls.at(-1)[2].eye).toBe(eye);
    v.kill('foe');
    v.update(DT, you, DT, { eye });
    expect(down.mock.calls.at(-1)[2].eye).toBe(eye);
    v.dispose();
  });

  it('raises a duellist’s block on the side of it your stroke comes in on (duellists.js’s blockSide)', async () => {
    const v = out('vader', { hostile: { range: 16, chase: 2, melee: true, reach: 2.6, every: 1.5, damage: 16, parry: 1, blade: { color: '#ff3b3b' } } });
    await settle(v);
    const block = vi.spyOn(v.targets[0].blade, 'block');
    // (you 2 m before it, facing it, cutting from your right: its left)
    const you = { x: 0, y: 0, z: 10, yaw: 0 };
    for (let i = 0; i < 3; i++) v.update(DT, you, i * DT, { swinging: { contact: [0.3, 0.5], t: i * DT, speed: 1, cut: 'right', yaw: 0 } });
    expect(block).toHaveBeenLastCalledWith(true, 'left');
    v.dispose();
  });
});

describe('one table of troops', () => {
  it('the arms are ground/troops.js’s', async () => {
    const { ARMS } = await import('./activity');
    const troops = await import('./ground/troops');
    expect(ARMS).toBe(troops.ARMS);
  });
});
