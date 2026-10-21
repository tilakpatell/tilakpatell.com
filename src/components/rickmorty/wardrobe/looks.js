// The wardrobe: how you’d like your Rick and your Morty, and your Walt and
// your Jesse. Each wears one of the bodies the site has rigged for him (the
// one from the show, or a Rick from the Citadel: Cowboy Rick, Cop Rick, a
// Councillor…; Evil Morty, Cop Morty; Mr. White and Heisenberg on Walt’s
// figure, Jesse in his hoodie or the lab’s suit), any of its regions (a
// coat, a shirt, trousers, hair, trainers) recoloured from the show’s own
// colours, and gear on his bones: something on his head, on his face, in
// his hand.
//
// They come in casts, the pairs that fly together (CASTS: the cruiser’s
// Rick and Morty, the RV’s Walt and Jesse), and each cast has its own
// swatches and gear, from its own show. WHO is still Rick and Morty’s pair,
// as it was before there was more than one cast; EVERYONE is all of them.
//
// A look: { body, colors: { region: swatch id }, gear: { head, face, hand } }.
// Kept as { rick, morty, walt, jesse } under LOOK_KEY (looks kept before
// Walt and Jesse had any read as the show has them), and sent online as a
// list of ids (writeLook); whatever comes back is read by the tables here,
// so nothing but their ids is ever believed, never a colour or a shape.
// Pure data, tested in Node: dress.js and gear.js put a look on a figure,
// Wardrobe.jsx offers it.

export const LOOK_KEY = 'tp-wardrobe';
// each one's name, as the wardrobe's tabs say it
export const NAME = { rick: 'Rick', morty: 'Morty', walt: 'Walt', jesse: 'Jesse' };
// each cast, and which crew (universe/crews.js) flies it
export const CASTS = { rickmorty: ['rick', 'morty'], breakingbad: ['walt', 'jesse'] };
export const CREW_CAST = { cruiser: 'rickmorty', rv: 'breakingbad' };
export const EVERYONE = Object.values(CASTS).flat();
export const WHO = CASTS.rickmorty;
export const castOf = (who) => Object.keys(CASTS).find((c) => CASTS[c].includes(who)) ?? null;
export const castOfCrew = (crew) => CREW_CAST[crew] ?? null;

// the parts of a body that take a colour, and what they're called on it
// (five slots whose names are each body’s own: a hazmat suit’s gloves are
// its `inner`, so the wire stays the length it was)
export const REGIONS = ['outer', 'inner', 'legs', 'hair', 'shoes'];

// Walt and Jesse are the site’s own Meshy figures (Albuquerque’s), loaded
// by their whole path, with clips borrowed from Rick’s (meshyCast.js). Walt
// has one figure, in the lab’s yellow suit: Mr. White and Heisenberg are
// that figure in other colours (dress.js gives each its own when nothing’s
// picked), Heisenberg with his own pork-pie hat on (`wears`).
const WALT = '/models/albuquerque/walt.glb';

