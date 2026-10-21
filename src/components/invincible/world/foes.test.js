import { describe, expect, it } from 'vitest';
import { FIGHT, KINDS, PORTAL, foeAt, knock, newFoes, pickTarget, portalOpen, spawnFoes, spawnUpTo, startInvasion, stepFoes } from './foes';
import { groundAt } from './map';

const hero = (p, v = [0, 0, 0]) => ({ p: [...p], v: [...v], mode: 'air' });
const idle = { punch: false, look: [0, 0, -1] };
function run(f, h, t, input = idle, dt = 1 / 30, world = {}) {
  const ev = [];
  let push = null;
  for (let s = 0; s < t; s += dt) {
    const r = stepFoes(f, typeof h === 'function' ? h(s, f) : h, typeof input === 'function' ? input(s, f) : input, dt, world);
    f = r.foes;
    ev.push(...r.ev);
    push = r.push ?? push;
  }
  return { f, ev, push };
}
const far = hero([-2000, 30, 0]);

describe('the invasion', () => {
  it('waits until something starts it', () => {
    const { f, ev } = run(newFoes(), far, 5);
    expect(f.on).toBe(false);
    expect(ev).toEqual([]);
  });
  it('opens the portal, and the Flaxans come through it a few at a time', () => {
    let f = startInvasion(newFoes());
    expect(f.on).toBe(true);
    ({ f } = run(f, far, 4));
    const out = f.foes.filter((e) => e.state !== 'waiting');
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThan(FIGHT.count);
    for (const e of out) expect(Math.hypot(e.p[0] - PORTAL.p[0], e.p[2] - PORTAL.p[2])).toBeLessThan(400);
  });
  it('sends them at him, and their bolts hurt', () => {
    let f = startInvasion(newFoes());
    ({ f } = run(f, far, 8));
    // hang about in the middle of them
    const near = hero([PORTAL.p[0], PORTAL.p[1] - 20, PORTAL.p[2] + 60]);
    const { ev } = run(f, near, 12);
    expect(ev.some((e) => e.type === 'bolt')).toBe(true);
    expect(ev.some((e) => e.type === 'hurt')).toBe(true);
  });
});

describe('fighting back', () => {
  // one Flaxan right in front of him
  const oneUp = () => {
    const f = startInvasion(newFoes());
    const e = { ...f.foes[0], state: 'fight', p: [0, 100, -3], v: [0, 0, 0], hp: FIGHT.hp, cool: 99 };
    return { ...f, foes: [e, ...f.foes.slice(1).map((q) => ({ ...q, state: 'down' }))], spawned: FIGHT.count };
  };
  it('a punch knocks one out of the sky', () => {
    const { f, ev } = run(oneUp(), hero([0, 99, 0]), 1, (s) => ({ punch: s < 0.04, look: [0, 0, -1] }));
    expect(ev.some((e) => e.type === 'punch')).toBe(true);
    expect(ev.some((e) => e.type === 'ko')).toBe(true);
    expect(f.foes[0].state).toBe('ko');
  });
  it('a punch thrown from a little way off lunges him at it', () => {
    const f = oneUp();
    f.foes[0].p = [0, 100, -14];
    const { push } = run(f, hero([0, 99, 0]), 0.05, { punch: true, look: [0, 0, -1] });
    expect(push).toBeTruthy();
    expect(push[2]).toBeLessThan(-20);
  });
  it('flying into one fast knocks it out too', () => {
    const { ev } = run(oneUp(), hero([0, 99, -2.5], [0, 0, -90]), 0.2);
    expect(ev.some((e) => e.type === 'ko' && e.rammed)).toBe(true);
  });
  it('closes the portal when they’re all down', () => {
    let f = oneUp();
    const { ev, f: after } = run(f, hero([0, 99, 0]), 3, (s) => ({ punch: s < 0.04, look: [0, 0, -1] }));
    f = after;
    expect(ev.some((e) => e.type === 'won')).toBe(true);
    expect(f.on).toBe(false);
  });
});

