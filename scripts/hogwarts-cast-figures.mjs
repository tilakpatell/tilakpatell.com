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
const cap = (t) => `${t[0].toUpperCase()}${t.slice(1)}`;

export const FIGURES = {
  // ── the three friends, and the keeper of the grounds (B2) ──
  harry: {
    height: 1.45,
    kind: 'student',
    house: 'gryffindor',
    seed: 11,
    look: `A twelve-year-old schoolboy with untidy jet-black hair, round wire-rimmed glasses and green eyes. ${cap(ROBE)}, over a grey V-neck jumper, ${tie('red', 'gold')}, a red-and-gold striped knitted scarf round his neck, black trousers, black shoes.`,
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
    look: `A twelve-year-old schoolgirl with a big mane of very bushy wavy brown hair and brown eyes. ${cap(ROBE)}, over a grey V-neck jumper, ${tie('red', 'gold')}, a grey pleated skirt to the knee, grey knee socks, black shoes, a brown leather satchel on a strap across her body, bulging with books.`,
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
    // (a vulture's look in so many words drew a bird-woman with clawed bare feet: the look is in the face and the stoop)
    look: 'A thin, severe elderly human librarian witch with a long sharp hooked nose, hollow cheeks, narrow suspicious eyes, a long thin neck and grey hair scraped into a tight bun, standing slightly stooped. A high-collared black-and-grey robe to the ankles, a grey shawl round her shoulders, plain black buttoned shoes.',
  },
  rosmerta: {
    height: 1.65,
    kind: 'staff',
    build: 'a curvy body, rounded arms and legs',
    look: 'A curvy, pretty, smiling innkeeper with wavy chestnut hair piled up on her head and rosy cheeks. A fitted burgundy bodice dress with a full skirt to the ankles, a white barmaid’s apron, sturdy brown shoes.',
  },

  // ── the students and the others (B4) ──
  malfoy: {
    height: 1.5,
    kind: 'student',
    house: 'slytherin',
    look: `A pale, pointed-faced twelve-year-old schoolboy with sleek slicked-back white-blond hair, cold grey eyes and a sneer. ${cap(ROBE)}, over a grey V-neck jumper, ${tie('green', 'silver')}, ${scarf('green', 'silver')}, black trousers, polished black shoes.`,
  },
  crabbe: {
    height: 1.6,
    kind: 'student',
    house: 'slytherin',
    build: 'a big heavy body, thick arms and legs',
    look: `A big, heavy, thick-necked twelve-year-old schoolboy with a dark pudding-bowl haircut, small eyes and a dull look. ${cap(ROBE)}, straining over a grey V-neck jumper, ${tie('green', 'silver')}, black trousers, black shoes.`,
  },
  goyle: {
    height: 1.62,
    kind: 'student',
    house: 'slytherin',
    build: 'a big burly body, long thick arms and thick legs',
    look: `A big, burly twelve-year-old schoolboy with short bristly dark hair, a low brow and long thick arms. ${cap(ROBE)}, over a grey V-neck jumper, ${tie('green', 'silver')}, ${scarf('green', 'silver')}, black trousers, black shoes.`,
  },
  neville: {
    height: 1.45,
    kind: 'student',
    house: 'gryffindor',
    build: 'a small round body, short sturdy arms and legs',
    look: `A round-faced, shy, kind twelve-year-old schoolboy with neat light-brown hair, rosy cheeks and a nervous smile. ${cap(ROBE)}, over a grey V-neck jumper, ${tie('red', 'gold')}, ${scarf('red', 'gold')}, grey trousers, black shoes.`,
  },
  luna: {
    height: 1.43,
    kind: 'student',
    house: 'ravenclaw',
    look: `A dreamy twelve-year-old schoolgirl with long straggly dirty-blonde hair to her waist, pale silvery wide-open eyes, earrings shaped like little orange radishes and a necklace of bottle corks. ${cap(ROBE)}, over a grey V-neck jumper, ${tie('blue', 'bronze')}, a grey pleated skirt, mismatched socks, black shoes.`,
  },
  cedric: {
    height: 1.75,
    kind: 'student',
    house: 'hufflepuff',
    build: 'a tall athletic body, long arms and legs',
    look: `A tall, handsome, friendly seventeen-year-old schoolboy with neat short brown hair, grey eyes and an easy smile. ${cap(ROBE)}, over a grey V-neck jumper, ${tie('yellow', 'black')}, ${scarf('yellow', 'black')}, black trousers, black shoes.`,
  },
  ginny: {
    height: 1.4,
    kind: 'student',
    house: 'gryffindor',
    look: `An eleven-year-old schoolgirl with long straight bright red hair, freckles and brown eyes. ${cap(ROBE)}, over a grey V-neck jumper, ${tie('red', 'gold')}, a grey pleated skirt to the knee, grey knee socks, black shoes.`,
  },
  // (one model, two tints: the world colours the jumper of each)
  twin: {
    height: 1.65,
    kind: 'student',
    house: 'gryffindor',
    build: 'a small lanky body, long thin arms and legs',
    tint: { magenta: 'jumper' },
    look: `A tall, grinning sixteen-year-old schoolboy with ginger-red hair, a freckled face and a mischievous look. A hand-knitted bright magenta jumper under ${ROBE}, grey trousers, brown shoes.`,
  },
  // (two bodies, four tints: the world colours the scarf and the tie by house)
  student: {
    height: 1.48,
    kind: 'student',
    tint: { magenta: 'house', cyan: 'house2' },
    look: `A friendly twelve-year-old schoolboy with short tidy brown hair. ${cap(ROBE)}, over a grey V-neck jumper, a white shirt and a bright magenta-and-cyan striped tie, a bright magenta-and-cyan striped knitted scarf round his neck, black trousers, black shoes.`,
  },
  studentgirl: {
    height: 1.44,
    kind: 'student',
    tint: { magenta: 'house', cyan: 'house2' },
    look: `A friendly twelve-year-old schoolgirl with a dark plait over one shoulder. ${cap(ROBE)}, over a grey V-neck jumper, a white shirt and a bright magenta-and-cyan striped tie, a bright magenta-and-cyan striped knitted scarf round her neck, a grey pleated skirt to the knee, grey socks, black shoes.`,
  },
  // (never touches the floor: the world lifts it and plays act-dance.* in the air)
  peeves: {
    height: 1.2,
    kind: 'other',
    look: 'A small, wicked, grinning poltergeist imp with dark slanted eyes and a wide grin, in a bright orange-and-yellow jester’s costume hung with little brass bells, a floppy bell-tipped jester’s hat and curly-toed bell-tipped shoes.',
  },
  // (the four ghosts: shipped opaque, the world draws them translucent)
  nick: {
    height: 1.8,
    kind: 'ghost',
    look: 'A gentleman from the sixteenth century with a neat pointed beard and moustache, long wavy hair, a big white pleated ruff round his neck, a padded doublet with puffed sleeves, short breeches over hose, a short cape and buckled shoes.',
  },
  greylady: {
    height: 1.78,
    kind: 'ghost',
    build: 'a tall slender body, long arms',
    look: 'A tall, beautiful, sad young noblewoman from the Middle Ages with very long straight hair to her waist, in a long flowing medieval gown to the floor with long trailing sleeves and a thin girdle at her waist.',
  },
  friar: {
    height: 1.65,
    kind: 'ghost',
    build: 'a short round stout body, short arms and legs',
    look: 'A stout, jolly monk with a round tonsured head, a fringe of hair and a broad smile, in a plain hooded monk’s habit to the ankles tied with a rope belt, and sandals.',
  },
  baron: {
    height: 1.85,
    kind: 'ghost',
    build: 'a tall gaunt body, long arms and legs',
    look: 'A gaunt, haughty nobleman from the Middle Ages with a long black beard, hollow staring eyes and a high-collared dark doublet under long dark robes, heavy iron chains wrapped round his body and arms.',
  },
  elf: {
    height: 0.9,
    kind: 'other',
    build: 'a tiny skinny body, thin little arms and legs',
    look: 'A small, skinny house-elf creature with huge bat-like ears, big round green eyes, a long pencil-thin nose and thin limbs, wearing an old tea towel tied like a toga, bare feet.',
  },
};

