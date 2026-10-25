import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import Sewer from './Sewer.jsx';
import { laserOn } from './rules';

describe('Pickle Rick’s sewer run', () => {
  it('owns Esc from the first card, so the overlay never closes a won run behind its back', () => {
    const html = renderToStaticMarkup(<Sewer onLeave={() => {}} onWin={() => {}} />);
    expect(html).toContain('class="sewer"');
    expect(html).toContain('data-owns-escape');
  });

  it('says on a touch screen what fires once the laser’s on: the star, as its first card says, not F', () => {
    expect(laserOn(false)).toBe('laser on: F fires');
    expect(laserOn(true)).toBe('laser on: the star fires');
    expect(readFileSync(new URL('./Sewer.jsx', import.meta.url), 'utf8')).toContain('the star fires once the laser’s on');
  });

  it('gives Leave a finger’s 44 px on a touch screen, as the show’s and the cabinet’s', () => {
    const coarse = readFileSync(new URL('./sewer.css', import.meta.url), 'utf8').match(/@media \(pointer: coarse\) \{([^@]*?)\n\}/)?.[1] ?? '';
    expect(coarse).toMatch(/\.sewer-leave[^{]*\{[^}]*min-height: 44px/);
  });
});
