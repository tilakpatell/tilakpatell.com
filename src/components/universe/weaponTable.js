// The ships' weapons: the table moved down to src/lib/arms/ship.js, so every
// world that flies the universe's ships reads one; this path stays for its
// callers (docs/health/RULES.md's barrel).
export { WEAPONS, burstOf, byCode, rackOf } from '../../lib/arms/ship';
