// Blast, drawn and run in the surface scene: the galactic assault's
// drawing (assaultScene.js: the soldiers' figures, their chevrons, cover
// and falls, the tracers, the two spawns' columns) on Blast's rules
// (./blast.js), its interface the same, so the surface scene runs it as it
// runs a battle.
//
// createBlastMission(opts) → createAssaultMission's, on BLAST.

import { createAssaultMission } from './assaultScene';
import { RULES, blastView, chooseSide, deploy, endBlast, hitSoldier, newBlast, stepBlast, youDown } from './blast';

export const BLAST = { newBattle: newBlast, stepBattle: stepBlast, chooseSide, deploy, hitSoldier, youDown, view: blastView, end: endBlast, n: RULES.n };

export const createBlastMission = (opts) => createAssaultMission({ ...opts, engine: BLAST });
