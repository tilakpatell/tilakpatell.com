import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ModeMenu from './ModeMenu';
import { modesFor } from './modes';
import { tilesFor } from '../../../lib/bf2017/films';

describe('the mode menu', () => {
  const html = renderToStaticMarkup(<ModeMenu place="Hoth" cards={modesFor('hoth')} onPick={() => {}} onDeploy={() => {}} onClose={() => {}} onAsk={() => {}} />);
  it('shows every card, the live ones to play and the rest with why', () => {
    for (const c of modesFor('hoth')) expect(html).toContain(c.name);
    expect(html).toContain('is-live');
    // (a mode the level has and no mission on the site yet: Hoth's hero arena, with no rows for it)
    const soon = renderToStaticMarkup(<ModeMenu place="Hoth" cards={modesFor('hoth', { missions: { hoth: {} } })} onPick={() => {}} onDeploy={() => {}} onClose={() => {}} onAsk={() => {}} />);
    expect(soon).toContain('is-soon');
    expect(soon).toContain('the site’s map of it isn’t made yet');
    expect(html).toContain('aria-disabled="true"');
  });
  it('offers the deploy screen, free roam on Esc and not asking again', () => {
    expect(html).toContain('Deploy as…');
    expect(html).toContain('Free roam');
    expect(html).toContain('Don’t ask on landing');
  });
});

describe("the mode menu's cards, as the game names them", () => {
  const GAME = { galacticAssault: 'PlanetaryBattles', starfighter: 'SpaceBattle', hvv: 'HeroesVersusVillains', blast: 'Blast' };
  const cards = modesFor('hoth');

  it("names each card with the game's own name for its mode", async () => {
    const { info } = await import('../../../lib/bf2017/ui/info');
    for (const [id, game] of Object.entries(GAME)) expect(cards.find((c) => c.id === id).name.toUpperCase()).toBe(info('mode', game).title);
  });

  it("orders the cards as the game's list of modes does", async () => {
    const { infoList } = await import('../../../lib/bf2017/ui/info');
    const order = infoList().map((m) => m.id);
    const seen = cards.filter((c) => GAME[c.id]).map((c) => order.indexOf(GAME[c.id]));
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(cards.at(-1).id).toBe('free');
  });

  it("describes each mode in the game's words", async () => {
    const { info } = await import('../../../lib/bf2017/ui/info');
    expect(cards.find((c) => c.id === 'galacticAssault').about).toBe(info('mode', 'PlanetaryBattles').blurb);
    const html = renderToStaticMarkup(<ModeMenu place="Hoth" cards={cards} onPick={() => {}} onDeploy={() => {}} onClose={() => {}} />);
    expect(html).toContain(info('mode', 'SpaceBattle').blurb);
  });

  it("writes the Land button's line in the same names", async () => {
    const { landLine } = await import('./landLine');
    const { systemById } = await import('../systems');
    for (const name of landLine(systemById('hoth')).split(' · ')) expect(cards.map((c) => c.name)).toContain(name);
  });
});

describe("the mode menu, laid out as the game's multiplayer screen", () => {
  const cards = modesFor('hoth');
  const draw = (list = cards) => renderToStaticMarkup(<ModeMenu place="Hoth" cards={list} onPick={() => {}} onDeploy={() => {}} onClose={() => {}} onAsk={() => {}} />);
  const between = (html, from, to) => html.slice(html.indexOf(from), html.indexOf(to));
  const lead = (html) => between(html, 'class="mode-lead', 'class="mode-grid"');
  const modesIn = (html) => [...html.matchAll(/data-mode="([^"]+)"/g)].map((m) => m[1]);

  it("gives the large tile Galactic Assault's film, its poster first", () => {
    const film = tilesFor('assault')[0] ?? null;
    expect(cards[0].film).toEqual(film);
    // (the game's tile where it's published, and none drawn where it isn't)
    if (film) expect(lead(draw())).toContain(`src="${film.poster}"`);
    else expect(lead(draw())).not.toContain('film-poster');
    // (whatever film the card brings is the one the tile plays)
    const own = { slug: 'x', url: '/films/x.webm', poster: '/films/x.webp', loop: true };
    const html = draw(cards.map((c) => (c.id === 'galacticAssault' ? { ...c, film: own } : c)));
    expect(lead(html)).toContain('src="/films/x.webp"');
    expect(lead(html)).toContain(cards[0].about);
  });

  it('draws the tiles in the list’s order: Galactic Assault first, the grid, then Story and Free roam last', () => {
    const html = draw();
    expect(modesIn(html)).toEqual(cards.map((c) => c.id));
    expect(modesIn(lead(html))).toEqual(['galacticAssault']);
    expect(modesIn(between(html, 'class="mode-grid"', 'class="mode-rest"'))).toEqual(cards.filter((c) => !['galacticAssault', 'story', 'free'].includes(c.id)).map((c) => c.id));
    const rest = between(html, 'class="mode-rest"', 'class="mode-menu-foot"');
    expect(modesIn(rest)).toEqual(['story', 'free']);
    expect(rest).toContain('Always open');
  });

  it('says why under the name of a card it cannot play', () => {
    const none = cards.find((c) => c.id === 'starfighter');
    expect(none.state).toBe('none');
    const html = draw();
    const at = html.indexOf('data-mode="starfighter"');
    const tile = html.slice(at, html.indexOf('</button>', at));
    expect(tile).toContain(`<span class="mode-card-name">${none.name}</span><span class="mode-card-why">${none.why}</span>`);
    expect(tile).toContain('aria-disabled="true"');
  });

  it('prompts the keys at the foot in the house cap: Enter to select, Esc for free roam', () => {
    const html = draw();
    const foot = html.slice(html.indexOf('class="mode-menu-foot"'));
    expect(foot).toContain('<kbd class="hud-cap">Enter</kbd> Select');
    expect(foot).toContain('<kbd class="hud-cap">Esc</kbd> Free roam');
  });
});
