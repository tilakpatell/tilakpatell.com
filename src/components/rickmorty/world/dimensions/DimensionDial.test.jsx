import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DimensionDial from './DimensionDial';

const items = [
  { id: 'customs', name: 'Interdimensional Customs', note: 'Seeds and scanners.', locked: null },
  { id: 'vat', name: 'The vat of acid', note: 'A fake death, for sale.', locked: 'Opens after episode 5, “Heat”.' },
];
const dial = (more) => renderToStaticMarkup(<DimensionDial open items={items} value="customs" onPick={() => {}} onClose={() => {}} {...more} />);

describe('the portal gun’s dial', () => {
  it('dims a locked place and says which episode opens it', () => {
    const html = dial();
    expect((html.match(/data-locked="true"/g) ?? []).length).toBe(1);
    expect(html).toContain('Opens after episode 5, “Heat”.');
    expect(html).not.toContain('A fake death, for sale.');
    expect(html).toContain('Seeds and scanners.');
  });

  it('shows its lead line', () => {
    expect(dial({ lead: 'Coordinates home: 1 of 32' })).toContain('<p class="rm-dial-lead">Coordinates home: 1 of 32</p>');
  });
});
