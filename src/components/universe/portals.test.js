import { describe, expect, it } from 'vitest';
import { PORTALS, exitSpot, portalById, portalHit, transit } from './portals';
import { GOALS, SHIP, SOLIDS, autopilot, parkAt, spawn, step } from './ship';
import { POSITIONS, REACH, SECTORS, mapSectorOf as sectorOf } from './layout'; // (the Curve's or the main map's: the Rick and Morty planet is out in the Expanse, in its neighbourhood)
import { WONDERS, reachOf, wonderById } from './deep';
import { parkFor, riftExit } from './nav';

const apart = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('the portals between the sectors', () => {
  it('pairs a portal by the Rick and Morty planet with one by the Citadel', () => {
    expect(PORTALS.map((p) => p.id).sort()).toEqual(['rmportal', 'rmportal-back']);
    const there = portalById('rmportal');
    const back = portalById('rmportal-back');
    expect(sectorOf(...there.at)).toBe('main');
    expect(sectorOf(...back.at)).toBe('rickmorty');
    expect(there.leadsTo).toEqual({ sector: 'rickmorty', exit: 'rmportal-back' });
    expect(back.leadsTo).toEqual({ sector: 'main', exit: 'rmportal' });
    // beside its planet and the Citadel: close enough to be seen with them, clear of them
    const rm = apart(there.at, POSITIONS.rickmorty);
    expect(rm).toBeGreaterThan(REACH.rickmorty * 2);
    expect(rm).toBeLessThan(REACH.rickmorty * 3);
    const cit = wonderById('citadel');
    expect(apart(back.at, cit.at)).toBeGreaterThan(reachOf(cit) + 150);
    expect(apart(back.at, cit.at)).toBeLessThan(reachOf(cit) + 600);
    // not solid, but somewhere the autopilot can go
    for (const p of PORTALS) {
      expect(SOLIDS.some((o) => o.id === p.id)).toBe(false);
      expect(GOALS[p.id], p.id).toBeTruthy();
    }
  });

  it('keeps each portal clear of everything solid, and of the way in to the Rick and Morty planet from home', () => {
    for (const p of PORTALS) for (const o of SOLIDS) expect(apart(p.at, o.at), `${p.id} and ${o.id}`).toBeGreaterThan(o.reach + p.r * 4);
    // (the line from home to the planet passes well wide of it)
    const there = portalById('rmportal');
    const [x, , z] = POSITIONS.rickmorty;
    const l = Math.hypot(x, z);
    const cross = Math.abs(there.at[0] * (z / l) - there.at[2] * (x / l));
    expect(cross).toBeGreaterThan(REACH.rickmorty + there.r * 2);
  });

  it('knows when a step went into a portal, however fast', () => {
    const p = portalById('rmportal');
    const [x, y, z] = p.at;
    expect(portalHit({ x: x - 50, y, z }, { x: x + 50, y, z })).toBe('rmportal'); // (straight through in one step)
    expect(portalHit({ x, y, z }, { x, y, z })).toBe('rmportal'); // (sat in it)
    expect(portalHit({ x: x - 50, y: y + p.r * 1.2, z }, { x: x + 50, y: y + p.r * 1.2, z })).toBeNull(); // (over the top of it)
    expect(portalHit({ x: x - 50, y, z }, { x: x - 30, y, z })).toBeNull(); // (short of it)
    expect(portalHit(null, { x, y, z })).toBeNull();
  });

  it('puts the ship out by the far end, going on away from it, clear, slower', () => {
    for (const p of PORTALS) {
      const out = portalById(p.leadsTo.exit);
      for (let h = 0; h < 6.28; h += 0.5) {
        const ship = { ...spawn(null), x: p.at[0], y: p.at[1], z: p.at[2], heading: h, speed: 300, pitch: 0.4 };
        const r = transit(ship, p.id);
        expect(r.sector, p.id).toBe(p.leadsTo.sector);
        expect(r.exit).toBe(out.id);
        expect(sectorOf(r.ship.x, r.ship.y, r.ship.z)).toBe(out.sector ?? 'main');
        expect(r.ship.speed).toBeCloseTo(Math.min(150, SHIP.boost), 6);
        expect(transit({ ...ship, speed: 10 }, p.id).ship.speed).toBeCloseTo(5, 6);
        expect(r.ship.pitch).toBe(0);
        const d = apart([r.ship.x, r.ship.y, r.ship.z], out.at);
        expect(d).toBeGreaterThan(out.r * 2);
        for (const o of SOLIDS) expect(apart([r.ship.x, r.ship.y, r.ship.z], o.at), `${p.id} at ${h} by ${o.id}`).toBeGreaterThan(o.reach);
        // (flying on, it never goes back in)
        let s = r.ship;
        for (let t = 0; t < 2; t += 1 / 60) {
          const next = step(s, { throttle: 0.3 }, 1 / 60).ship;
          expect(portalHit(s, next), `${p.id} at ${h}`).toBeNull();
          s = next;
        }
      }
      expect(exitSpot(p.id, 0)).toBeTruthy();
    }
    expect(transit(spawn(null), 'citadel')).toBeNull();
  });

  it('flies the autopilot from the Rick and Morty planet into the portal, and through', () => {
    // (the planet is in its neighbourhood, the Curve Rift, a jump from home: neighbourhoods.js)
    let s = { ...spawn(null), ...parkAt('rickmorty'), speed: 0 };
    const park = parkFor('rmportal', [s.x, s.z]);
    let through = null;
    for (let t = 0; t < 150 && !through; t += 1 / 60) {
      const a = autopilot(s, 'rmportal', park, undefined, 1);
      const next = step(s, a.input, 1 / 60).ship;
      through = portalHit(s, next);
      s = next;
    }
    expect(through).toBe('rmportal');
    const out = transit(s, through);
    expect(out.sector).toBe('rickmorty');
    // and from there, the Citadel's portal home
    s = { ...out.ship, speed: 0 };
    const back = parkFor('rmportal-back', [s.x, s.z]);
    through = null;
    for (let t = 0; t < 60 && !through; t += 1 / 60) {
      const a = autopilot(s, 'rmportal-back', back, undefined, 1);
      const next = step(s, a.input, 1 / 60).ship;
      through = portalHit(s, next);
      s = next;
    }
    expect(through).toBe('rmportal-back');
    expect(transit(s, through).sector).toBe('main');
  });

  it('opens a rift only onto somewhere in the sector it’s in, never a portal', () => {
    for (const sector of Object.keys(SECTORS)) {
      for (let i = 0; i < 40; i++) {
        const id = riftExit(null, () => i / 40, sector);
        expect(sectorOf(...GOALS[id].at), id).toBe(sector);
        expect(portalById(id)).toBeNull();
      }
    }
    expect(WONDERS.filter((w) => w.kind === 'portal').length).toBe(PORTALS.length);
  });
});
