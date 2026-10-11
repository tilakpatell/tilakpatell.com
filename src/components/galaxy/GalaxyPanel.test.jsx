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

describe('the system’s card', () => {
  it('titles a world with the game’s planet icon where the front end has one', () => {
    expect(panel('kashyyyk')).toContain('<use href="/ui/bf2017/planets.svg#planets-planets-preq-kash"');
    expect(panel('coruscant')).not.toContain('planets.svg');
  });
  it('puts the game’s Death Star icon on the way to the Death Star, with a crew aboard', () => {
    const html = panel('yavin', { ship: 'falcon', at: 'yavin' });
    expect(html).toContain('Fly to the Death Star');
    expect(html).toContain('<use href="/ui/bf2017/planets.svg#planets-planets-orig-ds"');
  });
});
