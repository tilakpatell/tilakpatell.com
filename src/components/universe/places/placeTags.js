// The generated places' name tags over the flight: a pool of spans in the
// scene's tag box (the pilots' own box, .universe-tags), each the place's
// name and how far it is, set as text and never as markup. A tag's size is
// worked out from its words, never measured, so no frame reads layout, and
// each is written only when what it shows changes. They are laid out by the
// nav map's own placer (chartLabels.js), the frame as its box, the most
// important first: a name with no clear side is left off.
//
// createPlaceTags(box, { onPick, doc = box.ownerDocument }) → { show(list,
//   frame), dispose() }
//   list: [{ id, name, dist, x, y }] in screen pixels, most important first;
//   frame: { w, h }, the scene's size in CSS pixels
// tagSize(name, distText) → [w, h], in the mono face at 12 px

import { placeLabels } from '../chartLabels';
import { shortDistance } from '../nav';

export const TAG_H = 34;
export const tagSize = (name, distText) => [18 + 7.5 * Math.max(name.length, distText.length), TAG_H];
const DOT = 4; // (the place's own point, which no other tag may cover)

export function createPlaceTags(box, { onPick = () => {}, doc = box?.ownerDocument } = {}) {
  const pool = []; // { el, name, small, id, text, far, at, on }
  const make = () => {
    const el = doc.createElement('span');
    el.className = 'universe-place-tag';
    const name = doc.createElement('b');
    const small = doc.createElement('small');
    el.appendChild(name);
    el.appendChild(small);
    const tag = { el, name, small, id: null, text: null, far: null, at: null, on: false };
    el.addEventListener('click', () => tag.id && onPick(tag.id));
    box.appendChild(el);
    pool.push(tag);
    return tag;
  };
  const off = (tag) => {
    if (!tag.on) return;
    tag.on = false;
    tag.el.toggleAttribute('data-on', false);
  };
  return {
    show(list, frame) {
      if (!box || !doc) return;
      const sizes = new Map();
      const items = list.map((p) => {
        const far = shortDistance(p.dist);
        sizes.set(p.id, tagSize(p.name, far));
        return { id: p.id, x: p.x, y: p.y, text: p.id, r: DOT, far };
      });
      const spots = placeLabels(items, { size: Math.max(frame.w, frame.h), measure: (id) => sizes.get(id)[0], height: TAG_H, dot: DOT, box: { x0: 0, y0: 0, x1: frame.w, y1: frame.h } });
      while (pool.length < list.length) make();
      for (let i = 0; i < pool.length; i++) {
        const tag = pool[i];
        const p = list[i];
        const spot = p ? spots.get(p.id) : null;
        if (!p || !spot || spot.off) {
          off(tag);
          continue;
        }
        tag.id = p.id;
        if (tag.text !== p.name) tag.name.textContent = tag.text = p.name;
        const far = items[i].far;
        if (tag.far !== far) tag.small.textContent = tag.far = far;
        const at = `translate(${Math.round(p.x + spot.dx)}px, ${Math.round(p.y + spot.dy)}px)`;
        if (tag.at !== at) tag.el.style.transform = tag.at = at;
        if (!tag.on) {
          tag.on = true;
          tag.el.toggleAttribute('data-on', true);
        }
      }
    },
    dispose() {
      for (const tag of pool) tag.el.remove();
      pool.length = 0;
    },
  };
}
