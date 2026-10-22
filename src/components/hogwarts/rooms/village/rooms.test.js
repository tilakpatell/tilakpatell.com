import { describe, expect, it } from 'vitest';
import honeydukes from '../honeydukes';
import broomsticks from '../broomsticks';
import hogshead from '../hogshead';
import shack from '../shack';
import tunnel from '../tunnel';
import { SHACK_ROOM, tunnelFoot } from './plan';

const NEAR = 2.2; // rooms/host.js’s: a door’s prompt reaches this far past its own radius
const WALK = 0.3; // the walk’s own radius (rules/walk.js)
const ROOMS = { honeydukes, broomsticks, hogshead, shack, tunnel };

const inside = (b, [x, z], pad = 0) => x >= b.x0 - pad && x <= b.x1 + pad && z >= b.z0 - pad && z <= b.z1 + pad;
const clearOf = (colliders, [x, z]) => colliders.every((c) => Math.hypot(x - c.at[0], z - c.at[1]) >= c.r + WALK - 0.05);

describe('Hogsmeade’s insides', () => {
  const built = Object.fromEntries(Object.entries(ROOMS).map(([id, mod]) => [id, mod.build(null, { tier: 'low', props: { hour: 20, found: {} } })]));

  it('each come in where you can stand, with a way out and a view to check them by', () => {
    for (const [id, r] of Object.entries(built)) {
      expect(r.id, id).toBe(id);
      const at = [r.spawn.at[0], r.spawn.at[2]];
      expect(inside(r.bounds, at), `${id} spawn in bounds`).toBe(true);
      expect(clearOf(r.colliders, at), `${id} spawn clear`).toBe(true);
      expect(r.out?.to, `${id} out`).toBeTruthy();
      expect(Object.keys(r.poses).length, `${id} poses`).toBeGreaterThan(0);
      expect(r.doors.length, `${id} doors`).toBeGreaterThan(0);
    }
  });

  it('let you reach every thing in them, none of them under a door’s own prompt', () => {
    for (const [id, r] of Object.entries(built)) {
      for (const s of r.spots ?? []) {
        expect(inside(r.bounds, s.at), `${id}/${s.id} in bounds`).toBe(true);
        expect(s.verb && s.label, `${id}/${s.id} words`).toBeTruthy();
        for (const d of r.doors) expect(Math.hypot(s.at[0] - d.at[0], s.at[1] - d.at[1]), `${id}/${s.id} beside ${d.id}`).toBeGreaterThan((d.r ?? 1.5) + NEAR);
      }
    }
  });

  it('send each shop’s door out into the street, and the passage and the Shack to each other', () => {
    for (const id of ['honeydukes', 'broomsticks', 'hogshead']) {
      const out = built[id].doors.find((d) => d.to === 'hogsmeade');
      expect(out.toAt).toEqual(built[id].out.at);
      expect(Number.isFinite(out.toYaw)).toBe(true);
    }
    const up = built.tunnel.doors.find((d) => d.to === 'shack');
    expect(up.toAt).toEqual(SHACK_ROOM.up.at);
    expect(inside(built.shack.bounds, up.toAt)).toBe(true);
    const down = built.shack.doors.find((d) => d.to === 'tunnel');
    expect(down.toAt).toEqual(tunnelFoot().at);
    expect(clearOf(built.tunnel.colliders, down.toAt)).toBe(true);
    expect(built.tunnel.doors.find((d) => d.id === 'willow').to).toBe('out');
  });

  it('take the sweets once each, and give the frog’s card', () => {
    const told = [];
    const said = [];
    const r = honeydukes.build(null, { tier: 'low', props: { found: { sweets: ['quill'] } }, tell: (type, data) => told.push([type, data]), say: (t) => said.push(t) });
    expect(r.spots.map((s) => s.id)).toEqual(['frog', 'beans', 'trapdoor']);
    r.use('frog');
    r.use('frog');
    r.use('beans');
    r.use('quill');
    expect(told).toEqual([
      ['sweet', { id: 'frog' }],
      ['pickup', { id: 'card', card: 'merlin' }],
      ['sweet', { id: 'beans' }],
    ]);
    expect(said).toHaveLength(2);
    expect(r.spots.map((s) => s.id)).toEqual(['trapdoor']);
  });

  it('pour a butterbeer that counts once, and open the Shack’s door with Alohomora', () => {
    const told = [];
    const bar = broomsticks.build(null, { tier: 'low', props: { hour: 12 }, tell: (type) => told.push(type), say: () => {} });
    bar.use('bar');
    bar.use('bar');
    expect(told).toEqual(['butterbeer']);
    const s = shack.build(null, { tier: 'low', props: {}, say: () => {} });
    expect(s.doors.map((d) => d.id)).toEqual(['trapdoor']);
    s.use('door');
    expect(s.doors.map((d) => d.id)).toEqual(['trapdoor', 'front']);
    expect(s.spots).toEqual([]);
  });

  it('keep each inside to the room budget', () => {
    for (const [id, r] of Object.entries(built)) {
      const n = r.info();
      expect(n.draws, id).toBeLessThanOrEqual(300);
      expect(n.triangles, id).toBeLessThanOrEqual(800000);
    }
  });
});
