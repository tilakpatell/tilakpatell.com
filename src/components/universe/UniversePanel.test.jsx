import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoonCard } from './UniversePanel';
import { MOONS } from './universes';

const card = (id) => renderToStaticMarkup(<MoonCard moon={MOONS.find((m) => m.id === id)} />);

describe('a Rick and Morty sector planet’s card', () => {
  it('says the cruiser sets down on Gazorpazorp, a whole world, and Morty walks into the rest through their portal', () => {
    expect(card('gazorpazorp')).toMatch(/the cruiser sets down and you climb out as Rick/);
    expect(card('gazorpazorp')).not.toMatch(/on foot as Morty|portal/);
    for (const m of MOONS.filter((x) => !x.big)) {
      expect(card(m.id), m.id).toMatch(/on foot as Morty/);
      expect(card(m.id), m.id).toMatch(/its own portal brings you back out to space/);
    }
  });
});
