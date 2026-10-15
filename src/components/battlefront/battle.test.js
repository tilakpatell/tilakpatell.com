import { describe, expect, it } from 'vitest';
import { loadRulebook } from '../../lib/battlefront/rulebook.js';
import { hothFlatNav } from '../../lib/battlefront/fixtures/hothFlat.js';
import { addPlayer as addSoldier } from '../../lib/battlefront/sim.js';
import { BOTS, STEP, addPlayer, botsAt, createBattle, deploy, grant, step, view, worldMove } from './battle.js';
import { LEVEL_MODES, MODES } from './index.js';
import naboo from '../../data/bf2017/maps/naboo.json';

const rb = loadRulebook();
const nav = hothFlatNav(rb);
const make = (bots = { 1: 0, 2: 0 }) => createBattle({ rulebook: rb, level: 'hoth', mode: 'galacticAssault', nav, bots });

describe('the battle on the sim in its own mode, with the page’s deploy screen', () => {
  it('starts the player on the deploy screen with the side’s classes on offer and the stage in the game’s words', () => {
    const b = make();
    addPlayer(b, { team: 2 });
    const v = view(b);
    expect(v.deploy.open).toBe(true);
    expect(v.deploy.offers.filter((o) => o.kind === 'class').map((o) => o.id)).toEqual(['d-orig-assault', 'd-orig-heavy', 'd-orig-officer', 'd-orig-specialist']);
    expect(v.mode.stageName).toBe('TAKE OUT ANY THREATS TO THE AT-ATS');
  });

  it('deploys the player into the sim as a soldier of the class picked, on the navgrid', () => {
    const b = make();
    addPlayer(b, { team: 2 });
    expect(deploy(b, 'player', { classId: 'd-orig-heavy' }).ok).toBe(true);
    const v = view(b);
    expect(v.deploy.open).toBe(false);
    expect(v.player.state).toBe('alive');
    expect(v.player.weapon).toBe(rb.classes['d-orig-heavy'].weapon);
    // (the player, and the stage's two walkers: the sim's own mode)
    expect(v.entities.filter((e) => e.kind === 'soldier')).toHaveLength(1);
    expect(v.entities.filter((e) => e.kind === 'walker')).toHaveLength(2);
    expect(deploy(b, 'player', { classId: 'l-orig-heavy' }).ok).toBe(false);
  });

  it('walks ahead where the player faces, at the sim’s 20 Hz', () => {
    const b = make();
    addPlayer(b, { team: 2 });
    deploy(b, 'player', { classId: 'd-orig-assault' });
    const a = view(b).player.at.slice();
    for (let i = 0; i < 20; i++) step(b, [{ id: 'player', move: [0, 1], yaw: 0 }]);
    const p = view(b).player.at;
    expect(b.sim.time).toBeCloseTo(20 * STEP, 9);
    expect(p[2] - a[2]).toBeGreaterThan(2);
    expect(Math.abs(p[0] - a[0])).toBeLessThan(0.01);
  });

  it('turns the stick into the world: right is −X at yaw 0', () => {
    expect(worldMove([1, 0], 0).map((v) => Math.round(v * 1e9) / 1e9)).toEqual([-1, 0]);
    expect(worldMove([0, 1], Math.PI / 2).map((v) => Math.round(v * 1e9) / 1e9)).toEqual([1, 0]);
  });

  it('heats the rifle and draws its bolts', () => {
    const b = make();
    addPlayer(b, { team: 2 });
    deploy(b, 'player', { classId: 'd-orig-assault' });
    for (let i = 0; i < 10; i++) step(b, [{ id: 'player', move: [0, 0], yaw: 0, fire: true }]);
    const v = view(b);
    expect(v.player.heat).toBeGreaterThan(0);
    expect(v.bolts.length).toBeGreaterThan(0);
  });

  it('says which weapon each soldier holds, and whose each bolt is and where it began', () => {
    const b = make({ 1: 1, 2: 0 });
    addPlayer(b, { team: 2 });
    deploy(b, 'player', { classId: 'd-orig-heavy' });
    for (let i = 0; i < 6; i++) step(b, [{ id: 'player', move: [0, 0], yaw: 0, fire: true }]);
    const v = view(b);
    const me = v.entities.find((e) => e.id === b.player.id);
    expect(me.weapon).toBe('dlt19');
    for (const e of v.entities) expect(e.weapon, e.id).toBe(b.sim.entities.get(e.id).gun?.row?.id ?? null);
    const mine = v.bolts.filter((x) => x.owner === b.player.id);
    expect(mine.length).toBeGreaterThan(0);
    for (const x of mine) {
      // (a bolt still flying, or one let go of lately: battle.js's SPENT)
      const sim = b.sim.bolts.list.find((s) => s.id === x.id) ?? b.spent.find((s) => s.bolt.id === x.id).bolt;
      expect(x.from).toEqual(sim.from);
      expect(x.travelled).toBe(sim.travelled);
      expect(x.speed).toBe(rb.weapons.dlt19.firing.speed);
    }
  });

  it('puts the player in a squad, listed as “You” first and the bots by name', () => {
    const b = make({ 1: 0, 2: 3 });
    addPlayer(b, { team: 2 });
    const v = view(b);
    expect(v.squad.letter).toBe('A');
    // (the bots by their names from the game's lists: lib/battlefront/ai/names.js)
    const named = v.squad.members.slice(1).map((m) => b.sim.entities.get(m.id).name);
    expect(named.every((n) => /^TK-\d+/.test(n))).toBe(true);
    expect(v.squad.members.map((m) => m.name)).toEqual(['You', ...named]);
    expect(v.squad.members[0].local).toBe(true);
    expect(v.squad.members[1]).toMatchObject({ alive: true, cls: 'assault' });
  });

  it('offers the HQ and each squadmate on the deploy screen, with why a mate cannot be spawned on', () => {
    const b = make({ 1: 0, 2: 3 });
    addPlayer(b, { team: 2 });
    const [, hit] = view(b).squad.members;
    b.sim.entities.get(hit.id).combatAt = b.sim.time;
    const spawns = view(b).deploy.spawns;
    expect(spawns[0]).toMatchObject({ kind: 'hq', name: 'IMPERIAL HQ' });
    expect(spawns.slice(1).map((s) => s.kind)).toEqual(['mate', 'mate', 'mate']);
    expect(spawns[1]).toMatchObject({ id: hit.id, name: b.sim.entities.get(hit.id).name, cls: 'assault', blocked: 'combat', reason: 'IN COMBAT' });
    expect(spawns[2]).toMatchObject({ blocked: null, reason: null });
  });

  it('deploys the player on a squadmate, behind them, keeping the player’s id; and not on one just hit', () => {
    const b = make({ 1: 0, 2: 3 });
    addPlayer(b, { team: 2 });
    const [, hit, mate] = view(b).squad.members;
    b.sim.entities.get(hit.id).combatAt = b.sim.time;
    expect(deploy(b, 'player', { classId: 'd-orig-heavy', spawn: 'squad', mate: hit.id })).toEqual({ ok: false, why: 'combat' });
    expect(deploy(b, 'player', { classId: 'd-orig-heavy', spawn: 'squad', mate: mate.id })).toEqual({ ok: true });
    const v = view(b);
    const m = b.sim.entities.get(mate.id);
    expect(Math.hypot(v.player.at[0] - m.at[0], v.player.at[2] - m.at[2])).toBeLessThan(8);
    const id = v.player.id;
    expect(v.squad.members[0]).toMatchObject({ id, name: 'You', alive: true, cls: 'heavy' });
    expect(v.scoreboard[2].rows.find((r) => r.id === mate.id).points).toBe(rb.points.earn.squadSpawn);
    b.sim.entities.get(id).alive = false;
    b.player.state = 'deploying';
    expect(deploy(b, 'player', { classId: 'd-orig-assault' }).ok).toBe(true);
    expect(view(b).player.id).toBe(id);
  });

  it('fields the bots and ends the round when told', () => {
    const b = make({ 1: 2, 2: 2 });
    addPlayer(b, { team: 2 });
    expect(view(b).entities.filter((e) => e.kind === 'soldier')).toHaveLength(4);
    b.force('win', 2);
    expect(view(b).mode.result).toEqual({ winner: 2, why: 'forced' });
  });

  it('aims from the player’s own body: a soldier’s 1.4 m, Yoda’s by his 1.2 m', () => {
    const aimHeight = (choice) => {
      const b = make();
      addPlayer(b, { team: 1 });
      grant(b, 4000);
      expect(deploy(b, 'player', choice).ok).toBe(true);
      step(b, [{ id: 'player', move: [0, 0], yaw: 0, pitch: 0 }]);
      const me = b.sim.entities.get(b.player.id);
      return me.aim[1] - me.at[1];
    };
    expect(aimHeight({ classId: 'l-orig-assault' })).toBeCloseTo(1.4, 9);
    expect(aimHeight({ kind: 'hero', id: 'yoda' })).toBeCloseTo((1.4 * 1.2) / 1.7, 9);
  });

  it('a hero in the view: his own blaster, and his three abilities by the game’s names with their states', () => {
    const b = make();
    addPlayer(b, { team: 1 });
    grant(b, 4000);
    expect(deploy(b, 'player', { kind: 'hero', id: 'hansolo' }).ok).toBe(true);
    const v = view(b);
    expect(v.player).toMatchObject({ unit: 'hero', cls: 'hansolo', weapon: 'hansolo', hpMax: 650 });
    expect(v.player.abilities.map((a) => [a.slot, a.id, a.name, a.ready, a.active])).toEqual([
      [1, 'Ability_HanSolo_DemolitionGrenade', 'DETONITE CHARGE', true, false],
      [2, 'Ability_HanSolo_Sharpshooterz', 'SHARPSHOOTER', true, false],
      [3, 'Ability_HanSolo_ShoulderCharges', 'SHOULDER CHARGE', true, false],
    ]);
    step(b, [{ id: 'player', move: [0, 0], yaw: 0, ability: 2 }]);
    const after = view(b).player;
    expect(after.abilities[1]).toMatchObject({ active: true, ready: false });
    expect(after.weapon).toBe('W_Pistol_DL44_HanSolo_Sharpshooterz');
    expect(v.player.cards).toEqual([]);
    // (deployed with the Collection's picks: the cards this life wears, by name, and what the first one does)
    const d = make();
    addPlayer(d, { team: 1 });
    grant(d, 4000);
    deploy(d, 'player', { kind: 'hero', id: 'hansolo', cards: ['hansolo.1', 'hansolo.4', 'leia.1'] });
    expect(view(d).player.cards).toEqual([
      { id: 'hansolo.1', name: 'HEAVILY MODIFIED BLASTER' },
      { id: 'hansolo.4', name: 'BROAD SHOULDERS' },
    ]);
    step(d, [{ id: 'player', move: [0, 0], yaw: 0, fire: true }]);
    expect(view(d).player.heat).toBeCloseTo(0.13 * 0.75, 9);
    // (a class's abilities have no name of the Collection's)
    const c = make();
    addPlayer(c, { team: 1 });
    deploy(c, 'player', { classId: 'l-orig-assault' });
    expect(view(c).player.abilities.map((a) => a.name)).toEqual([null, null, null]);
  });

  it('puts the player down when told, for the kill screen', () => {
    const b = make({ 1: 1, 2: 1 });
    addPlayer(b, { team: 2 });
    deploy(b, 'player', {});
    b.force('die', 2);
    step(b, []);
    expect(view(b).player.state).toBe('down');
  });

  it('keeps how each one fell for the figures: the hit part, the shot’s way as the death clip’s side; nothing on the living', () => {
    const b = make();
    addPlayer(b, { team: 2 });
    deploy(b, 'player', { classId: 'd-orig-assault' });
    const me = b.sim.entities.get(b.player.id);
    const them = addSoldier(b.sim, { team: 1, classId: 'l-orig-assault', at: [me.at[0], me.at[1], me.at[2] + 15], yaw: Math.PI });
    const target = b.sim.entities.get(them);
    // (the ground falls away: aim from the player's chest at theirs)
    const pitch = Math.atan2(target.at[1] + 1.2 - (me.at[1] + 1.4), 15);
    let kill = null;
    for (let i = 0; i < 400 && !kill; i++) kill = step(b, [{ id: 'player', move: [0, 0], yaw: 0, pitch, fire: i % 2 === 0 }]).find((e) => e.type === 'kill');
    expect(kill?.target).toBe(them);
    const v = view(b);
    const victim = v.entities.find((e) => e.id === them);
    expect(victim.fall).toMatchObject({ part: kill.part, weapon: kill.weapon });
    expect(victim.fall.at).toHaveLength(3);
    expect(victim.hitDir).toEqual(kill.dir);
    const living = v.entities.find((e) => e.id === b.player.id);
    expect(living.fall).toBe(null);
    expect(living.hitDir).toBe(null);
  });
});

