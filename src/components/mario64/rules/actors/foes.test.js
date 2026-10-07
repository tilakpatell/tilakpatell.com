import { describe, expect, it } from 'vitest';
import { createKit } from '../../courses/shapes';
import { makeWorld, rest } from '../collide';
import { newMario, stepMario } from '../mario';
import { interact, newScene, pressB, stepActors } from './index';

const floor = () => {
  const k = createKit();
  k.box({ x: 0, y: -100, z: 0, w: 40000, h: 100, d: 40000, mat: 'g' });
  const o = k.done();
  return makeWorld(o.tris, o.kinds, { deathY: -3000 });
};
const input = (o = {}) => ({ sx: 0, sy: 0, a: false, ap: false, b: false, bp: false, z: false, zp: false, walk: false, camYaw: 0, ...o });
const scene = (mario = newMario({ x: 0, y: 0, z: -3000 })) => newScene({ world: floor(), mario, save: { stars: {} }, area: {} });
// one frame of the course: B on something first, then Mario, then the rest
function frame(g, inp = input()) {
  const i = { ...inp };
  if (i.bp && pressB(g)) i.bp = false;
  stepMario(g.mario, i, g.world);
  rest(g.world);
  stepActors(g);
  interact(g);
}
const frames = (g, n, inp) => {
  for (let i = 0; i < n; i++) frame(g, typeof inp === 'function' ? inp(i) : inp);
};
const events = (g, type) => g.out.filter((e) => e.type === type);

describe('Goombas', () => {
  it('are squashed by a stomp, bouncing Mario up, and leave a coin', () => {
    const g = scene(newMario({ x: 0, y: 400, z: 0 }));
    g.spawn({ type: 'goomba', x: 0, y: 0, z: 0 });
    let bounced = false;
    for (let i = 0; i < 30; i++) {
      frame(g);
      if (g.mario.vel.y > 20 && g.mario.action === 'jump') bounced = true;
    }
    expect(bounced).toBe(true);
    expect(events(g, 'stomp')).toHaveLength(1);
    expect(g.mario.health).toBe(8);
    expect(g.actors.some((a) => a.type === 'goomba')).toBe(false);
    // the coin it left (or Mario, who picked it up)
    expect(g.actors.some((a) => a.type === 'coin') || g.mario.coins > 0).toBe(true);
  });

  it('hurt Mario when they walk into him', () => {
    const g = scene(newMario({ x: 0, y: 0, z: 0 }));
    g.spawn({ type: 'goomba', x: 0, y: 0, z: 300 });
    frames(g, 60);
    expect(g.mario.health).toBeLessThan(8);
  });
});

