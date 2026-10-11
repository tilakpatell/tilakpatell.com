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
