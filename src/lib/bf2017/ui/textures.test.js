import { describe, expect, it } from 'vitest';
import { pictureOf } from './textures';

const ROWS = {
  'UI/Art/HUD/Vignette/vignette': { path: 'ui/bf2017/bitmaps/vignette-vignette.webp', size: [512, 512] },
  'UI/Bitmaps/Frontend/4k_KeyArtPairingScreen': { path: 'ui/bf2017/bitmaps/frontend-4k-keyartpairingscreen.webp', size: [2048, 2048] },
  'UI/Bitmaps/Frontend/Tiles/Backup-Arcade': { path: 'ui/bf2017/bitmaps/tiles-backup-arcade.webp', size: [576, 240] },
};
const tex = (more) => ({ id: 0, ref: null, uv: [0, 0, 1, 1], align: 'stretch', ...more });

describe('the picture a texture box shows', () => {
  it('by its Id: the field hash of the texture’s short name', () => {
    expect(pictureOf({ texture: tex({ id: -1768429805 }) }, ROWS)).toEqual({ name: 'UI/Art/HUD/Vignette/vignette', url: '/ui/bf2017/bitmaps/vignette-vignette.webp', size: [512, 512] });
  });
  it('by the TextureRef its widget’s mapping gives (the ones read by hand until the export names them)', () => {
    expect(pictureOf({ texture: tex({ id: 2069381427, ref: '3D80EC7618F789C7' }) }, ROWS).name).toBe('UI/Bitmaps/Frontend/4k_KeyArtPairingScreen');
  });
  it('by the name a screen gives a box the game’s code fills', () => {
    expect(pictureOf({ texture: tex(), image: 'UI/Bitmaps/Frontend/Tiles/Backup-Arcade' }, ROWS).url).toBe('/ui/bf2017/bitmaps/tiles-backup-arcade.webp');
  });
  it('none for a box the site has no picture for', () => {
    expect(pictureOf({ texture: tex({ id: 12345 }) }, ROWS)).toBeNull();
    expect(pictureOf({ texture: tex() }, ROWS)).toBeNull();
  });
});
