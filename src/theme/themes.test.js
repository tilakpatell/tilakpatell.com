import { describe, expect, it } from 'vitest';
import { routeTheme } from './themes';

describe('routeTheme', () => {
  it('gives a page its own colours, matched whole', () => {
    expect(routeTheme('/middle-earth')).toBe('shire');
    expect(routeTheme('/middle-earth/mordor')).toBe('mordor');
    expect(routeTheme('/caribbean')).toBe('tortuga');
    expect(routeTheme('/home')).toBeUndefined();
  });

  it('dresses every Middle-earth chapter in the Shire’s', () => {
    for (const p of ['/middle-earth/bree', '/middle-earth/weathertop', '/middle-earth/cirith-ungol']) expect(routeTheme(p), p).toBe('shire');
  });

  it('ends a prefix at a slash', () => {
    expect(routeTheme('/middle-earthly')).toBeUndefined();
  });

  it('wants an address', () => {
    expect(routeTheme('')).toBeUndefined();
    expect(routeTheme(undefined)).toBeUndefined();
  });

  it('leaves the other worlds’ inner pages alone', () => {
    for (const p of ['/c-137/citadel', '/dot-matrix/64', '/projects/devspace/x']) expect(routeTheme(p), p).toBeUndefined();
  });

  it('keeps Avengers HQ’s colours under every building’s address', () => {
    for (const p of ['/avengers', '/avengers/gate', '/avengers/hangar', '/avengers/nowhere']) expect(routeTheme(p), p).toBe('stark');
    expect(routeTheme('/avengersx')).toBeUndefined();
  });
});
