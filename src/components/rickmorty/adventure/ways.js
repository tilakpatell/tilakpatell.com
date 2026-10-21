// The ways home, so no Rick and Morty place is a dead end: a planet landed on
// from the map has a way home to C-137 beside its way back to space, the
// Citadel's way out goes back where the visitor came from, and C-137 opened
// with { arrive: 'garage' } starts Morty by the garage portal (it's the
// portal he's come back through). Pure.

import { GARAGE_BACK } from '../world/dimensions/place';

export const HOME = 'Home to C-137';
const HOME_STATE = { arrive: 'garage' };

export const homeLink = (planet) => (planet ? { to: '/c-137', label: HOME, state: HOME_STATE } : null);

export const arriveAt = (state) => (state?.arrive === 'garage' ? { area: 'garage', ...GARAGE_BACK } : null);

// (the map says so in the router's state, Universe.jsx; anywhere else is C-137)
export const citadelOut = (state) => (state?.from === 'universe' ? { to: '/universe/citadel', state: undefined, label: 'Back to space' } : { to: '/c-137', state: HOME_STATE, label: 'Back to C-137' });
