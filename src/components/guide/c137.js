// Dimension C-137's keys, touch controls and tips, as the guide's /c-137
// page shows them (./pages.js): a file of its own, as ./cybertron.js is, so
// the page's list of every world stays under 800 lines as each episode of
// the Rick and Morty adventure adds its game's keys and its tip. Rows as the
// guide writes them ([keys, what they do], ./keys.js; [title, text] a tip).

export const C137 = {
  keys: [
    { label: 'Walking', rows: [['W A S D / ← ↑ ↓ →', 'Walk'], ['Shift', 'Run'], ['Space', 'Jump'], ['Click, then the mouse', 'Look round (Esc lets go)'], ['E', 'Doors, the cruiser, the games, the portal gun on Rick’s bench'], ['P', 'The portal gun, from anywhere'], ['M', 'Things to do'], ['H', 'The Hangar: the crew’s looks, and the cruiser’s arms, powers, skills and shipyard'], ['C', 'The Hangar, on the crew']] },
    { label: 'In the cruiser', rows: [['W A S D', 'Fly'], ['Space', 'Climb'], ['Shift', 'Drop'], ['F', 'Fire (held, it keeps firing): the guns turn onto the Federation patrol, which fights back once it’s hit'], ['R / Shift+R', 'Next or last weapon'], ['1 2 3', 'Pick a weapon'], ['G', 'Power: the portal gun (or the one picked in the Hangar)'], ['X', 'The big one, once your hits have charged it'], ['E', 'Land (slow, over open ground)']] },
    { label: 'Portal panic', rows: [['W A S D', 'Move'], ['Mouse', 'Aim: the gun fires on its own'], ['F', 'Auto-fire off (then hold the mouse to fire)'], ['Space / Shift', 'Portal-dash'], ['1 2 3', 'Take a gadget'], ['P', 'Pause']] },
    { label: 'Total Rickall', rows: [['Mouse', 'Aim (click first to hold the pointer)'], ['E', 'Remember the one in the crosshair'], ['F / Click', 'Shoot them'], ['Tab', 'Lock on: the crosshair stays on them as you move'], ['Esc', 'Stop the game']] },
    { label: 'Through the portal', rows: [['E', 'Talk, take, look, free: whatever the prompt says'], ['F', 'Fire, in a fight (Evil Rick’s lair, the Blood Dome)'], ['Tab', 'Lock on, in a fight: Morty turns to face them'], ['Run', 'From whoever’s after you: the map shows them red']] },
    { label: 'Plumbus Smash', rows: [['← ↓ → / A S D', 'Smash the left, middle or right chute'], ['P / Esc', 'Pause']] },
    { label: 'Pickle Rick’s sewer run', rows: [['← → / A D', 'Change lanes'], ['Space / ↑ / W', 'Hop'], ['F / Enter', 'Fire, once three screws make the laser'], ['P / Esc', 'Pause']] },
  ],
  touch: [
    { rows: [['Stick', 'Walk, or fly'], ['Swipe', 'Look round'], ['Tap', 'Jump, climb, drop and act, on their buttons'], ['Portal gun', 'Its button at the top: pick where the garage portal goes']] },
    { label: 'Total Rickall', rows: [['Swipe', 'Aim'], ['Tap', 'Shoot the one in the crosshair (or Remember and Shoot, on their buttons)'], ['Lock', 'The crosshair stays on them as you move']] },
    { label: 'Through the portal', rows: [['Tap', 'The star fires, in a fight'], ['Lock', 'Face whoever you’re fighting (on by itself when they come close)']] },
    { label: 'Plumbus Smash', rows: [['Tap', 'Smash a chute']] },
    { label: 'Pickle Rick’s sewer run', rows: [['Tap', 'Left, Hop, Fire and Right, on their buttons']] },
  ],
  tips: [
    ['The portal gun', 'It’s on Rick’s bench in the garage: E there, or P (its button on a phone) anywhere, and pick a place. Then step through the portal on the garage’s west wall: twenty-six places from the show, and Blips and Chitz. Everyone in them does something; some of them come for you, and caught, you’re back at the door. Three slips to spot, a ticket to find, a cell to open, a ring to step into.'],
    ['The planets', 'Gazorpazorp, Planet Squanch, Bird World and the rest of the show’s planets are on the universe map, in the Rick and Morty sector (through the green portal beside the Rick and Morty planet): land on one and you’re in it. What you do there counts on this list (M) too.'],
    ['Portal panic', 'Three waves in each of four dimensions; a gadget from Rick’s bench after each, and a boss to portal on. Rick, Morty or Pickle Rick. A controller works too.'],
    ['Total Rickall', 'Pick up the egg on the living-room bookcase. A parasite only ever leaves good memories of itself, so shoot the ones nobody remembers a bad day with, and nobody else.'],
    ['The Meeseeks box', 'Press the button and give him a task. Give him one he can’t do and he gets help.'],
    ['Interdimensional cable', 'Turn the dial.'],
    ['A look through', 'Past the street, the page’s Fire the portal gun button shows you another dimension. It’s only a look: the gun that takes you is Rick’s, on his bench (P).'],
    ['The Smiths', 'Four of them are site colours. Jerry can ask.'],
    ['Plumbus Smash', 'The walkway cabinet at Blips and Chitz. Smash each plumbus at the foot of its chute; a swing at an empty chute sticks the stick. Somebody’s high score is all nines.'],
    ['Pickle Rick’s sewer run', 'The hole in the agency’s floor. Roll down the drain to the agency: hop the grates, hop onto the rats, and three screws make the rat-suit’s laser. Three bites and you’re a snack.'],
    ['The Microverse', 'Inside the car’s battery. Carry Zeep’s cells from his console to the gooble boxes, one at a time, before the world’s charge runs down; it runs from the first cell you take.'],
    ['Anatomy Park', 'Inside Ruben. Find the four pieces of the park map while the diseases hunt you, then get back through the portal before the clock runs out; caught, the pieces blow back where they were.'],
    ['The cruiser’s chase', 'Fly through the six rings over the street, in order, with the Federation ship shooting at you: three hits and it’s back to the first ring, and it can’t be shot down while it chases you.'],
    ['Needful Things', 'Everything in Mr. Needful’s shop is free, and all but one of the free things are cursed. Look them over first, three looks at most, then take the one with no curse on it; take a cursed one and you’re back at the door.'],
    ['The vat of acid', 'Rick’s fake death, sold to two Gromflomites. Move while their backs are turned and keep still while they look; jump in behind their backs, then play dead while they peer in. Seen moving, you’re back at the door.'],
    ['The Jerryboree', 'A daycare for Jerrys, and one of them is ours. Talk to them: ours offers you an apple, as he does at home, and talking to him again takes him. A wrong pick costs time, and when the clock runs out you’re back at the door.'],
    ['St. Gloopy Noops', 'The hospital in space, where the doctors want something of Jerry’s. Get past them to the theatre at the end of the ward, visit Shrimply Pibbles and take back Jerry’s things, then get out through the portal before the clock runs out; caught, you’re back at the door.'],
  ],
};