describe('the pieces together: the squad list, the figures and the fallen', () => {
  it('lists the squad from the very soldiers the figures draw, each with its gun, and a mate shot down as fallen in both', async () => {
    const THREE = await import('three');
    const { createFigures } = await import('./figures/figures.js');
    const { createHeld } = await import('./figures/held.js');
    const b = make({ 1: 0, 2: 3 });
    addPlayer(b, { team: 2 });
    expect(deploy(b, 'player', { classId: 'd-orig-heavy' }).ok).toBe(true);
    const held = createHeld({ load: async () => ({ scene: new THREE.Group(), animations: [] }) });
    const figs = createFigures({ scene: new THREE.Scene(), loadBody: async () => ({ model: new THREE.Group(), clips: {}, sockets: {} }), held, loadStance: async () => new Map() });
    for (let i = 0; i < 4; i++) step(b, [{ id: 'player', move: [0, 0], yaw: 0 }]);
    let v = view(b);
    figs.update(v.entities, 0.05);
    const drawn = new Map(v.entities.map((e) => [e.id, e]));
    expect(v.squad.members).toHaveLength(4);
    for (const m of v.squad.members) {
      const e = drawn.get(m.id);
      expect(e, m.id).toBeTruthy();
      expect(figs.figure(m.id), m.id).not.toBe(null);
      // (the figures hand a dying or down soldier to the ragdolls: figures.js's DEAD)
      expect(m.alive).toBe(!['dying', 'down'].includes(e.state));
      expect(e.weapon, m.id).toBe(b.sim.entities.get(m.id).gun?.row?.id ?? null);
    }
    expect(v.squad.members[0].id).toBe(v.player.id);
    // a mate down: the list greys them, the view hands the figure how it fell
    const mate = v.squad.members[1].id;
    b.sim.entities.get(mate).alive = false;
    b.sim.entities.get(mate).state = 'down';
    v = view(b);
    expect(v.squad.members[1]).toMatchObject({ id: mate, alive: false });
    expect(['dying', 'down']).toContain(v.entities.find((e) => e.id === mate).state);
    expect(v.deploy.spawns.find((s) => s.id === mate)?.blocked ?? 'dead').toBe('dead');
  });
});

