// The galactic assaults (kind 'assault': ./assault.js runs one), a map a
// world: the two sides, the command posts on its flats, the attackers' way
// in by phases, and the words. Merged into MISSIONS by ./index.js.
//
//   sides      { attack, defend }: { id, name, short, colour, kinds
//              ([[kind, weight]…]: what their soldiers are) }
//   posts      [{ id, name, at: [x, z], r, fixed? ('attack' | 'defend': a
//              side's own, never taken, where it falls back to), wade? (in
//              wadeable shallows, not on dry ground) }]
//   phases     [{ name, posts: [ids], tickets }]: the attackers take every
//              post of one and the next begins, their tickets topped up to it
//   tickets    { attack, defend } at the start
//   forward?   the attackers' staging distance, metres short of their objective (RULES.forward unless said)
//   hideLife   the site's life kinds kept out of the way while it's fought
//   start      where you stand (and `yaw`) while choosing a side
//   lines      what your crew say: start, won, lost (by ship's crew)
//   barks      what the two sides shout, now and then: { attack, defend }
//   ends       the card: won, lost, why: { posts, tickets }
import { SITES as FOREST } from '../sites/forest';
import { turnAt } from '../sites/turnSite';

// (Kashyyyk's site is turned to the game's map, turnSite.js: its battle with it)
const KASHYYYK = turnAt(FOREST.kashyyyk.turn);

const EMPIRE = { id: 'empire', name: 'The Galactic Empire', short: 'Empire', colour: '#9fd0ff', kinds: [['snowtrooper', 1]] };
const REBELS = { id: 'rebels', name: 'The Rebel Alliance', short: 'Rebellion', colour: '#ff8a5a', kinds: [['hothtrooper', 1]] };
// (the Empire's garrison on Scarif: shoretroopers, and the death troopers of Krennic's guard)
const SCARIF_EMPIRE = { ...EMPIRE, kinds: [['shoretrooper', 3], ['deathtrooper', 1]] };
// (Rogue One's Pathfinders, off the U-wings into the palms)
const PATHFINDERS = { ...REBELS, kinds: [['rebel', 1]] };
// (the Endor garrison: stormtroopers, and the scouts off their bikes)
const ENDOR_EMPIRE = { ...EMPIRE, kinds: [['stormtrooper', 2], ['scouttrooper', 1]] };
// (General Solo's strike team, and the Ewoks who came out of the trees with them)
const STRIKE_TEAM = { ...REBELS, kinds: [['rebel', 3], ['ewok', 1]] };
const REPUBLIC = { id: 'republic', name: 'The Grand Army of the Republic', short: 'Republic', colour: '#9fd0ff', kinds: [['clone', 1]] };
const SEPARATISTS = { id: 'separatists', name: 'The Separatist droid army', short: 'Separatists', colour: '#ffb060', kinds: [['battledroid', 3], ['superdroid', 1]] };

// ── the three worlds' battles (docs/superpowers/specs/2026-10-07-three-worlds-design.md) ──
const STORMTROOPERS = { id: 'empire', name: 'The Galactic Empire', short: 'Empire', colour: '#9fd0ff', kinds: [['stormtrooper', 1]] };
const REBELTROOPERS = { id: 'rebels', name: 'The Rebel Alliance', short: 'Rebellion', colour: '#ff8a5a', kinds: [['rebel', 1]] };
const NEWREPUBLIC = { id: 'newrepublic', name: 'The New Republic', short: 'New Republic', colour: '#ff8a5a', kinds: [['rebel', 1]] };
const REMNANT = { id: 'remnant', name: 'The Imperial Remnant', short: 'Remnant', colour: '#9fd0ff', kinds: [['stormtrooper', 1]] };

// the two sides of each war (sides.js's WARS), as the three worlds' maps
// take them: the raider attacks, the liberator defends, except where a
// map says the other way round
export const WAR_SIDES = {
  clone: { light: REPUBLIC, dark: SEPARATISTS },
  gcw: { light: REBELTROOPERS, dark: STORMTROOPERS },
  remnant: { light: NEWREPUBLIC, dark: REMNANT },
};
export const sidesFor = (war, { attack = 'dark' } = {}) => {
  const w = WAR_SIDES[war] ?? WAR_SIDES.gcw;
  return attack === 'light' ? { attack: w.light, defend: w.dark } : { attack: w.dark, defend: w.light };
};


