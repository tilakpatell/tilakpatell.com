import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Toast } from './WorldCards';
import { toastLife } from './toastSlot';

const REVEAL = { kind: 'say', who: 'The Morty with the eyepatch', text: 'He takes the eyepatch off. Behind it, a perfectly good eye. “He was a puppet. They all are.” A yellow portal opens behind him. “Tell your Rick I’m not done.” He steps through, and the chair is empty.', at: 1 };

describe('C-137’s toast', () => {
  it('fades a line over its own life, not the stylesheet’s flat one', () => {
    const html = renderToStaticMarkup(<Toast toast={REVEAL} />);
    expect(toastLife(REVEAL)).toBeGreaterThan(5600);
    expect(html).toContain(`animation-duration:${toastLife(REVEAL)}ms`);
  });

  it('leaves the rest to the stylesheet', () => {
    const html = renderToStaticMarkup(<Toast toast={{ kind: 'done', who: 'Roy', text: '3 of 60 done', at: 1 }} />);
    expect(html).not.toContain('animation-duration');
  });
});
