import { describe, expect, it } from 'vitest';
import { newsHeard } from './news';

const IN = { area: 'heistcon', fading: false };
const FADING = { area: 'heistcon', fading: true };
const HERE = { area: 'heistcon' };

describe('what a place says, heard or not', () => {
  it('hears the place Morty’s in, and no other', () => {
    for (const name of ['caught', 'bark', 'note', 'done', 'spotted', 'duel', 'strike']) expect(newsHeard(name, IN, HERE), name).toBe(true);
    expect(newsHeard('done', IN, { area: 'gearworld' })).toBe(false);
    expect(newsHeard('caught', IN, { area: 'gearworld' })).toBe(false);
    expect(newsHeard('done', null, HERE)).toBe(false);
  });

  it('lets a win through a fade: a catch in the frame the last booth’s lifted keeps the job done', () => {
    expect(newsHeard('done', FADING, HERE)).toBe(true);
    expect(newsHeard('done', FADING, { area: 'gearworld' })).toBe(false);
  });

  it('hears nothing else while he’s fading: no second catch, no bark, no hunter’s word', () => {
    for (const name of ['caught', 'bark', 'note', 'spotted', 'miss', 'throw', 'duel', 'strike']) expect(newsHeard(name, FADING, HERE), name).toBe(false);
  });
});
