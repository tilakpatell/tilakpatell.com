// The world's HUD drawn (split out of ./InvWorld.jsx as a repair): its
// numbers and words each frame, the compass strip and the map, on the kit's
// canvases (runtime/hud).

import { COMPASS, fitCanvas, layoutCompass, objectiveText, titleMode } from '../../../runtime/hud';
import { FLY } from './flight';
import { PORTAL, portalOpen, standing } from './foes';
import { getawayAt } from './getaway';
import { CITY, COAST, BEACH, HILLS, RIVER, SUBURB, WORLD } from './map';
import { markerOf, missionOf } from './missions';
import { BODIES } from './orbit';
import { RINGS } from './quests';
import { WHAT, clock } from './events';

const MACH = 343;
// the objective line's words for who's about (./foes.js)
function foesText(f, up) {
  const flax = f.foes.filter((e) => (e.kind ?? 'flaxan').startsWith('flaxan') && e.state !== 'ko' && e.state !== 'down').length;
  const maulers = up.filter((e) => e.kind === 'mauler').length;
  const parts = [];
  if (flax || f.foes.some((e) => (e.kind ?? 'flaxan').startsWith('flaxan'))) parts.push(`Flaxans over the river · ${flax} left`);
  if (maulers) parts.push(maulers > 1 ? `The Mauler twins · ${maulers} standing` : 'A Mauler · 1 standing');
  if (up.some((e) => e.kind === 'seismic')) parts.push('Doc Seismic over the school');
  return parts.join(' · ');
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// The HUD's numbers each frame, straight into the DOM (no re-render a
// frame), the compass and the map; and where the mission's marker, gates and
// photo frame are for the scene to draw.
export function hudFrame(s, a, h, H, map, { speed, alt, inSpace, setChip }) {
  // the HUD, straight into the DOM (no re-render a frame)
  if (s.frame % 2 === 0) {
    if (H.speed) H.speed.textContent = String(Math.round(speed * 3.6));
    const far = (b) => Math.round((Math.hypot(h.p[0] - b.c[0], h.p[1] - b.c[1], h.p[2] - b.c[2]) - b.r) / 1000);
    if (H.mach) H.mach.textContent = inSpace ? (h.mode === 'perch' ? `On ${h.perch.body === 'moon' ? 'the Moon' : 'Mars'}` : BODIES.map((b) => `${b.id === 'moon' ? 'Moon' : 'Mars'} ${far(b)} km`).join(' · ')) : speed > 60 ? `Mach ${(speed / MACH).toFixed(2)}` : h.mode === 'ground' ? (speed > 5 ? 'Running' : speed > 0.5 ? 'Walking' : 'Standing') : speed < 1 ? 'Hovering' : 'Flying';
    if (H.alt) H.alt.textContent = alt > 20000 ? `${Math.round(alt / 1000)} km` : `${Math.max(0, Math.round(alt))} m`;
    // where he is, for the gauge: the streets, the sky over them, or out of the air
    const zoneName = inSpace ? 'Space' : alt > 300 ? 'Sky' : 'City';
    if (H.zone && H.zone.textContent !== zoneName) H.zone.textContent = zoneName;
    if (H.bar) H.bar.style.transform = `scaleX(${Math.min(1, inSpace ? Math.log10(1 + speed) / Math.log10(6001) : speed / FLY.top)})`;
    if (H.lines) H.lines.style.opacity = String(clamp((speed - 70) / 160, 0, 0.85));
    const marks = [];
    const q = s.quests;
    // the villains (./foes.js): the portal while it's open, and the ones on the ground
    const up = standing(s.foes);
    if (portalOpen(s.foes)) marks.push({ x: PORTAL.p[0], z: PORTAL.p[2], color: '#d04dff', name: 'Portal' });
    for (const e of up) if (e.kind === 'mauler' || e.kind === 'seismic') marks.push({ x: e.p[0], z: e.p[2], color: '#d04dff', name: e.kind === 'mauler' ? 'Mauler' : 'Doc Seismic' });
    if (q.rescue && !q.rescue.carried) marks.push({ x: q.rescue.p[0], z: q.rescue.p[2], color: '#ff3b30', name: 'Help' });
    if (q.lesson.on) marks.push({ x: RINGS[q.lesson.next].p[0], z: RINGS[q.lesson.next].p[2], color: '#ffd23a', name: `Ring ${q.lesson.next + 1}` });
    // the mission's marker (./missions.js markerOf): a point, or whatever's there now
    const m = s.mission ? missionOf(s.mission.id) : null;
    const stepDef = m?.steps[s.mission.step] ?? null;
    let mdist = null;
    if (stepDef) {
      const kind = stepDef.kind ?? stepDef.beat?.kind;
      const wanted = (e) => (Array.isArray(kind) ? kind.includes(e.kind ?? 'flaxan') : (e.kind ?? 'flaxan') === kind);
      const foes = up
        .filter(wanted)
        .sort((e1, e2) => Math.hypot(e1.p[0] - h.p[0], e1.p[2] - h.p[2]) - Math.hypot(e2.p[0] - h.p[0], e2.p[2] - h.p[2]))
        .map((e) => e.p);
      const moon = a.debug.bodies.find((b) => b.id === 'moon');
      const mk = markerOf(s.mission, { npcs: { omni: a.debug.dad().p, allen: a.debug.allen }, car: getawayAt(s.getaway), foes, faller: q.rescue && !q.rescue.carried ? q.rescue.p : null, bodies: { moon: moon?.c } });
      s.marker = mk ? { p: mk, color: m.colour } : null;
      if (mk) {
        mdist = Math.hypot(mk[0] - h.p[0], mk[1] - h.p[1], mk[2] - h.p[2]);
        if (!inSpace) marks.push({ x: mk[0], z: mk[2], color: m.colour, name: 'Mission' });
      }
      // the race's gates, and a photo's frame, for the scene to draw
      s.gates = stepDef.type === 'race' && !stepDef.ring ? { list: stepDef.gates, next: s.mission.count, r: stepDef.r } : null;
      s.photo = stepDef.type === 'use' && stepDef.id === 'photo' ? { p: stepDef.at, face: stepDef.face, r: stepDef.r } : null;
    } else {
      s.marker = null;
      s.gates = null;
      s.photo = null;
    }
    s.marks = marks;
    if (H.compass && H.compassBox && !inSpace) drawCompass(H.compass, H.compassBox, s.yaw, h, s.world.places, marks);
    if (H.goal) {
      // (in space, the city's distances mean nothing: he's a world away)
      const d = q.rescue ? Math.round(Math.hypot(q.rescue.p[0] - h.p[0], q.rescue.p[1] - h.p[1], q.rescue.p[2] - h.p[2])) : 0;
      const fightText = s.foes.on ? `${foesText(s.foes, up)} · you ${Math.max(0, Math.round(s.foes.hp))}%` : '';
      const rescueText = q.rescue && (q.rescue.carried ? (inSpace ? 'Set them down: back in the city' : 'Set them down: land anywhere') : `${WHAT[q.rescue.kind]} · ${inSpace ? 'down in the city' : `${d} m`}`);
      // (a mission's step first: its words, how far, the count, the hangar, the clock)
      let missionText = '';
      if (stepDef) {
        const p = s.mission;
        const parts = [objectiveText(stepDef, inSpace ? null : mdist)];
        const of = stepDef.n ?? stepDef.gates?.length ?? null;
        if (of) parts.push(`${p.count} of ${of}`);
        if (stepDef.beat) parts.push(`${stepDef.beat.name} ${Object.values(p.kos ?? {}).filter((k) => k.kind === stepDef.beat.kind).length >= stepDef.beat.n ? 'down' : 'still up'}`);
        if (stepDef.type === 'protect') parts.push(`hangar ${Math.max(0, Math.round(p.hp ?? 100))}% · ${Math.max(0, Math.ceil(stepDef.time - p.stepT))} s`);
        else if (stepDef.time != null) parts.push(`${Math.max(0, Math.ceil(stepDef.time - p.stepT))} s`);
        if (s.foes.on && stepDef.type === 'defeat') parts.push(`you ${Math.max(0, Math.round(s.foes.hp))}%`);
        missionText = parts.join(' · ');
      }
      const text = missionText || fightText || rescueText || (q.lesson.on ? `Dad’s rings · ${q.lesson.next + 1} of ${RINGS.length} · ${clock(q.lesson.t)}` : '');
      if (H.goal.textContent !== text) H.goal.textContent = text;
      H.goal.dataset.on = text ? '1' : '';
      H.goal.dataset.mission = missionText ? '1' : '';
      if (missionText) H.goal.style.setProperty('--mc', m.colour);
      H.goal.dataset.red = q.rescue && !s.foes.on && !missionText ? '1' : '';
      H.goal.dataset.purple = s.foes.on && !missionText ? '1' : '';
    }
    // the title goes to a chip 2.5 s after he first moves, or at once when there's something to do (./hud.js)
    if (!s.movedAt && (s.moved || speed > 2)) s.movedAt = s.t;
    if (!s.chip && titleMode(s.t, s.movedAt ?? null, Boolean(H.goal?.dataset.on)) === 'chip') {
      s.chip = true;
      setChip(true);
    }
  }
  if (s.frame % 4 === 0 && map && H.mapBox && !inSpace) drawMap(map, H.mapBox, h, s.yaw, alt, s.world, s.marks);
}

// ── the HUD's canvases (the kit's fitCanvas: sharp on a 2× screen): the
// compass drawn in CSS pixels, so its type is the size it says on a phone
// too, and the map in 180ths of its width, its look at any size ──
export function fitHud(H, map) {
  H.mapBox = fitCanvas(map, 180);
  const box = fitCanvas(H.compass);
  if (box) {
    // where the HUD's other things still sit over the strip (the title, the
    // goal): nothing of the compass is drawn there (by more than a sliver:
    // the title's box runs a little below its letters)
    const r = H.compass.getBoundingClientRect();
    box.block = [];
    for (const el of [H.tools, ...(H.brand?.children ?? [])]) {
      const b = el?.getBoundingClientRect();
      if (b?.width && Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top) > 6 && b.right > r.left && b.left < r.right) box.block.push([b.left - r.left - 6, b.right - r.left + 6]);
    }
  }
  H.compassBox = box;
}

