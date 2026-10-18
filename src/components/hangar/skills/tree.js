// The skill tree: four branches (flight, guns, ground, powers), each 15
// points over four rows, 60 in all (the design: docs/superpowers/specs/
// 2026-10-18-one-arsenal-and-hangar-design.md, Part 4). Every branch opens
// from two first-row nodes that need nothing; a deeper node needs any one
// of the row above in its own branch, never another branch's, so the order
// is the player's. A few deep nodes also need a key: any one achievement
// from a universe (KEYS), which makes the whole tree a whole-site thing.
// The unique weapons' nodes are here (`soon`) and count toward the cost,
// but can't be taken until the weapons arrive. Pure data.
//
//   BRANCHES, BRANCH_LABEL, KEY_LABEL
//   NODES     by id: { branch, row, cost, name, line, key?, soon?, borrows? (a crew), does: { effect: amount } }
//   KEYS      by universe: achievement ids (Achievements.jsx), any one of which opens it
//   BATTLEFRONT  the achievements that earn no points (it's apart from all this)
//
// An effect is an adder (boost, accel, cruise, agility, level, ammo, shots)
// or a multiplier (the rest); rules.js's effectsOf says which.

export const BRANCHES = ['flight', 'guns', 'ground', 'powers'];
export const BRANCH_LABEL = { flight: 'Flight', guns: 'Guns', ground: 'Ground', powers: 'Powers' };
export const KEY_LABEL = { starwars: 'Star Wars', rickmorty: 'Rick and Morty', breakingbad: 'Breaking Bad', universe: 'the universe’s worlds' };

const node = (branch, row, cost, name, line, does, more = {}) => ({ branch, row, cost, name, line, does, ...more });

export const NODES = {
  // ── Flight ──
  afterburn: node('flight', 1, 1, 'Afterburn', 'Boost a tenth harder.', { boost: 0.1 }),
  trim: node('flight', 1, 1, 'Trim tabs', 'Turn a little quicker.', { agility: 0.08 }),
  deflectors: node('flight', 2, 2, 'Deflector tuning', 'Shields come back a quarter faster.', { regen: 1.25 }),
  plating: node('flight', 2, 2, 'Ablative plating', 'Take a tenth less from the game’s ships.', { armor: 0.9 }),
  slipstream: node('flight', 3, 2, 'Slipstream', 'A faster cruise, and quicker to it.', { cruise: 0.1, accel: 0.15 }),
  hotdrive: node('flight', 3, 2, 'Hot drive', 'The jump charges a quarter quicker.', { jump: 0.75 }),
  instinct: node('flight', 4, 2, 'Ace’s instinct', 'Tighter turns, and levelling out sooner.', { agility: 0.15, level: 0.2 }),
  kesselrun: node('flight', 4, 3, 'Kessel run', 'A fifth more boost, and a faster cruise.', { boost: 0.2, cruise: 0.1 }, { key: 'starwars' }),
  // ── Guns ──
  trigger: node('guns', 1, 1, 'Quick trigger', 'The primary fires a little faster.', { cadence: 0.92 }),
  racks: node('guns', 1, 1, 'Deep racks', 'One more round in the ordnance rack.', { ammo: 1 }),
  scatter: node('guns', 2, 2, 'Wide scatter', 'One more shot in every secondary burst.', { shots: 1 }),
  loader: node('guns', 2, 2, 'Fast loader', 'Ordnance comes back a fifth sooner.', { reload: 0.8 }),
  longlock: node('guns', 3, 1, 'Smart rounds', 'Heavy rounds home harder and fly further.', { homing: 1.3, life: 1.25 }),
  'u-seismic': node('guns', 4, 2, 'Seismic charge', 'Ordnance: dropped behind you, a ring of silence, then the bang.', {}, { key: 'starwars', soon: true }),
  'u-darkmatter': node('guns', 4, 2, 'Concentrated dark matter', 'Secondary: one slow bolt through every ship in its line.', {}, { key: 'rickmorty', soon: true }),
  'u-crystal': node('guns', 4, 2, 'Blue sky cluster', 'Ordnance: a homing round that bursts into six blue shards.', {}, { key: 'breakingbad', soon: true }),
  'u-energon': node('guns', 4, 2, 'Energon arc', 'Secondary: lightning to the lock and on to three more.', {}, { key: 'universe', soon: true }),
  // ── Ground ──
  tough: node('ground', 1, 1, 'Tough', 'A tenth more health on foot.', { health: 1.1 }),
  steady: node('ground', 1, 1, 'Steady hands', 'Less scatter from every gun in the hand.', { spread: 0.85 }),
  coolant: node('ground', 2, 2, 'Coolant', 'Guns heat slower and cool faster.', { heat: 0.85, cool: 1.15 }),
  medic: node('ground', 2, 2, 'Field medic', 'Health comes back half again as fast.', { heal: 1.5 }),
  hardhit: node('ground', 3, 1, 'Hard hitter', 'Hit the game’s troops a little harder.', { damage: 1.15 }),
  'u-amban': node('ground', 4, 2, 'Amban phase-pulse rifle', 'One heavy shot, a long reach, and a flash.', {}, { key: 'starwars', soon: true }),
  'u-particle': node('ground', 4, 2, 'Particle beam', 'Held, not fired: a beam that heats fast.', {}, { key: 'rickmorty', soon: true }),
  'u-m60': node('ground', 4, 2, 'The M60 from the trunk', 'A long stream, slow to heat, with a kick.', {}, { key: 'breakingbad', soon: true }),
  'u-gauntlet': node('ground', 4, 2, 'Repulsor gauntlet', 'A palm blast that throws them back.', {}, { key: 'universe', soon: true }),
  // ── Powers ──
  quickcharge: node('powers', 1, 1, 'Fast charge', 'The big one charges a fifth quicker.', { charge: 1.2 }),
  recovery: node('powers', 1, 1, 'Quick recovery', 'The power cools down sooner.', { powerCool: 0.85 }),
  overdrive: node('powers', 2, 2, 'Overdrive', 'Every power lasts a fifth longer.', { powerDur: 1.2 }),
  scavenger: node('powers', 2, 1, 'Scavenger', 'Pickups charge the big one half again as much.', { pickup: 1.5 }),
  overcharge: node('powers', 3, 2, 'Overcharge', 'The big one hits a quarter harder.', { bigPunch: 1.25 }),
  'b-xwing': node('powers', 4, 2, 'Jedi training', 'Any ship may carry Force Focus and the Torpedo salvo.', {}, { key: 'starwars', borrows: 'xwing' }),
  'b-falcon': node('powers', 4, 2, 'Smuggler’s tricks', 'Any ship may carry Never tell me the odds and Chewie on the quad guns.', {}, { key: 'starwars', borrows: 'falcon' }),
  'b-cruiser': node('powers', 4, 2, 'Portal tech', 'Any ship may carry the Portal gun and Wubba lubba dub dub.', {}, { key: 'rickmorty', borrows: 'cruiser' }),
  'b-rv': node('powers', 4, 2, 'Yeah, science', 'Any ship may carry Magnets and Say my name.', {}, { key: 'breakingbad', borrows: 'rv' }),
};

