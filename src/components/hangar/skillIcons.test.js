import { describe, expect, it } from 'vitest';
import { NODES } from './skills/tree';
import { SKILL_ICONS } from './skillIcons';

describe('the skill tree’s marks', () => {
  it('give every node a mark of its own on the board', () => {
    for (const id of Object.keys(NODES)) expect(SKILL_ICONS[id], id).toBeTruthy();
    expect(Object.keys(SKILL_ICONS).sort()).toEqual(Object.keys(NODES).sort());
  });
});