// ── the compass: a strip of headings, the places marked on it ──
const DIRS = [
  [0, 'S'],
  [Math.PI / 2, 'E'],
  [Math.PI, 'N'],
  [-Math.PI / 2, 'W'],
];
function drawCompass(c, box, yaw, h, places, marks = []) {
  const x = c.getContext('2d');
  const { w: W, h: H } = box;
  const u = H / 60; // (laid out for a strip 60 high: names, headings, ticks, dots, a second row of names)
  x.setTransform(box.s, 0, 0, box.s, 0, 0);
  x.clearRect(0, 0, W, H);
  const span = COMPASS.span; // what the strip shows
  const at = (a) => W / 2 + (wrap(yaw - a) / span) * W; // (yaw grows to the left)
  x.font = `700 ${20 * u}px system-ui, sans-serif`;
  x.textAlign = 'center';
  x.fillStyle = 'rgba(255,255,255,0.9)';
  const headings = [];
  for (const [a, n] of DIRS) {
    const px = at(a);
    if (px < 10 * u || px > W - 10 * u) continue;
    x.fillText(n, px, 19 * u);
    headings.push(px);
  }
  x.fillStyle = 'rgba(255,255,255,0.35)';
  for (let k = 0; k < 24; k++) {
    const px = at((k / 24) * Math.PI * 2);
    if (px > 0 && px < W) x.fillRect(px - 0.5, 24 * u, 1, (k % 6 === 0 ? 8 : 5) * u);
  }
  // the places: a dot each
  const near = [];
  x.fillStyle = '#ffd23a';
  for (const p of places) {
    const a = Math.atan2(p.x - h.p[0], p.z - h.p[2]);
    const px = at(a);
    const d = Math.hypot(p.x - h.p[0], p.z - h.p[2]);
    if (px >= 8 * u && px <= W - 8 * u) {
      x.beginPath();
      x.arc(px, 36 * u, 4 * u, 0, Math.PI * 2);
      x.fill();
    }
    if (d < 1800) near.push({ id: p.id, label: p.name.replace(/^The /, ''), bearing: wrap(yaw - a), d });
  }
  // and the nearest's names, laid out by ./hud.js: clear of the headings
  // and of each other (a second row under the dots for the ones that would
  // touch), none under the buttons where they overlap the strip's end
  const end = box.block.filter(([, q]) => q >= W - 8).reduce((m, [p]) => Math.min(m, p), W);
  const laid = layoutCompass(near.sort((a, b) => a.d - b.d), W, { span, gap: COMPASS.gap, reserve: W - end, taken: headings });
  x.font = `600 ${14 * u}px system-ui, sans-serif`;
  for (const n of laid) {
    if (n.clipped) continue;
    const half = x.measureText(n.label).width / 2 + 3 * u;
    const lx = clamp(n.x, half, W - half);
    // (and not under anything else of the HUD's over the strip: the title, the goal)
    if (box.block.some(([p, q]) => lx + half > p && lx - half < q)) continue;
    x.fillText(n.label, lx, n.row === 0 ? 12 * u : 54 * u);
  }
  for (const m of marks) {
    const px = at(Math.atan2(m.x - h.p[0], m.z - h.p[2]));
    const cx = Math.max(10 * u, Math.min(W - 10 * u, px));
    x.fillStyle = m.color;
    x.beginPath();
    x.moveTo(cx, 26 * u);
    x.lineTo(cx + 7 * u, 40 * u);
    x.lineTo(cx - 7 * u, 40 * u);
    x.closePath();
    x.fill();
  }
  x.fillStyle = '#ffd23a';
  x.fillRect(W / 2 - u, 22 * u, 2 * u, 18 * u);
  for (const [p, q] of box.block) x.clearRect(p, 0, q - p, H);
}

