import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import BattlefrontHud from '../hud/BattlefrontHud.jsx';
import { loadScreens, wantsMenu } from '../useGameScreens.js';
import { frontEndWays, levelCards, menuItems, MODE_LISTS, pressStart } from './cards';
import { EOR_STEPS, findBox, skipTo, stepAt } from './tree';
import { screen } from '../../../lib/bf2017/ui/screens';
import EndOfRound from './EndOfRound.jsx';
import FrontEnd from './FrontEnd.jsx';
import InGameMenu from './InGameMenu.jsx';
import KillScreen from './KillScreen.jsx';
import Loading from './Loading.jsx';
import MainMenu from './MainMenu.jsx';
import Play from './Play.jsx';
import Scoreboard from './Scoreboard.jsx';
import Spawn, { figureOf } from './Spawn.jsx';
import Start from './Start.jsx';

const html = (el) => renderToStaticMarkup(el);
const OFFERS = [
  { kind: 'class', id: 'd-orig-assault', cls: 'assault', cost: 0 },
  { kind: 'class', id: 'd-orig-heavy', cls: 'heavy', cost: 0 },
  { kind: 'hero', id: 'vader', cost: 6000 },
];
const TEAMS = { 1: { name: 'REBELS', rows: [{ id: 'a', name: 'Trooper 1', kills: 3, deaths: 1, points: 300 }] }, 2: { name: 'EMPIRE', rows: [{ id: 'b', name: 'You', kills: 5, deaths: 0, points: 900 }] } };

