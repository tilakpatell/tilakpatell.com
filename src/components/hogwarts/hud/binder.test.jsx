import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Binder from './Binder';
import { cardById } from '../rules/cards';

describe('the binder of Chocolate Frog cards', () => {
  it('has twenty pockets: the cards found face up, the rest with their hint', () => {
    const out = renderToStaticMarkup(<Binder found={['merlin', 'bott']} onClose={() => {}} />);
    expect(out.match(/<li/g)).toHaveLength(20);
    expect(out.match(/data-found/g)).toHaveLength(2);
    expect(out).toContain('2 of 20');
    expect(out).toContain('Merlin');
    expect(out).toContain(cardById('dumbledore').hint);
    expect(out).not.toContain(cardById('dumbledore').text);
  });

  it('shows a card just found on its own, its initials for a portrait', () => {
    const out = renderToStaticMarkup(<Binder card="gryffindor" found={['gryffindor']} />);
    expect(out).toContain('A Chocolate Frog card');
    expect(out).toContain('Godric Gryffindor');
    expect(out).toContain('<span>GG</span>');
  });
});