describe('fast, or in big steps', () => {
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const finite = (f) => {
    for (const e of f.foes) for (const c of [...e.p, ...e.v]) expect(Number.isFinite(c)).toBe(true);
    for (const b of f.bolts) for (const c of b.p) expect(Number.isFinite(c)).toBe(true);
    expect(Number.isFinite(f.t) && Number.isFinite(f.hp) && Number.isFinite(f.cool)).toBe(true);
  };
  // a dozen out and about, round him and firing
  const busy = () => {
    let { f } = run(startInvasion(newFoes()), far, 8);
    ({ f } = run(f, hero([PORTAL.p[0], PORTAL.p[1] - 20, PORTAL.p[2] + 60]), 2));
    return f;
  };
  it('a tab hidden for a minute comes back as one short step: no Flaxan jumps, nothing NaNs', () => {
    const f = busy();
    expect(f.foes.some((e) => e.state === 'fight')).toBe(true);
    const { foes: after } = stepFoes(f, hero([PORTAL.p[0], PORTAL.p[1] - 20, PORTAL.p[2] + 60]), idle, 60);
    expect(after.t - f.t).toBeLessThanOrEqual(0.05 + 1e-9);
    after.foes.forEach((e, i) => {
      if (f.foes[i].state === 'fight' && e.state === 'fight') expect(dist(e.p, f.foes[i].p)).toBeLessThanOrEqual(FIGHT.speed * 0.05 + 1e-9);
    });
    finite(after);
  });
  it('a step of nothing, or of NaN, moves nothing and leaves everything a number', () => {
    const f = busy();
    for (const dt of [NaN, -1, 0, undefined]) {
      const { foes: after } = stepFoes(f, hero([PORTAL.p[0], PORTAL.p[1] - 20, PORTAL.p[2] + 60]), idle, dt);
      expect(after.t).toBe(f.t);
      after.foes.forEach((e, i) => expect(e.p).toEqual(f.foes[i].p));
      finite(after);
    }
  });
  it('flying into one fast knocks it out, even when a frame carries him right past it', () => {
    // 260 m/s at 20 frames a second: 13 m a frame, never within reach of it on a frame
    const f = startInvasion(newFoes());
    const e = { ...f.foes[0], state: 'fight', p: [0, 100, -3], v: [0, 0, 0], cool: 99 };
    const one = { ...f, foes: [e, ...f.foes.slice(1).map((q) => ({ ...q, state: 'down' }))], spawned: FIGHT.count };
    const { ev } = stepFoes(one, hero([0, 99, -9.5], [0, 0, -260]), idle, 0.05);
    expect(ev.some((x) => x.type === 'ko' && x.rammed)).toBe(true);
  });
});

describe('Eve in the fight', () => {
  it('knocks out the Flaxan she names (input.eveHit, its id), the ko said to be hers', () => {
    let { f } = run(startInvasion(newFoes()), far, 6);
    const target = f.foes.find((e) => e.state === 'fight');
    expect(target).toBeTruthy();
    const r = stepFoes(f, far, { ...idle, eveHit: target.id }, 1 / 30);
    expect(r.foes.foes.find((e) => e.id === target.id).state).toBe('ko');
    expect(r.ev).toContainEqual(expect.objectContaining({ type: 'ko', id: target.id, by: 'eve' }));
  });
  it('does nothing for a Flaxan already down, or one that isn’t there', () => {
    let { f } = run(startInvasion(newFoes()), far, 6);
    const r = stepFoes(f, far, { ...idle, eveHit: 'nobody' }, 1 / 30);
    expect(r.ev.filter((e) => e.type === 'ko')).toEqual([]);
  });
});


