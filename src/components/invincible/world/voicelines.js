// What the Graysons' city says aloud, for the voices (scripts/voices): each
// line as ./InvWorld.jsx shows it, by whose voice it's in. A person's voice
// is by who they are (Dad is Omni-Man) or, for a townsperson, by the part
// they play: the manager, the classmates and the fans are all the one city
// voice.
import { CALLS, HERO_LINES, LINES, RINGS_DONE } from './lines';

export const VOICE = { debbie: 'debbie', cecil: 'cecil', eve: 'eve', omni: 'omniman', omniman: 'omniman', allen: 'allen', thragg: 'thragg', manager: 'invcitizen', student: 'invcitizen', fan: 'invcitizen' };

export const VOICELINES = [
  ...Object.entries(LINES).flatMap(([who, lines]) => lines.map((text) => ({ who: VOICE[who], text }))),
  ...[...Object.values(CALLS), RINGS_DONE].map(({ who, text }) => ({ who: VOICE[who], text })),
  ...Object.entries(HERO_LINES).flatMap(([who, lines]) => lines.map((text) => ({ who: VOICE[who], text }))),
];
