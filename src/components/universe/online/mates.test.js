import { describe, expect, it } from 'vitest';
import { isMate } from './mates';

describe('isMate', () => {
  it('is an ally, or a mate in your party', () => {
    expect(isMate({ ally: 'ally' })).toBe(true);
    expect(isMate({ ally: 'none', mate: true })).toBe(true);
    expect(isMate({ ally: 'sent', mate: true })).toBe(true);
  });
  it('is neither a stranger nor an ally only asked', () => {
    expect(isMate({ ally: 'none' })).toBe(false);
    expect(isMate({ ally: 'sent' })).toBe(false);
    expect(isMate({ ally: 'got', mate: false })).toBe(false);
    expect(isMate({})).toBe(false);
  });
  it('is never someone blocked, whatever else they are', () => {
    expect(isMate({ ally: 'ally', blocked: true })).toBe(false);
    expect(isMate({ mate: true, blocked: true })).toBe(false);
  });
  it('takes only a true mate, and nothing for no one', () => {
    expect(isMate({ mate: 'yes' })).toBe(false);
    expect(isMate({ mate: 1 })).toBe(false);
    expect(isMate({ ally: true })).toBe(false);
    expect(isMate(null)).toBe(false);
    expect(isMate(undefined)).toBe(false);
  });
});
