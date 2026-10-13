import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import BattlefrontHud from '../hud/BattlefrontHud.jsx';
import { loadScreens, wantsMenu } from '../useGameScreens.js';
import { levelCards, menuItems, MODE_LISTS, pressStart } from './cards';
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
import Spawn from './Spawn.jsx';
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

  it('loads with the planet’s film and a hint in the hint box', () => {
    const h = html(<Loading mode="galacticAssault" level="hoth" progress={0.4} />);
    expect(h).toContain('aria-valuenow="40"');
    expect(h).toMatch(/planet-hoth/);
    expect(h).toContain('OUTPOST DELTA');
    expect(h).toMatch(/data-id="[^"]*hintbody"[^>]*>.*<span class="hud-screen-text">[^<]{10,}/);
  });

  it("lists the offers in the spawn screen's cells over its tree, and falls back to lane 5's deploy screen with no tree", () => {
    const h = html(<Spawn deploy={{ open: true, offers: OFFERS }} points={0} name={(o) => o.id.toUpperCase()} />);
    expect(h).toContain('data-screen="UI/Customize/Screens/SpawnOverlayScreen"');
    expect(h).toContain('D-ORIG-ASSAULT');
    expect(h).toMatch(/data-kind="hero"[^>]*aria-disabled="true"/);
    const squad = html(<Spawn deploy={{ open: true, offers: OFFERS, spawns: [{ id: 'hq', kind: 'hq', name: 'HQ' }, { id: 'm1', kind: 'mate', name: 'Trooper 2', blocked: true, reason: 'IN COMBAT' }] }} points={0} />);
    expect(squad).toContain('aria-label="Where to deploy"');
    expect(squad).toMatch(/data-spawn="mate"[^>]*aria-disabled="true"/);
    expect(squad).toContain('IN COMBAT');
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
  it('loads to null, and the HUD keeps lane 5’s deploy screen', async () => {
    expect(await loadScreens(() => Promise.reject(new Error('chunk failed')))).toBeNull();
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
