// The universe's face for being online: how stale a peer is, how often one
// may speak, what a name may be, and who is on your side (an ally or a party
// mate), for a world with peers of its own.

export { STALE_MS, createLimiter } from '../online/protocol';
export { cleanName } from '../online/names';
export { isMate } from '../online/mates';
