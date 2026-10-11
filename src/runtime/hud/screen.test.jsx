import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Screen from './Screen.jsx';
import { screenKey } from './screenKey';
import Reticle from './Reticle.jsx';

// a resolved tree as src/lib/bf2017/ui/screens.js gives one: a frame with a
// title and a list of three cells, one of them linked
const TREE = {
  name: 'UI/Frontend/Screens/Start/MainMenuScreen',
  size: [1920, 1080],
  states: ['MilestoneCareerState'],
  navigation: 'normal',
  boxes: [
    { id: '/Title', type: 'text', x: 100, y: 40, w: 400, h: 48, text: 'STAR WARS BATTLEFRONT II', key: 'ID_TITLE', font: { family: 'var(--font-bf-hud)', size: 36, weight: 700 }, colour: 'rgb(255 255 255)', align: ['left', 'center'] },
    {
      id: '/Menu',
      type: 'staticList',
      x: 96,
      y: 110,
      w: 1728,
      h: 48,
      children: [
        { id: '/Menu/Start', type: 'cell', x: 96, y: 110, w: 190, h: 48, label: 'START', link: 'UI/Data/LinkAssets/Start/StartScreen', screen: 'UI/Frontend/Screens/Start/StartScreen' },
        { id: '/Menu/Play', type: 'cell', x: 284, y: 110, w: 190, h: 48, label: 'PLAY', link: 'UI/Data/LinkAssets/Play/PlayScreen', screen: 'UI/Frontend/Screens/Play/PlayScreen' },
        { id: '/Menu/Store', type: 'cell', x: 472, y: 110, w: 190, h: 48, label: 'Store' },
      ],
    },
    { id: '/Hidden', type: 'rectangle', x: 0, y: 0, w: 10, h: 10, hidden: true, colour: 'rgb(0 0 0)' },
    { id: '/Tick', type: 'vectorShape', x: 10, y: 10, w: 32, h: 32, shape: 'Crosshairs_Ability_Dooku' },
  ],
};

describe("the kit's Screen", () => {
  const html = renderToStaticMarkup(<Screen tree={TREE} label="Main menu" onLink={() => {}} />);

  it('draws every box at the place and size the tree gives it, in per cent of the screen', () => {
    // the title: 100 / 1920 across, 40 / 1080 down
    expect(html).toMatch(/data-id="\/Title"[^>]*style="[^"]*left:5.2083%;top:3.7037%;width:20.8333%;height:4.4444%/);
    expect(html).toContain('STAR WARS BATTLEFRONT II');
    expect(html).toContain('font-family:var(--font-bf-hud)');
  });

  it("draws the list's cells as buttons, the first one tabbable, the rest by the arrows", () => {
    const buttons = html.match(/<button[^>]*>/g);
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toContain('tabindex="0"');
    expect(buttons[1]).toContain('tabindex="-1"');
    expect(html).toContain('>PLAY<');
    expect(html).toMatch(/data-link="UI\/Data\/LinkAssets\/Play\/PlayScreen"/);
  });

  it('keeps a hidden box hidden, and names the state groups as classes', () => {
    expect(html).toMatch(/data-id="\/Hidden"[^>]*hidden/);
    expect(html).toContain('state-MilestoneCareerState');
  });

  it("draws a shape box as the game's vector shape", () => {
    expect(html).toMatch(/data-id="\/Tick"[^>]*>.*<svg[^>]*viewBox="0 0 4 8"/);
  });

  it('is a modal dialog when asked, and a region otherwise', () => {
    expect(html).toMatch(/^<div[^>]*role="region"[^>]*aria-label="Main menu"/);
    expect(renderToStaticMarkup(<Screen tree={TREE} label="Menu" modal />)).toMatch(/^<div[^>]*role="dialog"[^>]*aria-modal="true"/);
  });

  it('draws nothing with no tree', () => {
    expect(renderToStaticMarkup(<Screen tree={null} />)).toBe('');
  });
});

describe("the Screen's keys, as the game's navigation frame has them", () => {
  const cells = TREE.boxes[1].children;
  const ev = (key) => ({ key, preventDefault: vi.fn() });

  it('moves along a horizontal list with the arrows, wrapping at the ends', () => {
    expect(screenKey(ev('ArrowRight'), { index: 0, cells, horizontal: true })).toEqual({ focus: 1 });
    expect(screenKey(ev('ArrowLeft'), { index: 0, cells, horizontal: true })).toEqual({ focus: 2 });
    expect(screenKey(ev('ArrowDown'), { index: 1, cells, horizontal: false })).toEqual({ focus: 2 });
    expect(screenKey(ev('Home'), { index: 2, cells, horizontal: true })).toEqual({ focus: 0 });
  });

  it("activates a cell with Enter or Space, calling onLink with the cell's target", () => {
    const onLink = vi.fn();
    const e = ev('Enter');
    expect(screenKey(e, { index: 1, cells, horizontal: true, onLink })).toEqual({ activated: 1 });
    expect(onLink).toHaveBeenCalledWith('UI/Frontend/Screens/Play/PlayScreen', cells[1]);
    expect(e.preventDefault).toHaveBeenCalled();
    const onAction = vi.fn();
    screenKey(ev(' '), { index: 2, cells, horizontal: true, onLink, onAction });
    expect(onAction).toHaveBeenCalledWith('Store', cells[2]);
  });

  it('leaves Tab and other keys to the page', () => {
    expect(screenKey(ev('Tab'), { index: 0, cells, horizontal: true })).toBeNull();
    expect(screenKey(ev('x'), { index: 0, cells, horizontal: true })).toBeNull();
  });
});

describe('the reticle, in the shape of the weapon', () => {
  const shape = { name: 'Crosshairs_Ability_Dooku', viewBox: '0 0 4 8', paths: [{ d: 'M0 2L2 8L4 2L2 0Z', fill: 'rgb(255 255 255)', fillRule: 'evenodd', opacity: 0.85 }] };

  it("draws the game's shape in place of its own ticks", () => {
    const html = renderToStaticMarkup(<Reticle state={{ shown: true }} shape={shape} />);
    expect(html).toContain('viewBox="0 0 4 8"');
    expect(html).toContain('d="M0 2L2 8L4 2L2 0Z"');
    expect(html).not.toContain('data-at="t"');
  });

  it('keeps its own ticks with no shape', () => {
    expect(renderToStaticMarkup(<Reticle state={{ shown: true }} />)).toContain('data-at="t"');
  });
});