describe("the game's screens, each from its tree", () => {
  it('starts with the press-start line in the game’s words, the keyboard’s key named', () => {
    expect(pressStart()).toBe('PRESS ENTER TO START');
    const h = html(<Start onNext={() => {}} />);
    expect(h).toContain('PRESS ENTER TO START');
    expect(h).toMatch(/role="dialog"/);
  });

  it("draws the main menu's tabs as the game's cells, Play among them", () => {
    const h = html(<MainMenu />);
    expect(h).toContain('data-screen="UI/Frontend/Screens/Start/MainMenuScreen"');
    expect(h).toMatch(/data-link="UI\/Data\/LinkAssets\/Play\/PlayScreen"/);
    expect(h).not.toContain('OPEN SOCIAL HUB');
  });

  it("draws Play's tiles in the boxes its tree gives them, Multiplayer live and the rest greyed", () => {
    const h = html(<Play />);
    expect(h).toMatch(/data-tile="Multiplayer"/);
    expect(h).toContain('MULTIPLAYER');
    expect(h).toMatch(/<button[^>]*aria-disabled="true"[^>]*data-tile="COOP"/);
  });

  it("puts each mode's card in its list's box on the multiplayer screen", () => {
    const tree = screen('PlayMultiplayerScreen');
    for (const list of Object.keys(MODE_LISTS)) expect(findBox(tree, list), list).toBeTruthy();
    const hoth = levelCards('PlanetaryBattles', (l, m) => l === 'hoth' && m === 'galacticAssault').find((c) => c.site === 'hoth');
    expect(hoth).toMatchObject({ key: 'Hoth_01', playable: true, title: 'OUTPOST DELTA' });
  });

  it('loads as the game draws it: the planet’s film, the planet, the map and the mode’s words, a hint in its box, and neither a bar nor a number', () => {
    const h = html(<Loading mode="galacticAssault" level="hoth" progress={0.4} waiting="Building the shaders · 3 to go" />);
    expect(h).toMatch(/planet-hoth/);
    expect(h).toMatch(/class="bf-loading-planet"[^>]*>HOTH</);
    expect(h).toMatch(/class="bf-loading-level"[^>]*>OUTPOST DELTA</);
    expect(h).toMatch(/class="bf-loading-about"[^>]*>[^<]{20,}/);
    expect(h).toMatch(/data-id="[^"]*hintbody"[^>]*>.*<span class="hud-screen-text">[^<]{10,}/);
    // (the running game shows no bar and no percentage, photographed 2026-10-13: what the load waits on is said for a screen reader alone)
    expect(h).not.toContain('bf-loading-bar');
    expect(h).not.toMatch(/per cent/);
    expect(h).toMatch(/<p class="sr-only" role="status"[^>]*>Building the shaders/);
    expect(h).toContain('bf-loading-mark');
  });

  it('an Instant Action round’s loading screen says the game’s words for Instant Action', () => {
    expect(html(<Loading mode="supremacy" level="hoth" />)).toContain('Single player epic battles against AI opponents offline.');
  });

  it('the spawn screen as the game draws it: the offer in hand in its panel, the classes as tiles, the rest as portraits, the foot’s three buttons', () => {
    const offers = [
      { kind: 'class', id: 'd-orig-assault', cls: 'assault', cost: 0 },
      { kind: 'class', id: 'd-orig-heavy', cls: 'heavy', cost: 0 },
      { kind: 'class', id: 'd-orig-officer', cls: 'officer', cost: 0 },
      { kind: 'class', id: 'd-orig-specialist', cls: 'specialist', cost: 0 },
      { kind: 'reinforcement', id: 'DeathTrooper', cost: 1500 },
      { kind: 'hero', id: 'darthvader', cost: 4000 },
    ];
    const h = html(<Spawn first deploy={{ open: true, offers, team: 2 }} points={0} name={(o) => o.id.toUpperCase()} />);
    expect(h).toContain('data-screen="UI/Customize/Screens/SpawnOverlayScreen"');
    // (the first life: the game's pre-round line)
    expect(h).toContain('PREROUND: EQUIP AND UNLOCK CARDS');
    // the panel: the offer in hand, and its three card slots
    expect(h).toMatch(/class="bf-spawn-panel"[\s\S]*?<h2[^>]*>D-ORIG-ASSAULT<\/h2>/);
    expect((h.match(/class="bf-spawn-slot"/g) ?? []).length).toBe(3);
    // the strip: the four classes as tiles with the game's class icons, the first in hand
    const tiles = [...h.matchAll(/class="bf-spawn-screen-cell bf-spawn-tile" data-kind="class" data-offer="([^"]+)" aria-pressed="(true|false)"/g)].map((m) => [m[1], m[2]]);
    expect(tiles).toEqual([
      ['d-orig-assault', 'true'],
      ['d-orig-heavy', 'false'],
      ['d-orig-officer', 'false'],
      ['d-orig-specialist', 'false'],
    ]);
    expect(h).toMatch(/data-offer="d-orig-heavy"[^>]*>[\s\S]*?classes\.svg#[a-z0-9-]*heavy/);
    // the portraits: a reinforcement and a hero by the game's own, hatched while their Battle Points are not earned
    expect(h).toMatch(/data-kind="reinforcement" data-offer="DeathTrooper" aria-pressed="false" aria-disabled="true"[^>]*>[\s\S]*?portraits-portrait-deathtrooper\.webp/);
    expect(h).toMatch(/data-kind="hero" data-offer="darthvader" aria-pressed="false" aria-disabled="true"[^>]*>[\s\S]*?portraits-portrait-darthvader\.webp/);
    expect(h).toMatch(/class="bf-spawn-points"[\s\S]*?>0<[\s\S]*?BATTLE POINTS/);
    expect([...h.matchAll(/data-foot="([a-z]+)"/g)].map((m) => m[1])).toEqual(['select', 'abilities', 'appearances']);
  });

  it('after the first life: no pre-round line; the squad mates to spawn on, one that cannot be greyed with the game’s reason; with no tree, lane 5’s deploy screen', () => {
    const squad = html(<Spawn deploy={{ open: true, offers: OFFERS, spawns: [{ id: 'hq', kind: 'hq', name: 'HQ' }, { id: 'm1', kind: 'mate', name: 'Trooper 2', blocked: true, reason: 'IN COMBAT' }] }} points={0} />);
    expect(squad).not.toContain('PREROUND');
    expect(squad).toContain('aria-label="Where to deploy"');
    expect(squad).toMatch(/data-spawn="mate"[^>]*aria-disabled="true"/);
    expect(squad).toContain('IN COMBAT');
    expect(squad).toMatch(/data-kind="hero"[^>]*aria-disabled="true"/);
    const fallback = html(<Spawn screen="NoSuchScreen" deploy={{ open: true, offers: OFFERS }} points={0} />);
    expect(fallback).toContain('bf-offers');
    expect(fallback).toContain('id="bf-deploy-title"');
  });

  it("gives the in-game menu's items as buttons, the debug ones left out", () => {
    const items = menuItems(screen('IngameMenuMPScreen')).map((i) => i.label);
    expect(items).toEqual(expect.arrayContaining(['RESUME', 'RESPAWN', 'SCOREBOARD', 'QUIT']));
    expect(items.some((l) => /DEBUG/.test(l))).toBe(false);
    const h = html(<InGameMenu on={{ RESUME: () => {} }} />);
    expect(h).toMatch(/data-item="RESUME"/);
  });

  it("shows the kill screen in the game's words, who did it", () => {
    const h = html(<KillScreen killer={{ name: 'Trooper 4', dist: 23.4 }} earned={120} />);
    expect(h).toContain('YOU WERE ELIMINATED');
    expect(h).toContain('Trooper 4');
    expect(h).toContain('23 m');
  });

  it("draws the scoreboard's rosters in its tree's boxes", () => {
    const h = html(<Scoreboard teams={TEAMS} />);
    expect(h).toContain('data-screen="UI/InGame/EndOfRound/EORScoreboardScreenWidget"');
    expect(h.match(/class="bf-roster"/g)).toHaveLength(2);
  });
});

describe('the end of round, on the clock', () => {
  it('steps through the outcome, the scoreboard and the top players by the time gone', () => {
    expect(stepAt(0).step.id).toBe('outcome');
    expect(stepAt(EOR_STEPS[0].seconds + 0.1).step.id).toBe('scoreboard');
    expect(stepAt(EOR_STEPS[0].seconds + EOR_STEPS[1].seconds + 1).step.id).toBe('top');
    expect(stepAt(999).done).toBe(true);
  });

  it('skips to the start of the next step from anywhere in this one', () => {
    const into = EOR_STEPS[0].seconds + 1;
    expect(stepAt(into + skipTo(into)).step.id).toBe('top');
    expect(stepAt(0 + skipTo(0)).step.id).toBe('scoreboard');
  });

  it('reads the time, not frames: a tab that slept a minute is at the end', () => {
    let calls = 0;
    const now = () => (calls++ === 0 ? 0 : 60000);
    const h = html(<EndOfRound result={{ winner: 2 }} mine={2} teams={TEAMS} now={now} />);
    expect(h).toContain('data-step="top"');
    expect(h).toContain('MVP');
  });

  it('declares the outcome for the player’s side in the game’s words', () => {
    const won = html(<EndOfRound result={{ winner: 2 }} mine={2} teams={TEAMS} now={() => 0} />);
    expect(won).toContain('VICTORY');
    expect(html(<EndOfRound result={{ winner: 1 }} mine={2} teams={TEAMS} now={() => 0} />)).toContain('DEFEAT');
  });
});

describe('with no screens (a failed import)', () => {
  it('loads to false when the import fails (null is not yet), and the HUD keeps lane 5’s deploy screen', async () => {
    expect(await loadScreens(() => Promise.reject(new Error('chunk failed')))).toBe(false);
    const view = { deploy: { open: true, offers: OFFERS }, points: 0, player: { state: 'deploying', team: 2 }, mode: null, killLog: [] };
    const h = html(<BattlefrontHud view={view} words={{ title: 'Hoth', deploy: 'Deploy', offer: (o) => o.id, outcome: {} }} />);
    expect(h).toContain('bf-offers');
  });

  it('loads the screens and the crosshairs when the import works: a class’s gun’s, made once', async () => {
    const s = await loadScreens();
    expect(typeof s.Spawn).toBe('function');
    // (the crosshair widgets' 64 × 64; the blaster rifle's is the dot and three lines)
    expect(s.reticle.viewBox).toBe('-32 -32 64 64');
    expect(s.crosshair('assault')).toBe(s.reticle);
    expect(s.crosshair('heavy').name).toMatch(/^Crosshairs_ArcShort/);
    expect(s.crosshair('specialist').paths).toHaveLength(2);
  });
});

describe('the pause menu’s way in', () => {
  it('opens on Escape, and on the pointer let go (the browser takes the first Escape to end the lock)', () => {
    expect(wantsMenu({ type: 'keydown', key: 'Escape' }, null)).toBe(true);
    expect(wantsMenu({ type: 'keydown', key: 'Escape', defaultPrevented: true }, null)).toBe(false);
    expect(wantsMenu({ type: 'pointerlockchange' }, null)).toBe(true);
    expect(wantsMenu({ type: 'pointerlockchange' }, {})).toBe(false);
    expect(wantsMenu({ type: 'keydown', key: 'Tab' }, null)).toBe(false);
  });

  it('draws no hit flash on the crosshair from the player’s own wounds', () => {
    const view = { deploy: { open: false, offers: [] }, points: 0, player: { state: 'alive', team: 2, hp: 50, hpMax: 100, hits: [{ id: 'x', angle: 0, age: 0 }] }, mode: null, killLog: [] };
    const h = html(<BattlefrontHud view={view} words={{ title: 'Hoth', deploy: 'Deploy', offer: (o) => o.id, outcome: {} }} reticle={{ name: 'c', viewBox: '0 0 4 4', paths: [] }} />);
    expect(h).toContain('hud-reticle-shape');
    expect(h).not.toContain('data-hit');
  });
});

describe('the front end over a world', () => {
  it('lands in the main menu when asked, drawn from the game’s tree', () => {
    const h = html(<FrontEnd start="menu" onExit={() => {}} />);
    expect(h).toContain('data-front-end="menu"');
    expect(h).toContain('data-screen="UI/Frontend/Screens/Start/MainMenuScreen"');
  });
  it('opens on the Start screen when it stands alone', () => {
    expect(html(<FrontEnd />)).toContain('data-front-end="start"');
  });
});

describe('the front end’s ways out', () => {
  it('alone: HOME and Escape both go to the Start screen, and the first thing in focus is the frame’s own', () => {
    const toStart = () => 'start';
    const w = frontEndWays({ toStart });
    expect(w.home).toBe(toStart);
    expect(w.back).toBe(toStart);
    expect(w.first).toBe(null);
  });
  it('over a world: Escape is the way out, HOME goes nowhere, and the focus starts on PLAY', () => {
    const toStart = () => 'start';
    const onExit = () => 'out';
    const w = frontEndWays({ toStart, onExit });
    // (HOME is the first tab and held the focus: Enter on arriving left the game and threw the loaded level away)
    expect(w.home).toBe(null);
    expect(w.back).toBe(onExit);
    expect(w.first).toBe('[data-link$="/PlayScreen"]');
  });
});

describe('the character on the spawn screen', () => {
  it('is the body the offer in hand would wear in the field: the side’s trooper, a picked skin, a hero’s own', () => {
    const assault = { kind: 'class', id: 'd-orig-assault', cls: 'assault' };
    expect(figureOf(assault, 2, {})).toEqual({ name: 'snowtrooper', rig: 'walrus', src: { url: '/models/galaxy/bf2017/crew/snowtrooper.glb' }, pack: null, kind: 'snowtrooper' });
    expect(figureOf({ kind: 'class', id: 'l-orig-assault', cls: 'assault' }, 1, {}).kind).toBe('hothtrooper');
    expect(figureOf(assault, 2, { 'assault.empire': { skin: 'assault.empire.scariff' } }).kind).toBe('shoretrooper');
    expect(figureOf({ kind: 'hero', id: 'darthvader' }, 2, {})).toMatchObject({ kind: 'vader', pack: 'vader' });
    // (a unit with no body here yet: its side's trooper, as in the field)
    expect(figureOf({ kind: 'reinforcement', id: 'ISBAgent' }, 2, {}).kind).toBe('snowtrooper');
  });
  it('stands on the screen for the offer in hand', () => {
    const h = html(<Spawn first deploy={{ open: true, offers: OFFERS, team: 2 }} points={0} />);
    expect(h).toMatch(/class="bf-spawn-figure"[^>]*>\s*<div class="bf-collection-stage"/);
  });
});
