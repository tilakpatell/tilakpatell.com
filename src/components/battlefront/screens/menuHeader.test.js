import { describe, expect, it, vi } from 'vitest';
import { drawList, navigables } from '../../../lib/bf2017/ui/layout';
import { screen } from '../../../lib/bf2017/ui/screens';
import { crumbItems, menuHeader, offline, tabWays } from './menuHeader';

const header = (tab, crumbs = null) => {
  const tree = screen('MainMenuScreen', { items: crumbItems(crumbs) });
  return { tree, ...menuHeader({ tree, tab, crumbs }) };
};
const labels = (h) => navigables([h.tree], { values: h.values }).map((n) => n.label);

describe('the main menu’s header', () => {
  it('on a tab’s own page: the tabs, that tab open, the breadcrumb and the store left out', () => {
    const h = header('Play');
    expect(labels(h)).toEqual(['HOME', 'PLAY', 'COLLECTION', 'CAREER', 'OPTIONS']);
    expect(h.active).toEqual([navigables([h.tree]).find((n) => n.label === 'PLAY').id]);
    expect(drawList([h.tree], { values: h.values }).some((i) => i.id.includes('/BreadcrumbWidget/'))).toBe(false);
  });

  it('deeper in: the breadcrumb with the crumbs’ words, and no tabs', () => {
    const h = header('Play', ['PLAY', 'SINGLE PLAYER']);
    expect(crumbItems(['PLAY', 'SINGLE PLAYER'])).toEqual({ BreadcrumbList: [{ id: 'crumb0', label: 'PLAY' }, { id: 'crumb1', label: 'SINGLE PLAYER' }] });
    expect(labels(h)).toEqual(['PLAY', 'SINGLE PLAYER']);
    expect(h.active).toEqual([]);
    expect(drawList([h.tree], { values: h.values }).some((i) => i.id.includes('/MainMenuWidget/'))).toBe(false);
  });

  it('writes the crumbs as the game does: the last one bold, a divider before each but the first, no rank badge', () => {
    const h = header('Play', ['PLAY', 'SINGLE PLAYER']);
    const texts = drawList([h.tree], { values: h.values }).filter((i) => i.type === 'text');
    expect(texts.map((i) => [i.id.split('/').pop(), i.text])).toEqual([
      ['BreadcrumbTextInactive', 'PLAY'],
      ['Divider', '/'],
      ['BreadcrumbTextActive', 'SINGLE PLAYER'],
    ]);
  });

  it('goes where a tab links, and says a tab this world has not got is coming', () => {
    const ways = { onPlay: vi.fn(), onStart: vi.fn(), onCollection: vi.fn(), onComing: vi.fn() };
    const go = tabWays(ways);
    go('UI/Frontend/Screens/Play/PlayScreen', { label: 'PLAY' });
    go('UI/Frontend/Screens/Start/StartScreen', { label: 'HOME' });
    go('UI/Data/LinkAssets/Characters/CharacterScreen', { label: 'COLLECTION' });
    go('UI/Frontend/Screens/Career/ChallengesScreen', { label: 'CAREER' });
    expect([ways.onPlay, ways.onStart, ways.onCollection].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
    expect(ways.onComing).toHaveBeenCalledWith('CAREER');
  });

  it('leaves out the front end’s online parts', () => {
    expect(offline({ id: '/FooterBar', type: 'widget' }, ['FooterBar'])).toEqual({ hidden: true });
    expect(offline({ id: '/x/SocialHubList', type: 'widget' }, ['x', 'SocialHubList'])).toEqual({ hidden: true });
    expect(offline({ id: '/x/Debug', type: 'cell', label: 'DEBUG MENU' }, ['x', 'Debug'])).toEqual({ hidden: true });
    expect(offline({ id: '/x/Title', type: 'text' }, ['x', 'Title'])).toBeNull();
  });
});
