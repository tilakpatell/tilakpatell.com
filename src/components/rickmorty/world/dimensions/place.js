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
// bad, need, looks, who, lost, take, words? }: things for sale (`items`, its
// own spots), `bad` of them cursed (a count, dealt afresh each run, or the
// ids); a thing's first use looks it over (`looks` of them), its second takes
// it (`take`, its prompt's verb once it's been looked over); `need` taken
// with no curse is the task, a cursed one taken is `lost`, said by `who`;
// `words`, the HUD's, every one of the deal's (the deal's own if not given).
// Each thing's spot tells the stage (`deal-<id>`), which steps it.
// `freeze`: the place run on the freeze kind (../games/freeze.js): { task,
// spot, who, lost, unlock }: from Morty's first step the people with
// `ai.lookout` turn their backs and look by turns; `spot` is where he jumps
// in (it tells the stage, `freeze-in`); moving while they look, or jumping
// in when their backs aren't turned, is `lost` (said by `who`, if anyone);
// played dead long enough, the task, and `unlock`, its achievement.
// `find`: the place run on the find kind (../games/find.js): { task, items,
// ours?, tells, s, cost, take, who, lost, unlock }: its people to pick from
// (`items`, each a person with a spot of their own), ours among them (dealt
// afresh each run, or fixed); a candidate's first use talks to him and the
// HUD says what he does (`tells`: `ours`, and one for each of the rest), his
// second takes him (`take`, his prompt's verb once he's been heard); the
// clock (`s`) runs from the first talk; ours taken is the task, and `unlock`
// its achievement; another costs `cost` seconds; out of time is `lost`, said
// by `who`. Each candidate's spot tells the stage (`find-<id>`), which steps
// it.
// `sequence`: the place run on the sequence kind (../games/sequence.js): {
// task, start?, early?, items, order?, need, s, who, lost, unlock, hunt?,
// spotted?, words? }: its sets (`items`, each a spot of its own), `need` of
// them in a running order (dealt afresh each run, or fixed), each switched on
// in its turn; a wrong one turns them all dark again; the clock (`s`) runs
// from the `start` spot (or, with none, the first set used; a set used before
// it says `early`); every one on is the task, and `unlock` its achievement;
// out of time is `lost`, said by `who`; with `hunt`, the place's hunters are
// after him while the clock runs (`spotted` said as it starts); `words`, the
// HUD's. Each set's spot tells the stage (`sequence-<id>`), and the start
// spot `sequence-start`. `before?`: with the place's `collect` `start`ed
// (sharing the task, ticking nothing), the countdown waits for it, and the
// start spot says `before` till then.
// `rhythm`: the place's song on the rhythm kind (../games/rhythm.js), played
// over the page from its `spot` (RmWorld's PLACES opens ../games/Schwifty.jsx
// there): { task, spot, unlock }: the song won is the task, `unlock` its
// achievement, handed over by the stage once the task's done.
// `climb`: the place run on the climb kind (../games/climb.js): { task, top,
// foot, spot, picks?, stairs, who, lost, fell, words?, unlock }: its solids
// with `ledge: true` (and their `top`) are stood on however high, one hop at
// a time (../rules.js); `stairs` ([{ id, steps }], each a flight of those
// ledges) bite by turns, and a tread stood on while its stair bites is
// `lost`, said by `who`; standing on `top` (and every one of `picks` picked
// up, each a spot of its own, or those alone with no top) is the task, and
// `unlock` its achievement; a fall from high is said (`fell`); `foot` and
// `spot` are the spots the map points at before he's up and once he is;
// `words`, the HUD's. Each pick's spot tells the stage (`climb-pick-<id>`).
// A spot may carry its `y`, the height it stands at (its pin floats there).
// Any of these games may carry its `meter` ({ title, label, icon }): what the
// HUD's readout of it is called (../games/meter.js's meterOf).
// `caught`: what's said when one of the place's hunters catches Morty
// (stage.js's NPC behaviour); he's put back at the way in. `spotted`: what's
// said when one of them sees him and starts (a hunter's own `hunt.spotted`
// wins).
// `achieve`: one of the place's tasks whose achievement (of the same id) is
// handed over once it's done, however it's done (a talk, a collect: stage.js's
// grant), fresh or done before.
// A person or one of the crowd may carry `ai` (stage.js): `wander` points in
// metres from the middle (turned into the world's here), `watch`, `bark`,
// `hunt`. Anyone who roams is marked so, and isn't in the way.
const roams = (ai) => Boolean(ai?.wander || ai?.hunt);
export function place(i, { id, name, note, kind, deep, wide, sky, ceiling, people = [], extras = [], spots = [], solids = [], tasks = [], say = {}, done = {}, unlock = {}, acts = {}, escape = null, goal = null, collect = null, power = null, deal = null, freeze = null, find = null, sequence = null, rhythm = null, climb = null, caught = null, spotted = null, achieve = null, kinds = [] }) {
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
    acts: { ...acts, ...(power && { [power.from]: 'power-take', [power.to]: 'power-give' }), ...(deal && Object.fromEntries(deal.items.map((s) => [s, `deal-${s}`]))), ...(freeze && { [freeze.spot]: 'freeze-in' }), ...(find && Object.fromEntries(find.items.map((s) => [s, `find-${s}`]))), ...(sequence && { ...Object.fromEntries(sequence.items.map((s) => [s, `sequence-${s}`])), ...(sequence.start && { [sequence.start]: 'sequence-start' }) }), ...(climb?.picks && Object.fromEntries(climb.picks.map((s) => [s, `climb-pick-${s}`]))) },
    escape,
    goal,
    achieve,
    collect,
    power,
    deal,
    freeze,
    find,
    sequence,
    rhythm,
    climb,
    caught,
    spotted,
    kinds,
  };
}
