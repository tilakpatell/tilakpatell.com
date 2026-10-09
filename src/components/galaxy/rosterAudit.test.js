import { describe, expect, it } from 'vitest';
import { auditRoster, kindsOfPiece, mixes } from './rosterAudit';

describe('the roster audit', () => {
  it('reads every ship a piece names', () => {
    expect(kindsOfPiece({ type: 'chase', runner: { kind: 'corvette' }, hunter: { kind: 'destroyer' } })).toEqual(['corvette', 'destroyer']);
    expect(kindsOfPiece({ type: 'escape', kind: 'transport', escort: 'xwing' })).toEqual(['transport', 'xwing']);
    expect(kindsOfPiece({ type: 'stream', kinds: ['xwing', 'ywing'] })).toEqual(['xwing', 'ywing']);
    expect(kindsOfPiece({ type: 'fleet', side: 'empire', ships: [{ kind: 'destroyer' }] })).toEqual(['destroyer']);
    expect(kindsOfPiece({ type: 'battle', sides: { rebel: [{ kind: 'moncal' }], empire: [{ kind: 'executor' }] }, fighters: { rebel: ['xwing'], empire: ['tie'] } })).toEqual(['moncal', 'executor', 'xwing', 'tie']);
    expect(kindsOfPiece({ type: 'rocks' })).toEqual([]);
  });
  it('walks every source of every war', () => {
    const rows = auditRoster();
    const sources = new Set(rows.map((r) => r.source.split(':')[0]));
    for (const s of ['template', 'hutts', 'runners', 'owners', 'roles', 'hunters', 'interdiction', 'ace', 'outofwar', 'scenery']) expect(sources.has(s), s).toBe(true);
    for (const war of ['clone', 'gcw', 'remnant']) expect(rows.some((r) => r.war === war), war).toBe(true);
  });
  it('finds no ship flown in the wrong war or by the wrong side', () => {
    expect(mixes().map((r) => `${r.war} ${r.side} ${r.source} ${r.kind}`)).toEqual([]);
  });
});