// how a world applies a figure's `tint`: the base colour's texels near a key
// colour (magenta, cyan) given a colour of the house's, their lightness kept
export const TINTS = {
  how: 'For each texel of the base colour map whose hue is within 25° of the key’s (magenta 300°, cyan 180°) and whose saturation is over 0.35, the colour named is put in its place at the texel’s own lightness (new = colour × lightness ÷ the key’s lightness, 0.5): the stripes and the knit kept, the colour changed. A shader can do it as the colour is read, or a canvas once as the texture loads.',
  houses: {
    gryffindor: { house: '#7f0909', house2: '#d3a625' },
    slytherin: { house: '#1a472a', house2: '#aaaaaa' },
    ravenclaw: { house: '#0e1a40', house2: '#946b2d' },
    hufflepuff: { house: '#ecb939', house2: '#372e29' },
  },
  jumpers: { a: '#7a1f2b', b: '#1f3a7a' },
};

// the words that must never reach the picture step: who the figures are
export const NAMES_NEVER = /\b(harry|potter|ron|weasley|hermione|granger|hagrid|rubeus|dumbledore|mcgonagall|snape|flitwick|sprout|hooch|filch|pince|rosmerta|malfoy|draco|crabbe|goyle|longbottom|neville|lovegood|luna|diggory|cedric|ginny|fred|george|peeves|nick|baron|friar|dobby|hogwarts|gryffindor|slytherin|ravenclaw|hufflepuff|radcliffe|grint|watson|coltrane|gambon|harris|smith|rickman|warwick|davis)\b/i;

export function prompt(name) {
  const f = FIGURES[name];
  if (!f) throw new Error(`no figure ${name}`);
  return `${f.look} ${LOOK(f.build)} ${POSE}`;
}
