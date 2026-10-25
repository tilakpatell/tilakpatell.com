import { readFileSync } from 'node:fs';
import { Children, isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Schwifty, { Corner } from './Schwifty.jsx';

// the buttons an element holds, and the words on one
const buttons = (el) => (isValidElement(el) ? [...(el.type === 'button' ? [el] : []), ...Children.toArray(el.props.children).flatMap(buttons)] : []);
const words = (el) => (typeof el === 'string' ? el : isValidElement(el) ? Children.toArray(el.props.children).map(words).join('') : '');

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

  it('on a touch screen, a Pause button beside Leave pauses the song', () => {
    const did = [];
    const corner = Corner({ phase: 'play', touch: true, onPause: () => did.push('pause'), onLeave: () => did.push('leave') });
    const pause = buttons(corner).find((b) => words(b).trim() === 'Pause');
    expect(pause).toBeTruthy();
    pause.props.onClick();
    expect(did).toEqual(['pause']);
    // (beside Leave, which is there in every phase; not on a card, nor with keys, where Esc and P pause)
    expect(buttons(corner).map((b) => words(b).trim())).toEqual(['Pause', 'Leave']);
    for (const phase of ['intro', 'paused', 'won', 'lost']) expect(buttons(Corner({ phase, touch: true })).map((b) => words(b).trim()), phase).toEqual(['Leave']);
    expect(buttons(Corner({ phase: 'play', touch: false })).map((b) => words(b).trim())).toEqual(['Leave']);
    // a finger's 44 px, as Leave is
    const coarse = readFileSync(new URL('./schwifty.css', import.meta.url), 'utf8').match(/@media \(pointer: coarse\) \{([^@]*?)\n\}/)?.[1] ?? '';
    expect(coarse).toMatch(/\.schwifty-pause[^{]*\{[^}]*min-height: 44px/);
  });
});
