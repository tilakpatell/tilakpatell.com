import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Sewer from './Sewer.jsx';

describe('Pickle Rick’s sewer run', () => {
  it('owns Esc from the first card, so the overlay never closes a won run behind its back', () => {
    const html = renderToStaticMarkup(<Sewer onLeave={() => {}} onWin={() => {}} />);
    expect(html).toContain('class="sewer"');
    expect(html).toContain('data-owns-escape');
  });
});
