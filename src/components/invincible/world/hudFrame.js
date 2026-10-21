// The HUD's numbers and words, written straight into the elements
// InvWorld.jsx holds (no React state a frame): the gauge, the zone, the
// compass's marks, the mission's marker and the objective line. Moved from
// InvWorld.jsx's frame loop as it was, so that file stays under the size
// rule; nothing shown changed.
import { nearestLost, toWorld as marsWorld } from './offworld/mars';
import { objectiveText } from '../../../runtime/hud';
import { FLY } from './flight';
import { PORTAL, portalOpen, standing } from './foes';
import { getawayAt } from './getaway';
import { drawCompass } from './hudCanvas';
import { markerOf, missionOf } from './missions';
import { BODIES } from './orbit';
import { RINGS } from './quests';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
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

export const clock = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
export const WHAT = { fall: 'Someone’s slipping off a roof', heli: 'A news helicopter’s lost its tail rotor' };

// (`a` is the scene's api, `h` the hero, `alt` his height over what's under him)
export function writeHud(H, { s, h, a, speed, alt, inSpace }) {
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
  // Robot's mark (./guardians.js): the strongest foe standing, for the team to go for
  if (s.cavalry?.marked != null) for (const e of up) if (e.id === s.cavalry.marked) marks.push({ x: e.p[0], z: e.p[2], color: '#4fa3b8', name: 'Marked' });
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
    const mk = markerOf(s.mission, { npcs: { omni: a.debug.dad().p, allen: a.debug.allen, astro: s.mars ? nearestLost(s.mars, h.p) : null, host: s.mars ? marsWorld(s.mars.host.p) : null }, car: getawayAt(s.getaway), foes, faller: q.rescue && !q.rescue.carried ? q.rescue.p : null, bodies: { moon: moon?.c } });
    s.marker = mk ? { p: mk, color: m.colour } : null;
    if (mk) {
      mdist = Math.hypot(mk[0] - h.p[0], mk[1] - h.p[1], mk[2] - h.p[2]);
      if (!inSpace) marks.push({ x: mk[0], z: mk[2], color: m.colour, name: 'Mission' });
    }
    // the race's gates, and a photo's frame, for the scene to draw
    s.gates = stepDef.type === 'race' && !stepDef.ring ? { list: stepDef.gates, next: s.mission.count, r: stepDef.r } : stepDef.type === 'through' && stepDef.portal ? { list: [stepDef.at], next: 0, r: stepDef.r, color: m.colour } : null;
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
}
