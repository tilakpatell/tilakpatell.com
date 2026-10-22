// rig-check.mjs's verdict, on results shaped as its page makes them.
import { describe, expect, it } from 'vitest';
import { CLIPS, FLOOR, ROLES, STAND, verdict } from './rig-check.mjs';

// a walk whose toes plant and push back as the figure goes forward at `speed`
function walked(speed = 0.5, slide = 0) {
  const series = [[], []];
  for (let f = 0; f < 150; f++) {
    const t = f / 30;
    for (const k of [0, 1]) {
      const phase = (t + k * 0.5) % 1;
      const down = phase < 0.5;
      // down: the toe stays put (or slides by `slide`); up: it swings ahead
      const z = down ? Math.floor(t + k * 0.5) * speed + slide * phase : Math.floor(t + k * 0.5) * speed + speed * ((phase - 0.5) / 0.5);
      series[k].push({ t, p: [0, down ? 0 : 0.08, z] });
    }
  }
  return { speed, series };
}

const good = () => ({
  errors: [],
  missing: [],
  roles: [...ROLES],
  clips: Object.fromEntries(CLIPS.map((n) => [n, { duration: 1, lost: [], nan: false, soleY: [-0.01, 0, 0.01], bodyY: [-0.01, 0, 0.01] }])),
  walked: walked(),
});

describe('judging a skinned figure', () => {
  it('passes a figure with every bone, every clip, the soles down and the toes planted', () => {
    const v = verdict(good());
    expect(v.problems).toEqual([]);
    expect(v.ok).toBe(true);
    expect(v.numbers.walkSpeed).toBe(0.5);
    expect(v.numbers.drift).toBeLessThan(0.05);
  });

  it('fails a missing bone, a role rig.js can’t find, a missing clip and a clip that moves what isn’t there', () => {
    const r = good();
    r.missing = ['LeftToeBase'];
    r.roles = ROLES.filter((k) => k !== 'toeL');
    r.clips.cast = { missing: true };
    r.clips['sit.down'].lost = ['Tail'];
    r.clips.knockdown.nan = true;
    const v = verdict(r);
    expect(v.ok).toBe(false);
    expect(v.problems).toEqual(expect.arrayContaining(['bones missing: LeftToeBase', 'lib/three/rig.js finds no toeL', 'cast: no clip', 'sit.down: moves bones the figure hasn’t (Tail)', 'knockdown: poses the figure into nonsense (NaN)']));
  });

  it('fails soles off the floor, walking or standing, past a few centimetres', () => {
    const r = good();
    r.clips.walk.soleY = [0, -(FLOOR + 0.01)];
    r.clips.idle.soleY = [STAND + 0.005];
    const v = verdict(r);
    expect(v.problems.some((p) => p.startsWith('walk: the lowest sole'))).toBe(true);
    expect(v.problems.some((p) => p.startsWith('idle: the soles'))).toBe(true);
  });

  it('fails a planted toe that slides, and a walk with no stride', () => {
    const r = good();
    r.walked = walked(0.5, 0.4);
    expect(verdict(r).problems.some((p) => /slides/.test(p))).toBe(true);
    r.walked = { speed: 0, series: [[], []] };
    expect(verdict(r).problems).toContain('walk: no stride measured (the toes never plant)');
  });

  it('says what the page threw', () => {
    const r = good();
    r.errors = ['TypeError: no Hips\n at …'];
    expect(verdict(r).problems[0]).toBe('the page failed: TypeError: no Hips');
  });
});
