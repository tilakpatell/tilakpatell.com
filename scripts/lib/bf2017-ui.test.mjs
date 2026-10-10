import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bitmapWanted, excludedFilms, filmRows, fontLicence, OWNER_LICENCE, iconFamily, iconName, isSequelFilm, isSequelUi, spriteOf, stringTables, symbolOf, vttOf } from './bf2017-ui.mjs';

const MISC = readFileSync(join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'web', 'misc.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));

describe('the 2017 front end’s cut', () => {
  const films = filmRows(MISC);
  const by = (name) => films.find((f) => f.name.endsWith(name));

  it('reads a planet’s loading film as its system’s', () => {
    expect(by('Planet_Hoth_01')).toMatchObject({ kind: 'planet', system: 'hoth', loop: true, path: 'films/bf2017/planet-hoth-01.webm', poster: 'films/bf2017/planet-hoth-01.webp' });
    expect(by('Planet_DeathStarII_01')).toMatchObject({ system: 'deathstar' });
    expect(by('Planet_Pilio-Dead_01')).toMatchObject({ system: 'pillio', variant: 'dead' });
  });

  it('reads a campaign film as a briefing on its world, in scene order', () => {
    expect(by('A1_M1END_DS01_S0100_FMV')).toMatchObject({ kind: 'campaign', level: 'endor', act: 1, scene: 10100, loop: false });
    expect(by('A1_M1END_DS01_S0100_FMV').subtitles).toMatch(/\.ssa$/);
  });

  it('reads the tiles, the tutorials, the logo and the lava', () => {
    expect(by('Tile_Skirmish')).toMatchObject({ kind: 'tile', tile: 'skirmish', loop: true });
    expect(by('LvlPickup_Barrage')).toMatchObject({ kind: 'tutorial', loop: false });
    expect(by('Logos_Start_01')).toMatchObject({ kind: 'logo' });
    expect(by('MT_Volcano2')).toMatchObject({ kind: 'fx', fx: 'volcano', transcode: true });
  });

  it('keeps the sequel era out, and the effect textures nothing asks for', () => {
    expect(by('Planet_Jakku_01')).toBeUndefined();
    expect(by('A2_M1TAK_DS01_S0100_FMV')).toBeUndefined();
    expect(by('A3_M4VAR_DS01_S0100_FMV')).toBeUndefined();
    expect(by('MT_CapitalShipDestruction')).toBeUndefined();
    const out = Object.fromEntries(excludedFilms(MISC).map((e) => [e.name.split('/').pop(), e.reason]));
    expect(out.Planet_Jakku_01).toBe('era');
    expect(out.MT_CapitalShipDestruction).toMatch(/^vp6/);
    expect(isSequelFilm('S1/UI/Video/Loading/Planet_Crait_01')).toBe(true);
    expect(isSequelFilm('Cinematics/Story/A3/M1PIL/game/A3_M1PIL_DS01_S0100_FMV')).toBe(true);
    expect(isSequelFilm('UI/Video/Loading/Planet_Endor_01')).toBe(false);
  });

  it('ships every font, each under its own licence or the owner’s', () => {
    expect(fontLicence('LinotypeUnivers-420Cn.ttf')).toEqual(OWNER_LICENCE);
    expect(fontLicence('UI/Resources/Fonts/Aurebesh.ttf').licence).toBe('owner');
    expect(fontLicence('Roboto-Regular.ttf').licence).toBe('Apache-2.0');
    expect(fontLicence('NotoSansCJKsc-Regular.ttf').licence).toBe('OFL-1.1');
    expect(fontLicence('Cuprum-Bold.ttf').file).toBe('OFL.txt');
  });

  it('names and files the icons as lane 0 does', () => {
    expect(iconName('svg/S1/UI/SVG/BossVehicles/Icon_AT-M6.svg')).toBe('BossVehicles/Icon_AT-M6');
    expect(iconFamily('svg/S1/UI/SVG/BossVehicles/Icon_AT-M6.svg')).toBe('bossvehicles');
    expect(iconFamily('svg/UI/SVG/Customize/Heroes/Luke/Card/x.svg')).toBe('heroes');
    expect(iconFamily('svg/UI/Art/HUD/Abilities/x.svg')).toBe('hud');
    expect(isSequelUi('UI/Bitmaps/Portraits/Portrait_BlackOne')).toBe(true);
    expect(isSequelUi('UI/Bitmaps/Portraits/Portrait_LukeSkywalker')).toBe(false);
  });

  it('makes a sprite of symbols, tinted by the text colour, ids its own', () => {
    const s = symbolOf('Weapons/Icon_A280', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 96"><defs><linearGradient id="g"/></defs><path fill="#ffffff" d="M0 0" style="fill:url(#g)"/></svg>');
    expect(s.id).toBe('weapons-icon-a280');
    expect(s.svg).toContain('viewBox="0 0 384 96"');
    expect(s.svg).toContain('fill="currentColor"');
    expect(s.svg).toContain('id="weapons-icon-a280--g"');
    expect(s.svg).toContain('url(#weapons-icon-a280--g)');
    const { sprites, table } = spriteOf([{ name: 'Weapons/Icon_A280', family: 'weapons', text: '<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>' }]);
    expect(table['Weapons/Icon_A280']).toEqual(['weapons', 'weapons-icon-a280']);
    expect(sprites.weapons).toMatch(/^<svg[^>]*display:none[^>]*>\n<symbol id="weapons-icon-a280"/);
  });

  it('files the strings by their key’s family, and the unnamed by hash', () => {
    const { named, families } = stringTables({ strings: { AAAA0001: 'A280', AAAA0002: 'Use cover.', AAAA0003: 'Credits' } }, { keys: { AAAA0001: 'ID_W_A280', AAAA0002: 'ID_HINT_COVER' } });
    expect(named).toEqual({ ID_W_A280: 'A280', ID_HINT_COVER: 'Use cover.' });
    expect(families.W).toEqual({ ID_W_A280: 'A280' });
    expect(families._hash).toEqual({ AAAA0003: 'Credits' });
  });

  it('turns a SubStation script’s dialogue into WebVTT', () => {
    const ssa = '[Events]\nFormat: Marked, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: Marked=0,0:00:01.50,0:00:03.20,Default,,0,0,0,,{\\i1}Iden:{\\i0} Hold, the line\\NNow.\n';
    expect(vttOf(ssa)).toBe('WEBVTT\n\n00:00:01.500 --> 00:00:03.200\nIden: Hold, the line\nNow.\n');
    const keyed = '[Events]\nFormat: Marked, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: Marked=0,0:00:27.60,0:00:29.44,D,NTP,0,0,0,,ID_SW02_VO_X_0002_GARRICK\nDialogue: Marked=0,0:00:30.00,0:00:31.00,D,NTP,0,0,0,,ID_SW02_VO_X_0003_NOBODY\n';
    expect(vttOf(keyed, (k) => ({ ID_SW02_VO_X_0002_GARRICK: 'Move out.' })[k])).toBe('WEBVTT\n\n00:00:27.600 --> 00:00:29.440\nMove out.\n');
  });

  it('wants the portraits and tiles, not the sequel’s', () => {
    expect(bitmapWanted('UI/Bitmaps/Portraits/Portrait_DarthVader')).toBe(true);
    expect(bitmapWanted('UI/Bitmaps/Portraits/Portrait_KyloRen')).toBe(false);
    expect(bitmapWanted('UI/Bitmaps/GameModeTiles/GMTile_Supremacy_Sequel')).toBe(false);
    expect(bitmapWanted('UI/Bitmaps/Frontend/Whatever')).toBe(false);
  });
});
