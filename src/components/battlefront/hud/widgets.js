// The game's HUD widgets (ui.json, flattened by lane 0 from UI/InGame/**)
// placed on the page and filled from the sim's view. Pure (three's math
// only, for the markers' projection).
//
//   REF                                  the game's reference screen, 1920 × 1080
//   placeWidget({ anchor, size, offset }, { w, h }) → { x, y, w, h }
//   meterThirds(meter) → [0 | 1, 0 | 1, 0 | 1]: the capture meter's thirds lit
//   heatColour(heat, warning, { normal, warning }) → colour
//   offerRows(offers, points) → the deploy screen's rows in order, each `affordable`
//   markerProjection(at, camera, { w, h }) → { x, y, onScreen, edgeAngle }
//   teamColour(team, mine, palette) → '#rrggbb'
//   squadListRows(squad, { option }) → the squad list's rows (SquadMemberListCell's colours, the option's names)
//   offerNameOf(rb, offer) → the spawn screen's name for an offer, in the game's capitals
//   referenceScale(w, h) → the HUD's scale: the viewport's shorter side over the reference's 1080
//   radarPoint(me, at, { range, radius }) → [x, y] on the radar's disc (ahead is up), and `inside`
//   markerScale(dist) → 1 at 10 m to 0.5 at 200 m (DefaultInworldMarkerScalingStyle)
//   heatCells(heat, warning, cells) → each cell 'off' | 'on' | 'warn' (WeaponHeatProgress's sections)
//   killLogRows(entries, now, { rows, shown }) → the rows still shown (KillLogWidget: 10 rows, 5 s)
//   killMessageOf(entries, now, { mine, shown }) → the player's latest kill within 5 s (KillMessage), or null
//   crosshairKind(cls) → which of the game's crosshair screens a class's gun gets

import { Vector3 } from 'three';
import { colour } from '../../../lib/bf2017/ui/index.js';
import { loadRulebook, squadsOf, stringOf } from '../../../lib/battlefront/rulebook.js';
import { CLASS_ICON, iconSrc } from './icons.js';

export const REF = [1920, 1080];
const THIRDS = [0, 1 / 3, 2 / 3];
const KIND_ORDER = { class: 0, reinforcement: 1, vehicle: 2, hero: 3 };
// (the game's palette slots for friend and foe: ui.json's palette, 13 the blue, 12 the red)
export const FRIEND = 13;
export const FOE = 12;
export const MARGIN = 32; // px a marker off screen keeps from the edge

// The widget's anchor is a share of the screen it hangs from and the share
// of itself it hangs by (the game's anchor is both), its size and offset in
// the reference's pixels, scaled by the viewport's shorter side against the
// reference's
export function placeWidget({ anchor = [0, 0], size = [0, 0], offset = [0, 0] }, { w, h }) {
  const s = Math.min(w, h) / Math.min(REF[0], REF[1]);
  const bw = size[0] * s;
  const bh = size[1] * s;
  return { x: anchor[0] * (w - bw) + offset[0] * s, y: anchor[1] * (h - bh) + offset[1] * s, w: bw, h: bh };
}

export const meterThirds = (meter) => THIRDS.map((t) => (Math.abs(meter) > t + 1e-9 || (t === 0 && Math.abs(meter) > 0) ? 1 : 0));

export const heatColour = (heat, warning, colours) => (heat >= warning ? colours.warning : colours.normal);

export function offerRows(offers, points) {
  const order = (o) => KIND_ORDER[o.kind] ?? 9;
  return offers
    .map((o, i) => [o, i])
    .sort(([a, i], [b, j]) => order(a) - order(b) || i - j)
    .map(([o]) => ({ ...o, affordable: o.available !== false && (o.cost ?? 0) <= points }));
}

