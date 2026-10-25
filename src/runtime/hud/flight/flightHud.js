// The flight HUD's writer: frame.js's record put into the overlay's markup
// (FlightHud.jsx's FlightOverlay, the classes both maps drew), each frame by
// the map's frame loop. Each value is written only when it has changed,
// numbers compared before any string is made, so a frame that changes
// nothing writes nothing and makes nothing; `writes` counts this frame's.
// A part whose record is null (the arrows, on foot) is left as it was.
//
//   createFlightHud({ distText }) → { place(root, frame), writes }
//     root: the overlay's .universe-hud element, or null (nothing is written)
//     distText(d): a distance in the map's unit, for the lock and the nav

import { edgeOf, onScreen } from '../../../lib/combat/flight/targeting.js';

export function createFlightHud({ distText }) {
  let els = null;
  const edge = { x: 0, y: 0, angle: 0 };
  // an element and the last of each thing written to it
  const box = (el) => (el ? { el, last: {} } : null);
  const read = (r) => {
    const q = (c) => box(r.querySelector(c));
    const all = (c) => [...r.querySelectorAll(c)].map(box);
    const mates = all('.universe-mate');
    for (const m of mates) m.name = box(m.el.firstChild);
    return { root: box(r), reticle: q('.universe-reticle'), lock: q('.universe-lock'), lockName: q('.universe-lock-name'), lockDist: q('.universe-lock-dist'), lead: q('.universe-lead'), nav: q('.universe-nav'), navName: q('.universe-nav-name'), navDist: q('.universe-nav-dist'), threats: all('.universe-threat'), mates };
  };
  const hud = { writes: 0, place };
  // (each write goes through here: skipped when it's what's there)
  const same = (b, key, v) => {
    if (b.last[key] === v) return true;
    b.last[key] = v;
    hud.writes++;
    return false;
  };
  const flag = (b, name, on) => {
    if (b && !same(b, name, on)) b.el.toggleAttribute(name, on);
  };
  const text = (b, s) => {
    if (b && !same(b, 'text', s)) b.el.textContent = s;
  };
  // a distance: the number compared first, the words made only when it's new
  const dist = (b, d, words) => {
    if (!b) return;
    if (words !== null) {
      b.last.d = NaN; // (a number after the words is written again)
      return text(b, words);
    }
    if (b.last.d === d) return;
    b.last.d = d;
    text(b, distText(d));
  };
  const move = (b, x, y) => {
    const kx = Math.round(x * 10);
    const ky = Math.round(y * 10);
    if (b.last.kx === kx && b.last.ky === ky) return;
    b.last.kx = kx;
    b.last.ky = ky;
    hud.writes++;
    b.el.style.transform = `translate3d(${(kx / 10).toFixed(1)}px, ${(ky / 10).toFixed(1)}px, 0)`;
  };
  const prop = (b, name, k, write) => {
    if (b.last[name] === k) return;
    b.last[name] = k;
    hud.writes++;
    b.el.style.setProperty(name, write(k));
  };
  const px = (k) => `${k}px`;
  const rad = (k) => `${(k / 1000).toFixed(3)}rad`;
  const share = (k) => (k / 1000).toFixed(3);
  // a bracket at its point when that's in view, else an arrow at the edge of
  // the open area pointing the way (its size `r`, in px, when it has one)
  const mark = (b, p, rect, r = 0) => {
    const off = !onScreen(p.x, p.y, p.z, rect);
    let x = p.x;
    let y = p.y;
    if (off) {
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      const k = p.z > 0 ? 1 : -1;
      edgeOf((p.x - cx) * k, (p.y - cy) * k, rect, 28, edge);
      x = edge.x;
      y = edge.y;
      prop(b, '--a', Math.round(edge.angle * 1000), rad);
    }
    move(b, x, y);
    flag(b, 'data-off', off);
    if (r) prop(b, '--r', Math.round(r), px);
  };

  function place(r, f) {
    hud.writes = 0;
    if (!r) return;
    if (!els || els.root.el !== r) els = read(r);
    flag(els.root, 'data-static', f.static);
    const { reticle, lock, lead, nav } = f;
    const e = els;
    if (e.reticle) {
      flag(e.reticle, 'data-on', reticle.on);
      if (reticle.on) {
        move(e.reticle, reticle.x, reticle.y);
        flag(e.reticle, 'data-hot', reticle.hot);
        flag(e.reticle, 'data-hit', reticle.hit);
        flag(e.reticle, 'data-kill', reticle.kill);
      }
    }
    if (e.lock) {
      flag(e.lock, 'data-on', lock.on);
      if (lock.on) {
        mark(e.lock, lock, f.rect, lock.r);
        flag(e.lock, 'data-hot', lock.hot);
        text(e.lockName, lock.name);
        dist(e.lockDist, lock.dist, lock.text);
        if (lock.tough !== null) {
          flag(e.lock, 'data-tough', lock.tough);
          if (lock.tough) prop(e.lock, '--hp', Math.round(lock.hp * 1000), share);
        }
      }
    }
    if (f.threats) {
      for (let i = 0; i < e.threats.length; i++) {
        const on = i < f.threats.n;
        flag(e.threats[i], 'data-on', on);
        if (on) mark(e.threats[i], f.threats.at[i], f.rect);
      }
    }
    if (f.mates) {
      for (let i = 0; i < e.mates.length; i++) {
        const on = i < f.mates.n;
        flag(e.mates[i], 'data-on', on);
        if (on) {
          text(e.mates[i].name, f.mates.at[i].name);
          mark(e.mates[i], f.mates.at[i], f.rect);
        }
      }
    }
    if (e.lead) {
      flag(e.lead, 'data-on', lead.on);
      if (lead.on) {
        move(e.lead, lead.x, lead.y);
        flag(e.lead, 'data-hot', lead.hot);
      }
    }
    if (e.nav) {
      flag(e.nav, 'data-on', nav.on);
      if (nav.on) {
        mark(e.nav, nav, f.rect, nav.r);
        flag(e.nav, 'data-way', nav.way);
        text(e.navName, nav.name);
        dist(e.navDist, nav.dist, nav.text);
      }
    }
  }
  return hud;
}