describe('the villains', () => {
  // somewhere on the street downtown
  const AT = [0, 0, 60];
  const G = groundAt(AT[0], AT[2]);
  const onGround = (dx, dz, up = 0) => ({ p: [AT[0] + dx, G + up, AT[2] + dz], v: [0, 0, 0], mode: up ? 'air' : 'ground' });
  // one of `kind`, the only one, with these over what it starts with
  const only = (kind, extra = {}, at = AT) => {
    const f = spawnFoes(newFoes(), kind, 1, at);
    return { ...f, foes: [{ ...f.foes[0], ...extra }] };
  };
  const punchAt = (look) => (s) => ({ punch: s < 0.04, look });

  it('an elite Flaxan takes two blows, and fires three bolts at once', () => {
    let f = only('flaxanElite', { state: 'fight', p: [0, 100, -3], cool: 99 });
    let r = run(f, hero([0, 99, 0]), 0.5, punchAt([0, 0, -1]));
    expect(r.ev.filter((e) => e.type === 'ko')).toEqual([]);
    expect(r.ev.some((e) => e.type === 'hit' && e.kind === 'flaxanElite')).toBe(true);
    r = run({ ...r.f, foes: r.f.foes.map((e) => ({ ...e, p: [0, 100, -3], v: [0, 0, 0] })) }, hero([0, 99, 0]), 0.5, punchAt([0, 0, -1]));
    expect(r.ev.some((e) => e.type === 'ko' && e.kind === 'flaxanElite')).toBe(true);
    // and its volley
    // (they fire when he's near the portal)
    const by = [PORTAL.p[0], PORTAL.p[1] - 20, PORTAL.p[2] + 60];
    f = only('flaxanElite', { state: 'fight', p: [by[0], by[1], by[2] - 40], cool: 0 });
    const b = stepFoes(f, hero(by), idle, 1 / 30);
    expect(b.foes.bolts.length).toBe(3);
    expect(b.foes.bolts.every((x) => x.hurt === 16)).toBe(true);
  });

  it('a Mauler at 2 m swings every 1.4 s, for 18 and a knock of 10 m', () => {
    const f = only('mauler', { cool: 0 });
    const { ev, push } = run(f, onGround(0, 2), 3.3);
    const hurts = ev.filter((e) => e.type === 'hurt');
    expect(hurts.map((e) => e.hp)).toEqual([82, 64, 46]);
    // the knock's speed carries him 10 m before ./flight.js stops him
    const flat = Math.hypot(push[0], push[2]);
    expect(flat).toBeCloseTo(knock(10), 6);
    expect(push[2]).toBeGreaterThan(0); // (away from it)
  });

  it('a Mauler runs at him when he’s on the ground, and stops short', () => {
    const f = only('mauler', { cool: 99 });
    const { f: after } = run(f, onGround(0, 30), 2);
    const e = after.foes[0];
    expect(e.p[2] - AT[2]).toBeGreaterThan(14);
    expect(Math.abs(e.p[1] - groundAt(e.p[0], e.p[2]))).toBeLessThan(1e-6);
    const { f: there } = run(after, onGround(0, 30), 10);
    expect(Math.hypot(there.foes[0].p[0] - AT[0], there.foes[0].p[2] - AT[2] - 30)).toBeGreaterThan(1.5);
  });

  it('a Mauler throws a car at him 30 m off and 10 m up: 35 m/s, 22 when it hits', () => {
    const f = only('mauler', { throwCool: 0 });
    const h = onGround(0, 30, 10);
    const cars = [[AT[0] + 5, G, AT[2] - 3]];
    let r = stepFoes(f, h, idle, 1 / 30, { cars });
    expect(r.ev).toContainEqual(expect.objectContaining({ type: 'throw', car: 0 }));
    // up over his head, then off it goes
    let g = r.foes;
    const ev = [];
    let speed = 0;
    for (let s = 0; s < 3; s += 1 / 30) {
      r = stepFoes(g, h, idle, 1 / 30, { cars });
      g = r.foes;
      ev.push(...r.ev);
      for (const c of g.cars) if (c.held == null) speed = Math.hypot(...c.v);
    }
    expect(speed).toBeCloseTo(KINDS.mauler.car, 6);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'carHit' }));
    expect(ev.find((e) => e.type === 'hurt').hp).toBe(100 - 22);
  });

  it('a car thrown at him can be punched back', () => {
    const f = only('mauler', { throwCool: 0, cool: 99 });
    const h = onGround(0, 30, 10);
    let g = f;
    const ev = [];
    let punched = false;
    for (let s = 0; s < 3; s += 1 / 30) {
      // he punches as it comes within reach
      const near = g.cars.some((c) => c.held == null && Math.hypot(c.p[0] - h.p[0], c.p[1] - h.p[1] - 1, c.p[2] - h.p[2]) < 5.5);
      const r = stepFoes(g, h, { punch: near && !punched, look: [0, 0, -1] }, 1 / 30);
      punched ||= near;
      g = r.foes;
      ev.push(...r.ev);
    }
    expect(ev.some((e) => e.type === 'carAway')).toBe(true);
    expect(ev.some((e) => e.type === 'carHit')).toBe(false);
  });

  it('three punches knock a Mauler out (it staggers at the first two)', () => {
    let f = only('mauler', { cool: 99 });
    const ev = [];
    for (let i = 0; i < 3; i++) {
      const r = run(f, onGround(0, 2), 1, punchAt([0, 0, -1]));
      f = r.f;
      ev.push(...r.ev);
    }
    expect(ev.filter((e) => e.type === 'hit').length).toBe(2);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'ko', kind: 'mauler' }));
  });

  it('flying into a Mauler fast knocks it out', () => {
    const f = only('mauler', { cool: 99 });
    // (a frame that carries him from 4 m short of it to 2 m past)
    const { ev } = stepFoes(f, { p: [AT[0], G + 0.3, AT[2] + 2], v: [0, 0, 120], mode: 'air' }, idle, 0.05);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'ko', kind: 'mauler', rammed: true }));
  });

  it('Doc Seismic quakes every 6 s: a ring at 30 m/s that knocks him over on the ground, and a shake', () => {
    const f = only('seismic', { blast: 99, cool: 0.01 });
    const e = f.foes[0];
    // standing 45 m out from under him
    const under = [e.p[0], e.p[2]];
    const h = { p: [under[0] + 45, groundAt(under[0] + 45, under[1]), under[1]], v: [0, 0, 0], mode: 'ground' };
    const ev = [];
    let g = f;
    let floored = null;
    for (let s = 0; s < 7; s += 1 / 30) {
      const r = stepFoes(g, h, idle, 1 / 30);
      g = r.foes;
      ev.push(...r.ev);
      if (r.ev.some((x) => x.type === 'floored')) {
        floored = s;
        expect(r.stun).toBeGreaterThan(1);
      }
    }
    expect(ev.filter((x) => x.type === 'quake').length).toBe(2); // (at 0 and 6 s)
    expect(ev.some((x) => x.type === 'shake')).toBe(true);
    // 45 m at 30 m/s (he drifts a little meanwhile)
    expect(floored).toBeGreaterThan(1.2);
    expect(floored).toBeLessThan(1.9);
  });

  it('Doc Seismic’s ring passes under him when he’s flying', () => {
    const f = only('seismic', { blast: 99, cool: 0.01 });
    const e = f.foes[0];
    const h = { p: [e.p[0] + 45, groundAt(e.p[0] + 45, e.p[2]) + 10, e.p[2]], v: [0, 0, 0], mode: 'air' };
    const { ev } = run(f, h, 3);
    expect(ev.some((x) => x.type === 'floored')).toBe(false);
  });

  it('Doc Seismic blasts him within 40 m: 14, and a knock of 15 m', () => {
    const f = only('seismic', { blast: 0, cool: 99 });
    const e = f.foes[0];
    const { ev, push } = run(f, hero([e.p[0] + 20, e.p[1], e.p[2]]), 0.1);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'blast' }));
    expect(ev.find((x) => x.type === 'hurt').hp).toBe(86);
    expect(Math.hypot(...push)).toBeCloseTo(knock(15), 6);
  });

  it('five punches knock Doc Seismic out', () => {
    let f = only('seismic', { blast: 99, cool: 99 });
    const ev = [];
    for (let i = 0; i < 5; i++) {
      const e = f.foes[0];
      const r = run(f, hero([e.p[0], e.p[1] - 0.1, e.p[2] + 2]), 1, punchAt([0, 0, -1]));
      f = r.f;
      ev.push(...r.ev);
    }
    expect(ev.filter((x) => x.type === 'hit').length).toBe(4);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'ko', kind: 'seismic' }));
  });

  it('Eve’s blow knocks a Mauler out, and only hits Doc Seismic', () => {
    const m = only('mauler', { cool: 99 });
    expect(stepFoes(m, far, { ...idle, eveHit: 0 }, 1 / 30).ev).toContainEqual(expect.objectContaining({ type: 'ko', kind: 'mauler', by: 'eve' }));
    const s = only('seismic', { blast: 99, cool: 99 });
    const r = stepFoes(s, far, { ...idle, eveHit: 0 }, 1 / 30);
    expect(r.ev).toContainEqual(expect.objectContaining({ type: 'hit', kind: 'seismic', by: 'eve' }));
  });

  it('says the portal’s open while Flaxans are to come or fighting, and where the ones standing are', () => {
    const f = startInvasion(newFoes());
    expect(portalOpen(f)).toBe(true);
    expect(portalOpen(newFoes())).toBe(false);
    expect(portalOpen(only('mauler'))).toBe(false);
    expect(foeAt(f)).toEqual([]); // (all still waiting)
    const m = only('mauler');
    expect(foeAt(m)).toEqual([[m.foes[0].p[0], m.foes[0].p[1] + 1.3, m.foes[0].p[2]]]);
  });

  it('ends when they’re all down, Maulers too (no portal to close), and the last one falls after', () => {
    const f = only('mauler', { cool: 99 });
    const r = run(f, onGround(0, 2), 0.5, punchAt([0, 0, -1]));
    let g = { ...r.f, foes: r.f.foes.map((e) => ({ ...e, hits: 2, state: 'approach' })) };
    const r2 = run(g, onGround(0, 2), 0.1, punchAt([0, 0, -1]));
    expect(r2.ev.some((e) => e.type === 'clear')).toBe(true);
    expect(r2.ev.some((e) => e.type === 'won')).toBe(false);
    g = r2.f;
    expect(g.on).toBe(false);
    const y = g.foes[0].p[1];
    const { f: later, ev } = run(g, onGround(0, 2), 4);
    expect(later.foes[0].state).toBe('down');
    expect(ev.some((e) => e.type === 'down')).toBe(true);
    expect(later.foes[0].p[1]).toBeLessThanOrEqual(y + 5);
  });
  // ── a Mauler with something to wreck (the hangar, episode 6) ──
  it('a Mauler goes for the hangar when Mark is over 60 m away or over 30 m up, and for him otherwise', () => {
    const e = only('mauler').foes[0];
    const hangar = [AT[0] + 40, G, AT[2]];
    expect(pickTarget(e, onGround(0, 61), hangar)).toBe('hangar');
    expect(pickTarget(e, onGround(0, 10, 31), hangar)).toBe('hangar');
    expect(pickTarget(e, onGround(0, 59), hangar)).toBe('mark');
    expect(pickTarget(e, onGround(0, 10, 29), hangar)).toBe('mark');
    expect(pickTarget(e, onGround(0, 200), null)).toBe('mark'); // (nothing to wreck: him)
  });
  it('left alone, a Mauler runs to the hangar and swings at it every 1.4 s', () => {
    const hangar = [AT[0] + 30, G, AT[2]];
    const { ev, f } = run(only('mauler', { cool: 0 }), far, 10, idle, 1 / 30, { hangar });
    const e = f.foes[0];
    expect(Math.hypot(e.p[0] - hangar[0], e.p[2] - hangar[2])).toBeLessThan(KINDS.mauler.reach + 0.5);
    const swings = ev.filter((q) => q.type === 'swing' && q.on === 'hangar');
    expect(swings.length).toBeGreaterThanOrEqual(3);
    expect(ev.some((q) => q.type === 'hurt')).toBe(false);
  });
  it('spawns up to a total, counting the ones already beaten', () => {
    let f = spawnFoes(newFoes(), 'mauler', 2, AT);
    f = { ...f, foes: f.foes.map((e, i) => (i === 0 ? { ...e, state: 'down' } : e)) };
    f = spawnUpTo(f, 'mauler', 6, AT);
    expect(f.foes.filter((e) => e.kind === 'mauler')).toHaveLength(6);
    expect(spawnUpTo(f, 'mauler', 6, AT).foes).toHaveLength(6);
    expect(spawnUpTo(f, 'mauler', 3, AT)).toBe(f);
  });
});

