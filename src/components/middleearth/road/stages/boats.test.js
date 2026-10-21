import { describe, expect, it } from 'vitest';
import { crews } from './boats';

const at = (ids) => ids.map((id, i) => ({ id, x: i % 2 ? 0.45 : -0.45, z: 100 + i * 1.6 }));

describe('the boats’ crews', () => {
  it('nine to three boats, three to a boat, front to back', () => {
    const c = crews(at(['frodo', 'sam', 'merry', 'pippin', 'aragorn', 'boromir', 'legolas', 'gimli', 'gandalf']), 3);
    expect(c.map((b) => b.length)).toEqual([3, 3, 3]);
    expect(c[0].map((w) => w.id)).toEqual(['frodo', 'sam', 'merry']);
  });

  it('two to one boat, and none to an empty river', () => {
    expect(crews(at(['frodo', 'sam']), 3).map((b) => b.length)).toEqual([2]);
    expect(crews([], 3)).toEqual([]);
  });

  it('eight share three boats as the films do, three, three and two', () => {
    expect(crews(at(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']), 3).map((b) => b.length)).toEqual([3, 3, 2]);
  });
});
