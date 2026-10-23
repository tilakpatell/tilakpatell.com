// The Rick and Morty adventure's thirteen episodes, as data. A Federation raid
// wiped the coordinates in Rick's portal gun; each episode wins some back, and
// the last ends at Evil Rick's lair with every one home.
//
// An episode is { id, title, intro, steps, outro, unlocks }: the lines that
// open and close it ([who, text]), the steps it waits for in order, and the
// dial places it opens once it's done. A step is { type, text, … }, its text
// the objective line while it's current:
//   task id       a C-137 task (world/rules.js's TASKS) is done
//   win game      a game raised a win that isn't a task (WINS)
//   enter area    Morty walks into an area, or a page (`page:/c-137/citadel`)
//   talk who, use id   a person talked to, a hotspot used
//   citadel id    a step of the Citadel's chain (citadel/story.js's QUESTS)
//   all steps     every one of its steps, in any order
// `place` is the dial place a step needs, if it needs one.
//
// READY says how many episodes, from the first, are built: past the last
// ready one the dial is open, so nobody waits on one that isn't there. Each
// phase raises it by one. Pure: story.js plays these.

export const READY = 9;
export const START = ['customs'];
export const WINS = ['cabinet', 'chase'];
export const STEP_TYPES = ['task', 'win', 'enter', 'talk', 'use', 'citadel', 'all'];

const task = (id, text, place) => (place ? { type: 'task', id, place, text } : { type: 'task', id, text });

