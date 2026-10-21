// The way into the Road: the save, the resume card and the first visit.
// Pure, beside the module and the page that use it.
//
//   SAVE: the store’s key and shape version; a save is { v, s, ridden, at, walked, on }
//     (walked: the share of the Road walked, not jumped by the ribbon or
//     skipped, so skipping to the end doesn’t count as riding it; on: when
//     it was first ridden, for the journal, kept from then on)
//   savedAt(s, now, ridden, walked, on) → the save to write
//   resume(save, now) → { s, showTitle }: a world mounted again within a
//     minute of its last save (a lost context put back) carries on without
//     its stage’s title card a second time; a ride saved at its end starts
//     again at Bag End
//   recent(save, now) → whether the save is that fresh
//   shouldOffer(save) → whether to offer “Carry on from …” (past Hobbiton’s first 40 m)
//   ridden(save) → the Road counts as ridden (two thirds of it walked, or marked so)
//   firstVisitRides(saves, unlocked, { flag }) → whether /middle-earth sends
//     this visitor down the Road first: no Middle-earth seal, no ride, not
//     sent already this session. FIRST_VISIT_RIDES is the owner’s switch.

import { CHAPTERS } from '../chapters';
import { sOf } from './line';
import { STAGES } from './stages/index';

export const SAVE = { key: 'tp-road', version: 1 };
export const OFFERED = 'tp-road-offered'; // sessionStorage: sent down the Road once
export const FIRST_VISIT_RIDES = true;
const RESUME_QUIET = 60_000; // ms
const OFFER_FROM = sOf(STAGES, 'hobbiton', 40);
const RIDDEN = 2 / 3;

export const savedAt = (s, now, wasRidden, walked = 0, on = null) => ({ v: SAVE.version, s, ridden: Boolean(wasRidden), at: now, walked, on: wasRidden ? (on ?? now) : null });

export function resume(save, now) {
  // (none, or a ride that reached the Havens: Bag End again)
  if (!save || !Number.isFinite(save.s) || save.s >= 1) return { s: 0, showTitle: true };
  return { s: save.s, showTitle: !(Number.isFinite(save.at) && now - save.at <= RESUME_QUIET) };
}

export const recent = (save, now) => Boolean(save && Number.isFinite(save.at) && now - save.at <= RESUME_QUIET && save.s < 1);

export const shouldOffer = (save) => Boolean(save && save.s > OFFER_FROM);

export const ridden = (save) => Boolean(save && (save.ridden || (save.walked ?? 0) >= RIDDEN));

export function firstVisitRides(saves, unlocked = [], { flag = FIRST_VISIT_RIDES } = {}) {
  if (!flag) return false;
  const have = new Set(unlocked);
  if (CHAPTERS.some((c) => c.seals.some((s) => have.has(s)))) return false;
  if (saves?.get?.(SAVE.key, null) != null) return false;
  return !saves?.session?.get?.(OFFERED, false);
}
