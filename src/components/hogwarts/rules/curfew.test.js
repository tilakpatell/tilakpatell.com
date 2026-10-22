import { describe, expect, it } from 'vitest';
import { FINE, NOTICE, SIGHT, afterHours, filchAt, newCurfew, sees, step, watchers } from './curfew';
import { everyone } from './people';
import { spotById } from './paths';

const filch = (x = 0, z = 0, dx = 0, dz = 1, inside = 'library') => ({ id: 'filch', x, z, dx, dz, inside, moving: true });
const norris = (x = 0, z = 0, dx = 0, dz = 1, inside = 'library') => ({ id: 'norris', x, z, dx, dz, inside, moving: true });
const me = (x, z, more = {}) => ({ x, z, inside: 'library', cloak: false, lit: false, running: false, ...more });

// a run of steps at night, the figures as given (a list, or a function of the time)
function night(player, figures, seconds, { state = newCurfew(), dt = 1 / 20, hour = 23 } = {}) {
  const all = [];
  let s = state;
  for (let t = 0; t < seconds; t += dt) {
    const p = typeof player === 'function' ? player(t, s) : player;
    const f = typeof figures === 'function' ? figures(t, s) : figures;
    const r = step(s, { hour, dt, player: p, figures: f, house: 'ravenclaw' });
    s = r.state;
    for (const e of r.events) all.push({ ...e, t });
  }
  return { state: s, events: all };
}

describe('curfew', () => {
  it('starts at nine and ends at dawn', () => {
    expect(afterHours(20.9)).toBe(false);
    expect(afterHours(21)).toBe(true);
    expect(afterHours(2.5)).toBe(true);
    expect(afterHours(6)).toBe(false);
    expect(afterHours(24 * 3 + 22)).toBe(true);
  });

  it('knows who watches: Filch, his cat, the prefects on their round and Snape on his', () => {
    const w = watchers([filch(), norris(), { id: 'percy', round: 'prefects', x: 0, z: 0, inside: 'staircase' }, { id: 'snape', round: 'snape', x: 0, z: 0 }, { id: 'snape2', x: 0, z: 0 }, { id: 'harry', x: 0, z: 0 }, { id: 'filch', rest: true, x: 0, z: 0 }]);
    expect(w.map((x) => x.kind)).toEqual(['filch', 'cat', 'prefect', 'snape']);
  });

  it('sees you in Filch’s lantern within six metres and not past it, beside it or behind', () => {
    const w = watchers([filch()])[0];
    expect(sees(w, me(0, 4))).toBeGreaterThan(0);
    expect(sees(w, me(0, SIGHT.filch.range + 0.5))).toBe(0);
    expect(sees(w, me(4, 1))).toBe(0);
    expect(sees(w, me(0, -3))).toBe(0);
    // (and never through a wall)
    expect(sees(w, me(0, 4, { inside: 'staircase' }))).toBe(0);
    expect(sees(w, me(0, 4, { inside: null }))).toBe(0);
  });

  it('hides you under the cloak from Filch but not from Mrs Norris, and shows a lit wand under it', () => {
    const [f, n] = watchers([filch(), norris()]);
    expect(sees(f, me(0, 4, { cloak: true }))).toBe(0);
    expect(sees(n, me(0, 8, { cloak: true }))).toBeGreaterThan(0);
    expect(sees(n, me(6, 2, { cloak: true }))).toBeGreaterThan(0); // (a cat looks wide)
    expect(sees(f, me(0, 8, { cloak: true, lit: true }))).toBeGreaterThan(0);
  });

  it('catches you after a moment in sight: a toast, twenty points and a walk back to bed', () => {
    const r = night(me(0, 3), [filch()], 2);
    const caught = r.events.find((e) => e.type === 'caught');
    expect(caught.by).toBe('filch');
    expect(caught.toast).toMatch(/Filch/);
    expect(caught.toast).toMatch(/Ravenclaw/);
    expect(caught.to).toBe('ravenclaw');
    expect(caught.t).toBeGreaterThan(NOTICE * 0.5);
    expect(caught.t).toBeLessThan(NOTICE * 2);
    expect(r.events.find((e) => e.type === 'points')).toEqual(expect.objectContaining({ house: 'ravenclaw', delta: -FINE }));
    expect(r.events.find((e) => e.type === 'noticed').t).toBeLessThan(caught.t);
  });

  it('lets you off a glimpse: a step out of the light and the alarm dies down', () => {
    const r = night((t) => me(t < 0.3 ? 0 : 5, 3), [filch()], 4);
    expect(r.events.some((e) => e.type === 'caught')).toBe(false);
    expect(r.events.some((e) => e.type === 'noticed')).toBe(true);
    expect(r.state.alert).toBe(0);
  });

  it('cares nothing for anyone by day', () => {
    const r = night(me(0, 3), [filch()], 3, { hour: 15 });
    expect(r.events).toEqual([]);
  });

  it('has Peeves give you away under the cloak, Filch hurry to the noise, and walk into you if you stay', () => {
    const peeves = { id: 'peeves', x: 0, z: 0, inside: 'library' };
    const far = filch(-20, 0, 0, 1);
    const stay = night(me(4, 0, { cloak: true }), [far, peeves], 20);
    expect(stay.events.find((e) => e.type === 'peeves').line).toMatch(/[.!?]$/);
    expect(stay.events.some((e) => e.type === 'heard')).toBe(true);
    const caught = stay.events.find((e) => e.type === 'caught');
    expect(caught.by).toBe('bump');
    expect(caught.toast).toMatch(/cloak/);
    // (moved on from where Peeves shouted: Filch finds nothing and goes back)
    const slip = night((t) => me(4, t < 1 ? 0 : 9, { cloak: true }), [far, peeves], 40);
    expect(slip.events.some((e) => e.type === 'caught')).toBe(false);
    expect(slip.state.filch).toBeNull();
  });

  it('hears a run down the corridor', () => {
    const r = night(me(6, -2, { cloak: true, running: true }), [filch(0, 0, 0, 1)], 1);
    expect(r.events.some((e) => e.type === 'heard')).toBe(true);
    expect(filchAt(r.state, filch()).x).toBeGreaterThan(0);
  });

  it('plays a night through: in the Restricted Section without the cloak Filch’s round finds you; under it only the cat can', () => {
    const shelf = spotById('restricted').at;
    const play = (cloak) => {
      let caughtBy = null;
      let s = newCurfew();
      const start = 3 * 24 + 21;
      for (let h = start; h < start + 9 && !caughtBy; h += 1 / 120) {
        const r = step(s, { hour: h, dt: 0.5, player: me(shelf[0] + 1, shelf[1], { cloak }), figures: everyone(h, 4), house: 'gryffindor' });
        s = r.state;
        caughtBy = r.events.find((e) => e.type === 'caught')?.by ?? null;
      }
      return caughtBy;
    };
    expect(['filch', 'cat']).toContain(play(false));
    expect(['cat', null]).toContain(play(true));
  });
});
