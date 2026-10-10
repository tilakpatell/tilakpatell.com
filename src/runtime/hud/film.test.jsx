import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Film from './Film';
import GameIcon from './GameIcon';

const FILM = { slug: 'planet-hoth-01', url: 'https://cdn.example/abc/films/bf2017/planet-hoth-01.webm', poster: '/films/bf2017/planet-hoth-01.webp', captions: null, loop: true };

describe('a game film in its frame', () => {
  it('shows the card’s own still where there is no film, and no broken video', () => {
    const html = renderToStaticMarkup(<Film film={null} still={<img src="/still.jpg" alt="Nevarro" />} />);
    expect(html).toContain('<img src="/still.jpg" alt="Nevarro"/>');
    expect(html).not.toMatch(/film|<video/);
    expect(renderToStaticMarkup(<Film film={null} />)).toBe('');
  });

  it('draws the poster first and loads no film until the frame is on screen', () => {
    const html = renderToStaticMarkup(<Film film={FILM} label="Hoth" />);
    expect(html).toContain('src="/films/bf2017/planet-hoth-01.webp"');
    expect(html).toContain('aria-label="Hoth"');
    expect(html).not.toContain('<video');
  });
});

describe('a game icon', () => {
  it('draws the game’s symbol, or the site’s own glyph where the game has none', () => {
    expect(renderToStaticMarkup(<GameIcon name="weapon:rifle" />)).toContain('href="/ui/bf2017/weapons.svg#weapons-weapons-e-11"');
    expect(renderToStaticMarkup(<GameIcon name="weapon:portal" fallback={<span>P</span>} />)).toBe('<span>P</span>');
  });
});
