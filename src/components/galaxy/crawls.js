// The opening crawl for each system's mission (systems.js's `game`): the
// briefing that rolls away into the stars before you fly it, the way the
// films begin. Pure data, by system id: the episode line (the film's own,
// 'A Star Wars Story' for Rogue One, or a show's title and chapter), the
// mission's title, and three paragraphs in the crawl's voice, the last
// trailing off into the mission itself.

export const CRAWLS = {
  tatooine: {
    episode: 'Episode IV',
    title: 'The Canyon Run',
    paragraphs: [
      'It is a period of civil war, but on the desert world of Tatooine, far from the fighting, nothing much has changed. The moisture farms draw their water, the Jawas trade their scrap, and the farm boys of Anchorhead race the wastes for want of anything better to do.',
      'In the long shadows of Beggar’s Canyon, young Luke Skywalker has heard that his friend Biggs Darklighter ran the whole canyon in under thirty seconds before leaving for the Academy. Camie has bet him he cannot do the same.',
      'With his uncle’s landspeeder and the twin suns going down, Luke must run the canyon through every gate, round the Stone Needle and back up again against the clock, before the others at Tosche Station give up waiting for him…',
    ],
  },
  hoth: {
    episode: 'Episode V',
    title: 'The Battle of Hoth',
    paragraphs: [
      'It is a dark time for the Rebellion. An Imperial probe droid has found Echo Base, the Rebels’ secret stronghold on the remote ice world of Hoth, and Darth Vader’s Death Squadron has come out of lightspeed to crush it.',
      'The Imperial fleet cannot fire through the base’s energy shield, so General Veers has landed his walkers and his snowtroopers on the ice to take the shield generator by force, while the Rebels load their transports to flee the planet two at a time.',
      'Now the walkers come on across the snow toward the uplinks and the hangars, and behind them the Empire’s soldiers. The Rebels in the trenches of Outpost Delta must hold each line long enough for the transports to get away…',
    ],
  },
  endor: {
    episode: 'Episode VI',
    title: 'The Speeder Bike Chase',
    paragraphs: [
      'The Galactic Empire is secretly building a second DEATH STAR above the forest moon of Endor. When it is complete, the battle station will spell the end of the small band of Rebels fighting to restore freedom to the galaxy.',
      'The unfinished station is protected by an energy shield projected from a bunker on the moon below. A Rebel strike team led by General Han Solo has landed in a stolen Imperial shuttle to destroy the generator before the Rebel fleet arrives.',
      'But Imperial scout troopers have spotted the intruders in the forest. Now Luke Skywalker and Princess Leia must chase them down on stolen speeder bikes, through the giant trees, before they can reach their base and raise the alarm…',
    ],
  },
  yavin: {
    episode: 'Episode IV',
    title: 'The Trench Run',
    paragraphs: [
      'It is a desperate hour for the Rebellion. The stolen plans to the Empire’s DEATH STAR have reached the hidden Rebel base on Yavin 4, carried there by a princess, a farm boy, a smuggler, a Wookiee and a pair of droids.',
      'The plans reveal a weakness: a small thermal exhaust port, only two meters wide, at the end of a trench, leading straight to the main reactor. But the battle station has followed the Falcon to Yavin, and is closing in.',
      'As the Death Star rounds the gas giant, every fighter the Alliance has launches to meet it. Now one young pilot, Red Five, must fly the trench with Darth Vader on his tail and put two proton torpedoes into the port before Yavin 4 is destroyed…',
    ],
  },
  alderaan: {
    episode: 'Episode IV',
    title: 'That’s No Moon',
    paragraphs: [
      'It is a period of civil war. Princess Leia Organa is a prisoner of the Empire, and her home planet of Alderaan, peaceful and unarmed, has been destroyed by the DEATH STAR to show the galaxy what the battle station can do.',
      'Bound for Alderaan, Obi-Wan Kenobi, young Luke Skywalker and the smuggler Han Solo arrive aboard the Millennium Falcon, with R2-D2 and the stolen plans, to find only a field of rubble where a world once was.',
      'A small moon lies ahead. But it is no moon. Caught in its tractor beam, the Falcon is pulled into the heart of the Empire’s ultimate weapon, a station that will soon turn its superlaser on the hidden Rebel base at Yavin…',
    ],
  },
  bespin: {
    episode: 'Episode V',
    title: 'Escape from Cloud City',
    paragraphs: [
      'It is a dark time for the Rebellion. Fleeing the Battle of Hoth with a broken hyperdrive, Han Solo and Princess Leia have taken refuge on Cloud City, a mining colony above the gas giant Bespin, run by Han’s old friend Lando Calrissian.',
      'But Darth Vader was there first. Betrayed to the Empire, Han Solo has been frozen in carbonite and handed to the bounty hunter Boba Fett, while young Luke Skywalker, drawn to the city by visions of his friends in pain, faces the Dark Lord alone.',
      'Now Lando, Leia and Chewbacca must get the Millennium Falcon off Cloud City and up through the clouds with TIE fighters in pursuit, swing back for Luke beneath the city, and make the jump to lightspeed. If the hyperdrive works…',
    ],
  },
  dagobah: {
    episode: 'Episode V',
    title: 'Do or Do Not',
    paragraphs: [
      'It is a dark time for the Rebellion. Escaping the Battle of Hoth, Luke Skywalker has turned away from the Rebel fleet’s rendezvous and set course for the Dagobah system, guided by the words of his old master, Obi-Wan Kenobi.',
      'On a swamp world hidden in mist, he has crash-landed his X-wing in a bog and found the Jedi Master Yoda: not the great warrior he expected, but the only one left who can train him in the ways of the Force.',
      'Now, with Yoda riding on his back, Luke must run the swamp, face his fear, and lift his sunken starfighter from the bog with nothing but the Force. Size matters not…',
    ],
  },
  mustafar: {
    episode: 'Episode III',
    title: 'The High Ground',
    paragraphs: [
      'The Clone Wars are over. Chancellor Palpatine has revealed himself as a Sith Lord, the clones have turned on their Jedi generals, and the Republic has been reorganized into the first Galactic Empire.',
      'Anakin Skywalker, now Darth Vader, has destroyed the Separatist council in its last hiding place on the volcanic world of Mustafar. His wife, Padmé Amidala, has followed him there, and so, unseen, has his old master, Obi-Wan Kenobi.',
      'Now master and apprentice must face each other above a river of fire. From a collapsing mining platform to a droid skimming the lava, Obi-Wan Kenobi must duel the Chosen One all the way to the riverbank, and hold the high ground…',
    ],
  },
  coruscant: {
    episode: 'Episode II',
    title: 'Chase Through Coruscant',
    paragraphs: [
      'Unrest grips the Galactic Republic. Thousands of solar systems have declared their intention to leave it, and the Senate is about to vote on whether to create an ARMY OF THE REPUBLIC to help the overwhelmed Jedi keep the peace.',
      'Senator Padmé Amidala, who leads the opposition to the army, has survived one attempt on her life. Now two Jedi, Obi-Wan Kenobi and his apprentice Anakin Skywalker, guard her apartment, as an assassin makes a second attempt in the night.',
      'Clinging to a droid, then flying a borrowed airspeeder, the two Jedi must chase the assassin down through the traffic lanes, the power couplings and the canyons between the towers of Coruscant, before she can escape into the night…',
    ],
  },
  naboo: {
    episode: 'Episode I',
    title: 'Into the Droid Control Ship',
    paragraphs: [
      'The Trade Federation has invaded the peaceful planet of Naboo. Its droid army, commanded from a great battleship in orbit, has seized the capital city of Theed, and the people of Naboo are held in camps.',
      'Queen Amidala has returned from Coruscant to take back her planet. While the Gungan army draws the droids out onto the grass plains, her pilots launch to attack the droid control ship, and her guards fight their way into the palace.',
      'Hiding in the cockpit of an N-1 starfighter, young Anakin Skywalker has been carried into the battle on autopilot. Now he must fly into the control ship’s hangar, fire his torpedoes into its reactor, and get out before it blows…',
    ],
  },
  kashyyyk: {
    episode: 'Episode III',
    title: 'The Battle of Kashyyyk',
    paragraphs: [
      'The Clone Wars are nearly over. Count Dooku is dead and General Grievous is on the run, but the Separatists have sent their droid army to seize Kashyyyk, the forest world of the Wookiees.',
      'Master Yoda has come to help defend it, with the clones of Commander Gree and the Wookiee warriors of Tarfful and Chewbacca, gathered on the shore beneath the great trees at the city of Kachirho.',
      'Now the droid army is coming across the lagoon. From a Wookiee catamaran, a gunner must hold the beach against tanks and spider droids, fighting beside the clones. But watch them closely. Something about them is not right…',
    ],
  },
  kamino: {
    episode: 'Episode II',
    title: 'Storm over Tipoca',
    paragraphs: [
      'A second attempt on the life of Senator Padmé Amidala has failed, but the assassin was silenced before she could talk, killed by a poisoned dart made on a planet called Kamino.',
      'Kamino is missing from the Jedi Archives. Obi-Wan Kenobi has found it anyway: an ocean world beyond the Outer Rim, where the Kaminoans have been growing a clone army for the Republic for ten years, ordered by a Jedi long dead.',
      'The army’s template is the bounty hunter Jango Fett, and he is leaving. Now, on a landing platform in the storm, Obi-Wan must stop him, then follow his ship, Slave I, to a red planet called Geonosis…',
    ],
  },
  geonosis: {
    episode: 'Episode II',
    title: 'The Battle of Geonosis',
    paragraphs: [
      'War has come to the Republic. On the red world of Geonosis, Count Dooku and the Separatist leaders have gathered their droid armies in secret, and three prisoners stand chained in the execution arena before a roaring crowd.',
      'Two hundred Jedi have fought their way into the arena and been surrounded. But Master Yoda has come with the clone army of Kamino, and Republic gunships are dropping onto the plain outside as the Separatists’ core ships prepare to flee.',
      'Now the first battle of the Clone Wars is joined. The clones must take the forward command post and the ridge, then the arena gate, then the arena floor itself, while the battle droids hold each as long as they can, and the galaxy will never be the same…',
    ],
  },
  scarif: {
    episode: 'A Star Wars Story',
    title: 'The Battle of Scarif',
    paragraphs: [
      'The Empire’s ultimate weapon is complete. The DEATH STAR has destroyed the holy city of Jedha, but its designer, Galen Erso, has hidden a fatal flaw deep inside it. His daughter, Jyn, has learned where its plans are kept.',
      'The plans are kept in the Imperial Citadel on Scarif, a tropical world sealed beneath a planetary shield. A band of rebels calling themselves ROGUE ONE has landed inside the shield, and the PATHFINDERS of Blue Squadron are out of their U-wings and into the palms to draw the garrison away.',
      'Now the beaches are a battlefield. The Pathfinders must take the beach and the bunker line, Landing Pad Nine and the master switch out in the open, while the shoretroopers and the death troopers of Director Krennic’s guard hold each one until the walkers come down the sand…',
    ],
  },
  nevarro: {
    episode: 'The Mandalorian, Chapter 12',
    title: 'The Siege',
    paragraphs: [
      'The Empire has fallen, but in the Outer Rim its remnants have not. On the volcanic world of Nevarro, an Imperial base still stands outside the city that Greef Karga, now its magistrate, and Marshal Cara Dune have cleaned up.',
      'The Mandalorian has limped back with the Razor Crest in pieces and the Child in tow. In return for the repairs, Greef and Cara want his help: the base must go, before its troopers can threaten the town again.',
      'The reactor is overloading and the base is going up behind them. Now, as TIE fighters scramble from the wreckage, Din Djarin must take the Razor Crest through the lava canyons, turn on his pursuers and shoot them down one by one…',
    ],
  },
  mandalore: {
    episode: 'The Mandalorian, Chapter 24',
    title: 'The Return',
    paragraphs: [
      'The Mandalorians have returned to their homeworld. Years after the Empire glassed Mandalore in the Great Purge, Bo-Katan Kryze has gathered the scattered coverts beneath one banner, and Din Djarin has bathed in the Living Waters beneath its mines.',
      'But the planet is not empty. Moff Gideon has built a hidden base beneath the ruins of Sundari, and has captured the Mandalorian. His TIE fighters now swarm the Mandalorians’ capital ship above the clouds.',
      'They cannot win in space. Bo-Katan must keep the TIEs off the ship until it is empty, then clear the sky as Axe Woves takes it down onto the enemy base, and lead her people into the fight for Mandalore…',
    ],
  },
  lothal: {
    episode: 'Ahsoka, Part One',
    title: 'The Star Map',
    paragraphs: [
      'The Empire has fallen, but scattered enemies remain. On Lothal, the people celebrate the anniversary of their liberation, and of the night the Jedi Ezra Bridger vanished into hyperspace with Grand Admiral Thrawn and his flagship, the Chimaera.',
      'Ahsoka Tano has found a map that may lead to them both, but she cannot read it. Only Sabine Wren, Ezra’s friend and her own lost apprentice, can unlock it, and Sabine has skipped the ceremony.',
      'Now Sabine must race her speeder across the plains to her home in the old tower, unlock the map that points the way to Ezra, and keep it out of the hands of the dark Jedi Shin Hati, who is already on her way…',
    ],
  },
  // (lane E5: the 2017 game's own worlds; their missions are the game's campaign and modes, so the crawl opens on the film the campaign is set after)
  felucia: {
    episode: 'Episode III',
    title: 'Supremacy on Felucia',
    paragraphs: [
      'The Clone Wars rage across the Outer Rim. On Felucia, a jungle world of giant fungi in the Thanium sector, the Separatist Alliance has dug in among the villages of the Tagata region, and the Republic has come to drive it out.',
      'Both sides have brought their capital ships into the fight. A Republic Venator and a Separatist dreadnought hang over the forest, and whichever army holds the ground below will open the way to board the other.',
      'Now the clones and the droids fight for the posts between the mushrooms, from the Village and the Swamp to the Caves, the Sarlacc and the Farm, and the side that breaks through will strike at the heart of the enemy ship…',
    ],
  },

  kessel: {
    episode: 'Episode IV',
    title: 'Extraction on Kessel',
    paragraphs: [
      'The Empire works the mines of Kessel with prisoners, droids and Wookiees in chains, and guards what they dig with a garrison that answers to no one. Deep in the mines lies a shipment of coaxium the Rebellion cannot do without.',
      'A Rebel infiltration squad has gone in to take it. But the Imperial forces have been alerted, and every corridor between the coaxium and the squad’s ride home, the Millennium Falcon, is about to be held against them.',
      'Now the Rebels must steal the shipment and fight it out through the mines checkpoint by checkpoint, while the Empire throws everything it has at intercepting them before the Falcon can lift them clear of Kessel…',
    ],
  },

  sullust: {
    episode: 'Star Wars Battlefront II',
    title: 'Cache Grab',
    paragraphs: [
      'The Emperor is dead, and his last order has burned worlds. Iden Versio and Del Meeko of Inferno Squad turned on Operation Cinder, and now they fly for the Rebellion against the father who gave the order.',
      'Their intel points to an abandoned Imperial factory on Sullust, a volcanic world of black rock and sulphur. Admiral Versio means to recover a weapons cache from inside it, and the Rebellion means to take it first.',
      'Now General Lando Calrissian and the Sullustan scout Shriv Suurgav must find the cache, shut the factory down around them, and steal a way off Sullust before the Admiral’s strike team can close the trap…',
    ],
  },

  pillio: {
    episode: 'Star Wars Battlefront II',
    title: 'The Observatory',
    paragraphs: [
      'The second Death Star is destroyed, and the Emperor with it. But his secrets remain, hidden across the galaxy in observatories that only the most trusted of his servants were ever allowed to see.',
      'Inferno Squad has been ordered to Pillio, an uncolonised world of cliffs and coral far out in the Jinata sector, to destroy one of them before the Rebels can find the dangerous artifacts it holds.',
      'Agent Del Meeko has gone in alone. But Luke Skywalker has followed a call in the Force to the same shore, and the cave beneath the cliffs holds more than either of them came looking for…',
    ],
  },

  vardos: {
    episode: 'Star Wars Battlefront II',
    title: 'The Storm',
    paragraphs: [
      'The Emperor is dead, and his last order has reached his fleet. Operation Cinder will strike the worlds he chose, loyal or not, and the satellites Inferno Squad guarded at Fondor are already in orbit.',
      'Commander Iden Versio has been sent home to Vardos, a model Imperial world, to extract Protectorate Gleb from its capital. Only when the satellites rise over Kestro does she learn that Vardos is a target.',
      'Now Iden and Del Meeko must decide whether to follow orders or the people of Kestro, fight through the storm to the anti-air guns, and escape Vardos with everyone the Corvus can carry…',
    ],
  },

  fondor: {
    episode: 'Star Wars Battlefront II',
    title: 'The Dauntless',
    paragraphs: [
      'The Battle of Endor is lost and the Emperor is dead, but his plans live on. In preparation for Operation Cinder, Inferno Squad has been ordered to the Fondor shipyards, where the Empire builds its Star Destroyers.',
      'Commander Iden Versio and Agent Hask are aboard the Star Destroyer Dauntless to take on a cargo of experimental satellites and see to the security of Moff Raythe. Then Rebel ships drop out of hyperspace into Fondor space.',
      'Now Iden must defend the Dauntless from the Rebels’ boarding parties, destroy the ion cannons aboard their cruiser, and free the Star Destroyer from the clamps of its dock before the shipyard becomes its grave…',
    ],
  },

  sorgan: {
    episode: 'The Mandalorian, Chapter 4',
    title: 'Sanctuary',
    paragraphs: [
      'Having betrayed the Bounty Hunters’ Guild to save the Child, the Mandalorian is a hunted man. He has set course for Sorgan, a backwater forest world far from anywhere, to lie low until the hunt dies down.',
      'But the planet already has its troubles. Klatooinian raiders, with an Imperial walker of their own, keep coming for a small village of krill farmers, and a former Rebel shock trooper, Cara Dune, is hiding out in the woods.',
      'Paid in krill and a place to stay, the Mandalorian and Cara Dune must teach the farmers to fight, dig a trap in the pond, and bring the walker down when the raiders come in the night…',
    ],
  },
};
