// The Guardians of the Globe: season two's team, as rules only. Eight rows
// (./hall.js draws the stand-ins on their plinths, ./cavalryScene.js the two
// at a fight), who is sent to a fight (`pick`), and the two sent stepped
// through it (`stepCavalry`: where they go, and the blows they land, which
// ./foes.js applies through `input.cavalry`). Plain [x, y, z] arrays, metres;
// a step is never longer than 0.05 s, and a frame is stepped whole.
//
// A big fight is a mission's, or any fight with four or more foes within
// 400 m of Mark (`bigFight`); not episode 8's, which is Mark's and Dad's
// alone. Two come from the hall's door, each with a signature:
//
// - Immortal (flies) leads: a blow every so often, as Mark's.
// - Rex Splode (ground) throws a car at the nearest foe: a blast where it
//   lands, a blow on everyone within `blast.r`.
// - Dupli-Kate (ground): four of her hold a foe `copies.hold` s.
// - Shrinking Rae (flies) blinks: gone, and back behind a foe, who staggers.
// - Monster Girl (ground): a monster `monster.for` s, three blows a swing;
//   then a girl again, winded, for the rest of the fight.
// - Robot (a drone, flies) marks the strongest foe (the one with most
//   blows left), and its drones' bolts hit it.
// - Black Samson (ground) stands with the crowd (`sense.crowd`), his shield
//   wall round them, and hits whoever comes close.
// - Bulletproof (flies, the fastest) catches someone falling (the city's
//   own rescues, not a mission's: those are Mark's to count) before Mark can.

// (`tint` and `trim`: each costume's two main colours, as ./guardianLooks.js dresses them)
export const GUARDIANS = [
  { id: 'immortal', name: 'Immortal', tint: 0x283454, trim: 0xe9c84a, mode: 'fly', sig: 'lead', speed: 90, every: 1.2, hits: 1, broad: true },
  { id: 'rex', name: 'Rex Splode', tint: 0xeed46c, trim: 0xc7321f, mode: 'ground', sig: 'blast', speed: 14, every: 6, hits: 1 },
  { id: 'kate', name: 'Dupli-Kate', tint: 0xd7cfe8, trim: 0x4b2f61, mode: 'ground', sig: 'copies', speed: 12, every: 4, hits: 1 },
  { id: 'rae', name: 'Shrinking Rae', tint: 0x34362a, trim: 0xc9cb4c, mode: 'fly', sig: 'blink', speed: 80, every: 3, hits: 1 },
  { id: 'monster', name: 'Monster Girl', tint: 0x2f6f9e, trim: 0x45494e, mode: 'ground', sig: 'monster', speed: 12, every: 1.5, hits: 3 },
  { id: 'robot', name: 'Robot', tint: 0xe07a3e, trim: 0xb2552a, mode: 'fly', sig: 'mark', speed: 70, every: 2.5, hits: 1 },
  { id: 'samson', name: 'Black Samson', tint: 0xb9bcc0, trim: 0x666784, mode: 'ground', sig: 'shield', speed: 12, every: 1.5, hits: 1, broad: true },
  { id: 'bulletproof', name: 'Bulletproof', tint: 0xf2c73c, trim: 0xe5842a, mode: 'fly', sig: 'catch', speed: 140, every: 1.5, hits: 1 },
];
export const guardianOf = (id) => GUARDIANS.find((g) => g.id === id) ?? null;

// the signatures' numbers
export const SIG = {
  copies: { n: 4, hold: 2 },
  monster: { for: 12 },
  blink: { stagger: 0.8, behind: 2 },
  blast: { r: 10 },
  shield: { r: 12 },
  catch: { reach: 3 },
};
// a fight they come to: this many foes within this of Mark
export const CALL = { foes: 4, within: 400, reach: { fly: 6, ground: 4 }, off: { fly: 5, ground: 2.6 }, over: 3, home: 2 };
const KNOWN = new Set(['flaxan', 'flaxanElite', 'mauler', 'seismic']);
// who is sent when nothing in the fight asks for anyone in particular
const ORDER = ['immortal', 'kate', 'monster', 'rae', 'robot', 'rex', 'samson', 'bulletproof'];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const dist = (a, b) => len(sub(a, b));
const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const clampDt = (dt) => Math.min(0.05, Math.max(0, dt || 0));
function toward(p, to, speed, dt) {
  const d = sub(to, p);
  const l = len(d);
  const step = speed * dt;
  if (l <= step) return [...to];
  return [p[0] + (d[0] / l) * step, p[1] + (d[1] / l) * step, p[2] + (d[2] / l) * step];
}

