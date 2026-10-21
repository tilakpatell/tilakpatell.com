// The Red Book’s pages, one a place, from Bag End to the Havens (the
// design’s §4): each its title and date (the Road’s, from the Tale of
// Years), a few sentences of the tale, the place it stands for on the map
// (geography.js), the chapter game it plays (`play`: chapters.js or
// hidden.js) and the Road’s stage it walks (`walk`), the toys on its
// pop-up and the one thing under the Ring to find.
//
// A toy: { id, name (what a hover or a screen reader calls it), say (the
// caption’s line when it is touched), who? (a character met: voiced.js’s
// speaker), clip? (a film line from lib/clips, said with it) }. The words
// are the site’s own; the films’ only through the clips.

export const PAGES = [
  {
    id: 'bag-end',
    title: 'An unexpected party',
    date: '22 September 3001',
    place: 'bag-end',
    play: 'shire',
    walk: 'hobbiton',
    tale: 'Bilbo Baggins turned one hundred and eleven, and the whole of Hobbiton came to the field below the Hill. There were lanterns in the party tree, a speech nobody quite followed, and fireworks the like of which the Shire had not seen since the Old Took’s day.',
    toys: [
      { id: 'dragon', name: 'The dragon firework', say: 'It goes up as a dragon, over the party, and bursts with a sound like a mountain falling.' },
      { id: 'lanterns', name: 'The party tree’s lanterns', say: 'The lanterns light one by one, up through the branches.' },
      { id: 'door', name: 'Bilbo’s green door', say: 'A knock at a round green door. Nobody is at home but a ring in an envelope.' },
      { id: 'gandalf', name: 'Gandalf', who: 'gandalf', clip: 'wizardLate', say: 'Gandalf the Grey, come for the party, with a cart of fireworks.' },
    ],
    find: { id: 'envelope', name: 'Bilbo’s envelope, and what is in it' },
  },
  {
    id: 'shire-edge',
    title: 'Get off the road',
    date: '24 September 3018',
    place: 'bucklebury',
    play: 'shire',
    walk: 'shire-edge',
    tale: 'Frodo, Sam and two cousins who would not be left behind walked east by the lanes. On the road through the Woody End a black horse came up behind them, and its rider bent down, sniffing, over the roots where they hid.',
    toys: [
      { id: 'rider', name: 'The Black Rider', say: 'He leans down from the saddle, and sniffs. The hobbits do not breathe.' },
      { id: 'roots', name: 'The roots by the road', say: 'Under the roots, in the dark. A beetle walks across Frodo’s hand.' },
      { id: 'mushrooms', name: 'Farmer Maggot’s mushrooms', who: 'pippin', clip: 'secondBreakfast', say: 'A basket of Farmer Maggot’s best, which nobody asked for.' },
    ],
    find: { id: 'crown', name: 'The Rider’s crown, as the Ring sees him' },
  },
  {
    id: 'bree',
    title: 'The Prancing Pony',
    date: '29 September 3018',
    place: 'bree',
    play: 'bree',
    walk: 'bree',
    tale: 'Rain at the West Gate, and a warm inn on the other side of it. Barliman Butterbur forgot a letter he should have sent, Pippin talked too much, and a Ranger in the corner watched them all from under his hood.',
    toys: [
      { id: 'bell', name: 'Butterbur’s bell', who: 'butterbur', say: 'Butterbur rings for Nob. Then again, for Bob. Then he remembers the letter.' },
      { id: 'sign', name: 'The inn sign', say: 'A white pony rearing, on a board that creaks in the wind.' },
      { id: 'rain', name: 'The rain', say: 'It has rained on Bree since the hobbits came in sight of it.' },
      { id: 'strider', name: 'Strider, in the corner', who: 'strider', say: 'A hood, a pipe, and a pair of eyes that miss nothing.' },
    ],
    find: { id: 'pint', name: 'An eye in a pint of the Pony’s ale' },
  },
  {
    id: 'weathertop',
    title: 'Amon Sûl',
    date: '6 October 3018',
    place: 'weathertop',
    play: 'weathertop',
    walk: 'weathertop',
    tale: 'On the old watch-hill the hobbits lit a fire, though Strider had told them not to. Five shadows came up the hill in the dark. Frodo put on the Ring, and saw them as they are.',
    toys: [
      { id: 'fire', name: 'The fire', say: 'Sam’s sausages, and a fire that can be seen for miles.' },
      { id: 'wraiths', name: 'The five on the hill', say: 'Five shadows, coming up the slope, and the cold before them.' },
      { id: 'pans', name: 'Sam’s pans', who: 'sam', say: 'Sam carried the pans all the way from Bag End, and he is not leaving them now.' },
    ],
    find: { id: 'blade', name: 'The Morgul-blade, as it was drawn' },
  },
  {
    id: 'ford',
    title: 'The Ford of Bruinen',
    date: '20 October 3018',
    place: 'ford-of-bruinen',
    play: 'weathertop',
    walk: 'ford',
    tale: 'Arwen rode with Frodo for the Ford, nine riders behind them. On the far bank she turned, and the river rose against them in white horses, and swept them away.',
    toys: [
      { id: 'flood', name: 'The river', say: 'The water rises, and comes down in white horses with foam for manes.' },
      { id: 'asfaloth', name: 'Asfaloth', who: 'arwen', say: 'Arwen’s white horse, faster than anything the Riders have.' },
      { id: 'riders', name: 'The nine at the water', say: 'They stop at the edge. Then they come on.' },
    ],
    find: { id: 'elflord', name: 'Glorfindel, shining, as the other world sees him' },
  },
  {
    id: 'rivendell',
    title: 'The house of Elrond',
    date: '25 October 3018',
    place: 'rivendell',
    play: 'rivendell',
    walk: 'rivendell',
    tale: 'In the Last Homely House the Council sat under the trees, and argued about the Ring until a hobbit stood up and said he would take it. Nine walkers set out from Rivendell in the winter.',
    toys: [
      { id: 'narsil', name: 'The shards of Narsil', say: 'The sword that was broken, laid out on its cloth, waiting to be made again.' },
      { id: 'council', name: 'The Council’s chairs', who: 'elrond', say: 'Men, Elves and Dwarves in a circle, and none of them agreeing.' },
      { id: 'book', name: 'Bilbo’s book', who: 'bilbo', say: 'There and Back Again, by Bilbo Baggins. This book, before Frodo wrote in it.' },
    ],
    find: { id: 'plinth', name: 'The Ring on its plinth, burning' },
  },
  {
    id: 'caradhras',
    title: 'The Redhorn Gate',
    date: '11 January 3019',
    place: 'redhorn',
    walk: 'caradhras',
    tale: 'They tried the mountain, and the mountain would not have them. Snow came down on the pass as if something wanted it to, and the crows of Dunland flew over, looking.',
    toys: [
      { id: 'crebain', name: 'The crebain', say: 'A cloud of black birds, low and fast over the rocks. Hide.' },
      { id: 'snow', name: 'The snow', say: 'Snow to the hobbits’ shoulders, and more coming.' },
      { id: 'gimli', name: 'Gimli', who: 'gimli', clip: 'andMyAxe', say: 'Gimli, who would rather have gone under the mountain all along.' },
    ],
    find: { id: 'voice', name: 'The voice in the wind' },
  },
  {
    id: 'moria',
    title: 'Speak, friend',
    date: '13 January 3019',
    place: 'moria',
    play: 'moria',
    walk: 'moria',
    tale: 'By the dark lake under the cliff the Doors of Durin showed only in the moonlight, and opened to a single word. Something in the water had been waiting a long time.',
    toys: [
      { id: 'moon', name: 'The moon', say: 'The moon comes out, and lines of silver shine on the rock.' },
      { id: 'doors', name: 'The Doors of Durin', say: 'Speak, friend, and enter. It is a riddle. Say the word.' },
      { id: 'pool', name: 'The Watcher’s pool', say: 'Rings spread on the still water, though nothing has fallen in.' },
      { id: 'drum', name: 'The drum in the deep', clip: 'youShallNotPass', say: 'Doom, doom. Far below, a drum.' },
    ],
    find: { id: 'durin', name: 'Durin’s crown and stars on the doors' },
  },
  {
    id: 'lorien',
    title: 'The Mirror',
    date: '17 January 3019',
    place: 'lorien',
    play: 'lorien',
    walk: 'lorien',
    tale: 'In the golden wood the Lady of Lothlórien filled a silver basin from the stream, and asked Frodo if he would look. It showed things that were, and things that are, and things that may yet be.',
    toys: [
      { id: 'basin', name: 'The Mirror', say: 'Water from the stream, and the sky in it. Then, something else.' },
      { id: 'lamps', name: 'The mallorn’s lamps', say: 'Lamps in the high flets, silver against the gold.' },
      { id: 'galadriel', name: 'Galadriel', who: 'galadriel', say: 'The Lady of the Wood. She has been waiting for this ring for a very long time.' },
    ],
    find: { id: 'eye', name: 'The Eye in the water' },
  },
  {
    id: 'anduin',
    title: 'The Argonath',
    date: '25 February 3019',
    place: 'argonath',
    play: 'amon-hen',
    walk: 'anduin',
    tale: 'Down the Great River in Elven boats, past the Pillars of the Kings: two stone giants, each with a hand raised against the north, warning off whoever came that way.',
    toys: [
      { id: 'kings', name: 'The Pillars of the Kings', say: 'Isildur and Anárion, their hands raised, warning the north away.' },
      { id: 'boats', name: 'The grey boats', say: 'Three Elven boats on the current, light as leaves.' },
      { id: 'falls', name: 'Rauros', say: 'Far off, the falls of Rauros, a long roar on the water.' },
      { id: 'aragorn', name: 'Aragorn', who: 'aragorn', clip: 'bowToNoOne', say: 'Aragorn, son of Arathorn, under the kings who were his fathers.' },
    ],
    find: { id: 'isildur', name: 'Isildur’s ghost on the water' },
  },
  {
    id: 'marshes',
    title: 'The Dead Marshes',
    date: '1 March 3019',
    place: 'dead-marshes',
    play: 'dead-marshes',
    walk: 'marshes',
    tale: 'Sméagol led them through the marsh by night, where little candles burned on the pools. Do not follow the lights, he said. Under the water, the faces of the dead looked up.',
    toys: [
      { id: 'candles', name: 'The candles in the water', say: 'Little lights on the pools. Do not follow them.' },
      { id: 'smeagol', name: 'Sméagol', who: 'gollum', clip: 'myPrecious', say: 'Sméagol, who knows the way, and wants the precious back.' },
      { id: 'tussocks', name: 'The tussocks', say: 'Step where Sméagol steps, and nowhere else.' },
    ],
    find: { id: 'faces', name: 'The faces under the water' },
  },
  {
    id: 'cirith-ungol',
    title: 'The stair',
    date: '12 March 3019',
    place: 'cirith-ungol',
    play: 'cirith-ungol',
    walk: 'cirith-ungol',
    tale: 'Up the endless stair above Minas Morgul, into a tunnel that smelled of something old and hungry. In the dark, Frodo held up the Lady’s gift, and it shone.',
    toys: [
      { id: 'phial', name: 'The phial of Galadriel', say: 'A light for dark places, when all other lights go out.' },
      { id: 'web', name: 'The web', say: 'Grey cords across the tunnel, thick as rope. Sting cuts them.' },
      { id: 'tower', name: 'The tower', say: 'The tower of Cirith Ungol, its window lit like an eye.' },
      { id: 'sam', name: 'Sam', who: 'sam', clip: 'carryYou', say: 'Samwise the Brave, who will not leave him.' },
    ],
    find: { id: 'eyes', name: 'Shelob’s eyes in the dark' },
  },
  {
    id: 'beacons',
    title: 'The beacons are lit',
    date: '9 March 3019',
    place: 'minas-tirith',
    play: 'minas-tirith',
    walk: 'minas-tirith',
    tale: 'From the White City a fire on a peak, and then another, and another, west along the mountains to Rohan: Gondor calls for aid. The city stood on its seven walls and waited.',
    toys: [
      { id: 'beacon', name: 'The beacons', clip: 'kingsArrival', say: 'Amon Dîn is lit. Then Eilenach, Nardol, Erelas, Min-Rimmon, Calenhad, Halifirien.' },
      { id: 'city', name: 'Minas Tirith', say: 'Seven walls, and the white tower over them all.' },
      { id: 'pippin', name: 'Pippin', who: 'pippin', say: 'Pippin, who lit the first beacon, and probably should not have.' },
    ],
    find: { id: 'dead', name: 'The dead of Dunharrow, keeping their oath' },
  },
  {
    id: 'doom',
    title: 'Mount Doom',
    date: '25 March 3019',
    place: 'mount-doom',
    play: 'mordor',
    walk: 'gorgoroth',
    tale: 'Across the ash of Gorgoroth, under the Eye, up the side of the mountain where the Ring was made. At the very edge Frodo could not let it go. Something else made sure it went.',
    toys: [
      { id: 'cracks', name: 'The Cracks of Doom', say: 'The fire the Ring was made in. It is the only fire that can unmake it.' },
      { id: 'eye', name: 'The Eye', say: 'Lidless, wreathed in flame, and turning.' },
      { id: 'frodo', name: 'Frodo', who: 'frodo', say: 'Frodo, at the end of the road, with the Ring heavier than the mountain.' },
    ],
    find: { id: 'brink', name: 'The Ring on the brink' },
  },
  {
    id: 'havens',
    title: 'The Grey Havens',
    date: '29 September 3021',
    place: 'grey-havens',
    walk: 'havens',
    tale: 'Two years on, Frodo rode west with Bilbo to the sea. There was a white ship at the quay, and the last pages of this book were left for Sam to write.',
    toys: [
      { id: 'ship', name: 'The white ship', say: 'A grey ship, and then a white one, going west into the light.' },
      { id: 'gulls', name: 'The gulls', say: 'The cry of the gulls. Legolas once said it would call him away.' },
      { id: 'lamp', name: 'The lamp on the quay', say: 'Well, I’m back, Sam said, at the door of Bag End, much later.' },
    ],
    find: { id: 'road', name: 'The Straight Road, going on into the West' },
  },
];

// the back pages, after the tale
export const BACK = [
  { id: 'met', title: 'Those you met' },
  { id: 'kept', title: 'Things kept' },
];

export const pageById = (id) => PAGES.find((p) => p.id === id) ?? null;
export const pageIndex = (id) => PAGES.findIndex((p) => p.id === id);
