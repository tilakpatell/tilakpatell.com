// The sector's whole-sector lists, lane 4a's: everything between the
// systems (low ids, w3 to w63) and round them (high ids, w20000 and up), in
// the order they are made, each list told the lists before it. things.js
// imports none of them, so every list can import its constants with no cycle.
//
// SECTOR_EXTRAS: [{ list, base, max, make(ctx, made) → rows }] (things.js's thingsOf says the rules)

export const SECTOR_EXTRAS = [];
