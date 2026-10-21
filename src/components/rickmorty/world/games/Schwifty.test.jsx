import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Schwifty from './Schwifty.jsx';

describe('the Get Schwifty show', () => {
  it('opens on its card: the show, the heads’ line, what to do and the keys', () => {
    const html = renderToStaticMarkup(<Schwifty onWin={() => {}} onLeave={() => {}} />);
    expect(html).toContain('Get Schwifty');
    expect(html).toContain('SHOW ME WHAT YOU GOT.');
    expect(html).toContain('Hit each note as it reaches the line, on the beat, and keep the heads’ meter up to the end of the song.');
    expect(html).toContain('data-owns-escape');
    expect(html).toMatch(/<button[^>]*>Start<\/button>/);
    expect(html).toMatch(/<button[^>]*>Leave<\/button>/);
    // the four lanes, each a way to hit on touch, and the heads' meter
    expect((html.match(/class="schwifty-lane"/g) ?? []).length).toBe(4);
    expect(html).toContain('role="meter"');
  });
});
