import { describe, expect, it } from 'vitest';
import { houseSky } from './houseSky';

const STREET = { top: 1, low: 2 };
const ANNEX = { top: 3, low: 4 };
const OUTDOOR = ['annex', 'pluto'];
const pick = (id, area) => houseSky(id, area, { outdoor: OUTDOOR, street: STREET, annex: ANNEX });

describe('the sky the house look fogs into', () => {
  it('is the street’s on the street', () => {
    expect(pick('street', {})).toBe(STREET);
  });
  it('is a place’s own where it has one, outdoors or a room looking out', () => {
    const own = { top: 5, low: 6 };
    expect(pick('pluto', { skyLook: own })).toBe(own);
    expect(pick('customs', { skyLook: own })).toBe(own);
  });
  it('is Blips and Chitz’s for an outdoor area with none of its own (the annex itself)', () => {
    expect(pick('annex', {})).toBe(ANNEX);
    expect(pick('pluto', undefined)).toBe(ANNEX);
  });
  it('is none for a room', () => {
    expect(pick('garage', {})).toBeNull();
  });
});
