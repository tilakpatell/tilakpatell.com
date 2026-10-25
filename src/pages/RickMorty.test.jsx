import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { LookNote } from './RickMorty';
import { destinationById } from '../components/rickmorty/world/dimensions/destinations';

const note = (id) => renderToStaticMarkup(<MemoryRouter><LookNote d={destinationById(id)} /></MemoryRouter>);

describe('the Rick and Morty page’s looks', () => {
  it('says a planet on the gun dials after episode 10, or on Free roam, and one off it only lands', () => {
    expect(note('squanch')).toContain('after episode 10 (or on Free roam), dial it on Rick’s portal gun');
    expect(note('nuptia')).not.toContain('portal gun');
  });

  it('puts the gun to dial in the 3D world, which the cards haven’t got', () => {
    expect(note('squanch')).toContain('dial it on Rick’s portal gun in the 3D world at the top of the page');
    expect(destinationById('fantasy')).not.toBeNull();
    expect(note('fantasy')).toContain('dial it on Rick’s portal gun in the 3D world at the top of the page');
  });
});
