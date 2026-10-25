import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Cards, { Toast } from './WorldCards';
import { planetOf } from './planetMode';
import { toastLife } from './toastSlot';

const REVEAL = { kind: 'say', who: 'The Morty with the eyepatch', text: 'He takes the eyepatch off. Behind it, a perfectly good eye. “He was a puppet. They all are.” A yellow portal opens behind him. “Tell your Rick I’m not done.” He steps through, and the chair is empty.', at: 1 };

describe('C-137’s toast', () => {
  it('fades a line over its own life, not the stylesheet’s flat one', () => {
    const html = renderToStaticMarkup(<Toast toast={REVEAL} />);
    expect(toastLife(REVEAL)).toBeGreaterThan(5600);
    expect(html).toContain(`animation-duration:${toastLife(REVEAL)}ms`);
  });

  it('leaves the rest to the stylesheet', () => {
    const html = renderToStaticMarkup(<Toast toast={{ kind: 'done', who: 'Roy', text: '3 of 60 done', at: 1 }} />);
    expect(html).not.toContain('animation-duration');
  });
});

// (use3D's three: no WebGL at all, so no 3D to turn on; or WebGL, with 3D off)
const NO_GL = { can: false, on: false, held: false, set: () => {} };
const OFF = { ...NO_GL, can: true };
const cards = ({ three = NO_GL, planet = null } = {}) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <Cards done={[]} openPlace={() => {}} three={three} gl="loading" toast={null} retry={() => {}} planet={planet} />
    </MemoryRouter>,
  );
const STORY = 'The story, Rick’s portal gun and most of the things to do are in the 3D world.';

describe('C-137 as cards', () => {
  it('says so in a browser with no 3D graphics, with nothing to turn on', () => {
    const html = cards();
    expect(html).toContain('This browser has no 3D graphics, so here’s the neighbourhood as cards.');
    expect(html).not.toContain('Turn 3D on');
    expect(html).not.toContain('<button type="button" class="btn');
    // (3D only switched off keeps its note and its button)
    expect(cards({ three: OFF })).toContain('3D is switched off, so here’s the neighbourhood as cards.');
    expect(cards({ three: OFF })).toContain('Turn 3D on');
  });

  it('says the story, the portal gun and most of the things to do are the 3D world’s', () => {
    expect(cards()).toContain(STORY);
    expect(cards({ three: OFF })).toContain(STORY);
  });

  it('keeps that line off a planet, which says it’s a card', () => {
    const html = cards({ planet: planetOf('squanch') });
    expect(html).not.toContain(STORY);
    expect(html).toMatch(/This browser has no 3D graphics, so here’s .+ as a card\./);
  });
});
