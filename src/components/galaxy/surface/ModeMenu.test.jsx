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
