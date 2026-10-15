// A model for every actor type and prop kind: the loaded one where there is
// one (./hd.js, once loadHd() has them), or the one made in code. Actors with
// nothing to see (the iron balls' spawner) get an empty group.

import * as THREE from 'three';
import { CAST } from './cast';
import { HD_FOR, hdCopy } from './hd';
import { PROPS, THINGS } from './things';

export { makeMario } from './mario';

const NONE = () => ({ root: new THREE.Group(), update() {} });
// (a Bob-omb's materials are its own: it glows red when lit, and not its neighbours)
const OWN = new Set(['bobomb', 'king']);
const loadedFor = (type) => (HD_FOR[type] ? hdCopy(HD_FOR[type], { own: OWN.has(type) }) : null);

export const makeActor = (a) => (THINGS[a.type] ?? CAST[a.type] ?? NONE)(a, loadedFor(a.type));
export const makeProp = (p) => (PROPS[p.kind] ?? NONE)(p, loadedFor(p.kind));
