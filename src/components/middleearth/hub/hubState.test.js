import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../chapters';
import { firstStep, ghost, nextUnfinished } from './hubState';

const RIDE = { kind: 'ride', to: '/middle-earth/road', label: 'Ride the Road' };
const AGAIN = { kind: 'ride-again', to: '/middle-earth/road', label: 'Ride the Road again' };
const BEGIN = { kind: 'begin', id: 'shire', label: 'Begin at the Shire' };

describe('the first step the hub offers', () => {
  it('offers the Road first with nothing won and nothing ridden, the Shire beside it', () => {
    expect(firstStep([])).toEqual(RIDE);
    expect(firstStep()).toEqual(RIDE);
    expect(ghost([])).toEqual(BEGIN);
    expect(nextUnfinished([])).toBe('shire');
  });
  it('once the Road is ridden, says walk it yourself, and the Road is ridden again beside it', () => {
    expect(firstStep([], { ridden: true })).toEqual({ ...BEGIN, label: 'Now walk it yourself · Begin at the Shire' });
    expect(ghost([], { ridden: true })).toEqual(AGAIN);
  });
  it('carries on at the first chapter not won, even when a later one has seals', () => {
    expect(firstStep(['eagles'])).toEqual({ kind: 'carry', id: 'shire', label: 'Carry on · The Shire' });
    expect(firstStep(['eagles'], { ridden: true })).toEqual({ kind: 'carry', id: 'shire', label: 'Carry on · The Shire' });
    expect(ghost(['eagles'])).toEqual(RIDE);
    expect(ghost(['eagles'], { ridden: true })).toEqual(AGAIN);
    expect(nextUnfinished(['eagles'])).toBe('shire');
  });
  it('carries on to Bree once the Shire is won', () => {
    expect(firstStep(CHAPTERS[0].seals)).toEqual({ kind: 'carry', id: 'bree', label: 'Carry on · Bree' });
    expect(nextUnfinished(CHAPTERS[0].seals)).toBe('bree');
  });
  it('offers the road again once every chapter is won', () => {
    const all = CHAPTERS.flatMap((c) => c.seals);
    expect(firstStep(all)).toEqual({ kind: 'again', id: 'shire', label: 'The road again' });
    expect(nextUnfinished(all)).toBe(null);
  });
});
