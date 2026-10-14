import { describe, expect, it } from 'vitest';
import { tileValues } from './tiles';

const tiles = { Multiplayer: { title: 'MULTIPLAYER', film: { url: 'm.mp4', poster: 'm.jpg' }, go: () => {} }, COOP: { title: 'CO-OP', aurebesh: 'CO-OP MISSIONS' } };
const v = tileValues(tiles);

describe('a Play tile’s values', () => {
  it('keeps the tree’s title and fills an empty one', () => {
    expect(v({ id: '/Multiplayer/Title', type: 'text', text: 'MULTIPLAYER' }, ['Multiplayer', 'AnimContainer', 'Texts', 'Title'])).toBeNull();
    expect(v({ id: '/COOP/Title', type: 'text', text: '' }, ['COOP', 'Title'])).toEqual({ text: 'CO-OP' });
  });
  it('writes the Aurebesh line as the tile’s drawn title', () => {
    expect(v({ id: '/COOP/AurebeshTitle', type: 'text' }, ['COOP', 'AurebeshTitle'])).toEqual({ text: 'CO-OP MISSIONS' });
    expect(v({ id: '/Multiplayer/AurebeshTitle', type: 'text' }, ['Multiplayer', 'AurebeshTitle'])).toEqual({ text: 'MULTIPLAYER' });
  });
  it('plays the tile’s film, marks one still to come and says so in its own line', () => {
    expect(v({ id: '/Multiplayer/VideoWidget/Video', type: 'video' }, ['Multiplayer', 'VideoWidget', 'Video'])).toEqual({ film: tiles.Multiplayer.film });
    expect(v({ id: '/COOP', type: 'widget' }, ['COOP'])).toEqual({ coming: true });
    expect(v({ id: '/COOP/NotInBeta', type: 'text' }, ['COOP', 'NotInBeta'])).toEqual({ text: 'NOT IN THIS WORLD YET' });
    expect(v({ id: '/Multiplayer/NotInBeta', type: 'text' }, ['Multiplayer', 'NotInBeta'])).toEqual({ hidden: true });
  });
  it('draws no pad prompt, as the PC’s game does, and runs the top line the title’s width', () => {
    expect(v({ id: '/COOP/Play prompt', type: 'widget' }, ['COOP', 'AnimContainer', 'Play prompt'])).toEqual({ hidden: true });
    expect(v({ id: '/Multiplayer/Play prompt', type: 'widget' }, ['Multiplayer', 'AnimContainer', 'Play prompt'])).toEqual({ hidden: true });
    expect(v({ id: '/Multiplayer/TileWidget/SelectedTopLine', type: 'line' }, ['Multiplayer', 'AnimContainer', 'TileWidget', 'SelectedTopLine'])).toEqual({ follow: 'Title' });
  });

  it('leaves out the parts the game shows on other tiles', () => {
    for (const part of ['RequiresConnection', 'SplitScreen', 'PlayScenarioWidget', 'EmblemsWidget']) expect(v({ id: `/COOP/${part}` }, ['COOP', part]), part).toEqual({ hidden: true });
  });
});
