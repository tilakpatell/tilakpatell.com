// Starfighter Assault's panel, as the game lays it out (the sixth design's
// lane fighters, task 6): the mode's objective panel is the game's widget
// tree `HUD_ObjectivesScreen_SpaceBattles_GameModePanel` (lane 0's ui.json:
// a 1,200 px game-mode panel at the top of the 1,920 × 1,080 screen, the
// remaining-objectives bar `HUD_ObjectivesScreen_AttackBar_V03` 38 px down
// in it, 176 × 40 with its dots under it, the phase's words in
// `GameModeTextWidget` 98 px down, 18 px Univers condensed in the palette's
// colour 54), placed for the viewport by lib/bf2017/ui's placeWidget, its
// words the game's own (the mode's string family, `spacebattles`), and your
// kit's abilities the game's icons (its `spacebattles` sprite). Pure.
//
//   panelOf(info, { viewport, strings, kit }) → { box, bar, dots, text, phase, abilities, downed } | null
//   abilityIcon(id) → the sprite's id for an ability record (`Ability_WeaponOvercharge` → `spacebattles-ability-icons-ability-weapon-overcharge`)

import { ICONS } from '../../../../lib/bf2017/icons';
import { colour, fontFor, placeWidget, widget } from '../../../../lib/bf2017/ui';

// the game's icon names by their sprite ids (lib/bf2017/icons.js keys them by the game's name)
const BY_SPRITE = new Map(Object.entries(ICONS).map(([name, [, id]]) => [id, name]));

const PANEL = 'HUD_ObjectivesScreen_SpaceBattles_GameModePanel';
const SCREEN = 'HUD_ObjectivesScreen_SpaceBattles_V05';

// a child's box inside its parent's, as placeWidget places a top-level one in the viewport
function placeIn(el, parent, k) {
  const [ax, ay] = el.anchor ?? [0, 0];
  const [w, h] = (el.size ?? [0, 0]).map((v) => v * k);
  const [ox, oy] = (el.offset ?? [0, 0]).map((v) => v * k);
  return { x: parent.x + ax * parent.w - ax * w + ox, y: parent.y + ay * parent.h - ay * h + oy, w, h };
}

const find = (nodes, name) => {
  for (const n of nodes ?? []) {
    if (n.name === name) return n;
    const hit = find(n.children, name);
    if (hit) return hit;
  }
  return null;
};

// the panel's boxes for a viewport, from the game's tree (the attacker's bar, or the defender's)
export function layoutOf(viewport, { attacking = true, tree = widget(PANEL), screen = widget(SCREEN) } = {}) {
  if (!tree) return null;
  const k = Math.min(viewport.width, viewport.height) / 1080;
  const panel = find(tree.children, 'Game Mode Panel');
  const box = placeWidget(panel, viewport);
  const mode = find(panel.children, 'GameModeWidget');
  const modeBox = placeIn(mode, box, k);
  const attack = find(mode.children, attacking ? 'Attack Objective Bar' : 'Defend Objective Bar');
  const barBox = placeIn(attack, modeBox, k);
  const fill = find(attack.children, 'BG_fill');
  const fillBox = placeIn(fill, barBox, k);
  const dots = find(attack.children, 'Objective Dot List Entity');
  const dotsBox = placeIn(dots, barBox, k);
  const health = find(attack.children, 'Phase Health Text');
  // (the phase's words: the objectives screen's own panel, over the same top of the screen)
  const outer = screen ? find(screen.children, 'Game Mode Panel') : null;
  const small = outer ? find(outer.children, 'SmallObjectiveTextWidget') : null;
  const words = small ? find(small.children, 'Game Mode Text') : null;
  const outerBox = outer ? placeWidget(outer, viewport) : box;
  return {
    box,
    bar: fillBox,
    dots: dotsBox,
    health: placeIn(health, barBox, k),
    healthFont: fontFor(health.font),
    text: small ? { ...placeIn(small, outerBox, k), font: fontFor(words?.font), colour: colour(words?.palette ?? 54) } : null,
    k,
  };
}

// an ability record's icon in the game's sprite
export function abilityIcon(id) {
  const tail = String(id)
    .replace(/^(VehicleWeaponAbility_|Ability_)/, '')
    .replace(/_(Normal|Base)$/, '');
  const kebab = tail
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
  // (the sprite names the heat sink in one word)
  return `spacebattles-ability-icons-ability-${kebab === 'heat-sink' ? 'heatsink' : kebab}`;
}

export function panelOf(info, { viewport, strings = {}, kit = null, tree, screen } = {}) {
  if (info?.laid?.kind !== 'starfighter' || !info.stage) return null;
  const attacking = info.team === null || info.team === undefined ? true : info.team === info.laid.attacker;
  const at = layoutOf(viewport, { attacking, ...(tree ? { tree } : {}), ...(screen ? { screen } : {}) });
  if (!at) return null;
  const objectives = info.objectives ?? [];
  const left = objectives.reduce((s, o) => s + (o.down ? 0 : Math.max(0, o.hp) / (o.hpMax || 1)), 0);
  const k = objectives.length ? left / objectives.length : 0;
  const st = info.stage;
  const said = st.sid ? strings[st.sid] : null;
  return {
    ...at,
    k,
    attacking,
    percent: Math.round(k * 100),
    dots: { ...at.dots, list: objectives.map((o) => ({ id: o.id, name: o.name, down: Boolean(o.down) })) },
    text: at.text ? { ...at.text, words: said ?? st.title ?? '', game: Boolean(said) } : null,
    phase: `${st.index + 1} / ${st.count}`,
    abilities: (kit?.abilities ?? []).map((id) => ({ id, icon: BY_SPRITE.get(abilityIcon(id)) ?? null })).filter((a) => a.icon),
    downed: info.downed ?? null,
  };
}
