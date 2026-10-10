import { describe, expect, it } from 'vitest';
import { bodiesFor, firstBody, standInLine } from './standIn';
import { heroById, heroSpec, readHero } from '../heroes';

const specOf = (id) => heroSpec(readHero({ id }));

describe('the bodies a hero may walk in', () => {
  it('tries the game’s body, then the site’s figure, then a trooper of their side', () => {
    const tries = bodiesFor(specOf('luke'), heroById('luke'));
    expect(tries.map((t) => t.stoodIn)).toEqual([null, 'meshy', 'standin']);
    expect(tries[1].spec.src.url).toBe('/models/galaxy/crew/luke.glb');
    expect(tries[1].spec.rig).toBeUndefined();
    expect(tries[2].spec.src.url).toBe('/models/galaxy/bf2017/crew/rebel.glb');
    expect(tries[2].spec.rig).toBe('walrus');
    // (the hero's arms go with every body)
    expect(tries[2].spec.saber).toEqual(tries[0].spec.saber);
  });
  it('a hero with no figure of the site’s goes straight to the trooper, the dark side’s white', () => {
    const tries = bodiesFor(specOf('maul'), heroById('maul'));
    expect(tries.map((t) => t.stoodIn)).toEqual([null, 'standin']);
    expect(tries[1].spec.src.url).toContain('stormtrooper');
  });
  it('a figure not on the game’s skeleton has only itself', () => {
    expect(bodiesFor(specOf('rick'), heroById('rick'))).toHaveLength(1);
    // (and one of the roster's alone is stood in: a droid is never a trooper)
    expect(bodiesFor(specOf('luke'), null)).toHaveLength(1);
  });
  it('the first that loads wins, and a failed fetch is never the end', async () => {
    const tries = bodiesFor(specOf('luke'), heroById('luke'));
    const asked = [];
    const load = async (s) => {
      asked.push(s.src.url);
      if (s.src.url.includes('bf2017/crew/luke')) throw new Error('404');
      return { id: s.src.url };
    };
    const got = await firstBody(tries, load);
    expect(got.stoodIn).toBe('meshy');
    expect(asked).toHaveLength(2);
    const none = await firstBody(tries, async () => null);
    expect(none).toBeNull();
    const own = await firstBody(tries, async (s) => s);
    expect(own.stoodIn).toBeNull();
  });
  it('says so plainly, and nothing when it’s their own body', () => {
    expect(standInLine('Luke Skywalker', 'meshy')).toMatch(/^Luke Skywalker, in the site’s own figure/);
    expect(standInLine('Luke Skywalker', 'standin')).toMatch(/trooper/);
    expect(standInLine('Luke Skywalker', null)).toBeNull();
  });
});
