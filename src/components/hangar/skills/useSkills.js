import { createContext, useContext } from 'react';
import { ACHIEVEMENTS } from '../../Achievements';
import { effectsOf, maxPoints } from './rules';
import { BATTLEFRONT } from './tree';

// The skill tree's context (SkillsProvider.jsx fills it) and its hook:
// useSkills() → { nodes, points: { earned, spent, free, max, legend }, can(id), take(id), reset(), resetCost,
//   resets, fx, picks, pick(crew, slot, id | null) }

export const COUNTABLE = Object.keys(ACHIEVEMENTS).filter((id) => !BATTLEFRONT.includes(id)).length;
export const MAX = maxPoints(COUNTABLE);
export const SkillsContext = createContext(null);

const NONE = { nodes: [], points: { earned: 0, spent: 0, free: 0, max: MAX, legend: 0 }, can: () => ({ ok: false, why: 'none' }), take: () => ({ ok: false, why: 'none' }), reset: () => ({ ok: false, why: 'none' }), resetCost: 0, resets: 0, fx: effectsOf([]), picks: {}, pick: () => {} };
// (outside the provider, as a test or a page with no App renders: nothing taken)
export const useSkills = () => useContext(SkillsContext) ?? NONE;