describe('Bob-ombs', () => {
  it('explode 120 frames after their fuse is lit', () => {
    const g = scene(newMario({ x: 0, y: 0, z: 0 }));
    g.spawn({ type: 'bobomb', x: 0, y: 0, z: 450 });
    frame(g);
    const b = g.actors.find((a) => a.type === 'bobomb');
    expect(b.state).toBe('lit');
    g.mario.pos.z = -12000;
    let at = -1;
    for (let i = 0; i < 200 && at < 0; i++) {
      frame(g);
      if (events(g, 'explode').length) at = i;
    }
    expect(at).toBeGreaterThan(110);
    expect(at).toBeLessThan(125);
  });

  it('can be picked up and thrown, and explode where they land', () => {
    const g = scene(newMario({ x: 0, y: 0, z: 0 }));
    g.spawn({ type: 'bobomb', x: 0, y: 0, z: 120 });
    frame(g, input({ bp: true, b: true }));
    expect(g.mario.held?.type).toBe('bobomb');
    frames(g, 8);
    frame(g, input({ bp: true, b: true }));
    frames(g, 60);
    expect(g.mario.held).toBeNull();
    const boom = events(g, 'explode')[0];
    expect(boom).toBeDefined();
    expect(boom.z).toBeGreaterThan(400);
  });

  it('a Bob-omb lights only when it sees Mario, and goes to where it last saw him', () => {
    // a wall between x 200 and 400, the length of the field
    const k = createKit();
    k.box({ x: 0, y: -100, z: 0, w: 40000, h: 100, d: 40000, mat: 'g' });
    k.box({ x: 300, y: 0, z: 450, w: 200, h: 400, d: 4000, mat: 'g' });
    const o = k.done();
    const g = newScene({ world: makeWorld(o.tris, o.kinds, { deathY: -3000 }), mario: newMario({ x: 450, y: 0, z: 450 }), save: { stars: {} }, area: {} });
    g.spawn({ type: 'bobomb', x: 0, y: 0, z: 450 });
    const b = g.actors.find((a) => a.type === 'bobomb');
    // near enough, but behind the wall: it walks on, unlit
    frames(g, 30);
    expect(b.state).toBe('walk');
    expect(events(g, 'fuse')).toHaveLength(0);
    // in plain sight: lit
    Object.assign(g.mario.pos, { x: b.pos.x - 300, z: b.pos.z });
    const seenAt = { x: g.mario.pos.x, z: g.mario.pos.z };
    frame(g);
    expect(b.state).toBe('lit');
    frames(g, 4);
    // gone behind the wall: after a moment's intuition (it keeps after the
    // truth for 2.5 s) it heads back for where it last saw him
    Object.assign(g.mario.pos, { x: 450, z: b.pos.z });
    frames(g, 85);
    const d0 = Math.hypot(b.pos.x - seenAt.x, b.pos.z - seenAt.z);
    frames(g, 15);
    expect(b.state).toBe('lit');
    expect(Math.hypot(b.pos.x - seenAt.x, b.pos.z - seenAt.z)).toBeLessThan(d0 - 40);
    expect(b.pos.x).toBeLessThan(200);
  });
});

describe('King Bob-omb', () => {
  const arena = { x: 0, y: 0, z: 0, r: 3000 };
  const behind = (g, king) => {
    g.mario.pos.x = king.pos.x - Math.sin(king.yaw) * 260;
    g.mario.pos.z = king.pos.z - Math.cos(king.yaw) * 260;
    g.mario.pos.y = king.pos.y;
    g.mario.yaw = king.yaw;
  };

  it('is picked up from behind, but not from in front', () => {
    const g = scene(newMario({ x: 0, y: 0, z: 400, yaw: Math.PI }));
    const king = g.spawn({ type: 'king', x: 0, y: 0, z: 0, yaw: 0, arena, star: 0 });
    king.state = 'walk';
    frame(g, input({ bp: true, b: true }));
    expect(g.mario.held).toBeNull();
    const g2 = scene();
    const k2 = g2.spawn({ type: 'king', x: 0, y: 0, z: 0, yaw: 0, arena, star: 0 });
    k2.state = 'walk';
    frame(g2);
    behind(g2, k2);
    frame(g2, input({ bp: true, b: true }));
    expect(g2.mario.held).toBe(k2);
  });

  it('gives up his star after three throws onto the summit', () => {
    const g = scene();
    const king = g.spawn({ type: 'king', x: 0, y: 0, z: 0, yaw: 0, arena, star: 0 });
    king.state = 'walk';
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < 200 && !['walk', 'wait'].includes(king.state); i++) frame(g);
      king.yaw = 0;
      behind(g, king);
      g.mario.invuln = 0;
      g.mario.action = 'idle';
      frame(g, input({ bp: true, b: true }));
      expect(g.mario.held).toBe(king);
      frames(g, 8);
      frame(g, input({ bp: true, b: true }));
      frames(g, 50);
    }
    frames(g, 120);
    expect(events(g, 'hit')).toHaveLength(3);
    const star = g.actors.find((a) => a.type === 'star');
    expect(star?.index).toBe(0);
  });
});

