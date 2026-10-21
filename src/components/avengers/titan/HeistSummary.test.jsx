import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import HeistSummary from './HeistSummary';

const summary = { span: '1 day 2 hours', rows: [
  { id: 'stark', name: 'Tony Stark’s workshop', tries: '4 tries', best: '12,400' },
  { id: 'cap', name: 'The training center', tries: 'Before records began', best: 'No best kept' },
] };
const html = renderToStaticMarkup(<HeistSummary summary={summary} onClose={() => {}} />);

describe('the heist summary', () => {
  it('shows the span, and each building’s tries and best', () => {
    expect(html).toContain('class="heist-summary"');
    for (const t of ['The heist', 'First stone to sixth', '1 day 2 hours', 'Tony Stark’s workshop', '4 tries', '12,400', 'Before records began', 'No best kept']) expect(html).toContain(t);
    expect(html.match(/<tr>/g)).toHaveLength(3);
    expect(html).toMatch(/<th scope="row">The training center<\/th>/);
  });
  it('closes with the house close button, its title ready for focus', () => {
    expect(html).toContain('aria-label="Close the heist summary"');
    expect(html).toContain('class="close-btn');
    expect(html).toMatch(/<h3 id="heist-summary-title" tabindex="-1"/);
  });
});
