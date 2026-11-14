import { describe, expect, it, vi } from 'vitest';
import { boxAt } from '../chartLabels';
import { shortDistance } from '../nav';
import { createPlaceTags, tagSize } from './placeTags';

// a document of plain objects, counting every text and transform written; the
// box has no getBoundingClientRect at all, so a layout read would throw
function fakeDoc() {
  const writes = { text: 0, transform: 0 };
  const node = (tag) => {
    const attrs = new Set();
    let text = '';
    let transform = '';
    const n = {
      tag,
      children: [],
      listeners: {},
      parent: null,
      style: {
        get transform() {
          return transform;
        },
        set transform(v) {
          writes.transform++;
          transform = v;
        },
      },
      get textContent() {
        return text;
      },
      set textContent(v) {
        writes.text++;
        text = v;
      },
      appendChild(c) {
        c.parent = n;
        n.children.push(c);
        return c;
      },
      remove() {
        if (n.parent) n.parent.children = n.parent.children.filter((c) => c !== n);
        n.parent = null;
      },
      toggleAttribute: (a, on) => (on ? attrs.add(a) : attrs.delete(a)),
      hasAttribute: (a) => attrs.has(a),
      addEventListener: (type, fn) => (n.listeners[type] = fn),
    };
    return n;
  };
  const doc = { createElement: node };
  const box = node('div');
  return { doc, box, writes };
}
const frame = { w: 1280, h: 720 };
const on = (box) => box.children.filter((c) => c.hasAttribute('data-on'));
const xy = (el) => el.style.transform.match(/-?\d+/g).map(Number);
const corner = (side, p) => {
  const [w, h] = tagSize(p.name, shortDistance(p.dist));
  const [dx, dy] = boxAt(side, w, h, 4, 3);
  return [Math.round(p.x + dx), Math.round(p.y + dy)];
};

describe('the generated places’ name tags', () => {
  it('shows each beside its point, its name and distance as text, inside the frame', () => {
    const { doc, box } = fakeDoc();
    const tags = createPlaceTags(box, { doc });
    const a = { id: 'E:1,0:0', name: 'Ostra', dist: 1200, x: 300, y: 200 };
    const b = { id: 'E:1,0:1', name: 'Vel Anoor', dist: 64000, x: 900, y: 500 };
    tags.show([a, b], frame);
    expect(on(box)).toHaveLength(2);
    expect(xy(box.children[0])).toEqual(corner('right', a));
    expect(xy(box.children[1])).toEqual(corner('right', b));
    expect(box.children.map((c) => c.children[0].textContent)).toEqual(['Ostra', 'Vel Anoor']);
    expect(box.children[0].children[1].textContent).toBe(shortDistance(1200));
    // (at the right edge it goes left, at the bottom above it, and in a frame too small for it, nowhere)
    const edge = { id: 'E:1,0:2', name: 'Ostra', dist: 10, x: 1250, y: 360 };
    expect(tagSize('Ostra', shortDistance(10))[0]).toBe(55.5);
    const low = { id: 'E:1,0:3', name: 'Ostra', dist: 10, x: 640, y: 715 };
    tags.show([edge, low], frame);
    expect(xy(box.children[0])).toEqual(corner('left', edge));
    expect(xy(box.children[1])).toEqual(corner('upright', low));
    tags.show([{ ...low, x: 20, y: 15 }], { w: 40, h: 30 });
    expect(on(box)).toHaveLength(0);
  });
  it('writes nothing when nothing changed, and two on one point never cover each other, the first beside it', () => {
    const { doc, box, writes } = fakeDoc();
    const tags = createPlaceTags(box, { doc });
    const list = [
      { id: 'a', name: 'Ostra', dist: 100, x: 400, y: 300 },
      { id: 'b', name: 'Mire', dist: 200, x: 400, y: 300 },
    ];
    tags.show(list, frame);
    expect(xy(box.children[0])).toEqual(corner('right', list[0]));
    expect(xy(box.children[1])).toEqual(corner('left', list[1]));
    const was = { ...writes };
    tags.show(list, frame);
    expect(writes).toEqual(was);
  });
  it('hides them all on an empty list, keeps the pool, picks by click, and goes on dispose', () => {
    const { doc, box } = fakeDoc();
    const onPick = vi.fn();
    const tags = createPlaceTags(box, { doc, onPick });
    const p = (i) => ({ id: `E:1,0:${i}`, name: `Place ${i}`, dist: 10, x: 100 + i * 300, y: 300 });
    tags.show([p(0), p(1)], frame);
    tags.show([], frame);
    expect([box.children.length, on(box).length]).toEqual([2, 0]);
    tags.show([p(0), p(1), p(2)], frame);
    expect([box.children.length, on(box).length]).toEqual([3, 3]);
    box.children[1].listeners.click();
    expect(onPick).toHaveBeenCalledWith('E:1,0:1');
    tags.dispose();
    expect(box.children).toEqual([]);
  });
});
