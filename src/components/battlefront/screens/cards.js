// What the game's screens here say and list, apart from their components
// (so each .jsx exports one component): the press-start line, the
// multiplayer screen's lists and the modes they hold, a mode's level cards,
// the in-game menu's items.

import { info, LEVEL_KEYS } from '../../../lib/bf2017/ui/info';
import { word } from '../../../lib/bf2017/ui/screens';
import { boxesOf } from './tree';

// the game's press-start line, its button named as the keyboard's
export const pressStart = () => word('#615832FF').replace(/%+OK%+/g, 'ENTER');

// the site's mode for one of the game's ('PlanetaryBattles' → 'galacticAssault')
export const SITE_MODE = { PlanetaryBattles: 'galacticAssault', SpaceBattle: 'starfighter', HeroesVersusVillains: 'hvv', Blast: 'blast', PlanetaryMissions: 'strike', Mode3: 'ewokHunt' };
export const SITE_LEVEL = Object.fromEntries(Object.entries(LEVEL_KEYS).map(([site, key]) => [key, site]));

// the multiplayer screen's lists → the mode each holds
export const MODE_LISTS = { LargeTilesList: 'PlanetaryBattles', StarfighterAssaultListElement: 'SpaceBattle', DominationListElement: 'PlanetaryMissions', BlastListElement: 'Blast', EwokHuntListElement: 'Mode3' };

export function levelCards(modeId, playable) {
  const mode = info('mode', modeId);
  return (mode?.levels ?? [])
    .map((id) => info('level', id, { mode: modeId }))
    .filter(Boolean)
    .map((l) => {
      const site = SITE_LEVEL[l.key];
      return { id: l.id, key: l.key, site, title: l.title, planet: info('planet', l.planet)?.title ?? l.planet, blurb: l.blurb, playable: Boolean(site && playable(site, SITE_MODE[modeId])) };
    });
}

// the in-game menu's items: the widgets in its MenuItemsContainer, each
// with its label (its first text), less the debug ones and those under the
// screen's foot (the game scrolls to them; this world has no use for them)
const LEFT_OUT = /DEBUG|SWITCH TEAM|RESTART/;
export const menuItems = (tree) =>
  boxesOf(tree)
    .filter((b) => /\/MenuItemsContainer\/[^/]+$/.test(b.id) && b.type === 'widget')
    .map((b) => ({ box: b, label: boxesOf({ boxes: [b] }).find((x) => x.type === 'text' && x.text)?.text ?? b.id.split('/').pop() }))
    .filter((i) => !LEFT_OUT.test(i.label) && i.box.y < (tree.size?.[1] ?? 1080));

// The front end's ways out. Alone, the main menu's HOME tab and its Escape
// both go back to the Start screen. Over a level's world (`onExit`) Escape is
// the way out of the world, HOME goes nowhere (it is the first tab and held
// the focus: Enter on arriving left the game and threw the loaded level
// away), and the focus starts on PLAY.
export const frontEndWays = ({ toStart, onExit = null }) => ({ home: onExit ? null : toStart, back: onExit ?? toStart, first: onExit ? '[data-link$="/PlayScreen"]' : null });
