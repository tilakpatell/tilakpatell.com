import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTrips } from './trips';
import { driveById, parkFor } from './nav';
import { OVERDRIVE, spawn } from './ship';
import { SECTORS } from './layout';
import { JAMMED, jumpState } from './words';

// (the deps as scene.js passes them: the page's props, the powers and the
// arms are thunks, read when they're needed, never when the trips are made)
const make = ({ state = {}, props = {}, deps = {} } = {}) => {
  const events = [];
  const st = { ship: { ...spawn('home') }, auto: null, jump: null, then: null, note: null, crash: null, dive: null, hyperAt: null, interdicted: false, stats: {}, view: 'chase', seat: 'chase', lastInput: 0, flown: true, yaw: 0, ...state };
  let now = { drive: 'super', frozen: false, ...props };
  const powers = { cancel() {} };
  const unique = { clear() {} };
  const trips = createTrips({
    state: st, props: () => now, emit: (e) => events.push(e),
    pilots: { pose: () => null }, front: () => null, powers: () => powers, unique: () => unique,
    heard() {}, retarget() {}, invalidate() {}, reduced: false, onFoot: () => false, wall: () => 100, settle() {}, ...deps,
  });
  return { state: st, events, trips, setProps: (next) => { now = { ...now, ...next }; } };
};
afterEach(() => vi.useRealTimers());

describe('trips (the scene’s travel, moved out)', () => {
  it('flies to a place on super speed, parked as nav.js parks it', () => {
    const { state, trips } = make();
    expect(trips.travel('marvel', 'super')).toBe(true);
    expect(state.auto).toEqual({ id: 'marvel', park: parkFor('marvel', [state.ship.x, state.ship.z]), od: OVERDRIVE });
  });
  it('jumps with the jump charged, and goes on super speed saying why when it isn’t', () => {
    const a = make();
    a.trips.travel('marvel', 'hyper');
    expect([a.state.jump?.phase, a.state.auto]).toEqual(['align', null]);
    const b = make({ state: { hyperAt: 98 } });
    b.trips.travel('marvel', 'hyper');
    expect(b.state.auto.od).toBe(OVERDRIVE);
    expect(b.events).toContainEqual({ type: 'hyper', why: 'charging', wait: 3 });
    expect(b.state.note.text).toBe(`${jumpState(false, 3)}: super speed instead`);
    const c = make({ state: { interdicted: true } });
    c.trips.travel('marvel', 'hyper');
    expect(c.state.note.text).toBe(JAMMED.long);
  });
  it('is simply there with reduced motion, and says so after the page’s own pick', () => {
    vi.useFakeTimers();
    const { state, events, trips } = make({ deps: { reduced: true } });
    const park = parkFor('marvel', [state.ship.x, state.ship.z]);
    trips.travel('marvel');
    expect([state.ship.x, state.ship.z, state.auto]).toEqual([park.x, park.z, null]);
    expect(events.some((e) => e.type === 'arrived')).toBe(false);
    vi.runAllTimers();
    expect(events).toContainEqual({ type: 'arrived', id: 'marvel', done: true });
  });
  it('goes by the portal into the other sector, and on from its far end', () => {
    const o = SECTORS.rickmorty.origin;
    const { state, trips } = make({ state: { ship: { ...spawn(null), x: o[0], y: 0, z: o[2] + 500 } } });
    trips.travel('marvel', 'super');
    expect([state.auto.id, state.then]).toEqual(['rmportal-back', { id: 'marvel', drive: 'super', name: null }]);
  });
  it('won’t go nowhere, on foot, frozen or mid-crash', () => {
    expect(make().trips.travel('nope')).toBe(false);
    expect(make({ deps: { onFoot: () => true } }).trips.travel('marvel')).toBe(false);
    expect(make({ props: { frozen: true } }).trips.travel('marvel')).toBe(false);
    expect(make({ state: { crash: {} } }).trips.travel('marvel')).toBe(false);
  });
  it('drops a trip and tells the page', () => {
    const { state, events, trips } = make();
    trips.travel('marvel');
    trips.dropAuto();
    expect([state.auto, state.then]).toEqual([null, null]);
    expect(events.at(-1)).toEqual({ type: 'arrived', id: 'marvel', done: false });
  });
  it('reads the page’s props as they are now, not as they were when it was made', () => {
    const { state, trips, setProps } = make();
    setProps({ frozen: true });
    expect(trips.travel('marvel')).toBe(false);
    setProps({ frozen: false, drive: 'cruise' });
    expect(trips.navTo('marvel')).toBe(true);
    expect(state.auto.od).toBe(driveById('cruise').od);
    expect(state.auto.od).not.toBe(OVERDRIVE);
  });
  it('goes to the war front just inside the fight, reading the front as it is now', () => {
    // (front.js's goal(): { id: 'front', at, r: 30, reach: ZONE.in * 0.8 })
    const goal = { id: 'front', at: [5000, 0, 3000], r: 30, reach: 400 };
    let front = null;
    const { state, trips } = make({ deps: { front: () => front } });
    expect(trips.travel('front', 'super')).toBe(false); // (no front yet: frontFor hasn't made one)
    front = { goal: () => goal };
    expect(trips.travel('front', 'super')).toBe(true);
    const { park } = state.auto;
    expect(state.auto.id).toBe('front');
    expect(Math.hypot(park.x - goal.at[0], park.z - goal.at[2])).toBeCloseTo(goal.reach, 6);
    expect(park.y).toBe(goal.at[1]);
    expect(trips.frontSpace().goals.front).toEqual(goal);
  });
  it('can be made before the powers and the arms exist, as scene.js makes it, and reads them only on a jump', () => {
    let powers;
    let unique;
    const { state, trips } = make({ deps: { powers: () => powers, unique: () => unique } });
    powers = { cancel: vi.fn() };
    unique = { clear: vi.fn() };
    trips.travel('marvel', 'super');
    expect([powers.cancel, unique.clear].map((f) => f.mock.calls.length)).toEqual([0, 0]);
    trips.dropAuto();
    trips.travel('marvel', 'hyper');
    expect(state.jump?.phase).toBe('align');
    expect([powers.cancel, unique.clear].map((f) => f.mock.calls.length)).toEqual([1, 1]);
  });
});
