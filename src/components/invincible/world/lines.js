// What the city's people say when Mark comes by (./npcs.js stands them about,
// ./scene.js puts Allen and Thragg out in space and Dad over downtown), by
// who they are: a person's own, or a townsperson's by the part they play.
export const LINES = {
  debbie: ['You’re home early. Did you fly?', 'There’s lasagna in the fridge.', 'Your father’s out. Again.', 'Be careful up there, sweetie.'],
  // Mom, once he knows what his father is (after episode 8: linesOf)
  debbieAfter: ['He isn’t coming back, is he.', 'I made too much dinner again. Sit down.', 'You don’t have to be anything like him, Mark.', 'Fly safe. Then come home.'],
  cecil: ['Kid. You’re making a lot of noise over my city.', 'Break the sound barrier over downtown and I get the calls.', 'We should talk about your future with the GDA.', 'Don’t look at the building. It’s a records annex.'],
  eve: ['Race you to the river?', 'You know you can just float, right? You don’t have to flap.', 'I’m on patrol. You’re… sightseeing?', 'Nice landing. The street disagrees.'],
  omni: ['Think, Mark!', 'Keep up.', 'You’re flying like a human.', 'Five hundred years from now, this city will be dust. Think about that.'],
  manager: ['You’re late.', 'Fries don’t drop themselves, Grayson.', 'Is that a costume? Take it off before the dinner rush.'],
  student: ['Was that you on the news?', 'Grayson! Did you do the reading?', 'There’s a guy on the roof of the gym. Oh, it’s you.'],
  allen: ['Hi! Allen. Allen the Alien. I test the champions of new worlds for the Coalition of Planets.', 'So you’re Earth’s new guy? You’re younger than I pictured.', 'Your moon’s quieter than I expected. Nice view, though.', 'Ask your dad about the Viltrumites sometime. Really ask.'],
  thragg: ['So this is Nolan’s son.', 'Viltrum will have this world, boy. Sooner than you think.', 'Go back to your little city while it’s still there.'],
  fan: ['Is that Invincible?', 'Can I get a picture?', 'My cousin says you can’t even lift a bus.', 'Do you know Omni-Man?', 'You flew over my car. It’s fine. It’s fine.'],
};

// whose lines someone has now: Mom's change once episode 8 is played
export const linesOf = (id, story = {}) => (id === 'debbie' && Array.isArray(story?.done) && story.done.includes('ep8') ? LINES.debbieAfter : LINES[id]);

// What Eve and Dad say as they go about with him (./companions.js): Eve
// coming up to him, flying with him, wading into a fight; Dad at Dad's
// rings (the first three rings, then once he's taken too long), on the
// porch, and leading the way over the city.
export const COMPANION = {
  eveMeet: ['Hey. You’ve been hanging there a while. Everything OK?', 'Patrol’s quiet. Want company?', 'You look like you’re thinking too hard. Fly with me.'],
  eveEscort: ['I’ll take your left.', 'Try to keep it under Mach one over the houses.', 'Right behind you. Well, beside you.'],
  eveFight: ['Got this one!', 'Duck!', 'That’s two you owe me.'],
  dadRing: ['Good. Now the next.', 'Straighter. Don’t drift.', 'Better. Keep the speed up.'],
  dadSlow: ['You’re thinking about it. Don’t. Fly.', 'Mark. We don’t have all day.', 'Faster. You’re not a plane.'],
  dadHome: ['Long day, son?', 'Your mother made dinner. Sit with us a while.'],
  dadSpar: ['Follow me. Keep up.', 'Again. Closer this time.', 'Faster, Mark.', 'Last one. Show me.'],
};

// What the other heroes say flying the city (./heroes.js): one as he takes
// one up, and now and then after. Eve's first is her own line from the street.
export const HERO_LINES = {
  eve: ['You know you can just float, right? You don’t have to flap.', 'Somebody has to put back what you two knock down.', 'Every atom down there owes me a favour.', 'The skyline looks better from up here. Pinker.'],
  omniman: ['They’re so slow from up here.', 'You stop hearing the city after a few centuries.', 'Mind the windows. Or don’t.', 'Mark would be faster if he listened.'],
  thragg: ['This world is smaller than they told me.', 'Viltrum built cities like this in a week.', 'Nothing in this sky can hold me.', 'So this is the boy’s city. How quaint.'],
};

// And what's said in passing, over the HUD (./InvWorld.jsx's say): who says
// it (one of the people above) and the line as it's shown.
export const CALLS = {
  portal: { who: 'cecil', text: 'Cecil: “Portal over the river. Flaxans again. Go.”' },
  spar: { who: 'omni', text: '“Think, Mark!” Down the page, over the city.' },
  mimic: { who: 'omni', text: 'Dad, in your ear: “Look what they need to mimic a fraction of our power.”' },
  linebreak: { who: 'cecil', text: 'Cecil: “Every window on the avenue. Tell me that wasn’t you.”' },
};

// What Dad says when his rings are done, quoted after the lap's time (which
// changes, so only his words are said aloud).
export const RINGS_DONE = { who: 'omni', text: 'Not bad. For a start.' };
