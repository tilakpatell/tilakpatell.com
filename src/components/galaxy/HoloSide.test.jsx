import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import HoloSide from './HoloSide';
import { systemById } from './systems';
import { warNow } from './warState';

const NOW = 1_700_000_000_000;
const OATH = { war: 'gcw', side: null, sworn: 0, turncoat: false };
const noop = () => {};
const side = (pickedId, hereId = 'hoth') => {
  const table = warNow(NOW, 'gcw');
  const war = { ...table, byId: Object.fromEntries(table.systems.map((r) => [r.id, r])) };
  const picked = pickedId ? systemById(pickedId) : null;
  return renderToStaticMarkup(
    <MemoryRouter>
      <HoloSide picked={picked} here={systemById(hereId)} route={null} war={war} pickedWar={picked ? (war.byId[picked.id] ?? null) : null} view="gcw" now={NOW} oath={OATH} viewOath={OATH} pilots={{}} wide seen={{}} suggested={null} record={{ systems: [], battles: 0 }} current={hereId} jumpBtn={{ current: null }} onJump={noop} onClose={noop} onLeave={noop} onSwear={noop} onTheatre={noop} onPick={noop} onBack={noop} />
    </MemoryRouter>,
  );
};

describe('the galaxy map’s side panel', () => {
  it('names a picked world with the game’s planet icon where the front end has one, and the jump keeps its own glyph', () => {
    const html = side('endor');
    expect(html).toContain('Course plotted');
    expect(html).toContain('<use href="/ui/bf2017/planets.svg#planets-planets-orig-en"');
    expect(html).toContain('Jump to lightspeed');
  });
  it('names a world the game has no icon of without one', () => {
    const html = side('alderaan');
    expect(html).toContain('Alderaan');
    expect(html).not.toContain('planets.svg');
  });
  it('names where you are the same way when nothing is picked', () => {
    expect(side(null, 'hoth')).toContain('<use href="/ui/bf2017/planets.svg#planets-planets-orig-ho"');
  });
});
