import { describe, expect, it } from 'vitest';
import { createChaseRings } from './chaseRings';
import { COURSE, newChase } from './games/chase';

const shown = (r) => r.group.children.map((m) => r.group.visible && m.visible);

describe('the chase’s rings over the street', () => {
  it('stands each ring where the course has it, turned to its way through, a see-through glow kept out of the ink', () => {
    const r = createChaseRings();
    expect(r.group.children).toHaveLength(COURSE.length);
    for (const [i, m] of r.group.children.entries()) {
      expect(m.position.toArray()).toEqual([COURSE[i].x, COURSE[i].y, COURSE[i].z]);
      expect(m.rotation.y).toBe(COURSE[i].yaw);
      expect(m.material.transparent).toBe(true);
      expect(m.material.depthWrite).toBe(false);
      expect(r.noInk).toContain(m);
    }
  });

  it('shows nothing on foot', () => {
    const r = createChaseRings();
    r.update(0, newChase(), false);
    expect(shown(r).some(Boolean)).toBe(false);
  });

  it('lights the first ring while flying with no run, and the rest faint', () => {
    const r = createChaseRings();
    r.update(0.3, newChase(), true);
    expect(shown(r).every(Boolean)).toBe(true);
    const [first, ...rest] = r.group.children.map((m) => m.material.opacity);
    expect(first).toBeGreaterThan(0.5);
    for (const o of rest) expect(o).toBe(0.25);
  });

  it('hides the rings flown, mid-run', () => {
    const r = createChaseRings();
    r.update(0, { ...newChase(), phase: 'run', next: 2 }, true);
    expect(shown(r)).toEqual([false, false, true, true, true, true]);
    expect(r.group.children[2].material.opacity).toBeGreaterThan(0.5);
    expect(r.group.children[3].material.opacity).toBe(0.25);
  });

  it('frees its one ring shape once, and each ring’s glow', () => {
    const r = createChaseRings();
    let freed = 0;
    r.group.children[0].geometry.addEventListener('dispose', () => (freed += 1));
    let glows = 0;
    for (const m of r.group.children) m.material.addEventListener('dispose', () => (glows += 1));
    r.dispose();
    expect(freed).toBe(1);
    expect(glows).toBe(COURSE.length);
  });
});
