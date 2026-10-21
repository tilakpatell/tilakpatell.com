// The Balrog on the Bridge of Khazad-dûm, pure: the beat’s 22 s as one
// timeline. It comes up out of the fire with its wings of shadow opening,
// steps onto the bridge, Gandalf brings his staff down and the bridge breaks
// under it; as it falls it cracks its whip round his knees and drags him
// over after it.
//
//   BRIDGE_SECONDS: the timeline’s length (the beat’s hold)
//   stance(t) → { wings (0…1), whip (0…1, the lash out), fall (0…1, down
//     the chasm), broken (the span under it gone), gandalf (0…1, dragged
//     over the edge) }, held at its end after

export const BRIDGE_SECONDS = 22;
const BREAKS = 11; // s: the staff comes down
const FALLS = 13;
const LASH = [14, 17]; // s the whip is out

const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

export function stance(t) {
  const u = Math.min(BRIDGE_SECONDS, Math.max(0, t));
  return {
    wings: smooth((u - 1) / 4),
    whip: smooth((u - LASH[0]) / 0.6) * (1 - smooth((u - LASH[1]) / 1)),
    fall: smooth((u - FALLS) / (BRIDGE_SECONDS - FALLS)),
    broken: u >= BREAKS,
    gandalf: smooth((u - 16) / 5),
  };
}
