import { describe, expect, it } from 'vitest';
import { createDoing } from './doing';

const stages = [{ id: 'one', length: 100 }];
const beats = { one: [{ id: 'hide', at: 40, hold: 8, deed: { verb: 'hold', label: 'Keep still', seconds: 2, at: 1, stance: 'crouch' } }] };
const none = { act: false, acting: false, left: false, right: false, pick: null };

describe('what the company does at a deed', () => {
  it('keeps still with the visitor: down while it is held, and through its beat once done; up after', () => {
    const d = createDoing({ stages, beatsOf: beats, tell: () => {}, say: () => {} });
    // (the deed's mark, as the clock has it)
    const s = d.gate(0);
    const step = (input, since) => d.step(0.5, input, { s, stage: 'one', since });
    step(none, { hide: 1 });
    expect(d.stance()).toBe(null);
    step({ ...none, acting: true }, { hide: 1 });
    expect(d.stance()).toBe('crouch');
    for (let i = 0; i < 4; i++) step({ ...none, acting: true }, { hide: 1 });
    expect(d.gate(0)).toBe(null);
    step(none, { hide: 3 });
    expect(d.stance()).toBe('crouch');
    step(none, { hide: 8.5 });
    expect(d.stance()).toBe(null);
  });

  it('a deed with no stance leaves the company as it is', () => {
    const plain = { one: [{ ...beats.one[0], deed: { ...beats.one[0].deed, stance: undefined } }] };
    const d = createDoing({ stages, beatsOf: plain, tell: () => {}, say: () => {} });
    const s = d.gate(0);
    d.step(0.5, { ...none, acting: true }, { s, stage: 'one', since: { hide: 1 } });
    expect(d.stance()).toBe(null);
  });
});