const STREET = [50, 0, 0];
const onStreet = (dz = 0) => ({ p: [STREET[0], groundAt(STREET[0], STREET[2] + dz), STREET[2] + dz], v: [0, 0, 0], mode: 'ground' });

describe('a block', () => {
  it('halves a Mauler’s swing, knocks nobody back, staggers the Mauler and opens a counter', () => {
    const f = spawnFoes(newFoes(), 'mauler', 1, [STREET[0], 0, STREET[2] - 2]);
    const h = onStreet();
    const blocked = run(f, h, 3, { punch: false, look: [0, 0, -1], block: true }, 0.05);
    const swing = blocked.ev.find((e) => e.type === 'swing' && e.hit);
    expect(swing).toBeTruthy();
    expect(blocked.ev.some((e) => e.type === 'blocked')).toBe(true);
    const hurt = blocked.ev.find((e) => e.type === 'hurt');
    expect(FIGHT.hp - hurt.hp).toBeCloseTo(KINDS.mauler.swing * FIGHT.blockHalf);
    const open = run(f, h, 3, { punch: false, look: [0, 0, -1], block: false }, 0.05);
    const hurtOpen = open.ev.find((e) => e.type === 'hurt');
    expect(FIGHT.hp - hurtOpen.hp).toBeCloseTo(KINDS.mauler.swing);
  });
  it('the punch inside the window lands twice', () => {
    const f = spawnFoes(newFoes(), 'mauler', 1, [STREET[0], 0, STREET[2] - 2]);
    const h = onStreet();
    let seen = false;
    const r = run(f, h, 4, (s, st) => {
      const swung = st.counter > 0 && !seen;
      if (swung) seen = true;
      return { punch: swung, look: [0, 0, -1], block: !swung };
    }, 0.05);
    const hits = r.ev.filter((e) => e.type === 'hit' && e.punched);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits.some((e) => e.counter)).toBe(true);
  });
});

