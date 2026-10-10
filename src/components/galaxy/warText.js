// A system's place in one of the galaxy's wars, in words and a colour, for
// the holotable (HoloMap.jsx) and the galaxy panel. Pure, tested. A row is
// gcw.js's warTable row: `control` is its holder's hold of it, so a front's
// progress is how much of that hold is gone, and an attacked system's is how
// much is left.
//
// progressOf(row) → 0..1; standing(row, now) → a line; systemLabel(row, now,
// you) → its button's words on the holotable; heldColour(side);
// whose(side, the = 'The') → 'The Rebellion’s', 'the Separatists’';
// areaLines(areas, side) → [{ id, name, text, yours }]; recordLine(side,
// record) → your rank and record (warState.js's mine) | null; oathOf(war,
// current, suggested) → the war's two sides for the oath's buttons;
// battleLine(row, now, side) → a system's battle, its kind for your part in it.
// And the war's news, from the table (gcw.js's warTable): ago(ms); newsLine(e)
// → one of its events; eventLine(e, now) → and when; feedOf(events, n) → the
// newest few, newest first; strengthLine(table, side) | null; phaseLine(table,
// now); campaignLine(table, now) → its phase and its end; soon(ms);
// nextOpLine(table, now) → the next offensive | null; orderLine(order, now) |
// null; resultLine(table) → the campaign's result (or the last's) | null;
// partLine(record) → your part in it (warState.js's mine) | null.
//
// And the battle you're in, as warfront.js's info has it (WarHud.jsx's lines
// under its own, BattleEnd.jsx's card): stageLine(info) → 'Stage 2 of 3 ·
// Destroy: Bridge' (or what opens next, and when; a stage with a `title`,
// the game's, says it: 'Stage 1 of 5 · Destroy the corvettes · 2 of 3 left'); objectiveBars(info) → up
// to three [{ id, name, k, down }]; nextLine(next) → 'Bomber wave in 0:40';
// whyLine(result) → why it ended, in words; resultTitle(result, team) →
// 'Victory' | 'Defeat' | 'Battle over'; yoursLine(yours) → what you did in
// it; afterLine(info, sysName, now) → 'Victory at Hoth · next battle in
// 4:05' (a battle decided early: the rest of its window's the end card's and
// that line's); endCard(info) → { title, tone, why, yours, points } | null;
// cardTime(info) → the seconds BattleEnd.jsx's card is still to show (END.show
// from the end; none to a pilot who came after).

import { BATTLE_KINDS } from './battles';
import { rankOf } from './ranks';
import { AREAS, SIDES, WARS } from './sides';
import { systemById } from './systems';
import { typeOf } from '../universe/battleObjectives';

