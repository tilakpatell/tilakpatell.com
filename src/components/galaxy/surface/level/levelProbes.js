// A level pack's reflection volumes (probes.json, lane E0): which one lights
// where the visitor stands. A probe is the game's box (its centre and its
// three scaled axes, the unit cube's half at each); inside one, the
// smallest that holds you; outside all, the nearest centre within reach.
//
//   probeAt(list, [x, y, z], reach = 150) → probe | null (pure)
//   createLevelProbes({ world, list, onProbe }) → { update([x, y, z]), current() }
//     onProbe({ id, url, … }) when the probe changes; url the faces' stem,
//     as gameLit.js's probes name theirs

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function probeAt(list, p, reach = 150) {
  let inside = null;
  let insideVol = Infinity;
  let near = null;
  let nearD = reach;
  for (const probe of list ?? []) {
    const d = [p[0] - probe.centre[0], p[1] - probe.centre[1], p[2] - probe.centre[2]];
    // (the box's own coordinates: each axis's length is its full size)
    const holds = probe.axes.every((a) => {
      const l2 = dot(a, a);
      return l2 > 0 && Math.abs(dot(d, a) / l2) <= 0.5;
    });
    const vol = probe.axes.reduce((v, a) => v * Math.sqrt(dot(a, a)), 1);
    if (holds && vol < insideVol) {
      inside = probe;
      insideVol = vol;
    }
    const dist = Math.hypot(...d);
    if (dist < nearD) {
      near = probe;
      nearD = dist;
    }
  }
  return inside ?? near;
}

export function createLevelProbes({ world, list, onProbe }) {
  let now = null;
  return {
    update(p) {
      const next = probeAt(list, p);
      if (!next || next === now) return;
      now = next;
      onProbe?.({ ...next, url: `models/galaxy/bf2017/levels/${world}/${next.faces}` });
    },
    current: () => now,
  };
}
