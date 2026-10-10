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

  it('holds none of the sequel era', () => {
    for (const name of Object.keys(ICONS)) expect(name).not.toMatch(/rey|finn|kylo|phasma|bb-?[89]|firstorder|resistance|blackone/i);
  });
});
