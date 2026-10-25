// Rick's portal gun, in C-137: what the HUD says about it. The gun itself is
// the dial (./dimensions/DimensionDial.jsx, the places in
// ./dimensions/destinations.js's DIAL), picked up at Rick's bench in the
// garage (E there) or from anywhere with P or the HUD's chip; the trip is
// always through the garage portal, which goes wherever it's set. Pure: the
// words, and which key is the gun's.

import { DIAL, portalTarget } from './dimensions/destinations';
import { inLine } from './planetMode';

// whether the gun wants dialling before the garage portal takes Morty to `area`,
// `dialled` where it's set (the dial's 'annex' is Blips and Chitz, its arcade
// inside it); false for anywhere the portal doesn't go
const dialFor = (area) => (area === 'arcade' || area === 'annex' ? 'annex' : DIAL.some((d) => d.id === area) ? area : null);
export const dialFirst = (area, dialled) => dialFor(area) != null && dialFor(area) !== dialled;

// the place the dial's set to, by name ('annex', or an old or unknown setting, is Blips and Chitz)
export const dialledName = (dial) => DIAL.find((d) => d.id === portalTarget(dial)).name;

// the garage portal's prompt, naming where it goes ('the Jerryboree', mid-sentence)
export const portalName = (dial) => `Through the portal to ${inLine(dialledName(dial))}`;

// what's said once it's dialled: where the portal is, if Morty isn't by it
export const dialledNote = (dial, area) => `Dialled to ${inLine(dialledName(dial))}. ${area === 'garage' ? 'Step through the portal.' : 'The portal’s on the west wall of Rick’s garage.'}`;

// P, pressed (not held, and not with Ctrl, Cmd or Alt): the gun
export const isGunKey = (e) => (e.code === 'KeyP' || (!e.code && (e.key === 'p' || e.key === 'P'))) && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey;

// the hint before Morty's first step: the keys (or the touch controls), and in C-137, the gun
export function firstHint({ touch = false, planet = false } = {}) {
  if (touch) return `Drag the stick to walk; push it all the way to run; the arrow jumps, the star fires in a fight. Swipe sideways to look round.${planet ? '' : ' The Portal gun button, up top, picks where Rick’s garage portal goes.'}`;
  return `W A S D or the arrows to walk, Shift to run, Space to jump. Click to look round, Esc to let go. E uses things, F fires in a fight, M lists what to do, hold B to emote.${planet ? '' : ' P is Rick’s portal gun.'}`;
}
