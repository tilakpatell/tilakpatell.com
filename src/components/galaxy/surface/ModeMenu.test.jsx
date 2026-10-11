import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ModeMenu from './ModeMenu';
import { modesFor } from './modes';

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
