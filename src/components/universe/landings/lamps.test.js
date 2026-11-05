import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LAMPS, createLamps, keepDark, reserveLights } from './lamps';

// a landing's thing with a light of its own at `at` (in the thing's space)
const thingWith = (at, { color = '#ff8800', intensity = 2, distance = 9, decay = 2 } = {}) => {
  const thing = new THREE.Group();
  const light = new THREE.PointLight(color, intensity, distance, decay);
  light.position.set(...at);
  thing.add(light);
  return { thing, light };
};
const lit = (lamps) => lamps.slots.filter((s) => s.intensity > 0);

describe('lamps', () => {
  it('keeps a fixed number of dark lights in the map from the start', () => {
    const map = new THREE.Group();
    const lamps = createLamps(map);
    expect(lamps.slots).toHaveLength(LAMPS);
    expect(map.children.filter((o) => o.isLight)).toHaveLength(LAMPS);
    expect(lit(lamps)).toEqual([]);
  });

  it("puts a thing's light out of the count, kept where it is (keepDark)", () => {
    const { thing, light } = thingWith([0, 1, 0]);
    expect(keepDark(thing)).toEqual([light]);
    expect(light.visible).toBe(false);
    expect(light.parent).toBe(thing);
  });

  it("shows each landing light through a slot: where it is in the map's space, its colour, reach and strength", () => {
    const map = new THREE.Group();
    map.position.set(100, 0, 0);
    map.rotation.y = 0.7;
    const lamps = createLamps(map);
    const root = new THREE.Group();
    root.position.set(5, 0, 0);
    map.add(root);
    const { thing, light } = thingWith([0, 2, 0], { color: '#33ff66', intensity: 3, distance: 7, decay: 1.5 });
    thing.position.set(0, 0, 4);
    root.add(thing);
    const lights = keepDark(thing);
    map.updateMatrixWorld(true);
    lamps.drive(lights, new THREE.Vector3(5, 0, 4));
    const [slot] = lit(lamps);
    expect(slot.position.toArray().map((x) => Math.round(x * 1e6) / 1e6)).toEqual([5, 2, 4]);
    expect(slot.color.getHexString()).toBe(light.color.getHexString());
    expect([slot.intensity, slot.distance, slot.decay]).toEqual([3, 7, 1.5]);
  });

  it('follows a light whose strength the thing changes each frame', () => {
    const map = new THREE.Group();
    const lamps = createLamps(map);
    const { thing, light } = thingWith([0, 1, 0]);
    map.add(thing);
    const lights = keepDark(thing);
    map.updateMatrixWorld(true);
    lamps.drive(lights, new THREE.Vector3());
    light.intensity = 0.25;
    lamps.drive(lights, new THREE.Vector3());
    expect(lit(lamps).map((s) => s.intensity)).toEqual([0.25]);
  });

  it('gives the slots to the lights nearest the player when there are more than slots', () => {
    const map = new THREE.Group();
    const lamps = createLamps(map, { n: 2 });
    const lights = [];
    for (const x of [30, 2, 10, 50]) {
      const { thing } = thingWith([x, 0, 0], { intensity: x });
      map.add(thing);
      lights.push(...keepDark(thing));
    }
    map.updateMatrixWorld(true);
    lamps.drive(lights, new THREE.Vector3(0, 0, 0));
    expect(lit(lamps).map((s) => s.intensity)).toEqual([2, 10]);
    lamps.drive(lights, new THREE.Vector3(45, 0, 0));
    expect(lit(lamps).map((s) => s.intensity)).toEqual([50, 30]);
  });

  it("leaves dark a light whose thing isn't shown (not yet in, or hidden)", () => {
    const map = new THREE.Group();
    const lamps = createLamps(map);
    const shown = thingWith([1, 0, 0]);
    const hidden = thingWith([0, 0, 1]);
    hidden.thing.visible = false;
    const loose = thingWith([0, 1, 0]); // (in no scene yet)
    map.add(shown.thing, hidden.thing);
    const lights = [...keepDark(shown.thing), ...keepDark(hidden.thing), ...keepDark(loose.thing)];
    map.updateMatrixWorld(true);
    lamps.drive(lights, new THREE.Vector3());
    expect(lit(lamps)).toHaveLength(1);
  });

  it('goes dark again with nothing to show, and never changes how many lights the map has', () => {
    const map = new THREE.Group();
    const lamps = createLamps(map);
    const { thing } = thingWith([0, 1, 0]);
    map.add(thing);
    const lights = keepDark(thing);
    map.updateMatrixWorld(true);
    lamps.drive(lights, new THREE.Vector3());
    lamps.drive([], new THREE.Vector3());
    expect(lit(lamps)).toEqual([]);
    lamps.drive(lights, new THREE.Vector3());
    lamps.clear();
    expect(lit(lamps)).toEqual([]);
    expect(map.children.filter((o) => o.isLight && o.visible)).toHaveLength(LAMPS);
  });
});

describe('the landing lights, kept in the map before the landing code comes', () => {
  it('puts the muzzle flare and the slots in the map at once, all dark (none with motion turned down or on a phone but one slot)', () => {
    const map = new THREE.Group();
    const got = reserveLights(map);
    expect(got.flare.isPointLight).toBe(true);
    expect(got.flare.intensity).toBe(0);
    expect(got.slots).toHaveLength(LAMPS);
    expect(map.children.filter((o) => o.isPointLight)).toHaveLength(LAMPS + 1);
    const phone = reserveLights(new THREE.Group(), { small: true });
    expect(phone.flare).toBeNull();
    expect(phone.slots).toHaveLength(1);
    expect(reserveLights(new THREE.Group(), { reduced: true }).flare).toBeNull();
  });

  it('drives the slots it is given, adding none (the map’s count of lights never changes as the landing code arrives)', () => {
    const map = new THREE.Group();
    const { slots } = reserveLights(map);
    const before = map.children.length;
    const lamps = createLamps(map, { slots });
    expect(lamps.slots).toEqual(slots);
    expect(map.children.length).toBe(before);
  });
});
