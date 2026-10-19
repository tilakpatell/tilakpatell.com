// Who's on your side: an ally (allies.js, allyStep) or a mate in your party
// (partyLink.js marks a present member `mate: true`). One question, asked
// everywhere a pilot is coloured or spared (the ally green on the tags, the
// ghosts and the roster; no friendly fire in protocol.js's hitCounts and
// ramCounts), so a party mate is never treated as a stranger in one place and
// a friend in another. Someone blocked is no one's mate, whatever else they
// were. Pure, so it's tested in Node.

export const isMate = (p) => Boolean(p) && !p.blocked && (p.ally === 'ally' || p.mate === true);
