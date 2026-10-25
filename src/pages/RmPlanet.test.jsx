import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RmPlanet from './RmPlanet';

// (the worlds themselves are canvases: the page round them is what's read here)
vi.mock('../components/rickmorty/world/RmWorld', () => ({ default: () => null }));
vi.mock('../components/rickmorty/planets/RmSurface', () => ({ default: () => null }));

const page = (path) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/c-137/:planet" element={<RmPlanet />} />
      </Routes>
    </MemoryRouter>,
  );
const home = /<a[^>]*href="\/c-137"[^>]*>Home to C-137<\/a>/;

describe('a Rick and Morty planet’s page', () => {
  it('gives Gazorpazorp a way home to C-137 beside its way back to space (a whole world, with no HUD link of its own)', () => {
    const html = page('/c-137/gazorpazorp');
    expect(html).toMatch(home);
    expect(html).toMatch(/Back to space/);
  });

  it('leaves a planet walked into to its HUD’s own Home link', () => {
    expect(page('/c-137/squanch')).not.toMatch(home);
  });
});
