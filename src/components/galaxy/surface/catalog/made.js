// The surface models made for this site with Meshy (meshy.ai, the site
// owner's account) where nothing on Sketchfab was right: each from a real
// picture of the thing (a film still or a production painting, lifted onto
// a plain background), or one of the owner's own models retextured. Made
// by scripts/meshy-galaxy-buildings.mjs, written to
// public/models/galaxy/surface/<kind>.glb like the Sketchfab ones (standing
// on y = 0, facing +z, in metres) and listed in public/cc0/README.md (not
// in the Sketchfab credits). Fields as in the other groups, and:
//   made    'meshy'
//   hero    a landmark: allowed a bigger file (4 MB) for its 2K maps
//   lod     a <kind>.lod1.glb sits beside it, for far away
//   solids  'built': walls and floors from the built one (props/*.js), so
//           its decks and doors still work under the model
//   styles  the built one's styles (opts.style) the model stands in for;
//           the others stay built
//   detail  a scan (kit.js's roles: 'stone', 'adobe', 'metal'…) laid over
//           it up close (detail.js); detailLook: withDetail's options
export const MODELS = {
  // Naboo: Theed's domed halls (from a concept image of one, which the
  // owner chose); its towers stay built
  theed: { made: 'meshy', as: "Theed's domed halls", metres: 35, along: 'x', hero: true, lod: true, styles: ['hall', 'rotunda'], detail: 'stone' },
};
