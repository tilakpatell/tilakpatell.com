// Recorded clips the site plays at its big moments. They live in
// public/audio/clips/ (see the README there for where each came from), are
// decoded once, and play through the site's master volume, so the sound
// setting mutes them like everything else. Call this from a click or key press.
//
// A clip belongs to the page that played it and stops when the visitor leaves
// (App calls stopPageClips on every route change). `keep` lets one run on
// across pages: the theme switches, the jump to lightspeed, "say my name".

import { audioContext, loadBuffer, output, voiceOutput, whenRunning } from './audio';
import { speech } from './speech';

export const CLIPS = {
  vader: { src: '/audio/clips/i-am-your-father.mp3', line: 'No, I am your father.', by: 'Darth Vader' },
  starWars: { src: '/audio/clips/star-wars-theme.mp3', line: 'Main Title', by: 'John Williams' },
  binarySunset: { src: '/audio/clips/binary-sunset.mp3', line: 'Binary Sunset', by: 'John Williams' },
  hyperspaceEnter: { src: '/audio/clips/hyperspace-enter.mp3' },
  hyperspaceExit: { src: '/audio/clips/hyperspace-exit.mp3' },
  useTheForce: { src: '/audio/clips/use-the-force-luke.mp3', line: 'Use the Force, Luke.', by: 'Obi-Wan Kenobi' },
  transform: { src: '/audio/clips/transform.mp3' },
  freedom: { src: '/audio/clips/freedom.mp3', line: 'Freedom', by: 'Transformers' },
  soUnwise: { src: '/audio/clips/so-unwise.mp3', line: 'So unwise', by: 'Transformers' },
  die: { src: '/audio/clips/die.mp3', line: 'Die', by: 'Transformers' },
  sayMyName: { src: '/audio/clips/say-my-name.mp3', line: 'Say my name.', by: 'Walter White' },
  bbIntro: { src: '/audio/clips/breaking-bad-intro.mp3', line: 'Breaking Bad, the opening', by: 'Breaking Bad' },
  hectorBell: { src: '/audio/clips/hector-bell.mp3', line: 'Ding.', by: 'Hector Salamanca' },
  faceOff: { src: '/audio/clips/face-off.mp3', line: 'Face Off', by: 'Breaking Bad' },
  gusHello: { src: '/audio/clips/gus-hello.mp3', line: 'Hello, and welcome to the Los Pollos Hermanos family. My name is Gustavo, but you can call me Gus.', by: 'Gus Fring' },
  jesseRing: { src: '/audio/clips/jesse-ringtone.mp3', line: 'Yo, one four eight three to the three to the six to the nine, representin’ the ABQ.', by: 'Jesse Pinkman' },
  saulHi: { src: '/audio/clips/hi-im-saul.mp3', line: 'Hi, I’m Saul Goodman. Did you know that you have rights?', by: 'Saul Goodman' },
  tight: { src: '/audio/clips/tuco-tight.mp3', line: 'Tight, tight, tight!', by: 'Tuco Salamanca' },
  hankRing: { src: '/audio/clips/hank-ringtone.mp3', line: 'Hank’s phone', by: 'Hank Schrader' },
  callSaul: { src: '/audio/clips/better-call-saul.mp3', line: 'Better call Saul!', by: 'Saul Goodman' },
  twss: { src: '/audio/clips/thats-what-she-said.mp3', line: 'That’s what she said.', by: 'Michael Scott' },
  snap: { src: '/audio/clips/snap.mp3' },
  marvel: { src: '/audio/clips/marvel-opening.mp3', line: 'The Marvel Studios opening', by: 'Marvel Studios' },
  lotr: { src: '/audio/clips/lotr-theme.mp3', line: 'The Lord of the Rings', by: 'Howard Shore' },
  kingsArrival: { src: '/audio/clips/kings-arrival.mp3', line: 'The Return of the King', by: 'Howard Shore' },
  pirates: { src: '/audio/clips/pirates-theme.mp3', line: 'Pirates of the Caribbean, the theme', by: 'Pirates of the Caribbean' },
  officeTheme: { src: '/audio/clips/office-theme.mp3', line: 'The Office, the theme', by: 'The Office' },
  thankYou: { src: '/audio/clips/thank-you.mp3', line: 'Thank you.', by: 'Michael Scott' },
  noGod: { src: '/audio/clips/no-god.mp3', line: 'No, God! No, God, please, no!', by: 'Michael Scott' },
  tanpura: { src: '/audio/tanpura-pluck.mp3' }, // the music room's own (freely licensed, credited there)
  // the universe map's boosts (public/audio/engines, credited there)
  xwingPass: { src: '/audio/engines/xwing-pass.mp3' },
  falconPass: { src: '/audio/engines/falcon-pass.mp3' },
  thruster: { src: '/audio/engines/thruster.mp3' },
  // the universe map's crews and ships
  wubba: { src: '/audio/clips/wubba-lubba-dub-dub.mp3', line: 'Wubba lubba dub dub!', by: 'Rick Sanchez' },
  pickleRick: { src: '/audio/clips/pickle-rick.mp3', line: 'I’m Pickle Rick!', by: 'Rick Sanchez' },
  riggity: { src: '/audio/clips/riggity-wrecked-son.mp3', line: 'Riggity riggity wrecked, son!', by: 'Rick Sanchez' },
  meeseeks: { src: '/audio/clips/im-mr-meeseeks.mp3', line: 'I’m Mr. Meeseeks! Look at me!', by: 'Mr. Meeseeks' },
  portalGun: { src: '/audio/clips/portal-gun.mp3' },
  cool: { src: '/audio/clips/cool.mp3', line: 'Coool.' },
  cantTakeIt: { src: '/audio/clips/cant-take-it-anymore.mp3', line: 'I can’t take it anymore. I just wanna die.' },
  lickLick: { src: '/audio/clips/lick-lick.mp3', line: 'Lick, lick, lick my balls! Ha ha! Yeah! Say that all the time!', by: 'Rick Sanchez' },
  chewieRoar: { src: '/audio/clips/chewie-roar.mp3' },
  chewieLaugh: { src: '/audio/clips/chewie-laugh.mp3' },
  dl44: { src: '/audio/clips/dl-44.mp3' },
  ohShit: { src: '/audio/clips/oh-shit.mp3', line: 'Oh shit, mother—' },
  // Star Wars: the Death Star's readout, the trench run, the X-wing and the Falcon
  lackOfFaith: { src: '/audio/clips/lack-of-faith.mp3', line: 'I find your lack of faith disturbing.', by: 'Darth Vader' },
  fireWhenReady: { src: '/audio/clips/fire-when-ready.mp3', line: 'You may fire when ready.', by: 'Grand Moff Tarkin' },
  noMoon: { src: '/audio/clips/thats-no-moon.mp3', line: 'That’s no moon. It’s a space station.', by: 'Obi-Wan Kenobi' },
  forceAlways: { src: '/audio/clips/the-force-will-be-with-you.mp3', line: 'The Force will be with you. Always.', by: 'Obi-Wan Kenobi' },
  shortStormtrooper: { src: '/audio/clips/short-for-a-stormtrooper.mp3', line: 'Aren’t you a little short for a stormtrooper?', by: 'Princess Leia' },
  stayOnTarget: { src: '/audio/clips/stay-on-target.mp3', line: 'Stay on target.', by: 'Gold Five' },
  mayTheForce: { src: '/audio/clips/may-the-force-be-with-you.mp3', line: 'May the Force be with you.', by: 'Han Solo' },
  dontGetCocky: { src: '/audio/clips/dont-get-cocky.mp3', line: 'Great, kid! Don’t get cocky!', by: 'Han Solo' },
  helpMeObiWan: { src: '/audio/clips/help-me-obi-wan-kenobi.mp3', line: 'Help me, Obi-Wan Kenobi. You’re my only hope.', by: 'Princess Leia' },
  forceIsStrong: { src: '/audio/clips/force-is-strong.mp3', line: 'The Force is strong with this one.', by: 'Darth Vader' },
  almostThere: { src: '/audio/clips/almost-there.mp3', line: 'Almost there.', by: 'Red Leader' },
  itsATrap: { src: '/audio/clips/its-a-trap.mp3', line: 'It’s a trap!', by: 'Admiral Ackbar' },
  neverTellOdds: { src: '/audio/clips/never-tell-me-the-odds.mp3', line: 'Never tell me the odds.', by: 'Han Solo' },
  badFeelingLuke: { src: '/audio/clips/bad-feeling-luke.mp3', line: 'I have a very bad feeling about this.', by: 'Luke Skywalker' },
  badFeelingHan: { src: '/audio/clips/bad-feeling-han.mp3', line: 'I got a bad feeling about this.', by: 'Han Solo' },
  notTheDroids: { src: '/audio/clips/not-the-droids.mp3', line: 'These aren’t the droids you’re looking for.', by: 'Obi-Wan Kenobi' },
  doOrDoNot: { src: '/audio/clips/do-or-do-not.mp3', line: 'Do. Or do not. There is no try.', by: 'Yoda' },
  r2Whistle: { src: '/audio/clips/r2-whistle.mp3', by: 'R2-D2' },
  r2Scream: { src: '/audio/clips/r2-scream.mp3', by: 'R2-D2' },
  saberOn: { src: '/audio/clips/lightsaber-on.mp3' },
  tieScream: { src: '/audio/clips/tie-fighter.mp3' },
  imperialMarch: { src: '/audio/clips/imperial-march.mp3', line: 'The Imperial March', by: 'John Williams' },
  // Dimension C-137
  canDo: { src: '/audio/clips/can-do.mp3', line: 'Ooh, yeah! Can do!', by: 'Mr. Meeseeks' },
  showMe: { src: '/audio/clips/show-me-what-you-got.mp3', line: 'Show me what you got!', by: 'The Cromulon' },
  disqualified: { src: '/audio/clips/disqualified.mp3', line: 'Disqualified!', by: 'The Cromulon' },
  likeWhatYouGot: { src: '/audio/clips/i-like-what-you-got.mp3', line: 'I like what you got!', by: 'The Cromulon' },
  purpose: { src: '/audio/clips/what-is-my-purpose.mp3', line: 'What is my purpose?', by: 'The butter robot' },
  myMan: { src: '/audio/clips/my-man.mp3', line: 'My man.', by: 'Rick Sanchez' },
  birdCulture: { src: '/audio/clips/bird-culture.mp3', line: 'In bird culture, this is considered a dick move.', by: 'Birdperson' },
  imIn: { src: '/audio/clips/im-in.mp3', line: 'You son of a bitch. I’m in.', by: 'Rick Sanchez' },
  krombopulos: { src: '/audio/clips/here-i-go-killing-again.mp3', line: 'Oh boy, here I go killin’ again.', by: 'Krombopulos Michael' },
  oooWee: { src: '/audio/clips/ooo-wee.mp3', line: 'Ooo-wee!', by: 'Mr. Poopybutthole' },
  scaryTerry: { src: '/audio/clips/scary-terry.mp3', line: 'You can run, but you can’t hide, bitch!', by: 'Scary Terry' },
  schwifty: { src: '/audio/clips/get-schwifty.mp3', line: 'Oh yeah, you gotta get schwifty, you gotta get schwifty in here', by: 'Rick and Morty' },
  // Middle-earth
  youShallNotPass: { src: '/audio/clips/you-shall-not-pass.mp3', line: 'You shall not pass!', by: 'Gandalf' },
  flyYouFools: { src: '/audio/clips/fly-you-fools.mp3', line: 'Fly, you fools!', by: 'Gandalf' },
  wizardLate: { src: '/audio/clips/wizard-is-never-late.mp3', line: 'A wizard is never late, Frodo Baggins. Nor is he early. He arrives precisely when he means to.', by: 'Gandalf' },
  gandalfRun: { src: '/audio/clips/this-foe-is-beyond-any-of-you.mp3', line: 'This foe is beyond any of you. Run!', by: 'Gandalf' },
  secondBreakfast: { src: '/audio/clips/second-breakfast.mp3', line: 'What about second breakfast?', by: 'Pippin' },
  oneRing: { src: '/audio/clips/one-ring.mp3', line: 'One Ring to rule them all.', by: 'The prologue' },
  myPrecious: { src: '/audio/clips/my-precious.mp3', line: 'My precious!', by: 'Gollum' },
  nobodyLikesYou: { src: '/audio/clips/nobody-likes-you.mp3', line: 'Master’s my friend. You don’t have any friends. Nobody likes you.', by: 'Sméagol and Gollum' },
  andMyAxe: { src: '/audio/clips/and-my-axe.mp3', line: 'And my axe!', by: 'Gimli' },
  findYouABox: { src: '/audio/clips/find-you-a-box.mp3', line: 'Shall I describe it to you? Or would you like me to find you a box?', by: 'Legolas' },
  meatsBack: { src: '/audio/clips/meats-back-on-the-menu.mp3', line: 'Looks like meat’s back on the menu, boys!', by: 'Uglúk' },
  taskAppointed: { src: '/audio/clips/task-appointed-to-you.mp3', line: 'This task was appointed to you. And if you do not find a way, no one will.', by: 'Galadriel' },
  worldIsChanged: { src: '/audio/clips/the-world-is-changed.mp3', line: 'The world is changed. I feel it in the water. I feel it in the earth. I smell it in the air.', by: 'Galadriel' },
  carryYou: { src: '/audio/clips/i-can-carry-you.mp3', line: 'I can’t carry it for you, but I can carry you!', by: 'Samwise Gamgee' },
  bowToNoOne: { src: '/audio/clips/you-bow-to-no-one.mp3', line: 'You bow to no one.', by: 'Aragorn' },
  nazgul: { src: '/audio/clips/nazgul-scream.mp3' },
  // the Caribbean
  rumGone: { src: '/audio/clips/why-is-the-rum-always-gone.mp3', line: 'Why is the rum always gone?', by: 'Captain Jack Sparrow' },
  almostCaught: { src: '/audio/clips/almost-caught-captain-jack-sparrow.mp3', line: 'Gentlemen, m’lady, you will always remember this as the day that you almost caught Captain Jack Sparrow.', by: 'Captain Jack Sparrow' },
  heardOfMe: { src: '/audio/clips/but-you-have-heard-of-me.mp3', line: 'You are without doubt the worst pirate I’ve ever heard of. But you have heard of me.', by: 'Norrington and Jack Sparrow' },
  madness: { src: '/audio/clips/madness-or-brilliance.mp3', line: 'This is either madness or brilliance. It’s remarkable how often those two traits coincide.', by: 'Will Turner and Jack Sparrow' },
  welcomeCaribbean: { src: '/audio/clips/welcome-to-the-caribbean.mp3', line: 'Welcome to the Caribbean, love.', by: 'Captain Jack Sparrow' },
  takeWhatYouCan: { src: '/audio/clips/take-what-you-can.mp3', line: 'Take what you can! Give nothing back!', by: 'Jack Sparrow and the crew' },
  fearDeath: { src: '/audio/clips/do-you-fear-death.mp3', line: 'Do you fear death?', by: 'Davy Jones' },
  afterlife: { src: '/audio/clips/why-should-the-afterlife.mp3', line: 'Life is cruel. Why should the afterlife be any different?', by: 'Davy Jones' },
  jarOfDirt: { src: '/audio/clips/jar-of-dirt.mp3', line: 'I’ve got a jar of dirt! I’ve got a jar of dirt, and guess what’s inside it?', by: 'Captain Jack Sparrow' },
  notGood: { src: '/audio/clips/not-good.mp3', line: 'No! Not good! Stop! Not good!', by: 'Captain Jack Sparrow' },
  bugger: { src: '/audio/clips/oh-bugger.mp3', line: 'Oh, bugger.', by: 'Captain Jack Sparrow' },
  didEveryoneSee: { src: '/audio/clips/did-everyone-see-that.mp3', line: 'Did everyone see that? Because I will not be doing it again.', by: 'Captain Jack Sparrow' },
  withoutRum: { src: '/audio/clips/without-a-drop-of-rum.mp3', line: 'And that was without even a single drop of rum.', by: 'Captain Jack Sparrow' },
  drinkUp: { src: '/audio/clips/drink-up-me-hearties.mp3', line: 'Drink up, me hearties, yo ho!', by: 'Jack and Elizabeth' },
  // Scranton
  parkour: { src: '/audio/clips/parkour.mp3', line: 'Parkour!', by: 'Gossip, the cold open' },
  undercookOnions: { src: '/audio/clips/undercook-the-onions.mp3', line: 'The trick is to undercook the onions.', by: 'Kevin Malone' },
  didIStutter: { src: '/audio/clips/did-i-stutter.mp3', line: 'Did I stutter?', by: 'Stanley Hudson' },
  dwightPunish: { src: '/audio/clips/dwight-punish.mp3', line: 'All right! Who did this? I’m not mad. I just want to know who did it so I can punish them.', by: 'Dwight Schrute' },
  bearsBeets: { src: '/audio/clips/bears-beets-battlestar-galactica.mp3', line: 'Bears. Beets. Battlestar Galactica.', by: 'Jim Halpert, as Dwight' },
  identityTheft: { src: '/audio/clips/identity-theft.mp3', line: 'Identity theft is not a joke, Jim! Millions of families suffer every year!', by: 'Dwight Schrute' },
  whyAreYou: { src: '/audio/clips/why-are-you-the-way-that-you-are.mp3', line: 'Why are you the way that you are?', by: 'Michael Scott' },
  bankruptcy: { src: '/audio/clips/i-declare-bankruptcy.mp3', line: 'I declare bankruptcy!', by: 'Michael Scott' },
  boomRoasted: { src: '/audio/clips/boom-roasted.mp3', line: 'Boom. Roasted.', by: 'Michael Scott' },
  littleStitious: { src: '/audio/clips/little-stitious.mp3', line: 'I’m not superstitious, but I am a little stitious.', by: 'Michael Scott' },
  fireDrill: { src: '/audio/clips/fire-drill.mp3', line: 'Oh my God! Okay, it’s happening! Everybody stay calm!', by: 'Michael Scott' },
  beyonceAlways: { src: '/audio/clips/beyonce-always.mp3', line: 'I’m Beyoncé. I am Beyoncé, always.', by: 'Michael Scott' },
  insideJokes: { src: '/audio/clips/inside-jokes.mp3', line: 'I love inside jokes. Love to be a part of one someday.', by: 'Michael Scott' },
  prisonMike: { src: '/audio/clips/prison-mike.mp3', line: 'I’m Prison Mike!', by: 'Michael Scott' },
  ignorantSlut: { src: '/audio/clips/dwight-you-ignorant-slut.mp3', line: 'Dwight, you ignorant slut!', by: 'Michael Scott' },
  pamGamble: { src: '/audio/clips/pam-gamble.mp3', line: 'I suggested we flip a coin, but Angela said she doesn’t like to gamble. Of course, by saying that, she was gambling that I wouldn’t smack her.', by: 'Pam Beesly' },
  likeToBeLiked: { src: '/audio/clips/like-to-be-liked.mp3', line: 'Do I need to be liked? Absolutely not. I like to be liked. I enjoy being liked. I have to be liked.', by: 'Michael Scott' },
  // Cybertron
  autobotsRollOut: { src: '/audio/clips/autobots-roll-out.mp3', line: 'Autobots, roll out!', by: 'Optimus Prime' },
  iAmOptimusPrime: { src: '/audio/clips/i-am-optimus-prime.mp3', line: 'I am Optimus Prime.', by: 'Optimus Prime' },
  oneShallStand: { src: '/audio/clips/one-shall-stand.mp3', line: 'One shall stand, one shall fall.', by: 'Optimus Prime' },
  soundwaveSuperior: { src: '/audio/clips/soundwave-superior.mp3', line: 'Soundwave superior. Autobots inferior.', by: 'Soundwave' },
  megatronPrime: { src: '/audio/clips/megatron-prime.mp3', line: 'Megatron! Prime!', by: 'Optimus Prime and Megatron' },
  youAndMeMegatron: { src: '/audio/clips/its-you-and-me-megatron.mp3', line: 'It’s you and me, Megatron!', by: 'Optimus Prime' },
  myNameIsOptimusPrime: { src: '/audio/clips/my-name-is-optimus-prime.mp3', line: 'My name is Optimus Prime. We are autonomous robotic organisms from the planet Cybertron.', by: 'Optimus Prime' },
  bumblebeeBrave: { src: '/audio/clips/bumblebee-brave-soldier.mp3', line: 'Bumblebee is a brave soldier. This is what he would want.', by: 'Optimus Prime' },
  moreThanMeetsTheEye: { src: '/audio/clips/more-than-meets-the-eye.mp3', line: 'Like us, there’s more to them than meets the eye.', by: 'Optimus Prime' },
  weAreWaiting: { src: '/audio/clips/we-are-here-we-are-waiting.mp3', line: 'We are here. We are waiting.', by: 'Optimus Prime' },
  relieveWeapons: { src: '/audio/clips/autobots-relieve-them-of-their-weapons.mp3', line: 'Autobots, relieve them of their weapons!', by: 'Optimus Prime' },
  // Avengers HQ
  ironMan: { src: '/audio/clips/i-am-iron-man.mp3', line: 'I am Iron Man.', by: 'Tony Stark' },
  avengersAssemble: { src: '/audio/clips/avengers-assemble.mp3', line: 'Avengers… assemble.', by: 'Steve Rogers' },
  iAmInevitable: { src: '/audio/clips/i-am-inevitable.mp3', line: 'I am… inevitable.', by: 'Thanos' },
  canDoThisAllDay: { src: '/audio/clips/i-can-do-this-all-day.mp3', line: 'I could do this all day.', by: 'Steve Rogers' },
  iAmGroot: { src: '/audio/clips/i-am-groot.mp3', line: 'I am Groot.', by: 'Groot' },
  hulkSmash: { src: '/audio/clips/hulk-smash.mp3', line: 'Hulk smash!', by: 'Hulk' },
  punyGod: { src: '/audio/clips/puny-god.mp3', line: 'Puny god.', by: 'Hulk' },
  weHaveAHulk: { src: '/audio/clips/we-have-a-hulk.mp3', line: 'I have an army. We have a Hulk.', by: 'Loki and Tony Stark' },
  mrStark: { src: '/audio/clips/mr-stark-i-dont-feel-so-good.mp3', line: 'Mr. Stark… I don’t feel so good.', by: 'Peter Parker' },
  wakandaForever: { src: '/audio/clips/wakanda-forever.mp3', line: 'Wakanda forever!', by: 'T’Challa' },
  salvation: { src: '/audio/clips/small-price-to-pay-for-salvation.mp3', line: 'A small price to pay for salvation.', by: 'Thanos' },
  doItMyself: { src: '/audio/clips/fine-ill-do-it-myself.mp3', line: 'Fine. I’ll do it myself.', by: 'Thanos' },
  heIsAdopted: { src: '/audio/clips/hes-adopted.mp3', line: 'He killed eighty people in two days. He’s adopted.', by: 'Natasha Romanoff and Thor' },
  hulkRoar: { src: '/audio/clips/hulk-roar.mp3', by: 'Hulk' },
  // Albuquerque
  yeahScience: { src: '/audio/clips/yeah-science.mp3', line: 'Yeah, Mr. White! Yeah, science!', by: 'Jesse Pinkman' },
  oneWhoKnocks: { src: '/audio/clips/one-who-knocks.mp3', line: 'I am the one who knocks.', by: 'Walter White' },
  theDanger: { src: '/audio/clips/i-am-the-danger.mp3', line: 'I am not in danger, Skyler. I am the danger.', by: 'Walter White' },
  waltAddress: { src: '/audio/clips/walter-hartwell-white.mp3', line: 'My name is Walter Hartwell White. I live at 308 Negra Arroyo Lane, Albuquerque, New Mexico.', by: 'Walter White' },
  killedGus: { src: '/audio/clips/killed-gus-fring.mp3', line: 'I’m the man who killed Gus Fring.', by: 'Walter White' },
  goddamnRight: { src: '/audio/clips/youre-goddamn-right.mp3', line: 'You’re goddamn right.', by: 'Walter White' },
  needToCook: { src: '/audio/clips/we-need-to-cook.mp3', line: 'Jesse, we need to cook.', by: 'Walter White' },
  domicile: { src: '/audio/clips/private-domicile.mp3', line: 'This is my own private domicile and I will not be harassed, bitch!', by: 'Jesse Pinkman' },
  gettingAway: { src: '/audio/clips/cant-keep-getting-away.mp3', line: 'He can’t keep getting away with it!', by: 'Jesse Pinkman' },
  dontDrinkDrive: { src: '/audio/clips/dont-drink-and-drive.mp3', line: 'Don’t drink and drive, but if you do, call me.', by: 'Saul Goodman' },
};

