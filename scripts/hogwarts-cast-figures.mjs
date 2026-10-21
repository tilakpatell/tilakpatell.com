// Hogwarts' people, as scripts/hogwarts-cast.mjs makes them: each by how
// they look, never by name (the picture step turns names down, and no
// likeness is modelled: the owner's rule). The look is the Middle-earth
// cast's (scripts/meshy-middleearth.mjs): a big-headed toy figure, so one
// cast on the site reads as the other does; the pose is the A-pose
// scripts/rig/skin.mjs reads the joints off.
// (docs/superpowers/specs/2026-10-21-hogwarts-world-design.md §4.10)
//
//   FIGURES: { name: { height (m, crown to sole), kind, house?, tall?, build?, look } }
//   prompt(name) → the words the concept picture is drawn from
//   NAMES_NEVER: words no prompt may hold (the books' and the films' people)

// the look every figure shares; `build` stands in for the body's part of it
export const LOOK = (build = 'a small body, short sturdy arms and legs') =>
  `A stylized chibi toy figure like a painted vinyl collectible: an oversized round head about a third of the whole height, ${build}, simple chunky hands, soft rounded shapes, smooth matte hand-painted colours, a simple friendly cartoon face with small dark eyes.`;
export const POSE =
  'Full body, standing straight in a neutral A-pose: both arms straight and angled down about 45 degrees away from the sides of the body with clear space between each arm and the body, open empty hands, legs apart with a gap between them, feet flat, no base or plinth.';

const ROBE = 'a black school robe with narrow fitted sleeves, open at the front and ending at the knees';
const scarf = (a, b) => `a ${a}-and-${b} striped knitted scarf round the neck`;
const tie = (a, b) => `a white shirt and a ${a}-and-${b} striped tie`;

