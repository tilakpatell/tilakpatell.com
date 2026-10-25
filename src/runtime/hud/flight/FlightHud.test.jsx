import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { FlightOverlay } from './FlightHud.jsx';
import Reticle from '../Reticle.jsx';

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
