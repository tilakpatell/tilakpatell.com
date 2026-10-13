import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import UnfitCard from './UnfitCard';
import { UNFIT_WHY } from './unfitWords';

const card = (why) => renderToStaticMarkup(<UnfitCard name="Battlefront" why={why} way={{ label: 'Universe map', to: '/universe' }} onTry={() => {}} />);

// What a device the Star Wars worlds cannot run on sees instead (lib/fit):
// what it needs, why this device falls short, the way back, and a try anyway
describe('the card for a device that cannot run a Star Wars world', () => {
  it('says what the world needs and why this device falls short, for every reason lib/fit gives', () => {
    for (const why of ['none', 'software', 'weak', 'cpu', 'memory']) {
      const html = card(why);
      expect(html, why).toContain('Battlefront needs a graphics chip');
      expect(html, why).toContain(UNFIT_WHY[why]);
      expect(UNFIT_WHY[why], why).not.toMatch(/[!]/);
    }
  });

  it('offers the way back, and to try anyway', () => {
    const html = card('weak');
    expect(html).toContain('href="#/universe"');
    expect(html).toContain('Universe map');
    expect(html).toContain('Try anyway');
    expect(html).toContain('role="alert"');
  });
});
