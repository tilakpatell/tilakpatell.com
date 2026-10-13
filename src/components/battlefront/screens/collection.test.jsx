import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { screen } from '../../../lib/bf2017/ui/screens';
import { between, findBox } from './tree';
import Collection from './Collection.jsx';
import CollectionCards from './CollectionCards.jsx';
import CollectionCharacters from './CollectionCharacters.jsx';
import CollectionCustomize from './CollectionCustomize.jsx';
import CollectionList from './CollectionList.jsx';

const html = (el) => renderToStaticMarkup(el);

describe('the Collection, on the game’s own screens', () => {
  it('opens on the characters: the classes, the reinforcements and the heroes with their portraits', () => {
    const h = html(<CollectionCharacters />);
    expect(h).toContain('data-screen="UI/Frontend/Screens/Characters/CollectionCharacterScreen"');
    for (const id of ['assault', 'specialist', 'luke', 'darthvader', 'WookieWarrior']) expect(h).toContain(`data-character="${id}"`);
    expect(h).toContain('LUKE SKYWALKER');
    expect(h).toContain('REINFORCEMENTS');
    expect(h).toMatch(/<img src="\/ui\/bf2017\/bitmaps\/[a-z0-9-]+\.webp"/);
    // (a class wears the game's class icon, not one faction's trooper)
    for (const id of ['assault', 'heavy', 'officer', 'specialist']) expect(h).toMatch(new RegExp(`data-character="${id}"[^>]*><svg class="game-icon bf-collection-tile-icon"[^>]*><use href="/ui/bf2017/classes\\.svg#[a-z0-9-]*${id}`));
    expect(h).not.toContain('LOADING COLLECTION');
    expect(html(<Collection />)).toContain('CollectionCharacterScreen');
  });

  it('customises a hero: its star cards, appearances, emotes, poses and voice lines, its abilities named', () => {
    const h = html(<CollectionCustomize id="luke" store={{ luke: { skin: 'VUR_Luke_Hoth_01' } }} />);
    for (const s of ['cards', 'appearance', 'emotes', 'poses', 'voiceLines']) expect(h).toContain(`data-open="${s}"`);
    expect(h).toContain('EQUIP STAR CARDS');
    expect(h).toContain('HOTH');
    expect(h).toContain('PUSH');
    expect(h).toContain('REPULSE');
  });

  it('customises a class by side, with no star cards of a hero', () => {
    const h = html(<CollectionCustomize id="assault" store={{}} faction="empire" />);
    expect(h).toMatch(/role="tab" aria-selected="true"[^>]*>GALACTIC EMPIRE/);
    expect(h).not.toContain('data-open="cards"');
  });

  it('lists a hero’s appearances in the list’s box, the picked one marked, the info panel with its words', () => {
    const items = [
      { id: 'a', name: 'JEDI', rarity: 'common', about: 'One.' },
      { id: 'b', name: 'HOTH', rarity: 'rare', about: 'Two.' },
    ];
    const h = html(<CollectionList screen="AppearanceHeroSkinsScreen" label="Appearances" items={items} chosen={(i) => i.id === 'b'} />);
    expect(h).toContain('data-screen="UI/Customize/Screens/AppearanceHeroSkinsScreen"');
    expect(h).toMatch(/data-item="b"[^>]*aria-pressed="true"/);
    expect(h).toContain('EQUIPPED');
    expect(h).toMatch(/class="bf-collection-info"[^>]*data-rarity="rare"/);
  });

  it('shows a hero’s nine star cards with their art and four levels, the carried ones marked', () => {
    const h = html(<CollectionCards id="luke" store={{ luke: { cards: ['luke.2'] } }} />);
    expect(h.match(/data-card="luke\.\d"/g)).toHaveLength(9);
    expect(h).toMatch(/data-card="luke\.2"[^>]*aria-pressed="true"/);
    expect(h).toContain('EQUIPPED CARDS');
    expect(h).toContain('8%');
  });

  it('leaves the figure the room between the list and the info panel, or beside a panel by the list', () => {
    const skins = screen('AppearanceHeroSkinsScreen');
    const room = between(skins, findBox(skins, 'ListContainer'), findBox(skins, 'InfoWidget'));
    expect(parseFloat(room.width)).toBeGreaterThan(20);
    const emotes = screen('AppearanceEmotesCommoRoseScreen');
    const list = findBox(emotes, 'ListContainer');
    const info = findBox(emotes, 'InfoWidget');
    const r = between(emotes, list, info);
    expect(parseFloat(r.left)).toBeGreaterThanOrEqual(((info.x + info.w) / emotes.size[0]) * 100 - 0.01);
    expect(between(emotes, null)).toBeNull();
  });
});
