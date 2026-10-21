// A Nazgûl’s rules, pure: the hooded head’s search for the Ring (the Shire’s
// edge, over the roots the four hide under) and, in the Ring vision, the
// king it was under the cloak (Weathertop).
//
//   SEARCH: seconds a sweep takes
//   search(t) → { yaw, pitch, sniff }: the head turned (rad, + to its left),
//     bowed (rad, + down) and how hard it breathes in (0…1), a sweep every
//     SEARCH seconds: left, right, then down toward the roots, where it sniffs
//   kingsPose(amount) → { cloak, king, crown }: as the vision rises the cloak
//     thins (1 → 0) and the pale king shows (0 → 1), his crown last

export const SEARCH = 6; // s
const REACH = 0.75; // rad either way
const BOW = 0.55; // rad, at the roots

const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

export function search(t) {
  const u = (((t % SEARCH) + SEARCH) % SEARCH) / SEARCH;
  // (a third to the left, a third across to the right, a third back to the middle and down)
  let yaw;
  let pitch = 0;
  if (u < 1 / 3) yaw = REACH * smooth(u * 3);
  else if (u < 2 / 3) yaw = REACH * (1 - 2 * smooth((u - 1 / 3) * 3));
  else {
    const k = smooth((u - 2 / 3) * 3);
    yaw = -REACH * (1 - k);
    pitch = BOW * Math.sin(Math.PI * k);
  }
  // (it breathes in where it stops: at each end of the sweep, and longest at the roots)
  const ends = Math.exp(-((u - 1 / 3) ** 2) / 0.002) + Math.exp(-((u - 2 / 3) ** 2) / 0.002);
  const sniff = Math.min(1, 0.6 * ends + pitch / BOW);
  return { yaw, pitch, sniff };
}

export function kingsPose(amount) {
  const a = Math.min(1, Math.max(0, amount));
  return { cloak: 1 - smooth(a / 0.7), king: smooth((a - 0.15) / 0.6), crown: smooth((a - 0.45) / 0.4) };
}
