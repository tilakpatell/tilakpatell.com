// A destination's box, headings and the `place()` that turns one's data into
// the world's coordinates (./destinations.js has the list and the dial; the
// rows themselves are ./rows1.js, ./rows2.js and ./rows3.js, in dial order).

export const DEST_COL = { x0: -470, x1: -330 };
export const DEST_X = (DEST_COL.x0 + DEST_COL.x1) / 2;
export const destZ = (i) => 900 + 100 * i;
// a place's box: `deep` along z round its row, `wide` across the column's middle
export const destArea = (i, deep = 50, wide = DEST_COL.x1 - DEST_COL.x0) => ({ x0: DEST_X - wide / 2, x1: DEST_X + wide / 2, z0: destZ(i) - deep / 2, z1: destZ(i) + deep / 2 });

// headings, as rules.js has them: a figure facing `face` looks along (cos, −sin)
export const N = Math.PI / 2;
export const S = -Math.PI / 2;
export const E = 0;
export const W = Math.PI;

// where every portal home arrives: beside the garage's portal, facing into the room
export const GARAGE_BACK = { x: -301.2, z: 101.4, face: 0 };

// A place: its row `i`, its box, and everything in it in metres from its
// middle (dx east, dz south), turned into the world's coordinates here.
// `acts`: a hotspot that, used, tells the place's builder (its `actions`, by
// name). `escape`: a place left in a hurry: once its `spot` is used (with its
// `after` spot used first on this visit, else that spot says `before`),
// getting home through the portal inside `s` seconds is `task` done.
// `goal`: the hotspot the map points to for the place's thing to do, where
// no talk or escape says (the Vindicators' door to Rick's rooms).
// `collect`: a task done once every one of its `spots` has been used on a
// visit (the simulation's slips); with `escape: { s }`, the clock starts
// then instead, and getting home inside it is the task done; with `start`,
// nothing is done yet: the place is only told ('collected': Evil Rick comes).
// `power`: the place run on the power kind (../games/power.js): { task,
// from, to, need, s, who, lost }: cells carried one at a time from the `from`
// spot to the `to` one before `s` seconds of charge run out, `lost` said (by
// `who`) when they do; its spots tell the stage (`power-take`, `power-give`),
// which steps it (./stage.js).
// `deal`: the place run on the deal kind (../games/deal.js): { task, items,
// bad, need, looks, who, lost, words? }: things for sale (`items`, its own
// spots), `bad` of them cursed (a count, dealt afresh each run, or the ids);
// a thing's first use looks it over (`looks` of them), its second takes it;
// `need` taken with no curse is the task, a cursed one taken is `lost`, said
// by `who`; `words`, the HUD's (the deal's own if not given). Each thing's
// spot tells the stage (`deal-<id>`), which steps it.
// `caught`: what's said when one of the place's hunters catches Morty
// (stage.js's NPC behaviour); he's put back at the way in. `spotted`: what's
// said when one of them sees him and starts (a hunter's own `hunt.spotted`
// wins).
// A person or one of the crowd may carry `ai` (stage.js): `wander` points in
// metres from the middle (turned into the world's here), `watch`, `bark`,
// `hunt`. Anyone who roams is marked so, and isn't in the way.
const roams = (ai) => Boolean(ai?.wander || ai?.hunt);
export function place(i, { id, name, note, kind, deep, wide, sky, ceiling, people = [], extras = [], spots = [], solids = [], tasks = [], say = {}, done = {}, unlock = {}, acts = {}, escape = null, goal = null, collect = null, power = null, deal = null, caught = null, spotted = null, kinds = [] }) {
  const area = destArea(i, deep, wide);
  const cx = DEST_X;
  const cz = destZ(i);
  const w = (o) => ({ ...o, x: cx + o.dx, z: cz + o.dz, ...(o.ai && { ai: { ...o.ai, ...(o.ai.wander && { wander: o.ai.wander.map(([dx, dz]) => [cx + dx, cz + dz]) }) }, ...(roams(o.ai) && { roams: true }) }) });
  return {
    id,
    i,
    name,
    note,
    kind,
    area,
    sky,
    ceiling,
    centre: { x: cx, z: cz },
    // in at the south edge facing north; the way home 3 m behind
    arrive: { x: cx, z: area.z1 - (kind === 'room' ? 4.6 : 7), face: N },
    back: { x: cx, z: area.z1 - (kind === 'room' ? 1.6 : 4) },
    people: people.map((p) => ({ ...w(p), area: id })),
    // the crowd: copies of the Meshy figures made for it, standing about ({ kind, dx, dz, face })
    extras: extras.map((e) => w(e)),
    hotspots: spots.map((s) => ({ r: 1.4, ...w(s), area: id })),
    // what can't be walked through: { id, dx, dz, w, d } boxes and { id, dx, dz, r } posts
    solids: solids.map((s) => w(s)),
    tasks,
    say,
    done,
    unlock,
    acts: { ...acts, ...(power && { [power.from]: 'power-take', [power.to]: 'power-give' }), ...(deal && Object.fromEntries(deal.items.map((s) => [s, `deal-${s}`]))) },
    escape,
    goal,
    collect,
    power,
    deal,
    caught,
    spotted,
    kinds,
  };
}
