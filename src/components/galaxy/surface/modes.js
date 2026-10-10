// What you can play on a world, as Battlefront's front end offers it once
// you've landed (the flow design's decision 1): Galactic Assault, Starfighter
// Assault, Heroes vs Villains, Blast, the world's story, free roam. The game's
// levels say which modes each world has (src/data/bf2017/modes.json, the
// extractor's `modes`); the site's own missions say which it runs here now.
// Pure data, tested in Node; ModeMenu.jsx draws it, pages/GalaxySurface.jsx
// and GalaxyMission.jsx follow it.
//
//   MODES                        the cards, in order: { id, name, about, icon }
//   STARFIGHTER                  system → where its Starfighter Assault is flown (the starfighter lane's rows)
//   BATTLEFRONT                  system → the Battlefront game's own route for its Galactic Assault, once it has one
//   modesFor(system, ctx)        → [{ ...MODES row, state: 'live' | 'soon' | 'none', why, to, options? }]
//   missionForMode(system, mode, missions) → the mission id the surface runs for it (null: free roam)
//   liveLine(system, ctx)        the names of what's live there, in a line (the Land button's)
//   MODE_ASK_KEY, readAsk(raw)   whether the menu asks on landing ('ask' | 'never')

import BOOK from '../../../data/bf2017/modes.json';
import { MISSIONS } from './missions';
import { systemById } from '../systems';
import { STARFIGHTER as FLOWN } from './missions/starfighterMaps';

const ICONS = '/battlefront/icons/UI/SVG';
const name = (id, own) => BOOK.names?.modes?.[id]?.text ?? own;

export const MODES = [
  { id: 'galacticAssault', name: name('galacticAssault', 'Galactic Assault'), about: 'The big battle: attackers push objective by objective, defenders hold each as long as they can.', icon: `${ICONS}/InGame/GameMode/GameMode_Attack_AT-TE.svg` },
  { id: 'starfighter', name: name('starfighter', 'Starfighter Assault'), about: 'Up in the fighters over the world, for the capital ships and what they guard.', icon: `${ICONS}/Classes/Class_Vehicle_Interceptor.svg` },
  { id: 'hvv', name: name('hvv', 'Heroes vs Villains'), about: 'Four heroes against four villains, each side guarding its target.', icon: `${ICONS}/Classes/Hero_Icon_01.svg` },
  { id: 'blast', name: name('blast', 'Blast'), about: 'Ten troopers a side, no objectives: first to a hundred eliminations.', icon: `${ICONS}/Classes/Class_Troopers_Assault_01.svg` },
  { id: 'story', name: 'Story', about: 'This world’s own missions, from the films.', icon: `${ICONS}/InGame/GameMode/GameMode_Soldier.svg` },
  { id: 'free', name: 'Free roam', about: 'The world as it is: walk, ride, talk and find things.', icon: `${ICONS}/Classes/Class_Vehicle_Speeder.svg` },
];
const BY_ID = Object.fromEntries(MODES.map((m) => [m.id, m]));

// (where a world's Starfighter Assault is flown: lane A's maps; and the
// Battlefront game's own route for a Galactic Assault, flipped here alone
// when lane 5's lands)
export const STARFIGHTER = Object.fromEntries(Object.keys(FLOWN).map((sys) => [sys, `/galaxy/${sys}?battle=starfighter`]));
export const BATTLEFRONT = {};

// a mission's kind → the mode it is
const KIND_MODE = { assault: 'galacticAssault', hvv: 'hvv', blast: 'blast', chase: 'story', quest: 'story' };
const missionsOf = (system, missions = MISSIONS) => Object.values(missions[system] ?? {});
const ofMode = (system, mode, missions) => missionsOf(system, missions).filter((m) => KIND_MODE[m.kind] === mode);

export function missionForMode(system, mode, missions = MISSIONS) {
  if (!mode || mode === 'free' || !BY_ID[mode]) return null;
  return ofMode(system, mode, missions)[0]?.id ?? null;
}

const surface = (system, q) => `/galaxy/${system}/surface?${q}`;

export function modesFor(system, { missions = MISSIONS, book = BOOK, starfighter = STARFIGHTER, battlefront = BATTLEFRONT } = {}) {
  const game = book.worlds?.[system]?.modes ?? [];
  const place = book.names?.worlds?.[system]?.text ?? systemById(system)?.name ?? 'this world';
  const brief = systemById(system)?.game ?? null;
  return MODES.map((m) => {
    const card = { ...m, state: 'none', why: null, to: null };
    if (m.id === 'free') return { ...card, state: 'live', to: surface(system, 'mode=free') };
    if (m.id === 'story') {
      const options = ofMode(system, 'story', missions).map((x) => ({ id: x.id, name: x.name, to: surface(system, `mission=${x.id}`) }));
      // (a world whose story is played elsewhere: the Death Star's trench run)
      if (!options.length && brief?.status === 'live' && brief.to && !brief.to.includes('/surface')) options.push({ id: brief.id, name: brief.title, to: brief.to });
      return options.length ? { ...card, state: 'live', to: options[0].to, options } : { ...card, why: 'No story mission on this world yet.' };
    }
    if (m.id === 'starfighter' && starfighter[system]) return { ...card, state: 'live', to: starfighter[system] };
    if (m.id === 'galacticAssault' && battlefront[system]) return { ...card, state: 'live', to: battlefront[system] };
    const here = ofMode(system, m.id, missions)[0];
    if (here) return { ...card, state: 'live', to: surface(system, `mode=${m.id}`), mission: here.id };
    if (game.includes(m.id)) return { ...card, state: 'soon', why: `The game fights it on ${place}; the site’s map of it isn’t made yet.` };
    return { ...card, why: m.id === 'starfighter' ? 'The game has no space battle over this world.' : `The game has no ${m.name} on this world.` };
  });
}

export const liveLine = (system, ctx) =>
  modesFor(system, ctx)
    .filter((c) => c.state === 'live' && c.id !== 'free')
    .map((c) => c.name)
    .join(' · ');

export const MODE_ASK_KEY = 'tp-galaxy-mode-ask';
export const readAsk = (raw) => (raw === 'never' ? 'never' : 'ask');
