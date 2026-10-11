import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ICONS, ICON_FOR, icon } from './icons';

const PUBLIC = join(import.meta.dirname, '..', '..', '..', 'public');

describe('the 2017 game’s icons', () => {
  it('finds an icon by the game’s name or the site’s', () => {
    expect(icon('Weapons/Weapons_E-11')).toEqual({ sprite: '/ui/bf2017/weapons.svg', id: 'weapons-weapons-e-11', href: '/ui/bf2017/weapons.svg#weapons-weapons-e-11' });
    expect(icon('weapon:rifle')).toEqual(icon('Weapons/Weapons_E-11'));
  });

  it('gives nothing for a name the sprites lack, so the HUD draws its own', () => {
    expect(icon('weapon:portal')).toBeNull();
    expect(icon('Nope/Nothing')).toBeNull();
    expect(icon(undefined)).toBeNull();
  });

  it('maps every site name to an icon a sprite holds', () => {
    const sprites = {};
    for (const [site, game] of Object.entries(ICON_FOR)) {
      expect(ICONS[game], `${site} → ${game}`).toBeTruthy();
      const { sprite, id } = icon(site);
      sprites[sprite] ??= readFileSync(join(PUBLIC, sprite), 'utf8');
      expect(sprites[sprite], `${site}: #${id} in ${sprite}`).toContain(`<symbol id="${id}"`);
    }
  });

  it('gives the galaxy’s rows a drawing of their own: none is another icon’s art, as the drop’s placeholders are', () => {
    // (the drop reuses art: its nine Planets_* drawings are all the Republic's crest; a galaxy row on one of them would draw the wrong thing)
    const sprites = {};
    const drawing = (game) => {
      const [family, id] = ICONS[game];
      sprites[family] ??= readFileSync(join(PUBLIC, 'ui', 'bf2017', `${family}.svg`), 'utf8');
      return sprites[family].match(new RegExp(`<symbol id="${id}"[^>]*>([\\s\\S]*?)</symbol>`))[1];
    };
    const galaxy = Object.keys(ICON_FOR).filter((k) => /^(side:(rebel|empire|republic|separatists)|planet:|hud:|objective:)/.test(k));
    expect(galaxy.length).toBeGreaterThan(0);
    for (const site of galaxy) {
      const game = ICON_FOR[site];
      const art = drawing(game);
      const twins = Object.keys(ICONS).filter((other) => other !== game && drawing(other) === art);
      expect(twins, `${site} → ${game}`).toEqual([]);
    }
    expect(Object.keys(ICON_FOR).filter((k) => k.startsWith('planet:'))).toEqual([]);
  });

  it('holds none of the sequel era', () => {
    for (const name of Object.keys(ICONS)) expect(name).not.toMatch(/rey|finn|kylo|phasma|bb-?[89]|firstorder|resistance|blackone/i);
  });
});
