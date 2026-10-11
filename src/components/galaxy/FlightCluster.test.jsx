import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import FlightCluster from './FlightCluster';

describe('the flight cluster', () => {
  it('marks the speed line with the game’s speed-bar icon, and keeps its own glyph for the deflectors', () => {
    const ref = { current: null };
    const html = renderToStaticMarkup(<FlightCluster rootRef={ref} ship="falcon" reduced={false} powersRef={ref} onPower={() => {}} radarRef={ref} buffsRef={ref} />);
    expect(html).toContain('<use href="/ui/bf2017/spacebattles.svg#spacebattles-icon-hud-speedbar"');
    expect(html).toContain('fc-speed-n');
    expect(html).toContain('fc-shield-icon');
  });
});
