import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { screen } from '../../lib/bf2017/ui/screens';
import ScreenCanvas from './ScreenCanvas.jsx';

const html = (el) => renderToStaticMarkup(el);
const PRESS = { name: 'UI/Frontend/Screens/StartFlow/PairingScreen', size: [1920, 1080], boxes: [{ id: '/Press', type: 'text', x: 797, y: 934, w: 326, h: 56, text: '' }] };

describe('the canvas screen', () => {
  it('holds a canvas the screen reader skips, and a button over each cell', () => {
    const h = html(<ScreenCanvas layers={[screen('MainMenuScreen')]} label="Main menu" />);
    expect(h).toMatch(/<canvas[^>]*aria-hidden="true"/);
    expect(h).toContain('data-screen="UI/Frontend/Screens/Start/MainMenuScreen"');
    expect(h).toMatch(/<button[^>]*class="hud-screen-hit"[^>]*aria-label="PLAY"[^>]*data-link="UI\/Data\/LinkAssets\/Play\/PlayScreen"[^>]*style="left:284px;top:110px;width:190px;height:48px"/);
  });

  it('lets the first of each group take the focus, greys a cell still to come', () => {
    const values = (b, path) => (path.at(-1) === 'Career' ? { coming: true } : null);
    const h = html(<ScreenCanvas layers={[screen('MainMenuScreen')]} values={values} />);
    expect(h.match(/tabindex="0"/g)).toHaveLength(1);
    expect(h).toMatch(/aria-label="CAREER"[^>]*aria-disabled="true"|aria-disabled="true"[^>]*aria-label="CAREER"/);
  });

  it('describes a tile’s button by the words drawn in it besides its name', () => {
    const h = html(<ScreenCanvas layers={[screen('PlayScreen')]} />);
    const id = h.match(/aria-label="MULTIPLAYER"[^>]*aria-describedby="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(h).toMatch(new RegExp(`<p id="${id}">[^<]*A selection of multiplayer modes`));
  });

  it('names a tile’s button by the tile, and marks one still to come, for the checks that walk the screens', () => {
    const values = (b, path) => (path.at(-1) === 'COOP' ? { coming: true } : null);
    const h = html(<ScreenCanvas layers={[screen('PlayScreen')]} values={values} />);
    expect(h).toMatch(/<button[^>]*data-coming="true"[^>]*data-tile="COOP"/);
    expect(h).toMatch(/data-tile="Multiplayer"/);
  });

  it('gives the screen reader the words drawn outside the cells', () => {
    const h = html(<ScreenCanvas layers={[PRESS]} values={(b) => (b.id === '/Press' ? { text: 'PRESS ENTER TO START' } : null)} />);
    expect(h).toMatch(/class="sr-only"[^>]*>.*PRESS ENTER TO START/);
  });
});
