// The company’s boats, shared by Lothlórien’s hythe and the Anduin: the
// chapter’s grey boats moored where a stage says, and while the company is
// afloat one under each three walkers (front to back, as they sit in the
// line), on the river’s water. A stage’s scene hands each walker’s place to
// `seat` as it poses them, and asks `floor` what carries them.
//
//   crews(walkers, boats) → [[walker]]: the line split front to back, three to a boat (pure)
//   createBoats(boats, water, { moorings }) → {
//     seat(id, at)       a walker’s place this frame
//     update(afloat)     the boats under their crews; the rest at their moorings
//     floor(x, z)        what a walker sits at: on the water while afloat, else null }
//   boats: the chapter’s (towns/lorien/boat.js’s, turned to face +z), water: parts.js’s waterOn

const SEAT = 0.3; // m over the water a sitter’s seat is
const PER = 3;

export function crews(walkers, boats) {
  const line = [...walkers].sort((a, b) => a.z - b.z);
  const per = Math.max(PER, Math.ceil(line.length / boats));
  const out = [];
  for (let i = 0; i < line.length; i += per) out.push(line.slice(i, i + per));
  return out;
}

export function createBoats(boats, water, { moorings = [] } = {}) {
  const seats = new Map();
  let afloat = false;
  return {
    seat(id, at) {
      seats.set(id, { id, x: at.x, z: at.z });
    },
    update(on) {
      afloat = on;
      const groups = on ? crews([...seats.values()], boats.length) : [];
      boats.forEach((b, i) => {
        const crew = groups[i];
        if (crew) {
          const z = crew.reduce((a, w) => a + w.z, 0) / crew.length;
          const y = water(0, z);
          b.group.visible = y != null;
          if (y != null) b.group.position.set(0, y - b.waterline, z);
          return;
        }
        // (a boat with no one in it lies at its mooring, if it has one)
        const m = moorings[i];
        b.group.visible = Boolean(m);
        if (b.group.visible) b.group.position.set(m[0], (water(m[0], m[1]) ?? m[2] ?? 0) - b.waterline, m[1]);
      });
      seats.clear();
    },
    floor(x, z) {
      if (!afloat) return null;
      const y = water(x, z);
      return y == null ? null : y + SEAT;
    },
  };
}
