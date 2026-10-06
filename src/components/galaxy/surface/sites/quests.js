// Things to do on the worlds whose own site file has none yet: who gives
// each (life, placed in the world) and the quests (quests.js's). siteOf
// adds them to the world's own.

const H = (range, every, damage, extra = {}) => ({ range, every, damage, spread: 0.06, ...extra });

export const EXTRA = {
  endor: {
    life: [
      { kind: 'rebel', id: 'scout', at: [70, 240], still: true, face: 3, name: 'A Rebel scout', quest: 'bikechase', says: ['They saw us. If they get word back to the base…'] },
      { kind: 'rebel', id: 'strike', at: [222, -12], still: true, face: 2, name: 'General Solo’s strike team', quest: 'bunker', says: ['The shield’s still up. Get those charges in.'] },
    ],
    quests: [
      { id: 'bikechase', name: 'Speeder-bike chase', giver: 'scout', intro: [['A Rebel scout', 'Two scouts got away on bikes. Catch them before they reach the bunker!']], steps: [{ type: 'ride', kind: 'speederbike', text: 'Get on a speeder bike' }, { type: 'race', ride: 'speederbike', gates: [[90, 220], [140, 170], [190, 95], [230, 25], [250, -20]], r: 10, time: 40, text: 'Through the trees to the bunker' }], done: [[null, '(You pull up at the bunker, the trees still whipping past in your head.)']] },
      { id: 'bunker', name: 'The shield bunker', giver: 'strike', intro: [['Rebel commando', 'Clear the troopers off the door and set the charges.']], steps: [{ type: 'shoot', tag: 'bunkertroops', n: 6, text: 'Clear the stormtroopers from the bunker', spawn: { kind: 'stormtrooper', n: 6, at: [250, -40], spread: 10, roam: 4, hp: 2, tag: 'bunkertroops', hostile: H(40, 2.2, 8) } }, { type: 'use', id: 'charges', at: [250, -40], r: 4, prompt: 'Set the charges', text: 'Set the charges on the bunker door', end: [{ shake: 1 }, { sound: 'crash' }] }], done: [['Rebel commando', 'The shield is down! Now it’s up to the fleet.']] },
    ],
  },
  kashyyyk: {
    life: [
      { kind: 'clone', id: 'gree', at: [48, 30], still: true, face: 1, name: 'Commander Gree', named: true, quest: 'beachhead', says: ['The droids are massing at the lagoon.'] },
      { kind: 'wookiee', id: 'tarfful', at: [-130, -24], still: true, face: 2, name: 'Tarfful', named: true, quest: 'escapepod', says: ['(A long, rumbling roar.)'] },
    ],
    quests: [
      { id: 'beachhead', name: 'The Battle of Kashyyyk', giver: 'gree', intro: [['Commander Gree', 'Separatist droids, coming across the lagoon. Hold the beach.']], steps: [{ type: 'shoot', tag: 'lagoondroids', n: 8, text: 'Hold the beach against the droids', spawn: { kind: 'battledroid', n: 8, at: [150, 40], spread: 18, roam: 6, hp: 1, tag: 'lagoondroids', hostile: H(45, 2.4, 7) } }], done: [['Commander Gree', 'Beach is ours. Good work.']] },
      { id: 'escapepod', name: 'A way off-world', giver: 'tarfful', intro: [['Tarfful', '(He points south, to the hidden escape pod, and growls: it needs parts.)']], steps: [{ type: 'collect', item: 'podpart', n: 3, spots: [[-110, -360], [-136, -372], [-104, -392]], text: 'Find the escape pod’s parts' }, { type: 'use', id: 'fix', at: [-120, -380], r: 4, prompt: 'Fit the parts', text: 'Fix the escape pod' }], done: [[null, '(The pod hums into life. Somewhere, a Jedi Master is going to need it.)']] },
    ],
  },
  dagobah: {
    life: [{ kind: 'yoda', id: 'master', at: [-80, 54], still: true, face: 2.4, name: 'Yoda', named: true, quest: ['lift', 'cave'], says: ['Do. Or do not. There is no try.'] }],
    quests: [
      { id: 'lift', name: 'Size matters not', giver: 'master', intro: [['Yoda', 'Your ship, in the swamp it is. Raise it, you will.']], steps: [{ type: 'reach', at: [40, 74], r: 12, text: 'Go to the sunken X-wing' }, { type: 'use', id: 'lift', at: [40, 74], r: 10, prompt: 'Reach out with the Force', text: 'Raise the X-wing', end: [{ signal: 'raise' }, { shake: 0.8 }, { say: [[null, '(The swamp boils. The X-wing rises out of it, dripping, and hangs there over the water.)']] }] }, { type: 'reach', at: [-80, 54], r: 6, text: 'Go back to Yoda' }], done: [['Yoda', 'Judge me by my size, do you? Hmm?']] },
      { id: 'cave', name: 'The cave', giver: 'master', steps: [{ type: 'reach', at: [-70, -120], r: 10, text: 'Go into the cave' }, { type: 'shoot', tag: 'vision', n: 1, text: 'Face what’s inside', lines: [[null, '(A figure in black steps out of the dark.)']], spawn: { kind: 'vader', at: [-66, -114], still: true, hp: 3, tag: 'vision', hostile: H(12, 2, 10) } }], done: [['Yoda', 'Your weapons… you will not need them.']] },
    ],
  },
  yavin: {
    life: [{ kind: 'rebel', id: 'dodonna', at: [10, -100], still: true, face: 3, name: 'General Dodonna', named: true, quest: 'remotes', says: ['The battle station will be in range in thirty minutes.'] }],
    quests: [
      { id: 'remotes', name: 'Blast shield down', giver: 'dodonna', intro: [['General Dodonna', 'Pilots warm up on the remotes by the lookout. Your turn.']], steps: [{ type: 'shoot', tag: 'remote', n: 6, text: 'Hit the training remotes', spawn: { kind: 'remote', n: 6, at: [-200, -120], spread: 8, roam: 6, speed: 2, hp: 1, tag: 'remote' } }, { type: 'reach', at: [0, -256], r: 5, text: 'Climb to the throne room for the ceremony' }], done: [[null, '(The doors open. The whole Rebellion is standing there, and they’re cheering for you.)']] },
    ],
  },
  naboo: {
    life: [
      { kind: 'gungan', id: 'tarpals', at: [250, -230], still: true, face: 2.5, name: 'Captain Tarpals', named: true, quest: 'grassfield', says: ['Wesa ready to do our-n part.'] },
      { kind: 'villager', id: 'herder', at: [30, -2], still: true, face: 2, name: 'A kaadu herder', quest: 'kaadurace', says: ['Kaadu run faster than they look.'] },
    ],
    quests: [
      { id: 'grassfield', name: 'The Great Grass Plains', giver: 'tarpals', intro: [['Captain Tarpals', 'Da droids are coming! Hold da line!']], steps: [{ type: 'shoot', tag: 'droidarmy', n: 10, text: 'Hold the line against the droid army', spawn: { kind: 'battledroid', n: 10, at: [400, -380], spread: 25, roam: 10, hp: 1, tag: 'droidarmy', hostile: H(45, 2.6, 7) } }], done: [['Captain Tarpals', 'Wesa free! Mesa tinks yousa savin’ da whole planet.']] },
      { id: 'kaadurace', name: 'Kaadu run', giver: 'herder', steps: [{ type: 'ride', kind: 'kaadu', text: 'Get on a kaadu' }, { type: 'race', ride: 'kaadu', gates: [[60, 60], [70, 120], [-40, 200], [-130, 290]], r: 12, time: 60, text: 'Race to the falls' }], done: [[null, '(The kaadu honks, very pleased with itself.)']] },
    ],
  },
  coruscant: {
    life: [
      { kind: 'jedi', id: 'master', at: [10, 160], still: true, face: 3, name: 'A Jedi Master', quest: 'training', says: ['Stretch out with your feelings.'] },
      { kind: 'villager', id: 'dex', at: [-142, -262], still: true, face: 2.4, name: 'Dexter Jettster', named: true, quest: 'dart', says: ['Hey, ol’ buddy!'] },
    ],
    quests: [
      { id: 'training', name: 'Training remotes', giver: 'master', steps: [{ type: 'shoot', tag: 'remote', n: 8, text: 'Hit the training remotes', spawn: { kind: 'remote', n: 8, at: [0, 150], spread: 8, roam: 5, speed: 2.4, hp: 1, tag: 'remote' } }], done: [['A Jedi Master', 'Good. The Force is with you.']] },
      { id: 'dart', name: 'The saberdart', giver: 'dex', intro: [['Dexter Jettster', 'A dart like that? Kamino. Bring me the one they found at the club and I’ll prove it.']], steps: [{ type: 'collect', item: 'dart', n: 1, spots: [[200, -290]], text: 'Find the saberdart at the club' }, { type: 'talk', actor: 'dex', text: 'Bring it to Dex' }], done: [['Dexter Jettster', 'Kamino saberdart. Those funny little cuts on the side give it away.']] },
    ],
  },
  kamino: {
    life: [{ kind: 'kaminoan', id: 'taunwe', at: [10, 140], still: true, face: 3, name: 'Taun We', named: true, quest: 'jango', says: ['The Prime Minister expects you.'] }],
    quests: [
      { id: 'jango', name: 'The bounty hunter', giver: 'taunwe', intro: [['Taun We', 'Jango Fett is preparing to leave. His ship is on the far platform.']], steps: [{ type: 'reach', at: [-170, -50], r: 20, text: 'Get to Slave I’s landing platform' }, { type: 'shoot', tag: 'jango', n: 1, text: 'Bring down Jango Fett', spawn: { kind: 'jango', at: [-170, -40], hp: 6, roam: 4, tag: 'jango', hostile: H(30, 1.2, 10) } }], done: [[null, '(Slave I lifts off without him for once. Well: almost.)']] },
    ],
  },
  geonosis: {
    life: [{ kind: 'jedi', id: 'mace', at: [-230, 170], still: true, face: -2, name: 'Mace Windu', named: true, quest: ['arena', 'foundry'], says: ['This party’s over.'] }],
    quests: [
      { id: 'arena', name: 'The Petranaki arena', giver: 'mace', intro: [['Mace Windu', 'They’ve let the beasts out. Take the acklay.']], steps: [{ type: 'reach', at: [-260, 200], r: 30, text: 'Into the arena' }, { type: 'shoot', tag: 'acklay', n: 1, text: 'Bring down the acklay', spawn: { kind: 'acklay', at: [-260, 210], hp: 14, leash: 40, tag: 'acklay', hostile: { range: 40, chase: 3, melee: true, reach: 3.4, every: 1.4, damage: 25, delay: 1 } } }], done: [['Mace Windu', 'Not bad. Now the droids.']] },
      { id: 'foundry', name: 'The droid foundry', giver: 'mace', steps: [{ type: 'collect', item: 'part', n: 3, spots: [[-320, -220], [-340, -240], [-326, -246]], text: 'Find Threepio’s pieces in the foundry' }], done: [['C-3PO', 'Oh, thank the Maker. Though I do believe my head is on backwards.']] },
    ],
  },
};
