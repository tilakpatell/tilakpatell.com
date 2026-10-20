// Quick chat: a few set lines any pilot can say to the whole room, shown over
// them for a moment wherever they're drawn (a bubble over the ship tags, the
// page pointers, the ghosts in a world). Only a line's index goes over the
// wire (`quip { q }`, partyWire.js reads it), so there's nothing free-form in
// public and nothing to filter: a stranger can say only what's written here.
// Pure, so it's tested in Node.
//
// QUIPS: the lines, in the order their indexes name them (only ever added to
// at the end: a pilot on an older build reads an index by its own list);
// QUIP_MS: how long one shows; quipText(i) → the line, or null if i isn't one.

export const QUIPS = Object.freeze(['Hello', 'Bye for now', 'On my way', 'Follow me', 'Wait for me', 'Over here', 'Look at this', 'Nice one', 'Thanks', 'Sorry', 'Yes', 'No', 'Ready?', 'Let’s go', 'Need a hand?', 'Watch out', 'Well played', 'Good game', 'Back in a bit', 'See you at the map']);
export const QUIP_MS = 6000; // how long one shows

// (a whole index only: QUIPS['length'] is a number, not a line)
export const quipText = (i) => (Number.isInteger(i) ? (QUIPS[i] ?? null) : null);
