import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SECTOR, sectorKey } from '../../../lib/space/address.js';
import { RIM } from '../../universe/layout';
import { createFarStars } from '../../universe/farStars';
import { universeBudget } from '../../universe/budget';
import { STARS } from '../../universe/lighting';
import { createExpanse } from './expanse';

// a pool that answers with a small made-up sector, when let go (all at once, or one key)
const fakePool = () => {
  const waiting = new Map(); // name:key → { msg, resolve }
  const asked = [];
  const cancelled = [];
  const sectorOf = ({ sx, sy, sz }) => {
    const origin = [sx * SECTOR, sy * SECTOR, sz * SECTOR];
    const id = sectorKey(sx, sy, sz);
    const at = [origin[0] + 1000, origin[1], origin[2] + 2000];
    const things = { count: 0, slot: new Uint16Array(0), kind: new Uint8Array(0), at: new Float32Array(0), size: new Float32Array(0) };
    return { id, sx, sy, sz, origin, systems: [{ id: `${id}:0`, at, reach: 600, star: { class: 'G', color: '#ffeedd', size: 150 }, planets: [] }], wonders: [], things, extras: {}, beacons: {} };
  };
  const stars = (count, centre, list) => ({ at: Float32Array.from(list.flatMap((p) => [p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]])), color: new Uint8Array(count * 3).fill(200), r: new Float32Array(count).fill(150), count });
  const answer = (msg) => {
    if (msg.type === 'beyond') {
      const c = msg.centre.map((v) => v * SECTOR);
      return { key: msg.key, centre: msg.centre, stars: stars(1, c, [[c[0] + 3 * SECTOR, c[1], c[2]]]) };
    }
    const sector = sectorOf(msg);
    return { key: msg.key, sector, stars: stars(1, sector.origin, [sector.systems[0].at]) };
  };
  return {
    asked,
    cancelled,
    request(name, msg) {
      asked.push(`${name}:${msg.key}`);
      return new Promise((resolve) => waiting.set(`${name}:${msg.key}`, { msg, resolve }));
    },
    cancel(name, key) {
      cancelled.push(`${name}:${key}`);
      const w = waiting.get(`${name}:${key}`);
      if (w) {
        waiting.delete(`${name}:${key}`);
        w.resolve(null);
      }
    },
    // let go every job waiting (or only those whose key passes `only`)
    async flush(only = () => true) {
      for (const [id, w] of [...waiting]) {
        if (!only(id)) continue;
        waiting.delete(id);
        w.resolve(answer(w.msg));
      }
      await new Promise((r) => setTimeout(r, 0));
    },
    waiting: () => [...waiting.keys()],
  };
};

const setup = (budget = { ...universeBudget({ detail: 'high' }), expanseMs: 1e9 }) => {
  const map = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 45000);
  const far = createFarStars(map, { places: [], skyFar: 24000, slots: 64, slotSize: 400, discs: 500 });
  const pool = fakePool();
  const ex = createExpanse(map, { workers: pool, far, budget, drawNebula: null });
  const frame = (x, y = 0, z = 0) => {
    camera.position.set(x, y, z);
    camera.updateMatrixWorld();
    far.update(camera, 1 / 60);
    ex.update({ camera, now: 0 });
  };
  // fly to a place and let everything in
  const settle = async (x, y = 0, z = 0) => {
    for (let i = 0; i < 40; i++) {
      frame(x, y, z);
      if (!pool.waiting().length) break;
      await pool.flush();
    }
    frame(x, y, z); // (the far layer eases its slots on its own next update)
  };
  const shown = () => {
    const out = [];
    for (let i = 0; i < 64; i++) if (far.slotShown(i) > 0) out.push(i);
    return out;
  };
  return { map, camera, far, pool, ex, frame, settle, shown };
};

