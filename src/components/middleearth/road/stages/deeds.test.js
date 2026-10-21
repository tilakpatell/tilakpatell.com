import { describe, expect, it } from 'vitest';
import { BEATS_OF } from './registry';
import { STAGES } from './index';
import { VERBS } from '../deeds';
import { LINES } from '../voicelines';

const deeds = STAGES.flatMap((st) => (BEATS_OF[st.id] ?? []).filter((b) => b.deed).map((b) => ({ stage: st.id, beat: b, deed: b.deed })));

describe('what there is to do on the Road', () => {
  it('asks something of the visitor two times or more on every stage, fifty and more in all', () => {
    for (const st of STAGES) expect(deeds.filter((d) => d.stage === st.id).length, st.id).toBeGreaterThanOrEqual(2);
    expect(deeds.length).toBeGreaterThanOrEqual(50);
  });

  it('each deed a verb it can be played with, a label of its own, and its lines said', () => {
    const labels = new Set();
    for (const { stage, beat, deed } of deeds) {
      const at = `${stage}:${beat.id}`;
      expect(VERBS, at).toContain(deed.verb);
      expect(deed.label, at).toBeTruthy();
      expect(labels.has(deed.label), at).toBe(false);
      labels.add(deed.label);
      for (const l of deed.lines ?? []) expect(LINES[l], `${at} ${l}`).toBeTruthy();
      // (its moment inside the beat's hold, where the beat holds at all)
      if (beat.hold > 0 && deed.at != null) expect(deed.at, at).toBeLessThan(beat.hold);
    }
  });

  it('a choice has one right answer, and a word back for each wrong one', () => {
    for (const { stage, beat, deed } of deeds.filter((d) => d.deed.verb === 'choose')) {
      expect(deed.choices.filter((c) => c.right), `${stage}:${beat.id}`).toHaveLength(1);
      for (const c of deed.choices.filter((x) => !x.right)) {
        expect(c.line?.text, `${stage}:${beat.id} ${c.label}`).toBeTruthy();
        expect(c.line.text).not.toMatch(/['"!]/);
      }
    }
  });
});
