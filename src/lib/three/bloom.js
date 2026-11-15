// The house bloom, Bruno Simon’s numbers from folio-2025: a threshold of 1,
// so only what is brighter than white glows (a lamp, an engine, a saber,
// each lifted over 1 with lib/stage3d’s hot()) and a lit white wall does
// not; a strength of a quarter, so the glow is a halo and not a fog. Every
// stage and every runtime post chain starts from it; a world that wants
// another says why in its look.js.
//
//   BLOOM → { threshold, strength, radius }
//   bloomGroups(pass) → the panel’s groups (lib/debugPanel) for a bloom
//     pass or anything with the same three numbers (and a knee slider, the
//     threshold up to 3, for a soft-knee pass: one with a `knee`)

export const BLOOM = Object.freeze({ threshold: 1, strength: 0.25, radius: 0.4 });

const slider = (pass, key, max) => ({ key, type: 'range', min: 0, max, step: 0.01, get: () => pass[key], set: (v) => (pass[key] = v) });

export const bloomGroups = (pass) => {
  const soft = typeof pass.knee === 'number';
  // (strength up to 1.5, or twice what it's at: the universe map's chain starts past 1.5)
  const items = [slider(pass, 'threshold', soft ? 3 : 2), ...(soft ? [slider(pass, 'knee', 1)] : []), slider(pass, 'strength', Math.max(1.5, (pass.strength ?? 0) * 2)), slider(pass, 'radius', 1)];
  return [{ name: 'bloom', items }];
};
