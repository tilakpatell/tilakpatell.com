import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import GalaxyPanel from './GalaxyPanel';
import { systemById } from './systems';

const noop = () => {};
const panel = (id, props = {}) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <GalaxyPanel system={systemById(id)} at={id} ship={null} onShip={noop} onMap={noop} onGo={noop} onLeave={noop} onBoard={noop} tucked={false} onTuck={noop} jumping={null} {...props} />
    </MemoryRouter>,
  );

// (the drop's nine Planets_* drawings are all the Galactic Republic's crest, a placeholder: no title or button wears one)
describe('the system’s card', () => {
  it('titles a world by its name alone, with no placeholder planet sprite', () => {
    for (const id of ['kashyyyk', 'hoth', 'coruscant']) {
      const html = panel(id);
      expect(html, id).toMatch(new RegExp(`<h2 class="universe-title galaxy-title">${systemById(id).name}</h2>`));
      expect(html, id).not.toContain('planets.svg');
    }
  });
  it('keeps the way to the Death Star in words, with a crew aboard', () => {
    const html = panel('yavin', { ship: 'falcon', at: 'yavin' });
    expect(html).toContain('Fly to the Death Star');
    expect(html).not.toContain('planets.svg');
  });
});
