import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { loadRulebook, stringOf } from '../../../lib/battlefront/rulebook.js';
import BattlefrontHud from './BattlefrontHud.jsx';
import DeployScreen from './DeployScreen.jsx';
import Heat from './Heat.jsx';
import ObjectiveBar from './ObjectiveBar.jsx';

const rb = loadRulebook();
const words = {
  title: 'Hoth',
  deploy: 'Deploy',
  earned: stringOf(rb, 'ID_DEATH_BATTLEPOINTS_EARNED'),
  total: stringOf(rb, 'ID_DEATH_TOTAL_BATTLE_POINTS'),
  offer: (o) => o.id,
  outcome: { won: 'ROUND WON', lost: 'ROUND LOST', draw: 'ROUND DRAW' },
};
const offers = [
  { kind: 'class', id: 'd-orig-assault', cost: 0 },
  { kind: 'hero', id: 'vader', cost: 6000 },
];

describe('the game’s HUD on the kit', () => {
  it('offers the classes and the heroes at their cost on the deploy screen', () => {
    const html = renderToStaticMarkup(<DeployScreen deploy={{ open: true, offers }} points={1200} />);
    expect(html).toContain('6,000');
    expect(html).toMatch(/aria-disabled="true"[^>]*>.*vader/);
    expect(html).toContain('<kbd class="hud-cap">Enter</kbd>');
  });

  it('draws the heat in the warning colour past the weapon’s warning', () => {
    expect(renderToStaticMarkup(<Heat heat={0.9} warning={0.75} />)).toContain('data-warn');
    expect(renderToStaticMarkup(<Heat heat={0.3} warning={0.75} />)).not.toContain('data-warn');
  });

  it('writes the stage in the game’s own words, the meter in thirds', () => {
    const stage = stringOf(rb, 'ID_FANTASYBATTLES_HOTH_STAGE1_TEAM2');
    const html = renderToStaticMarkup(<ObjectiveBar stage={stage} objectives={[{ id: 'a', name: 'A', meter: 0.5 }]} tickets={300} />);
    expect(html).toContain('TAKE OUT ANY THREATS TO THE AT-ATS');
    expect(html.match(/data-on/g)).toHaveLength(2);
  });

  it('puts the deploy screen up as a modal dialog over the battle, the soldier’s parts hidden', () => {
    const view = { deploy: { open: true, offers }, points: 0, player: { state: 'deploying', hp: 150, hpMax: 150 }, mode: null };
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <BattlefrontHud view={view} words={words} />
      </MemoryRouter>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).not.toContain('bf-health');
  });

  it('declares the round to the player’s side at the end', () => {
    const view = { deploy: { open: false }, player: { state: 'alive', hp: 1, hpMax: 1 }, mode: { stageName: 'X', objectives: [], result: { winner: 2 } }, scoreboard: { 2: { name: 'EMPIRE', rows: [{ id: 1, name: 'You', kills: 3, deaths: 1, points: 400 }] } } };
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <BattlefrontHud view={view} words={words} mine={2} />
      </MemoryRouter>,
    );
    expect(html).toContain('ROUND WON');
    expect(html).toContain('EMPIRE');
  });
});
