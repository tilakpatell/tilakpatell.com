// Each kitchen's look, by its level's theme (see ./common.js for what a
// theme can say). A level with no theme, or one not here, is the Pony's.

import { AMON_HEN } from './amonhen';
import { CORMALLEN } from './cormallen';
import { HOUSES } from './houses';
import { INN } from './inn';
import { ITHILIEN } from './ithilien';
import { LORIEN } from './lorien';
import { MORIA } from './moria';
import { PARTY } from './party';
import { RIVENDELL } from './rivendell';
import { TOWER } from './tower';
import { WEATHERTOP } from './weathertop';

export const THEMES = { inn: INN, rivendell: RIVENDELL, moria: MORIA, lorien: LORIEN, amonhen: AMON_HEN, party: PARTY, weathertop: WEATHERTOP, ithilien: ITHILIEN, tower: TOWER, cormallen: CORMALLEN, houses: HOUSES };
export const themeOf = (level) => THEMES[level?.theme] ?? INN;
