import { describe, expect, it, vi } from 'vitest';
import { UNIVERSE, fullSector, rowAt, tailOf, wormholeExit } from '../../expanse/shared/gen';
import { createThingPlay } from './index';

const s = fullSector(UNIVERSE, 1, 0, 0, { lattice: false });
const ship = (at) => ({ ship: { x: at[0], y: at[1], z: at[2], heading: 0, speed: 0 }, shield: 100, clock: 50, hitAt: 0, static: 0 });
const play = (opts = {}) => {
  const pay = vi.fn();
  const say = vi.fn();
  return { pay, say, p: createThingPlay({ sectors: () => [s], pay, say, universe: UNIVERSE, ...opts }) };
};

describe('things in space played', () => {
  it('drains the shields in an ion storm without a hit, and holds the regen', () => {
    const storm = s.extras.storm[0];
    const { p } = play();
    const st = ship(rowAt(storm, 1000));
    p.update(st, 1, 1000);
    expect(st.shield).toBe(96);
    expect(st.hitAt).toBe(50);
  });
  it('throws you through a wormhole by hand, never mid-trip', () => {
    const w = s.extras.wormhole[0];
    const exit = wormholeExit(w, UNIVERSE);
    const a = play({ travelling: () => true });
    const st = ship(w.at);
    a.p.update(st, 0.1, 0);
    expect(st.ship.x).toBe(w.at[0]);
    const b = play();
    b.p.update(st, 0.1, 0);
    expect([st.ship.x, st.ship.y, st.ship.z]).toEqual(exit.at);
  });
  it('pays once for two seconds in a comet’s tail', () => {
    const c = s.extras.comet[0];
    const t = 5000;
    const head = rowAt(c, t);
    const { dir, length } = tailOf(c, t);
    const at = head.map((v, k) => v + dir[k] * length * c.size * 0.5);
    const { p, pay } = play();
    const st = ship(at);
    for (let i = 0; i < 30; i++) p.update(st, 0.1, t);
    expect(pay).toHaveBeenCalledTimes(1);
    expect(pay).toHaveBeenCalledWith('found', 1);
  });
  it('says the key near a thing, and E salvages it once', () => {
    const d = s.extras.debris[0];
    const { p, pay, say } = play();
    const st = ship(d.at);
    p.update(st, 0.3, 0);
    expect(p.near()).toMatchObject({ id: d.id, verb: 'salvage' });
    expect(say.mock.calls[0][0]).toMatch(/^E: Salvage/);
    expect(p.press(st)).toBe(true);
    expect(pay).toHaveBeenCalledWith('found', 2);
    p.press(st);
    expect(pay).toHaveBeenCalledTimes(1);
  });
});
