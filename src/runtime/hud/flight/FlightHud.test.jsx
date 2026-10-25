import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import FlightHud, { FlightOverlay } from './FlightHud.jsx';
import Reticle from '../Reticle.jsx';
import GameIcon from '../GameIcon';

const ref = { current: null };

// both old copies (UM:359-393, GV:256-288), rendered: one string while flying
const s = (c, inner = '') => `<span class="universe-${c}">${inner}</span>`;
const b = (...cs) => cs.map((c) => `<b class="universe-${c}"></b>`).join('');
const GUN = s('reticle');
const OVERLAY = `<div class="universe-hud" aria-hidden="true">${GUN}${s('lock', '<i></i>'.repeat(4) + b('lock-name', 'lock-dist', 'lock-hp'))}${s('threat').repeat(3)}${s('mate', b('mate-name')).repeat(4)}${s('lead')}${s('nav', '<i></i>' + b('nav-name', 'nav-dist'))}</div>`;

describe('FlightOverlay', () => {
  it('is the markup both maps drew, child for child', () => {
    expect(html(<FlightOverlay />)).toBe(OVERLAY);
  });
  it('takes the on-foot crosshair right after the gun line, under the brackets', () => {
    const crosshair = <Reticle className="universe-foot-reticle" state={{ shown: true, tight: 0.5, locked: true }} />;
    expect(html(<FlightOverlay crosshair={crosshair} />)).toBe(OVERLAY.replace(GUN, GUN + html(crosshair)));
  });
});

describe('FlightHud', () => {
  // (moved from galaxy/FlightCluster.test.jsx: the galaxy's icons, handed in)
  it('marks the speed line with the game’s speed-bar icon, and keeps its own glyph for the deflectors', () => {
    const out = html(<FlightHud hudRef={ref} vitalsIcon={<svg className="fc-shield-icon" aria-hidden="true" />} speedIcon={<GameIcon name="hud:speed" className="fc-speed-icon" />} />);
    expect(out).toContain('<use href="/ui/bf2017/spacebattles.svg#spacebattles-icon-hud-speedbar"');
    // (the icon and the number one item at the line's start, so the line's space-between doesn't push the number to its middle;
    // the writer still finds the number by its class)
    expect(out).toMatch(/<span class="fc-speed-lead"><svg class="game-icon fc-speed-icon"[^]*?<\/svg><b class="fc-speed-n">SPD 0<\/b><\/span>/);
    expect(out).toContain('fc-shield-icon');
  });
  it('has every part on both maps', () => {
    const out = html(<FlightHud hudRef={ref} />);
    for (const c of ['fc-radar', 'fc-speed-n', 'fc-kills-n', 'fc-target', 'fc-target-name', 'fc-target-dist', 'fc-target-hp', 'universe-wanted', 'universe-wanted-word', 'universe-alt', 'universe-hud']) expect(out).toContain(c);
  });
  it('says Shields in a ship and Health on foot', () => {
    expect(html(<FlightHud hudRef={ref} />)).toMatch(/<span class="hud-label">Shields<\/span>/);
    const foot = html(<FlightHud hudRef={ref} foot />);
    expect(foot).toMatch(/<span class="hud-label">Health<\/span>/);
    for (const c of ['fc-radar', 'fc-speed-n', 'fc-target-name']) expect(foot).not.toContain(c);
  });
  it('puts the world’s slots where they go', () => {
    const out = html(<FlightHud hudRef={ref} powers={<i className="powers-slot" />} row={<i className="row-slot" />} over={<i className="over-slot" />} overlay={<i className="overlay-slot" />} after={<i className="after-slot" />} />);
    expect(out).toContain('<div class="hud-cluster-over"><i class="over-slot"></i></div>');
    const at = (c) => out.indexOf(c);
    expect(at('powers-slot')).toBeGreaterThan(at('fc-target-hp'));
    expect(at('row-slot')).toBeGreaterThan(at('powers-slot'));
    expect(at('overlay-slot')).toBeGreaterThan(at('universe-nav-dist'));
    expect(at('after-slot')).toBeGreaterThan(at('overlay-slot'));
  });
  it('with no ship, only the overlay slot', () => expect(html(<FlightHud flying={false} overlay={<i className="o" />} />)).toBe('<i class="o"></i>'));
});
