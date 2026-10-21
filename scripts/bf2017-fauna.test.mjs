import { describe, expect, it } from 'vitest';
import { FAUNA } from '../src/lib/three/walrusSets/fauna.js';
import { importArgs, packArgs } from './bf2017-fauna.mjs';

describe('the fauna’s import', () => {
  it('imports a beast on its own rig at full fidelity, what it wears with it', () => {
    expect(importArgs('dewback', FAUNA.dewback)).toEqual([FAUNA.dewback.model, '--kind', 'dewback', '--as', 'The game’s dewback', '--rig', '--crew', '--full', '--join', '--parts', '*_saddle_mesh', '--cuts', 'lod1=3']);
    expect(importArgs('jawa', FAUNA.jawa)).not.toContain('--parts');
  });

  it('reads the desktop’s export where asked, and cuts a far one', () => {
    const root = 'C:/Users/tilak/Downloads/BF2_Extract';
    expect(importArgs('bantha', FAUNA.bantha, { far: true, root }).slice(-3)).toEqual(['--far', '--root', root]);
    expect(packArgs('bantha', { root })).toEqual(['bantha', '--root', root]);
    expect(packArgs('bantha')).toEqual(['bantha']);
  });

  it('passes a row’s own cuts and its light cut’s map sizes on', () => {
    const args = importArgs('x', { model: 'm', body: 'x', cuts: 'lod1=3', light: { tex: 512, maps: 256 } });
    expect(args.slice(args.indexOf('--cuts'), args.indexOf('--cuts') + 2)).toEqual(['--cuts', 'lod1=3']);
    expect(args.slice(args.indexOf('--lod1-tex'), args.indexOf('--lod1-tex') + 4)).toEqual(['--lod1-tex', '512', '--lod1-maps', '256']);
    expect(importArgs('jawa', FAUNA.jawa)).not.toContain('--lod1-tex');
  });
});
