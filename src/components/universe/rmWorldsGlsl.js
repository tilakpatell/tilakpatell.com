// The Central Finite Curve's worlds, as shaders (rmWorlds.js wears them):
// each one's ground worked out where it's drawn, from the point on the unit
// sphere, so it's sharp however close you fly and has no seam, and it moves
// (the time's a uniform): Gazorpazorp's dust storms going round and its
// vents breathing, Planet Squanch's seas glinting and its cities partying
// all night, Gear World's gears turning, Pluto's glaciers creeping, the
// Resort's surf, Cronenberg World's flesh breathing and the Purge Planet's
// villages burning by night. Drawn the way the show draws a planet: flat colour in a
// few steps, a dark ink line round every shape (rmInk: about a pixel and a
// half wide wherever it's seen from, gone where the shapes get too small to
// draw), lit in flat bands (planetShading.js's celShade, over this).
//
// Each world is `vec3 rmSurface(vec3 p, float t, float night, inout vec3
// glow, inout float rough)`: p the point on the unit sphere (turning with
// the planet), t seconds, night 0…1 (how far into its night side the point
// is), and out: its colour, what glows there (added as emissive) and how
// rough it is.

export const RM_NOISE = `
float rmHash(vec3 p) { p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 rmHash3(vec3 p) { return vec3(rmHash(p), rmHash(p + 17.31), rmHash(p + 41.77)); }
float rmNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(rmHash(i), rmHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(rmHash(i + vec3(0.0, 1.0, 0.0)), rmHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(rmHash(i + vec3(0.0, 0.0, 1.0)), rmHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(rmHash(i + vec3(0.0, 1.0, 1.0)), rmHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
float rmFbm(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * rmNoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return s;
}
// the same, smoother: the big shapes of a cartoon map (coasts the show would
// draw, not fractal ones), on the same scale as rmFbm
float rmShape(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * rmNoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return s * 1.107;
}
// the nearest of a scatter of points: x its distance, y its own random, and
// (rmCell) where it is, for drawing something round it
vec2 rmCells(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  float d = 8.0, id = 0.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 r = g + rmHash3(i + g) - f;
    float dd = dot(r, r);
    if (dd < d) { d = dd; id = rmHash(i + g + 3.7); }
  }
  return vec2(sqrt(d), id);
}
vec4 rmCell(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  float d = 8.0; vec4 best = vec4(0.0);
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 r = g + rmHash3(i + g) - f;
    float dd = dot(r, r);
    if (dd < d) { d = dd; best = vec4(r, rmHash(i + g + 3.7)); }
  }
  return best; // xyz: from p out to the point; w: its random
}
// the point in a plane flat on the sphere at n, north up (for a shape drawn round a spot)
vec2 rmFlat(vec3 v, vec3 n) {
  vec3 u = normalize(cross(abs(n.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), n));
  return vec2(dot(v, u), dot(v, cross(n, u)));
}
// the ink line where f crosses th
float rmInk(float f, float th) {
  float w = max(fwidth(f), 1e-5);
  return (1.0 - smoothstep(w * 0.7, w * 1.7, abs(f - th))) * (1.0 - smoothstep(0.04, 0.12, w));
}
vec3 rmTurn(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
// a heart, the point at the bottom (0, 0), its top near y = 1: < 0 inside
float rmHeart(vec2 q) {
  q.x = abs(q.x);
  if (q.y + q.x > 1.0) return length(q - vec2(0.25, 0.75)) - 0.35355;
  vec2 a = q - vec2(0.0, 1.0);
  vec2 b = q - 0.5 * max(q.x + q.y, 0.0);
  return sqrt(min(dot(a, a), dot(b, b))) * sign(q.x - q.y);
}
`;

