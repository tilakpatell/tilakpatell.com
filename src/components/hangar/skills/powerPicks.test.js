import { describe, expect, it } from 'vitest';
import { POWERS_KEY, readPicks, setPick } from './powerPicks';

describe('the powers each crew carries, as kept', () => {
  it('reads only the crews and slots there are, as ids', () => {
    expect(readPicks({ xwing: { primary: 'portal', ultimate: 3, x: 'y' }, tie: { primary: 'focus' }, rv: 'junk' })).toEqual({ xwing: { primary: 'portal' } });
    expect(readPicks(JSON.stringify({ falcon: { ultimate: 'wubba' } }))).toEqual({ falcon: { ultimate: 'wubba' } });
    expect(readPicks('{nope')).toEqual({});
    expect(POWERS_KEY).toBe('tp-powers');
  });
  it('sets a slot, and back to the crew’s own with null', () => {
    const was = { xwing: { primary: 'portal' } };
    expect(setPick(was, 'xwing', 'ultimate', 'wubba')).toEqual({ xwing: { primary: 'portal', ultimate: 'wubba' } });
    expect(setPick(was, 'xwing', 'primary', null)).toEqual({});
    expect(was).toEqual({ xwing: { primary: 'portal' } });
  });
});