describe('the endless space round the camera', () => {
  it('loads home’s sector and its 26 neighbours, above and below too, a few at a time', async () => {
    const { pool, ex, frame, settle, budget = universeBudget({ detail: 'high' }) } = setup();
    frame(0, 0, 0);
    const first = pool.asked.filter((k) => k.startsWith('expanse:'));
    expect(first.length).toBeLessThanOrEqual(budget.workers);
    expect(first[0]).toBe('expanse:0,0,0');
    await settle(0, 0, 0);
    const ids = ex.loaded();
    expect(ids).toHaveLength(27);
    expect(ids).toContain('E:0,0');
    expect(ids).toContain('E:0,0,1');
    expect(ids).toContain('E:0,0,-1');
    expect(ex.root.position.toArray()).toEqual([0, 0, 0]);
  });

  it('has no rim: across the old one nothing is dropped or asked', async () => {
    const { pool, ex, settle, frame } = setup();
    await settle(RIM.inner - 1000, 0, 0);
    const asked = pool.asked.length;
    const had = ex.loaded().slice().sort();
    for (let x = RIM.inner - 1000; x <= RIM.outer + 1000; x += 500) frame(x, 0, 0);
    expect(pool.asked.length).toBe(asked);
    expect(ex.loaded().slice().sort()).toEqual(had);
    expect(ex.root.position.toArray()).toEqual([0, 0, 0]);
  });

  it('draws the new centre’s sectors in the one frame the last of them lands, never both or neither', async () => {
    const { pool, far, ex, settle, frame, shown } = setup();
    await settle(50000, 0, 0);
    const before = shown();
    expect(before.length).toBe(27 + 5);
    const slotsOf = () => new Set(shown());
    // across the face at 60,000: the new face's sectors asked
    frame(61000, 0, 0);
    let was = slotsOf();
    for (let i = 0; i < 40 && pool.waiting().length; i++) {
      await pool.flush((id) => id === pool.waiting()[0]); // (one at a time)
      frame(61000, 0, 0);
      const now = slotsOf();
      const changed = [...now].some((s) => !was.has(s)) || [...was].some((s) => !now.has(s));
      if (changed) {
        // (one frame: the whole new set in, the old out)
        expect(pool.waiting()).toEqual([]);
      }
      expect(now.size).toBeGreaterThan(0);
      was = now;
    }
    expect(shown().length).toBe(27 + 5);
    expect(ex.sector()).toBe('E:1,0');
    far.dispose();
  });

  it('refuses what comes late for where it was, after a jump, and fades the new place in', async () => {
    const { pool, ex, settle, frame, shown, far } = setup();
    frame(0, 0, 0);
    const old = pool.waiting();
    expect(old.length).toBeGreaterThan(0);
    frame(1.2e8, 0, 0);
    await pool.flush((id) => old.includes(id)); // (the old answers, late)
    frame(1.2e8, 0, 0);
    expect(ex.loaded().every((id) => id.startsWith('E:1000,'))).toBe(true);
    await settle(1.2e8, 0, 0);
    expect(ex.loaded()).toHaveLength(27);
    expect(ex.loaded().every((id) => /^E:(999|1000|1001),/.test(id))).toBe(true);
    // (faded in: not yet whole the frame it's shown)
    const s = shown();
    expect(s.length).toBeGreaterThan(0);
    expect(s.every((i) => far.slotShown(i) < 1)).toBe(true);
    for (let i = 0; i < 40; i++) frame(1.2e8, 0, 0);
    expect(shown().every((i) => far.slotShown(i) === 1)).toBe(true);
  });

  it('sitting on a face asks for each sector once', async () => {
    const { pool, settle, frame } = setup();
    await settle(59999.5, 0, 0);
    await settle(60000.5, 0, 0);
    const n = pool.asked.filter((k) => k.startsWith('expanse:')).length;
    for (let i = 0; i < 300; i++) {
      frame(i % 2 ? 59999.5 : 60000.5, 0, 0);
      await pool.flush();
    }
    const asked = pool.asked.filter((k) => k.startsWith('expanse:'));
    expect(asked.length).toBe(n);
    expect(new Set(asked).size).toBe(asked.length);
  });

  it('lets go of everything on dispose', async () => {
    const { map, pool, ex, settle, frame, shown, far, camera } = setup();
    await settle(0, 0, 0);
    frame(130000, 0, 0); // (some asked, in flight)
    const flying = pool.waiting().filter((k) => k.startsWith('expanse:'));
    ex.dispose();
    for (const k of flying) expect(pool.cancelled).toContain(k);
    far.update(camera, 1 / 60);
    expect(shown()).toEqual([]);
    expect(ex.root.children).toHaveLength(0);
    expect(map.children.includes(ex.root)).toBe(false);
  });

  it('lights with the hand-made stars before its first update, and its built stars after', async () => {
    const { ex } = setup();
    expect(ex.stars().length).toBe(STARS.length);
    expect(ex.stars()).toEqual(STARS);
  });

  it('hides all of it when asked (on foot, in the pocket), and brings it back', async () => {
    const { ex, settle, shown, camera, far, frame } = setup();
    await settle(0, 0, 0);
    for (let i = 0; i < 40; i++) frame(0, 0, 0);
    const n = shown().length;
    expect(n).toBe(27 + 5);
    ex.update({ camera, now: 0, hidden: true });
    far.update(camera, 1 / 60);
    expect(shown()).toEqual([]);
    expect(ex.root.visible).toBe(false);
    ex.update({ camera, now: 0, hidden: false });
    far.update(camera, 1 / 60);
    expect(shown()).toHaveLength(n);
  });
});
