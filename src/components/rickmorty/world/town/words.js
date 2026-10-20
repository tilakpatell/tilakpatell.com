// What the town round the street says when Morty touches it, as ../say.js
// has it ({ who, text }: who is null for what's seen, not said): the
// park's things, the shops, the water tower, the posters (read in order,
// they're a story, but they needn't be) and the agent at the cinema.

export const TOWN_SAY = {
  bandstand: { who: null, text: 'The bandstand. A sign says SUNDAY: THE FLESH CURTAINS (CANCELLED). Under it, in pen: “they know what they did.”' },
  statue: { who: null, text: 'THE REVERSE GIRAFFE. GIVEN TO THE TOWN. NOBODY ASKED. Someone’s put a hat on it. Someone else has taken the hat and left a note saying sorry.' },
  plumbusplus: { who: null, text: 'Plumbus Plus: every plumbus you could want, from the regular to the deluxe with the dinglebop pre-smoothed. A card in the window says SCHLEEM SOLD OUT.' },
  szechuan: { who: null, text: 'Szechuan Palace. The sauce is behind the counter in a locked case, with a guard. The guard looks tired.' },
  fleeb: { who: null, text: 'Fleeb Juice. Freshly squeezed, the menu says, and doesn’t say what from. Four stars from a reviewer called Grumbo.' },
  pawn: { who: null, text: 'Pawn & Loan. In the window: a used portal gun (doesn’t work), a box of Meeseeks boxes (do work, don’t), and a Plumbus with a sign that says AS IS.' },
  cinema: { who: null, text: 'The Herpson. One for Ball Fondlers, please. The girl in the booth says it’s sold out, and has been since it came out, and that nobody’s ever seen it.' },
  watertower: { who: null, text: 'The water tower, painted in the school’s colours. Someone’s climbed up and changed one word. Nobody’s climbed up to change it back.' },
  cinemaagent: { who: 'Federation agent', text: 'Two tickets for Ball Fondlers, citizen. One for me, and one for my loyalty to the Federation. Move along.' },
  poster1: { who: null, text: 'MISSING: one cat. Talks. Do not listen. Call Jerry. Under it, in different handwriting: “I listened. I can’t unlisten.”' },
  poster2: { who: null, text: 'The same poster. Someone’s added: “He told me something in the night. I’ve left my family. I live in this town now. It’s fine.”' },
  poster3: { who: null, text: 'The same poster, half torn off. On the back, in pencil: “He was right about my brother-in-law.”' },
  poster4: { who: null, text: 'The same poster. Jerry’s added a phone number, crossed it out, and written: “Actually, if you find him, keep him. Please.”' },
  poster5: { who: null, text: 'On the bandstand’s post, the last poster: “FOUND. Living in Florida. Doing well. Do not visit.” The cat has signed it.' },
};
