import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { local, storage } from '../lib/hooks';
import { useTheme } from '../theme/ThemeProvider';
import { FAN_THEMES, THEMES, THEME_ORDER } from '../theme/themes';
import { partsUnlockedBy } from './universe/outfit';
import { paintsFor } from './universe/paint';
import { useTouring } from './tour/useTouring';
import Gif from './Gif';
import { worldAt } from './worlds/worlds';

// eslint-disable-next-line react-refresh/only-export-components
export const ACHIEVEMENTS = {
  explorer: { name: 'Explorer', desc: 'Visited every page' },
  hacker: { name: 'Slicer', desc: 'Opened the Imperial terminal' },
  order66: { name: 'Contingency', desc: 'Executed Order 66' },
  konami: { name: 'Cheat code', desc: 'Entered the Konami code' },
  tour: { name: 'Shown around', desc: 'Took the tour of the site' },
  tourRecruiter: { name: 'Shown the work', desc: 'Took the hiring tour' },
  tourPlayer: { name: 'Shown the ropes', desc: 'Took the player’s tour' },
  deathstar: { name: 'Fully operational', desc: 'Found the Death Star plans' },
  'ds-aboard': { name: 'Boarding party', desc: 'Came aboard the Death Star' },
  // Aboard the Death Star (deathstar/inside): its twenty Easter eggs, worded as its rules/eggs.js words them so the toast says what the egg says
  // (its rules/achievements.test.js keeps the two in step), then its four stories, one for each station and side
  'ds-bonk': { name: 'Mind your head', desc: 'Watched a stormtrooper bang his head on a door frame in Docking Control 327' },
  'ds-tk421': { name: 'Not at his post', desc: 'Took TK-421’s armour' },
  'ds-g7': { name: 'Fastest in the fleet', desc: 'Kept up with G7 for a whole lap of the Level 5 corridors' },
  'ds-roar': { name: 'Scaredy droid', desc: 'Sent a mouse droid fleeing with a roar' },
  'ds-1138': { name: 'Prisoner transfer', desc: 'Brought a prisoner across from cell block 1138' },
  'ds-3263827': { name: 'Mashers off', desc: 'Dialled 3263827 on the compactor’s hatch' },
  'ds-boring': { name: 'Boring conversation anyway', desc: 'Saw Han’s chat on the intercom through to the end' },
  'ds-short': { name: 'A little short', desc: 'Opened cell 2187 with your helmet on' },
  'ds-krennic': { name: 'Seat’s free', desc: 'Sat in Krennic’s empty chair at the conference table' },
  'ds-faith': { name: 'Lack of faith', desc: 'Talked back to Vader in the conference room and got off with a choke' },
  'ds-eyestalk': { name: 'Something’s alive in here', desc: 'Stared down the dianoga’s eyestalk' },
  'ds-librarian': { name: 'Overdue', desc: 'Caught the librarian on the archive’s security feed' },
  'ds-robe': { name: 'Nothing but the robe', desc: 'Found the robe on the floor of Bay 327' },
  'ds-armrest': { name: 'Within arm’s reach', desc: 'Pulled Luke’s lightsaber from the throne’s armrest' },
  'ds-trap': { name: 'Admiral’s hunch', desc: 'Heard “It’s a trap!” in the command centre’s chatter' },
  'ds-moff': { name: 'Moff by rank', desc: 'Read Jerjerrod’s nameplate, which calls him Moff' },
  'ds-charge': { name: 'Han’s charge', desc: 'Chased a squad down a corridor and met the rest of the platoon coming back' },
  'ds-port': { name: 'Two metres wide', desc: 'Read the maintenance note on the thermal exhaust port' },
  'ds-plans': { name: 'Technical readout', desc: 'Opened the Death Star plans at a terminal' },
  'ds-droids': { name: 'Not the droids', desc: 'Talked two guards into saying these aren’t the droids you’re looking for' },
  'ds-ds1-rebel': { name: 'That’s no moon', desc: 'Got Leia out of the first Death Star and away on the Falcon' },
  'ds-ds1-imperial': { name: 'Intruder alert', desc: 'Let the Falcon go, as Vader ordered, with a homing beacon on its hull' },
  'ds-ds2-rebel': { name: 'The Emperor’s Tower', desc: 'Faced the Emperor in his tower, and carried Vader to a shuttle before the reactor went' },
  'ds-ds2-imperial': { name: 'Fully armed and operational', desc: 'Stood in the ranks for the Emperor, fired at will, and got off the second Death Star before it went' },
  trench: { name: 'Use the Force', desc: 'Hit the exhaust port in the trench run' },
  rebels: { name: 'Medal of Yavin', desc: 'Saved Yavin 4 in the Battle of Yavin' },
  empire: { name: 'Fear will keep them in line', desc: 'Let the Empire win at Yavin' },
  resume: { name: 'Recruited', desc: 'Opened the résumé' },
  cartographer: { name: 'Cartographer', desc: 'Saw all six company themes' },
  player: { name: 'High score', desc: 'Collected 10 coins on the Game Boy' },
  castle: { name: 'Super Tilak', desc: 'Beat the king of the castle on the Game Boy' },
  tetris: { name: 'Four at once', desc: 'Cleared four lines at once in Block Drop' },
  aurebesh: { name: 'Linguist', desc: 'Read Aurebesh' },
  polyglot: { name: 'Polyglot', desc: 'Read the site in Aurebesh, Cybertronian and Dwarf runes' },
  heisenberg: { name: 'Heisenberg', desc: 'Said my name' },
  bluesky: { name: 'Blue Sky', desc: 'Served a 95% order at Walt’s Metherria' },
  purity: { name: '99.1% pure', desc: 'Found all twelve Blue Sky crystals in the Albuquerque desert' },
  snap: { name: 'Perfectly balanced', desc: 'Snapped half the page away' },
  dundie: { name: 'Dundie winner', desc: 'That’s what she said' },
  raga: { name: 'Raga', desc: 'Played eight notes on the sitar' },
  jugalbandi: { name: 'Jugalbandi', desc: 'Played the sitar, harmonium and tabla' },
  rollout: { name: 'Roll out', desc: 'Transformed the site' },
  savvy: { name: 'Savvy?', desc: 'Hoisted the colours: the site went pirate' },
  groundbridge: { name: 'Bridge them back', desc: 'Brought all of Team Prime home through the ground bridge' },
  cyHoldGates: { name: 'Hold the line', desc: 'Held Iacon’s gate against three waves of Decepticons' },
  cyEnergonRun: { name: 'Energon run', desc: 'Fuelled the Ark: eight cubes of energon across Iacon against the clock' },
  cyMetroplex: { name: 'Metroplex, heed the call', desc: 'Drove every one of Metroplex’s beacons and woke him' },
  cyMegatron: { name: 'One shall stand', desc: 'Drove Megatron off Iacon’s space bridge' },
  cyTeamPrime: { name: 'Team Prime', desc: 'Checked in with the whole team at the Autobot base' },
  cyEnergonMine: { name: 'Energon, liberated', desc: 'Cleared the Vehicons out of their mine outside Jasper' },
  cyMatrix: { name: 'Till all are one', desc: 'Took the Matrix of Leadership back from Shockwave in Iacon’s Hall of Records' },
  cyKaonPits: { name: 'Gladiator', desc: 'Won three rounds in the pits of Kaon as Megatron' },
  cyDarkEnergon: { name: 'Fuel the war machine', desc: 'Brought Shockwave eight dark energon before it burned away' },
  cyRunThemDown: { name: 'Run them down', desc: 'Ran down the Autobots in Megatron’s tank' },
  cyZeta: { name: 'Peace through tyranny', desc: 'Defeated Zeta Prime at the gates of Kaon' },
  cyRelic: { name: 'Iacon relic', desc: 'Dug an Iacon relic out of the Nevada desert before the Decepticons could' },
  spacebridge: { name: 'All aboard', desc: 'Brought every Decepticon up to the Nemesis through the space bridge' },
  iacon: { name: 'Archivist', desc: 'Recovered every relic in the Iacon database' },
  'iacon-dcp': { name: 'Spoils of Iacon', desc: 'Recovered every relic in the Iacon database for Lord Megatron' },
  grounded: { name: 'Grounded', desc: 'Brought Starscream down over Jasper in Roll out' },
  onestand: { name: 'One shall stand', desc: 'Beat Megatron in Kaon in Roll out' },
  onefall: { name: 'One shall fall', desc: 'Beat Optimus Prime in Iacon in Roll out, as a Decepticon' },
  wubba: { name: 'Wubba lubba dub dub', desc: 'Got schwifty: the site went portal green' },
  meeseeks: { name: 'Look at me!', desc: 'Summoned a Mr. Meeseeks' },
  showmewhatyougot: { name: 'Show me what you got', desc: 'Beat the Cromulon in Portal panic' },
  peaceamongworlds: { name: 'Peace among worlds', desc: 'Cleared all four dimensions in Portal panic' },
  roy: { name: 'A life well lived', desc: 'Lived a whole life as Roy' },
  royfiftyfive: { name: 'Better than Morty', desc: 'Outlived Morty’s 55 years as Roy' },
  offthegrid: { name: 'Off the grid', desc: 'Took Roy off the grid, like Rick' },
  goldstar: { name: 'Gold star', desc: 'Passed Mr. Goldenfold’s pop quiz' },
  rickall: { name: 'Total Rickall', desc: 'Shot every memory parasite in the Smiths’ living room, and nobody real' },
  wong: { name: 'Family therapy', desc: 'Sat on Dr. Wong’s couch. Rick says it was for Jerry' },
  // the multiverse's destinations, through the garage portal as it's dialled
  customs: { name: 'Nothing to declare', desc: 'Got Rick’s Mega Seeds through Interdimensional Customs, more or less' },
  squanch: { name: 'The wedding squanchers', desc: 'Raised a glass at Birdperson’s wedding and got out when the Federation came' },
  gazorp: { name: 'An exception for a Morty', desc: 'Knocked at the gate of the women’s city on Gazorpazorp' },
  birdworld: { name: 'The time of greeting', desc: 'Knocked at Birdperson’s door on Bird World' },
  fantasy: { name: 'Mind the stairs', desc: 'Got the village’s help in Fantasy World, with a Meeseeks at the well' },
  microverse: { name: 'Batteries all the way down', desc: 'Met Zeep Xanflorp inside the battery of Rick’s car' },
  anatomy: { name: 'Pirates of the Pancreas', desc: 'Made it round Anatomy Park to the last ride' },
  needful: { name: 'Nothing is free', desc: 'Asked Mr. Needful what anything costs' },
  jerryboree: { name: 'The right Jerry', desc: 'Picked our Jerry up from the Jerryboree' },
  purge: { name: 'Out before the purge', desc: 'Pulled the purge siren and got back through the portal inside a minute' },
  pluto: { name: 'Pluto is a planet', desc: 'Said so from the king’s podium' },
  gearworld: { name: 'Everyone’s best friend', desc: 'Said hello to Gearhead in Gear World' },
  vindicators: { name: 'The only one worth a damn', desc: 'Got through Rick’s rooms on the Vindicators’ ship' },
  simulation: { name: 'Two percent CPU', desc: 'Spotted three slips in the Zigerions’ simulation' },
  storytrain: { name: 'Tickets, please', desc: 'Found a ticket on the Story Train before the conductor came' },
  fortress: { name: 'The backup', desc: 'Reached Rick Prime’s console. He’d already gone' },
  froopyland: { name: 'The ABC’s of Beth', desc: 'Found Tommy in Froopyland, past the Froopylanders' },
  nimbus: { name: 'He controls the police', desc: 'Approached Mr. Nimbus on his beach, past the Atlantean guard' },
  gromflomites: { name: 'Oh boy, here I go', desc: 'Opened Fart’s cell in the Gromflomite base without a guard seeing' },
  heistcon: { name: 'The con is the heist', desc: 'Took a badge and recruited a crew for Miles Knightly at Heist-Con' },
  snakeplanet: { name: 'Hsss', desc: 'Reached the snake rocket on Snake Planet without being bitten' },
  nuptia: { name: 'Love, scanned', desc: 'Took the test on Nuptia 4, and kept clear of the mythologs' },
  gloopynoops: { name: 'Visiting hours', desc: 'Visited Shrimply Pibbles at St. Gloopy Noops' },
  resort: { name: 'Out of the field', desc: 'Rode the Whirly Dirly at the Immortality Field Resort' },
  schwifty: { name: 'I like what you got', desc: 'Took the mic at the Get Schwifty show' },
  evilrick: { name: 'Close Rick-counters', desc: 'Freed the dome’s Mortys and beat Evil Rick in his lair' },
  evilmorty: { name: 'The one behind him', desc: 'Spoke to the Morty with the eyepatch before his yellow portal took him' },
  cronenberg: { name: 'Rick Potion #9', desc: 'Took the shovel and spoke to the Beth who stayed in Cronenberg World' },
  blooddome: { name: 'A man now', desc: 'Beat Hemorrhage in the Blood Dome' },
  prison: { name: 'Nine more seasons', desc: 'Sprang Rick from the Brainalyzer without a guard seeing' },
  cablestudio: { name: 'Between takes', desc: 'Watched three channels being made at the cable studio' },
  dream: { name: 'Scary Terry night', desc: 'Found three things in Mr. Goldenfold’s dream with Scary Terry on your heels' },
  agency: { name: 'Pickle Riiick', desc: 'Sprang Jaguar from his cell at the agency' },
  meeseeksgolf: { name: 'Caaan do', desc: 'Pressed the Meeseeks box on the golf course and got home before they got you' },
  vat: { name: 'Bones (fake)', desc: 'Faked your death in Rick’s vat of acid' },
  dim35c: { name: 'Mega Seeds', desc: 'Picked three Mega Seeds in Dimension 35-C' },
  collector: { name: 'Collector', desc: 'Found every hidden easter egg' },
  mellon: { name: 'Speak, friend', desc: 'Said the word that opens the Doors of Durin' },
  balrog: { name: 'You shall not pass', desc: 'Held the Bridge of Khazad-dûm' },
  gorgoroth: { name: 'Unseen', desc: 'Crossed Gorgoroth without the Eye seeing you' },
  ringbearer: { name: 'Ring-bearer', desc: 'Cast the One Ring into the fire' },
  mushrooms: { name: 'Shortcut to mushrooms', desc: 'Took ten of Farmer Maggot’s mushrooms from under his dogs’ noses' },
  smokerings: { name: 'Old Toby', desc: 'Blew three smoke rings through Gandalf’s' },
  fireworks: { name: 'The big one', desc: 'Kept the party cheering until Merry and Pippin lit the dragon' },
  secretsafe: { name: 'Keep it secret', desc: 'Read the letters on the Ring in Bag End’s fire' },
  getoffroad: { name: 'Get off the road!', desc: 'Hid from a Black Rider under the roots, and kept the Ring off' },
  spoons: { name: 'Sackville-Baggins proof', desc: 'Got Bilbo’s silver spoons home to Bag End before Lobelia could pocket them' },
  breegate: { name: 'What’s your business in Bree?', desc: 'Talked your way past the gatekeeper at Bree’s West Gate' },
  underhill: { name: 'Mr. Underhill', desc: 'Gave Butterbur the right name at the Prancing Pony' },
  pints: { name: 'It comes in pints?', desc: 'Poured Pippin three good pints at the Prancing Pony' },
  strider: { name: 'Not nearly frightened enough', desc: 'Met Strider, after the Ring slipped on in the Pony' },
  slipaway: { name: 'Through Bree unseen', desc: 'Got past the Nazgûl in Bree’s lanes to Strider at the East Gate' },
  maninthemoon: { name: 'The Man in the Moon stayed up too late', desc: 'Sang on the table at the Prancing Pony, and the room roared for more' },
  daycare: { name: 'Morty Day Care', desc: 'Got six loose Mortys back into the Citadel’s day care' },
  wafers: { name: 'Simple Rick’s', desc: 'Stacked three good wafers on Simple Rick’s line' },
  council: { name: 'Rickest Rick', desc: 'Talked your way out of the Council of Ricks' },
  votemorty: { name: 'Vote Morty', desc: 'Voted in the Citadel’s election (Candidate Morty won anyway)' },
  citadelout: { name: 'Get to the cruiser', desc: 'Got past Evil Morty’s Cop Ricks to the cruiser' },
  locos: { name: 'The Mortytown Locos', desc: 'Walked all three Locos to Cop Morty, outside Morty Mart' },
  citadelfall: { name: 'Wubba lubba dub dub', desc: 'Helped bring down the Citadel of Ricks from the universe map' },
  remover: { name: 'It removes planets', desc: 'Shot down the Federation’s NX-5 Planet Remover before it fired' },
  rifted: { name: 'Through the rift', desc: 'Flew into a rift on the universe map and came out somewhere else' },
  grandtour: { name: 'Seen it all', desc: 'Toured every station, world and wonder on the universe map' },
  wanted: { name: 'Wanted', desc: 'Shot down a bounty hunter on the universe map' },
  amonsul: { name: 'Amon Sûl', desc: 'Climbed the old stair to the ruined watchtower on Weathertop' },
  putitout: { name: 'Put it out, you fools!', desc: 'Stamped out Sam’s supper fire before the Nazgûl saw it' },
  weathertop: { name: 'Fire against the dark', desc: 'Held the summit of Weathertop with a brand until Strider came' },
  kingsfoil: { name: 'Kingsfoil', desc: 'Found three plants of athelas by lantern, as Sam' },
  bruinen: { name: 'If you want him, come and claim him', desc: 'Rode with Arwen to the Ford of Bruinen, and the river rose' },
  gandalfsmark: { name: 'G, and three strokes', desc: 'Found Gandalf’s mark on the stones of Amon Sûl, and read it' },
  elrond: { name: 'The house of Elrond', desc: 'Woke in Rivendell, with Gandalf at your bedside' },
  narsil: { name: 'The blade that was broken', desc: 'Laid the shards of Narsil back in their order' },
  iwilltakeit: { name: 'I will take it', desc: 'Stood up at the Council of Elrond, and were heard' },
  oldring: { name: 'My old ring', desc: 'Kept the Ring from Bilbo, gently, in his pavilion' },
  fellowship: { name: 'The Fellowship of the Ring', desc: 'Gathered the Nine and led them out of Rivendell' },
  riddlesinthedark: { name: 'Riddles in the dark', desc: 'Beat Bilbo at riddles by his candle in Rivendell' },
  dwarrowdelf: { name: 'Dwarrowdelf', desc: 'Followed your nose through the dark of Moria, and Gandalf risked a little more light' },
  fooloftook: { name: 'Fool of a Took!', desc: 'Caught what you could as it all went down the well in Balin’s tomb' },
  mithril: { name: 'More to this hobbit', desc: 'Kept out of the cave troll’s sight, and the mithril took the spear' },
  flyyoufools: { name: 'Fly, you fools', desc: 'Ran the broken stair and crossed the Bridge of Khazad-dûm ahead of the Balrog' },
  mindthewell: { name: 'Nothing woke', desc: 'Fetched Gandalf’s pipe off the plank over an old shaft in Moria, and dropped nothing down it' },
  goldenwood: { name: 'The golden wood', desc: 'Came into Lothlórien under the Galadhrim’s bows, and followed Haldir in' },
  carasgaladhon: { name: 'Caras Galadhon', desc: 'Climbed the great mallorn to the Lord and Lady of the wood' },
  ipassthetest: { name: 'I pass the test', desc: 'Kept the Ring from the Mirror’s water, then offered it to Galadriel' },
  earendil: { name: 'The light of Eärendil', desc: 'Gave out the Lady’s gifts, and took the phial' },
  argonath: { name: 'The Pillars of the Kings', desc: 'Took the boats down the Anduin to the Argonath' },
  galadhrim: { name: 'Worthy of the Galadhrim', desc: 'Struck all five of Legolas’s targets among the mallorns, with seven arrows' },
  parthgalen: { name: 'Parth Galen', desc: 'Made camp under Amon Hen, and gathered the wood' },
  wanderalone: { name: 'None of us should wander alone', desc: 'Got away from Boromir in the woods with the Ring on' },
  seatofseeing: { name: 'The Seat of Seeing', desc: 'Took the Ring off on Amon Hen before the Eye found you' },
  runfrodo: { name: 'Run, Frodo!', desc: 'Got down through the Uruk-hai to the lake unseen' },
  promise: { name: 'I made a promise', desc: 'Pulled Sam out of the lake, and crossed it together' },
  ducksanddrakes: { name: 'Ducks and drakes', desc: 'Skipped a stone over Nen Hithoel more times than Pippin' },
  elvenrope: { name: 'Real elvish rope', desc: 'Got down the cliffs of the Emyn Muil on Sam’s rope' },
  swearontheprecious: { name: 'Sméagol will swear on the precious', desc: 'Caught Gollum at the foot of the cliff, and spared him' },
  deadmarshes: { name: 'Don’t follow the lights', desc: 'Followed Gollum across the Dead Marshes, and hid from the Nazgûl' },
  anotherway: { name: 'There is another way', desc: 'Watched the Black Gate open from the slope, unseen under the elven cloak' },
  safeway: { name: 'Sméagol knows the way', desc: 'Crossed a pool of the Dead Marshes on the tussocks Gollum showed you' },
  minasmorgul: { name: 'Minas Morgul', desc: 'Kept your eyes off the dead city while the Witch-king’s host went by' },
  stairs: { name: 'The endless stair', desc: 'Climbed the stairs of Cirith Ungol behind Gollum' },
  aiyaearendil: { name: 'Aiya Eärendil Elenion Ancalima', desc: 'Got through Shelob’s lair by the light of the phial' },
  samwisethebrave: { name: 'Samwise the Brave', desc: 'Fought Shelob off Frodo with Sting and the phial' },
  tower: { name: 'I’m not going to leave you', desc: 'Got past the orcs and up the Tower of Cirith Ungol to Frodo' },
  notacrumb: { name: 'Not a crumb', desc: 'Brushed Gollum’s lembas crumbs off Sam’s cloak before Frodo woke' },
  maggots: { name: 'Get in line, you maggots', desc: 'Kept your place in the orc column down into Gorgoroth' },
  carryyou: { name: 'I can carry you', desc: 'Carried Frodo up the slopes of Mount Doom to the door' },
  eagles: { name: 'The eagles are coming', desc: 'Flew out of the eruption with the eagles, at the end of all things' },
  orthanc: { name: 'Seeking my counsel', desc: 'Found the hidden way into Orthanc' },
  windlord: { name: 'Gwaihir the Windlord', desc: 'Whispered to a moth on the pinnacle of Orthanc, and flew from it on the Windlord' },
  minastirith: { name: 'The city of the kings', desc: 'Found the hidden way into Minas Tirith' },
  kingreturns: { name: 'The Return of the King', desc: 'Lit the beacon, held the wall, and saw the White Tree flower in Minas Tirith' },
  edoras: { name: 'The court of Rohan', desc: 'Found the hidden way into Edoras' },
  rohanwillanswer: { name: 'And Rohan will answer', desc: 'Saw the beacon first from Meduseld, and rode out with the host of Rohan' },
  drinkinggame: { name: 'It’s a drinking game', desc: 'Drank a dozen tankards at the feast in Meduseld before going under the table' },
  remembertheshire: { name: 'Do you remember the Shire?', desc: 'Told Frodo the Shire at the foot of Mount Doom, and he said all six back' },
  worthy: { name: 'Worthy', desc: 'Lifted Mjolnir' },
  ironman: { name: 'I am Iron Man', desc: 'Brought down Ultron Prime at the Repulsor Range' },
  captain: { name: 'I can do this all day', desc: 'Cleared all twelve rooms of Ricochet' },
  hawkeye: { name: 'I see better from a distance', desc: 'Took Clint’s half of the Soul Stone at Trick Shot' },
  widow: { name: 'I’m always picking up after you boys', desc: 'Got Natasha’s file out of the HYDRA facility in Infiltration' },
  thor: { name: 'Bring me Thanos!', desc: 'Held the lawn against Cull Obsidian' },
  hulk: { name: 'That’s my secret', desc: 'Ran 2,000 m through Midtown at Smash Run' },
  whatever: { name: 'Whatever it takes', desc: 'Won all six Infinity Stones back on the compound, and snapped' },
  quinjet: { name: 'Get this man a shield', desc: 'Flew the Tesseract into the hangar at Tesseract Run' },
  spidey: { name: 'Your friendly neighbourhood', desc: 'Swung two kilometres down the avenue to school at Thwip!' },
  swingtour: { name: 'Rings round the compound', desc: 'Swung through every ring of the tour round Avengers HQ' },
  backpacks: { name: 'He keeps losing them', desc: 'Found all twelve of Peter’s backpacks webbed up round the Avengers compound' },
  suitup: { name: 'Suit up', desc: 'Flew Tony’s armour from its plinth up over the roofs of the Avengers compound' },
  showboat: { name: 'Showing off', desc: 'Banked 2,000 style points in one flight over the Avengers compound: flips, twists and perfect releases, one after another' },
  thinkmark: { name: 'Think, Mark!', desc: 'Saw Omni-Man off over the city' },
  regent: { name: 'Invincible', desc: 'Brought down Thragg, the Grand Regent of the Viltrum Empire' },
  soundbarrier: { name: 'Here goes nothing', desc: 'Broke the sound barrier over the Graysons’ city' },
  dadsrings: { name: 'Flight lesson', desc: 'Flew Dad’s rings from the house to the Guardians’ hall' },
  titlecards: { name: 'The whole season', desc: 'Found all eight title cards hidden round the Graysons’ city' },
  rescue: { name: 'That actually helped', desc: 'Caught someone falling over the city and set them down' },
  mimic: { name: 'A fraction of our power', desc: 'Flew alongside an airliner over the Graysons’ city' },
  flaxans: { name: 'Back through the portal', desc: 'Knocked every Flaxan out of the sky over the river in the Graysons’ city' },
  maulers: { name: 'The bank job', desc: 'Stopped the Mauler twins’ bank job downtown in the Graysons’ city' },
  seismic: { name: 'Who you calling ugly?', desc: 'Caught every student Doc Seismic shook off the school roof, and put him down' },
  gda: { name: 'You look kinda dead', desc: 'Held the GDA’s hangar against the Mauler clones' },
  season: { name: 'We need to talk', desc: 'Flew the whole first season of the Graysons’ city, and went home to talk' },
  karman: { name: 'Neil Armstrong, eat your heart out', desc: 'Flew up out of the air over the Graysons’ city, into space' },
  moonwalk: { name: 'One small step', desc: 'Landed on the Moon as Invincible' },
  redplanet: { name: 'A long way from home', desc: 'Landed on Mars as Invincible' },
  globetrotter: { name: 'Globetrotter', desc: 'Flew to every place on the globe' },
  fullset: { name: 'Full set', desc: 'Found all eight cartridges on Dot Matrix island' },
  pocketful: { name: 'Pocketful', desc: 'Picked up every coin on Dot Matrix island' },
  superstar: { name: 'Superstar', desc: 'Got every Power Star in the Mario 64 tribute' },
  passport: { name: 'Every stamp', desc: 'Flew to every place in the passport on Earth' },
  roundtheworld: { name: 'Round the world', desc: 'Flew the distance round the Earth, over all your flights on it' },
  groundside: { name: 'Boots on the ground', desc: 'Landed on a world in a galaxy far, far away' },
  surveyor: { name: 'Surveyor', desc: 'Found every place on a world in a galaxy far, far away' },
  wanderer: { name: 'Wanderer', desc: 'Set foot on every world you can land on in a galaxy far, far away' },
  interdicted: { name: 'Interdicted', desc: 'Pulled out of hyperspace by an Imperial Interdictor, and got clear of its gravity well' },
  gcwSworn: { name: 'Sworn', desc: 'Swore to a side of one of the galaxy’s wars' },
  gcwLiberator: { name: 'Liberator', desc: 'Fought for a system that turned your side’s' },
  gcwMajor: { name: 'Major order', desc: 'Won the battle for a war’s major order' },
  gcwTurncoat: { name: 'Turncoat', desc: 'Changed sides in the middle of a war' },
  gcwAdmiral: { name: 'Top brass', desc: 'Reached the highest rank of a side in the galaxy’s wars' },
  shotfirst: { name: 'Shot first', desc: 'Didn’t let Greedo shoot first in the Mos Eisley cantina' },
  docking94: { name: 'Docking Bay 94', desc: 'Held off the stormtroopers at Docking Bay 94' },
  rancor: { name: 'Rancor keeper', desc: 'Brought the gate down on Jabba’s rancor' },
  bounty: { name: 'Jabba pays', desc: 'Collected a bounty from Boba Fett' },
  womprats: { name: 'Bullseye', desc: 'Bullseyed womp rats in Beggar’s Canyon' },
  canyon: { name: 'Canyon run', desc: 'Ran Beggar’s Canyon in a landspeeder against the clock' },
  speederchase: { name: 'Fast and low', desc: 'Caught every scout trooper before the bunker on Endor' },
  yavinbriefing: { name: 'Stay on target', desc: 'Sat through General Dodonna’s briefing in the Great Temple' },
  yavinscramble: { name: 'Red Five standing by', desc: 'Scrambled from the Great Temple’s hangar to the trench' },
  yavinceremony: { name: 'Medal ceremony', desc: 'Walked the Great Temple’s throne room to the dais' },
  coruscantrace: { name: 'I hate flying', desc: 'Chased the assassin’s speeder through Coruscant’s skylanes to the Senate' },
  bespinfreezing: { name: 'I know', desc: 'Cleared the carbon-freezing chamber and lowered the platform' },
  bespinduel: { name: 'I am your father', desc: 'Faced Vader on the gantry over Cloud City’s reactor shaft' },
  bespinlobot: { name: 'Lobot’s codes', desc: 'Opened the corridor with Lobot’s codes and ran for Platform 327 with the Wing Guard' },
  starmapride: { name: 'The way to Ezra', desc: 'Raced the spires to the old tower on Lothal and kept the star map' },
  dagobahraise: { name: 'Size matters not', desc: 'Ran Dagobah’s swamp with Yoda on your back, faced the cave and raised the X-wing' },
  galacticassault: { name: 'Galactic assault', desc: 'Won a battle for the command posts on Hoth, Geonosis, Scarif or Endor' },
  heroesvsvillains: { name: 'Heroes vs Villains', desc: 'Brought down ten of the other side’s targets in a hero arena on Hoth, Endor, Tatooine, Geonosis or Kashyyyk' },
  blast: { name: 'Blast', desc: 'Got your side to a hundred kills first on a level’s own team-deathmatch ground' },
  canyonmission: { name: 'Faster than Biggs', desc: 'Ran Beggar’s Canyon both ways against the clock on Tatooine' },
  firsttransport: { name: 'The first transport is away', desc: 'Loaded the first transport off Hoth and cleared its way with the ion cannon' },
  sanctuary: { name: 'Sanctuary', desc: 'Held the krill farmers’ village on Sorgan against the raiders and their AT-ST' },
  tosche: { name: 'Power converters', desc: 'Picked up power converters at Tosche Station' },
  palette: { name: 'Power user', desc: 'Opened the command palette' },
  // Dunder Mifflin Scranton, the world (office/world)
  switchboard: { name: 'Dunder Mifflin, this is Jim', desc: 'Covered reception and put five calls through to the right desks' },
  jello: { name: 'Stapler in Jell-O', desc: 'Set Dwight’s stapler in Jell-O while he was in the men’s room' },
  chili: { name: 'Kevin’s famous chili', desc: 'Carried Kevin’s chili from the lift to the kitchen without spilling a drop' },
  olympics: { name: 'Office Olympics', desc: 'Played a round of paper toss at your desk' },
  falsefact: { name: 'False', desc: 'Took Dwight’s fact check at his desk' },
  stressrelief: { name: 'Stress relief', desc: 'Got out by the stairwell in Dwight’s fire drill' },
  hoops: { name: 'Office vs. warehouse', desc: 'Sank three free throws out of five in the warehouse' },
  bestboss: { name: 'Best Week in the Office', desc: 'Won a Dundie from Michael, in his office' },
};