describe('Omni-Man (episode 8)', () => {
  const sky = (p) => ({ p: [...p], v: [0, 0, 0], mode: 'air' });
  it('circles him, charges every few seconds, hurts him and drives him off along the charge, and is never knocked out', () => {
    const f = spawnFoes(newFoes(), 'omniman', 1, [50, 60, 0]);
    expect(f.foes[0].state).toBe('circle');
    const h = sky([50, 60, 0]);
    const { f: f2, ev } = run(f, h, 8, { punch: false, look: [0, 0, -1] }, 0.05);
    const driven = ev.filter((e) => e.type === 'driven');
    expect(driven.length).toBeGreaterThanOrEqual(1);
    const hurt = ev.find((e) => e.type === 'hurt' && e.by === 'omniman');
    expect(FIGHT.hp - hurt.hp).toBeCloseTo(KINDS.omniman.hurt);
    // a blow on him is a hit, never a knock-out
    const punched = run(f2, { ...h, p: [...f2.foes[0].p] }, 1, (s) => ({ punch: s < 0.05, look: [0, 0, -1], fists: 2 }), 0.05);
    expect(punched.ev.some((e) => e.type === 'hit' && e.kind === 'omniman')).toBe(true);
    expect(punched.ev.some((e) => e.type === 'ko')).toBe(false);
    expect(punched.f.foes[0].state).toBe('stagger');
  });
});