export const RM_SURFACES = {
  // Gazorpazorp: a red desert world of dunes, rust rock and flat-topped
  // mesas, pocked with craters; dust storms going round it, and magma vents
  // in the mesas breathing orange, brightest at night
  gazorpazorp: `
vec3 rmSurface(vec3 p, float t, float night, inout vec3 glow, inout float rough) {
  float h = rmShape(p * 2.4 + 1.3);
  vec3 col = vec3(0.9, 0.56, 0.37);
  col = mix(col, vec3(0.75, 0.31, 0.18), step(0.48, h));
  col = mix(col, vec3(0.47, 0.17, 0.1), step(0.6, h));
  float ink = max(rmInk(h, 0.48), rmInk(h, 0.6));
  float dune = sin(dot(p, vec3(18.0, 5.0, 11.0)) + rmFbm(p * 5.0) * 7.0);
  col *= 1.0 - 0.07 * step(0.3, dune) * step(h, 0.48);
  vec2 c = rmCells(p * 4.5 + 7.0);
  float big = step(0.6, c.y);
  float cr = 0.17 + 0.13 * c.y;
  float inside = step(c.x, cr) * big;
  col = mix(col, col * 0.7, inside);
  col = mix(col, vec3(0.97, 0.72, 0.52), smoothstep(cr * 0.7, cr, c.x) * inside * 0.55);
  ink = max(ink, rmInk(c.x, cr) * big);
  vec3 q = rmTurn(p, t * 0.05);
  float s = rmFbm(q * 2.1 + vec3(0.0, t * 0.04, t * 0.02));
  float storm = smoothstep(0.57, 0.66, s);
  col = mix(col, vec3(0.98, 0.76, 0.55), storm * 0.75);
  ink = max(ink * (1.0 - storm), rmInk(s, 0.6) * 0.55);
  col *= 1.0 - 0.8 * ink;
  vec2 v = rmCells(p * 10.0 + 2.0);
  float vent = smoothstep(0.17, 0.05, v.x) * step(0.8, v.y) * step(0.56, h) * (1.0 - storm);
  glow += vec3(1.0, 0.42, 0.12) * vent * (0.65 + 0.45 * sin(t * 1.7 + v.y * 37.0)) * (0.5 + night * 1.2);
  rough = 0.95;
  return col;
}`,

  // Planet Squanch: red and orange land round teal seas with pale shallows,
  // the seas glinting as they move, and the squanchers' cities lit up in
  // every colour all night (the party never stops)
  squanch: `
vec3 rmSurface(vec3 p, float t, float night, inout vec3 glow, inout float rough) {
  float h = rmShape(p * 2.0 + 4.0);
  float sea = step(h, 0.46);
  vec3 land = mix(vec3(0.86, 0.37, 0.3), vec3(0.62, 0.2, 0.22), step(0.57, h));
  land = mix(land, vec3(0.96, 0.64, 0.42), step(0.66, h));
  vec3 water = mix(vec3(0.2, 0.55, 0.56), vec3(0.5, 0.84, 0.78), smoothstep(0.38, 0.46, h));
  float w = rmNoise(rmTurn(p, t * 0.07) * 30.0 + vec3(t * 0.4, 0.0, t * 0.25));
  water = mix(water, vec3(0.85, 1.0, 0.96), step(0.9, w) * 0.5);
  vec3 col = mix(land, water, sea);
  float ink = max(rmInk(h, 0.46), max(rmInk(h, 0.57), rmInk(h, 0.66)));
  col *= 1.0 - 0.8 * ink;
  rough = mix(0.95, 0.22, sea);
  vec2 c = rmCells(p * 24.0);
  float city = step(0.47, rmFbm(p * 3.0 + 9.0)) * (1.0 - sea) * smoothstep(0.13, 0.03, c.x);
  vec3 hue = 0.55 + 0.45 * cos(6.2832 * (c.y + vec3(0.0, 0.33, 0.67)) + t * 2.0);
  float blink = 0.55 + 0.45 * step(0.4, fract(t * 1.3 + c.y * 7.0));
  glow += hue * city * blink * (0.15 + night * 1.8);
  return col;
}`,

  // Bird World: green meadows and dark forest, cliffs with snow and nests
  // on top, blue seas; its clouds and its flocks are their own (rmWorlds.js)
  birdworld: `
vec3 rmSurface(vec3 p, float t, float night, inout vec3 glow, inout float rough) {
  float h = rmShape(p * 2.2 + 11.0);
  float sea = step(h, 0.44);
  vec3 col = mix(vec3(0.42, 0.68, 0.3), vec3(0.2, 0.44, 0.22), step(0.54, h));
  col = mix(col, vec3(0.6, 0.52, 0.4), step(0.65, h));
  col = mix(col, vec3(0.96, 0.96, 0.92), step(0.71, h));
  vec2 tr = rmCells(p * 34.0);
  col *= 1.0 - 0.16 * smoothstep(0.28, 0.48, tr.x) * step(0.54, h) * step(h, 0.65);
  vec3 water = mix(vec3(0.16, 0.4, 0.72), vec3(0.45, 0.75, 0.92), smoothstep(0.36, 0.44, h));
  float sw = rmNoise(rmTurn(p, -t * 0.05) * 26.0 + t * 0.3);
  water = mix(water, vec3(0.9, 0.97, 1.0), step(0.86, sw) * 0.6);
  col = mix(col, water, sea);
  float ink = max(max(rmInk(h, 0.44), rmInk(h, 0.54)), max(rmInk(h, 0.65), rmInk(h, 0.71)));
  col *= 1.0 - 0.8 * ink;
  rough = mix(1.0, 0.25, sea);
  vec2 n = rmCells(p * 16.0 + 5.0);
  glow += vec3(1.0, 0.75, 0.4) * smoothstep(0.1, 0.03, n.x) * step(0.7, n.y) * step(0.65, h) * night * 1.2;
  return col;
}`,

  // Gear World: a machine of a planet, every cell of it a brass gear with
  // its teeth, spokes and hub, turning, the next one over the other way,
  // over dark workings with furnace light in the seams
  gearworld: `
vec3 rmSurface(vec3 p, float t, float night, inout vec3 glow, inout float rough) {
  vec3 n = normalize(p);
  vec3 col = mix(vec3(0.24, 0.19, 0.15), vec3(0.32, 0.25, 0.18), rmNoise(p * 40.0));
  float seam = rmFbm(p * 3.0 + 4.0);
  float hot = smoothstep(0.012, 0.0, abs(seam - 0.5)) * step(0.45, rmNoise(p * 2.0 + 7.0));
  glow += vec3(1.0, 0.5, 0.15) * hot * (0.25 + 0.75 * night) * (0.75 + 0.25 * sin(t * 3.0 + seam * 40.0));
  float ink = 0.0;
  float free = 1.0; // (the small gears go in the gaps the big ones leave)
  for (int k = 0; k < 2; k++) {
    float sc = k == 0 ? 3.2 : 7.0;
    vec4 c = rmCell(p * sc + float(k) * 13.0);
    vec2 q = rmFlat(-c.xyz, n);
    float d = length(q);
    float R = (k == 0 ? 0.42 : 0.36) * (0.75 + 0.35 * c.w);
    float dir = c.w > 0.5 ? 1.0 : -1.0;
    float a = atan(q.y, q.x) + dir * t * 0.35 / R;
    float teeth = R + 0.06 * smoothstep(-0.2, 0.2, sin(a * floor(10.0 + c.w * 10.0)));
    float rim = d - teeth;
    float spokes = step(0.3, abs(sin(a * 3.0)));
    float hole = step(R * 0.38, d) * step(d, R * 0.72) * (1.0 - spokes);
    float body = step(rim, 0.0) * (1.0 - hole) * free;
    vec3 brass = k == 0 ? vec3(0.86, 0.66, 0.32) : vec3(0.7, 0.48, 0.26);
    brass *= 0.85 + 0.15 * step(R * 0.8, d);
    brass = mix(brass, vec3(0.5, 0.36, 0.2), step(d, R * 0.2));
    col = mix(col, brass, body);
    ink = max(ink, (max(rmInk(rim, 0.0), rmInk(d, R * 0.2)) + rmInk(d - R * 0.72, 0.0) * hole) * free);
    free *= step(0.0, rim - 0.02);
  }
  col *= 1.0 - 0.8 * ink;
  rough = 0.45;
  return col;
}`,

  // Pluto: pale nitrogen ice, a dark red-brown belt round its middle, and
  // the heart on its face, its glaciers creeping; frost glinting in the sun
  pluto: `
vec3 rmSurface(vec3 p, float t, float night, inout vec3 glow, inout float rough) {
  float h = rmShape(p * 2.6 + 5.0);
  vec3 col = mix(vec3(0.8, 0.83, 0.9), vec3(0.63, 0.67, 0.76), step(0.52, h));
  // the dark whale along its middle, on the heart's side, broken up at its edges
  vec3 H0 = normalize(vec3(0.15, 0.2, 1.0));
  float side = dot(normalize(vec3(p.x, 0.0, p.z)), normalize(vec3(-H0.z, 0.0, H0.x)));
  float lat = (p.y + 0.05 + 0.08 * sin(atan(p.z, p.x) * 2.0)) / 0.3;
  float zone = exp(-lat * lat) * smoothstep(-0.45, 0.55, side);
  float whale = zone * 0.72 + rmShape(p * 2.6 + 8.0) * 0.5;
  float dark = step(0.62, whale);
  col = mix(col, vec3(0.45, 0.27, 0.21), dark);
  col = mix(col, vec3(0.62, 0.4, 0.3), dark * step(whale, 0.66));
  float ink = max(rmInk(h, 0.52) * (1.0 - dark), rmInk(whale, 0.62));
  vec3 H = normalize(vec3(0.15, 0.2, 1.0));
  vec2 q = rmFlat(p - H, H) * vec2(1.6, 1.6) + vec2(0.0, 0.62);
  q.x += 0.12 * q.y;
  float heart = rmHeart(q);
  float inHeart = step(heart, 0.0) * step(0.0, dot(p, H));
  col = mix(col, vec3(0.8, 0.83, 0.9), inHeart * dark);
  float flow = rmFbm(vec3(q * 6.0, 0.0) + vec3(0.0, -t * 0.03, t * 0.01));
  vec3 ice = mix(vec3(0.98, 0.96, 0.93), vec3(0.9, 0.88, 0.86), step(0.55, flow));
  col = mix(col, ice, inHeart);
  ink = max(ink * (1.0 - inHeart), rmInk(heart, 0.0) * step(0.0, dot(p, H)));
  vec2 c = rmCells(p * 7.0 + 1.0);
  float cr = 0.16 * step(0.7, c.y) * (1.0 - inHeart);
  ink = max(ink, rmInk(c.x, cr) * step(0.001, cr));
  col *= 1.0 - 0.75 * ink;
  float g = rmNoise(p * 90.0 + floor(t * 2.0) * 3.1);
  glow += vec3(0.85, 0.95, 1.0) * step(0.965, g) * (1.0 - night) * 0.9;
  rough = 0.5;
  return col;
}`,

  // Snake Planet: jungle and swamp in snakeskin greens, scaled all over,
  // sand-yellow badlands and winding rivers; its serpents are their own
  snakeplanet: `
vec3 rmSurface(vec3 p, float t, float night, inout vec3 glow, inout float rough) {
  float h = rmShape(p * 2.3 + 21.0);
  vec3 col = mix(vec3(0.42, 0.62, 0.24), vec3(0.24, 0.42, 0.16), step(0.52, h));
  col = mix(col, vec3(0.86, 0.8, 0.42), step(0.63, h));
  float r = rmFbm(p * 1.6 + 3.0);
  float river = step(abs(r - 0.5), 0.012 + 0.006 * sin(t * 0.8 + r * 30.0)) * step(h, 0.63);
  vec3 swamp = vec3(0.26, 0.5, 0.42);
  col = mix(col, swamp, step(h, 0.4));
  col = mix(col, vec3(0.3, 0.62, 0.6), river);
  vec2 sc = rmCells(p * 46.0);
  col *= 0.86 + 0.14 * smoothstep(0.05, 0.5, sc.x);
  float d = abs(fract(dot(p, vec3(9.0, 3.0, 5.0)) + rmFbm(p * 3.0)) - 0.5);
  col = mix(col, col * 0.78, step(d, 0.08) * step(0.52, h) * step(h, 0.63));
  float ink = max(max(rmInk(h, 0.52), rmInk(h, 0.63)), max(rmInk(h, 0.4), rmInk(abs(r - 0.5), 0.012) * step(h, 0.63)));
  col *= 1.0 - 0.8 * ink;
  vec2 v = rmCells(p * 18.0 + 8.0);
  glow += vec3(0.6, 1.0, 0.4) * smoothstep(0.1, 0.03, v.x) * step(0.75, v.y) * step(0.52, h) * night;
  rough = mix(0.9, 0.35, step(h, 0.4));
  return col;
}`,

  // Nuptia 4: a world to marry on: rose-pink lands, magenta highlands, a
  // lilac sea, and islands shaped like hearts, beating a soft pink at night
  nuptia: `
vec3 rmSurface(vec3 p, float t, float night, inout vec3 glow, inout float rough) {
  vec3 n = normalize(p);
  float h = rmShape(p * 2.1 + 31.0);
  float sea = step(h, 0.5);
  vec3 col = mix(vec3(0.93, 0.6, 0.76), vec3(0.74, 0.32, 0.6), step(0.6, h));
  vec3 water = mix(vec3(0.58, 0.5, 0.86), vec3(0.76, 0.7, 0.96), smoothstep(0.42, 0.5, h));
  col = mix(col, water, sea);
  float ink = max(rmInk(h, 0.5), rmInk(h, 0.6));
  vec4 c = rmCell(p * 3.4 + 2.0);
  vec2 q = rmFlat(-c.xyz, n) * 2.4 + vec2(0.0, 0.55);
  float hd = rmHeart(q);
  float isle = step(0.45, c.w) * sea;
  col = mix(col, vec3(1.0, 0.72, 0.84), step(hd, 0.0) * isle);
  ink = max(ink * (1.0 - step(hd, 0.0) * isle), rmInk(hd, 0.0) * isle);
  col *= 1.0 - 0.75 * ink;
  float beat = pow(0.5 + 0.5 * sin(t * 2.4 + c.w * 6.0), 6.0);
  glow += vec3(1.0, 0.45, 0.7) * step(hd, 0.0) * isle * (0.15 + 0.85 * beat) * (0.2 + night);
  rough = mix(0.9, 0.3, sea);
  return col;
}`,

  // the Immortality Field Resort: a warm teal ocean of atolls, each a ring
  // of sand round a pale lagoon with a fringe of palms, the surf running
  // round them, and the resort's lights at night (its field is its own)
  resort: `
vec3 rmSurface(vec3 p, float t, float night, inout vec3 glow, inout float rough) {
  float h = rmShape(p * 2.0 + 41.0);
  vec3 col = mix(vec3(0.12, 0.5, 0.58), vec3(0.2, 0.66, 0.68), smoothstep(0.3, 0.5, h));
  vec2 c = rmCells(p * 5.0 + 9.0);
  float isle = step(0.35, c.y);
  float R = 0.22 + 0.12 * c.y;
  float sand = step(abs(c.x - R), 0.05) * isle;
  float lagoon = step(c.x, R - 0.05) * isle;
  col = mix(col, vec3(0.6, 0.9, 0.86), lagoon);
  col = mix(col, vec3(0.95, 0.87, 0.6), sand);
  float palm = step(abs(c.x - R + 0.015), 0.02) * isle * step(0.6, rmNoise(p * 160.0));
  col = mix(col, vec3(0.25, 0.6, 0.25), palm);
  float surf = step(0.0, sin((c.x - R) * 140.0 - t * 2.5)) * step(R + 0.05, c.x) * step(c.x, R + 0.11) * isle;
  col = mix(col, vec3(0.86, 0.97, 0.98), surf * 0.55);
  float ink = max(rmInk(abs(c.x - R), 0.05) * isle, rmInk(h, 0.42) * 0.4);
  col *= 1.0 - 0.75 * ink;
  glow += vec3(1.0, 0.85, 0.5) * sand * step(0.75, rmNoise(p * 90.0)) * night * 1.5;
  rough = mix(0.25, 0.95, sand + lagoon * 0.3);
  return col;
}`,

  // Cronenberg World: the Earth Rick left behind, its continents gone to
  // flesh, pink and bruised and sickly green, veined and lumpy, in a murky
  // sea; the land breathing, its veins throbbing, survivors' fires at night.
  // Its coasts are the real Earth's, C-137's own (RM_LAND: the map's
  // cronenberg-land, softened about two degrees either side, read as how
  // far in from the coast a point is), else blobs where the lands are
  cronenberg: `
vec3 rmSurface(vec3 p, float t, float night, inout vec3 glow, inout float rough) {
#ifdef RM_LAND
  // (the map's layout, sphere.mjs's: u round from the -x side, v up; read
  // at its own level, so the seam where u wraps round draws no line)
  vec3 d = normalize(p);
  vec2 uv = vec2(fract(atan(d.z, -d.x) / 6.2831853 + 1.0), 1.0 - acos(clamp(d.y, -1.0, 1.0)) / 3.1415927);
  // (a coast blurred by s reads (m - 0.5) / 0.4 s in from it, near enough:
  // s is 0.037 radians, so e is in radians, as the blobs' is)
  float e = 0.092 * (textureLod(uRmLand, uv, 0.0).r - 0.5);
  // (the coasts made lumpy, as the show would draw them, and the land breathing in and out)
  e += 0.006 + 0.04 * (rmShape(p * 6.0 + 51.0) - 0.5) + 0.012 * sin(t * 0.55);
#else
  // Earth's lands, near enough: latitude, longitude, reach (degrees)
  const vec3 LAND[32] = vec3[32](
    vec3(54.0, -102.0, 16.0), vec3(40.0, -97.0, 13.0), vec3(38.0, -82.0, 8.0), vec3(64.0, -122.0, 12.0),
    vec3(65.0, -153.0, 8.0), vec3(56.0, -70.0, 8.0), vec3(24.0, -104.0, 7.0), vec3(15.0, -89.0, 4.0),
    vec3(73.0, -41.0, 9.0), vec3(-4.0, -62.0, 15.0), vec3(-12.0, -46.0, 9.0), vec3(-26.0, -60.0, 10.0),
    vec3(-41.0, -68.0, 6.0), vec3(51.0, 13.0, 8.0), vec3(63.0, 17.0, 7.0), vec3(41.0, -4.0, 5.0),
    vec3(53.0, 38.0, 10.0), vec3(15.0, 2.0, 13.0), vec3(18.0, 26.0, 12.0), vec3(2.0, 22.0, 14.0),
    vec3(-17.0, 27.0, 11.0), vec3(-28.0, 24.0, 7.0), vec3(25.0, 46.0, 9.0), vec3(37.0, 46.0, 7.0),
    vec3(62.0, 95.0, 21.0), vec3(65.0, 135.0, 14.0), vec3(46.0, 72.0, 15.0), vec3(36.0, 104.0, 15.0),
    vec3(22.0, 79.0, 9.0), vec3(-2.0, 114.0, 6.0), vec3(-25.0, 134.0, 14.0), vec3(-90.0, 0.0, 18.0)
  );
  float e = -1.0;
  for (int i = 0; i < 32; i++) {
    vec2 a = radians(LAND[i].xy);
    float b = radians(LAND[i].z) - length(p - vec3(cos(a.x) * cos(a.y), sin(a.x), -cos(a.x) * sin(a.y)));
    float k = clamp(0.5 + 0.5 * (b - e) / 0.06, 0.0, 1.0);
    e = mix(e, b, k) + 0.06 * k * (1.0 - k);
  }
  // (coasts the show would draw, and the land breathing in and out)
  e += 0.03 + 0.15 * (rmShape(p * 3.0 + 51.0) - 0.5) + 0.012 * sin(t * 0.55);
#endif
  float land = step(0.0, e);
  float m = rmShape(p * 2.4 + 13.0);
  vec3 col = vec3(0.93, 0.6, 0.58);
  col = mix(col, vec3(0.8, 0.8, 0.4), step(m, 0.36));
  col = mix(col, vec3(0.58, 0.32, 0.5), step(0.62, m));
  col = mix(col, vec3(0.42, 0.22, 0.4), step(0.71, m));
  float ink = max(max(rmInk(m, 0.36), rmInk(m, 0.62)), rmInk(m, 0.71));
  col = mix(col, vec3(0.72, 0.24, 0.32), rmInk(rmFbm(p * 4.2 + 37.0), 0.5) * 0.7);
  float throb = pow(0.5 + 0.5 * sin(t * 1.3 - dot(p, vec3(5.0, 3.0, 4.0))), 4.0);
  float v = abs(rmShape(p * 2.2 + 23.0) - 0.5);
  float w = 0.014 + 0.012 * throb;
  float vein = step(v, w);
  col = mix(col, vec3(0.62, 0.17, 0.26), vein);
  col = mix(col, vec3(0.86, 0.38, 0.42), vein * step(v, w * 0.3));
  ink = max(ink * (1.0 - vein), rmInk(v, w));
  vec4 c = rmCell(p * 5.0 + 3.0);
  vec2 q = rmFlat(-c.xyz, p);
  float R = (0.22 + 0.14 * c.w) * (1.0 + 0.1 * sin(t * 0.8 + c.w * 40.0));
  float Rv = sqrt(max(R * R - dot(c.xyz, c.xyz) + dot(q, q), 0.0));
  float grow = step(0.45, c.w);
  float lump = grow * step(length(q), Rv);
  float pus = lump * step(0.85, c.w);
  float head = pus * step(length(q), Rv * 0.45);
  col = mix(col, vec3(0.97, 0.72, 0.68), lump);
  col = mix(col, vec3(0.84, 0.86, 0.46), pus);
  col = mix(col, vec3(1.0, 0.9, 0.86), lump * (1.0 - pus) * step(length(q - vec2(-0.3, 0.3) * Rv), 0.28 * Rv));
  col = mix(col, vec3(0.98, 1.0, 0.78), head);
  ink = max(ink * (1.0 - lump), rmInk(length(c.xyz), R) * grow);
  vec2 f = rmCells(p * 18.0 + 11.0);
  float camp = step(0.65, f.y) * step(0.02, e) * step(0.4, rmNoise(p * 4.0 + 2.0));
  float fire = smoothstep(0.36, 0.05, f.x) * camp;
  col *= 1.0 - 0.5 * step(f.x, 0.12) * camp;
  vec3 water = mix(vec3(0.27, 0.3, 0.18), vec3(0.45, 0.41, 0.25), step(-0.03, e));
  float s = rmNoise(rmTurn(p, t * 0.03) * 5.0 + vec3(0.0, t * 0.05, 0.0));
  water = mix(water, vec3(0.34, 0.3, 0.19), step(0.6, s) * step(e, -0.03));
  col = mix(water, col, land);
  ink = max(ink * land, rmInk(e, 0.0));
  col *= 1.0 - 0.8 * ink;
  glow += vec3(0.85, 0.88, 0.48) * head * land * (0.6 + 0.4 * sin(t * 1.1 + c.w * 50.0)) * (0.15 + night * 1.2);
  glow += vec3(1.0, 0.5, 0.15) * fire * (0.7 + 0.3 * sin(t * 9.0 + f.y * 60.0)) * (0.08 + night * 2.0);
  rough = mix(0.3, 0.85, land);
  return col;
}`,

  // the Purge Planet: a patchwork of golden fields stitched with hedges,
  // pasture, dark woods, a teal sea and rivers, its villages quiet by day
  // under pale clouds and two cyclones; by night it's the Purge, and they burn
  purge: `
vec3 rmSurface(vec3 p, float t, float night, inout vec3 glow, inout float rough) {
  float purge = smoothstep(0.2, 0.7, night);
  float h = rmShape(p * 1.8 + 51.0);
  // the fields, between hedges running three ways, a little crooked and
  // staggered like bricks, so a hedge mostly stops at the next one across
  vec3 g = vec3(dot(p, vec3(0.82, 0.31, -0.48)), dot(p, vec3(-0.25, 0.88, 0.41)), dot(p, vec3(0.47, -0.36, 0.81))) * 7.0;
  g += (rmNoise(p * 2.5 + 5.0) - 0.5) * 0.9;
  g.y += 0.5 * mod(floor(g.z * 0.5), 2.0);
  g.x += 0.5 * mod(floor(g.y * 0.5), 2.0);
  vec3 id = floor(g);
  float f = rmHash(id + 7.0);
  float tone = step(0.5, rmNoise(id * 0.3 + 23.0));
  vec3 col = mix(vec3(0.94, 0.75, 0.3), vec3(0.98, 0.88, 0.5), step(0.45, f));
  col = mix(col, vec3(0.89, 0.57, 0.22), step(0.72 - 0.4 * tone, f));
  col = mix(col, vec3(0.74, 0.74, 0.36), step(0.88, f));
  float fa = dot(g, normalize(rmHash3(id) - 0.5)) * 4.0;
  col *= 1.0 - 0.07 * step(0.5, fract(fa)) * (1.0 - smoothstep(0.15, 0.35, fwidth(fa)));
  float gust = step(0.7, rmNoise(rmTurn(p, t * 0.03) * 8.0 + vec3(0.0, t * 0.15, 0.0)));
  col = mix(col, vec3(1.0, 0.93, 0.64), gust * step(f, 0.45) * 0.35);
  vec3 sg = sin(g * 3.14159) / 3.14159;
  float hedge = max(rmInk(sg.x, 0.0), max(rmInk(sg.y, 0.0), rmInk(sg.z, 0.0))) * 0.7;
  // pasture round dark woods, the teal sea, and rivers winding down to it
  float meadow = step(0.56, h);
  float wood = step(0.62, h);
  float sea = step(h, 0.38);
  col = mix(col, vec3(0.74, 0.77, 0.38), meadow);
  col = mix(col, vec3(0.4, 0.44, 0.2), wood);
  col *= 1.0 - 0.2 * smoothstep(0.52, 0.62, rmNoise(p * 38.0)) * wood;
  float r = rmShape(p * 2.2 + 13.0);
  float river = step(abs(r - 0.5), 0.012) * (1.0 - sea);
  float water = max(sea, river);
  vec3 blue = mix(vec3(0.36, 0.6, 0.68), vec3(0.54, 0.76, 0.74), step(0.35, h) * sea);
  blue = mix(blue, vec3(0.88, 0.97, 0.94), step(0.86, rmNoise(rmTurn(p, -t * 0.05) * 26.0 + t * 0.3)) * 0.6);
  col = mix(col, blue, water);
  float ink = max(max(rmInk(h, 0.56), rmInk(h, 0.62)), hedge * (1.0 - meadow)) * (1.0 - water);
  ink = max(ink, max(rmInk(h, 0.38), rmInk(abs(r - 0.5), 0.012) * (1.0 - sea)));
  // the villages, each kept to its own box so none is cut short: a ring of
  // trodden earth, cottages and a red barn or two
  vec3 vi = floor(p * 5.0 + 61.0);
  vec3 vc = (vi + 0.35 + 0.3 * rmHash3(vi) - 61.0) / 5.0;
  float vw = rmHash(vi + 3.7);
  vec2 q = rmFlat(p - vc, normalize(vc)) * 5.0;
  float d = length(q);
  float vil = step(0.3, vw) * step(abs(length(vc) - 1.0), 0.03) * (1.0 - sea);
  float R = 0.21 + 0.08 * fract(vw * 9.7);
  float town = step(d, R) * vil;
  vec2 hq = q / R * 2.8;
  vec2 hc = floor(hq);
  vec2 hl = fract(hq) - 0.5;
  float hr = rmHash(vec3(hc, vw * 31.0));
  float plot = step(length(hc + 0.5), 1.8) * step(0.15, hr) * town;
  vec2 hs = hr > 0.6 ? vec2(0.38, 0.26) : vec2(0.26, 0.38);
  float house = max(abs(hl.x) - hs.x, abs(hl.y) - hs.y);
  vec3 roof = mix(vec3(0.6, 0.36, 0.24), vec3(0.52, 0.48, 0.44), step(0.55, hr));
  roof = mix(roof, vec3(0.68, 0.24, 0.16), step(0.88, hr));
  col = mix(col, vec3(0.86, 0.76, 0.54), town);
  col = mix(col, roof, step(house, 0.0) * plot);
  ink = max(ink * (1.0 - town), max(rmInk(d, R) * vil, rmInk(house, 0.0) * plot));
  // by night, the Purge: every house alight, and the whole village aglow
  float fh = rmHash(vec3(hc, vw * 31.0) + 5.0);
  float flame = house - 0.04 - 0.2 * rmNoise(vec3(hq * 2.5, t * 1.8 + fh * 9.0));
  float flick = 0.65 + 0.35 * sin(t * (6.0 + 5.0 * fh) + fh * 40.0);
  glow += (vec3(1.0, 0.42, 0.1) * step(flame, 0.0) + vec3(0.5, 0.4, 0.2) * step(house, -0.06)) * plot * flick * purge * 1.8;
  glow += vec3(0.9, 0.3, 0.08) * town * purge * (0.45 + 0.08 * sin(t * 3.0 + vw * 20.0));
  // the farms out in the fields, a fire at each; and here and there a field ablaze
  vec2 v = rmCells(p * 16.0 + 3.0);
  float farm = step(0.7, v.y) * (1.0 - water) * (1.0 - town);
  col = mix(col, vec3(0.68, 0.24, 0.16), step(v.x, 0.09) * farm);
  ink = max(ink, rmInk(v.x, 0.09) * farm);
  glow += vec3(1.0, 0.48, 0.14) * smoothstep(0.24, 0.06, v.x) * farm * (0.6 + 0.4 * sin(t * 11.0 + v.y * 90.0)) * purge * 2.2;
  float blaze = step(0.94, rmHash(id + 3.1)) * (1.0 - meadow) * (1.0 - water) * (1.0 - town);
  float fl = rmNoise(g * 6.0 + vec3(0.0, t * 1.2, t * 0.7));
  col = mix(col, vec3(0.3, 0.15, 0.1), blaze * purge);
  glow += (vec3(0.5, 0.13, 0.03) + vec3(1.0, 0.33, 0.08) * step(0.6, fl) + vec3(0.5, 0.4, 0.2) * step(0.74, fl)) * blaze * (0.75 + 0.25 * sin(t * 7.0 + f * 50.0)) * purge * 1.3;
  // pale clouds going over, and two cyclones winding in, slowly turning;
  // by night the clouds are the smoke, lit red from under
  vec3 w = rmTurn(p, t * 0.03);
  float s = rmShape(w * 2.6 + vec3(0.0, t * 0.02, 29.0)) + 0.12 * rmNoise(w * 11.0);
  float cloud = step(0.72, s);
  float swirl = 0.0, sink = 0.0;
  for (int k = 0; k < 2; k++) {
    vec3 S = k == 0 ? normalize(vec3(0.35, -0.42, 0.84)) : normalize(vec3(-0.62, 0.48, -0.52));
    vec2 sq = rmFlat(p - S, S);
    float sd = length(sq);
    float arm = sin(atan(sq.y, sq.x) * 2.0 + log(sd + 0.015) * 6.0 + t * 0.3) - 0.1 - 2.1 * sd;
    float here = step(0.0, dot(p, S)) * step(0.03, sd);
    swirl = max(swirl, step(0.0, arm) * here);
    sink = max(sink, rmInk(arm, 0.0) * here);
  }
  float cink = max(rmInk(s, 0.72) * (1.0 - swirl), sink * (1.0 - cloud));
  cloud = max(cloud, swirl);
  col = mix(col, mix(vec3(0.99, 0.95, 0.76), vec3(0.36, 0.31, 0.28), purge), cloud * 0.88);
  ink = max(ink * (1.0 - cloud), cink * 0.5);
  col *= 1.0 - 0.8 * ink;
  glow = glow * (1.0 - 0.6 * cloud) + vec3(0.7, 0.26, 0.1) * cloud * purge * 0.25;
  rough = mix(0.95, 0.3, water);
  return col;
}`,
};