// how long, as the war table says it: 4:05, 1h 12m, 2d 3h
export const span = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 3600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const h = Math.floor(s / 3600);
  return h < 48 ? `${h}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
};
const pctOf = (k) => `${Math.round(k * 100)}%`;
const rateOf = (r) => `${r > 0 ? '+' : r < 0 ? '−' : '±'}${Math.abs(r).toFixed(1)}%/h`;

export const progressOf = (row) => (row.attack ? row.control : 1 - row.control);

// a side's verb, for one or many (the Separatists and the Hutts are many: the
// names that end in an s); and whose, theirs with the ’ alone
const does = (side, one, many) => (SIDES[side].short.endsWith('s') ? many : one);
const own = (name) => (name.endsWith('s') ? `${name}’` : `${name}’s`);
export const whose = (side, the = 'The') => own(`${the} ${SIDES[side].short}`);

export function standing(row, now) {
  if (row.attack) {
    const by = row.attack.by === 'hutt' ? 'The Hutts raid' : `The ${SIDES[row.attack.by].short} ${does(row.attack.by, 'attacks', 'attack')}`;
    return `${by}: ${pctOf(row.control)} held, ${span(row.attack.until - now)} to hold out`;
  }
  // whose it is (and cut off from its supply lines: it holds less well, and doesn't mend)
  const held = `${row.owner === 'hutt' ? 'Hutt space' : `Held by the ${SIDES[row.owner].short}`}${row.cut ? ', cut off from supply' : ''}`;
  if (row.front) return `${held} · ${pctOf(progressOf(row))} liberated · ${rateOf(row.effRate ?? row.rate)}`;
  return held;
}

// a system's button on the holotable, in words: all its marks on the map say
// (the drawing's only a picture of this)
export const systemLabel = (row, now, you) =>
  `${row.name}: ${standing(row, now)}${row.major ? ', the major order' : ''}${row.decisive ? ', the decisive battle' : ''}${row.battle?.fighting ? ', a battle on' : ''}${you ? ', you fought here' : ''}`;

export const heldColour = (side) => SIDES[side]?.colour;

const theSide = (side) => (side === 'hutt' ? 'Hutt space' : whose(side));
const ofThe = (side) => whose(side, 'the');

export function areaLines(areas, side) {
  return AREAS.filter((a) => areas[a.id]).map((a) => {
    const r = areas[a.id];
    if (r.holder) return { id: a.id, name: a.name, text: `${theSide(r.holder)}, all ${r.total}`, yours: r.holder === side };
    return { id: a.id, name: a.name, text: side ? `${r[side] ?? 0} of ${r.total} ${ofThe(side)}` : `Contested, ${r.total} systems`, yours: false };
  });
}

export function recordLine(side, record) {
  const rank = rankOf(side, record?.points ?? 0);
  if (!rank) return null;
  if (!record?.battles) return `${rank.name} · no battles yet`;
  return `${rank.name} · ${Math.round(record.points)} points · ${record.wins} won of ${record.battles} ${record.battles === 1 ? 'battle' : 'battles'}`;
}

export function oathOf(war, current, suggested) {
  const w = WARS[war];
  return { war, sides: [w.liberator, w.raider].map((id) => ({ id, name: SIDES[id].name, colour: SIDES[id].colour, sworn: current?.side === id, suggested: suggested === id })) };
}

// (and a space level's Starfighter Assault, which is no kind of the war's: surface/missions/starfighter.js)
const KINDS = { ...BATTLE_KINDS, starfighter: { name: 'Starfighter Assault', text: { attack: 'Starfighter Assault: attack', defend: 'Starfighter Assault: defend' } } };

export function battleLine(row, now, side) {
  const b = row.battle;
  if (!b) return null;
  const kind = KINDS[row.kind] ?? KINDS.assault;
  const role = side && side === b.attacker ? 'attack' : side && side === b.defender ? 'defend' : null;
  if (!b.fighting) return `${kind.name}: regrouping, the next in ${span(b.end - now)}`;
  return `${role ? kind.text[role] : kind.name} · ${span(b.fightEnd - now)} left`;
}

// ── The war's news ──

const nameOf = (id) => systemById(id)?.name ?? id;
const The = (side) => (side === 'hutt' ? 'The Hutts' : `The ${SIDES[side].short}`);
const the = (side) => (side === 'hutt' ? 'the Hutts' : `the ${SIDES[side].short}`);
const PHASE_NEWS = { Opening: 'The campaign opens', Escalation: 'The war escalates', Decisive: 'The decisive phase', Climax: 'The climax' };
const PHASE_NEXT = { Escalation: 'escalation', Decisive: 'the decisive phase', Climax: 'the climax' };
const VERBS = { liberate: 'Liberate', hold: 'Hold', take: 'Take' };

// how long ago, as the news says it: just now, 12m ago, 2h ago, 2d ago
export function ago(ms) {
  const m = Math.floor(Math.max(0, ms) / 60e3);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

export function newsLine(e) {
  const from = e.origin ? ` from ${nameOf(e.origin)}` : '';
  if (e.type === 'captured') return `${nameOf(e.sys)} fell to ${the(e.by)}`;
  if (e.type === 'capital') return `${nameOf(e.sys)}, ${whose(e.from, 'the')} capital, fell to ${the(e.by)}`;
  if (e.type === 'attack') return `${The(e.by)} ${e.counter ? does(e.by, 'strikes back at', 'strike back at') : does(e.by, 'attacks', 'attack')} ${nameOf(e.sys)}${from}`;
  if (e.type === 'raid') return `${The(e.by)} raid ${nameOf(e.sys)}${from}`;
  if (e.type === 'repelled') return `${The(e.holder)} held ${nameOf(e.sys)}`;
  if (e.type === 'area') return `${The(e.by)} ${does(e.by, 'holds', 'hold')} all of ${AREAS.find((a) => a.id === e.area)?.name.replace(/^The /, 'the ') ?? e.area}`;
  if (e.type === 'lastStand') return `${whose(e.by)} last stand, at ${nameOf(e.sys)}`;
  if (e.type === 'phase') return e.phase === 'Climax' && e.sys ? `The climax: the decisive battle, at ${nameOf(e.sys)}` : (PHASE_NEWS[e.phase] ?? e.phase);
  return e.type;
}
export const eventLine = (e, now) => `${newsLine(e)} · ${ago(now - e.at)}`;

// the newest few things that happened, newest first (a capital's fall is told
// once, as a capital's: gcw.js tells it as a capture too)
export function feedOf(events, n = 6) {
  const list = events ?? [];
  const capitals = new Set(list.filter((e) => e.type === 'capital').map((e) => `${e.k}:${e.sys}`));
  return list
    .filter((e) => !(e.type === 'captured' && capitals.has(`${e.k}:${e.sys}`)))
    .slice(-n)
    .reverse();
}

export function strengthLine(table, side) {
  const r = table.strength?.[side];
  if (!r) return null;
  const trend = r.trend6h > 0 ? ` · ▲${r.trend6h} in 6h` : r.trend6h < 0 ? ` · ▼${-r.trend6h} in 6h` : '';
  return `${r.systems} ${r.systems === 1 ? 'system' : 'systems'} · ${pctOf(r.share)} of the galaxy’s worth${trend}`;
}

export const phaseLine = ({ phase }, now) => `${phase.name} · ${phase.next ? `${PHASE_NEXT[phase.next] ?? phase.next} in ${span(phase.until - now)}` : `${span(phase.until - now)} to the end`}`;

export const campaignLine = (table, now) => (table.phase.next ? `${phaseLine(table, now)} · campaign ends in ${span(table.ends - now)}` : phaseLine(table, now));

// how soon, to the minute: under a minute, 47m, 1h 12m, 2d 3h
export const soon = (ms) => (ms < 60e3 ? 'under a minute' : ms < 3600e3 ? `${Math.ceil(ms / 60e3)}m` : span(ms));

const OFFENSIVE = { republic: 'Republic', separatists: 'Separatist', rebel: 'Rebel', empire: 'Imperial', newrepublic: 'New Republic', remnant: 'Remnant' };
export function nextOpLine({ nextOp }, now) {
  if (!nextOp) return null;
  const what = nextOp.by === 'hutt' ? 'Hutt raid' : `${OFFENSIVE[nextOp.by] ?? SIDES[nextOp.by].short} offensive`;
  return `Next ${what} ${nextOp.at > now ? `in ${soon(nextOp.at - now)}` : 'any moment'}`;
}

export const orderLine = (order, now) => (order ? `${VERBS[order.verb] ?? order.verb} ${nameOf(order.sys)} · ${span(order.until - now)} left` : null);

// the campaign's result: who leads in its last step, who won once it's over,
// or the campaign before's at the start of the next (table.previous, kept in
// this browser: warState.js)
export function resultLine(table) {
  const r = table.result ?? table.previous ?? null;
  if (!r) return null;
  const n = (table.result ? table.campaign : r.n) + 1;
  const decisive = r.decisive ? ` · decisive at ${nameOf(r.decisive)}` : '';
  if (r.over) return `${The(r.winner)} won campaign ${n} outright: every system theirs${decisive}`;
  const second = Math.max(...Object.entries(r.vp).filter(([side]) => side !== r.winner).map(([, v]) => v));
  return `${The(r.winner)} ${r.final ? 'won' : does(r.winner, 'leads', 'lead')} campaign ${n} · ${r.vp[r.winner]}–${second} on victory points${decisive}`;
}

// your part in the war this campaign: the system you moved most (a share of
// its hold, warState.js's `moved`), and how many you moved at all
export function partLine(record) {
  const moved = (record?.systems ?? []).filter((x) => Math.round((x.moved ?? 0) * 100) > 0).sort((a, b) => b.moved - a.moved);
  if (!moved.length) return null;
  const all = moved.length > 1 ? ` · ${moved.length} systems in all` : '';
  return `You moved ${nameOf(moved[0].id)} ${pctOf(moved[0].moved)} this campaign${all}`;
}
// ── the battle you're in ──
const plural = (name) => (/s$/.test(name) ? name : `${name}s`);
const NUMBERS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
const counted = (n, word) => `${NUMBERS[n] ?? n} ${n === 1 ? word : plural(word)}`;
const RUNNERS = { transport: 'transport', corvette: 'corvette', gozanti: 'Gozanti', nubian: 'Nubian', shuttle: 'shuttle' };
const attacking = (info) => (info.team === null || info.team === undefined ? null : info.team === info.laid?.attacker);

export function stageLine(info) {
  const st = info?.stage;
  if (!st || st.index >= st.count) return null;
  const head = `Stage ${st.index + 1} of ${st.count}`;
  const left = (info.objectives ?? []).filter((o) => !o.down);
  const all = info.objectives ?? [];
  if (!all.length) return head;
  // (all of a name: how many, or how many of them to take; else the first still standing)
  const same = all.every((o) => o.name === all[0].name);
  const o = same ? all[0] : (left[0] ?? all[0]);
  const need = st.need ?? all.length;
  const what = same && all.length > 1 ? (need < all.length ? `${need} of ${all.length} ${plural(o.name)}` : `${o.name} ×${all.length}`) : o.name;
  if (!st.open) return `${head} · ${what} opens in ${span((st.opensIn ?? 0) * 1000)}`;
  const att = attacking(info);
  if (att === null) return `${head} · ${what}`;
  // (a stage with its own words, the game's: a Starfighter Assault's, with how many are left)
  if (st.title) return `${head} · ${st.title}${all.length > 1 ? ` · ${left.length} of ${all.length} left` : ''}`;
  const verbs = o.verbs ?? typeOf(o).verbs;
  return `${head} · ${verbs[att ? 0 : 1]}: ${what}`;
}

export const objectiveBars = (info) => (info?.objectives ?? []).slice(0, 3).map((o) => ({ id: o.id, name: o.name, k: o.down ? 0 : Math.max(0, Math.min(1, o.hp / (o.hpMax || 1))), down: Boolean(o.down) }));

const NEXT = { wave: 'Bomber wave', push: 'Final push', reserve: 'Their reserve squadron' };
export function nextLine(next) {
  if (!next) return null;
  const name = NEXT[next.type] ?? (next.name ? next.name.charAt(0).toUpperCase() + next.name.slice(1) : 'More');
  return `${name} in ${span(Math.max(0, next.in) * 1000)}`;
}

const WHY = {
  flagship: 'The reactor went',
  interdictor: 'The Interdictor went down',
  deathstar: 'The Death Star’s reactor went',
  gate: 'The Shield Gate fell',
  objectives: 'Every objective fell',
  clock: 'Held out to the end',
  tickets: 'Out of fighters',
  forced: 'Called off',
};
export function whyLine(result) {
  if (!result) return null;
  if (result.why === 'runners' && result.runners) {
    const r = result.runners;
    const kind = RUNNERS[r.kind] ?? r.kind;
    return result.winner === r.team ? `${counted(r.out, kind)} got away` : `${counted(r.down, kind)} were stopped`;
  }
  return WHY[result.why] ?? 'It’s over';
}

export const resultTitle = (result, team) => (team === null || team === undefined ? 'Battle over' : result.winner === team ? 'Victory' : 'Defeat');

export function yoursLine(yours) {
  const parts = [];
  if (yours?.kills) parts.push(`${yours.kills} ${yours.kills === 1 ? 'kill' : 'kills'}`);
  if (yours?.objectives) parts.push(`${yours.objectives} ${yours.objectives === 1 ? 'objective' : 'objectives'}`);
  if (yours?.intercepts) parts.push(`${yours.intercepts} ${yours.intercepts === 1 ? 'intercept' : 'intercepts'}`);
  return parts.length ? parts.join(' · ') : 'Nothing of theirs down this time';
}

export function afterLine(info, sysName, now) {
  const r = info.result;
  const att = attacking(info);
  const who = att === null ? `The ${SIDES[info.on?.sides?.[r.winner]]?.short ?? 'other side'} won` : resultTitle(r, info.team);
  return `${who} at ${sysName} · next battle in ${span((info.on?.end ?? now) - now)}`;
}

export function endCard(info) {
  const r = info?.result;
  if (!r) return null;
  const team = info.team ?? null;
  const points = Math.round(r.yours?.points ?? 0);
  return { title: resultTitle(r, team), tone: team === null ? null : r.winner === team ? 'won' : 'lost', why: whyLine(r), yours: yoursLine(r.yours), points: `+${points} ${points === 1 ? 'point' : 'points'}` };
}

// the end card's time on screen, and how often BattleEnd.jsx looks for an end
export const END = { show: 8, every: 500 };
export const cardTime = (info) => (info?.result ? Math.max(0, END.show - (info.result.ago ?? 0)) : 0);