// ── the map: north up, round him, further out the higher he is ──
let base = null;
function mapBase() {
  if (base) return base;
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const k = S / (WORLD.half * 2);
  const P = (v) => (v + WORLD.half) * k;
  x.fillStyle = '#3b4a2e';
  x.fillRect(0, 0, S, S);
  // the hills
  x.fillStyle = '#4a5236';
  x.fillRect(0, 0, S, P(HILLS));
  // the city's blocks, the suburbs, the water
  x.fillStyle = '#5b5d61';
  x.fillRect(P(CITY.x0), P(CITY.z0), (CITY.x1 - CITY.x0) * k, (CITY.z1 - CITY.z0) * k);
  x.fillStyle = '#4f6b3a';
  x.fillRect(P(SUBURB.x0), P(HILLS + 80), (SUBURB.x1 - SUBURB.x0) * k, (COAST - BEACH - HILLS - 120) * k);
  x.fillStyle = '#c9b98d';
  x.fillRect(0, P(COAST - BEACH), S, BEACH * k);
  x.fillStyle = '#21506a';
  x.fillRect(0, P(COAST - 20), S, S);
  x.fillRect(P(RIVER.x0), 0, (RIVER.x1 - RIVER.x0) * k, P(COAST));
  base = { c, k, P };
  return base;
}
function drawMap(c, box, h, yaw, alt, world, marks = []) {
  const x = c.getContext('2d');
  const W = box.w;
  x.setTransform(box.s, 0, 0, box.s, 0, 0);
  const b = mapBase();
  if (!b.towers) {
    // the towers and houses, once
    const bx = b.c.getContext('2d');
    bx.fillStyle = '#8b8d92';
    for (const t of world.buildings) bx.fillRect(b.P(t.x - t.w / 2), b.P(t.z - t.d / 2), Math.max(1, t.w * b.k), Math.max(1, t.d * b.k));
    bx.fillStyle = '#a99a84';
    for (const t of world.houses) bx.fillRect(b.P(t.x - t.w / 2), b.P(t.z - t.d / 2), Math.max(1, t.w * b.k), Math.max(1, t.d * b.k));
    b.towers = true;
  }
  const span = clamp(500 + alt * 1.6, 500, WORLD.half * 2); // metres across
  const px = span * b.k;
  x.save();
  x.clearRect(0, 0, W, W);
  x.beginPath();
  x.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
  x.clip();
  x.drawImage(b.c, b.P(h.p[0]) - px / 2, b.P(h.p[2]) - px / 2, px, px, 0, 0, W, W);
  // the places
  for (const p of world.places) {
    const mx = W / 2 + ((p.x - h.p[0]) / span) * W;
    const my = W / 2 + ((p.z - h.p[2]) / span) * W;
    const r = Math.hypot(mx - W / 2, my - W / 2);
    const q = r > W / 2 - 10 ? (W / 2 - 10) / r : 1;
    x.fillStyle = '#ffd23a';
    x.strokeStyle = '#0e1a33';
    x.lineWidth = 2;
    x.beginPath();
    x.arc(W / 2 + (mx - W / 2) * q, W / 2 + (my - W / 2) * q, 5, 0, Math.PI * 2);
    x.fill();
    x.stroke();
  }
  for (const m of marks) {
    const mx = W / 2 + ((m.x - h.p[0]) / span) * W;
    const my = W / 2 + ((m.z - h.p[2]) / span) * W;
    const r = Math.hypot(mx - W / 2, my - W / 2);
    const q = r > W / 2 - 10 ? (W / 2 - 10) / r : 1;
    x.fillStyle = m.color;
    x.strokeStyle = '#000';
    x.lineWidth = 2;
    x.beginPath();
    x.arc(W / 2 + (mx - W / 2) * q, W / 2 + (my - W / 2) * q, 6, 0, Math.PI * 2);
    x.fill();
    x.stroke();
  }
  // him, pointing where he's looking
  x.translate(W / 2, W / 2);
  x.rotate(-yaw + Math.PI);
  x.fillStyle = '#5fc8ff';
  x.strokeStyle = '#08121f';
  x.beginPath();
  x.moveTo(0, -9);
  x.lineTo(6, 7);
  x.lineTo(0, 3);
  x.lineTo(-6, 7);
  x.closePath();
  x.fill();
  x.stroke();
  x.restore();
  x.strokeStyle = 'rgba(255,210,58,0.6)';
  x.lineWidth = 2;
  x.beginPath();
  x.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
  x.stroke();
}

