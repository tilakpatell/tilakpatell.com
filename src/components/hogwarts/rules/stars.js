// The night sky from the top of the Astronomy Tower (the design’s §4.4: by
// night the stars are named when you look along a telescope). A late-autumn
// sky over the Highlands at about eleven: the bright stars and a planet,
// each where it stands (azimuth from north, clockwise; elevation over the
// horizon, in degrees) with a line in the site’s own words; and the tower’s
// six telescopes, each left pointing at something worth the climb. Pure.
//
//   STARS: [{ name, az, el, mag, says }]   TELESCOPES: [{ id, az, el, name }]
//   dirOf(az, el) → [x, y, z] in the grounds’ frame (+x east, +z south, y up)
//   along(az, el, { fov }) → the stars within half the field of view, brightest first
//   caption(stars) → the line said through the eyepiece
//   night(hour) → whether there are stars to see

export const STARS = [
  { name: 'Polaris', az: 0, el: 57, mag: 2.0, says: 'Polaris, the pole star, that everything else turns round' },
  { name: 'Kochab', az: 8, el: 44, mag: 2.1, says: 'Kochab, the Little Bear’s other bright one' },
  { name: 'Dubhe', az: 18, el: 28, mag: 1.8, says: 'Dubhe, the Plough’s pointer, low in the north' },
  { name: 'Alkaid', az: 350, el: 14, mag: 1.9, says: 'Alkaid, the Plough’s handle, nearly in the trees' },
  { name: 'Caph', az: 318, el: 70, mag: 2.3, says: 'Caph, at the end of Cassiopeia’s W' },
  { name: 'Schedar', az: 300, el: 72, mag: 2.2, says: 'Schedar, the brightest of the queen’s chair' },
  { name: 'Alpheratz', az: 236, el: 58, mag: 2.1, says: 'Alpheratz, where Andromeda meets the Great Square' },
  { name: 'Mirach', az: 228, el: 70, mag: 2.1, says: 'Mirach, and just above it, if your eyes are good, the smudge of the Andromeda galaxy' },
  { name: 'Deneb', az: 300, el: 38, mag: 1.3, says: 'Deneb, the swan’s tail, going down in the west' },
  { name: 'Vega', az: 306, el: 20, mag: 0.0, says: 'Vega, very bright and very blue, low over the forest' },
  { name: 'Capella', az: 70, el: 60, mag: 0.1, says: 'Capella, the little goat, yellow and high' },
  { name: 'Aldebaran', az: 104, el: 32, mag: 0.9, says: 'Aldebaran, the bull’s red eye' },
  { name: 'Bellatrix', az: 112, el: 20, mag: 1.6, says: 'Bellatrix, Orion’s left shoulder; some old families name their daughters for stars' },
  { name: 'Betelgeuse', az: 102, el: 22, mag: 0.5, says: 'Betelgeuse, his right shoulder, orange and enormous' },
  { name: 'Rigel', az: 124, el: 10, mag: 0.1, says: 'Rigel, his foot, blue-white and just clearing the hills' },
  { name: 'Sirius', az: 130, el: 3, mag: -1.5, says: 'Sirius, the Dog Star, the brightest in the sky, only just risen over the lake' },
  { name: 'Pollux', az: 76, el: 30, mag: 1.1, says: 'Pollux, the twin who stayed' },
  { name: 'Castor', az: 70, el: 34, mag: 1.6, says: 'Castor, his brother' },
  { name: 'Regulus', az: 62, el: 4, mag: 1.4, says: 'Regulus, the heart of the lion, only just up' },
  { name: 'Alphard', az: 88, el: 2, mag: 2.0, says: 'Alphard, the lonely one, alone in its patch of sky' },
  { name: 'Mars', az: 145, el: 24, mag: -0.6, says: 'Mars, red and steady, not twinkling: a planet, not a star' },
];

export const TELESCOPES = [
  { id: 'north', name: 'The telescope on the north wall', az: 4, el: 50 },
  { id: 'queen', name: 'The telescope turned up to the queen’s chair', az: 305, el: 68 },
  { id: 'andromeda', name: 'The telescope on Andromeda', az: 232, el: 64 },
  { id: 'west', name: 'The telescope over the forest', az: 303, el: 28 },
  { id: 'orion', name: 'The telescope on Orion', az: 112, el: 18 },
  { id: 'twins', name: 'The telescope on the twins', az: 72, el: 34 },
];

const RAD = Math.PI / 180;

export function dirOf(az, el) {
  const a = az * RAD;
  const e = el * RAD;
  return [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
}

const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) / RAD;

export function along(az, el, { fov = 24 } = {}) {
  const d = dirOf(az, el);
  return STARS.filter((s) => angle(d, dirOf(s.az, s.el)) <= fov / 2).sort((a, b) => a.mag - b.mag);
}

export function caption(stars) {
  if (!stars.length) return 'Nothing but the dark between the stars. Try another telescope.';
  return `${stars
    .slice(0, 3)
    .map((s) => s.says)
    .join('; ')}.`;
}

export const night = (hour) => hour >= 19 || hour < 6;
