// What Dimension C-137's people say when Morty talks to them, by hotspot (and
// the cabinets that aren't Roy, and the look of the things that don't talk):
// { who (the name shown, or null for what's seen rather than said), text }.
// ./RmWorld.jsx shows it; ./voicelines.js says it in the speaker's own voice.

import { DESTINATIONS } from './dimensions/destinations';
import { TOWN_SAY } from './town/words';

export const SAY = {
  jerry: { who: 'Jerry', text: 'Hungry for apples?' },
  beth: { who: 'Beth', text: 'I’m a horse surgeon, Morty. Your grandfather’s in the garage.' },
  summer: { who: null, text: 'Summer doesn’t look up from her phone. “Get out of my room, Morty.”' },
  rick: { who: 'Rick', text: 'The portal’s on the wall, Morty. Blips and Chitz is through there. Don’t touch anything else.' },
  mortyroom: { who: null, text: 'Morty’s room: the bed, the desk, and the window Rick climbs in through at night.' },
  clone: { who: null, text: 'A Rick, floating in the tube, waiting till he’s needed. He’s breathing. Probably.' },
  console: { who: null, text: 'Screens of cells and DNA, all of it Rick’s. One of them is Rick, waving at you.' },
  pickle: { who: null, text: 'Pickle Rick, in a jar on the desk. He’s been through a lot.' },
  president: { who: 'The President', text: 'Morty. Where’s your grandfather? I need him in the Oval Office. My people put a portal in his garage. Use it.' },
  secretservice: { who: 'Secret Service', text: 'Step back from the vehicle, son. The President’s schedule is very full.' },
  agent1: { who: 'Federation agent', text: 'Earth is a valued member of the Galactic Federation. Smile, citizen.' },
  agent2: { who: 'Federation agent', text: 'Shoney’s is open. I recommend the eggs. I recommend not asking why.' },
  agent3: { who: 'Federation agent', text: 'Your grandfather’s file is very thick, Morty.' },
  ovalpresident: { who: 'The President', text: 'Sit down, Morty. Not there, that’s Lincoln’s. Tell Rick the free world called, and it’s disappointed.' },
  general1: { who: 'A general', text: 'Don’t touch the phone, son. The red one. Or the other one.' },
  general2: { who: 'A general', text: 'Your grandfather is a national security risk and a national treasure. We haven’t decided which.' },
  dineragent: { who: 'Federation agent', text: 'Sit, Morty. The coffee’s a hologram. The questions aren’t. Where does your grandfather keep the portal gun formula?' },
  principal: { who: 'Principal Vagina', text: 'Morty. Hall pass? No? I’m too tired to care. Go learn something, or at least look like it.' },
  jessica: { who: 'Jessica', text: 'Oh, hey Morty. Did you do the homework? I tried, but my pen ran out halfway through number one.' },
  brad: { who: 'Brad', text: 'Sup, Smith. You’re in my seat. Kidding. Nobody wants to sit there.' },
  tammy: { who: 'Tammy', text: 'Morty! Is Summer here? Tell her I’ve got news. Huge news. Nothing to do with birds.' },
  ethan: { who: 'Ethan', text: 'Is this the maths class? Every class feels like the maths class.' },
  tinyrick: { who: 'Tiny Rick', text: 'Tiny Rick! Totally a normal teenager, Morty. Let’s go to the prom and rock out. Help me.' },
  cabinet1: { who: 'Space Mortyball', text: 'Out of order. Everyone’s queueing for Roy anyway.' },
  cabinet2: { who: 'Plumbus Smash', text: 'Somebody’s high score is all nines, and the stick is sticky.' },
  cabinet3: { who: 'Cronenberg Crush', text: 'You lose a life before you’ve found the button.' },
  // Phase 2 of the multiverse: the rest of the family, and family therapy
  poopybutthole: { who: 'Mr. Poopybutthole', text: 'Ooh wee! Morty, sit down, sit down. Jerry’s telling me about his apples again.' },
  snuffles: { who: null, text: 'Snuffles, asleep on his bed. Don’t give him the helmet.' },
  spacebeth: { who: 'Space Beth', text: 'I’m back for a bit. Dad’s showing me the bench. Don’t ask which of us is the clone, Morty. Nobody knows.' },
  nancy: { who: 'Nancy', text: 'It’s a sleepover, Morty. Summer said you’d knock first. You didn’t knock.' },
  tricia: { who: 'Tricia', text: 'Hi, Morty. We’re doing face masks. You can stay if you don’t talk.' },
  diane: { who: null, text: 'Diane, as Rick keeps her: a hologram over the clone lab’s floor, smiling at nobody. He doesn’t say her name.' },
  therapy: { who: 'Dr. Wong', text: 'Sit down, Morty. Your grandfather told me this was for Jerry. It isn’t. We have fifty minutes.' },
  // the multiverse's destinations (./dimensions/destinations.js)
  ...Object.fromEntries(DESTINATIONS.flatMap((d) => Object.entries(d.say))),
  // the town round the street (./town/words.js)
  ...TOWN_SAY,
};

// how Rick's rooms on the Vindicators' ship end (./dimensions/vindicatorsRules.js)
export const ROOMS_SAY = {
  lost: { who: null, text: 'A trapdoor, a long slide, and you’re back in the hall. Noob-Noob is laughing. Try Rick’s rooms again.' },
  won: { who: null, text: 'A recording of Rick, very drunk: “Noob-Noob! He’s the only one of you worth a damn.” The last door opens.' },
};