// each body: { id, name, asset (meshyCast’s: a name of Portal panic’s cast,
// or a whole path), h (metres), regions: { region: its name on this body },
// hat (it has one of its own: no head gear), wears (gear it always has on),
// starts (gear its owner's look starts with, and can take off: Jesse's beanie) }
export const BODIES = {
  rick: [
    { id: 'rick', name: 'Rick C-137', asset: 'rick', h: 1.85, regions: { outer: 'Lab coat', inner: 'Shirt', legs: 'Trousers', hair: 'Hair' } },
    { id: 'tinyrick', name: 'Tiny Rick', asset: 'tinyrick', h: 1.6, regions: { outer: 'Lab coat', inner: 'Shirt', legs: 'Trousers', hair: 'Hair' } },
    { id: 'cowboyrick', name: 'Cowboy Rick', asset: 'cowboyrick', h: 1.97, hat: true, regions: { outer: 'Waistcoat', inner: 'Shirt', legs: 'Jeans' } },
    { id: 'cop', name: 'Cop Rick', asset: 'cop', h: 1.85, hat: true, regions: { outer: 'Uniform', hair: 'Hair' } },
    { id: 'detectiverick', name: 'Detective Rick', asset: 'detectiverick', h: 1.92, hat: true, regions: { outer: 'Trench coat', legs: 'Trousers' } },
    { id: 'sweaterrick', name: 'Doctor Rick', asset: 'sweaterrick', h: 1.85, regions: { outer: 'Cardigan', legs: 'Trousers', hair: 'Hair' } },
    { id: 'suitrick', name: 'Office Rick', asset: 'suitrick', h: 1.85, regions: { outer: 'Suit', hair: 'Hair' } },
    { id: 'factoryrick', name: 'Wafer-line Rick', asset: 'factoryrick', h: 1.85, regions: { outer: 'Jumpsuit' } },
    { id: 'constructionrick', name: 'Construction Rick', asset: 'constructionrick', h: 1.9, hat: true, regions: { outer: 'Jumpsuit' } },
    { id: 'councilrick-a', name: 'Councillor Rick (white)', asset: 'councilrick-a', h: 1.85, regions: { outer: 'Robe', hair: 'Hair' } },
    { id: 'councilrick-b', name: 'Councillor Rick (bearded)', asset: 'councilrick-b', h: 1.9, regions: { outer: 'Robe', hair: 'Hair' } },
    { id: 'councilrick-c', name: 'Councillor Rick (bald)', asset: 'councilrick-c', h: 1.82, regions: { outer: 'Dress coat', legs: 'Trousers' } },
  ],
  morty: [
    { id: 'morty', name: 'Morty C-137', asset: 'morty', h: 1.5, regions: { inner: 'T-shirt', legs: 'Jeans', hair: 'Hair', shoes: 'Trainers' } },
    { id: 'evilmorty', name: 'Evil Morty', asset: 'evilmorty', h: 1.5, regions: { inner: 'T-shirt', legs: 'Jeans', hair: 'Hair' } },
    { id: 'copmorty', name: 'Cop Morty', asset: 'copmorty', h: 1.5, hat: true, regions: { outer: 'Uniform', hair: 'Hair' } },
  ],
  // (the suit first: it’s how the site has always shown him, in the RV and at the bench)
  walt: [
    { id: 'walt', name: 'Walt in hazmat', asset: WALT, h: 1.79, regions: { outer: 'Hazmat suit', inner: 'Gloves', shoes: 'Boots' } },
    { id: 'mrwhite', name: 'Mr. White', asset: WALT, h: 1.79, regions: { outer: 'Jacket', inner: 'Shirt', legs: 'Trousers', shoes: 'Shoes' } },
    { id: 'heisenberg', name: 'Heisenberg', asset: WALT, h: 1.79, hat: true, wears: { head: 'porkpie' }, regions: { outer: 'Jacket', inner: 'Shirt', legs: 'Trousers', shoes: 'Shoes' } },
  ],
  jesse: [
    { id: 'jesse', name: 'Jesse Pinkman', asset: '/models/albuquerque/jesse.glb', h: 1.73, starts: { head: 'jessebeanie' }, regions: { outer: 'Hoodie', legs: 'Jeans', hair: 'Hair', shoes: 'Trainers' } },
    { id: 'jesselab', name: 'Jesse in hazmat', asset: '/models/albuquerque/jesse-lab.glb', h: 1.73, regions: { outer: 'Hazmat suit', inner: 'Gloves', hair: 'Hair' } },
  ],
};

