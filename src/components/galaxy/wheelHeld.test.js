import { describe, expect, it, vi } from 'vitest';
import { holdWheel, takes } from './wheelHeld';

// (boxes as the DOM measures them: a parent, its overflow-y, its heights and scroll)
const box = (o = {}, parentElement = null) => ({ scrollTop: 0, clientHeight: 100, scrollHeight: 100, oy: 'visible', parentElement, ...o });
const styleOf = (n) => ({ overflowY: n.oy });

describe('a wheel over the map', () => {
  const page = box({ oy: 'auto', scrollHeight: 5000 });
  const map = box({ oy: 'hidden', scrollHeight: 400 }, page);
  const side = box({ oy: 'auto', scrollHeight: 300 }, map);
  const line = box({}, side);

  it('is taken by a scroller in the map that can still move that way', () => {
    side.scrollTop = 0;
    expect(takes(line, 40, map, styleOf)).toBe(true);
    expect(takes(line, -40, map, styleOf)).toBe(false);
    side.scrollTop = 200; // (at its end)
    expect(takes(line, 40, map, styleOf)).toBe(false);
    expect(takes(line, -40, map, styleOf)).toBe(true);
  });

  it('is nobody’s when the scroller fits, or only clips (hidden), or is the page behind the map', () => {
    const fits = box({ oy: 'auto' }, map);
    expect(takes(box({}, fits), 40, map, styleOf)).toBe(false);
    expect(takes(map, 40, map, styleOf)).toBe(false);
  });

  it('is stopped over the map when nothing in it takes it, and let be otherwise', () => {
    let onWheel = null;
    const root = { ...map, addEventListener: (_, f) => (onWheel = f), removeEventListener: vi.fn() };
    const fits = box({ oy: 'auto' }, root);
    const undo = holdWheel(root, styleOf);
    const wheel = (o) => ({ deltaY: 40, ctrlKey: false, defaultPrevented: false, preventDefault: vi.fn(), ...o });
    const stopped = wheel({ target: box({}, fits) });
    onWheel(stopped);
    expect(stopped.preventDefault).toHaveBeenCalled();
    const scrolls = box({ oy: 'auto', scrollHeight: 300 }, root);
    const taken = wheel({ target: box({}, scrolls) });
    onWheel(taken);
    expect(taken.preventDefault).not.toHaveBeenCalled();
    // (the map's zoom has it already; a sideways wheel and a pinch aren't the page's to lose)
    for (const o of [{ defaultPrevented: true }, { deltaY: 0 }, { ctrlKey: true }]) {
      const e = wheel({ target: box({}, fits), ...o });
      onWheel(e);
      expect(e.preventDefault).not.toHaveBeenCalled();
    }
    undo();
    expect(root.removeEventListener).toHaveBeenCalledWith('wheel', onWheel);
  });
});
