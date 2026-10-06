import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CREW, fileOf } from './crew';

const at = (path) => new URL(`../../../../public${path}`, import.meta.url);

describe('the surfaces’ crew', () => {
  it('has a model in the site for each of them', () => {
    for (const [kind, c] of Object.entries(CREW)) expect(existsSync(at(fileOf(c))), `${kind}: ${fileOf(c)}`).toBe(true);
  });

  it('has Luke and Leia, rigged on the same skeleton as Han, and Chewie, whose model is the cockpits’', () => {
    expect(fileOf(CREW.han)).toBe('/models/galaxy/crew/han.glb');
    expect(CREW.luke).toEqual({ url: '/models/galaxy/crew/luke.glb', tall: 1.72 });
    expect(CREW.leia).toEqual({ url: '/models/galaxy/crew/leia.glb', tall: 1.5 });
    expect(CREW.chewie).toMatchObject({ url: '/models/cockpit/chewie.glb', tall: 2.28 });
  });
});