describe('the Chain Chomp', () => {
  it('breaks free after three pounds on its post, smashing the gate to its star', () => {
    const g = scene(newMario({ x: 0, y: 600, z: 0 }));
    g.spawn({ type: 'post', id: 'post', x: 0, y: 0, z: 0 });
    g.spawn({ type: 'chomp', post: 'post', gate: 'gate', x: 600, y: 0, z: 0 });
    g.spawn({ type: 'gate', id: 'gate', x: 3000, y: 0, z: 0, star: 2 });
    expect(g.actors.find((a) => a.type === 'star')?.index).toBe(2);
    for (let i = 0; i < 3; i++) {
      g.mario.pos = { x: 0, y: 600, z: 0 };
      g.mario.action = 'freefall';
      g.mario.airborne = true;
      g.mario.vel = { x: 0, y: 0, z: 0 };
      g.mario.fwd = 0;
      g.mario.invuln = 999;
      frame(g);
      frame(g, input({ z: true, zp: true }));
      for (let j = 0; j < 60 && g.mario.action !== 'poundland'; j++) frame(g);
      frames(g, 4);
    }
    const chomp = g.actors.find((a) => a.type === 'chomp');
    expect(chomp.state).toBe('free');
    frames(g, 300);
    expect(g.actors.some((a) => a.type === 'gate')).toBe(false);
    expect(events(g, 'smash')).toHaveLength(1);
  });

  it('only hurts when it bites: resting, it just pushes Mario off', () => {
    const g = scene(newMario({ x: 0, y: 0, z: 0 }));
    g.spawn({ type: 'post', id: 'post', x: 0, y: 0, z: -700 });
    const c = g.spawn({ type: 'chomp', post: 'post', gate: 'gate', x: 0, y: 0, z: 100 });
    c.state = 'idle';
    c.next = 999;
    frames(g, 5);
    expect(g.mario.health).toBe(8);
    expect(Math.hypot(g.mario.pos.x - c.pos.x, g.mario.pos.z - c.pos.z)).toBeGreaterThan(150);
  });

  it('lunges at Mario near its post, and hurts', () => {
    const g = scene(newMario({ x: 0, y: 0, z: 700 }));
    g.spawn({ type: 'post', id: 'post', x: 0, y: 0, z: 0 });
    g.spawn({ type: 'chomp', post: 'post', gate: 'gate', x: 0, y: 0, z: -300 });
    frames(g, 150);
    expect(g.mario.health).toBeLessThan(8);
  });
});

describe('iron balls', () => {
  it('roll along their path and hurt on touch', () => {
    const g = scene(newMario({ x: 0, y: 0, z: 2000 }));
    g.spawn({ type: 'ballspawner', path: [[0, 0, 0], [0, 0, 4000]], every: 180 });
    frames(g, 3);
    const ball = g.actors.find((a) => a.type === 'ironball');
    expect(ball).toBeDefined();
    const z0 = ball.pos.z;
    frames(g, 20);
    expect(ball.pos.z).toBeGreaterThan(z0 + 200);
    frames(g, 120);
    expect(g.mario.health).toBeLessThan(8);
  });
});

describe('Bob-ombs’ eyes', () => {
  const walled = () => {
    const k = createKit();
    k.box({ x: 0, y: -100, z: 0, w: 40000, h: 100, d: 40000, mat: 'g' });
    k.box({ x: 0, y: 0, z: 0, w: 60, h: 600, d: 3000, mat: 'g' });
    const o = k.done();
    return makeWorld(o.tris, o.kinds, { deathY: -3000 });
  };
  it('light their fuse only for a Mario they can see: not through a wall', () => {
    const g = newScene({ world: walled(), mario: newMario({ x: -200, y: 0, z: 0 }), save: { stars: {} }, area: {} });
    const b = g.spawn({ type: 'bobomb', x: 200, y: 0, z: 0, yaw: Math.PI / 2 });
    frames(g, 30);
    expect(b.state).toBe('walk');
    expect(events(g, 'fuse')).toHaveLength(0);
    // in the open, at the same distance, at once
    const open = scene(newMario({ x: -200, y: 0, z: 0 }));
    const c = open.spawn({ type: 'bobomb', x: 200, y: 0, z: 0 });
    frame(open);
    expect(c.state).toBe('lit');
  });
});