const playing = new Set();

// Stops every clip that belongs to the page being left, and any line still
// waiting to be said on it.
export function stopPageClips() {
  playing.forEach((h) => !h.keep && h.stop());
  speech.stopPage();
}

// Plays a clip. `offset` skips into it, `duration` cuts it short with a fade,
// `voice` sends it through the voice tap (lib/audio.js) so a speaker's face
// can move its mouth with it, and makes it speech: it takes its turn on the
// one floor (lib/speech.js, `mode` and `tag` as there), so no two voices
// are ever heard at once.
// Resolves to { stop(), ended, length } (length in seconds) or null if it
// can't play (no Web Audio, the file didn't load, or a voice that isn't said
// after all), so callers can fall back to something else.
export function playClip(id, opts) {
  const clip = CLIPS[id];
  if (!clip) {
    audioContext();
    return Promise.resolve(null);
  }
  return playFile(clip.src, opts);
}

// The same for any file: a crew's generated line (lib/voiced.js), say.
export function playFile(src, opts = {}) {
  if (!opts.voice) return start(src, opts);
  const { mode, tag, keep } = opts;
  return speech.say(src, (alive) => start(src, opts, alive), { mode, tag, keep });
}

async function start(src, { offset = 0, when = 0, duration, gain = 1, keep = false, voice = false } = {}, alive = () => true) {
  const ac = audioContext(); // first, while still inside the gesture
  if (!ac || !src) return null;
  let buf;
  try {
    buf = await loadBuffer(src);
  } catch {
    return null;
  }
  if (!buf) return null;
  // a voice waits for the sound to be running (or isn't said), and isn't
  // started at all once something else has the floor
  if (voice && !(await whenRunning(ac, 1500))) return null;
  if (!alive()) return null;
  const node = ac.createBufferSource();
  node.buffer = buf;
  const g = ac.createGain();
  const t = ac.currentTime + when;
  g.gain.setValueAtTime(gain, t);
  if (duration) {
    g.gain.setValueAtTime(gain, t + Math.max(0, duration - 0.35));
    g.gain.linearRampToValueAtTime(0.0001, t + duration);
  }
  node.connect(g).connect(voice ? voiceOutput() : output());
  node.start(t, offset, duration);
  let handle = null;
  const ended = new Promise((resolve) => {
    node.onended = () => {
      playing.delete(handle);
      resolve();
    };
  });
  let stopped = false;
  handle = {
    ended,
    keep,
    length: Math.max(0, (duration ?? buf.duration - offset) || 0),
    stop() {
      if (stopped) return;
      stopped = true;
      const now = ac.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0.0001, now + 0.12);
      try {
        node.stop(now + 0.14);
      } catch {
        /* already stopped */
      }
    },
  };
  playing.add(handle);
  return handle;
}