// the show’s colours, by name: Rick and Morty’s…
export const SWATCHES = [
  { id: 'labwhite', name: 'Lab coat white', hex: '#eef3f4' },
  { id: 'ricksblue', name: 'Rick’s hair blue', hex: '#a9d6e5' },
  { id: 'mortyyellow', name: 'Morty yellow', hex: '#f3d84b' },
  { id: 'portalgreen', name: 'Portal green', hex: '#97ce4c' },
  { id: 'meeseeksblue', name: 'Meeseeks blue', hex: '#6fc3ea' },
  { id: 'plumbuspink', name: 'Plumbus pink', hex: '#e79bb0' },
  { id: 'squanchyorange', name: 'Squanchy orange', hex: '#e98a3a' },
  { id: 'summerpink', name: 'Summer pink', hex: '#e2468f' },
  { id: 'bethred', name: 'Beth red', hex: '#b8323b' },
  { id: 'jerrygreen', name: 'Jerry green', hex: '#5b6b3a' },
  { id: 'birdbrown', name: 'Birdperson brown', hex: '#8a5a34' },
  { id: 'unitypurple', name: 'Unity purple', hex: '#7b4bb5' },
  { id: 'gazorpteal', name: 'Gazorpazorp teal', hex: '#2f8f87' },
  { id: 'cromulonpeach', name: 'Cromulon peach', hex: '#f0b49a' },
  { id: 'councilgrey', name: 'Council grey', hex: '#7d8590' },
  { id: 'voidblack', name: 'Void black', hex: '#24222b' },
];
// …and Breaking Bad’s
const BB_SWATCHES = [
  { id: 'hazmatyellow', name: 'Hazmat yellow', hex: '#f0d43a' },
  { id: 'bluesky', name: 'Blue Sky blue', hex: '#5fc8ef' },
  { id: 'heisenbergblack', name: 'Heisenberg black', hex: '#1f1e22' },
  { id: 'waltgreen', name: 'Walt’s green shirt', hex: '#7f9468' },
  { id: 'tanjacket', name: 'Walt’s tan jacket', hex: '#b9a37c' },
  { id: 'khaki', name: 'Khaki slacks', hex: '#7a6a4b' },
  { id: 'hoodiered', name: 'Jesse’s red hoodie', hex: '#b5372c' },
  { id: 'hoodieyellow', name: 'Jesse’s yellow hoodie', hex: '#cf9d2a' },
  { id: 'beaniegrey', name: 'Beanie grey', hex: '#68696e' },
  { id: 'pollosyellow', name: 'Los Pollos yellow', hex: '#f7b500' },
  { id: 'pollosred', name: 'Los Pollos red', hex: '#c62f2a' },
  { id: 'rvbeige', name: 'RV beige', hex: '#d9c8a2' },
  { id: 'deserttan', name: 'Desert tan', hex: '#c69d68' },
  { id: 'mariepurple', name: 'Marie purple', hex: '#7a4a9c' },
  { id: 'pinkbear', name: 'Pink teddy bear', hex: '#e48aa8' },
  { id: 'schraderbrau', name: 'Schraderbräu amber', hex: '#a8641d' },
];
const PALETTES = { rickmorty: SWATCHES, breakingbad: BB_SWATCHES };
export const swatchesOf = (who) => PALETTES[castOf(who)] ?? SWATCHES;

// gear, by where it goes: { id, name, bone }; Rick and Morty’s…
export const GEAR_SLOTS = ['head', 'face', 'hand'];
export const GEAR = {
  head: [
    { id: 'none', name: 'Nothing', bone: null },
    { id: 'partyhat', name: 'Party hat', bone: 'Head' },
    { id: 'beanie', name: 'Beanie', bone: 'Head' },
    { id: 'tophat', name: 'Top hat', bone: 'Head' },
    { id: 'crown', name: 'Crown', bone: 'Head' },
    { id: 'headphones', name: 'Headphones', bone: 'Head' },
  ],
  face: [
    { id: 'none', name: 'Nothing', bone: null },
    { id: 'shades', name: 'Shades', bone: 'Head' },
    { id: 'goggles', name: 'Flight goggles', bone: 'Head' },
    { id: 'eyepatch', name: 'Eyepatch', bone: 'Head' },
  ],
  hand: [
    { id: 'none', name: 'Nothing', bone: null },
    { id: 'portalgun', name: 'Portal gun', bone: 'RightHand', file: '/models/wardrobe/portalgun.glb' }, // (someone else's model: see modelCredits.json)
    { id: 'plumbus', name: 'Plumbus', bone: 'RightHand' },
    { id: 'laserpistol', name: 'Laser pistol', bone: 'RightHand' },
  ],
};
// …and Walt and Jesse’s, all built in code (gear.js)
export const BB_GEAR = {
  head: [
    { id: 'none', name: 'Nothing', bone: null },
    { id: 'porkpie', name: 'Pork-pie hat', bone: 'Head' },
    { id: 'jessebeanie', name: 'Jesse’s beanie', bone: 'Head' },
  ],
  face: [
    { id: 'none', name: 'Nothing', bone: null },
    { id: 'glasses', name: 'Glasses', bone: 'Head' },
    { id: 'shades', name: 'Shades', bone: 'Head' },
    { id: 'respirator', name: 'Respirator', bone: 'Head' },
  ],
  hand: [
    { id: 'none', name: 'Nothing', bone: null },
    { id: 'bluebag', name: 'A bag of blue', bone: 'RightHand' },
    { id: 'flask', name: 'Flask', bone: 'RightHand' },
  ],
};
const GEARS = { rickmorty: GEAR, breakingbad: BB_GEAR };
export const gearOf = (who) => GEARS[castOf(who)] ?? GEAR;

