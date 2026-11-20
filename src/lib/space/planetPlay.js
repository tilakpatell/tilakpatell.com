// What you can do at a generated planet, by its traits (./traits.js): survey
// it from orbit (once, worth more the more it has), probe its anomaly, search
// the moon that holds its secret, and brave its hazard, which drains the
// shields low in its orbit and pays once for staying through it. The
// surveys you've made are kept (SURVEY_KEY), the newest last: the planets
// you've found. Pure: the ledger is the things' (universe/things/rules.js
// createLedger), the storage is passed in.
//
//   ORBIT (radii from its middle you're in orbit within), LOW (radii it bites within)
//   PLAY: { survey: { most }, probe: { pay }, search: { pay, near }, brave: { secs, per } }
//   surveyPay(traits) → credits' worth, 1 a notable trait more, PLAY.survey.most at most
//   verbAt(traits, ledger, id, { harvest }) → 'survey' | 'probe' | 'harvest' | null: what E does in its orbit
//     now (harvest: whether there's a hold to take its resources into)
//   hazardDrain(level) → how many times an ion storm's drain the hazard is (0 for none)
//   SURVEY_KEY, SURVEY_CAP; addSurvey(list, id) → the list with it last, once, the newest kept
//   loadSurveys(store), saveSurveys(store, list): through a localStorage-like store, never throwing
//   hazardOf(traits) → { id, level: 'warn' | 'danger', n } | null: for the HUD, a hazard's weight (n its 1…3)
//   promptOf(traits, ledger, id) → { key: 'E', verb } | null: what E would do in its orbit now

export const ORBIT = 3;
export const LOW = 1.6;
export const PLAY = Object.freeze({
  survey: { most: 5 },
  probe: { pay: 4 },
  search: { pay: 3, near: 5 },
  brave: { secs: 8, per: 2 },
});

export const surveyPay = (traits) => Math.min(PLAY.survey.most, 1 + (traits?.tags?.length ?? 0));

export function verbAt(traits, ledger, id, { harvest = false } = {}) {
  if (!ledger.paid(`${id}:survey`)) return 'survey';
  if (traits.anomaly && !ledger.paid(`${id}:probe`)) return 'probe';
  // (then, with a hold to fill, its resources: the market's harvest says when it's worked out)
  if (harvest && traits.resources?.length) return 'harvest';
  return null;
}

// (pirates are the system's, not the planet's air: they come as ships, not a drain)
export const hazardDrain = (hazard) => (hazard && hazard.id !== 'pirates' ? 0.5 * hazard.level : 0);

export const SURVEY_KEY = 'tp-surveys';
export const SURVEY_CAP = 1000;
export function addSurvey(list, id) {
  const was = Array.isArray(list) ? list.filter((x) => typeof x === 'string' && x !== id) : [];
  return typeof id === 'string' ? [...was, id].slice(-SURVEY_CAP) : was;
}
export function loadSurveys(store) {
  try {
    const v = JSON.parse(store?.getItem(SURVEY_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
export function saveSurveys(store, list) {
  try {
    store?.setItem(SURVEY_KEY, JSON.stringify(list));
  } catch {
    /* (a private window: the log lives this visit) */
  }
}

// (for the HUD: a level 3 hazard is a danger, a lesser one a warning; pirates come as ships)
export function hazardOf(traits) {
  const h = traits?.hazard;
  if (!h || h.id === 'pirates') return null;
  return { id: h.id, level: h.level >= 3 ? 'danger' : 'warn', n: h.level };
}
export function promptOf(traits, ledger, id) {
  const verb = traits ? verbAt(traits, ledger, id) : null;
  return verb ? { key: 'E', verb } : null;
}