export const FIGURES = {
  // ── the three friends, and the keeper of the grounds (B2) ──
  harry: {
    height: 1.45,
    kind: 'student',
    house: 'gryffindor',
    seed: 11,
    look: `A twelve-year-old schoolboy with untidy jet-black hair, round wire-rimmed glasses and green eyes. ${ROBE[0].toUpperCase()}${ROBE.slice(1)}, over a grey V-neck jumper, ${tie('red', 'gold')}, a red-and-gold striped knitted scarf round his neck, black trousers, black shoes.`,
  },
  ron: {
    height: 1.52,
    kind: 'student',
    house: 'gryffindor',
    build: 'a small lanky body, long thin arms and legs',
    look: `A tall, gangly twelve-year-old schoolboy with bright ginger-red hair, a freckled face and a long nose. A lumpy hand-knitted maroon jumper under ${ROBE}, ${scarf('red', 'gold')}, grey trousers, scuffed brown shoes.`,
  },
  hermione: {
    height: 1.42,
    kind: 'student',
    house: 'gryffindor',
    look: `A twelve-year-old schoolgirl with a big mane of very bushy wavy brown hair and brown eyes. ${ROBE[0].toUpperCase()}${ROBE.slice(1)}, over a grey V-neck jumper, ${tie('red', 'gold')}, a grey pleated skirt to the knee, grey knee socks, black shoes, a brown leather satchel on a strap across her body, bulging with books.`,
  },
  hagrid: {
    height: 2.6,
    kind: 'staff',
    tall: true,
    build: 'a huge broad round body, thick strong arms and legs',
    look: 'A huge burly giant of a man, twice as broad as a person, with a wild bushy black beard and long shaggy tangled black hair hiding most of his face, small kind black eyes and a big round belly. A long heavy brown moleskin overcoat with big patch pockets, reaching to his shins, over a brown waistcoat and a rough cream shirt, big brown boots.',
  },

  // ── the staff (B3) ──
  dumbledore: {
    height: 1.85,
    kind: 'staff',
    build: 'a tall thin body, long thin arms and legs',
    look: 'A tall, thin, very old wizard with a very long silver-white beard down to his belt and long silver-white hair, half-moon spectacles on a long crooked nose and twinkling blue eyes. Long flowing deep purple robes with long sleeves, embroidered with small silver stars and reaching the floor, purple slippers, no hat.',
  },
  mcgonagall: {
    height: 1.72,
    kind: 'staff',
    build: 'a tall slim body, long arms and legs',
    look: 'A tall, stern, elderly witch with her dark grey hair in a tight bun, square spectacles and thin lips. Long emerald-green robes with a high collar reaching her ankles, a tall pointed emerald-green witch’s hat with a wide brim, black boots.',
  },
  snape: {
    height: 1.85,
    kind: 'staff',
    build: 'a tall thin body, long thin arms and legs',
    look: 'A thin, pale man with lank greasy black hair to his shoulders parted in the middle, a long hooked nose, dark eyes and a sour look. Long black robes buttoned to the throat with many small buttons, a long black cloak, black boots.',
  },
  flitwick: {
    height: 0.9,
    kind: 'staff',
    build: 'a tiny body, short little arms and legs',
    look: 'A tiny old wizard no taller than a small child, with a bushy white moustache, a tuft of white hair, round spectacles and big ears. Neat dark-blue robes over a waistcoat and a little bow tie, small black shoes.',
  },
  sprout: {
    height: 1.6,
    kind: 'staff',
    build: 'a short round plump body, short sturdy arms and legs',
    look: 'A short, plump, cheerful witch with flyaway grey curly hair under a patched, battered brown witch’s hat, rosy cheeks and earth on her hands. Patched earth-brown robes with a green apron and dirt on the hem, muddy brown boots.',
  },
  hooch: {
    height: 1.7,
    kind: 'staff',
    build: 'a lean athletic body, long arms and legs',
    look: 'A lean, athletic witch with short spiky grey hair, sharp yellow hawk-like eyes and a stern face. A black-and-white striped referee’s robe over a fitted black tunic with a belt, black trousers, tall black boots, a silver whistle on a cord round her neck.',
  },
  filch: {
    height: 1.7,
    kind: 'staff',
    build: 'a scrawny stooped body with a hunched back, thin arms and legs',
    look: 'A stooped, scrawny old caretaker with a hunched back, thin straggly grey hair round a bald patch, heavy jowls, bulging pale eyes and a scowl. A shabby patched brown coat over a grimy waistcoat, old brown trousers, worn boots, an old iron lantern hanging from his belt at his hip.',
  },
  pince: {
    height: 1.7,
    kind: 'staff',
    build: 'a tall thin bony body, thin arms and legs',
    look: 'A thin, sharp-faced elderly witch with the look of a vulture: a hooked beak of a nose, sunken cheeks, a long thin neck and grey hair scraped into a bun. A high-collared black-and-grey robe to the floor and a grey shawl round her shoulders.',
  },
  rosmerta: {
    height: 1.65,
    kind: 'staff',
    build: 'a curvy body, rounded arms and legs',
    look: 'A curvy, pretty, smiling innkeeper with wavy chestnut hair piled up on her head and rosy cheeks. A fitted burgundy bodice dress with a full skirt to the ankles, a white barmaid’s apron, sturdy brown shoes.',
  },
};

// the words that must never reach the picture step: who the figures are
export const NAMES_NEVER = /\b(harry|potter|ron|weasley|hermione|granger|hagrid|rubeus|dumbledore|mcgonagall|snape|flitwick|sprout|hooch|filch|pince|rosmerta|malfoy|draco|crabbe|goyle|longbottom|neville|lovegood|luna|diggory|cedric|ginny|fred|george|peeves|nick|baron|friar|dobby|hogwarts|gryffindor|slytherin|ravenclaw|hufflepuff|radcliffe|grint|watson|coltrane|gambon|harris|smith|rickman|warwick|davis)\b/i;

export function prompt(name) {
  const f = FIGURES[name];
  if (!f) throw new Error(`no figure ${name}`);
  return `${f.look} ${LOOK(f.build)} ${POSE}`;
}