const SWATCH = new Map([...SWATCHES, ...BB_SWATCHES].map((s) => [s.id, s]));
export const swatchById = (id) => SWATCH.get(id) ?? null;
const BODY = new Map(Object.values(BODIES).flatMap((list) => list.map((b) => [b.id, b])));
export const bodyById = (id) => BODY.get(id) ?? null;
// whose a body is (ids are unique across everyone)
export const whoseBody = (id) => EVERYONE.find((who) => BODIES[who].some((b) => b.id === id)) ?? null;
export const bodyOf = (who, id) => BODIES[who]?.find((b) => b.id === id) ?? null;
// a piece of gear by its id, in any cast’s (the same piece can be in two)
export const gearById = (slot, id) => Object.values(GEARS).flatMap((g) => g[slot] ?? []).find((g) => g.id === id) ?? null;
// the model files a set of looks wears, for the credits of what’s on screen
export const wornFiles = (looks) => [...new Set(EVERYONE.flatMap((who) => GEAR_SLOTS.map((slot) => gearById(slot, looks?.[who]?.gear?.[slot])?.file).filter(Boolean)))];

const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

export const defaultLook = (who) => ({ body: BODIES[who][0].id, colors: {}, gear: { head: 'none', face: 'none', hand: 'none', ...BODIES[who][0].starts } });

// A look from storage (or anything): the body if it's one of his, the
// colours its regions take from his cast’s swatches, the gear his cast has
// (and nothing on a hat).
export function readLook(who, raw) {
  const out = defaultLook(who);
  if (!isObject(raw)) return out;
  const body = (typeof raw.body === 'string' && bodyOf(who, raw.body)) || bodyOf(who, out.body);
  out.body = body.id;
  const palette = swatchesOf(who);
  const gear = gearOf(who);
  if (isObject(raw.colors)) for (const r of Object.keys(body.regions)) if (typeof raw.colors[r] === 'string' && palette.some((s) => s.id === raw.colors[r])) out.colors[r] = raw.colors[r];
  if (isObject(raw.gear)) for (const slot of GEAR_SLOTS) if (typeof raw.gear[slot] === 'string' && gear[slot].some((g) => g.id === raw.gear[slot])) out.gear[slot] = raw.gear[slot];
  if (body.hat) out.gear.head = 'none';
  return out;
}

export function readLooks(raw) {
  return Object.fromEntries(EVERYONE.map((who) => [who, readLook(who, isObject(raw) ? raw[who] : null)]));
}

// What a look has on, slot by slot: what was picked, and what its body
// always wears (Heisenberg’s hat), which is never sent: it comes with the body.
export const gearWorn = (look) => ({ ...look.gear, ...(bodyById(look.body)?.wears ?? {}) });

// The wire: [body, outer, inner, legs, hair, shoes, head, face, hand], a
// region with no colour of its own as null.
export const writeLook = (look) => [look.body, ...REGIONS.map((r) => look.colors[r] ?? null), ...GEAR_SLOTS.map((s) => look.gear[s])];
export function readLookWire(who, data) {
  if (!Array.isArray(data) || data.length !== 1 + REGIONS.length + GEAR_SLOTS.length) return null;
  if (!data.every((v) => v === null || (typeof v === 'string' && v.length <= 24))) return null;
  const [body, ...rest] = data;
  if (!bodyOf(who, body)) return null;
  const colors = Object.fromEntries(REGIONS.map((r, i) => [r, rest[i]]).filter(([, v]) => v !== null));
  const gear = Object.fromEntries(GEAR_SLOTS.map((s, i) => [s, rest[REGIONS.length + i]]));
  return readLook(who, { body, colors, gear });
}
