import { describe, expect, it } from 'vitest';
import { EARN } from '../universe/shared/wallet';
import { RM_EARN, earnOf, seedsOf } from './earn';

describe('what Rick and Morty’s deeds pay (the one wallet’s keys)', () => {
  it('pays every deed with a key the wallet has', () => {
    for (const [deed, what] of Object.entries(RM_EARN)) expect(EARN[what], deed).toBeTruthy();
    expect(RM_EARN).toMatchObject({ task: 'questDone', citadel: 'questDone', quest: 'questDone', found: 'found', duel: 'killAce', parasite: 'killPirate', boss: 'killCapital', patrol: 'killHunter' });
  });
  it('pays what can be done once only once: a task, a Citadel quest, a planet’s quest or place', () => {
    expect(earnOf('task', 'president')).toEqual({ what: 'questDone', once: 'task:president' });
    expect(earnOf('citadel', 'daycare')).toEqual({ what: 'questDone', once: 'citadel:daycare' });
    expect(earnOf('quest', 'heist', 'gazorpazorp')).toEqual({ what: 'questDone', once: 'quest:gazorpazorp:heist' });
    expect(earnOf('found', 'temple', 'squanch')).toEqual({ what: 'found', once: 'found:squanch:temple' });
  });
  it('pays a fight won every time', () => {
    for (const deed of ['duel', 'parasite', 'boss', 'patrol']) expect(earnOf(deed, 'x').once, deed).toBe(null);
  });
  it('pays nothing for a deed it doesn’t know, or a once-deed with no id', () => {
    expect(earnOf('nope', 'x')).toBe(null);
    expect(earnOf('task', null)).toBe(null);
  });
  it('seeds the ledger with what the saves say is done', () => {
    expect(seedsOf('task', ['a', 'b'])).toEqual(['task:a', 'task:b']);
    expect(seedsOf('found', ['t'], 'squanch')).toEqual(['found:squanch:t']);
    expect(seedsOf('task', null)).toEqual([]);
  });
});