describe('the Chain Chomp’s tell', () => {
  it('rears back over its last moments before a bite at a Mario who is near, and bites when it always did', () => {
    const g = scene(newMario({ x: 0, y: 0, z: 700 }));
    g.spawn({ type: 'post', id: 'post', x: 0, y: 0, z: 0 });
    const c = g.spawn({ type: 'chomp', post: 'post', gate: 'gate', x: 0, y: 0, z: -300 });
    g.mario.invuln = 999;
    const tells = [];
    let went = -1;
    for (let i = 0; i < 80 && went < 0; i++) {
      frame(g);
      tells.push(c.tell);
      if (c.state === 'lunge') went = i;
    }
    expect(went).toBe(59); // (its 60-frame wait, as before)
    // wound up over a dozen frames, rising, just before it went
    const wound = tells.filter((v) => v > 0);
    expect(wound.length).toBeGreaterThanOrEqual(10);
    expect(tells.slice(0, 40).every((v) => v === 0)).toBe(true);
    for (let i = 1; i < wound.length; i++) expect(wound[i]).toBeGreaterThan(wound[i - 1]);
    // far off, it doesn't wind up at all
    const far = scene(newMario({ x: 0, y: 0, z: 9000 }));
    far.spawn({ type: 'post', id: 'post', x: 0, y: 0, z: 0 });
    const d = far.spawn({ type: 'chomp', post: 'post', gate: 'gate', x: 0, y: 0, z: -300 });
    for (let i = 0; i < 100; i++) {
      frame(far);
      expect(d.tell).toBe(0);
    }
  });
});

describe('Goombas’ eyes', () => {
  // a floor with a wall across it: Mario on one side, a Goomba on the other
  const walled = () => {
    const k = createKit();
    k.box({ x: 0, y: -100, z: 0, w: 40000, h: 100, d: 40000, mat: 'g' });
    k.box({ x: 0, y: 0, z: 0, w: 60, h: 600, d: 3000, mat: 'g' });
    const o = k.done();
    return makeWorld(o.tris, o.kinds, { deathY: -3000 });
  };
  it('chase only what they can see: not Mario behind a wall', () => {
    const g = newScene({ world: walled(), mario: newMario({ x: -250, y: 0, z: 0 }), save: { stars: {} }, area: {} });
    const a = g.spawn({ type: 'goomba', x: 250, y: 0, z: 0 });
    frames(g, 90);
    expect(a.state).toBe('wander');
    expect(a.pos.x).toBeGreaterThan(40);
    // and in the open, they do
    const open = scene(newMario({ x: -250, y: 0, z: 0 }));
    const b = open.spawn({ type: 'goomba', x: 250, y: 0, z: 0 });
    frames(open, 90);
    expect(b.state).toBe('chase');
  });

  it('keep after Mario a moment once he is round the wall, go to look where he was, then wander', () => {
    const g = newScene({ world: walled(), mario: newMario({ x: 300, y: 0, z: -100 }), save: { stars: {} }, area: {} });
    const a = g.spawn({ type: 'goomba', x: 400, y: 0, z: 400 });
    frames(g, 30);
    expect(a.state).toBe('chase');
    // Mario steps round the wall's end, out of sight
    g.mario.pos.x = -300;
    g.mario.pos.z = -1700;
    const states = [];
    let nearest = Infinity;
    for (let i = 0; i < 240; i++) {
      frame(g);
      states.push(a.state);
      nearest = Math.min(nearest, Math.hypot(a.pos.x - 300, a.pos.z + 100));
      expect(a.pos.x).toBeGreaterThan(30); // (never through the wall)
    }
    // still chasing for a while (intuition), then on to where it last had him, then wandering
    expect(states.slice(0, 60).every((s) => s === 'chase')).toBe(true);
    expect(states[states.length - 1]).toBe('wander');
    expect(nearest).toBeLessThan(200);
  });
});
