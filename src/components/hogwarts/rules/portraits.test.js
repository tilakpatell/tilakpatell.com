import { describe, expect, it } from 'vitest';
import { FAT_LADY, FRAMES, QUIET, SUBJECTS, SULK, UNSEEN, WANDERER, fatLady, hangs, passing, trick, wander } from './portraits';

describe('the portraits', () => {
  it('hangs a dozen named subjects, each with a line in the site’s own words', () => {
    expect(SUBJECTS).toHaveLength(12);
    expect(new Set(SUBJECTS.map((s) => s.id)).size).toBe(12);
    for (const s of SUBJECTS) {
      expect(s.name).toMatch(/^[A-Z]/);
      expect(s.line).not.toMatch(/['"]/);
      expect(s.line.length).toBeLessThan(120);
      expect(s.palette).toHaveLength(4);
      for (const c of s.palette) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
    const st = hangs();
    expect(Object.values(st.at).filter(Boolean).sort()).toEqual(SUBJECTS.map((s) => s.id).sort());
    expect(FRAMES.length).toBeGreaterThan(SUBJECTS.length);
  });

  it('speaks as you pass, once, then keeps quiet a while', () => {
    let st = hangs();
    const near = [{ frame: FRAMES[2], d: 1.5 }];
    const a = passing(st, near, 10);
    expect(a.said?.id).toBe(st.at[FRAMES[2]]);
    st = a.state;
    expect(passing(st, near, 20).said).toBeNull();
    expect(passing(st, near, 10 + QUIET + 1).said?.id).toBe(a.said.id);
    // too far, or an empty frame: nothing
    expect(passing(hangs(), [{ frame: FRAMES[2], d: 9 }], 0).said).toBeNull();
    expect(passing(hangs(), [{ frame: FRAMES.at(-1), d: 1 }], 0).said).toBeNull();
  });

  it('lets the nearest who has not spoken speak first', () => {
    let st = hangs();
    const near = [
      { frame: FRAMES[0], d: 1 },
      { frame: FRAMES[1], d: 2 },
    ];
    const first = passing(st, near, 0);
    const second = passing(first.state, near, 1);
    expect(first.said.id).toBe(st.at[FRAMES[0]]);
    expect(second.said.id).toBe(st.at[FRAMES[1]]);
  });

  it('moves the wanderer to another frame only when nobody is looking at either', () => {
    let st = hangs();
    const home = Object.keys(st.at).find((f) => st.at[f] === WANDERER);
    // watched: he stays
    for (let i = 0; i < 20; i++) {
      const r = wander(st, { seen: new Set([home]), dt: 0.5 });
      expect(r.moved).toBeNull();
      st = r.state;
    }
    // looked away: not at once, but once he has been unseen long enough
    let r = wander(st, { seen: new Set(), dt: UNSEEN / 2 });
    expect(r.moved).toBeNull();
    r = wander(r.state, { seen: new Set(), dt: UNSEEN });
    expect(r.moved?.from).toBe(home);
    expect(r.state.at[r.moved.to]).toBe(WANDERER);
    expect(r.state.at[home]).toBeNull();
    // and never into a frame somebody is looking at, nor one that is taken
    const spare = FRAMES.filter((f) => !hangs().at[f]);
    const watched = wander({ ...hangs(), unseen: { [home]: 5 } }, { seen: new Set([spare[0]]), dt: 0.1 });
    expect(watched.moved.to).not.toBe(spare[0]);
    expect(hangs().at[watched.moved.to]).toBeNull();
  });

  it('opens the Fat Lady for the Sorting’s password, however it is typed', () => {
    const st = hangs();
    expect(fatLady(st, 'toffee COMET ', 'Toffee comet', 0).open).toBe(true);
    expect(fatLady(st, 'Toffee comet', 'Toffee comet', 0).line).toBe(FAT_LADY.right);
    expect(fatLady(st, '', 'Toffee comet', 0).open).toBe(false);
  });

  it('sulks after three wrong tries, and comes round after a while', () => {
    let st = hangs();
    let r = fatLady(st, 'pumpkin', 'Lantern moth', 0);
    expect(r.line).toBe(FAT_LADY.wrong[0]);
    r = fatLady(r.state, 'pasty', 'Lantern moth', 1);
    expect(r.line).toBe(FAT_LADY.wrong[1]);
    r = fatLady(r.state, 'owl', 'Lantern moth', 2);
    expect(r.line).toBe(FAT_LADY.sulk);
    // even the right word, while she sulks
    const sulking = fatLady(r.state, 'Lantern moth', 'Lantern moth', 10);
    expect(sulking.open).toBe(false);
    expect(sulking.line).toBe(FAT_LADY.sulking);
    // over it: a wrong word is the first of three again, and the right one opens
    expect(fatLady(r.state, 'nope', 'Lantern moth', 2 + SULK + 1).line).toBe(FAT_LADY.wrong[0]);
    expect(fatLady(r.state, 'lantern moth', 'Lantern moth', 2 + SULK + 1).open).toBe(true);
  });

  it('sinks you to the knee on the trick step once a visit', () => {
    let st = hangs();
    let r = trick(st, 1);
    expect(r.sink).toBe(true);
    r = trick(r.state, 1);
    expect(r.sink).toBe(false);
    expect(trick(r.state, 2).sink).toBe(true);
  });
});
