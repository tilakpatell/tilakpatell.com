import { describe, expect, it } from 'vitest';
import { CAST, CHANGES, STATES, clipFor, walkers } from './fellowship';
import { sOf } from './line';
import { STAGES, stageById } from './stages/index';

const at = (id, local = 0) => walkers(STAGES, sOf(STAGES, id, local));
const ids = (w) => w.map((x) => x.id);
const end = (id) => stageById(id).length;
// (a stage’s end is the next one’s start: its last metre is its own)
const last = (id) => end(id) - 1;

describe('the fellowship: who walks with you, and how', () => {
  it('Frodo leaves Bag End alone; Sam is with him from the field’s edge', () => {
    expect(ids(at('hobbiton', 0))).toEqual(['frodo']);
    expect(ids(at('hobbiton', end('hobbiton') - 39))).toEqual(['frodo', 'sam']);
  });

  it('Merry and Pippin from Maggot’s crop; Strider from Bree’s last beat', () => {
    expect(ids(at('shire-edge', 25))).toEqual(['frodo', 'sam']);
    expect(ids(at('shire-edge', 26))).toEqual(['frodo', 'sam', 'merry', 'pippin']);
    expect(ids(at('bree', 0))).not.toContain('aragorn');
    expect(ids(at('bree', last('bree')))).toContain('aragorn');
  });

  it('at the Ford Frodo rides with Arwen', () => {
    const w = at('ford', 120);
    expect(w.find((x) => x.id === 'frodo').state).toBe('riding');
    expect(w.find((x) => x.id === 'arwen').state).toBe('riding');
  });

  it('nine set out from Rivendell, in the film’s order', () => {
    expect(ids(at('rivendell', last('rivendell')))).toEqual(['gandalf', 'legolas', 'gimli', 'aragorn', 'boromir', 'merry', 'pippin', 'sam', 'frodo']);
    expect(at('rivendell', last('rivendell')).map((x) => x.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('eight from the Bridge, grieving; Frodo and Sam alone from Amon Hen', () => {
    const after = at('moria', last('moria'));
    expect(after).toHaveLength(8);
    expect(ids(after)).not.toContain('gandalf');
    expect(after.every((x) => x.state === 'grieving')).toBe(true);
    expect(ids(at('anduin', last('anduin')))).toEqual(['sam', 'frodo']);
  });

  it('Gollum leads from the Marshes; Sam carries Frodo on the Mountain; the two lie at its end', () => {
    expect(at('marshes', 40).find((x) => x.id === 'gollum').state).toBe('leading');
    const carried = at('gorgoroth', 100); // (the carry’s mark: stages/gorgoroth/beats.js)
    expect(carried.find((x) => x.id === 'sam').state).toBe('carrying');
    expect(carried.find((x) => x.id === 'frodo').state).toBe('carried');
    const lying = at('gorgoroth', last('gorgoroth'));
    expect(ids(lying).sort()).toEqual(['frodo', 'sam']);
    expect(lying.every((x) => x.state === 'lying')).toBe(true);
  });

  it('a stage address past the save is that stage’s state, not Hobbiton’s', () => {
    expect(ids(at('gorgoroth', 0)).sort()).toEqual(['frodo', 'gollum', 'sam']);
  });

  it('the White City: the four hobbits, the King and his friends', () => {
    expect(ids(at('minas-tirith', 0)).sort()).toEqual(['aragorn', 'arwen', 'frodo', 'gandalfwhite', 'gimli', 'legolas', 'merry', 'pippin', 'sam']);
  });

  it('the Havens: five aboard, three staying', () => {
    const w = at('havens', 0);
    const by = (state) => ids(w.filter((x) => x.state === state)).sort();
    expect(by('aboard')).toEqual(['bilbo', 'elrond', 'frodo', 'galadriel', 'gandalfwhite']);
    expect(by('staying')).toEqual(['merry', 'pippin', 'sam']);
  });

  it('the table names only the cast, known states and real stages', () => {
    for (const c of CHANGES) {
      expect(stageById(c.stage)).not.toBeNull();
      expect(c.local).toBeLessThanOrEqual(end(c.stage));
      for (const id of [...(c.add ?? []), ...(c.remove ?? []), ...Object.keys(c.state ?? {})]) expect(CAST).toContain(id);
      for (const st of Object.values(c.state ?? {})) expect(STATES).toContain(st);
    }
  });

  it('a state picks its clip; the elves walk formally, a boat seats them', () => {
    expect(clipFor('walking', 'walk')).toBe('walk');
    expect(clipFor('walking', 'walk', 'legolas')).toBe('walk.formal');
    expect(clipFor('running', 'walk')).toBe('jog');
    expect(clipFor('riding', 'horse')).toBe('sit.ground');
    expect(clipFor('walking', 'boat')).toBe('sit.ground');
    expect(clipFor('grieving', 'walk')).toBe('tired');
    expect(clipFor('leading', 'walk')).toBe('crawl');
    expect(clipFor('lying', 'walk')).toBe('lie.down');
    for (const st of STATES) expect(typeof clipFor(st, 'walk')).toBe('string');
  });
});
