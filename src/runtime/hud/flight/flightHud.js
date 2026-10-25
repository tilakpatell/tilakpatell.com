// The flight HUD's writer: frame.js's record put into the overlay's markup
// (FlightHud.jsx's FlightOverlay, the classes both maps drew), each frame by
// the map's frame loop. Each value is written only when it has changed,
// numbers compared before any string is made, so a frame that changes
// nothing writes nothing and makes nothing; `writes` counts this frame's.
// A part whose record is null (the arrows, on foot; the altitude or the
// wanted strip a map doesn't fill) is left as it was, but the target's card:
// null there is no target.
//
// The cluster's parts (FlightHud.jsx's, beside the overlay: under its
// parent) are written too: the kit's vitals and arms by the kit's own
// writer (runtime/hud/cluster.js), then, while the cluster shows, the speed,
// the kills and the target's card as the galaxy's cluster wrote them; the
// altitude and the wanted strip as the universe map wrote them; and the
// radar drawn on a tick's points.
//
//   createFlightHud({ distText, draw = drawRadar }) → { place(root, frame), writes }
//     root: the overlay's .universe-hud element, or null (nothing is written)
//     distText(d): a distance in the map's unit, for the lock, the nav and the card
//     draw(canvas, points, { range, dpr }): the radar's picture (radarDraw.js)

import { edgeOf, onScreen } from '../../../lib/combat/flight/targeting.js';
import { createFlightCluster } from '../cluster.js';
import { drawRadar } from './radarDraw.js';

export function createFlightHud({ distText, draw = drawRadar }) {
  let els = null;
  const kit = createFlightCluster();
  const radarOpts = { range: 0, dpr: 1 }; // (the radar's options, one record)
  const edge = { x: 0, y: 0, angle: 0 };
  // an element and the last of each thing written to it
  const box = (el) => (el ? { el, last: {} } : null);
  const read = (r) => {
    const q = (c) => box(r.querySelector(c));
    const all = (c) => [...r.querySelectorAll(c)].map(box);
    const mates = all('.universe-mate');
    for (const m of mates) m.name = box(m.el.firstChild);
    // (the cluster's parts, beside the overlay)
    const map = r.parentElement ?? null;
    const p = (c) => box(map?.querySelector(c) ?? null);
    const cluster = map?.querySelector('.hud-cluster') ?? null;
    const stars = map ? [...map.querySelectorAll('.universe-wanted-stars i')].map(box) : [];
    return {
      root: box(r),
      reticle: q('.universe-reticle'),
      lock: q('.universe-lock'),
      lockName: q('.universe-lock-name'),
      lockDist: q('.universe-lock-dist'),
      lead: q('.universe-lead'),
      nav: q('.universe-nav'),
      navName: q('.universe-nav-name'),
      navDist: q('.universe-nav-dist'),
      threats: all('.universe-threat'),
      mates,
      cluster,
      speed: p('.fc-speed'),
      speedN: p('.fc-speed-n'),
      kills: p('.fc-kills-n'),
      target: p('.fc-target'),
      tName: p('.fc-target-name'),
      tDist: p('.fc-target-dist'),
      tHp: p('.fc-target-hp'),
      alt: p('.universe-alt'),
      wanted: p('.universe-wanted'),
      wantedWord: p('.universe-wanted-word'),
      wantedBounty: p('.universe-wanted-bounty'),
      stars,
      radar: map?.querySelector('.fc-radar') ?? null,
    };
  };
  const hud = { writes: 0, place };
  // (the ship's parts of the cluster go on foot and come back as new ones: a
  // part the record has for them that's missing or gone from the page, and
  // they're all looked for again)
  const lost = (b) => !b || b.el.isConnected === false;
  const gone = (e, f) => (f.speed && (lost(e.speed) || lost(e.speedN))) || (f.radar && (!e.radar || e.radar.isConnected === false));
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
  // a number, compared as written: k a whole number standing for what's shown
  const put = (b, key, k, write) => {
    if (b && !same(b, key, k)) write(b.el, k);
  };
  const str = (el, k) => (el.textContent = String(k));
  const fiftieths = (el, k) => el.style.setProperty('--v', String(k / 50));
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
    if (!els || els.root.el !== r || gone(els, f)) els = read(r);
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
    placeCluster(e, f);
  }

  // the parts round the overlay
  function placeCluster(e, f) {
    if (f.cluster) kit.place(e.cluster, f.cluster);
    if (f.cluster?.on) {
      const sp = f.speed;
      if (sp) {
        const k = sp.top > 0 ? Math.min(1, Math.abs(sp.v) / sp.top) : 0;
        put(e.speed, 'sp', Math.round(k * 50), fiftieths);
        flag(e.speed, 'data-boost', Boolean(sp.boosting));
        put(e.speedN, 'spn', Math.round(Math.abs(sp.v) * 10), (el, k) => (el.textContent = `SPD ${k}`));
      }
      if (f.kills !== null && f.kills !== undefined) put(e.kills, 'kills', f.kills, str);
      const t = f.target;
      flag(e.target, 'data-on', Boolean(t));
      if (t) {
        text(e.tName, t.name);
        if (e.tDist && !same(e.tDist, 'td', distText(t.dist))) e.tDist.el.textContent = e.tDist.last.td;
        const tough = t.hp !== null && t.hp !== undefined;
        flag(e.tHp, 'data-on', tough);
        if (tough) put(e.tHp, 'thp', Math.round(t.hp * 50), fiftieths);
      }
    }
    const a = f.alt;
    if (a && e.alt) {
      flag(e.alt, 'data-on', a.on);
      if (a.on) {
        prop(e.alt, '--alt', Math.round(a.alt * 1000), share);
        flag(e.alt, 'data-moving', a.moving);
      }
    }
    const w = f.wanted;
    if (w && e.wanted) {
      flag(e.wanted, 'data-on', w.on);
      flag(e.wanted, 'data-search', w.search);
      for (let i = 0; i < e.stars.length; i++) flag(e.stars[i], 'data-lit', i < w.stars);
      text(e.wantedWord, w.word);
      put(e.wantedBounty, 'bounty', w.bounty, (el, k) => (el.textContent = k ? `${k} ¢` : ''));
    }
    const rd = f.radar;
    if (rd && e.radar) {
      radarOpts.range = rd.range;
      radarOpts.dpr = rd.dpr;
      draw(e.radar, rd.points, radarOpts);
      hud.writes++;
    }
  }
  return hud;
}

