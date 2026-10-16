// What's out in the world for the quest you're on (quests.js says where you
// are in it): a beam of light where it wants you to go, the things to pick
// up, the gates of a race (the next one lit), and what's to be shot at
// (targets, womp rats, droids, troopers who shoot back), each a figure
// that wanders or holds its ground and goes down when it's hit enough.
//
// createActivity({ parent, world, warm, beam color }) → { show(quest,
// progress), update(dt, you, t) → events (pickups and kills, for the
// quest), targets (what the blaster can hit: { x, y, z, r, hit(damage) }),
// kill(tag), shooters (who fire back, or swipe: { from, spread, damage,
// melee }), clear(), dispose() }
//
// A step's spawn: { kind, n, at, spread, roam, speed, hp, tag, scale,
// model, still, face, y, level (the height it's on, where there are
// floors over floors: a pit under a throne room), leash, hostile: { range, every, spread, damage,
// burst, strafe, shield (hostiles.js's: bursts of fire, circling you, a shield that soaks hits),
// blade ({ color, hilt?, stance? }: a lit saber in its hand, and on the 2017 game's rig it fences: duellists.js), parry (the
// share of your strikes a duellist holds its block for: the game's rules decide the rest), guard (a brawler's: strokes it turns),
// delay (before its first shot), chase (m/s: it comes for you), melee,
// reach (how close it has to be to hit), cone, far, smell, memory (what it
// perceives: hostiles.js's sensesFor), force ({ every, push }: a duellist's
// shove at you, every so often, close to) }, side ('yours': it fights beside
// you, at the nearest hostile, and the hostiles fire at it; a shot's `at`
// and `victim` say so) }
//
// Every figure has a head (hostiles.js's hostileStep, on lib/ai): it
// knows you only as it perceives you (the world's solids are its line of
// sight: walker.js's lineClear), weighs what to do with you in sight (hold
// and fire, strafe, close, back off, take cover from your line of fire or
// flank round when it has no shot: `shot` tokens, SHOTS at once across the
// world, and `melee` tokens, one swing at a time), goes to look where it
// last had you, and joins its group's search (one lib/ai/search a tag: the
// spots that could hide you round where you were lost, shared) before it
// goes back to its wander. Its shots go to what it believes (a shot's `to`,
// which the scene aims at; `guessed` when it can only guess). An `update`
// event { type: 'search', tag } says a group has started looking.
//
// And a body that shows it (hostiles.js's hostileBody, the seam from
// brain to body): its feet paced to the ground its head moves it over (a
// strafer's hips toward its travel, its chest on you), its head on what it
// watches or sweeping as it searches, with a '?' over it while it looks
// for you and a '!' when it has you again; crouched in cover once it's
// there, standing to fire. A rigged one holds its gun in its hand and
// raises it to aim and fire from the muzzle (universe/gunplay.js, as
// yours), or plays the pistol's aim and shot on its upper half; a
// duellist's saber is in its own hand, held at guard and swung in its
// strokes (heldBlade.js's bladeInHand; duellists.js fences with it: what
// lands on you is what its blade sweeps, handed to the scene through
// shooters as a melee contact). It flinches by where it's hit, goes down by
// the way the shot went (die.fwd, die.back, die.blown) and lies a while
// before it goes; one with no clips falls over about its feet that way. A
// Tusken brandishes its rifle over its head when it sees you. Bodies never
// change what the heads decide: every shot, kill and event is as it was.
// hit(t, damage, { at }) takes where it landed (a point in the world: the
// head or the chest).
//
// The parts: ./rules.js (the pure ones), ./marks.js (the beam, the pickups,
// the gates, the remote, the health bar and the marks), ./activity.js
// (createActivity). The names here are the old activity.js's.

export { ARMS, DEATH, armsOf, fallen, friendlyAim, hostileAim, nextForce, upToFire } from './rules';
export { healthBar, markMaterials } from './marks';
export { createActivity } from './activity';
