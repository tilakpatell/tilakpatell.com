import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Cabinet from './Cabinet';

describe('Plumbus Smash’s cabinet', () => {
  it('opens on its card: the game, the cabinet’s own line, Rick’s bet and the keys', () => {
    const html = renderToStaticMarkup(<Cabinet game="cabinet2" onWin={() => {}} onLeave={() => {}} />);
    expect(html).toContain('Plumbus Smash');
    expect(html).toContain('Somebody’s high score is all nines, and the stick is sticky.');
    expect(html).toContain('Rick’s bet: beat 9,999.');
    expect(html).toContain('data-owns-escape');
    expect(html).toMatch(/<button[^>]*>Start<\/button>/);
    expect(html).toMatch(/<button[^>]*>Leave<\/button>/);
    // the three chutes, each a way to smash on touch
    expect((html.match(/class="cabinet-chute"/g) ?? []).length).toBe(3);
  });
});
