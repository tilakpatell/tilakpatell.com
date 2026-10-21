import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { onSite } from '../../../scripts/lib/asset-manifest.mjs';
import PUBLISHED from '../../data/galaxyAssets.json';
import { BODIES, bodyOf, filesOf, fileOf, gameFirst, sourceOf } from './bodies';

// (in public/, or published to the bucket)
const onDisk = (url) => onSite(url, { publicDir: fileURLToPath(new URL('../../../public', import.meta.url)), manifest: PUBLISHED });
// the file the site carries for a row: a full-fidelity kind’s light cut
// (its plain cut may live in the bucket alone), else the file itself
const committed = (row) => (row.lod ? fileOf(row).replace(/\.glb$/, '.lod1.glb') : fileOf(row));

// every kind the table had when it moved below the worlds (2026-10-21): a
// kind taken out fails here, so a world that names it is looked at first
const KINDS = [
  'han', 'luke', 'leia', 'chewie', 'greedo', 'gamorrean', 'bobafett', 'bith', 'ahsoka', 'hutt', 'obiwan', 'jango', 'shaakti', 'mando', 'tusken',
  'lando', 'twilek', 'ugnaught', 'senateguard', 'lobot', 'wingguard', 'dex', 'neimoidian', 'bibfortuna', 'aqualish', 'wuher', 'mustafarian', 'jedi',
  'maul', 'palpatine', 'rex', 'bokatan', 'vader', 'anakin', 'bossk', 'fennec', 'caradune', 'greef', 'rodian', 'mercenary', 'inquisitor', 'tiepilot',
  'hondo', 'ackbar', 'dooku', 'quigon', 'lukehoth', 'lukefarmboy', 'lukeyavin', 'obiwan2', 'obiwan3', 'anakin2', 'anakin3', 'maullegs', 'dooku2',
  'dooku3', 'hanendor', 'hanhoth', 'hanrotj', 'hanyavin', 'hanyoung', 'hanyoung2', 'leiaboushh', 'leiaendor', 'leiagoldvest', 'leiaprincess',
  'landorotj', 'landoskiff', 'landoyoung', 'landoyoung2', 'chewiegoggles', 'battledroid', 'c3po', 'clone', 'clonephase1', 'deathtrooper',
  'hothtrooper', 'rebel', 'rebelpilot', 'rebeltech', 'sandtrooper', 'scouttrooper', 'shoretrooper', 'snowtrooper', 'stormtrooper', 'wookiee',
  'officer', 'civcity1', 'civcity3', 'astromech', 'droid', 'ewok', 'probe', 'r5', 'superdroid', 'tauntaun', 'birdtheed', 'chicken', 'scurrier',
  'tach', 'pelikki', 'runyip', 'profogg', 'sneep', 'stintarils', 'pillioshrimp', 'felbird', 'felripper', 'gamorreanguard', 'treadwell', 'gonk',
];

const rows = Object.entries(BODIES);

describe('the cast table', () => {
  it('imports nothing: plain data below the worlds, no three.js and no React', () => {
    expect(readFileSync(new URL('./bodies.js', import.meta.url), 'utf8')).not.toMatch(/^\s*import\b/m);
  });

  it('keeps every kind it had', () => {
    for (const kind of KINDS) expect(bodyOf(kind), kind).not.toBeNull();
  });

  it('gives every row a file, a height and a source', () => {
    for (const [kind, row] of rows) {
      expect(Boolean(row.url || row.name), `${kind}: url or name`).toBe(true);
      expect(row.tall, `${kind}: tall`).toBeGreaterThan(0);
      expect(row.source, `${kind}: source`).toMatch(/^(game|site|mod:[a-z0-9-]+)$/);
    }
  });

  it('a game row is on the game’s skeleton or its own, from the 2017 crew’s folder', () => {
    for (const [kind, row] of rows.filter(([, r]) => r.source === 'game')) {
      expect(['walrus', 'own'], kind).toContain(row.rig);
      expect(fileOf(row), kind).toMatch(/^\/models\/galaxy\/bf2017\/crew\/[a-z0-9]+\.glb$/);
    }
  });

  it('a row on no rig of the game’s is not the game’s', () => {
    for (const [kind, row] of rows.filter(([, r]) => !r.rig)) expect(row.source, kind).not.toBe('game');
  });

  it('every site row says what could replace it, or null, and no other row does', () => {
    for (const [kind, row] of rows) {
      if (row.source === 'site') {
        expect('could' in row, `${kind}: could`).toBe(true);
        expect(row.could === null || (typeof row.could === 'string' && row.could.length > 0), `${kind}: could is a note or null`).toBe(true);
      } else expect('could' in row, `${kind}: could on a ${row.source} row`).toBe(false);
    }
  });

  it('has the file it names, in public/ or in the bucket', () => {
    for (const [kind, row] of rows) {
      expect(onDisk(committed(row)), `${kind}: ${committed(row)}`).toBe(true);
      for (const f of filesOf(row).slice(1)) expect(onDisk(f), `${kind}: ${f}`).toBe(true);
    }
  });
});

describe('reading it', () => {
  it('bodyOf gives a row, or null for a kind it hasn’t (a prototype’s name too)', () => {
    expect(bodyOf('stormtrooper')).toBe(BODIES.stormtrooper);
    expect(bodyOf('nobody')).toBeNull();
    expect(bodyOf('constructor')).toBeNull();
  });

  it('sourceOf says whose body a kind is', () => {
    expect(sourceOf('stormtrooper')).toBe('game');
    expect(sourceOf('tusken')).toBe('site');
    expect(sourceOf('nobody')).toBeNull();
  });

  it('gameFirst takes the game’s body over the site’s, else the first the table has', () => {
    expect(gameFirst(['gamorrean', 'gamorreanguard'])).toBe('gamorreanguard');
    expect(gameFirst(['nobody', 'tusken', 'twilek'])).toBe('tusken');
    expect(gameFirst(['han', 'luke'])).toBe('han');
    expect(gameFirst(['nobody'])).toBeNull();
    expect(gameFirst()).toBeNull();
  });
});