const v = new Vector3();
const local = new Vector3();
export function markerProjection(at, camera, { w, h }) {
  v.set(at[0], at[1], at[2]);
  local.copy(v).applyMatrix4(camera.matrixWorldInverse);
  const behind = local.z > 0;
  v.project(camera);
  let nx = v.x;
  let ny = v.y;
  if (behind) {
    nx = -nx;
    ny = -ny;
  }
  const onScreen = !behind && nx >= -1 && nx <= 1 && ny >= -1 && ny <= 1;
  const x = ((nx + 1) / 2) * w;
  const y = ((1 - ny) / 2) * h;
  if (onScreen) return { x, y, onScreen, edgeAngle: null };
  // (off screen: on the edge, the way the camera would turn to it)
  const angle = Math.atan2(-(behind ? local.y : ny), behind ? local.x || -1e-6 : nx);
  const cx = w / 2;
  const cy = h / 2;
  const k = Math.min((cx - MARGIN) / Math.abs(Math.cos(angle) || 1e-6), (cy - MARGIN) / Math.abs(Math.sin(angle) || 1e-6));
  return { x: cx + Math.cos(angle) * k, y: cy + Math.sin(angle) * k, onScreen, edgeAngle: angle };
}

const hex = (c) => `#${c.map((x) => Math.round(Math.min(1, Math.max(0, x)) ** (1 / 2.2) * 255).toString(16).padStart(2, '0')).join('')}`;
export const teamColour = (team, mine, palette) => hex(palette[team === mine ? FRIEND : FOE] ?? [1, 1, 1]);

// The squad list's rows: the player (SquadMemberListLocalPlayer's picks), then
// up to the list's MaxRows mates (SquadMemberListCell's: grey when down, else
// orange; green is for a real party, which offline nobody is); the option
// 'NoOutline' leaves the icons, 'Off' nothing (OptionHUDSquadListVisibility).
export function squadListRows(squad, { option = 'Default', hud = squadsOf(loadRulebook()).hud } = {}) {
  if (!squad || option === 'Off') return [];
  const p = hud.palette;
  const local = squad.members.filter((m) => m.local).slice(0, 1);
  const mates = squad.members.filter((m) => !m.local).slice(0, hud.maxRows);
  return [...local, ...mates].map((m) => {
    const dead = !m.alive;
    return {
      id: m.id,
      name: m.name,
      local: m.local,
      dead,
      nameColour: colour(m.local ? p.local : dead ? p.dead : p.other),
      iconColour: colour(m.local ? p.localIcon : dead ? p.iconDead : p.icon),
      icon: iconSrc(CLASS_ICON[m.cls] ?? CLASS_ICON.assault),
      letter: m.order ?? null,
      turn: Boolean(m.order),
      showName: option !== 'NoOutline',
    };
  });
}

// The spawn screen's name for an offer, as the game's screen writes it (in
// capitals, SpawnOverlayScreen's cells): a class by its string; a hero by
// its row's string, or the string the row leaves out (the export's heroes
// rows name no string for Boba Fett, Han Solo, Obi-Wan and Anakin; the
// first three are in the strings table under other keys); a reinforcement
// by hand (the export's strings carry no ID_C_* row for the six: source
// hand, the game's own words for them), else its id spaced at its capitals.
const CLASS_NAMES = { assault: 'ID_C_ASSAULT_TROOPER', heavy: 'ID_C_HEAVY_TROOPER', officer: 'ID_C_OFFICER', specialist: 'ID_C_SPECIALIST' };
const HERO_NAMES = { bobafett: 'ID_CHAR_BOBA_FETT', hansolo: 'ID_CHAR_HAN_SOLO', obiwan: 'ID_H_OBIWAN_NAME' };
const HAND_NAMES = { anakin: 'Anakin Skywalker', WookieWarrior: 'Wookiee Warrior', RebelJumpTrooper: 'Rebel Jump Trooper', EwokRebel: 'Ewok Hunter', DeathTrooper: 'Death Trooper', JumpTrooper: 'Jump Trooper', ISBAgent: 'ISB Agent' };
export function offerNameOf(rb, o) {
  const said = (key) => (key && rb.strings[key] !== undefined ? stringOf(rb, key) : null);
  let name = null;
  if (o.kind === 'class') name = said(CLASS_NAMES[o.cls]) ?? said(CLASS_NAMES[String(o.id).split('-').pop()]) ?? String(o.cls ?? o.id);
  else if (o.kind === 'hero') name = said(rb.heroes[o.id]?.name) ?? said(HERO_NAMES[o.id]) ?? HAND_NAMES[o.id] ?? String(o.id);
  else name = HAND_NAMES[o.id] ?? String(o.id).replace(/([a-z])([A-Z])/g, '$1 $2');
  return name.toUpperCase();
}

