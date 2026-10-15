// The save: the stars got in each course, the look and the sound, kept as
// `tp-m64` (version 1). readSave and writeSave take any store with getItem
// and setItem; storage that throws (a private window) never stops the
// game, which plays on with what it has in memory. What's read is cleaned:
// only the five courses, three booleans each, a known look.

export const SAVE = 'tp-m64';
export const SAVE_VERSION = 1;
const COURSE_IDS = ['bobomb', 'snow', 'beach', 'haunt', 'bowser'];
export const LOOKS = ['modern', 'ultra', 'n64'];

export const blank = () => ({ stars: {}, look: 'modern', sound: true });

export const starTotal = (save) => Object.values(save?.stars ?? {}).reduce((n, list) => n + (Array.isArray(list) ? list.filter(Boolean).length : 0), 0);

export const hasStar = (save, course, index) => Boolean(save?.stars?.[course]?.[index]);

export function clean(raw) {
  const s = blank();
  const data = raw && typeof raw === 'object' && 'v' in raw && 'data' in raw ? raw.data : raw;
  if (!data || typeof data !== 'object') return s;
  for (const id of COURSE_IDS) {
    const list = data.stars?.[id];
    if (Array.isArray(list)) s.stars[id] = [0, 1, 2].map((i) => list[i] === true);
  }
  if (LOOKS.includes(data.look)) s.look = data.look;
  if (typeof data.sound === 'boolean') s.sound = data.sound;
  return s;
}

export function readSave(store) {
  try {
    const text = store?.getItem(SAVE);
    return text ? clean(JSON.parse(text)) : blank();
  } catch {
    return blank();
  }
}

export function writeSave(store, s) {
  try {
    store?.setItem(SAVE, JSON.stringify({ v: SAVE_VERSION, data: s }));
  } catch {
    /* storage unavailable: the game keeps it in memory */
  }
}

export function giveStar(save, course, index) {
  const list = save.stars[course] ?? [false, false, false];
  const fresh = !list[index];
  list[index] = true;
  save.stars[course] = list;
  return fresh;
}
