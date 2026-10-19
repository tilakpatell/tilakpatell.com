import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAchievements } from '../../Achievements';
import { tellSkills, useEconomy } from '../../universe/shared/wallet';
import { localSaves } from '../../../runtime/local';
import { canTake, effectsOf, legendRank, pointsOf, readSkills, resetCost, withTaken } from './rules';
import { NODES } from './tree';
import { MAX, SkillsContext } from './useSkills';
import { POWERS_KEY, POWERS_VERSION, readPicks, setPick } from './powerPicks';

// The skill tree's state for the whole site: the points (from the wallet's
// level and xp, and the achievements unlocked), the nodes taken (kept in
// `tp-skills`, versioned), what they do (`fx`, for the pages to hand their
// worlds), and the powers each crew carries (`tp-powers`). Mounted in App.jsx
// inside the wallet's provider; it reads the wallet without asking for it
// (the pages that fly ask), so the classic pages load nothing for it. The
// save is read again when the window comes back into focus or another tab
// writes it, so two tabs don't spend the same points twice.
//
// (useSkills.js has the hook that reads it)

const SKILLS_KEY = 'tp-skills';
const SKILLS_VERSION = 1;
const costOf = (nodes) => nodes.reduce((s, id) => s + (NODES[id]?.cost ?? 0), 0);

const register = (saves) => {
  saves.register({ key: SKILLS_KEY, version: SKILLS_VERSION, migrate: (old) => old });
  saves.register({ key: POWERS_KEY, version: POWERS_VERSION, migrate: (old) => old });
};
const readSaved = () => {
  const saves = localSaves();
  register(saves);
  const raw = saves.get(SKILLS_KEY, null);
  return { nodes: Array.isArray(raw?.nodes) ? raw.nodes : [], resets: Number.isInteger(raw?.resets) && raw.resets > 0 ? raw.resets : 0, picks: readPicks(saves.get(POWERS_KEY, null)) };
};
const write = (next) => {
  const saves = localSaves();
  register(saves);
  if ('nodes' in next) saves.set(SKILLS_KEY, { nodes: next.nodes, resets: next.resets });
  if ('picks' in next) saves.set(POWERS_KEY, next.picks);
};

export default function SkillsProvider({ children }) {
  const { economy } = useEconomy({ ask: false }); // (its context moves on with every earning: this re-renders then)
  const { unlocked } = useAchievements();
  const [saved, setSaved] = useState(readSaved);

  // (another tab's taking or resetting, or this one's coming back into view: read again)
  useEffect(() => {
    const again = () => setSaved(readSaved());
    const onStorage = (e) => (e.key === SKILLS_KEY || e.key === POWERS_KEY) && again();
    window.addEventListener('focus', again);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('focus', again);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const record = economy?.record?.() ?? null;
  const level = record?.level ?? 1;
  const xp = record?.xp ?? 0;
  const tree = useMemo(() => {
    const points = pointsOf({ level, xp, achievements: unlocked });
    const ctx = { earned: points.earned, achievements: unlocked };
    const nodes = readSkills({ nodes: saved.nodes }, ctx);
    // (the wallet's told here, as the nodes are read, so the shipyard below draws its skill locks from these)
    tellSkills(nodes);
    return { nodes, ctx, points, xp, fx: effectsOf(nodes) };
  }, [level, xp, unlocked, saved.nodes]);

  // (taken onto the save as it was, and only once the wallet's in: before
  // it, the levels' points aren't counted yet, and a save written then would
  // keep only what the achievements alone pay for)
  const take = useCallback(
    (id) => {
      if (!economy) return { ok: false, why: 'loading' };
      const r = canTake(tree.nodes, id, tree.ctx);
      if (!r.ok) return r;
      const nodes = withTaken(saved.nodes, id);
      setSaved((s) => ({ ...s, nodes }));
      write({ nodes, resets: saved.resets });
      return r;
    },
    [economy, tree, saved.nodes, saved.resets],
  );
  const cost = resetCost(saved.resets);
  const reset = useCallback(() => {
    if (!economy) return { ok: false, why: 'loading' };
    if (!tree.nodes.length) return { ok: false, why: 'empty' };
    if (cost > 0 && !economy?.spend(cost)) return { ok: false, why: 'credits' };
    const resets = saved.resets + 1;
    setSaved((s) => ({ ...s, nodes: [], resets }));
    write({ nodes: [], resets });
    return { ok: true, why: null };
  }, [tree.nodes, cost, economy, saved.resets]);
  const pick = useCallback(
    (crew, slot, id) => {
      const picks = setPick(saved.picks, crew, slot, id);
      setSaved((s) => ({ ...s, picks }));
      write({ picks });
    },
    [saved.picks],
  );

  const value = useMemo(() => {
    const spent = costOf(tree.nodes);
    return {
      nodes: tree.nodes,
      points: { earned: tree.points.earned, spent, free: tree.points.earned - spent, max: MAX, legend: legendRank(tree.xp) },
      can: (id) => canTake(tree.nodes, id, tree.ctx),
      take,
      reset,
      resetCost: cost,
      resets: saved.resets,
      fx: tree.fx,
      picks: saved.picks,
      pick,
    };
  }, [tree, take, reset, cost, saved.resets, saved.picks, pick]);

  return <SkillsContext.Provider value={value}>{children}</SkillsContext.Provider>;
}
