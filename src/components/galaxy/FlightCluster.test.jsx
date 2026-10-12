import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import FlightCluster from './FlightCluster';

describe('the flight cluster', () => {
  it('marks the speed line with the game’s speed-bar icon, and keeps its own glyph for the deflectors', () => {
    const ref = { current: null };
    const html = renderToStaticMarkup(<FlightCluster rootRef={ref} ship="falcon" reduced={false} powersRef={ref} onPower={() => {}} radarRef={ref} buffsRef={ref} />);
    expect(html).toContain('<use href="/ui/bf2017/spacebattles.svg#spacebattles-icon-hud-speedbar"');
    // (the icon and the number one item at the line's start, so the line's space-between doesn't push the number to its middle;
    // cluster.js still finds the number by its class)
    expect(html).toMatch(/<span class="fc-speed-lead"><svg class="game-icon fc-speed-icon"[^]*?<\/svg><b class="fc-speed-n">SPD 0<\/b><\/span>/);
    expect(html).toContain('fc-shield-icon');
  });
});