// Whether a fight is one they come to: a mission's (not episode 8's), or
// four or more foes standing within 400 m of Mark. `foes`: the ones
// standing, each { kind, p }.
export function bigFight(foes, hero, mission = null) {
  if (!foes.length || foes.some((e) => e.kind === 'omniman')) return false;
  if (mission) return true;
  return foes.filter((e) => dist(e.p, hero) < CALL.within).length >= CALL.foes;
}

// The two for a fight: { foes: [{ kind }], falling: bool, crowd: n } →
// [a, b], never the same one twice. Bulletproof for someone falling, Black
// Samson for a crowd within 40 m, Rex for Maulers, Robot for a foe nobody
// knows; the rest in ORDER.
export function pick(fight = {}) {
  const want = [];
  const add = (id) => {
    if (!want.includes(id)) want.push(id);
  };
  if (fight.falling) add('bulletproof');
  if ((fight.crowd ?? 0) > 0) add('samson');
  if ((fight.foes ?? []).some((e) => e.kind === 'mauler')) add('rex');
  if ((fight.foes ?? []).some((e) => !KNOWN.has(e.kind ?? 'flaxan'))) add('robot');
  for (const id of ORDER) add(id);
  return want.slice(0, 2);
}

export const newCavalry = () => ({ on: false, who: [], marked: null, fights: 0 });

// Two called to a fight, from `from` (the hall's door)
export function callCavalry(prev, ids, from) {
  const who = ids.map((id, i) => {
    const g = guardianOf(id);
    const p = [from[0] + (i ? 2 : -2), from[1] + (g.mode === 'fly' ? 1 : 0), from[2]];
    return { id, p, v: [0, 0, 0], state: 'come', cool: 0.5 + i * 0.4, t: 0, target: null, said: false, copies: 0, monster: 0, winded: false, blink: 0, shield: null };
  });
  return { ...prev, on: true, who, marked: null, fights: prev.fights + 1 };
}

