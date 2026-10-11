// What the crews say in a galaxy far, far away (systems.js): the four crews
// of the universe map (universe/crews.js) flying the Star Wars galaxy, over
// the same comms. Pure data, in the crews' own shape: a line is
// [speaker, text, clip?], an exchange is a list of lines said in turn,
// 'comms' is a voice on the radio that isn't the crew, and Artoo and Chewie
// say what they mean, in brackets.
//
// `arrive` has one exchange per system, said the first time you drop out of
// hyperspace there: Luke and Han have history with half of them (and Artoo,
// whose memory was never wiped, with more than Luke knows), Rick and Morty
// are tourists from another universe, and Walt and Jesse are a long way from
// Albuquerque. `events` are the jump between systems (and `course`, the
// first time the nose comes onto another system's star), and the moments the
// systems play out (the Death Star's tractor beam and its hangar at
// Alderaan, Hoth's ion cannon and the transports getting away, the
// superlaser over Scarif and its shield, the second Death Star's shield at
// Endor, a Star Destroyer arriving, and the hyperdrive coming back once
// you're clear of an Interdictor's gravity well). `interdicted` is the
// Interdictor pulling you out of hyperspace (interdiction.js), over the
// universe map's own interdiction line. `hunted` and `kill` are the galaxy's
// own hunters (galaxy/hunted.js): the Separatists' droids, and the Imperial
// remnant's TIEs over the New Republic's worlds (shot down, they're TIEs:
// the crews' own lines). galaxyCrew lays all this over a crew's own lines.

