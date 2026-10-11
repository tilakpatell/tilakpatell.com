import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import air from '../../data/bf2017/air.json';
import endorMap from '../../data/bf2017/maps/sb_endor.json';
import endorStages from '../../data/bf2017/maps/sb_endor.stages.json';
import StarfighterHud from './StarfighterHud';
import { abilityIcon, layoutOf, panelOf } from './surface/missions/starfighterHud';
import { levelOf } from './surface/missions/starfighter';
import { createRoster } from './surface/missions/starfighterPilots';

const level = levelOf(endorMap, endorStages, air);
const SPACE = readFileSync(new URL('../../../public/ui/bf2017/strings/spacebattles.json', import.meta.url), 'utf8');
const strings = JSON.parse(SPACE);
const SPRITE = readFileSync(new URL('../../../public/ui/bf2017/spacebattles.svg', import.meta.url), 'utf8');

// a Starfighter Assault as warfront.js's info has it: the corvettes' stage, one down
const info = (o = {}) => ({
  sys: 'endor',
  team: 1,
  laid: { kind: 'starfighter', attacker: 1 },
  on: { starfighter: { level } },
  stage: { index: 0, count: 5, open: true, opensIn: 0, need: 3, id: 'corvettes', title: 'Destroy the corvettes', sid: 'ID_SPACEBATTLES_OBJ_TEAM_2_ENDOR_PHASE_1' },
  objectives: [
    { id: 'CR90_A', name: 'CR90 corvette', hp: 0, hpMax: 70, down: true },
    { id: 'CR90_B', name: 'CR90 corvette', hp: 35, hpMax: 70, down: false },
    { id: 'CR90_C', name: 'CR90 corvette', hp: 70, hpMax: 70, down: false },
  ],
  downed: { name: 'Wedge', kind: 'xwing65' },
  ...o,
});
const HD = { width: 1920, height: 1080 };

describe("Starfighter Assault's objective panel, from the game's widget tree", () => {
  it('places the bar, its dots and the phase’s words where the tree does at 1920 × 1080', () => {
    const at = layoutOf(HD);
    // (the panel: 1,200 wide, centred at the top; the attack bar's fill 176 × 40, 38 px down)
    expect(at.box).toEqual({ x: 360, y: 0, w: 1200, h: 200 });
    expect(at.bar.w).toBe(176);
    expect(at.bar.h).toBe(40);
    expect(at.bar.y).toBe(38);
    expect(at.dots.y).toBe(38 + 40 + 15 - 10);
    expect(at.text.y).toBe(98);
    expect(at.text.font.size).toBe(18);
    // (and halved on a 960 × 540 screen)
    expect(layoutOf({ width: 960, height: 540 }).bar.w).toBe(88);
  });

  it('says the phase in the game’s own words, its health and a dot an objective', () => {
    const p = panelOf(info(), { viewport: HD, strings });
    expect(p.text.words).toBe(strings.ID_SPACEBATTLES_OBJ_TEAM_2_ENDOR_PHASE_1);
    expect(p.text.game).toBe(true);
    expect(p.percent).toBe(50);
    expect(p.dots.list.map((d) => d.down)).toEqual([true, false, false]);
    expect(p.attacking).toBe(true);
    // (the defender's bar, the other way)
    expect(panelOf(info({ team: 0 }), { viewport: HD, strings }).attacking).toBe(false);
    // (no strings yet: the stage's own title)
    expect(panelOf(info(), { viewport: HD }).text.words).toBe('Destroy the corvettes');
    expect(panelOf({ laid: { kind: 'assault' } }, { viewport: HD })).toBeNull();
  });

  it('draws every ability of every kit as the game’s icon', () => {
    for (const kits of level.kits)
      for (const k of kits)
        for (const a of k.abilities) expect(SPRITE, `${k.id}: ${a}`).toContain(`id="${abilityIcon(a)}"`);
    expect(abilityIcon('Ability_WeaponOvercharge')).toBe('spacebattles-ability-icons-ability-weapon-overcharge');
    expect(abilityIcon('Ability_AstromechDroid_Normal')).toBe('spacebattles-ability-icons-ability-astromech-droid');
  });

  it('renders the panel with the phase’s words, the markers’ count and the last bot shot down', () => {
    const html = renderToStaticMarkup(<StarfighterHud front={() => info()} />);
    expect(html).toContain('Destroy the corvettes');
    expect(html.match(/"galaxy-sfhud-dot"/g)).toHaveLength(3);
    expect(html).toContain('Shot down: Wedge');
    expect(html.match(/<use /g)?.length).toBe(level.kits[1][0].abilities.length);
    expect(renderToStaticMarkup(<StarfighterHud front={() => ({ laid: { kind: 'assault' } })} />)).toBe('');
  });

  it('names the battle’s bots on their brackets and remembers the one you downed', () => {
    const roster = createRoster(level.pilots);
    const fighters = [{ id: 3, team: 1, kind: 'tie', tgt: { name: 'TIE fighter' } }];
    roster.name(fighters);
    expect(fighters[0].tgt.name).toMatch(/^TK-\d+ · TIE fighter$/);
    roster.downed({ id: 3, down: true }, fighters);
    expect(roster.last).toEqual({ name: fighters[0].pilot, kind: 'tie' });
  });
});