// any one of these opens a universe's nodes (sorted by hand from Achievements.jsx: the worlds of each)
export const KEYS = {
  starwars: ['hacker', 'order66', 'deathstar', 'trench', 'rebels', 'empire', 'aurebesh', 'interdicted', 'gcwSworn', 'gcwLiberator', 'gcwMajor', 'gcwTurncoat', 'gcwAdmiral', 'shotfirst', 'docking94', 'rancor', 'bounty', 'womprats', 'canyon', 'speederchase', 'yavinbriefing', 'yavinscramble', 'yavinceremony', 'coruscantrace', 'bespinfreezing', 'bespinduel', 'bespinlobot', 'starmapride', 'dagobahraise', 'canyonmission', 'firsttransport', 'sanctuary', 'tosche'],
  rickmorty: ['wubba', 'meeseeks', 'showmewhatyougot', 'peaceamongworlds', 'roy', 'royfiftyfive', 'offthegrid', 'goldstar', 'rickall', 'wong', 'customs', 'squanch', 'gazorp', 'birdworld', 'fantasy', 'microverse', 'anatomy', 'needful', 'jerryboree', 'purge', 'pluto', 'gearworld', 'vindicators', 'simulation', 'storytrain', 'fortress', 'froopyland', 'nimbus', 'gromflomites', 'heistcon', 'snakeplanet', 'nuptia', 'gloopynoops', 'resort', 'schwifty', 'evilrick', 'evilmorty', 'cronenberg', 'blooddome', 'prison', 'cablestudio', 'dream', 'agency', 'meeseeksgolf', 'vat', 'dim35c', 'daycare', 'wafers', 'council', 'votemorty', 'citadelout', 'locos', 'citadelfall'],
  breakingbad: ['heisenberg', 'bluesky', 'purity'],
  universe: ['rollout', 'groundbridge', 'cyHoldGates', 'cyEnergonRun', 'cyMetroplex', 'cyMegatron', 'cyTeamPrime', 'cyEnergonMine', 'cyMatrix', 'cyKaonPits', 'cyDarkEnergon', 'cyRunThemDown', 'cyZeta', 'cyRelic', 'spacebridge', 'iacon', 'grounded', 'onestand', 'onefall', 'mellon', 'balrog', 'ringbearer', 'fellowship', 'kingreturns', 'worthy', 'ironman', 'captain', 'hawkeye', 'widow', 'thor', 'hulk', 'whatever', 'spidey', 'suitup', 'thinkmark', 'regent', 'soundbarrier', 'savvy', 'dundie', 'remover', 'rifted', 'grandtour', 'wanted', 'karman', 'moonwalk', 'redplanet'],
};

export const BATTLEFRONT = ['galacticassault', 'heroesvsvillains', 'blast'];
