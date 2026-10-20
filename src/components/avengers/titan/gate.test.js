import { describe, expect, it } from 'vitest';
import { HEIST_ROWS, snapGate } from './gate';
import { linkOf } from '../world/links';

describe('the snap’s gate', () => {
  it('is locked with no stones: six left, the workshop next', () => {
    expect(snapGate([])).toEqual({ ready: false, left: 6, label: '6 stones left', next: { id: 'stark', name: 'Tony Stark’s workshop', to: '/avengers/workshop' } });
    expect(snapGate([]).next.to).toBe(linkOf('stark'));
  });
  it('counts a half of the Soul Stone as no stone, and sends you to the other half', () => {
    const g = snapGate(['space', 'mind', 'reality', 'power', 'time', 'soul-clint']);
    expect(g).toMatchObject({ ready: false, left: 1, label: '1 stone left' });
    expect(g.next).toEqual({ id: 'widow', name: 'Operations', to: linkOf('widow') });
  });
  it('opens only with all six won in play', () => {
    expect(snapGate(['space', 'mind', 'reality', 'power', 'time', 'soul-clint', 'soul-natasha', 'soul'])).toEqual({ ready: true, left: 0, label: null, next: null });
    expect(snapGate(['space', 'mind', 'reality', 'power', 'time', 'soul'])).toMatchObject({ ready: true, next: null });
    expect(snapGate(['power', 'mind']).next.id).toBe('thor');
  });
  it('ignores anything that is not a stone', () => {
    expect(snapGate(['aether', 'spidey', 'soul-clint'])).toMatchObject({ ready: false, left: 6 });
  });
  it('lists the seven buildings with a stone, in the tour’s order', () => {
    expect(HEIST_ROWS.map((r) => r.id)).toEqual(['stark', 'thor', 'cap', 'hawkeye', 'widow', 'banner', 'vault']);
    expect(HEIST_ROWS[0]).toEqual({ id: 'stark', name: 'Tony Stark’s workshop' });
  });
});