// Where each goes and what each does this step. sense: { hero, fight (the
// fight is still on), foes: [{ id, kind, p, left, live }], falling: [x, y, z]
// | null (someone falling who is the city's own), crowd: [x, y, z] | null
// (where the people nearest the fight are), home: [x, y, z] (the hall's door) }.
// → { cav, ev }: ev are blows for ./foes.js ({ type: 'gHit' | 'gHold' |
// 'gStagger' | 'gBlast', who, foe, hits, at, r, for }), `gCatch` (Bulletproof
// has the faller), `gMark` (Robot's pick), `gShield` (Samson's wall is up),
// `arrive` (one is at the fight, for a word) and `gone` (both back in the hall).
export function stepCavalry(prev, sense, rawDt) {
  const dt = clampDt(rawDt);
  const ev = [];
  if (!prev.on) return { cav: prev, ev };
  const c = { ...prev, who: prev.who.map((w) => ({ ...w, p: [...w.p] })) };
  const live = (sense.foes ?? []).filter((e) => e.live !== false);
  const home = sense.home ?? [0, 0, 21];
  for (const w of c.who) {
    const g = guardianOf(w.id);
    const was = w.p;
    w.t += dt;
    w.cool = Math.max(0, w.cool - dt);
    if (w.copies > 0) w.copies = Math.max(0, w.copies - dt);
    if (w.blink > 0) w.blink = Math.max(0, w.blink - dt);
    if (w.monster > 0) {
      w.monster = Math.max(0, w.monster - dt);
      if (w.monster === 0) w.winded = true;
    }
    let to = w.p;
    let speed = g.speed;
    if (!sense.fight || w.state === 'home') {
      // the fight over: back to the hall, and in at its door
      w.state = 'home';
      w.shield = null;
      to = [home[0], home[1] + (g.mode === 'fly' ? 1 : 0), home[2]];
      if (dist(w.p, to) < CALL.home) w.state = 'gone';
    } else if (g.sig === 'catch' && sense.falling) {
      // the one falling, before Mark can
      to = sense.falling;
      if (dist(w.p, to) < SIG.catch.reach) {
        ev.push({ type: 'gCatch', who: w.id, at: [...to] });
        w.cool = 1;
      }
    } else if (g.sig === 'shield' && sense.crowd) {
      // with the people: the wall up round them, a blow for whoever comes close
      to = [...sense.crowd];
      if (flat(w.p, to) < 3) {
        if (!w.shield) {
          w.shield = [...to];
          ev.push({ type: 'gShield', who: w.id, at: [...to], r: SIG.shield.r });
        }
        const near = live.filter((e) => flat(e.p, w.p) < CALL.reach.ground + 2);
        if (near.length && w.cool <= 0) {
          w.cool = g.every;
          ev.push({ type: 'gHit', who: w.id, foe: near[0].id, hits: g.hits });
        }
      } else w.shield = null;
    } else if (live.length) {
      // the foe to go for: the strongest for Robot, the nearest for the rest
      const target = g.sig === 'mark' ? live.reduce((a, b) => ((b.left ?? 1) > (a.left ?? 1) ? b : a)) : live.reduce((a, b) => (dist(b.p, w.p) < dist(a.p, w.p) ? b : a));
      if (g.sig === 'mark' && c.marked !== target.id) {
        c.marked = target.id;
        ev.push({ type: 'gMark', who: w.id, foe: target.id });
      }
      w.target = target.id;
      const fly = g.mode === 'fly';
      const off = CALL.off[g.mode];
      const d = sub(w.p, target.p);
      const fd = Math.hypot(d[0], d[2]) || 1;
      // beside it: a flier a little over it, a walker on its ground
      to = [target.p[0] + (d[0] / fd) * off, fly ? target.p[1] + CALL.over : target.p[1], target.p[2] + (d[2] / fd) * off];
      const reach = CALL.reach[g.mode];
      if (dist(w.p, target.p) <= reach + off) {
        if (w.state === 'come') {
          w.state = 'fight';
          ev.push({ type: 'arrive', who: w.id });
        }
        if (w.cool <= 0 && !w.winded) {
          w.cool = g.every;
          switch (g.sig) {
            case 'copies':
              w.copies = SIG.copies.hold;
              ev.push({ type: 'gHold', who: w.id, foe: target.id, for: SIG.copies.hold });
              break;
            case 'blink': {
              // gone, and back behind it (the far side from Mark)
              const away = sub(target.p, sense.hero);
              const al = len(away) || 1;
              w.p = [target.p[0] + (away[0] / al) * SIG.blink.behind, target.p[1] + CALL.over, target.p[2] + (away[2] / al) * SIG.blink.behind];
              w.blink = 0.6;
              ev.push({ type: 'gStagger', who: w.id, foe: target.id, for: SIG.blink.stagger });
              break;
            }
            case 'monster':
              // the monster, once a fight; a girl again after it, winded
              if (!w.monster && !w.winded && !w.wasMonster) {
                w.monster = SIG.monster.for;
                w.wasMonster = true;
              }
              ev.push({ type: 'gHit', who: w.id, foe: target.id, hits: w.monster > 0 ? g.hits : 1 });
              break;
            case 'blast':
              ev.push({ type: 'gBlast', who: w.id, foe: target.id, at: [...target.p], r: SIG.blast.r, hits: g.hits });
              break;
            default:
              ev.push({ type: 'gHit', who: w.id, foe: target.id, hits: g.hits });
          }
        }
      }
    } else w.state = w.state === 'come' ? 'come' : 'fight';
    if (w.state !== 'gone' && !w.blink) w.p = toward(w.p, to, speed, dt);
    w.v = dt > 0 ? sub(w.p, was).map((v) => v / dt) : [0, 0, 0];
  }
  if (c.who.every((w) => w.state === 'gone')) {
    c.on = false;
    c.who = [];
    c.marked = null;
    ev.push({ type: 'gone' });
  }
  return { cav: c, ev };
}
