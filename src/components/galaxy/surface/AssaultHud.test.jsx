import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AssaultHud from './AssaultHud';
import { ASSAULTS } from './missions/assaults';
import { battleView, chooseSide, deploy, newBattle } from './missions/assault';
import { SIDE_ICONS } from './troopers';

const HOTH = ASSAULTS.hoth;
// the battle on Hoth, as the HUD sees it: a side chosen (the Rebellion, defending), nobody up yet
const battle = ({ side = 'defend', points = 0 } = {}) => {
  const b = newBattle(HOTH, { n: 0, seed: 1 });
  chooseSide(b, side);
  b.you.points = points;
  return b;
};
const render = (view, props = {}) => renderToStaticMarkup(<AssaultHud view={view} feed={null} mission={HOTH} best={null} fresh={false} onSide={() => {}} onDeploy={() => {}} onAgain={() => {}} onBack={() => {}} {...props} />);
// the spawn screen's cell for a name, as drawn
const cell = (html, name) => html.split('<li>').find((x) => x.includes(`assault-spawn-name">${name}<`)) ?? '';

describe('the choose card', () => {
  it('offers both sides under their emblems', () => {
    const html = render(battleView(newBattle(HOTH, { n: 0 })));
    expect(html).toContain('Choose your side');
    expect(html).toContain(SIDE_ICONS.empire);
    expect(html).toContain(SIDE_ICONS.rebel);
  });
});

describe('the spawn screen', () => {
  it('lists the four classes for nothing, the first of them highlighted', () => {
    const html = render(battleView(battle()));
    expect(html).toContain('aria-label="Deploy"');
    for (const name of ['Assault', 'Heavy', 'Officer', 'Specialist']) {
      const c = cell(html, name);
      expect(c, name).toContain('assault-spawn-cost"></span>');
      expect(c, name).not.toContain('aria-disabled');
    }
    expect(cell(html, 'Assault')).toContain('aria-pressed="true"');
    expect(cell(html, 'Heavy')).toContain('aria-pressed="false"');
  });
  it('starts on the class you’re kept as', () => {
    const html = render(battleView(battle()), { kept: 'trooper-rebel-officer' });
    expect(cell(html, 'Officer')).toContain('aria-pressed="true"');
    expect(cell(html, 'Assault')).toContain('aria-pressed="false"');
  });
  it('greys a hero at 4,000 until you’ve earned it', () => {
    const poor = cell(render(battleView(battle())), 'Luke Skywalker');
    expect(poor).toContain('4,000');
    expect(poor).toContain('aria-disabled="true"');
    const rich = cell(render(battleView(battle({ points: 4000 }))), 'Luke Skywalker');
    expect(rich).toContain('4,000');
    expect(rich).not.toContain('aria-disabled');
    // (and the enforcer at its price)
    expect(cell(render(battleView(battle())), 'Wookiee Warrior')).toContain('1,500');
  });
  it('shows the posts you may come on at, one highlighted, and your Battle Points with the keys', () => {
    const html = render(battleView(battle({ points: 1234 })));
    expect(html).toContain('aria-label="Where to deploy"');
    expect(html).toContain('The transports');
    expect(html).toMatch(/class="assault-post" aria-pressed="true"/);
    expect(html).toContain('Battle Points <b>1,234</b>');
    expect(html).toContain('<kbd class="hud-cap">↑↓</kbd> Choose');
    expect(html).toContain('<kbd class="hud-cap">Enter</kbd> Deploy');
    expect(html).toContain('Start over');
    expect(html).toContain('Back to the system');
  });
  it('says when there are no reinforcements left', () => {
    const b = battle();
    b.tickets.defend = 0;
    const html = render(battleView(b));
    expect(html).toContain('No reinforcements left');
    expect(html).not.toMatch(/class="assault-post" aria-pressed="true"/);
  });
});

describe('on the field', () => {
  it('the Battle Points beside your kills', () => {
    const b = battle({ points: 250 });
    deploy(b, 'transports');
    const html = render(battleView(b));
    expect(html).not.toContain('aria-label="Deploy"');
    expect(html).toContain('<b>250</b><span>Battle Points</span>');
  });
});