describe('the Guardians’ blows (./guardians.js)', () => {
  const near = hero([50, 1, 4]);
  it('Dupli-Kate’s hold keeps a Mauler still two seconds, then it comes on again', () => {
    const f = spawnFoes(newFoes(), 'mauler', 1, [50, 0, 0]);
    const id = f.foes[0].id;
    const held = run(f, near, 0.1, (s) => ({ ...idle, cavalry: s === 0 ? [{ type: 'gHold', who: 'kate', foe: id, for: 2 }] : [] }));
    expect(held.f.foes[0].state).toBe('stagger');
    expect(held.f.foes[0].heldBy).toBe('kate');
    expect(held.ev.some((e) => e.type === 'held' && e.by === 'kate')).toBe(true);
    const later = run(held.f, near, 1.5);
    expect(later.f.foes[0].state).toBe('stagger');
    const after = run(later.f, near, 1);
    expect(after.f.foes[0].state).not.toBe('stagger');
    expect(after.f.foes[0].heldBy).toBeNull();
  });
  it('a held Flaxan hangs there and fights again after', () => {
    let f = startInvasion(spawnFoes(newFoes(), 'flaxan', 1));
    f = run(f, hero([PORTAL.p[0] - 30, PORTAL.p[1], PORTAL.p[2]]), 2).f;
    const e = f.foes[0];
    expect(e.state).toBe('fight');
    const held = run(f, far, 0.1, (s) => ({ ...idle, cavalry: s === 0 ? [{ type: 'gHold', who: 'kate', foe: e.id, for: 2 }] : [] }));
    expect(held.f.foes[0].state).toBe('stagger');
    expect(run(held.f, far, 2.5).f.foes[0].state).toBe('fight');
  });
  it('Rex’s blast is a blow on everyone standing within its reach', () => {
    const f = spawnFoes(newFoes(), 'mauler', 2, [50, 0, 0]);
    const r = run(f, far, 0.1, (s) => ({ ...idle, cavalry: s === 0 ? [{ type: 'gBlast', who: 'rex', foe: f.foes[0].id, at: [50, 0, 0], r: 10, hits: 1 }] : [] }));
    const hits = r.ev.filter((e) => e.type === 'hit' && e.by === 'rex');
    expect(hits).toHaveLength(2);
    expect(hits.every((e) => e.blast)).toBe(true);
  });
  it('a blow of three is three of a foe’s hits: a Mauler goes down to one', () => {
    const f = spawnFoes(newFoes(), 'mauler', 1, [50, 0, 0]);
    const r = run(f, far, 0.1, (s) => ({ ...idle, cavalry: s === 0 ? [{ type: 'gHit', who: 'monster', foe: f.foes[0].id, hits: 3 }] : [] }));
    expect(r.ev.some((e) => e.type === 'ko' && e.by === 'monster')).toBe(true);
  });
});

