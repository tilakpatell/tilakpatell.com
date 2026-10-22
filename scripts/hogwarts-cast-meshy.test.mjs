// hogwarts-cast-meshy.mjs: which account a figure goes on, and its credit.
import { describe, expect, it } from 'vitest';
import { ACCOUNTS, COST, account, credit } from './hogwarts-cast-meshy.mjs';

describe('a figure made with Meshy', () => {
  const need = COST.model + COST.rig + COST.idle;

  it('starts on the first account that can pay for all of it, and keeps to it', () => {
    expect(account(undefined, { [ACCOUNTS[0]]: 1, [ACCOUNTS[1]]: need, [ACCOUNTS[2]]: 600 })).toBe(ACCOUNTS[1]);
    expect(account(undefined, { [ACCOUNTS[0]]: need - 1 })).toBe(null);
    // (a task is read only by the account that made it)
    expect(account({ acc: ACCOUNTS[2] }, { [ACCOUNTS[0]]: 900 })).toBe(ACCOUNTS[2]);
  });

  it('is credited to Meshy and the site owner, from a picture drawn here', () => {
    const c = credit('snape');
    expect(c.source).toBe('https://www.meshy.ai');
    expect(c.name).toMatch(/^Snape, a big-headed toy figure/);
    expect(c.name).toMatch(/scripts\/hogwarts-cast-meshy\.mjs/);
    expect(c.authors).toEqual(['Tilak Patel, with Meshy AI']);
  });
});
