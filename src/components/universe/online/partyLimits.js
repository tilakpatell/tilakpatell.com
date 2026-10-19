// A party's sizes, in a module that imports nothing: the signer worker seals
// and opens the chat (partyCrypt.js) and needs only these numbers, and
// partyWire.js's imports (names, places, the universes) would ride into the
// worker with them, four times its size. partyWire.js says what each means.

export const PARTY_MAX = 8;
export const CHAT_MAX = 200; // characters of a line

// The longest blob a line seals to (partyCrypt.js): the IV (12 bytes), the
// text's length (2) and CHAT_MAX characters at four bytes each, zero-filled
// to a multiple of 32, then the tag (16), in base64url with no padding. Four
// bytes a character so a full line fits in any script: Gujarati or Chinese
// take three, an emoji four, and a line cut short on the wire is a line lost.
export const BLOB_MAX = Math.ceil(((12 + Math.max(32, Math.ceil((2 + CHAT_MAX * 4) / 32) * 32) + 16) * 4) / 3);

// a leader's summons at most this often (partyLink.js sends it, the dialog
// says when the next may go)
export const SUMMON_GAP = 5000;
