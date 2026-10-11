// Things to do on the worlds whose own site file has none yet: who gives
// each (life, placed in the world) and the quests (quests.js's). siteOf
// adds them to the world's own.

const H = (range, every, damage, extra = {}) => ({ range, every, damage, spread: 0.06, ...extra });

// Kashyyyk's waves wade out of the shallows (they're knee-deep, and droids
// hold at the lagoon's deep water), and the beach's defenders behind the
// barricades are the same in every wave. (A wave's whole spread stays out in
// the shallows, z 84 and beyond: nobody starts on the sand in front of the line.)
const LAGOON = { leash: 90, roam: 8, tag: 'lagoondroids', wade: true };
const DEFENDERS = [
  { kind: 'clone', n: 2, at: [30, 56], spread: 10, roam: 4, hp: 4, side: 'yours', tag: 'defenders', hostile: H(45, 1.6, 6) },
  { kind: 'wookiee', n: 2, at: [70, 56], spread: 10, roam: 5, hp: 5, side: 'yours', tag: 'defenders', hostile: H(30, 1.4, 8) },
];

export const EXTRA = {
  scarif: {
    life: [],
    quests: [
      // the walkers on the beach, Sefla's way: charges from the landing, under the cargo walker's foot
      { id: 'walkers', name: 'Walkers on the beach', giver: 'sefla', intro: [['Lieutenant Sefla', 'Two cargo walkers are coming down the beach. Get the charges from the landing and get under one.']], steps: [{ type: 'collect', item: 'charge', n: 3, spots: [[-312, 192], [-328, 206], [-306, 212]], text: 'Collect the charges at the rebel landing' }, { type: 'reach', at: [-290, -180], r: 34, text: 'Get down to the beach' }, { type: 'shoot', tag: 'beachtroops', n: 6, text: 'Hold the beach while the charges go in', time: 150, spawn: [{ kind: 'shoretrooper', n: 5, at: [-250, -200], spread: 16, roam: 6, hp: 2, tag: 'beachtroops', hostile: H(42, 2.0, 8) }, { kind: 'deathtrooper', n: 1, at: [-240, -190], roam: 5, hp: 4, tag: 'beachtroops', hostile: H(46, 1.4, 11, { burst: { n: 3, gap: 0.1 } }) }] }, { type: 'use', id: 'walkercharge', at: [-262, -164], r: 5, prompt: 'Set the charges under the walker', text: 'Set the charges under the walker’s foot', end: [{ shake: 1.4 }, { sound: 'crash' }, { say: [[null, '(The walker’s foot goes, and the rest of it comes down on the sand like a dropped building.)']] }] }], done: [['Lieutenant Sefla', 'One down. Keep their heads turned, Rogue One’s nearly there.']] },
      // Bodhi's call: the shuttle's comm patched through to the fleet, with the pad's garrison on top of you
      { id: 'rogueone', name: 'Rogue One, calling', giver: 'bodhi', intro: [['Bodhi Rook', 'The shield gate’s shut. The fleet has to know, and the only transmitter is in that shuttle. Get me to it and keep them off me.']], steps: [{ type: 'reach', at: [-110, 90], r: 22, text: 'Get Bodhi to the shuttle on Pad Nine' }, { type: 'shoot', tag: 'padtroops', n: 6, text: 'Keep the shoretroopers off the pad', time: 120, spawn: { kind: 'shoretrooper', n: 6, at: [-88, 110], spread: 14, roam: 6, hp: 2, tag: 'padtroops', hostile: H(42, 2.0, 8) } }, { type: 'use', id: 'patch', at: [-110, 92], r: 6, prompt: 'Patch the comm through', text: 'Patch the shuttle’s comm through to the fleet' }], done: [['Bodhi Rook', 'This is Rogue One. The shield gate is closed. You have to hit the gate! Do you copy?'], ['Admiral Raddus', 'We copy, Rogue One. Hammerhead corvettes, on my mark.']] },
    ],
  },
  endor: {
    life: [
      { kind: 'rebel', id: 'scout', at: [70, 240], still: true, face: 3, name: 'A Rebel scout', quest: ['bikechase', 'scoutcamp'], says: ['They saw us. If they get word back to the base…'] },
      { kind: 'rebel', id: 'strike', at: [222, -12], still: true, face: 2, name: 'General Solo’s strike team', quest: 'bunker', says: ['The shield’s still up. Get those charges in.'] },
    ],
    quests: [
      { id: 'bikechase', name: 'Speeder-bike chase', giver: 'scout', intro: [['A Rebel scout', 'Two scouts got away on bikes. Catch them before they reach the bunker!']], steps: [{ type: 'ride', kind: 'speederbike', text: 'Get on a speeder bike' }, { type: 'race', ride: 'speederbike', gates: [[90, 220], [140, 170], [190, 95], [230, 25], [250, -20]], r: 10, time: 40, text: 'Through the trees to the bunker' }], done: [[null, '(You pull up at the bunker, the trees still whipping past in your head.)']] },
      { id: 'bunker', name: 'The shield bunker', giver: 'strike', intro: [['Rebel commando', 'Clear the troopers off the door and set the charges.']], steps: [{ type: 'shoot', tag: 'bunkertroops', n: 6, text: 'Clear the stormtroopers from the bunker', spawn: { kind: 'stormtrooper', n: 6, at: [250, -40], spread: 10, roam: 4, hp: 2, tag: 'bunkertroops', hostile: H(40, 2.2, 8) } }, { type: 'use', id: 'charges', at: [250, -40], r: 4, prompt: 'Set the charges', text: 'Set the charges on the bunker door', end: [{ shake: 1 }, { sound: 'crash' }] }], done: [['Rebel commando', 'The shield is down! Now it’s up to the fleet.']] },
      // the scouts' camp, quietly: the scouts off their bikes before one gets to a comm, and their comm jammed
      { id: 'scoutcamp', name: 'Quiet in the ferns', giver: 'scout', intro: [['A Rebel scout', 'There’s a scout camp on the ridge. Take it quietly, and jam their comm before they call the bunker.']], steps: [{ type: 'reach', at: [60, 250], r: 24, text: 'Creep up on the scouts’ camp' }, { type: 'shoot', tag: 'campscouts', n: 4, text: 'Take the scouts off their bikes', time: 90, spawn: { kind: 'scouttrooper', n: 4, at: [62, 252], spread: 9, roam: 5, hp: 2, tag: 'campscouts', hostile: H(38, 1.6, 7, { burst: { n: 2, gap: 0.14 } }) } }, { type: 'use', id: 'jam', at: [60, 250], r: 5, prompt: 'Jam the scouts’ comm', text: 'Jam their comm', end: [{ say: [[null, '(The comm whines, and dies. Nobody at the bunker heard a thing.)']] }] }], done: [['A Rebel scout', 'Nice work. The strike team can move on the bunker now.']] },
      // the walker at the generator, the Ewok way: Paploo's stones to draw it, then the logs
      { id: 'ewokwar', name: 'The Ewoks’ war', giver: 'paploo', intro: [['Paploo', '(He points at the walker by the generator, then at the two logs hung in the trees, and grins.)']], steps: [{ type: 'collect', item: 'stone', n: 3, spots: [[150, 96], [132, 122], [158, 118]], text: 'Gather stones for the slings' }, { type: 'reach', at: [396, -210], r: 30, text: 'Get to the walker by the generator' }, { type: 'shoot', tag: 'genguard', n: 5, text: 'Draw the walker’s troopers off', spawn: { kind: 'stormtrooper', n: 5, at: [398, -214], spread: 12, roam: 5, hp: 2, tag: 'genguard', hostile: H(42, 2.0, 8) } }, { type: 'reach', at: [140, 110], r: 20, text: 'Lead the walker back to the log trap', time: 150 }, { type: 'use', id: 'cutvine', at: [140, 110], r: 6, prompt: 'Cut the vine', text: 'Cut the vine and let the logs swing', end: [{ shake: 1.2 }, { sound: 'crash' }, { say: [[null, '(Two logs swing out of the trees and meet, and the walker between them stops being a walker.)']] }] }], done: [['Paploo', 'Yub nub! Ee chee wa maa!'], [null, '(The Ewoks are already up on its head, drumming.)']] },
      // the shuttle Tydirium's codes, off the Imperial landing platform
      { id: 'tydirium', name: 'An older code', giver: 'tydirium', intro: [['The shuttle’s pilot', 'The Tydirium’s clearance code is in the platform’s controller. Get me a fresh one, or the fleet never gets another ship down here.']], steps: [{ type: 'reach', at: [390, -188], r: 24, text: 'Get to the Imperial landing platform' }, { type: 'shoot', tag: 'padguard', n: 5, text: 'Clear the platform’s guard', spawn: [{ kind: 'stormtrooper', n: 3, at: [388, -190], spread: 10, roam: 4, hp: 2, tag: 'padguard', hostile: H(40, 2.2, 8) }, { kind: 'scouttrooper', n: 2, at: [394, -184], spread: 8, roam: 5, hp: 2, tag: 'padguard', hostile: H(38, 1.6, 7) }] }, { type: 'use', id: 'codes', at: [390, -188], r: 6, prompt: 'Pull the clearance codes', text: 'Pull the clearance codes from the platform’s controller' }, { type: 'talk', actor: 'tydirium', text: 'Take the codes back to the shuttle’s pilot' }], done: [['The shuttle’s pilot', 'It’s an older code, sir. But it checks out.']] },
    ],
  },
  kashyyyk: {
    life: [
      { kind: 'clone', id: 'gree', at: [30, 28], still: true, face: 0.2, name: 'Commander Gree', named: true, quest: 'beachhead', says: ['The droids are massing at the lagoon.'] },
      { kind: 'wookiee', id: 'tarfful', at: [-112, -12], still: true, face: -0.6, name: 'Tarfful', named: true, quest: 'escapepod', says: ['(A long, rumbling roar.)'] },
    ],
    quests: [
      // The Battle of Kashyyyk, as the film has it: the droids wade out of the
      // shallows in three waves (battle droids, then super battle droids, then
      // droidekas), clones and Wookiees dug in behind the barricades with you.
      // Your side carries a tag of its own: the step counts the droids' kills.
      {
        id: 'beachhead',
        name: 'The Battle of Kashyyyk',
        giver: 'gree',
        intro: [['Commander Gree', 'Separatist droids, coming across the lagoon. Hold the beach.']],
        steps: [
          { type: 'shoot', tag: 'lagoondroids', n: 6, at: [50, 62], text: 'The first wave: hold the barricades', spawn: [
            { ...LAGOON, kind: 'battledroid', n: 6, at: [50, 100], spread: 16, hp: 1, hostile: { ...H(45, 2.4, 7), chase: 1.2 } },
            ...DEFENDERS,
          ] },
          { type: 'shoot', tag: 'lagoondroids', n: 6, at: [50, 62], text: 'The second wave: the super battle droids', spawn: [
            { ...LAGOON, kind: 'battledroid', n: 4, at: [30, 100], spread: 14, hp: 1, hostile: { ...H(45, 2.4, 7), chase: 1.2 } },
            { ...LAGOON, kind: 'superdroid', n: 2, at: [80, 100], spread: 14, hp: 3, hostile: { ...H(40, 1.6, 8), chase: 0.9, burst: { n: 3, gap: 0.15 } } },
            ...DEFENDERS,
          ] },
          { type: 'shoot', tag: 'lagoondroids', n: 6, at: [50, 62], text: 'The last wave: droidekas', spawn: [
            { ...LAGOON, kind: 'droideka', n: 2, at: [50, 104], spread: 12, hp: 2, hostile: { ...H(40, 1.8, 7), shield: 3, burst: { n: 2, gap: 0.12 }, chase: 1.6 } },
            { ...LAGOON, kind: 'battledroid', n: 4, at: [90, 100], spread: 14, hp: 1, hostile: { ...H(45, 2.4, 7), chase: 1.2 } },
            ...DEFENDERS,
          ] },
        ],
        done: [['Commander Gree', 'Beach is ours. Good work.']],
      },
      { id: 'escapepod', name: 'A way off-world', giver: 'tarfful', intro: [['Tarfful', '(He points south, to the hidden escape pod, and growls: it needs parts.)']], steps: [{ type: 'collect', item: 'podpart', n: 3, spots: [[-110, -360], [-136, -372], [-104, -392]], text: 'Find the escape pod’s parts' }, { type: 'use', id: 'fix', at: [-120, -380], r: 4, prompt: 'Fit the parts', text: 'Fix the escape pod' }], done: [[null, '(The pod hums into life. Somewhere, a Jedi Master is going to need it.)']] },
    ],
  },
  dagobah: {
    life: [{ kind: 'yoda', id: 'master', at: [-80, 54], still: true, face: 2.4, name: 'Yoda', named: true, quest: ['lift', 'cave'], says: ['Do. Or do not. There is no try.', 'Size matters not. Judge me by my size, do you?', 'Mudhole? Slimy? My home this is!', 'Away put your weapon. I mean you no harm.', 'Wars not make one great.', 'Luminous beings are we, not this crude matter.'] }],
    quests: [
      { id: 'lift', name: 'Size matters not', giver: 'master', intro: [['Yoda', 'Your ship, in the swamp it is. Raise it, you will.']], steps: [{ type: 'reach', at: [40, 74], r: 12, text: 'Go to the sunken X-wing' }, { type: 'use', id: 'lift', at: [40, 74], r: 10, prompt: 'Reach out with the Force', text: 'Raise the X-wing', end: [{ signal: 'raise' }, { shake: 0.8 }, { say: [[null, '(The swamp boils. The X-wing rises out of it, dripping, and hangs there over the water.)']] }] }, { type: 'reach', at: [-80, 54], r: 6, text: 'Go back to Yoda' }], done: [['Yoda', 'Judge me by my size, do you? Hmm?']] },
      { id: 'cave', name: 'The cave', giver: 'master', steps: [{ type: 'reach', at: [-70, -120], r: 10, text: 'Go into the cave' }, { type: 'shoot', tag: 'vision', n: 1, text: 'Face what’s inside', lines: [[null, '(A figure in black steps out of the dark.)']], spawn: { kind: 'vader', at: [-66, -114], hp: 4, leash: 14, roam: 2, tag: 'vision', hostile: { range: 14, chase: 1.8, melee: true, reach: 2.6, every: 1.6, damage: 14, delay: 1, parry: 0.75, guard: 3, blade: { color: '#ff3b3b' } } } }], done: [['Yoda', 'Your weapons… you will not need them.']] },
    ],
  },
  naboo: {
    life: [
      { kind: 'gungan', id: 'tarpals', at: [250, -230], still: true, face: 2.5, name: 'Captain Tarpals', named: true, quest: 'grassfield', says: ['Wesa ready to do our-n part.'] },
      { kind: 'villager', id: 'herder', at: [30, -2], still: true, face: 2, name: 'A kaadu herder', quest: 'kaadurace', says: ['Kaadu run faster than they look.'] },
      { kind: 'rebelpilot', id: 'ric', at: [-284, 168], still: true, face: -2.2, name: 'Ric Olié', named: true, quest: 'fates', says: ['Bravo Flight’s ready when the hangar is.'] },
    ],
    quests: [
      { id: 'grassfield', name: 'The Great Grass Plains', giver: 'tarpals', intro: [['Captain Tarpals', 'Da droids are coming! Hold da line!']], steps: [{ type: 'shoot', tag: 'droidarmy', at: [400, -380], n: 12, text: 'Hold the line against the droid army', spawn: [{ kind: 'battledroid', n: 10, at: [400, -380], spread: 25, roam: 10, hp: 1, tag: 'droidarmy', hostile: H(45, 2.6, 7) }, { kind: 'droideka', n: 2, at: [400, -380], spread: 12, roam: 5, hp: 2, tag: 'droidarmy', hostile: { ...H(40, 1.8, 7), shield: 3, burst: { n: 2, gap: 0.12 } } }] }], done: [['Captain Tarpals', 'Wesa free! Mesa tinks yousa savin’ da whole planet.']] },
      // the hangar doors open on a Sith with a staff: a duellist who blocks, parries and ripostes (duellists.js)
      { id: 'fates', name: 'The hangar doors', giver: 'ric', intro: [['Ric Olié', 'There’s someone at the far end of the hangar. Hooded, in black. He’s between us and the fighters.']], steps: [{ type: 'reach', at: [-300, 180], r: 30, text: 'Get to the Theed hangar' }, { type: 'shoot', tag: 'maul', n: 1, text: 'Face the Sith in the hangar', lines: [[null, '(He lowers his hood. A red blade lights at each end of the hilt.)']], spawn: { kind: 'maul', at: [-310, 192], hp: 8, leash: 30, roam: 3, tag: 'maul', hostile: { range: 16, chase: 2.4, melee: true, reach: 2.8, every: 1.4, damage: 16, delay: 1, parry: 0.7, riposte: 0.4, guard: 4, blade: { color: '#ff2a2a', stance: 'double' }, force: { every: 8, push: 8 } } } }], done: [['Ric Olié', 'The hangar’s ours. Bravo Flight, go!']] },
      { id: 'kaadurace', name: 'Kaadu run', giver: 'herder', steps: [{ type: 'ride', kind: 'kaadu', text: 'Get on a kaadu' }, { type: 'race', ride: 'kaadu', gates: [[60, 60], [70, 120], [-40, 200], [-130, 290]], r: 12, time: 60, text: 'Race to the falls' }], done: [[null, '(The kaadu honks, very pleased with itself.)']] },
    ],
  },
  kamino: {
    life: [{ kind: 'kaminoan', id: 'taunwe', at: [10, 140], still: true, face: 3, name: 'Taun We', named: true, quest: 'jango', says: ['The Prime Minister expects you.', 'Master Jedi. So good to see you. The Prime Minister expects you.', 'I trust you will find everything you need. The clones are most impressive.', 'They are totally obedient, taking any order without question.'] }],
    quests: [
      { id: 'jango', name: 'The bounty hunter', giver: 'taunwe', intro: [['Taun We', 'Jango Fett is preparing to leave. His ship is on the far platform.']], steps: [{ type: 'reach', at: [-170, -50], r: 20, text: 'Get to Slave I’s landing platform' }, { type: 'shoot', tag: 'jango', n: 1, text: 'Bring down Jango Fett', spawn: { kind: 'jango', at: [-170, -40], hp: 6, roam: 4, tag: 'jango', hostile: H(30, 1.2, 10) } }], done: [[null, '(Slave I lifts off without him for once. Well: almost.)']] },
    ],
  },
  geonosis: {
    life: [{ kind: 'mace', id: 'mace', at: [-197, 151], still: true, face: -2, name: 'Mace Windu', named: true, quest: ['arena', 'foundry', 'dooku'], says: ['This party’s over.'] }],
    quests: [
      { id: 'arena', name: 'The Petranaki arena', giver: 'mace', intro: [['Mace Windu', 'They’ve let the beasts out. Take the acklay.']], steps: [{ type: 'reach', at: [-260, 200], r: 30, text: 'Into the arena' }, { type: 'shoot', tag: 'acklay', n: 1, text: 'Bring down the acklay', spawn: { kind: 'acklay', at: [-260, 210], hp: 14, leash: 40, tag: 'acklay', hostile: { range: 40, chase: 3, melee: true, reach: 3.4, every: 1.4, damage: 25, delay: 1 } } }], done: [['Mace Windu', 'Not bad. Now the droids.']] },
      { id: 'foundry', name: 'The droid foundry', giver: 'mace', steps: [{ type: 'collect', item: 'part', n: 3, spots: [[19, -324], [31, -334], [13, -312]], text: 'Find Threepio’s pieces in the foundry' }], done: [['C-3PO', 'Oh, thank the Maker. Though I do believe my head is on backwards.']] },
      // Dooku's hangar: through his droideka guard to the Count himself, a duellist with a red blade who parries and breaks off
      { id: 'dooku', name: 'Count Dooku', giver: 'mace', intro: [['Mace Windu', 'Dooku’s making for his hangar. Stop him before that sail ship leaves.']], steps: [{ type: 'reach', at: [300, -300], r: 34, text: 'Get to Dooku’s hangar', time: 240 }, { type: 'shoot', tag: 'dookuguard', n: 2, text: 'Get past the droidekas at the hangar mouth', spawn: { kind: 'droideka', n: 2, at: [296, -288], spread: 10, roam: 4, hp: 2, tag: 'dookuguard', hostile: { ...H(40, 1.8, 7), shield: 3, burst: { n: 2, gap: 0.12 } } } }, { type: 'shoot', tag: 'dooku', n: 1, text: 'Face Count Dooku', lines: [['Count Dooku', 'Master Windu. You disappoint me.']], spawn: { kind: 'dooku', at: [306, -300], hp: 8, leash: 30, roam: 3, tag: 'dooku', hostile: { range: 16, chase: 2.2, melee: true, reach: 2.6, every: 1.5, damage: 16, delay: 1, parry: 0.7, guard: 3, blade: { color: '#ff3b3b' } } } }], done: [['Count Dooku', 'This is just the beginning.'], ['Mace Windu', 'He’s away. But the army’s broken, and the Republic has an army of its own now.']] },
      // Yoda's: the core ships marked for the AT-TEs' guns, through the droids falling back to them
      { id: 'coreships', name: 'The nearest starship', giver: 'yoda', intro: [['Yoda', 'Concentrate all fire on the nearest starship, we must. A beacon on it, you will put.']], steps: [{ type: 'reach', at: [440, -110], r: 40, text: 'Get out to the core ships' }, { type: 'shoot', tag: 'coreguard', n: 8, text: 'Clear the droids falling back to the ships', spawn: [{ kind: 'battledroid', n: 6, at: [440, -120], spread: 22, roam: 8, hp: 1, tag: 'coreguard', hostile: H(45, 2.4, 7) }, { kind: 'superdroid', n: 2, at: [430, -100], spread: 12, roam: 6, hp: 3, tag: 'coreguard', hostile: H(40, 1.6, 10) }] }, { type: 'use', id: 'beacon', at: [470, -120], r: 6, prompt: 'Set the targeting beacon', text: 'Set the beacon under the nearest starship', end: [{ shake: 0.8 }, { sound: 'crash' }, { say: [[null, '(The AT-TEs’ cannons find the range. The sphere lifts, shuddering, and runs for the sky.)']] }] }], done: [['Yoda', 'Begun, the Clone War has.']] },
    ],
  },
};
