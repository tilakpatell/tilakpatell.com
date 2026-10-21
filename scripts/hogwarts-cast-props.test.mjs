// hogwarts-cast-props.mjs's table and credits.
import { describe, expect, it } from 'vitest';
import { NAMES_NEVER } from './hogwarts-cast-figures.mjs';
import { credit, PROPS, words } from './hogwarts-cast-props.mjs';

describe('the things and the creatures', () => {
  it.each(Object.keys(PROPS))('%s is described by its look, with a budget a cut can meet', (name) => {
    expect(words(name)).not.toMatch(NAMES_NEVER);
    expect(PROPS[name].faces).toBeGreaterThanOrEqual(2000);
    expect(PROPS[name].faces).toBeLessThanOrEqual(60000);
    expect([1024, 2048]).toContain(PROPS[name].tex);
  });

  it('credits each as made here from a concept picture', () => {
    const c = credit('snitch');
    expect(c.name).toMatch(/^a small golden winged ball, for the Hogwarts world/);
    expect(c.name).toMatch(/concept picture/);
    expect(c.license).toBeTruthy();
  });

  it('refuses a thing it hasn’t', () => {
    expect(() => words('philosophers-stone')).toThrow(/no prop/);
  });
});