export const EPISODES = [
  {
    id: 'wiped',
    title: 'Wiped',
    intro: [['Rick', 'The Federation came through the garage at dawn and wiped my portal gun. Every coordinate. I keep backups, Morty. I’m not an animal.']],
    steps: [
      task('diner', 'A Federation agent is in a booth at Shoney’s, up the street. Find out what the raid took.'),
      task('basement', 'Rick keeps backups under the garage. Find the hatch in the floor.'),
      task('mindblowers', 'The backup chip is in the Mind Blowers chair, through the clone lab. Sit in it and watch.'),
      task('customs', 'The first coordinates are in Rick’s Mega Seeds. Dial Customs, take them through the scanner and get back through the portal before they catch you.', 'customs'),
    ],
    outro: [['Rick', 'One set home. The rest are scattered, because past me was a genius and also kind of a jerk.']],
    unlocks: ['annex', 'meeseeksgolf'],
  },
  {
    id: 'arcade',
    title: 'Arcade money',
    intro: [['Rick', 'The next set’s at Blips and Chitz. I bet it on a high score a while back, and I don’t remember losing.']],
    steps: [
      task('roy', 'Dial Blips and Chitz and live a life as Roy.', 'annex'),
      { type: 'win', game: 'cabinet', place: 'annex', text: 'Rick bet the next set on a walkway cabinet at Blips and Chitz. Beat its target.' },
    ],
    outro: [['Morty', 'We won coordinates back at an arcade, Rick. I don’t think that’s how coordinates are supposed to work.']],
    unlocks: ['agency', 'simulation'],
  },
  {
    id: 'guests',
    title: 'House guests',
    intro: [['Morty', 'Rick says a backup’s hidden in the house, and there’s someone in the family photos I’ve never met.']],
    steps: [
      task('rickall', 'Somebody new is in the family photos. Start with the egg on the living-room bookcase, and get through Total Rickall.'),
      task('wong', 'Rick won’t go to therapy. Go anyway: Dr. Wong’s office is next to Shoney’s.'),
      task('sewer', 'Dial the agency, get down the hole into the sewer and make the far drain.', 'agency'),
    ],
    outro: [['Rick', 'Two more sets home. And for the record, the therapy was your idea.']],
    unlocks: ['microverse', 'anatomy', 'storytrain'],
  },
  {
    id: 'small',
    title: 'Small problems',
    intro: [['Rick', 'Two sets went somewhere small. One’s powering a car battery, the other’s inside a man. Don’t ask.']],
    steps: [
      task('microverse', 'The car’s battery has gone flat. Dial the Microverse and power Zeep’s world.', 'microverse'),
      task('anatomy', 'A set of coordinates went into Ruben. Dial Anatomy Park and get it out.', 'anatomy'),
    ],
    outro: [['Morty', 'I was inside a guy, Rick. A whole guy.']],
    unlocks: ['gromflomites', 'fortress'],
  },
  {
    id: 'heat',
    title: 'Heat',
    intro: [['Rick', 'The Federation’s found the street. Time to be somewhere they aren’t, quickly.']],
    steps: [
      { type: 'win', game: 'chase', text: 'The Federation ship is over the street. Take the cruiser up and shake it.' },
      task('gromflomites', 'Dial the Gromflomite base and get to Fart’s cell without a guard seeing you.', 'gromflomites'),
    ],
    outro: [['Rick', 'Ship shaken, and the raid’s haul is ours. They’ll be back. They always come back.']],
    unlocks: ['needful', 'vat', 'nimbus'],
  },
  {
    id: 'deals',
    title: 'Bad deals',
    intro: [['Rick', 'Some backups changed hands. A shop that sells curses and a man who sells deaths. A normal Tuesday.']],
    steps: [
      task('needful', 'Needful Things has something of Rick’s. Take it, and nothing cursed.', 'needful'),
      task('vat', 'Dial the vat of acid and sell the fake death.', 'vat'),
    ],
    outro: [['Morty', 'Nothing cursed and nobody dead. I think that counts as a good deal.']],
    unlocks: ['jerryboree', 'gloopynoops', 'prison'],
  },
  {
    id: 'jerry',
    title: 'The Jerry problem',
    intro: [['Morty', 'Rick hid a set on Dad. Dad’s at the Jerryboree, and the rest of it’s at a hospital. Of course it is.']],
    steps: [
      task('jerryboree', 'Dad’s at the Jerryboree, with a lot of other Dads. Find ours.', 'jerryboree'),
      task('gloopynoops', 'Dial St. Gloopy Noops and take back what’s Jerry’s.', 'gloopynoops'),
    ],
    outro: [['Rick', 'Your father carried coordinates for a year and never noticed. The perfect courier.']],
    unlocks: ['cablestudio', 'schwifty', 'dream'],
  },
  {
    id: 'primetime',
    title: 'Prime time',
    intro: [['Rick', 'Two sets went out on television: one on a cable channel, one in a song the Cromulons want to hear.']],
    steps: [
      task('cablestudio', 'Dial the cable studio and get every channel on before it goes live.', 'cablestudio'),
      task('schwifty', 'The Cromulons want a hit. Dial the Get Schwifty show and give them one.', 'schwifty'),
    ],
    outro: [['Morty', 'We were on TV in every dimension, Rick. Mom’s going to have questions.']],
    unlocks: ['fantasy', 'froopyland', 'dim35c'],
  },
  {
    id: 'fairytales',
    title: 'Fairy tales',
    intro: [['Rick', 'Two sets are in places past me thought were funny: a fairy-tale kingdom and a playground that bites.']],
    steps: [
      task('fantasy', 'Dial Fantasy World and climb the beanstalk to the giants.', 'fantasy'),
      task('froopyland', 'Dial Froopyland and get to Tommy past the Froopylanders.', 'froopyland'),
    ],
    outro: [['Rick', 'Giants, beanstalks and Froopyland. Next stop had better make sense.']],
    unlocks: ['citadel', 'frundles'],
  },
  {
    id: 'citadel',
    title: 'The Citadel',
    intro: [['Rick', 'The Council of Ricks took a set for “safekeeping”. We’re going to the Citadel, Morty. Act natural.']],
    steps: [
      { type: 'enter', area: 'page:/c-137/citadel', place: 'citadel', text: 'Dial the Citadel. The Council has a set of coordinates, and opinions.' },
      { type: 'citadel', id: 'citadelout', text: 'Get through the Citadel’s business, then out past the Cop Ricks.' },
    ],
    outro: [['Morty', 'Every Rick there is, in one place, and you were still the worst at following the rules.']],
    unlocks: ['birdworld', 'gearworld', 'pluto', 'squanch'],
  },
  {
    id: 'sector',
    title: 'The sector',
    intro: [['Rick', 'Four sets, four planets in the sector, and Birdperson on one of them. Dial them in any order.']],
    steps: [
      {
        type: 'all',
        text: 'Four sets are out on the sector’s planets. Dial each one.',
        steps: [
          task('birdworld', 'Bird World: the crystals in the grass.', 'birdworld'),
          task('gearworld', 'Gear World: the city’s cogs.', 'gearworld'),
          task('pluto', 'Pluto: tell the king what he wants to hear.', 'pluto'),
          task('squanch', 'Planet Squanch: get out in time.', 'squanch'),
        ],
      },
    ],
    outro: [['Morty', 'Four planets in one go. I know the sector better than I know my own school.']],
    unlocks: ['heistcon', 'vindicators'],
  },
  {
    id: 'bigscore',
    title: 'Big score',
    intro: [['Rick', 'The last sets are held by people who rob for a living and people who save the world for a living. Same thing.']],
    steps: [
      task('heistcon', 'Dial Heist-Con and run the job.', 'heistcon'),
      task('vindicators', 'Dial the Vindicators and answer for it.', 'vindicators'),
    ],
    outro: [['Rick', 'Job done, Vindicators answered. One stop left, and it’s a bad one.']],
    unlocks: ['blooddome', 'evilrick'],
  },
  {
    id: 'evilrick',
    title: 'Evil Rick',
    intro: [['Morty', 'Everything leads to one lair, and a Rick who thinks he’s the only Rick that matters.']],
    steps: [
      task('blooddome', 'Dial the Blood Dome and win.', 'blooddome'),
      task('evilrick', 'Dial Evil Rick’s lair and beat him.', 'evilrick'),
      task('evilmorty', 'Talk to the Morty at the lair.', 'evilrick'),
      { type: 'use', id: 'dial', text: 'Take the gun home and put it back on Rick’s bench.' },
    ],
    outro: [['Rick', 'Every coordinate home, Morty. The gun’s whole again. Try not to make me need backups.']],
    unlocks: [],
  },
];
