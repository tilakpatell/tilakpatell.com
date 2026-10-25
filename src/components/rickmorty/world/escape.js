// A place left in a hurry (./dimensions/destinations.js's `escape`: the
// siren, the scanner, the toast start its clock, RmWorld's s.escape), made
// when Morty steps into its portal home inside the time it gave him. Judged
// at the press, on C-137's garage portal as on a planet's own: the swirl
// after it takes a moment, and the clock would run out under it. Pure, tested.
//
//   madeIt(escape, linkId, t) → whether `linkId` is the escape's portal home, pressed at `t` in its time

export const madeIt = (escape, linkId, t) => Boolean(escape) && linkId === `${escape.area}-portal` && t - escape.at <= escape.s;
