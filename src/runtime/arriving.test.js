import { describe, expect, it } from 'vitest';
import { createArrivals } from './arriving';

describe('what is still arriving', () => {
  it('is nothing until something says so, and asks each one each time', () => {
    const a = createArrivals();
    expect(a.any()).toBe(false);
    let farDone = false;
    const done = a.add(() => !farDone);
    expect(a.any()).toBe(true);
    farDone = true;
    expect(a.any()).toBe(false);
    farDone = false;
    done();
    expect(a.any()).toBe(false);
  });

  it('is busy while any one is, and lets go of one that throws', () => {
    const a = createArrivals();
    a.add(() => false);
    const second = a.add(() => true);
    expect(a.any()).toBe(true);
    second();
    a.add(() => {
      throw new Error('gone');
    });
    expect(a.any()).toBe(false);
    expect(a.size).toBe(1);
  });
});
