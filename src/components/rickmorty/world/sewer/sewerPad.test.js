import { describe, expect, it } from 'vitest';
import { sewerPad } from './sewerPad';

const up = { a: false, b: false, x: false, start: false, left: false, right: false };
const press = (k) => ({ ...up, [k]: true });

describe('the sewer run on a controller', () => {
  it('on the first card, A rolls and B goes back up the hole', () => {
    expect(sewerPad(press('a'), up, 'intro')).toEqual({ phase: 'play' });
    expect(sewerPad(press('b'), up, 'intro')).toEqual({ leave: true });
  });

  it('paused, A or Start plays on and B leaves; in the run, Start pauses and the rest are the run’s', () => {
    expect(sewerPad(press('a'), up, 'paused')).toEqual({ phase: 'play' });
    expect(sewerPad(press('start'), up, 'paused')).toEqual({ phase: 'play' });
    expect(sewerPad(press('b'), up, 'paused')).toEqual({ leave: true });
    expect(sewerPad(press('start'), up, 'play')).toEqual({ phase: 'paused' });
    expect(sewerPad(press('a'), up, 'play')).toEqual({ press: ['hop'] });
    expect(sewerPad(press('x'), up, 'play')).toEqual({ press: ['fire'] });
    expect(sewerPad({ ...up, left: true, b: true }, up, 'play')).toEqual({ press: ['left', 'fire'] });
  });

  it('won or lost, A or B goes back up', () => {
    for (const phase of ['won', 'lost']) {
      expect(sewerPad(press('a'), up, phase)).toEqual({ leave: true });
      expect(sewerPad(press('b'), up, phase)).toEqual({ leave: true });
    }
  });

  it('takes a press, not a hold, and nothing from the first frame (the A that opened the sewer is still down)', () => {
    expect(sewerPad(press('a'), press('a'), 'intro')).toEqual({});
    expect(sewerPad(press('a'), null, 'intro')).toEqual({});
    expect(sewerPad(null, up, 'intro')).toEqual({});
  });
});
