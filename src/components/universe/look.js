// The universe map’s look (components/worlds/looks.js): its own. The ships,
// stations and landmarks are under the house look (lib/three/house, through
// houseOn with its shade the space light’s colour), but the planets draw in
// shaders of their own, the sky is a starfield and nebulae, and every tint
// the map owns is one of ./palette.js’s nine colours. The renderer maps no
// tone: the post (./post.js) does, after the bloom, with the shoulder of
// Khronos’ neutral and none of its toe, so the faint Milky Way and the
// planets’ night sides stay as drawn and only what is brighter rounds off.
//
// The bloom is over white on purpose, at 1.7: lit paint tops out near 2
// under the key light in the post’s HDR, so only the sun, lit windows,
// engines and shots, drawn hotter, glow; strength 0.8 (a flare scales it a
// moment), radius 0.55.

export const LOOK = {
  art: 'own',
  tone: 'none',
  bloom: Object.freeze({ threshold: 1.7, strength: 0.8, radius: 0.55 }),
  why: {
    art: 'planets in shaders of their own, a starfield sky, the ships under the house shade; one palette (palette.js) for every tint the map owns',
    tone: 'the post tone-maps after the bloom (post.js: the neutral shoulder without its toe), so the renderer maps none',
  },
};

// The map's own bloom, the lens's (post.js asks lib/three/bloomChain for it
// when the scene says `chain`; the galaxy and the rest keep three's pass and
// LOOK.bloom): a mip chain down and up, as a film renderer's, with two
// parts. The veil is 4.5 % of all the light, as a real lens scatters it, so
// a sun's sky is never quite black and a lit limb has a breath of haze; the
// glare is what's over the threshold (the same line as LOOK.bloom's, eased
// in over a knee so a far bolt doesn't blink), at strength: 2.1, about the
// light three's pass spread at LOOK.bloom's 0.8 (its five levels weighed
// near 0.6 each, measured against the old frames at the Maw), here spread
// further out. sharpness weighs the chain's levels from the long soft reach
// (0) to the tight core (1); flareMax caps a moment's flare (post.flare).
export const CHAIN = Object.freeze({ threshold: 1.7, knee: 0.6, strength: 2.1, veil: 0.045, sharpness: 0.6, flareMax: 2.5 });