// The HUD's scale on a viewport: the game lays its widgets out on 1920 ×
// 1080 and scales them by the shorter side (SplitScreenScaling), so a
// 1080-tall window draws them at 1
export const referenceScale = (w, h) => Math.min(w, h) / REF[1];

// The radar (RadarWidget): every element's MaxRange is 50 m to the disc's
// rim, the player at the middle facing up (the export's +Z turned by yaw
// is ahead). `radius` is the disc's in whatever unit the caller draws in.
export const RADAR_RANGE = 50; // m (RadarIconElementData.MaxRange, RadarGridElementData.MaxRange)
export const RADAR_GRID = 20; // m a grid square (RadarGridElementData.SquareSize)
export function radarPoint(me, at, { range = RADAR_RANGE, radius = 100 } = {}) {
  const dx = at[0] - me.at[0];
  const dz = at[2] - me.at[2];
  const c = Math.cos(me.yaw);
  const s = Math.sin(me.yaw);
  const ahead = dx * s + dz * c;
  const right = -dx * c + dz * s;
  const k = radius / range;
  const x = right * k;
  const y = -ahead * k;
  const d = Math.hypot(x, y);
  return { x, y, inside: d <= radius, d };
}

// An in-world marker's size by its distance (DefaultInworldMarkerScalingStyle:
// MaxScale 1 to MinScaleDistance 10 m, MinScale 0.5 from MaxScaleDistance 200 m)
export const MARKER_SCALE = { max: 1, min: 0.5, near: 10, far: 200 };
export function markerScale(dist) {
  const { max, min, near, far } = MARKER_SCALE;
  if (dist <= near) return max;
  if (dist >= far) return min;
  return max + ((dist - near) / (far - near)) * (min - max);
}

// The heat bar's cells (WeaponHeatProgress: 256 wide in sections of 8, so
// 32): lit to the heat, in the alarm colour past the weapon's warning
// (WeaponHeatSectionsBG's BGAlarm, palette 12)
export const HEAT_CELLS = 32;
export function heatCells(heat, warning = 0.75, cells = HEAT_CELLS) {
  const lit = Math.round(Math.min(1, Math.max(0, heat)) * cells);
  const warn = heat >= warning;
  return Array.from({ length: cells }, (_, i) => (i < lit ? (warn ? 'warn' : 'on') : 'off'));
}

// The kill log's rows (KillLogWidget: Rows 10, DisplayTime 5 s): the latest
// first in the game (the stack is reversed, top-down), each gone 5 s after
// it came; an entry without a time stays (lane 5's log carried none)
export const KILL_LOG_ROWS = 10;
export const KILL_LOG_SHOWN = 5; // s
export function killLogRows(entries, now, { rows = KILL_LOG_ROWS, shown = KILL_LOG_SHOWN } = {}) {
  return entries.filter((e) => e.t == null || now - e.t < shown).slice(-rows);
}

// The kill message (KillMessage, 5 s at the middle of the screen): the
// player's own latest kill
export function killMessageOf(entries, now, { mine = 'You', shown = KILL_LOG_SHOWN } = {}) {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.killer !== mine) continue;
    return e.t == null || now - e.t < shown ? e : null;
  }
  return null;
}

// Which crosshair screen a class's gun gets (UI/InGame/Hud/Weapons/Screens:
// the blaster rifles' for the assault, the heavy blasters' for the heavy,
// the pistol's for the officer; the specialist's long-range rifle is the
// default dot until it is scoped). The weapon rows name no HUD screen
// (lane 0 left it out), so the class stands for its gun: source hand. The
// class comes as its kind ('assault') or its row's id ('d-orig-assault').
export const classKind = (cls) => String(cls ?? '').split('-').pop();
export const crosshairKind = (cls) => ({ assault: 'rifle', heavy: 'heavy', officer: 'pistol' })[classKind(cls)] ?? 'default';
