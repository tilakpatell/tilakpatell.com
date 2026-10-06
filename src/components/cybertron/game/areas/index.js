// The places Cybertron's world has, by id, and every mission in one list
// (each told which area it's played in: its own `area`, or its giver's).

import { BASE } from './base';
import { IACON } from './iacon';
import { JASPER } from './jasper';
import { KAON } from './kaon';

export const AREAS = { iacon: IACON, base: BASE, jasper: JASPER, kaon: KAON };

export const areaOf = (id) => AREAS[id] ?? IACON;

export const MISSIONS = Object.values(AREAS).flatMap((a) => (a.missions ?? []).map((m) => ({ ...m, area: m.area ?? a.id, from: a.id })));

export const missionById = (id) => MISSIONS.find((m) => m.id === id) ?? null;