export const GALAXY_LINES = {
  cruiser: {
    arrive: {
      tatooine: [
        ['morty', 'Two suns, Rick! It’s like a postcard!'],
        ['rick', 'Tatooine, Morty. No water, two suns, a wretched hive of scum and villainy. I love it.'],
      ],
      hoth: [
        ['morty', 'Rick, it’s just ice. Ice, and… is that a snow lizard?'],
        ['rick', 'Tauntaun, Morty. Smells bad on the outside. You don’t want to know about the inside.'],
      ],
      endor: [
        ['comms', 'It’s a trap!', 'itsATrap'],
        ['morty', 'Rick, there’s a whole Death Star up there, and teddy bears on the moon!'],
        ['rick', 'Ewoks, Morty. Adorable. Also tried to roast a smuggler. Skip the banquet.'],
      ],
      yavin: [
        ['morty', 'Rick, is that the Death Star coming round the planet?'],
        ['rick', 'The original, Morty. Two-meter exhaust port, straight to the reactor. Who signed off on that?'],
      ],
      alderaan: [
        ['morty', 'Rick… where’s the planet? There’s just rocks.'],
        ['rick', 'That was Alderaan, Morty. The Empire made an example of it.'],
        ['comms', 'That’s no moon. It’s a space station.', 'noMoon'],
      ],
      bespin: [
        ['morty', 'Rick, a whole city floating in the clouds!'],
        ['rick', 'Cloud City, Morty. Gas mines, great sunsets, and the management sells you to Darth Vader.'],
      ],
      dagobah: [
        ['comms', 'Do. Or do not. There is no try.', 'doOrDoNot'],
        ['morty', 'Rick, the swamp’s talking to me.'],
        ['rick', 'That’s Yoda, Morty. Nine hundred years old, and still can’t put a sentence in order.'],
      ],
      mustafar: [
        ['morty', 'Rick, the whole planet’s on fire!'],
        ['rick', 'Mustafar, Morty. Lava, mining, and the galaxy’s most famous argument about the high ground.'],
      ],
      coruscant: [
        ['morty', 'It’s all city, Rick! The whole planet!'],
        ['rick', 'Coruscant, Morty. A trillion people, and a Senate that cheered in its own Emperor.'],
      ],
      naboo: [
        ['morty', 'Aw, it’s so pretty, Rick. Lakes and waterfalls and everything.'],
        ['rick', 'Naboo, Morty. Lovely place. Nice quiet senator called Palpatine. Nothing to worry about.'],
      ],
      kashyyyk: [
        ['morty', 'Rick, those trees go up for, like, miles!'],
        ['rick', 'Wroshyr trees, Morty. Wookiee country. Rule one: let the Wookiee win.'],
      ],
      kamino: [
        ['morty', 'Rick, it’s raining. Everywhere. Forever.'],
        ['rick', 'Kamino, Morty. They grew an army here out of one bounty hunter. Amateurs.'],
        ['meeseeks', 'Ooh, yeah! Can do!', 'canDo'],
      ],
      geonosis: [
        ['morty', 'Rick, there’s an arena down there! With monsters!'],
        ['rick', 'Geonosis, Morty. They tried to execute three people in there and started a war instead.'],
      ],
      scarif: [
        ['morty', 'A beach planet! Rick, can we stop? Please?'],
        ['rick', 'Scarif, Morty. Lovely beaches. Historically terrible survival rate.'],
      ],
      nevarro: [
        ['morty', 'Rick, it’s all lava and black rock, and everybody’s wearing a helmet!'],
        ['rick', 'Nevarro, Morty. Bounty hunter town. Don’t make eye contact. Not that they’ve got eyes, it’s all visor.'],
      ],
      mandalore: [
        ['morty', 'Rick, the whole planet’s made of glass!'],
        ['rick', 'The Empire glassed it, Morty. And they still won’t take their helmets off down there. Respect, honestly.'],
      ],
      lothal: [
        ['morty', 'Aw, Rick, look! A little cat thing in the grass!'],
        ['rick', 'Loth-cat, Morty. Don’t. It bites, and the wolves round here are the size of a car.'],
      ],
      sorgan: [
        ['morty', 'It’s so peaceful, Rick. Just forests and little ponds.'],
        ['rick', 'Krill farms, Morty. Peaceful till the raiders show up with a walker. Then it’s Seven Samurai.'],
      ],
      felucia: [
        ['morty', 'Rick, the mushrooms are taller than the ship! And they’re… purple?'],
        ['rick', 'Felucia, Morty. Everything here is either a fungus or eating one. Don’t lick anything.'],
      ],
      kessel: [
        ['morty', 'It’s all white, Rick. Like salt. Is that spice?'],
        ['rick', 'Kessel, Morty. Spice mines, prison labour, black holes next door. Terrible place to get caught.'],
      ],
      sullust: [
        ['morty', 'Rick, the ground’s glowing! Is it supposed to glow?'],
        ['rick', 'Sullust, Morty. Volcanic. The locals live in the lava tubes and build better ships than most people with lungs.'],
      ],
      pillio: [
        ['morty', 'Oh wow, Rick, it’s all ocean and cliffs. It’s beautiful.'],
        ['rick', 'Pillio, Morty. Beautiful, remote, and the kind of place a dead emperor hides his stuff. Don’t open anything.'],
      ],
      vardos: [
        ['morty', 'Rick, this one’s all clean streets and big grey buildings.'],
        ['rick', 'Vardos, Morty. The Empire’s show home. Ask what happened to it after the boss died and watch everybody change the subject.'],
      ],
      fondor: [
        ['morty', 'Rick, there’s like a ring of giant… scaffolding things around the planet!'],
        ['rick', 'Dry docks, Morty. Fondor builds Star Destroyers. We are very small and very flammable here, so smile and keep moving.'],
      ],
    },
    events: {
      jump: [
        ['morty', 'Rick, why are the stars all stretchy?'],
        ['rick', 'Hyperspace, Morty. It’s a portal for people with time to kill.'],
      ],
      course: [
        ['morty', 'Rick, that star’s got a name on it!'],
        ['rick', 'They all do, Morty. Every one’s a system. Nose on it, punch the hyperdrive, we’re there.'],
      ],
      tractor: [
        ['morty', 'Rick, the controls aren’t working! It’s pulling us in!'],
        ['rick', 'Tractor beam, Morty. Don’t fight it. I’ve always wanted the tour.'],
      ],
      boarded: [
        ['morty', 'Rick, they pulled us right inside the Death Star!'],
        ['rick', 'You son of a bitch. I’m in.', 'imIn'],
      ],
      ion: [
        ['morty', 'Whoa! The planet just shot a Star Destroyer!'],
        ['rick', 'Ion cannon, Morty. Doesn’t blow it up, just fries everything with a plug.'],
      ],
      superlaser: [
        ['morty', 'Rick! The Death Star just shot the planet!'],
        ['rick', 'One reactor, Morty. That’s the Empire going easy. Let’s not stick around for full power.'],
      ],
      'shield-down': [
        ['comms', 'The shield is down! Commence attack on the Death Star’s main reactor.'],
        ['morty', 'They did it, Rick! The teddy bears did it!'],
        ['rick', 'Never underestimate a species with nothing to lose and a lot of logs, Morty.'],
      ],
      'shield-up': [
        ['comms', 'Break off the attack! The shield is still up!'],
        ['morty', 'Rick, they put it back up!'],
        ['rick', 'Course they did, Morty. Somebody go help the teddy bears again.'],
      ],
      'scarif-shield': [
        ['comms', 'Disqualified!', 'disqualified'],
        ['morty', 'Rick, we bounced off the whole planet!'],
        ['rick', 'Planetary shield, Morty. There’s one gate. Even the Empire has a front door.'],
      ],
      escaped: [
        ['morty', 'They made it, Rick! They got away!'],
        ['rick', 'Good for them. Running away is underrated, Morty. Trust me, I’m an expert.'],
      ],
      destroyer: [
        ['morty', 'Rick! A giant triangle just came out of nowhere!'],
        ['rick', 'Star Destroyer, Morty. A mile of Imperial overcompensation. Keep your head down.'],
      ],
      find: [
        ['morty', 'Rick, there’s something out here! Way out past the planet!'],
        ['rick', 'Mark it, Morty. Nobody comes this far out unless they’re hiding something, or they’re it.'],
      ],
      wellclear: [
        ['rick', 'Well’s gone, Morty. Hyperdrive’s back. Let’s not get counted again.'],
        ['morty', 'C-can we take the slow way for a bit?'],
      ],
      // the Galactic Civil War's set pieces (warpieces/)
      'gcw-shieldgen': [
        ['comms', 'The shield is down! Commence attack on the Death Star’s main reactor.'],
        ['morty', 'We blew up the shield thing, Rick! We’re the teddy bears now!'],
      ],
      'gcw-superlaser': [
        ['morty', 'Rick! The Death Star just shot one of our cruisers! It’s gone!'],
        ['rick', 'It’s operational, Morty. Classic trap. Stay off its sight lines.'],
      ],
      'gcw-run': [
        ['rick', 'In we go, Morty. Tight tunnel, big reactor, zero insurance.'],
        ['morty', 'Rick, the walls are like a foot from the wings!'],
      ],
      'gcw-reactor': [
        ['rick', 'Reactor’s cooked! Out, out, out! Floor it, Morty, metaphorically!'],
        ['morty', 'Which way is out, Rick?!'],
      ],
      'gcw-ds2': [
        ['morty', 'We did it, Rick! The whole Death Star just went up!'],
        ['rick', 'Second one, Morty. You’d think they’d learn. Spoiler: never.'],
      ],
      'gcw-executor': [
        ['morty', 'Rick, the giant one’s going straight into the Death Star!'],
        ['rick', 'Bridge goes, the whole thing goes. Nineteen kilometres of bad steering.'],
      ],
      'gcw-hangar': [
        ['rick', 'We’re in its hangar, Morty. Every ship’s got a soft middle.'],
        ['morty', 'Rick, there are stormtroopers waving at us!'],
      ],
      'gcw-isd': [
        ['morty', 'It’s breaking in half, Rick! A whole Star Destroyer!'],
        ['rick', 'From the inside, Morty. That’s how you know you did it right.'],
      ],
      'gcw-ram': [
        ['morty', 'Rick, that little ship’s ramming the Star Destroyer!'],
        ['rick', 'Hammerhead, Morty. Physics doesn’t care how big you are. Watch.'],
      ],
      'gcw-gate': [
        ['comms', 'The shield gate is down! Transmit the plans!'],
        ['morty', 'They pushed a Star Destroyer into the other one, Rick!'],
        ['rick', 'Best use of a Star Destroyer I’ve ever seen, Morty.'],
      ],
      'gcw-evacuated': [
        ['comms', 'The last transport’s away. Echo Base is clear.'],
        ['morty', 'They all made it, Rick!'],
        ['rick', 'Mostly. That’s a win in a war, Morty. Mostly.'],
      ],
      // (the war's battles: battleLines.js, by the side you swore to)
    },
    interdicted: [
      ['morty', 'Rick! We fell out of hyperspace! Why did we fall out of hyperspace?!'],
      ['rick', 'Interdictor, Morty. Gravity wells. Somebody counted our jumps. Shoot the somebody.'],
    ],
    hunted: {
      separatists: [
        ['morty', 'Rick, droid fighters! A whole swarm of ’em!'],
        ['rick', 'Vulture droids, Morty. Cheap, dumb, and they come in bulk. Shoot!'],
      ],
      remnant: [
        ['morty', 'Rick, TIE fighters! I thought the Empire lost!'],
        ['rick', 'It did, Morty. These are the leftovers. Same TIEs, smaller budget. Shoot!'],
      ],
      // the war's other hunters (warEffects.js: whoever holds a system you're not sworn to), and your own side's wing
      rebellion: [
        ['morty', 'Rick, X-wings! The good guys are shooting at us! Are we the bad guys?!'],
        ['rick', 'In this war, Morty, apparently we’re the bad guys. Shoot back.'],
      ],
      rebelnavy: [
        ['morty', 'Rick, the fish cruiser’s launching fighters!'],
        ['rick', 'Mon Calamari, Morty. They build ships like coral reefs and they’re mad at us. Shoot!'],
      ],
      newrepublic: [
        ['morty', 'Rick, it’s the New Republic! They’ve got paperwork AND X-wings!'],
        ['rick', 'Bureaucrats with lasers, Morty. The worst kind. Lose them.'],
      ],
      republic: [
        ['morty', 'Rick, those clone fighters all have the same face in them!'],
        ['rick', 'Same face, same orders, same aim, Morty. Which is the problem. Move!'],
      ],
      republicnavy: [
        ['morty', 'Rick, the big arrowhead’s full of clones!'],
        ['rick', 'A Venator, Morty. A flying aircraft carrier staffed by one guy, a million times. Shoot!'],
      ],
      escort: [
        ['morty', 'Rick, fighters on our wing! Are they going to shoot us?'],
        ['rick', 'They’re ours, Morty. We picked a side, the side sends a welcome party. Wave.'],
      ],
      // the outlaws (roamRules.js): what the Star Destroyer launches, the bounty hunters, the pirates
      navy: [
        ['morty', 'Rick, the big triangle’s opening up! Stuff’s coming out of it!'],
        ['rick', 'Bombers and a gunboat, Morty. The Empire’s bringing the heavy stuff. Flattering, honestly.'],
      ],
      fett: [
        ['morty', 'Rick, that ship’s flying sideways! Who flies sideways?!'],
        ['rick', 'Boba Fett, Morty. Best bounty hunter in this galaxy, and somebody paid him for us. Don’t get caught.'],
      ],
      ig88: [
        ['morty', 'Rick, that one’s not even talking. It’s just… coming.'],
        ['rick', 'IG-88, Morty. An assassin droid flying an assassin ship. It doesn’t negotiate and it doesn’t blink.'],
      ],
      bossk: [
        ['morty', 'Rick, there’s a lizard guy on the comms and he’s hissing at us!'],
        ['rick', 'Bossk, Morty. Trandoshan. He hunts Wookiees for fun, so we’re a step down for him. Make him regret it.'],
      ],
      dengar: [
        ['morty', 'Rick, that ship’s got a bandage on it. Like, the pilot. The pilot’s in bandages.'],
        ['rick', 'Dengar, Morty. Half the man he used to be and twice as angry. Shoot the bandages.'],
      ],
      weequay: [
        ['comms', 'Hondo Ohnaka, at your service. Your cargo, if you please.'],
        ['rick', 'Pirates, Morty. Skiffs with guns bolted on. I respect the hustle. Shoot them anyway.'],
      ],
    },
    kill: {
      vulture: [
        ['comms', 'What is my purpose?', 'purpose'],
        ['rick', 'You blow up, buddy. Nailed it.'],
      ],
      trifighter: [
        ['rick', 'Riggity riggity wrecked, son!', 'riggity'],
        ['morty', 'It had three arms, Rick! Three!'],
      ],
    },
  },
  xwing: {
    arrive: {
      tatooine: [
        ['luke', 'Home. If there’s a bright center to the universe, this is the planet farthest from it.'],
        ['comms', 'These aren’t the droids you’re looking for.', 'notTheDroids'],
        ['r2', '[a smug whistle: they absolutely were]'],
      ],
      hoth: [
        ['luke', 'Hoth. A wampa, a night in the snow, and Han cutting open a tauntaun to keep me warm.'],
        ['r2', '[a queasy warble]'],
      ],
      endor: [
        ['comms', 'It’s a trap!', 'itsATrap'],
        ['luke', 'The Emperor’s here, Artoo. And my father. I can feel him.'],
        ['r2', '[a worried warble]'],
      ],
      yavin: [
        ['luke', 'Yavin. The Death Star’s coming round the planet. Just like Beggar’s Canyon back home.'],
        ['r2', '[a nervous whistle: last time here, Vader blasted him]'],
      ],
      alderaan: [
        ['luke', 'This is where Alderaan was, Artoo. Leia’s home.'],
        ['comms', 'That’s no moon. It’s a space station.', 'noMoon'],
        ['luke', 'I have a very bad feeling about this.', 'badFeelingLuke'],
      ],
      bespin: [
        ['luke', 'Bespin. I lost a hand here. And found out who my father was.'],
        ['r2', '[a soft, guilty whistle: he knew all along]'],
      ],
      dagobah: [
        ['luke', 'Dagobah. I know, Artoo, I know. All the scopes are dead again.'],
        ['r2', '[a worried warble: last time, something in the swamp swallowed him]'],
        ['comms', 'Do. Or do not. There is no try.', 'doOrDoNot'],
      ],
      mustafar: [
        ['luke', 'Mustafar. Something terrible happened here, Artoo. I can feel it.'],
        ['r2', '[a quiet, careful beep: he’s been here before, and he isn’t saying]'],
      ],
      coruscant: [
        ['luke', 'Coruscant. The whole planet’s one city. You’ve never seen anything like it, Artoo.'],
        ['r2', '[an amused whistle: he flew through a battle here once]'],
      ],
      naboo: [
        ['luke', 'Naboo. Lakes and waterfalls. It’s beautiful, Artoo.'],
        ['r2', '[a long, soft whistle: this was her home]'],
        ['luke', 'Whose home, Artoo?'],
      ],
      kashyyyk: [
        ['luke', 'Kashyyyk. Chewie’s homeworld. Look at the size of those trees!'],
        ['r2', '[a nervous beep: he once played a Wookiee at holochess, and was told to let him win]'],
      ],
      kamino: [
        ['luke', 'Artoo, this planet isn’t in the archives. Someone erased it.'],
        ['r2', '[a cagey beep: someone did]'],
      ],
      geonosis: [
        ['r2', '[a boastful whistle: he flew through a droid factory here, on rockets]'],
        ['luke', 'Rockets? Artoo, I’ve never once seen you fly.'],
      ],
      scarif: [
        ['luke', 'Scarif. This is where they stole the Death Star plans. The plans you carried, Artoo.'],
        ['r2', '[a slow, solemn whistle]'],
      ],
      nevarro: [
        ['luke', 'Nevarro. Lava, ash and a whole guild of bounty hunters. Keep your head down, Artoo.'],
        ['r2', '[a nervous warble: every hunter in the sector is down there]'],
      ],
      mandalore: [
        ['luke', 'Mandalore. The whole surface is glass. The Empire did this, Artoo.'],
        ['r2', '[a low, mournful whistle: there were cities under domes here once]'],
      ],
      lothal: [
        ['luke', 'Lothal. Grass and rock spires as far as you can see. There was a Jedi here, Artoo. I can feel it.'],
        ['r2', '[a curious warble at something cat-shaped in the grass]'],
      ],
      sorgan: [
        ['luke', 'Sorgan. Forests, ponds, a little village. Somewhere you could hide a child.'],
        ['r2', '[a knowing beep: he knows a desert where someone did]'],
      ],
      felucia: [
        ['luke', 'Felucia. The Clone Wars ended here for a lot of people. The jungle doesn’t look like it noticed.'],
        ['r2', '[a low, wary whistle: something big just moved under the mushrooms]'],
      ],
      kessel: [
        ['luke', 'Kessel. Han always made the run sound like a joke. It isn’t one from up here.'],
        ['r2', '[a sharp warble: the Maw is pulling on the sensors]'],
      ],
      sullust: [
        ['luke', 'Sullust. The fleet gathered here before Endor. I keep expecting to see it still waiting.'],
        ['r2', '[a hopeful chirp: Nien Nunb might be down there]'],
      ],
      pillio: [
        ['luke', 'Pillio. Something brought me here once, after Endor. It’s still here, whatever it is.'],
        ['r2', '[a quiet, puzzled beep: nothing on the scope but water]'],
      ],
      vardos: [
        ['luke', 'Vardos. The Empire’s model world. Whatever they promised these people, they didn’t keep it.'],
        ['r2', '[a grim electronic mutter: storm readings on the surface]'],
      ],
      fondor: [
        ['luke', 'Fondor. Every Star Destroyer we ever ran from was built down there. Keep your eyes on the docks.'],
        ['r2', '[an alarmed string of beeps: a great many turbolasers]'],
      ],
    },
    events: {
      jump: [
        ['luke', 'Coordinates set. Hang on, Artoo!'],
        ['r2', '[a whoop as the stars stretch into lines]'],
      ],
      course: [
        ['luke', 'Artoo, that star. Can you plot a course?'],
        ['r2', '[a quick run of beeps: course plotted, say the word]'],
      ],
      tractor: [
        ['luke', 'Why are we still moving towards it?'],
        ['r2', '[a frantic warble: tractor beam]'],
      ],
      boarded: [
        ['comms', 'TK-421, why aren’t you at your post?'],
        ['luke', 'Artoo, plug in. Find the tractor beam, and find the princess.'],
        ['r2', '[a smug trill: found both]'],
      ],
      ion: [
        ['comms', 'Stand by, ion control… Fire!'],
        ['luke', 'Direct hit! That Star Destroyer’s dead in space.'],
        ['r2', '[a cheering beep]'],
      ],
      superlaser: [
        ['comms', 'You may fire when ready.', 'fireWhenReady'],
        ['luke', 'The Death Star! It’s firing on its own base!'],
        ['r2', '[a horrified shriek]'],
      ],
      'shield-down': [
        ['comms', 'The shield is down! Commence attack on the Death Star’s main reactor.'],
        ['luke', 'They did it! Come on, Artoo!'],
        ['r2', '[a triumphant whistle]', 'r2Whistle'],
      ],
      'shield-up': [
        ['comms', 'Break off the attack! The shield is still up!'],
        ['luke', 'Pulling up! Come on, Han…'],
        ['r2', '[a worried warble]'],
      ],
      'scarif-shield': [
        ['r2', '[an alarmed shriek]'],
        ['luke', 'There’s a shield over the whole planet! We’ll have to go in through the gate.'],
      ],
      escaped: [
        ['luke', 'They made it! They’re away!'],
        ['r2', '[a proud whistle: he’s run a blockade or two himself]'],
      ],
      destroyer: [
        ['r2', '[a frantic warble]'],
        ['luke', 'Star Destroyer, coming out of lightspeed right on top of us!'],
      ],
      find: [
        ['luke', 'Artoo, log this position. Nobody’s been out here in years.'],
        ['r2', '[a low, curious whistle]'],
      ],
      wellclear: [
        ['luke', 'We’re clear of the well. The hyperdrive’s back!'],
        ['r2', '[a relieved whistle: he’s plotting a quieter route]'],
      ],
      // the Galactic Civil War's set pieces (warpieces/)
      'gcw-shieldgen': [
        ['comms', 'The shield is down! Commence attack on the Death Star’s main reactor.'],
        ['luke', 'We got the generator! Artoo, the shield’s down!'],
      ],
      'gcw-superlaser': [
        ['r2', '[A cruiser’s gone: the Death Star fired.]'],
        ['luke', 'That blast came from the Death Star! That thing’s operational!'],
      ],
      'gcw-run': [
        ['luke', 'We’re going in. Artoo, keep an eye on the walls.'],
        ['r2', '[a tense, steady beep]'],
      ],
      'gcw-reactor': [
        ['luke', 'The reactor’s hit! Get us out of here, Artoo!'],
        ['r2', '[a frantic string of beeps: the way out is lit]'],
      ],
      'gcw-ds2': [
        ['luke', 'It’s gone. The Death Star’s gone.'],
        ['r2', '[a long, triumphant whistle]'],
      ],
      'gcw-executor': [
        ['r2', '[The Executor’s lost its bridge. It’s falling.]'],
        ['luke', 'It’s heading straight for the Death Star!'],
      ],
      'gcw-hangar': [
        ['luke', 'Into the hangar, Artoo. The reactor’s up this shaft.'],
        ['r2', '[a worried warble]'],
      ],
      'gcw-isd': [
        ['luke', 'She’s breaking up! We got her from the inside!'],
        ['r2', '[a delighted trill]'],
      ],
      'gcw-ram': [
        ['r2', '[The Hammerhead is pushing the Star Destroyer.]'],
        ['luke', 'They’re ramming it into the other one!'],
      ],
      'gcw-gate': [
        ['comms', 'The shield gate is down! Transmit the plans!'],
        ['luke', 'The plans are away, Artoo. They made it count.'],
      ],
      'gcw-evacuated': [
        ['comms', 'The last transport’s away. Echo Base is clear.'],
        ['luke', 'They’re clear. Let’s get out of here too, Artoo.'],
      ],
      // (the war's battles: battleLines.js, by the side you swore to)
    },
    interdicted: [
      ['r2', '[a panicked shriek]'],
      ['luke', 'We’ve been pulled out of hyperspace! An Interdictor: its gravity well’s got us!'],
    ],
    hunted: {
      separatists: [
        ['luke', 'Droid starfighters? I thought those went out with the Clone Wars!'],
        ['r2', '[an indignant whistle: he’s fought these before]'],
      ],
      remnant: [
        ['luke', 'TIEs! The Emperor’s gone, and they’re still out here.'],
        ['r2', '[an urgent warble: some people don’t know when it’s over]'],
      ],
      // the war's other hunters (warEffects.js: whoever holds a system you're not sworn to), and your own side's wing
      rebellion: [
        ['luke', 'X-wings. Red Squadron. I used to fly with them…'],
        ['r2', '[a reproachful whistle: whose side are we on, exactly?]'],
      ],
      rebelnavy: [
        ['luke', 'A Mon Calamari cruiser, launching. They’ve found us, Artoo.'],
        ['r2', '[a nervous trill]'],
      ],
      newrepublic: [
        ['luke', 'New Republic fighters. Leia’s pilots. I really don’t want to do this.'],
        ['r2', '[a sad, low warble]'],
      ],
      republic: [
        ['luke', 'Clone pilots in ARC-170s. Father flew with men like these.'],
        ['r2', '[a knowing beep: he remembers them]'],
      ],
      republicnavy: [
        ['luke', 'A Venator, launching its fighters. They’re coming for us, Artoo.'],
        ['r2', '[an urgent whistle]'],
      ],
      escort: [
        ['luke', 'Fighters forming up on our wing, Artoo. They’re ours.'],
        ['r2', '[a happy whistle: company]'],
      ],
      weequay: [
        ['comms', 'Hondo Ohnaka, at your service. Your cargo, if you please.'],
        ['luke', 'Pirates. Artoo, they’re after whoever’s nearest. Let’s make it us.'],
      ],
    },
    kill: {
      vulture: [
        ['luke', 'Got the droid!'],
        ['r2', '[a smug whistle]'],
      ],
      trifighter: [
        ['luke', 'Tri-fighter down! Those take some stopping.'],
        ['r2', '[a triumphant whistle]', 'r2Whistle'],
      ],
    },
  },
  falcon: {
    arrive: {
      tatooine: [
        ['han', 'Tatooine. Last time I was here I owed Jabba, and Greedo wanted to talk about it.'],
        ['chewie', '[a knowing grumble: Greedo didn’t get to finish]'],
      ],
      hoth: [
        ['han', 'Hoth. Still cold enough to freeze a tauntaun solid.'],
        ['chewie', '[a warning growl: the asteroid field’s that way, and the odds aren’t good]'],
        ['han', 'Never tell me the odds.', 'neverTellOdds'],
      ],
      endor: [
        ['comms', 'It’s a trap!', 'itsATrap'],
        ['han', 'Endor. Last time, the Ewoks wanted to cook me. I’m staying up here.'],
        ['chewie', '[a guilty rumble: the trap with the meat in it was his fault]'],
      ],
      yavin: [
        ['han', 'Yavin. I came back for the kid here. Don’t spread it around, I got a reputation.'],
        ['chewie', '[a pointed roar: and he still never got a medal]'],
      ],
      alderaan: [
        ['han', 'Our position is correct, except… no Alderaan.'],
        ['comms', 'That’s no moon. It’s a space station.', 'noMoon'],
        ['han', 'It’s too big to be a space station.'],
      ],
      bespin: [
        ['han', 'Bespin. Lando’s place. Last time, he sold us out and Vader put me on ice.'],
        ['chewie', '[a furious roar: he still hasn’t forgiven Lando]'],
      ],
      dagobah: [
        ['han', 'A swamp? The kid trained here? No wonder he came back talking in riddles.'],
        ['chewie', '[a disapproving growl]'],
      ],
      mustafar: [
        ['han', 'Lava planet, big black castle. Let me guess who lives here.'],
        ['chewie', '[a nervous whine: let’s not knock]'],
      ],
      coruscant: [
        ['han', 'Coruscant. Too many cops, too many politicians, and they all want a cut.'],
        ['chewie', '[a grumble about the traffic]'],
      ],
      naboo: [
        ['han', 'Naboo. The Emperor’s from here, you know. Nice lakes, though.'],
        ['chewie', '[an unimpressed grunt]'],
      ],
      kashyyyk: [
        ['chewie', '[a joyful roar: home]', 'chewieRoar'],
        ['han', 'Kashyyyk. Chewie fought the droids here in the Clone Wars. Never lets me forget it.'],
      ],
      kamino: [
        ['han', 'Kamino. So this is where Boba Fett came from. One of him was plenty.'],
        ['chewie', '[a heartfelt roar of agreement]'],
      ],
      geonosis: [
        ['han', 'Geonosis. Bugs, droid factories and a big arena. Not my kind of crowd.'],
        ['chewie', '[a low growl: he’s met their droids]'],
      ],
      scarif: [
        ['han', 'A shield over the whole planet, and one gate. Even I wouldn’t smuggle in here.'],
        ['chewie', '[a solemn rumble: some brave people did]'],
      ],
      nevarro: [
        ['han', 'Nevarro. Half the bounty hunters in the Outer Rim drink here, and I owe the other half.'],
        ['chewie', '[a warning growl: keep the engines warm]'],
      ],
      mandalore: [
        ['han', 'Mandalore. Never met a Mandalorian who didn’t shoot first.'],
        ['chewie', '[a pointed grunt: he’d know all about shooting first]'],
      ],
      lothal: [
        ['han', 'Lothal. Grass, Imperial factories, and a rebel cell that gave the Empire a lot of grief, I hear.'],
        ['chewie', '[an approving roar: his kind of people]'],
      ],
      sorgan: [
        ['han', 'Sorgan. Quiet little backwater. Just where I’d park if somebody was after me.'],
        ['chewie', '[a knowing rumble: somebody always is]'],
      ],
      felucia: [
        ['han', 'Felucia. Never cargo here that wasn’t alive and angry about it. Chewie, keep the ramp shut.'],
        ['chewie', '[a wary growl: something in the mushrooms growled back]'],
      ],
      kessel: [
        ['han', 'Kessel. Twelve parsecs, kid. Don’t let anybody tell you different.'],
        ['chewie', '[a long, pointed moan: the chains in the mines were for Wookiees]'],
      ],
      sullust: [
        ['han', 'Sullust. Nien Nunb’s people. Best mechanics in the Rim, and they’ll tell you so.'],
        ['chewie', '[an approving rumble: the hyperdrive could use them]'],
      ],
      pillio: [
        ['han', 'Pillio. Nothing out here but water and cliffs. Which usually means somebody’s hiding something.'],
        ['chewie', '[a curious bark: shrimp, a lot of them]'],
      ],
      vardos: [
        ['han', 'Vardos. Imperial as it gets. Everybody down there has a uniform, even the kids.'],
        ['chewie', '[a low, unhappy growl: the sky is the wrong colour]'],
      ],
      fondor: [
        ['han', 'Fondor. They build Star Destroyers here, Chewie. We are not stopping for parts.'],
        ['chewie', '[a worried moan: that is a great many Star Destroyers]'],
      ],
    },
    events: {
      jump: [
        ['chewie', '[a hopeful whine: will the hyperdrive work this time?]'],
        ['han', 'It’ll work. Punch it!'],
      ],
      course: [
        ['han', 'Every star out there’s somewhere, pal. Point her nose at one and we punch it.'],
        ['chewie', '[an impatient roar: then punch it]'],
      ],
      tractor: [
        ['han', 'We’re caught in a tractor beam! It’s pulling us in!'],
        ['chewie', '[a furious roar]'],
        ['han', 'I’m gonna have to shut down. But they’re not getting me without a fight!'],
      ],
      boarded: [
        ['comms', 'TK-421, why aren’t you at your post?'],
        ['han', 'Into the smuggling compartments, Chewie. Never thought I’d be smuggling myself.'],
        ['chewie', '[a muffled, cramped grumble]'],
      ],
      ion: [
        ['han', 'There goes the ion cannon. Now’s our chance, Chewie!'],
        ['chewie', '[an approving roar]'],
      ],
      superlaser: [
        ['han', 'They’re shooting at their own planet!'],
        ['chewie', '[a horrified roar]'],
        ['han', 'That’s the Empire. Not even their own people are safe.'],
      ],
      'shield-down': [
        ['comms', 'The shield is down! Commence attack on the Death Star’s main reactor.'],
        ['han', 'That’s our cue. Not a scratch on her this time, Chewie.'],
        ['chewie', '[a doubtful rumble]'],
      ],
      'shield-up': [
        ['comms', 'Break off the attack! The shield is still up!'],
        ['han', 'Back up? Somebody down there’s not doing their job.'],
        ['chewie', '[an indignant roar: he means “that was us”]'],
      ],
      'scarif-shield': [
        ['han', 'A shield over the whole planet? Who does that?'],
        ['chewie', '[a pointed growl: the gate, Han]'],
        ['han', 'I know where the gate is.'],
      ],
      escaped: [
        ['han', 'They made the jump! Not bad for a ship that isn’t the Falcon.'],
        ['chewie', '[a pleased rumble]'],
      ],
      destroyer: [
        ['han', 'Came out of lightspeed way too close. Somebody’s admiral is in trouble.'],
        ['chewie', '[a nervous growl]'],
      ],
      find: [
        ['han', 'Well, look at that. Told you there’d be something worth finding out here.'],
        ['chewie', '[a pleased rumble]'],
      ],
      wellclear: [
        ['han', 'Out of the well. Hyperdrive’s back. Told you she could do it.'],
        ['chewie', '[a long, relieved groan]'],
      ],
      // the Galactic Civil War's set pieces (warpieces/)
      'gcw-shieldgen': [
        ['comms', 'The shield is down! Commence attack on the Death Star’s main reactor.'],
        ['han', 'Shield’s down. Hear that, Chewie? We’re going in.'],
      ],
      'gcw-superlaser': [
        ['chewie', '[an alarmed roar: a cruiser just vanished]'],
        ['han', 'That thing’s operational. Stay close to their Star Destroyers. They won’t fire on their own.'],
      ],
      'gcw-run': [
        ['han', 'Tight squeeze. I’ve flown worse. Don’t ask where.'],
        ['chewie', '[a nervous growl]'],
      ],
      'gcw-reactor': [
        ['han', 'That’s it! Now punch it, Chewie, punch it!'],
        ['chewie', '[a roar, and the engines scream]'],
      ],
      'gcw-ds2': [
        ['han', 'Woo-hoo! Told you we’d make it out.'],
        ['chewie', '[a long, joyful howl]'],
      ],
      'gcw-executor': [
        ['chewie', '[an amazed roar]'],
        ['han', 'The big one just flew into the Death Star. That’s gotta hurt.'],
      ],
      'gcw-hangar': [
        ['han', 'Into their hangar. Bold. Stupid. My two favourite things.'],
        ['chewie', '[a doubtful groan]'],
      ],
      'gcw-isd': [
        ['han', 'She’s coming apart! Never tell me the odds.'],
        ['chewie', '[a triumphant roar]'],
      ],
      'gcw-ram': [
        ['han', 'That Hammerhead’s shoving a Star Destroyer around. I like their style.'],
        ['chewie', '[an impressed growl]'],
      ],
      'gcw-gate': [
        ['comms', 'The shield gate is down! Transmit the plans!'],
        ['han', 'Two Star Destroyers through the front door. That’s one way to knock.'],
      ],
      'gcw-evacuated': [
        ['comms', 'The last transport’s away. Echo Base is clear.'],
        ['han', 'Everybody’s out. Our turn, Chewie. Let’s go.'],
      ],
      // (the war's battles: battleLines.js, by the side you swore to)
    },
    interdicted: [
      ['han', 'That’s an Interdictor! They yanked us right out of hyperspace!'],
      ['chewie', '[a furious roar]'],
      ['han', 'Somebody’s been counting our jumps. Hold on.'],
    ],
    hunted: {
      separatists: [
        ['han', 'Droid fighters? What year is it?'],
        ['chewie', '[an angry roar: he fought these on Kashyyyk]'],
      ],
      remnant: [
        ['han', 'TIEs? The Empire’s finished. Somebody forgot to tell these guys.'],
        ['chewie', '[a defiant roar]'],
      ],
      // the war's other hunters (warEffects.js: whoever holds a system you're not sworn to), and your own side's wing
      rebellion: [
        ['han', 'The Rebellion’s shooting at me. Can’t say I didn’t see that coming.'],
        ['chewie', '[a told-you-so growl]'],
      ],
      rebelnavy: [
        ['han', 'Mon Cal cruiser, launching. Somebody’s not happy with my career choices.'],
        ['chewie', '[an exasperated roar]'],
      ],
      newrepublic: [
        ['han', 'New Republic. Same X-wings, more forms to fill in. Punch it, Chewie.'],
        ['chewie', '[an agreeing bark]'],
      ],
      republic: [
        ['han', 'Clones. Nobody told them the war’s been over for twenty years? Oh. It hasn’t.'],
        ['chewie', '[an angry roar]'],
      ],
      republicnavy: [
        ['han', 'Venator. Big, slow, and full of guys who look the same. Let’s go.'],
        ['chewie', '[a grumble]'],
      ],
      escort: [
        ['han', 'Company on our wing. Friendly, for once.'],
        ['chewie', '[a pleased rumble]'],
      ],
      weequay: [
        ['comms', 'Hondo Ohnaka, at your service. Your cargo, if you please.'],
        ['han', 'Hondo. I still owe him for Florrum. Chewie, let’s not pay him today.'],
      ],
    },
    kill: {
      vulture: [
        ['han', 'Scratch one droid.'],
        ['chewie', '[a satisfied roar]'],
      ],
      trifighter: [
        ['han', 'That one took a few. She’s still got it.'],
        ['chewie', '[a triumphant roar]', 'chewieRoar'],
      ],
    },
  },
  rv: {
    arrive: {
      tatooine: [
        ['jesse', 'Yo, two suns! It’s like Albuquerque in July, times two!'],
        ['walt', 'A desert run by a crime lord, Jesse. Water’s the product here. They pull it out of the air.'],
      ],
      hoth: [
        ['jesse', 'Mr. White, it’s all snow! The RV doesn’t even have heat!'],
        ['walt', 'Then keep the engine running, Jesse. Out there, nothing lasts the night.'],
      ],
      endor: [
        ['comms', 'It’s a trap!', 'itsATrap'],
        ['jesse', 'Yo, who said that? Is it a trap? Mr. White, is it a trap?!'],
        ['walt', 'Everything’s a trap, Jesse. The trick is knowing whose.'],
      ],
      yavin: [
        ['jesse', 'Yo, they’re gonna fight that giant death ball with those little planes?'],
        ['walt', 'One exhaust port, two meters wide, straight to the reactor. Their engineer should be fired.'],
      ],
      alderaan: [
        ['jesse', 'Mr. White, there’s supposed to be a planet here. It’s all just rocks.'],
        ['walt', 'Alderaan, Jesse. They destroyed it to make a point.'],
        ['comms', 'That’s no moon. It’s a space station.', 'noMoon'],
      ],
      bespin: [
        ['jesse', 'Yo, a whole city floating in the clouds! How does that even work?'],
        ['walt', 'A businessman here cut a deal with the wrong partner, Jesse. I know the feeling.'],
      ],
      dagobah: [
        ['comms', 'Do. Or do not. There is no try.', 'doOrDoNot'],
        ['jesse', 'Yo, the swamp is giving me life advice.'],
        ['walt', 'He’s right, Jesse. I’ve been telling you that for years.'],
      ],
      mustafar: [
        ['jesse', 'Yo, it’s all lava! Like, all of it!'],
        ['walt', 'A man came here a hero, Jesse, and left as something else entirely.'],
        ['jesse', 'That… sounds like somebody I know.'],
      ],
      coruscant: [
        ['jesse', 'Yo, the whole planet is one big city!'],
        ['comms', 'Hi, I’m Saul Goodman. Did you know that you have rights?', 'saulHi'],
        ['walt', 'A trillion people, Jesse, and somehow Saul still bought the ad space.'],
      ],
      naboo: [
        ['jesse', 'Yo, it’s like, so pretty. Lakes and waterfalls and stuff.'],
        ['walt', 'A polite, patient senator from here ran everything in secret, Jesse. I’ve met the type.'],
      ],
      kashyyyk: [
        ['jesse', 'Yo, these trees are huge! Like, skyscraper huge!'],
        ['walt', 'Wookiee country, Jesse. If you play them at anything, let the Wookiee win.'],
      ],
      kamino: [
        ['walt', 'Cloning, Jesse. One template, millions of units, perfect consistency.'],
        ['jesse', 'Yeah, Mr. White! Yeah, science!', 'yeahScience'],
      ],
      geonosis: [
        ['jesse', 'Yo, there’s a whole factory down there just making robots.'],
        ['walt', 'Droid foundries, Jesse. Production at scale. Now that is a superlab.'],
      ],
      scarif: [
        ['jesse', 'Yo, a beach planet! Can we stop, Mr. White? Like, for an hour?'],
        ['walt', 'It’s an Imperial records vault with a shield over the whole planet, Jesse. We are not stopping.'],
      ],
      nevarro: [
        ['jesse', 'Yo, everybody here’s got a helmet and a blaster. Like, everybody.'],
        ['walt', 'A guild of hunters, Jesse, paid by the head. Keep your hood up and your mouth shut.'],
      ],
      mandalore: [
        ['jesse', 'Yo, the whole planet’s glass. Like, sand that got cooked.'],
        ['walt', 'Trinitite, Jesse. They left the same glass in the New Mexico desert in 1945.'],
      ],
      lothal: [
        ['jesse', 'Yo, grass for miles, and those rocks sticking up like giant fingers. It’s kinda beautiful.'],
        ['walt', 'The Empire built factories here, Jesse. They took a beautiful place and made it a supply chain.'],
      ],
      sorgan: [
        ['jesse', 'Yo, a little farm village by a pond. Mr. White, can we just… live here?'],
        ['walt', 'Krill, Jesse. A small, honest product. It never lasts. Somebody always comes for the farm.'],
      ],
      felucia: [
        ['jesse', 'Yo, Mr. White, those are mushrooms! Giant, like, trippy mushrooms!'],
        ['walt', 'Fungi, Jesse. An entire biosphere of them. Don’t breathe deeply and don’t touch the pink ones.'],
      ],
      kessel: [
        ['jesse', 'Spice mines, Mr. White. It’s like… a whole planet that cooks.'],
        ['walt', 'Mined, Jesse, not cooked. Slave labour and a monopoly. Say what you like about the Empire, it understands distribution.'],
      ],
      sullust: [
        ['jesse', 'The ground’s on fire, yo. Like actually on fire.'],
        ['walt', 'Volcanic, Jesse. They build starships in the lava tubes. The chemistry down there is remarkable.'],
      ],
      pillio: [
        ['jesse', 'Beach planet, Mr. White. Cliffs and ocean and nobody around. We could just stay.'],
        ['walt', 'Nobody is ever around a place like this by accident, Jesse. Somebody buried something here.'],
      ],
      vardos: [
        ['jesse', 'It’s all grey and clean down there. Like a hospital, but a whole city.'],
        ['walt', 'Vardos, Jesse. The Empire built it to be looked at. Look at what it did to it when it was done.'],
      ],
      fondor: [
        ['jesse', 'Mr. White, there’s giant ships in giant cages all the way round the planet!'],
        ['walt', 'Shipyards, Jesse. Star Destroyers. We are a camper van in a gun factory. Drive carefully.'],
      ],
    },
    events: {
      jump: [
        ['walt', 'Pull the lever, Jesse.'],
        ['jesse', 'Yo, the stars went all stretchy! The RV’s doing lightspeed!'],
      ],
      course: [
        ['jesse', 'Yo, Mr. White, that star’s got a name. They all got names!'],
        ['walt', 'Every one is a system, Jesse. We point at one, and we jump.'],
      ],
      tractor: [
        ['jesse', 'Mr. White, the wheel’s not doing anything! Something’s got us!'],
        ['walt', 'A tractor beam. They’re reeling us in, Jesse. Stay calm, and let me do the talking.'],
      ],
      boarded: [
        ['comms', 'TK-421, why aren’t you at your post?'],
        ['jesse', 'This is my own private domicile and I will not be harassed, bitch!', 'domicile'],
        ['walt', 'Jesse. We’re parked inside their battle station. It’s their domicile.'],
      ],
      ion: [
        ['jesse', 'Yo! The ice planet just zapped that big triangle!'],
        ['walt', 'An ion pulse, Jesse. It wipes their electronics.'],
        ['jesse', 'Like our magnet! Yeah, magnets!'],
      ],
      superlaser: [
        ['jesse', 'Yo! They just shot their own base! Their own people!'],
        ['walt', 'Covering their tracks, Jesse. When the lab’s compromised, you burn the lab.'],
      ],
      'shield-down': [
        ['comms', 'The shield is down! Commence attack on the Death Star’s main reactor.'],
        ['jesse', 'The force field’s down! Mr. White, we can go in!'],
        ['walt', 'The main reactor, Jesse. Take out the heart of an operation and the rest falls.'],
      ],
      'shield-up': [
        ['comms', 'Break off the attack! The shield is still up!'],
        ['jesse', 'Yo, it’s back! The force field thing is back!'],
        ['walt', 'Then we wait, Jesse. Patience is half the job.'],
      ],
      'scarif-shield': [
        ['jesse', 'Yo, we bounced! The whole planet’s got a force field!'],
        ['walt', 'A perimeter, Jesse. There’s a gate. There is always a gate.'],
      ],
      escaped: [
        ['jesse', 'Yo, they made it out! They jumped!'],
        ['walt', 'A clean exit, Jesse. Always have one planned.'],
      ],
      destroyer: [
        ['jesse', 'Yo, a giant triangle just showed up out of nowhere!'],
        ['walt', 'A Star Destroyer, Jesse. The DEA of this galaxy. Don’t speed.'],
      ],
      find: [
        ['jesse', 'Yo, Mr White, what even is that?'],
        ['walt', 'Something nobody else has found, Jesse. Write it down.'],
      ],
      wellclear: [
        ['walt', 'We’re clear of the well, Jesse. The drive will take.'],
        ['jesse', 'Can we, like, not do that again for a while?'],
      ],
      // the Galactic Civil War's set pieces (warpieces/)
      'gcw-shieldgen': [
        ['comms', 'The shield is down! Commence attack on the Death Star’s main reactor.'],
        ['jesse', 'Yeah, science! We totally fried their shield, Mr. White!'],
      ],
      'gcw-superlaser': [
        ['jesse', 'Yo, the Death Star just vaporised one of our ships!'],
        ['walt', 'It’s fully armed, Jesse. Keep moving. A moving target lives.'],
      ],
      'gcw-run': [
        ['walt', 'We go in, we hit the reactor, we leave. Clean. Professional.'],
        ['jesse', 'This tunnel is way too small for an RV, Mr. White!'],
      ],
      'gcw-reactor': [
        ['walt', 'The reactor is compromised. Jesse, drive. Now!'],
        ['jesse', 'Going, going, going!'],
      ],
      'gcw-ds2': [
        ['jesse', 'Mr. White, we blew up a Death Star! In an RV!'],
        ['walt', 'I am the one who knocks, Jesse. Twice, apparently.'],
      ],
      'gcw-executor': [
        ['jesse', 'Yo, the giant ship just nosedived into the Death Star!'],
        ['walt', 'Lose the head, and the body follows. Remember that.'],
      ],
      'gcw-hangar': [
        ['walt', 'Into the hangar. Every operation has a loading dock, Jesse.'],
        ['jesse', 'This is so not a good idea.'],
      ],
      'gcw-isd': [
        ['jesse', 'It’s falling apart, Mr. White! We did that!'],
        ['walt', 'Purity of execution, Jesse.'],
      ],
      'gcw-ram': [
        ['jesse', 'That little ship is pushing the huge one! That’s insane!'],
        ['walt', 'Leverage, Jesse. Apply force at the right point.'],
      ],
      'gcw-gate': [
        ['comms', 'The shield gate is down! Transmit the plans!'],
        ['walt', 'Two Star Destroyers, one gate. Elegant.'],
      ],
      'gcw-evacuated': [
        ['comms', 'The last transport’s away. Echo Base is clear.'],
        ['jesse', 'They got out! Can we get out now too?'],
      ],
      // (the war's battles: battleLines.js, by the side you swore to)
    },
    interdicted: [
      ['jesse', 'Yo, the stretchy stars stopped! Why’d the stretchy stars stop?!'],
      ['walt', 'An Interdictor, Jesse. A gravity well. Somebody has been counting our jumps.'],
    ],
    hunted: {
      separatists: [
        ['jesse', 'Yo, robot bird things! They’re shooting at us!'],
        ['walt', 'Automated, Jesse. No judgment, no imagination. We out-think them.'],
      ],
      remnant: [
        ['jesse', 'Yo, bug zappers again! I thought the bad guys lost!'],
        ['walt', 'An empire never dies all at once, Jesse. The remnants are the dangerous part.'],
      ],
      // the war's other hunters (warEffects.js: whoever holds a system you're not sworn to), and your own side's wing
      rebellion: [
        ['jesse', 'Yo, the X-wing guys are mad at us! Those are the heroes, Mr. White!'],
        ['walt', 'Heroes are a matter of whose side you’re on, Jesse. We chose. Fly.'],
      ],
      rebelnavy: [
        ['jesse', 'Yo, the big fish ship’s spitting out fighters!'],
        ['walt', 'A capital ship launching its wing, Jesse. They want us gone. Move.'],
      ],
      newrepublic: [
        ['jesse', 'Yo, it’s the New Republic! It’s like the DEA but in space!'],
        ['walt', 'Precisely like the DEA, Jesse. Thorough, underfunded, and persistent. Lose them.'],
      ],
      republic: [
        ['jesse', 'Yo, these dudes are all clones? That’s messed up, man!'],
        ['walt', 'A perfectly standardised product, Jesse. Admirable. Now outfly it.'],
      ],
      republicnavy: [
        ['jesse', 'Yo, the giant arrow ship’s launching!'],
        ['walt', 'A Venator, Jesse. Remarkable logistics. Unfortunately for us.'],
      ],
      escort: [
        ['jesse', 'Yo, we got backup! Those guys are with us, right?'],
        ['walt', 'Our side looks after its own, Jesse. Professional courtesy.'],
      ],
      // the outlaws (roamRules.js): what the Star Destroyer launches, the bounty hunters, the pirates
      navy: [
        ['jesse', 'Mr. White, the big ship’s letting stuff out! Fat ones and a… a boxy one!'],
        ['walt', 'Bombers, Jesse, and something to keep us busy while they line up. Don’t fly straight.'],
      ],
      fett: [
        ['jesse', 'Yo, that one’s flying on its side! Who does that?'],
        ['walt', 'A professional, Jesse. Someone has put a price on us. I’d like to know who, and how much.'],
      ],
      ig88: [
        ['jesse', 'It’s not saying anything, Mr. White. It’s just coming straight at us.'],
        ['walt', 'A machine, Jesse. No fear, no greed, no second thoughts. We have all three. Use them.'],
      ],
      bossk: [
        ['jesse', 'There’s a lizard on the radio and it’s hissing at us, yo!'],
        ['walt', 'Then it’s a lizard with a very poor sense of who it’s hunting.'],
      ],
      dengar: [
        ['jesse', 'The guy flying that thing is wrapped in bandages, Mr. White. Like a mummy.'],
        ['walt', 'A man who has been hurt before and kept coming, Jesse. Respect that, and shoot him down anyway.'],
      ],
      weequay: [
        ['comms', 'Hondo Ohnaka, at your service. Your cargo, if you please.'],
        ['walt', 'Pirates. Jesse, we are not carrying cargo. We are the cargo. Lose them.'],
      ],
    },
    kill: {
      vulture: [
        ['jesse', 'Robot bird down! Yeah!'],
        ['walt', 'One less unit, Jesse. Keep counting.'],
      ],
      trifighter: [
        ['jesse', 'Yeah, Mr. White! Yeah, science!', 'yeahScience'],
        ['walt', 'Three hits for three arms, Jesse. Persistence.'],
      ],
    },
  },
};

// A crew (universe/crews.js) as it is in the galaxy: its own lines, with
// the galaxy's arrivals in place of the universe map's (there are no
// stations or fandom planets here) and the galaxy's events, hunters and
// kills over its own (so a TIE shot down still gets the crew's own line).
// A crew the galaxy has nothing for comes back as it was.
export function galaxyCrew(crew) {
  const g = crew && GALAXY_LINES[crew.id];
  if (!g) return crew ?? null;
  return {
    ...crew,
    arrive: g.arrive,
    events: { ...crew.events, ...g.events },
    hunted: { ...crew.hunted, ...g.hunted },
    kill: { ...crew.kill, ...g.kill },
    interdicted: g.interdicted ?? crew.interdicted,
  };
}