describe('the other modes on the game world’s route (lane 6)', () => {
  it('knows their ids; a level plays the modes its world has a level for (Hoth’s Galactic Assault, and Supremacy on its second level)', () => {
    expect(MODES).toEqual(['galacticAssault', 'strike', 'extraction', 'ewokHunt', 'supremacy']);
    expect(LEVEL_MODES).toEqual({ hoth: ['galacticAssault', 'supremacy'] });
  });
  it('a battle in Strike takes the mode’s objectives from the level’s map rulebook', () => {
    const book = { ...rb, maps: { ...rb.maps, naboo: { map: naboo.rows, stages: {} } } };
    const t = rb.teams['Orig:hoth_01'];
    const b = createBattle({ rulebook: book, level: 'naboo', mode: 'strike', nav, bots: { 1: 0, 2: 0 }, teams: { 1: t.light, 2: t.dark } });
    // (where they stand on the map; the height is the navgrid's ground there)
    expect(b.objectives.map((o) => [o.type, o.name, [o.at[0], o.at[2]].map(Math.round)])).toEqual([
      ['arm', 'A', [696, 1]],
      ['arm', 'B', [758, 9]],
    ]);
  });
  it('refuses a mode it does not know', () => {
    expect(() => createBattle({ rulebook: rb, level: 'hoth', mode: 'conquest', nav })).toThrow(/conquest/);
  });
});

// (Low is the floor: every bot is a body drawn and a mind stepped, so five a
// side at Low, Instant Action's own cap, and the page's eight above)
describe('the bots a side by the quality level', () => {
  it('is five at Low and eight above', () => {
    expect(botsAt('low')).toEqual({ 1: 5, 2: 5 });
    for (const d of ['mid', 'high', 'ultra', undefined]) expect(botsAt(d)).toEqual({ 1: BOTS, 2: BOTS });
  });
});