const PAGES = ['/', '/experience', '/projects', '/travel', '/contact', '/terminal'];

// "New theme: Raga." or, when one easter egg opens several, all of them.
const newThemes = (themeId) => {
  const egg = FAN_THEMES.find((f) => f.id === themeId)?.achievement;
  const names = FAN_THEMES.filter((f) => f.achievement === egg).map((f) => THEMES[f.id].company);
  if (names.length < 2) return `New colours: ${names[0] ?? THEMES[themeId].company}.`;
  return `New colours: ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}.`;
};
// "New in your shipyard: …": the paint jobs and ship parts an achievement opens
// on the universe map (universe/outfit.js), or null.
const list = (names) => (names.length < 2 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);
const newInHangar = (id) => {
  const paints = paintsFor(id).map((p) => p.name);
  const parts = partsUnlockedBy(id).map((p) => p.name);
  const said = [paints.length ? `${list(paints)} ${paints.length === 1 ? 'paint' : 'paints'}` : null, parts.length ? list(parts) : null].filter(Boolean);
  return said.length ? `New in your shipyard: ${said.join('; ')}.` : null;
};
const KEY = 'tp-achievements';

const AchievementContext = createContext({ unlock: () => {}, notify: () => {}, unlocked: [] });

export function AchievementProvider({ children }) {
  // Kept across visits, so a theme stays unlocked once it is earned.
  const [unlocked, setUnlocked] = useState(() => {
    const saved = local.get(KEY, null) ?? storage.get(KEY, []);
    return Array.isArray(saved) ? saved.filter((id) => ACHIEVEMENTS[id]) : [];
  });
  const [queue, setQueue] = useState([]);
  const unlockedRef = useRef(unlocked);
  const { pathname } = useLocation();
  const { seen } = useTheme();

  const notify = useCallback((title, desc = '', kind = 'note', gif = null, hangar = null) => {
    setQueue((q) => [...q, { key: `${Date.now()}-${Math.random()}`, kind, title, desc, gif, hangar }]);
  }, []);

  const unlock = useCallback(
    (id) => {
      if (!ACHIEVEMENTS[id] || unlockedRef.current.includes(id)) return;
      const next = [...unlockedRef.current, id];
      unlockedRef.current = next;
      setUnlocked(next);
      local.set(KEY, next);
      const theme = FAN_THEMES.find((t) => t.achievement === id);
      notify(ACHIEVEMENTS[id].name, ACHIEVEMENTS[id].desc, theme ? `theme:${theme.id}` : 'achievement', null, newInHangar(id));
    },
    [notify],
  );

  useEffect(() => {
    const top = pathname.startsWith('/projects') ? '/projects' : pathname.startsWith('/experience') ? '/experience' : pathname;
    const visited = storage.get('tp-visited', []);
    if (!visited.includes(top)) {
      const next = [...visited, top];
      storage.set('tp-visited', next);
      if (PAGES.every((p) => next.includes(p))) unlock('explorer');
    }
    if (pathname === '/terminal') unlock('hacker');
    if (pathname === '/deathstar') unlock('deathstar');
    if (pathname === '/deathstar/inside') unlock('ds-aboard');
    if (pathname === '/resume') unlock('resume');
  }, [pathname, unlock]);

  useEffect(() => {
    if (THEME_ORDER.every((t) => seen.has(t))) unlock('cartographer');
  }, [seen, unlock]);

  // (a toast waits while a tour runs: it'd sit over the tour's card)
  const touring = useTouring();
  const toast = touring ? null : queue[0];
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), toast.gif ? 7000 : 3800);
    return () => clearTimeout(t);
  }, [toast]);

  const value = useMemo(() => ({ unlock, notify, unlocked }), [unlock, notify, unlocked]);
  // In a world the HUD's foot is the prompt, the thumbs and the instruments:
  // the toast goes top centre, under the nav, instead (the worlds' own
  // toasts sit lower, under their top row).
  const inWorld = Boolean(worldAt(pathname));
  const themeId = toast?.kind.startsWith('theme:') ? toast.kind.slice(6) : null;

  return (
    <AchievementContext.Provider value={value}>
      {children}
      {/* taps pass through the toast to whatever is under it, except on its own controls */}
      {/* in language mode the toast reads plainly, and sits above the Back to English pill */}
      <div className={`toast-host pointer-events-none fixed inset-x-0 ${inWorld ? 'top-[calc(var(--nav-h)+0.75rem)]' : 'bottom-5'} z-[var(--z-sheet)] flex justify-center px-4 [&_.toast_a]:pointer-events-auto [&_.toast_button]:pointer-events-auto`} aria-live="polite" data-in-world={inWorld || undefined}>
        {toast && (
          <div
            key={toast.key}
            className="toast notice ab-keep flex max-w-md items-center gap-3 px-4 py-3"
            style={{ animationDuration: toast.gif ? '7s' : '3.8s' }}
          >
            {toast.kind !== 'note' && (
              <span className="grid h-9 w-9 flex-none place-items-center rounded-full border border-line-strong">
                <span className="h-3 w-3 rounded-full" style={{ background: themeId ? THEMES[themeId].swatch : 'var(--accent)' }} />
              </span>
            )}
            <div>
              {toast.kind !== 'note' && <p className="label">Achievement unlocked</p>}
              <p className="font-semibold text-ink">{toast.title}</p>
              {toast.desc && <p className="text-sm text-muted">{toast.desc}</p>}
              {themeId && <p className="mt-1 text-sm text-body">{newThemes(themeId)} Pick from the site colours.</p>}
              {toast.hangar && <p className="mt-1 text-sm text-body">{toast.hangar}</p>}
              {toast.gif && <Gif name={toast.gif} eager />}
            </div>
          </div>
        )}
      </div>
    </AchievementContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAchievements = () => useContext(AchievementContext);
