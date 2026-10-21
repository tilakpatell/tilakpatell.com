// Hogwarts' keys: written once, here, and read by the guide's /hogwarts page
// (./pages.js) and the world's basics (tour/briefs.js), so the two never
// say different things. A file of its own, as ./cybertron.js and
// ./mario64.js are, so the guide's pages stay small. Every key the world
// will have is here from the first (the design's §4.5, §4.6 and §4.8): the
// wand comes at the first lesson, the broom at the flying lesson and the
// Map after the first week, and the groups say so. Rows as the guide
// writes them ([keys, what they do], ./keys.js).

export const HOGWARTS_WALK = [
  ['W A S D / ← ↑ ↓ →', 'Walk'],
  ['Shift', 'Run'],
  ['Drag', 'Look round'],
  ['E / Enter', 'Do what the prompt says (go in at a door, take a boat)'],
  ['Esc', 'The Menu'],
];

export const HOGWARTS_KEYS = [
  { label: 'On foot', rows: HOGWARTS_WALK },
  {
    label: 'The arrival and the Sorting',
    rows: [
      ['Enter', 'Straight to the castle, once you’ve seen the arrival whole'],
      ['1 2 3 4', 'Answer the Sorting Hat'],
      ['← → / ↑ ↓, Enter', 'Pick an answer and give it'],
    ],
  },
  { label: 'In the castle', rows: [['Esc', 'Leave the room you’re in, back the way you came']] },
  {
    label: 'The wand (from your first lesson)',
    rows: [
      ['hold Q', 'The spell wheel: point at a spell and let go'],
      ['1', 'Lumos, and Nox: the wand lights, and goes out'],
      ['2', 'Wingardium Leviosa: lift a thing and carry it'],
      ['3', 'Alohomora: open what’s locked and may be opened'],
      ['4', 'Accio: bring a thing within 20 m to your hand'],
      ['5', 'Incendio: light a torch, a fire or a cauldron'],
      ['6', 'Expelliarmus: disarm, in a duel'],
      ['7', 'Stupefy: stun, in a duel'],
      ['8', 'Protego: a shield for a second, that throws a spell back'],
      ['9', 'Expecto Patronum: once you’ve learnt it'],
    ],
  },
  {
    label: 'The broom (from the flying lesson)',
    rows: [
      ['W', 'Lean forward and go'],
      ['S', 'Brake'],
      ['A D', 'Bank'],
      ['Space', 'Up'],
      ['C', 'Down'],
      ['Shift', 'Flat out'],
      ['E', 'Get on at the rack, and off again; catch the Snitch'],
    ],
  },
  { label: 'The Map (after the first week)', rows: [['M', 'The Marauder’s Map, open and shut']] },
];

export const HOGWARTS_TOUCH = [
  {
    label: 'On foot',
    rows: [
      ['Stick', 'Walk (push it all the way to run)'],
      ['Swipe', 'Look round'],
      ['Tap', 'The prompt, to do what it says'],
    ],
  },
  {
    label: 'The arrival and the Sorting',
    rows: [
      ['Straight to the castle', 'Skip the arrival, once you’ve seen it whole'],
      ['Tap an answer', 'Answer the Sorting Hat'],
    ],
  },
];