export const ASSAULTS = {
  hoth: {
    id: 'assault',
    system: 'hoth',
    kind: 'assault',
    name: 'The Battle of Hoth',
    line: 'The walkers are on the plain and the Empire’s troops are coming in behind them. The trench line holds, or Echo Base falls.',
    ride: null,
    start: [120, 300],
    yaw: 0.3,
    stars: [360, 540],
    achievement: 'galacticassault',
    sides: { attack: EMPIRE, defend: REBELS },
    posts: [
      { id: 'walkers', name: 'The walkers’ line', at: [240, 330], r: 22, fixed: 'attack' },
      { id: 'trenches', name: 'The trenches', at: [100, 370], r: 24 },
      { id: 'shieldgen', name: 'The shield generator', at: [90, 240], r: 20 },
      { id: 'ioncannon', name: 'The ion cannon', at: [-30, 340], r: 20 },
      { id: 'echobase', name: 'Echo Base’s door', at: [-20, -22], r: 22 }, // (the game's west mouth: sites/ice.js's MOUTH)
      { id: 'transports', name: 'The transports', at: [-248, 70], r: 14, fixed: 'defend' },
    ],
    phases: [
      { name: 'The trench line', posts: ['trenches', 'shieldgen'], tickets: 90 },
      { name: 'The ion cannon', posts: ['ioncannon'], tickets: 70 },
      { name: 'Echo Base', posts: ['echobase'], tickets: 60 },
    ],
    tickets: { attack: 100, defend: 160 },
    hideLife: ['snowtrooper', 'hothtrooper'],
    ends: {
      won: 'The field is yours',
      lost: 'The field is lost',
      why: { posts: 'The last post fell, and the base with it.', tickets: 'Your side ran out of reinforcements.' },
    },
    lines: {
      start: {
        xwing: [['luke', 'This is it. Everyone to the trenches, or the walkers walk right in.'], ['r2', '(A long, worried whistle.)']],
        falcon: [['han', 'Holding a trench against walkers. Great plan. Whose was it?'], ['chewie', '(A battle roar.)']],
        cruiser: [['rick', 'Pick a side, Morty. Either one, they both lose eventually.'], ['morty', 'Th-that’s not helpful, Rick!']],
        rv: [['walt', 'Pick your ground, Jesse. Then hold it.'], ['jesse', 'Hold it against what, the giant camels?!']],
      },
      won: {
        xwing: [['luke', 'We held. Nobody thought we could.'], ['r2', '(A triumphant, tumbling trill.)']],
        falcon: [['han', 'Well. Would you look at that.'], ['chewie', '(A long, victorious howl.)']],
        cruiser: [['rick', 'Field’s ours, Morty. Don’t get used to it.']],
        rv: [['walt', 'We won. Decisively.'], ['jesse', 'Yeah! Yeah, science!']],
      },
      lost: {
        xwing: [['luke', 'Fall back. Fall back to the transports.']],
        falcon: [['han', 'That’s it, we’re done here. Everybody out.']],
        cruiser: [['morty', 'We lost, Rick.'], ['rick', 'It’s Hoth, Morty. Everybody loses on Hoth.']],
        rv: [['walt', 'We lost the field. Not the war.']],
      },
    },
    barks: {
      attack: [['Snowtrooper', 'Forward! The walkers have the trench line in range!'], ['Snowtrooper', 'Take the generator. Then the cannon.'], ['Snowtrooper', 'Rebels in the trenches, sir. Lots of them.']],
      defend: [['Rebel trooper', 'Here they come! Hold your positions!'], ['Rebel trooper', 'Don’t let them get to the generator!'], ['Rebel trooper', 'Where are those snowspeeders?']],
    },
  },
  geonosis: {
    id: 'assault',
    system: 'geonosis',
    kind: 'assault',
    name: 'The Battle of Geonosis',
    line: 'Gunships on the plain, droids pouring out of the foundries, and the arena where it all began. The Clone Wars start here.',
    ride: null,
    start: [160, 230],
    yaw: -1.4,
    stars: [360, 540],
    achievement: 'galacticassault',
    sides: { attack: REPUBLIC, defend: SEPARATISTS },
    posts: [
      { id: 'landing', name: 'The landing zone', at: [260, 170], r: 24, fixed: 'attack' },
      { id: 'command', name: 'The forward command post', at: [120, 330], r: 18 },
      { id: 'ridge', name: 'The ridge', at: [100, 150], r: 18 },
      { id: 'gate', name: 'The arena gate', at: [-170, 150], r: 20 },
      { id: 'arena', name: 'The arena floor', at: [-260, 200], r: 26 },
      { id: 'flank', name: 'The arena’s flank', at: [-190, 215], r: 14, fixed: 'defend' },
    ],
    phases: [
      { name: 'The plain', posts: ['command', 'ridge'], tickets: 100 },
      { name: 'The arena gate', posts: ['gate'], tickets: 80 },
      { name: 'The arena', posts: ['arena'], tickets: 70 },
    ],
    tickets: { attack: 100, defend: 165 },
    hideLife: ['clone', 'battledroid', 'superdroid'],
    ends: {
      won: 'The arena is yours',
      lost: 'The arena is lost',
      why: { posts: 'The last post fell, and the arena with it.', tickets: 'Your side ran out of reinforcements.' },
    },
    lines: {
      start: {
        xwing: [['luke', 'This is where the Clone Wars began. Ben told me about it.'], ['r2', '(A grim, remembering beep: Artoo was here.)']],
        falcon: [['han', 'Clones against droids. Pick whichever side you think wins.'], ['chewie', '(A doubtful growl.)']],
        cruiser: [['rick', 'Robots versus clones, Morty. The most expensive argument in the galaxy.'], ['morty', 'Which side are we on?'], ['rick', 'Whichever one you pick, Morty.']],
        rv: [['jesse', 'Yo, it’s like a million robots out there.'], ['walt', 'Then we don’t miss.']],
      },
      won: {
        xwing: [['luke', 'The arena’s ours. Begun, the Clone War has.'], ['r2', '(A proud whistle.)']],
        falcon: [['han', 'Not bad for a bunch of toy soldiers.'], ['chewie', '(A satisfied rumble.)']],
        cruiser: [['rick', 'We won a war that lasts three more years, Morty. Congratulations.']],
        rv: [['walt', 'That’s how it’s done.'], ['jesse', 'We’re like, actual soldiers now!']],
      },
      lost: {
        xwing: [['luke', 'We’re pulling back. There’ll be another day.']],
        falcon: [['han', 'That’s it. Fall back to the ships.']],
        cruiser: [['morty', 'We lost, Rick!'], ['rick', 'Everybody loses the Clone Wars, Morty. That’s the point of them.']],
        rv: [['walt', 'Regroup. We go again.']],
      },
    },
    barks: {
      attack: [['Clone trooper', 'Move up! Move up!'], ['Clone trooper', 'Droids on the ridge, keep your heads down!'], ['Clone commander', 'Take the gate. The arena’s behind it.']],
      defend: [['Battle droid', 'Roger, roger.'], ['Battle droid', 'Hold the command post! Hold it!'], ['Super battle droid', 'Halt. Identify.']],
    },
  },
  scarif: {
    id: 'assault',
    system: 'scarif',
    kind: 'assault',
    name: 'The Battle of Scarif',
    line: 'The Pathfinders are off the U-wings and into the palms, and the beach is a crossfire between the bunkers and the walkers. The plans go out through the master switch, or they don’t go out at all.',
    ride: null,
    start: [-300, 185],
    yaw: 2.4,
    stars: [420, 600],
    achievement: 'galacticassault',
    sides: { attack: PATHFINDERS, defend: SCARIF_EMPIRE },
    posts: [
      { id: 'landing', name: 'The rebel landing', at: [-320, 200], r: 22, fixed: 'attack' },
      { id: 'beach', name: 'The beach', at: [-290, -180], r: 24 },
      { id: 'bunkers', name: 'The bunker line', at: [-130, -60], r: 20 },
      { id: 'pad9', name: 'Landing Pad Nine', at: [-110, 90], r: 24 },
      { id: 'switch', name: 'The master switch', at: [140, 150], r: 20 },
      { id: 'citadel', name: 'The Citadel’s pad', at: [90, 516], r: 20, fixed: 'defend' },
    ],
    phases: [
      { name: 'The beach', posts: ['beach', 'bunkers'], tickets: 100 },
      { name: 'The landing pads', posts: ['pad9'], tickets: 80 },
      { name: 'The master switch', posts: ['switch'], tickets: 70 },
    ],
    tickets: { attack: 100, defend: 165 },
    hideLife: ['shoretrooper', 'deathtrooper', 'rebel'],
    ends: {
      won: 'The transmission is through',
      lost: 'The beach is lost',
      why: { posts: 'The last post fell, and the switch with it.', tickets: 'Your side ran out of reinforcements.' },
    },
    lines: {
      start: {
        xwing: [['luke', 'This is the beach they held. Every one of them knew they weren’t coming back.'], ['r2', '(A low, steady whistle.)']],
        falcon: [['han', 'A beach fight against walkers and the Empire’s best. Pick a side, and pick it quick.'], ['chewie', '(A battle roar.)']],
        cruiser: [['rick', 'Rebels on a beach with no way out, Morty. Classic. Pick the side with the better tan.'], ['morty', 'Th-that’s the Empire, Rick!']],
        rv: [['walt', 'Hold the beach, or hold the switch. Either way you hold something.'], ['jesse', 'Yo, we don’t even have sunscreen.']],
      },
      won: {
        xwing: [['luke', 'The plans are away. It was worth it. All of it.'], ['r2', '(A quiet, proud trill.)']],
        falcon: [['han', 'Didn’t think we’d pull that off. Don’t tell anyone I said so.'], ['chewie', '(A long, victorious howl.)']],
        cruiser: [['rick', 'We won the one where everybody dies, Morty. Enjoy it while it lasts.']],
        rv: [['walt', 'The field is ours.'], ['jesse', 'Beach party! …Too soon?']],
      },
      lost: {
        xwing: [['luke', 'We’re pulling back. The Death Star’s in the sky.']],
        falcon: [['han', 'That’s it. Everybody to the ships, now!']],
        cruiser: [['morty', 'We lost, Rick.'], ['rick', 'It’s Scarif, Morty. Look up.']],
        rv: [['walt', 'We lost the beach. We did not lose the war.']],
      },
    },
    barks: {
      attack: [['Pathfinder', 'Rogue One, we’re with you! Move up the beach!'], ['Pathfinder', 'Walkers! Get to the trees!'], ['Pathfinder', 'Hold the pad! Bodhi needs that gate open!'], ['Pathfinder', 'The switch is out in the open. Cover whoever goes for it.']],
      defend: [['Shoretrooper', 'Rebels on the beach! Get to the bunkers!'], ['Shoretrooper', 'Keep them off the pads. Nobody reaches the tower.'], ['Death trooper', '(A burst of distorted comms chatter.)'], ['Shoretrooper', 'Walkers are coming down the beach. Hold your fire till they’re past.']],
    },
  },
  endor: {
    id: 'assault',
    system: 'endor',
    kind: 'assault',
    name: 'The Battle of Endor',
    line: 'The strike team is out of the village with every Ewok that can carry a spear, and between them and the shield generator there’s a legion of the Emperor’s best troops.',
    ride: null,
    start: [-190, 150],
    yaw: 1.3,
    stars: [420, 600],
    achievement: 'galacticassault',
    sides: { attack: STRIKE_TEAM, defend: ENDOR_EMPIRE },
    posts: [
      { id: 'village', name: 'Bright Tree Village', at: [-210, 150], r: 24, fixed: 'attack' },
      { id: 'scoutcamp', name: 'The scouts’ camp', at: [60, 250], r: 18 },
      { id: 'logtrap', name: 'The log trap', at: [140, 110], r: 18 },
      { id: 'bunker', name: 'The bunker', at: [250, -40], r: 22 },
      { id: 'generator', name: 'The shield generator', at: [400, -230], r: 24 },
      { id: 'platform', name: 'The landing platform', at: [390, -188], r: 14, fixed: 'defend' },
    ],
    phases: [
      { name: 'The forest', posts: ['scoutcamp', 'logtrap'], tickets: 100 },
      { name: 'The bunker', posts: ['bunker'], tickets: 80 },
      { name: 'The shield generator', posts: ['generator'], tickets: 70 },
    ],
    tickets: { attack: 110, defend: 175 },
    // (the staging line nearer than the rule's 100 m: the posts are far
    // apart here and the walk between is through the trees, so with the
    // rule's distance the first minute of the battle was all walking)
    forward: 80,
    hideLife: ['stormtrooper', 'scouttrooper', 'rebel'],
    ends: {
      won: 'The shield is down',
      lost: 'The forest is lost',
      why: { posts: 'The last post fell, and the generator with it.', tickets: 'Your side ran out of reinforcements.' },
    },
    lines: {
      start: {
        xwing: [['luke', 'The fleet’s counting on us. That shield has to come down.'], ['r2', '(A determined beep.)']],
        falcon: [['han', 'Stormtroopers, scouts, walkers, and us and a bunch of teddy bears. Pick a side.'], ['chewie', '(A roar, already moving.)']],
        cruiser: [['rick', 'Space marines versus bears with rocks, Morty. Bet on the bears.'], ['morty', 'Why, Rick?'], ['rick', 'Because they always win, Morty. It’s their planet.']],
        rv: [['walt', 'Through the forest, to the bunker, to the generator. One at a time.'], ['jesse', 'Yo, the little bear guys are coming with us? Sick.']],
      },
      won: {
        xwing: [['luke', 'The shield’s down. Now it’s up to the fleet.'], ['r2', '(A triumphant, tumbling trill.)']],
        falcon: [['han', 'Shield’s down! Lando, you’d better be where you said you’d be.'], ['chewie', '(A long, victorious howl.)']],
        cruiser: [['rick', 'Told you, Morty. The bears.']],
        rv: [['walt', 'Decisively.'], ['jesse', 'Yub nub, Mr. White! Yub nub!']],
      },
      lost: {
        xwing: [['luke', 'Fall back to the village. The fleet’s on its own.']],
        falcon: [['han', 'That’s it, we’re done here. Everybody out.']],
        cruiser: [['morty', 'We lost, Rick.'], ['rick', 'Even the bears have off days, Morty.']],
        rv: [['walt', 'We lost the forest. Regroup.']],
      },
    },
    barks: {
      attack: [['Rebel commando', 'Move up! Get to the bunker!'], ['Rebel commando', 'Scouts on the ridge, keep your heads down!'], ['Ewok', 'Yub nub! Yub nub!'], ['Rebel commando', 'The generator’s behind the bunker. Keep going!']],
      defend: [['Stormtrooper', 'Rebels in the trees! Hold the bunker!'], ['Scout trooper', 'They’re coming through the camp. Fall back to the walkers.'], ['Stormtrooper', 'The shield must stay up. Lord Vader’s orders.'], ['Stormtrooper', 'Watch the ferns. The natives are in them.']],
    },
  },

  kashyyyk: {
    id: 'assault',
    system: 'kashyyyk',
    kind: 'assault',
    name: 'The Battle of Kashyyyk',
    line: 'The droid army is wading out of the lagoon. The clones and the Wookiees hold the beach at Kachirho, or the city falls.',
    ride: null,
    start: KASHYYYK([10, 0]),
    yaw: 3.0 + FOREST.kashyyyk.turn.yaw,
    stars: [360, 540],
    achievement: 'galacticassault',
    sides: { attack: SEPARATISTS, defend: { ...REPUBLIC, name: 'The Republic and the Wookiees', short: 'Republic', kinds: [['clone', 2], ['wookiee', 1]] } },
    posts: [
      // (out in the shallows, as the droids come in the film: knee-deep, `wade`, and 50 m of beach between them and the barricades)
      { id: 'shallows', name: 'The droids’ landing', at: [60, 105], r: 14, fixed: 'attack', wade: true },
      { id: 'barricades', name: 'The barricades', at: [50, 52], r: 18 },
      { id: 'gunline', name: 'The gun line', at: [40, 12], r: 20 },
      { id: 'command', name: 'The command post', at: [-60, 10], r: 16 },
      { id: 'lift', name: 'Kachirho’s lift', at: [-112, -14], r: 14, fixed: 'defend' },
    ].map((p) => ({ ...p, at: KASHYYYK(p.at) })),
    phases: [
      { name: 'The beach', posts: ['barricades'], tickets: 90 },
      { name: 'The gun line', posts: ['gunline'], tickets: 70 },
      { name: 'The command post', posts: ['command'], tickets: 60 },
    ],
    tickets: { attack: 100, defend: 150 },
    // (the beach is only 80 m deep, so a short staging line: the droids' first wave forms up well out of the barricades' post)
    forward: 28,
    hideLife: ['clone', 'wookiee', 'atrt', 'atap'],
    ends: {
      won: 'Kachirho holds',
      lost: 'Kachirho falls',
      why: { posts: 'The last post fell, and the lift with it.', tickets: 'Your side ran out of reinforcements.' },
    },
    lines: {
      start: {
        xwing: [['luke', 'The droids come out of the water and the Wookiees stand on the sand. I know which side I’d rather be on.'], ['r2', '(A wary, rising whistle.)']],
        falcon: [['han', 'Chewie, it’s your planet. Tell me which side to shoot at.'], ['chewie', '(A long, proud roar at the barricades.)']],
        cruiser: [['rick', 'Clones and Wookiees on a beach, Morty, and a tin army coming out of the sea. Pick one, they’re both about to have a bad day.'], ['morty', 'W-which one’s the good one, Rick?']],
        rv: [['walt', 'Hold the beach, or take it. A line in the sand is a line in the sand.'], ['jesse', 'Yo, the Wookiees are huge, Mr. White.']],
      },
      won: {
        xwing: [['luke', 'Kachirho holds. Remember this, R2, while it lasts.'], ['r2', '(A relieved, tumbling trill.)']],
        falcon: [['han', 'We held the beach. Chewie’s got that look. Don’t say anything.'], ['chewie', '(A booming, victorious howl.)']],
        cruiser: [['rick', 'We won, Morty. Don’t get attached to the clones. Trust me on the clones.']],
        rv: [['walt', 'The beach is ours.'], ['jesse', 'Wookiee high-five! …Is that a thing?']],
      },
      lost: {
        xwing: [['luke', 'Fall back to the lift. Get the families out.']],
        falcon: [['han', 'That’s it. Up the tree, everybody, up the tree!']],
        cruiser: [['morty', 'We lost the beach, Rick!'], ['rick', 'Droids on a beach, Morty. Somebody always loses it.']],
        rv: [['walt', 'We’re done on the sand. Fall back.']],
      },
    },
    barks: {
      attack: [['Battle droid', 'Roger, roger.'], ['Super battle droid', 'Move, move, move.'], ['Battle droid', 'Wookiees! Uh…']],
      defend: [['Clone trooper', 'Hold the line!'], ['Clone trooper', 'Here they come!'], ['Wookiee', '(A roar along the barricades.)']],
    },
  },
  coruscant: {
    id: 'assault',
    system: 'coruscant',
    kind: 'assault',
    name: 'The Battle of the Temple',
    line: 'Droids on the landing platform and up the Processional Way, and the Temple’s doors held by the clones and the Jedi. The Republic’s own capital, fought for on its steps.',
    ride: null,
    start: [0, 60],
    yaw: Math.PI,
    stars: [360, 540],
    achievement: 'galacticassault',
    sides: sidesFor('clone'),
    posts: [
      { id: 'platform', name: 'The landing platform', at: [0, -6], r: 22, fixed: 'attack' },
      { id: 'processional', name: 'The Processional Way', at: [0, 150], r: 12 },
      { id: 'templedoor', name: 'The Temple’s doors', at: [0, 290], r: 22 },
      { id: 'temple', name: 'The Temple steps', at: [0, 400], r: 24, fixed: 'defend' },
    ],
    phases: [
      { name: 'The Processional Way', posts: ['processional'], tickets: 80 },
      { name: 'The Temple’s doors', posts: ['templedoor'], tickets: 70 },
    ],
    tickets: { attack: 90, defend: 120 },
    hideLife: ['clone', 'jedi', 'yoda', 'villager', 'senateguard'],
    ends: {
      won: 'The Temple holds',
      lost: 'The Temple is lost',
      why: { posts: 'The doors fell, and the Temple behind them.', tickets: 'Your side ran out of reinforcements.' },
    },
    lines: {
      start: {
        xwing: [['luke', 'Droids, on Coruscant. Ben never told me it got this far.'], ['r2', '(A grim, descending whistle.)']],
        falcon: [['han', 'A thousand steps and every one of them a firing line. Terrific.'], ['chewie', '(A battle roar.)']],
        cruiser: [['rick', 'It’s a staircase, Morty. The whole battle is a staircase.'], ['morty', 'Th-they’re coming up it, Rick!']],
        rv: [['walt', 'High ground, Jesse. Take it and hold it.'], ['jesse', 'It’s a lot of stairs, Mr. White!']],
      },
      won: {
        xwing: [['luke', 'The doors held.'], ['r2', '(A triumphant trill.)']],
        falcon: [['han', 'Temple’s still standing. Don’t thank me.']],
        cruiser: [['rick', 'Steps are ours, Morty. Nobody’s ever been so proud of stairs.']],
        rv: [['walt', 'We held the high ground.'], ['jesse', 'Yeah, science!']],
      },
      lost: {
        xwing: [['luke', 'They’re in. Fall back through the doors.']],
        falcon: [['han', 'That’s it. Everybody out.']],
        cruiser: [['morty', 'We lost the Temple, Rick.'], ['rick', 'It was always going to burn, Morty.']],
        rv: [['walt', 'We lost the steps. Not the war.']],
      },
    },
    barks: {
      attack: [['Battle droid', 'Roger roger. Up the steps.'], ['Battle droid', 'Clones on the Processional, sir.'], ['Super battle droid', 'Take the doors.']],
      defend: [['Clone trooper', 'Hold the doors! Nothing gets past the steps!'], ['Clone trooper', 'Droids on the platform, lots of them!'], ['Clone trooper', 'Where are the Jedi?']],
    },
  },
  yavin: {
    id: 'assault',
    system: 'yavin',
    kind: 'assault',
    name: 'The Battle of Yavin 4',
    line: 'The Empire comes in across the field for the hangar and the temple, and the Rebellion holds the steps as long as it can. The base, fought for on the ground.',
    ride: null,
    start: [0, -150],
    yaw: Math.PI,
    stars: [360, 540],
    achievement: 'galacticassault',
    sides: sidesFor('gcw'),
    posts: [
      { id: 'field', name: 'The landing field', at: [0, -112], r: 26, fixed: 'attack' },
      { id: 'hangar', name: 'The hangar mouth', at: [0, -196], r: 20 },
      { id: 'summit', name: 'The temple steps', at: [0, -240], r: 24 },
      { id: 'throne', name: 'The throne room', at: [0, -251], r: 10, fixed: 'defend' },
    ],
    phases: [
      { name: 'The hangar', posts: ['hangar'], tickets: 80 },
      { name: 'The temple steps', posts: ['summit'], tickets: 70 },
    ],
    tickets: { attack: 90, defend: 120 },
    hideLife: ['rebel', 'rebeltech', 'rebelpilot'],
    ends: {
      won: 'The temple holds',
      lost: 'The temple is lost',
      why: { posts: 'The steps fell, and the base behind them.', tickets: 'Your side ran out of reinforcements.' },
    },
    lines: {
      start: {
        xwing: [['luke', 'They found the base. Everyone to the hangar!'], ['r2', '(An alarmed whistle.)']],
        falcon: [['han', 'Stormtroopers in the jungle. I told them to move the base.'], ['chewie', '(A battle roar.)']],
        cruiser: [['rick', 'Pick a side, Morty. The pyramid’s gonna lose either way.'], ['morty', 'Rick, that’s not—']],
        rv: [['walt', 'Hold the hangar, Jesse.'], ['jesse', 'With what, Mr. White?!']],
      },
      won: {
        xwing: [['luke', 'We held the temple.'], ['r2', '(A tumbling trill.)']],
        falcon: [['han', 'Would you look at that. The kid’s base is still standing.']],
        cruiser: [['rick', 'Pyramid’s ours, Morty.']],
        rv: [['walt', 'We held.'], ['jesse', 'Yeah!']],
      },
      lost: {
        xwing: [['luke', 'Fall back to the transports. Go!']],
        falcon: [['han', 'That’s it. Everybody out.']],
        cruiser: [['morty', 'We lost, Rick.'], ['rick', 'Everybody loses a moon, Morty.']],
        rv: [['walt', 'We lost the base. Not the war.']],
      },
    },
    barks: {
      attack: [['Stormtrooper', 'Forward! The hangar’s in range!'], ['Stormtrooper', 'Rebels on the steps, sir.'], ['Stormtrooper', 'Take the temple.']],
      defend: [['Rebel trooper', 'Here they come! Hold the hangar!'], ['Rebel trooper', 'Don’t let them up the steps!'], ['Rebel trooper', 'Where are the fighters?']],
    },
  },
  bespin: {
    id: 'assault',
    system: 'bespin',
    kind: 'assault',
    name: 'The Battle of Cloud City',
    line: 'The Rebellion comes in over Platform 327 to take the city back, and the Empire holds the walkway, the plaza and the tower. Cloud City, fought for on its decks.',
    ride: null,
    start: [0, -200],
    yaw: 0,
    stars: [360, 540],
    achievement: 'galacticassault',
    sides: sidesFor('gcw', { attack: 'light' }),
    posts: [
      { id: 'platform327', name: 'Platform 327', at: [0, -236], r: 24, fixed: 'attack' },
      { id: 'walkway', name: 'The south walkway', at: [0, -150], r: 16 },
      { id: 'plaza', name: 'The plaza', at: [0, 20], r: 26 },
      { id: 'tower', name: 'The tower’s foot', at: [0, 120], r: 22, fixed: 'defend' },
    ],
    phases: [
      { name: 'The south walkway', posts: ['walkway'], tickets: 80 },
      { name: 'The plaza', posts: ['plaza'], tickets: 70 },
    ],
    tickets: { attack: 90, defend: 120 },
    hideLife: ['stormtrooper', 'wingguard', 'ugnaught', 'villager'],
    ends: {
      won: 'The city is ours',
      lost: 'The city is lost',
      why: { posts: 'The plaza fell, and the city with it.', tickets: 'Your side ran out of reinforcements.' },
    },
    lines: {
      start: {
        xwing: [['luke', 'Lando’s people are with us. Take the plaza.'], ['r2', '(A determined whistle.)']],
        falcon: [['han', 'Taking Lando’s city back for him. He’d better be grateful.'], ['chewie', '(A battle roar.)']],
        cruiser: [['rick', 'It’s a city on a stick, Morty. Don’t fall off.'], ['morty', 'Rick, there are no railings!']],
        rv: [['walt', 'Mind the edge, Jesse.'], ['jesse', 'There’s nothing under us, Mr. White!']],
      },
      won: {
        xwing: [['luke', 'The city’s free.'], ['r2', '(A triumphant trill.)']],
        falcon: [['han', 'Lando owes me. Again.']],
        cruiser: [['rick', 'City’s ours, Morty. Still on a stick.']],
        rv: [['walt', 'We took it.'], ['jesse', 'Yeah, science!']],
      },
      lost: {
        xwing: [['luke', 'Fall back to the platform. Go!']],
        falcon: [['han', 'That’s it. Back to the Falcon.']],
        cruiser: [['morty', 'We lost, Rick.'], ['rick', 'Clouds, Morty. Nobody holds clouds.']],
        rv: [['walt', 'We lost the city. Not the war.']],
      },
    },
    barks: {
      attack: [['Rebel trooper', 'Forward! Take the walkway!'], ['Rebel trooper', 'Troopers on the plaza, sir.'], ['Rebel trooper', 'For Lando!']],
      defend: [['Stormtrooper', 'Hold the walkway! Nothing reaches the plaza!'], ['Stormtrooper', 'Rebels on 327, lots of them!'], ['Stormtrooper', 'Lord Vader will hear of this.']],
    },
  },
};