describe('season two’s foes (./season2.js)', () => {
  it('Angstrom hangs before Mark and throws green bolts; hit, he portals away and is back behind him', () => {
    const h = hero([0, 1, 0]);
    const f = spawnFoes(newFoes(), 'angstrom', 1, [0, 0, 10]);
    const look = [0, 0, 1];
    const r = run(f, h, 4, { ...idle, look });
    const e = r.f.foes[0];
    expect(e.state).toBe('hover');
    expect(Math.hypot(e.p[0] - 0, e.p[2] - 0)).toBeLessThan(KINDS.angstrom.off + 1);
    expect(r.ev.some((q) => q.type === 'bolt')).toBe(true);
    expect(r.f.bolts.every((b) => b.green)).toBe(true);
    // a punch (in reach, 3 m before him): staggered, then away, then back 8 m behind him (he looks along +z: behind is -z)
    e.p = [0, 1, 3];
    const hit = run(r.f, h, 0.1, (s) => ({ ...idle, look, punch: s === 0 }));
    expect(hit.ev.some((q) => q.type === 'hit' && q.kind === 'angstrom')).toBe(true);
    const back = run(hit.f, h, 2, { ...idle, look });
    expect(back.ev.some((q) => q.type === 'portalOut')).toBe(true);
    expect(back.ev.some((q) => q.type === 'portalIn')).toBe(true);
    const b = back.f.foes[0];
    expect(b.state).toBe('hover');
    expect(b.p[2]).toBeLessThan(0);
  });
  it('six blows put Angstrom down', () => {
    const h = hero([0, 1, 0]);
    let f = spawnFoes(newFoes(), 'angstrom', 1, [0, 0, 5]);
    const kos = [];
    for (let i = 0; i < 6; i++) {
      const e = f.foes[0];
      e.state = 'hover';
      e.p = [0, 1, 3];
      const r = run(f, h, 0.5, (s) => ({ ...idle, look: [0, 0, 1], punch: s === 0 })); // (half a second: past the punch's cooldown)
      f = r.f;
      kos.push(...r.ev.filter((q) => q.type === 'ko'));
    }
    expect(kos).toHaveLength(1);
    expect(kos[0].kind).toBe('angstrom');
  });
  it('the mirror Mark flies at him and punches within reach', () => {
    const h = hero([0, 1, 0]);
    const f = spawnFoes(newFoes(), 'mirror', 1, [0, 0, 40]);
    const r = run(f, h, 6);
    expect(r.ev.some((q) => q.type === 'hurt' && q.by === 'mirror')).toBe(true);
    expect(r.f.hp).toBeLessThan(FIGHT.hp);
    expect(KINDS.mirror.hits).toBe(4);
  });
});
