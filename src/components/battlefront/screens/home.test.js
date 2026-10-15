import { describe, expect, it } from 'vitest';
import { drawList } from '../../../lib/bf2017/ui/layout';
import { pictureOf } from '../../../lib/bf2017/ui/textures';
import { screen } from '../../../lib/bf2017/ui/screens';
import { FOOTER_DROP, footerValues } from './footer';
import { homeValues } from './home';

describe('HOME’s page, offline', () => {
  const tree = screen('StartScreen', { drop: FOOTER_DROP });
  const quit = footerValues('QUIT', tree);
  const items = drawList([tree], { values: (b, path) => quit(b, path) ?? homeValues(b, path) });
  it('shows each news tile’s picture, the one the game’s code gives it', () => {
    const pictures = items.filter((i) => i.type === 'texture').map((i) => pictureOf(i)?.name);
    expect(pictures).toEqual(['UI/Bitmaps/Frontend/Tiles/Backup-Campaign', 'UI/Bitmaps/Frontend/Tiles/Backup-Connect', 'UI/Bitmaps/Frontend/Tiles/Backup-Arcade']);
  });
  it('leaves out the online parts: the challenges, the crates, the online tile, the loader; its foot is QUIT', () => {
    const texts = items.filter((i) => i.type === 'text').map((i) => i.text);
    expect(texts).toContain('CONNECT FOR MORE FEATURES');
    expect(texts).toContain('QUIT');
    for (const t of ['LEAP INTO GALACTIC ASSAULT', 'CONNECTING...', 'OPEN SOCIAL HUB', 'CHALLENGES INCOMING...']) expect(texts).not.toContain(t);
  });
});
