// What the book keeps between visits (the design’s §4): the characters
// met, in the order met; the pages whose thing under the Ring was found;
// the toys touched ('page:toy'). Saved through rt.saves under KEEP.
//
//   emptyKeep(), meet(keep, who), find(keep, pageId), touch(keep, pageId, toyId),
//   allFound(keep), readKeep(saved) → a keep (a save it can’t read starts again)

import { PAGES } from './pages';

export const KEEP = { key: 'redbook', version: 1 };

const ids = new Set(PAGES.map((p) => p.id));
const add = (list, x) => (list.includes(x) ? list : [...list, x]);

export const emptyKeep = () => ({ met: [], found: [], toys: [] });
export const meet = (k, who) => ({ ...k, met: add(k.met, who) });
export const find = (k, page) => (ids.has(page) ? { ...k, found: add(k.found, page) } : k);
export const touch = (k, page, toy) => ({ ...k, toys: add(k.toys, `${page}:${toy}`) });
export const allFound = (k) => PAGES.every((p) => k.found.includes(p.id));

const strings = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');
export function readKeep(saved) {
  if (!saved || !strings(saved.met) || !strings(saved.found) || !strings(saved.toys ?? [])) return emptyKeep();
  return { met: [...saved.met], found: saved.found.filter((x) => ids.has(x)), toys: [...(saved.toys ?? [])] };
}
