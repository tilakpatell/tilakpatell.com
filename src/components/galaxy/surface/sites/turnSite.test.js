import { describe, expect, it } from 'vitest';
import { turnSite } from './turnSite';

describe('a site turned to its game map', () => {
  const raw = {
    land: { at: [0, -40], yaw: 0 },
    ground: { flats: [{ at: [0, 10], r: 4 }], layers: [{ type: 'image', pack: 'k' }] },
    places: [{ id: 'beach', at: [0, 40], things: [{ kind: 'crates', at: [0, 5] }] }],
    life: [{ kind: 'clone', at: [0, 10], face: 0, path: [[0, 1], [1, 0]] }],
    quests: [{ id: 'q', steps: [{ type: 'shoot', at: [0, 62], spawn: [{ kind: 'droid', at: [0, 100] }], spots: [[0, 2]] }] }],
    skyships: [{ kind: 'm', at: [0, 900, 100], yaw: 0 }],
  };
  const t = -Math.PI / 2;
  const q = turnSite(raw, { yaw: t });

  it('turns +z to −x, every position and heading alike', () => {
    expect(q.places[0].at).toEqual([-40, 0]);
    expect(q.places[0].yaw).toBe(t);
    expect(q.land).toEqual({ at: [40, 0], yaw: t });
    expect(q.ground.flats[0].at).toEqual([-10, 0]);
    expect(q.life[0]).toMatchObject({ at: [-10, 0], face: t, path: [[-1, 0], [0, 1]] });
    expect(q.quests[0].steps[0]).toMatchObject({ at: [-62, 0], spawn: [{ at: [-100, 0] }], spots: [[-2, 0]] });
    expect(q.skyships[0].at).toEqual([-100, 900, 0]);
    // (a place's things stay relative to it: its yaw carries them)
    expect(q.places[0].things).toEqual(raw.places[0].things);
  });

  it('moves after it turns', () => {
    const m = turnSite(raw, { yaw: t, by: [88, 0] });
    expect(m.land.at).toEqual([128, 0]);
    expect(m.skyships[0].at).toEqual([-12, 900, 0]);
  });

  it('leaves a site alone for no turn, and keeps out what it leaves out', () => {
    expect(turnSite(raw, undefined)).toBe(raw);
    expect(turnSite(raw, { yaw: 0, by: [0, 0] })).toBe(raw);
    expect('rides' in q).toBe(false);
  });
});
