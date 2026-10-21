// Every page’s pop-up, by the page’s id (./shire.js, ./wild.js, ./south.js),
// and the back pages’ grounds.

import { SCENES as SHIRE } from './shire';
import { SCENES as WILD } from './wild';
import { BACK_SCENES, SCENES as SOUTH } from './south';

export const SCENES = { ...SHIRE, ...WILD, ...SOUTH };
export { BACK_SCENES };
