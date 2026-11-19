import { describe, expect, it } from 'vitest';
import { CABIN, cabinLight } from './cabin';

const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

describe('the cabin a cockpit reflects', () => {
  it('shows the sky through the glass ahead and the dark paint behind', () => {
    const glass = cabinLight([0, 0.8, -0.6]);
    const behind = cabinLight([0, 0, 1]);
    for (let i = 0; i < 3; i++) expect(glass[i]).toBeCloseTo(CABIN.sky[i], 3);
    for (let i = 0; i < 3; i++) expect(behind[i]).toBeCloseTo(CABIN.wall[i], 3);
  });

  it('is darker underfoot than overhead, and warm low in front where the consoles are', () => {
    expect(luma(cabinLight([0, -1, 0]))).toBeLessThan(luma(cabinLight([0, 1, 0.4])));
    const front = cabinLight(CABIN.front.dir);
    expect(front[0]).toBeGreaterThan(front[2]);
    expect(luma(front)).toBeGreaterThan(luma(cabinLight([0, -0.45, 1])));
  });

  it('is dim everywhere without its lamps: nothing a polished lever catches burns', () => {
    for (let k = 0; k < 200; k++) {
      const a = (k / 200) * Math.PI * 2;
      const b = Math.acos(1 - (2 * ((k * 0.618) % 1)));
      const c = cabinLight([Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)]);
      expect(Math.max(...c)).toBeLessThan(0.25);
    }
  });

  it('takes a look of its own over the default, part by part', () => {
    const red = cabinLight([0, 0, 1], { wall: [0.2, 0, 0] });
    expect(red[0]).toBeCloseTo(0.2, 3);
    expect(red[1]).toBeCloseTo(0, 3);
  });
});
