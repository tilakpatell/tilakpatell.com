// Who flies you round the universe map: Rick and Morty in the space cruiser,
// Luke and Artoo in an X-wing, Han and Chewie in the Millennium Falcon, or
// Walt and Jesse in their RV, which has grown wings.
// Pure data: the panel offers the ships, the scene builds the one picked and
// the comms box says these lines as things happen.
//
// A line is [speaker, text, clip?]; an exchange is a list of lines said in
// turn. A line with a clip (lib/clips.js) plays the recording under its
// subtitle; the rest are voiced by sounds.js. The speaker 'comms' is a
// voice on the radio that isn't one of the crew (no face).
// `arrive` has one exchange per place on the map (the stations and the
// planets), said the first time you reach it.
// Artoo and Chewie don't speak Basic: their lines are what they mean, in
// brackets, and sound like them (sounds.js).
// `jump` is how the crew crosses the map at hyperspeed (components/jumps/
// styles.js): the X-wing and the Falcon on the site's jump to lightspeed,
// Rick's cruiser through a portal, the RV crystallising into Blue Sky.

export const CREWS = [
  {
    id: 'cruiser',
    ship: 'The space cruiser',
    label: 'Rick and Morty',
    jump: 'portal',
    speakers: {
      rick: { name: 'Rick', color: '#a8dcf0', voice: 'rick' },
      morty: { name: 'Morty', color: '#f5d33f', voice: 'morty' },
      meeseeks: { name: 'Mr. Meeseeks', color: '#7cc8ec', voice: 'morty' },
      birdperson: { name: 'Birdperson', color: '#c98b52', voice: 'birdperson' }, // (no blips: his own voice, where it's made)
    },
    // the Citadel's siege (siege.js): its shield, a generator going, the
    // core shrugging off the lasers, the whole thing going up, and back
    siege: {
      shielded: [
        ['morty', 'It’s got a shield, Rick! The shots just bounce off!'],
        ['rick', 'So take out the generators on the arms, Morty. Siege one-oh-one.'],
      ],
      gen: [
        ['morty', 'We got one, Rick! A shield generator!'],
        ['rick', 'Don’t get cocky, Morty. Ricks build redundancy. It’s the only thing we build.'],
      ],
      shield: [['rick', 'Shield’s down! Now the core, Morty. Portal grenades. The heavy stuff, press three!']],
      deflect: [['rick', 'Lasers won’t scratch that core, Morty. Grenades. Three. Come on.']],
      dry: [['morty', 'We’re out of grenades, Rick!']],
      down: [
        ['morty', 'Oh geez, Rick, we blew up the Citadel!'],
        ['rick', 'Relax, Morty. Infinite Ricks, infinite Citadels. They’ll portal a new one in by lunch.'],
      ],
      rebuilt: [['rick', 'And there it is, rebuilt. Bureaucracy, Morty: the one thing in the multiverse you can’t kill.']],
      closed: [['rick', 'Nothing to land on, Morty. We kinda blew it up.']],
    },
    // out of the ship on a planet (footScene.js): coming down, getting out,
    // the Federation's squads, shooting them, getting hit, going down and
    // getting up, playing the other one, wandering off, and back in
    foot: {
      land: [
        ['rick', 'Alright Morty, we’re putting down. Bring a gun.'],
        ['morty', 'W-why do I need a gun, Rick?'],
      ],
      out: [
        ['rick', 'Fresh air, Morty! Well, air. Probably air.'],
        ['morty', 'It smells like feet, Rick.'],
      ],
      // (by who most of them are: footScene.js says)
      squad: {
        any: [
          ['morty', 'Rick! Federation guys, over the hill!'],
          ['rick', 'Gromflomites, Morty. Shoot the bugs.'],
        ],
        mortyguard: [
          ['morty', 'Rick, those guys coming over the hill are… all me. In yellow.'],
          ['rick', 'Evil Morty’s guard, Morty. Don’t hesitate. They won’t.'],
        ],
      },
      kill: {
        gromflomite: [['rick', 'Bug splat! Ha!']],
        cop: [
          ['morty', 'I-I shot a cop, Rick!'],
          ['rick', 'A Federation cop, Morty. Different rules.'],
        ],
        gazorpian: [['morty', 'The big one went down! The big one went down!']],
        mortyguard: [
          ['morty', 'Rick, I just shot… a me. In a yellow shirt.'],
          ['rick', 'Evil Morty’s guard, Morty. Infinite Mortys. Don’t get sentimental.'],
        ],
        any: [['rick', 'Wubba lubba dub dub!', 'wubba']],
      },
      hurt: [
        ['morty', 'Ow! Rick, they’re actually shooting!'],
        ['rick', 'That’s what guns do, Morty.'],
      ],
      down: [
        ['morty', 'Rick! I-I think I’m dead!'],
        ['rick', 'You’re not dead, Morty. Dead people don’t whine.'],
      ],
      up: [['morty', 'Okay. Okay, I’m up.']],
      cleared: [['rick', 'And that’s a picnic, Morty. Federation-style.']],
      swap: {
        rick: [['rick', 'Fine, I’ll drive this one.']],
        morty: [['morty', 'O-okay, I got this. I think I got this.']],
      },
      // B: Rick's next gadget (by the gun)
      gadget: {
        portal: [['rick', 'Back to the classic. Holes in space, Morty. Holes.']],
        freeze: [
          ['rick', 'Freeze ray. Let’s put these guys on ice.'],
          ['morty', 'Rick, did you just—'],
          ['rick', 'Yes, Morty. A pun. I’m allowed one.'],
        ],
        shrink: [
          ['rick', 'Shrink ray. Small problems, Morty. Literally.'],
          ['morty', 'Isn’t that the one from the—'],
          ['rick', 'Don’t say Anatomy Park.'],
        ],
      },
      far: [['rick', 'The cruiser’s back that way, Morty. Walk.']],
      nowhere: [['rick', 'Land on what, Morty? Space? Find a planet.']],
      in: [
        ['morty', 'Can we go home now?'],
        ['rick', 'We’re going somewhere, Morty.'],
      ],
      // another pilot's crew down here too, and the same person from another dimension (by who)
      friend: [
        ['morty', 'Rick! Somebody else just landed!'],
        ['rick', 'Great. Tourists.'],
      ],
      alt: {
        rick: [
          ['morty', 'Rick, there’s another you over there!'],
          ['rick', 'A Rick from another dimension. Don’t trust him, Morty. I wouldn’t.'],
        ],
        morty: [
          ['rick', 'Look, Morty, another Morty. Wave at yourself.'],
          ['morty', 'H-hey, other me. You doing okay?'],
        ],
        any: [['rick', 'Somebody’s a long way from their own dimension, Morty.']],
      },
    },
    launch: [
      ['rick', 'Wubba lubba dub dub!', 'wubba'],
      ['rick', 'Alright Morty, the whole site’s out here. Try not to touch anything.'],
      ['morty', 'Aw jeez, Rick. Which one first?'],
    ],
    boost: [['rick', 'Wubba lubba dub dub!', 'wubba']],
    bump: [
      ['rick', 'Riggity riggity wrecked, son!', 'riggity'],
      ['morty', 'Rick, you flew into a planet!'],
    ],
    // into a planet too fast (the cruiser comes back through a portal)
    crash: [
      ['comms', 'I can’t take it anymore. I just wanna die.', 'cantTakeIt'],
      ['morty', 'Rick! We crashed into a planet, Rick!'],
      ['rick', 'Relax, Morty. I backed us up. Portal’s open.'],
    ],
    // caught in the black hole's pull (maw.js), and still able to get out
    pulled: [
      ['morty', 'R-Rick, it’s pulling us in! Rick!'],
      ['rick', 'Then hit the boost, Morty! Gravity doesn’t care how smart you are!'],
    ],
    // into the black hole: no coming back from this one (on its far side is
    // a friend's universe, deep.js's `beyond`, and the page goes on to it)
    swallowed: [
      ['morty', 'Rick! It’s got us! We’re going in!'],
      ['rick', 'Relax, Morty. It’s not spaghetti. It’s somebody’s Matrix.'],
    ],
    // sitting still a while
    idle: [['rick', 'Lick, lick, lick my balls! Ha ha! Yeah! Say that all the time!', 'lickLick']],
    // something flying past you (traffic.js)
    traffic: {
      patrol: [
        ['morty', 'Rick, it’s the Federation!'],
        ['rick', 'Act natural, Morty. We’re two guys out for a drive.'],
      ],
      gromflomite: [
        ['morty', 'Bugs, Rick! Space bugs!'],
        ['rick', 'Gromflomites, Morty. The Federation’s errand boys.'],
      ],
      meeseeks: [
        ['meeseeks', 'I’m Mr. Meeseeks! Look at me!', 'meeseeks'],
        ['morty', 'What’s he even doing out here?'],
      ],
      birdperson: [
        ['morty', 'Is that Birdperson?'],
        ['rick', 'My man.', 'myMan'],
      ],
    },
    // shooting one down
    kill: {
      phoenixperson: [['rick', 'Sorry, Birdperson. Again. We’ll get you rebuilt. Again.']],
      any: [
        ['morty', 'Oh geez, Rick, I hit one!'],
        ['rick', 'Relax, Morty. It’s the Federation. Nobody’s gonna miss ’em.'],
      ],
      meeseeks: [
        ['morty', 'Rick! I popped a Meeseeks!'],
        ['rick', 'He’s fine, Morty. Existence is pain to a Meeseeks.'],
      ],
      birdperson: [
        ['birdperson', 'In bird culture, this is considered a dick move.', 'birdCulture'],
        ['morty', 'Rick, I shot Birdperson!'],
        ['rick', 'He’ll be fine, Morty. Phoenixperson’s a whole thing.'],
      ],
      saucer: [
        ['morty', 'Rick! That was a family!'],
        ['rick', 'They had it coming, Morty. Probably.'],
      ],
      hauler: [['rick', 'Whoops. There goes somebody’s plumbus delivery.']],
      gearship: [
        ['morty', 'Rick, you shot a Gear Person!'],
        ['rick', 'Revolio’s gonna be so mad, Morty.'],
      ],
      councilship: [
        ['morty', 'I got one of the Ricks!'],
        ['rick', 'One less Rick, Morty. The multiverse can spare it.'],
      ],
      krombopulos: [
        ['morty', 'I got him, Rick! The assassin guy!'],
        ['rick', 'Krombopulos Michael. He loved killing, Morty. Didn’t love this.'],
      ],
      evilmortyship: [
        ['morty', 'Rick, I hit him! I hit… me?'],
        ['rick', 'He’s not you, Morty. He’s the you that thought it through. He’ll be back.'],
      ],
      zigerion: [
        ['rick', 'Got one. Or did I? With Zigerions you never know, Morty.'],
        ['morty', 'Is any of this real, Rick?'],
      ],
      squanchship: [
        ['morty', 'Rick! I shot Squanchy!'],
        ['rick', 'He’ll squanch it off, Morty.'],
      ],
      poopyship: [
        ['morty', 'Oh no, Rick, I shot Mr. Poopybutthole!'],
        ['rick', 'Ooh-wee. That’s a long recovery arc, Morty.'],
      ],
    },
    // hunters after you (hunters.js), by who they are
    hunted: {
      // the police, sent when you're wanted (wanted.js)
      fedpolice: [
        ['morty', 'Rick, Federation police! Like, actual space cops!'],
        ['rick', 'They’ve got stun guns and missiles, Morty. Don’t let them pin the drive.'],
      ],
      phoenix: [
        ['rick', 'Phoenixperson. Great. The Federation turned my best friend into a drone with a grudge.'],
        ['morty', 'Can we talk to him, Rick?'],
        ['rick', 'He talks in bullets now, Morty.'],
      ],
      federation: [
        ['morty', 'Rick! The Federation’s on our tail!'],
        ['rick', 'Course they are, Morty. I’m the most wanted man in the galaxy. Shoot back!'],
      ],
      council: [
        ['comms', 'Rick Sanchez of Earth C-137, by order of the Council of Ricks: surrender your portal gun.'],
        ['rick', 'The Council. A bunch of Ricks who think they’re better than me. Light ’em up, Morty.'],
      ],
      // Evil Morty's guard: a swarm of Mortys in yellow fighters
      mortys: [
        ['morty', 'Rick, those ships are full of… Mortys!'],
        ['rick', 'Evil Morty’s guard, Morty. A whole swarm of you. Try not to take it personally.'],
      ],
      // and Evil Morty himself at their head
      ace: [
        ['morty', 'Rick, the black one with the eye patch… is that him?'],
        ['rick', 'Evil Morty. The one Morty who figured it out. Don’t let him get behind us.'],
      ],
      zigerions: [
        ['rick', 'Zigerions. Con men with spaceships, Morty. If one vanishes when you hit it, it was never there.'],
        ['morty', 'How do we know this isn’t a simulation, Rick?'],
        ['rick', 'We don’t, Morty. Shoot anyway.'],
      ],
      // what the Federation cruiser launches
      fedfleet: [
        ['morty', 'Rick! It’s launching gunships!'],
        ['rick', 'Big ones sit back and shoot, Morty. Go in after them.'],
      ],
      krombopulos: [
        ['comms', 'Oh boy, here I go killing again!'],
        ['morty', 'Rick, he’s just sitting on us. He’s not even shooting.'],
        ['rick', 'Krombopulos Michael, Morty. He waits for you to start it. So don’t. Or do, and shoot better.'],
      ],
    },
    // their lasers hitting you, your shields low, shot down
    // dropped out of the pulse drive by hunters, and crashes of other kinds
    // the named characters who come by (npcs/index.js), by what they're saying
    npc: {
      // the Federation's agent, come for Rick in person (a nemesis: she remembers)
      tammy: {
        seen: [['morty', 'Rick, that gunship’s coming straight at us. Fast.']],
        hello: [
          ['comms', 'Rick Sanchez. Tammy. Remember me? Birdperson’s wife. The Federation sends its regards.'],
          ['rick', 'Tammy. You shot my best friend at your own wedding. I’m not gonna be nice about this.'],
        ],
        again: [
          ['comms', 'Miss me, Rick? I’ve been thinking about you. Every day.'],
          ['rick', 'Oh great, she’s back. She’s always back, Morty. Like herpes with a pension.'],
        ],
        hit: [['comms', 'Ow! Okay. Okay, Rick. Now it’s personal. More personal.']],
        half: [
          ['comms', 'You think you’re winning? I’ve got half a hull and all of the Federation.'],
          ['morty', 'Rick, she’s smoking! Keep going!'],
        ],
        weak: [
          ['comms', 'Shields failing, Rick? Birdperson’s were too.'],
          ['rick', 'Don’t you say his name. Morty, divert everything. Everything!'],
        ],
        evade: [['comms', 'Nice try. I trained with Birdperson. I know every move you taught him.']],
        fury: [['comms', 'No more games, Rick. NO MORE GAMES!'], ['rick', 'She’s lost it, Morty! Everything she’s got, all at once! Don’t fly straight!']],
        retreat: [
          ['comms', 'This isn’t over, Rick. It’s never over. I’ll see you soon.'],
          ['rick', 'She’ll be back, Morty. Tougher. They always come back tougher. It’s a whole thing.'],
        ],
        bait: [['morty', 'Rick, she’s slowing down, why is she— oh no, oh no, she’s BEHIND us!'], ['rick', 'Yeah, Morty, that’s called a bait. I invented it.']],
        search: [['comms', 'You can’t hide from the Federation forever, Rick.'], ['morty', 'She lost us! Keep the planet between us, Rick!']],
        found: [['comms', 'There you are, Rick.'], ['rick', 'Aaand she found us. Great. Morty, hold onto something.']],
        leaving: [['morty', 'She’s gone, Rick. Are… are you okay?'], ['rick', 'I’m always okay, Morty. Shut up.']],
      },
      // Federation customs, pulling you over (an inspector: cut your engines and it scans you)
      fedcustoms: {
        seen: [['morty', 'Rick, a patrol ship. It’s flashing its lights at us.']],
        hello: [
          ['comms', 'Unidentified cruiser, this is Galactic Federation customs. Cut your engines and hold for inspection.'],
          ['rick', 'Customs, Morty. Space cops with clipboards. Stop the ship. Or don’t. Your call, really.'],
        ],
        clean: [
          ['comms', 'You’re… clean. Huh. Carry on, citizen. Have a compliant day.'],
          ['morty', 'See, Rick? Sometimes it’s fine to just do what they say.'],
          ['rick', 'Don’t ever say that again, Morty.'],
        ],
        busted: [
          ['comms', 'Scan complete. Rick Sanchez, you are wanted in eleven thousand systems. Requesting backup. All of it.'],
          ['rick', 'Eleven thousand. That’s a new record. Shoot the cop, Morty.'],
        ],
        run: [
          ['comms', 'Cruiser, you are fleeing a lawful stop! All units, all units!'],
          ['rick', 'Ha! Lawful. Floor it, Morty. Floor it harder.'],
        ],
        hit: [['comms', 'Shots fired! The suspect is firing on customs! Backup, now!']],
        leaving: [['morty', 'Okay, they’re leaving. That wasn’t so bad.']],
      },
      // Jerry, tagging along (he panics when anything happens)
      jerry: {
        seen: [['morty', 'Rick, is that… is that Dad? In a saucer?'], ['rick', 'Oh no.']],
        hello: [
          ['comms', 'Hey, guys! It’s me, Jerry! Beth said I should get out of the house, so I… got a saucer! Room for one more?'],
          ['rick', 'No, Jerry.'],
          ['comms', 'Great! I’ll just fly right here. Behind you. Where it’s safe.'],
        ],
        chat1: [['comms', 'So, what are we doing? Is this a job? Do you guys have, like, a space job?'], ['rick', 'We’re flying, Jerry. You’re watching.']],
        chat2: [['comms', 'You know, I think I’m getting pretty good at this. Look, I didn’t hit that rock.'], ['morty', 'There wasn’t a rock, Dad.']],
        chat3: [['comms', 'Rick, is it normal for the saucer to make a little clicking sound? Like a… ticking?'], ['rick', 'Yes, Jerry. Totally normal. Keep flying.']],
        panic: [['comms', 'Oh my god, oh my god, those are guns! Rick, they have GUNS! I’m going over here! Don’t follow me! Or do!']],
        panic2: [['comms', 'AGAIN?! This is why I don’t leave the house!']],
        back: [['comms', 'Is it over? It’s over, right? Okay. Okay. I was never scared. I was… scouting.'], ['morty', 'Sure, Dad.']],
        hit: [['comms', 'OW! Rick, you SHOT me! Your own son-in-law!'], ['rick', 'Allegedly.']],
        leaving: [['comms', 'Okay, Beth’s calling. Bye, guys! Love you! Morty, wear a seatbelt!'], ['morty', 'Bye, Dad.']],
      },
      squanchy: {
        seen: [['morty', 'Rick, is that… Squanchy’s ship?']],
        hello: [
          ['comms', 'Rick! Squanchy here! I’ve got news, and it’s not squanchy news!'],
          ['rick', 'Spit it out, Squanchy.'],
        ],
        tip: {
          council: [['comms', 'The Council’s coming for you, Rick! Portals, the lot! Get your squanch together!']],
          hunt: [['comms', 'Federation’s on your trail, Rick. A whole pack of them. Squanch ’em good.']],
          destroyer: [['comms', 'There’s a Federation cruiser on its way. A big one! Bigger than my last party!']],
          bounty: [['comms', 'Somebody’s put a price on you, Rick. A big squanching price.']],
          any: [['comms', 'Something’s coming, Rick. I can feel it in my squanch.']],
        },
        hit: [['comms', 'Hey! Watch where you’re squanching, Rick!']],
        leaving: [
          ['comms', 'Gotta squanch! Good luck, Rick!'],
          ['morty', 'Bye, Squanchy!'],
        ],
      },
      evilmorty: {
        seen: [
          ['morty', 'Rick, that black ship with the eye patch…'],
          ['rick', 'Yeah. I see him, Morty.'],
        ],
        hello: [
          ['comms', 'Hello, Rick. Just checking in. Seeing how the other half flies.'],
          ['morty', 'That’s… that’s me, Rick. That’s the other me.'],
          ['rick', 'He’s not you, Morty. Shoot him.'],
        ],
        hit: [['comms', 'Not bad. For a Rick who still needs a Morty.']],
        leaving: [
          ['comms', 'Let’s call it a draw. For now.'],
          ['rick', 'He’ll be back, Morty. He always plans to be back.'],
        ],
        search: [['comms', 'Lost me? I don’t get lost, Rick. I get patient.'], ['morty', 'He can’t see us, Rick. Keep it that way!']],
        found: [['comms', 'There you are.'], ['rick', 'Yeah, yeah, he’s back, Morty. Guns.']],
      },
    },
    interdicted: [
      ['morty', 'Rick! Something pulled us out of pulse!'],
      ['rick', 'Interdictor, Morty. Somebody wants a word. Shoot the word.'],
    ],
    crashInto: {
      star: [
        ['rick', 'Yep. Flew into a star. That one’s on me, Morty.'],
        ['morty', 'My eyebrows, Rick!'],
      ],
      giant: [
        ['morty', 'Rick, we’re sinking into the clouds!'],
        ['rick', 'Hydrogen, Morty. Pull up before it crushes the hull. Too late. Portal.'],
      ],
      citadel: [
        ['comms', 'Unidentified cruiser, you have breached the Citadel. Prepare to be portalled.'],
        ['rick', 'Oh great. A whole city of me is about to be smug about this.'],
        ['morty', 'Aw jeez.'],
      ],
    },
    hit: [
      ['morty', 'Rick, we’re hit!'],
      ['rick', 'It’s a scratch, Morty.'],
    ],
    shields: [
      ['morty', 'Rick, the shields are almost gone!'],
      ['rick', 'Then stop getting hit, Morty!'],
    ],
    destroyed: [
      ['morty', 'We’re going down, Rick!'],
      ['rick', 'Relax. I backed us up again. Portal’s open.'],
    ],
    // getting away from them, and shooting the lot down
    escaped: [
      ['rick', 'Lost ’em, Morty. Too easy.'],
      ['morty', 'Oh man. Oh jeez.'],
    ],
    cleared: [
      ['rick', 'That’s what you get for messing with the smartest man in the universe!'],
      ['morty', 'I did most of the shooting, Rick.'],
    ],
    // a ship downed by flying into it (shipHits.js), and the last of them
    // so: their own lines, not a gun's
    ram: {
      kill: [
        ['morty', 'Rick! We— we flew right into him!'],
        ['rick', 'Ramming speed, Morty. The ship’s armoured. Mostly.'],
      ],
      cleared: [
        ['morty', 'W-we rammed the last one, Rick. With the ship.'],
        ['rick', 'Who needs guns, Morty? The ship’s the gun.'],
      ],
    },
    // the ship's powers (shipPowers.js): using each, the big one charged
    // and a big haul from it, and why a portal won't go
    powers: {
      portal: {
        use: [['rick', 'Portal, Morty! Get on his six!']],
        refuse: {
          shield: [['rick', 'Portals don’t go through planetary shields, Morty. It’s physics. Ugh.']],
          held: [['rick', 'Something’s got hold of the ship, Morty. You can’t portal out of a headlock.']],
          solid: [['rick', 'Open a portal into that? You want to come out inside a rock, Morty? Point us somewhere with space in it.']],
        },
      },
      wubba: {
        use: [
          ['rick', 'Wubba lubba dub dub!', 'wubba'],
          ['morty', 'Rick, that’s way too much laser!'],
        ],
        ready: [['rick', 'Big gun’s charged, Morty. Don’t touch it. Okay, touch it.']],
        big: [['rick', 'Riggity riggity wrecked, son!', 'riggity']],
      },
    },
    // the director's set pieces (director.js), and going out into deep space
    events: {
      // friends on your wing in a long fight (wingmen.js), and going again: by who came
      wingmen: {
        birdperson: [
          ['birdperson', 'Rick. I am here to assist. It is what friends do.'],
          ['rick', 'Birdperson! Thank God. I mean, took you long enough.'],
        ],
        squanchship: [
          ['comms', 'Rick! It’s Squanchy! I’m gonna squanch these guys!'],
          ['rick', 'Squanchy! Get in close, buddy. Squanch ’em up.'],
        ],
        poopyship: [
          ['comms', 'Ooh-wee! Hey Rick, hey Morty! Mr. Poopybutthole here to help!'],
          ['morty', 'Mr. Poopybutthole! You came!'],
          ['rick', 'Great. Don’t get attached, Morty. He never stays long.'],
        ],
      },
      wingmenGone: [
        ['birdperson', 'Our work here is done. Goodbye, old friend.'],
        ['morty', 'Bye, Birdperson!'],
      ],
      // someone else's fight out ahead (skirmishes.js): seen, won with your help, lost
      skirmish: [
        ['morty', 'Rick, there’s a fight up ahead! Is that Birdperson?'],
        ['rick', 'Federation goons on a family saucer. Go help him, Morty. Or don’t. I’m not your dad.'],
      ],
      skirmishThanks: [
        ['birdperson', 'Thank you, Rick. The family is safe.'],
        ['rick', 'Yeah, yeah. Don’t make it weird.'],
      ],
      skirmishLost: [
        ['morty', 'Oh no, Rick, they got them.'],
        ['rick', 'That’s the galaxy, Morty. Cold, and full of jerks.'],
      ],
      // a Federation cruiser drops in and launches gunships (the director's capital ship)
      // your standing (standing.js): the Federation marking you, the ordinary ships fearing or loving you, the pirates taking to you
      standing: {
        suspect: [['morty', 'Rick, the Federation ships keep scanning us.'], ['rick', 'We’re on a list, Morty. Congratulations. Lists are where the interesting people are.']],
        wanted: [['comms', 'Attention all Federation units: Rick Sanchez, C-137, is wanted. Shoot on sight.'], ['rick', 'Wanted! Finally. Took them long enough.'], ['morty', 'That’s… that’s not a good thing, Rick.']],
        trusted: [['comms', 'Federation customs here. You’re… cleared. Nice work out there, citizen.'], ['rick', 'Did a cop just thank me? Morty, I need to lie down.']],
        feared: [['morty', 'Rick, that saucer just turned around when it saw us. They’re scared of us.'], ['rick', 'Good. Fear is efficient, Morty. Nobody cuts in front of you.']],
        hero: [['comms', 'That’s him! That’s the guy who saved the saucer! Thank you!'], ['rick', 'Oh no. Morty, we’re heroes. This is the worst thing that’s ever happened to me.']],
        friend: [['comms', 'Hey! It’s the Gromflomites’ favourite Earthman! Fly easy, friend!'], ['rick', 'The bugs like us, Morty. We’ve made some choices.']],
      },
      // a patrol going past has reported you (traffic.js's spotted)
      spotted: [['morty', 'Rick, that patrol just saw us! They’re calling it in!'], ['rick', 'Snitches, Morty. The galaxy’s full of snitches. Get ready.']],
      // the law on us (wanted.js): by stars, searching, and lost
      wanted: {
        any: [['morty', 'Rick, we’re wanted! There’s a price on us!'], ['rick', 'Welcome to my whole life, Morty.']],
        3: [['morty', 'Three stars, Rick! They’re sending wardens!'], ['rick', 'And they’ll pin the drive. Shoot the medic first, Morty. Always the medic.']],
        5: [['morty', 'Five stars! The whole Federation’s coming!'], ['rick', 'Good. Saves me looking for them.']],
        search: [['rick', 'They lost us. Stay out of sight, Morty. Behind something big. Don’t breathe.']],
        lost: [['morty', 'They’re gone! We lost them!'], ['rick', 'The bounty didn’t go anywhere, Morty. Somebody’s gonna come collect.']],
      },
      // an ace hurt into its next stage (hunterRules.js's stages), by who
      stage: {
        evilmortyship: [['comms', 'You’re good, Rick. Fine. Let’s see how you do against a hundred of me.'], ['morty', 'Rick, he’s falling back! And… those are MORE Mortys!']],
        phoenixperson: [['comms', 'Engaging secondary systems.'], ['rick', 'He’s got a second gear, Morty. Of course he does. The Federation never skimps on the murder parts.']],
        krombopulos: [['comms', 'Oh boy, now you’ve made me get serious!'], ['rick', 'He’s gone dark, Morty! Shoot where he isn’t!']],
        any: [['rick', 'It just changed tactics, Morty! That’s new!'], ['morty', 'Why do they always get MORE dangerous when they’re hurt?!']],
      },
      // the fight with the Federation cruiser (capitalRules.js): its turbolasers,
      // your shots off its shield, its projectors going, its bridge open, it
      // running or going up
      capital: {
        fired: [['morty', 'Rick, the big ship’s shooting at us! Those bolts are huge!'], ['rick', 'Big ship, big guns, Morty. They’re slow. Don’t be where they’re going.']],
        shielded: [['morty', 'Our shots are just bouncing off it!'], ['rick', 'It’s shielded, Morty. See the two glowing bits? Shield projectors. Hit those.']],
        dome: [['rick', 'That’s one projector. One more and that cruiser’s naked, Morty.']],
        open: [['morty', 'The shield’s down! Rick, it’s turning!'], ['rick', 'It’s running, Morty. The bridge! Hit the bridge before it jumps!']],
        bridge: [['rick', 'That’s the bridge! That’s the whole bridge, Morty! Back off, back off!']],
        dead: [['morty', 'Rick! It… it blew up! We blew up a Federation cruiser!'], ['rick', 'We sure did, Morty. The Federation is gonna be SO mad. Good.']],
        fled: [['morty', 'It jumped! It got away, Rick!'], ['rick', 'With no shields and a hole in its side, Morty. That’s a win. Take the win.']],
        gone: [['rick', 'And it’s gone. Took a projector with it. Nice shooting, Morty. Don’t let it go to your head.']],
        wave: [['morty', 'Rick, it’s launching MORE gunships!'], ['rick', 'Of course it is, Morty. It’s a cruiser. Cruisers have more.']],
      },
      destroyer: [
        ['morty', 'Rick, that’s a huge Federation ship! It just came out of nowhere!'],
        ['rick', 'Cruiser, Morty. Gunships coming out the bottom. This is why I hate bureaucracy.'],
      ],
      // the NX-5 Planet Remover over the planet you're at (remover.js): it
      // comes, it fires (or doesn't), it goes
      remover: [
        ['morty', 'Rick, what’s that thing? It’s pointing at the planet!'],
        ['rick', 'That’s a planet remover, Morty. It removes planets. Shoot the big glowy end before it’s done charging.'],
      ],
      removerFired: [
        ['morty', 'Oh geez, Rick, the planet! It’s just… gone!'],
        ['rick', 'It’ll be back in a minute, Morty. The Federation can’t even remove a planet right.'],
      ],
      removerDown: [
        ['morty', 'We got it, Rick! We stopped a planet remover!'],
        ['rick', 'Yeah, yeah. Put it on the fridge, Morty.'],
      ],
      distress: [
        ['comms', 'Mayday, mayday! Gromflomites! Anybody!'],
        ['morty', 'Rick, that family’s in trouble!'],
        ['rick', 'Ugh. Fine. Heroics. Shoot the bugs, Morty.'],
      ],
      rescued: [
        ['comms', 'Thank you, strangers! Squanch you very much!'],
        ['rick', 'Yeah, yeah. Don’t make it a thing.'],
      ],
      convoy: [
        ['morty', 'Look at all those ships, Rick.'],
        ['rick', 'A convoy, Morty. Plumbuses, mostly. Everybody needs a plumbus.'],
      ],
      comet: [
        ['morty', 'Whoa, Rick, a comet!'],
        ['rick', 'It’s a dirty snowball, Morty. Don’t make a wish.'],
      ],
      supernova: [
        ['morty', 'Rick! The sky just went white!'],
        ['rick', 'Supernova, Morty. A star just died so you could see something cool. Say thank you.'],
      ],
      deep: [
        ['morty', 'Rick, where are we going? There’s nothing out here.'],
        ['rick', 'That’s the thing about space, Morty. It’s mostly space. Hit the boost.'],
      ],
      trench: [
        ['morty', 'Rick, why are we flying down a trench on the Death Star?'],
        ['rick', 'Because it’s there, Morty. Floor it.'],
      ],
      // the nav map's drives: a jump to lightspeed (hyperspeed), and the pulse drive pushed past itself (super speed)
      hyperspeed: [
        ['morty', 'Rick, does the cruiser even do lightspeed?'],
        ['rick', 'Lightspeed is for nerds, Morty. We’re taking a shortcut through a dimension where distance is more of a suggestion.'],
      ],
      overdrive: [
        ['morty', 'Rick, this is way too fast!'],
        ['rick', 'It’s exactly fast enough, Morty. Hold on to something that isn’t me.'],
      ],
      rock: [
        ['morty', 'Ow! Rick, we hit a rock! A big one!'],
        ['rick', 'At super speed every rock’s a big one, Morty. Watch the shields and stop steering with your face.'],
      ],
      battle: {
        front: [
          ['morty', 'Rick, that’s a whole war out there! Council ships and Federation ships everywhere!'],
          ['rick', 'Two bureaucracies shooting at each other, Morty. Pick a side. I don’t care which.'],
        ],
        join: [
          ['rick', 'Alright, we’re in. Stay on my wing, Morty. Metaphorically. You’re in my ship.'],
          ['morty', 'Oh geez. Okay. Okay.'],
        ],
        gens: [
          ['morty', 'The shield’s down, Rick! The big ship’s shield is down!'],
          ['rick', 'Bridge next. Cut off the head and the paperwork panics.'],
        ],
        bridge: [
          ['rick', 'Bridge is toast. Now the reactor. Go for the glowy bit, Morty, it’s always the glowy bit.'],
        ],
        reactor: [
          ['morty', 'It’s breaking apart, Rick! It’s breaking in half!'],
          ['rick', 'One big reactor in the middle of a flagship. Every time, Morty. Every single time.'],
        ],
        won: [
          ['morty', 'We won? We actually won?'],
          ['rick', 'That’s a sector. The front moves, the map changes, nobody learns anything.'],
        ],
        lost: [
          ['morty', 'They’re pulling back, Rick. We’re losing the sector.'],
          ['rick', 'Strategic retreat, Morty. Everybody does it. Mostly us.'],
        ],
        warWon: [
          ['rick', 'That’s the whole war, Morty. Every sector. I’d make a speech, but speeches are for people who lose.'],
          ['morty', 'Wow. Okay.'],
        ],
        warLost: [
          ['morty', 'That was the last one, Rick. They’ve got everything.'],
          ['rick', 'Then it starts again from the middle. Wars are like that, Morty. Infinite reboots.'],
        ],
      },
      meteors: [
        ['morty', 'Rick! Rocks! A lot of rocks!'],
        ['rick', 'Meteor stream, Morty. Shoot the big ones, dodge the rest, don’t cry about it.'],
      ],
      // a minefield across the way (minefield.js), and a ship to see to the
      // next place with pirates after it (escort.js): asked, the pirates
      // coming, there, and lost
      minefield: [
        ['morty', 'Rick! Those are mines! Space mines, Rick!'],
        ['rick', 'Gromflomite minefield, Morty. Shoot a hole or thread the needle. Just don’t bump anything.'],
      ],
      // a moon across the sun (eclipse.js), the light going and coming back
      eclipse: [
        ['morty', 'Rick, it’s getting dark. Something’s in front of the sun!'],
        ['rick', 'Eclipse, Morty. A moon. Rocks blocking other, bigger, on-fire rocks. Don’t stare at it.'],
      ],
      escort: [
        ['comms', 'Hey, uh, you in the cruiser? Could you see us to the next stop? Gromflomites have been following us.'],
        ['morty', 'Rick, we should help them.'],
        ['rick', 'Fine. Escort duty, Morty. The most boring way there is to get shot at.'],
      ],
      escortPirates: [
        ['morty', 'Rick, here they come! They’re going for the saucer!'],
        ['rick', 'So keep them off it, Morty. If it blows up we did all this flying for nothing.'],
      ],
      escorted: [
        ['comms', 'We made it! Thank you, thank you, squanch you!'],
        ['rick', 'Yeah, yeah. Tip your escort.'],
      ],
      escortLost: [
        ['morty', 'Oh no. Oh geez, Rick, they got them.'],
        ['rick', 'Yeah. Sometimes you lose one, Morty. Let’s go.'],
      ],
      // the director's other happenings: a star flaring, a rift (and going
      // through one), something enormous passing (the Cromulon), a shot into it
      flare: [
        ['morty', 'Rick, the sun’s doing something! It’s getting brighter!'],
        ['rick', 'Solar flare, Morty. Coronal mass ejection. Brace for the shockwave and don’t touch anything.'],
      ],
      rift: [
        ['morty', 'Rick, there’s a hole in space! Right there!'],
        ['rick', 'A rift, Morty. Dimensional tear. Fly into it and we come out somewhere else. Or don’t. Your call, for once.'],
      ],
      rifted: [
        ['morty', 'Where are we, Rick? Where did it put us?'],
        ['rick', 'Somewhere else, Morty. That’s what rifts do. Check the map if you care.'],
      ],
      // Rick's portal gun out of the cruiser (P: gunPortal.js), on his
      // dimension from home or on home from there, and coming out of it
      portalgun: {
        out: [
          ['morty', 'Rick, wh-why are you pointing the portal gun out the window? We’re driving!'],
          ['rick', 'Scenic route, Morty. My dimension. Fly into the green thing before it closes.'],
        ],
        home: [['rick', 'Seen enough? Portal home, Morty. Fly through it, it doesn’t wait.']],
      },
      gunThrough: {
        rickmorty: [
          ['morty', 'Whoa… Rick, where are we? Is that planet moving?'],
          ['rick', 'Everything here moves, Morty. The Central Finite Curve: every world where I’m the smartest man in it. That’s the Citadel past it. Don’t touch anything.'],
        ],
        main: [['morty', 'Oh, thank God. Home. Well, home-home. You know what I mean.']],
      },
      leviathan: [
        ['comms', 'SHOW ME WHAT YOU GOT!'],
        ['morty', 'Oh no. Oh no, Rick, it’s a Cromulon!'],
        ['rick', 'Keep flying, Morty. We are not doing a musical number today.'],
      ],
      leviathanHit: [
        ['morty', 'Rick, I shot the giant head!'],
        ['rick', 'Yeah, that’ll show it. Great plan, Morty. Really great.'],
      ],
    },
    // the first time you come up on one of deep space's wonders (deep.js)
    wonders: {
      lantern: [
        ['morty', 'Rick, that star’s blinking at us!'],
        ['rick', 'Pulsar, Morty. A dead star spinning a thousand times a second. Get close and it cooks you. Don’t get close.'],
      ],
      twins: [
        ['morty', 'Two suns, Rick! Like in that movie!'],
        ['rick', 'Binary star, Morty. Every system’s got one. Not special. Okay, the gas bridge is a little special.'],
      ],
      wanderer: [
        ['morty', 'It’s so dark out here, Rick. Where’s its sun?'],
        ['rick', 'It doesn’t have one, Morty. A rogue planet. Kicked out of its system. I relate.'],
      ],
      graveyard: [
        ['morty', 'Rick… those are all dead ships.'],
        ['rick', 'Ship graveyard round a white dwarf, Morty. Somebody’s bad day, times a thousand. Don’t touch anything.'],
      ],
      citadel: [
        ['morty', 'The Citadel of Ricks!'],
        ['rick', 'A whole city of me, Morty. Worst place in the multiverse.'],
      ],
      rmportal: [
        ['morty', 'Rick, there’s a portal just… hanging out here in space!'],
        ['rick', 'That’s the back door to the Curve, Morty. Fly in, we come out at the Citadel. Try not to make eye contact with anyone who looks like me.'],
      ],
      'rmportal-back': [
        ['morty', 'Is that the way home?'],
        ['rick', 'Home-ish, Morty. Our dimension’s side of the map. Close enough.'],
      ],
      curvesun: [
        ['morty', 'Rick, wh-why does this sun look kinda green?'],
        ['rick', 'Everything in the Curve’s a little off, Morty. We built it that way. Well, they did. Me. Other me.'],
      ],
      maw: [
        ['morty', 'Rick, why’s the light all bendy?'],
        ['rick', 'Black hole, Morty. Fly in there and you’re spaghetti. Literal spaghetti.'],
      ],
      aurelia: [
        ['morty', 'That planet’s huge, Rick!'],
        ['rick', 'Gas giant, Morty. It’s all hydrogen and disappointment.'],
      ],
      glacia: [['rick', 'Ice giant. Cold, blue and not interested in you, Morty.']],
      ember: [
        ['morty', 'Another sun, Rick!'],
        ['rick', 'There are billions of ’em, Morty. Don’t get attached.'],
      ],
      halcyon: [['rick', 'A blue star, Morty. Burns hot, dies young. Like my first marriage.']],
      veil: [
        ['morty', 'It’s beautiful, Rick.'],
        ['rick', 'It’s a gas cloud, Morty. Stars get born in there. Gross.'],
      ],
      cradle: [['rick', 'Another nebula. Seen one, seen ’em all, Morty.']],
    },
    edge: [['rick', 'Nothing out there but more nothing, Morty. Turning back.']],
    arrive: {
      home: [
        ['morty', 'Whose space station is this, Rick?'],
        ['rick', 'Tilak’s. The guy who built this whole universe, Morty. Show some respect.'],
      ],
      experience: [
        ['rick', 'Six jobs on one station, Morty. AWS, Bose, the works.'],
        ['morty', 'That’s, like, a real career, Rick.'],
      ],
      projects: [
        ['meeseeks', 'I’m Mr. Meeseeks! Look at me!', 'meeseeks'],
        ['morty', 'They’re building stuff in there, Rick!'],
        ['rick', 'A Game Boy emulator, a file system, a shell. Kid’s a tinkerer, Morty. I like him.'],
      ],
      resume: [
        ['rick', 'One page, Morty. A whole career on one page.'],
        ['morty', 'Mine would just say “went on adventures.”'],
      ],
      contact: [
        ['morty', 'A big antenna! Can we call home?'],
        ['rick', 'It’s for messages to Tilak, Morty. Don’t prank call him.'],
      ],
      terminal: [
        ['rick', 'A terminal. Finally, something for grown-ups.'],
        ['morty', 'Rick, what’s sudo?'],
        ['rick', 'You son of a bitch. I’m in.', 'imIn'],
      ],
      starwars: [
        ['morty', 'Rick, there’s a whole galaxy in there! Behind a… a stargate?'],
        ['rick', 'A galaxy far, far away, Morty. Hyperspace gate. Fly in and you’re there. Mind the Empire.'],
      ],
      music: [
        ['rick', 'Indian classical music, Morty. Ragas older than most galaxies.'],
        ['morty', 'It’s, uh, it’s actually relaxing, Rick.'],
      ],
      middleearth: [
        ['morty', 'There’s a volcano with a giant eye over it, Rick!'],
        ['rick', 'Middle-earth. Don’t put on any rings, Morty. I mean it.'],
      ],
      transformers: [
        ['rick', 'Cybertron. A whole planet of cars that are also robots.'],
        ['morty', 'That’s the coolest thing I’ve ever seen, Rick.'],
      ],
      marvel: [
        ['morty', 'Six glowing stones, Rick. That seems important.'],
        ['rick', 'Infinity Stones. Half the universe gone with one snap. Amateurs.'],
      ],
      breakingbad: [
        ['rick', 'Albuquerque, Morty. A chemistry teacher went way off the syllabus down there.'],
        ['morty', 'Maybe we just, uh, keep the windows up.'],
      ],
      office: [
        ['morty', 'A planet made of paper, Rick?'],
        ['rick', 'Scranton. A paper company, Morty. Somehow the most dangerous place on the map.'],
      ],
      rickmorty: [
        ['rick', 'Home sweet dimension, Morty. C-137.'],
        ['morty', 'Can we stop for a bit? I just want one normal day.'],
      ],
      gaming: [
        ['comms', 'Coool.', 'cool'],
        ['morty', 'It’s all blocks, Rick. Like an old Game Boy.'],
        ['rick', 'Somebody wrote a whole Game Boy in code, Morty. Respect.'],
      ],
      travel: [
        ['rick', 'Earth. Somebody’s been all over this one.'],
        ['morty', 'Look at all those routes, Rick!'],
      ],
      caribbean: [
        ['morty', 'Rick, there’s a giant tentacle coming out of that ocean!'],
        ['rick', 'The Caribbean, Morty. Pirates. It’s just crime with better hats.'],
      ],
      invincible: [
        ['morty', 'Rick, a guy in a cape just flew past us. Fast.'],
        ['rick', 'Viltrumites, Morty. Don’t make eye contact. Don’t make any contact.'],
      ],
    },
  },
  {
    id: 'xwing',
    ship: 'An X-wing',
    label: 'Luke and Artoo',
    speakers: {
      luke: { name: 'Luke', color: '#ff9f4a', voice: 'luke' },
      r2: { name: 'R2-D2', color: '#7fb2ff', voice: 'r2' },
    },
    // the Citadel's siege (siege.js)
    siege: {
      shielded: [
        ['luke', 'It’s shielded. Artoo, where’s it coming from?'],
        ['r2', '[four quick beeps: the generators out on the arms]'],
      ],
      gen: [['r2', '[a delighted whistle]']],
      shield: [['luke', 'Their shield’s down! Switching to proton torpedoes.']],
      deflect: [['luke', 'Lasers aren’t getting through. Torpedoes, it’ll take torpedoes.']],
      dry: [['r2', '[a sad, falling beep: no torpedoes left]']],
      down: [
        ['luke', 'Great shot! That was one in a million!'],
        ['r2', '[a long, triumphant whistle]'],
      ],
      rebuilt: [['luke', 'They’ve rebuilt it already? Through a portal?']],
      closed: [['luke', 'There’s nothing left to land on, Artoo.']],
    },
    foot: {
      land: [
        ['luke', 'Setting down, Artoo. Let’s have a look around.'],
        ['r2', '[a worried whistle]'],
      ],
      out: [
        ['luke', 'Reminds me of Tatooine. Sort of.'],
        ['r2', '[beeps: it doesn’t]'],
      ],
      squad: [
        ['r2', '[a frantic scream of beeps]'],
        ['luke', 'I see them, Artoo. Stay behind me.'],
      ],
      // a probe droid's called them in (foot.js: a troop that `calls`)
      called: [
        ['r2', '[an urgent string of beeps: the probe droid’s signalling]'],
        ['luke', 'It’s called them in. Here they come.'],
      ],
      kill: {
        stormtrooper: [['luke', 'Stormtrooper down!']],
        scout: [
          ['luke', 'Got the scout!'],
          ['r2', '[a cheerful whistle]'],
        ],
        probe: [
          ['luke', 'The probe droid’s down. Did it get a signal off?'],
          ['r2', '[a worried warble]'],
        ],
        gromflomite: [['luke', 'One of the bugs is down, Artoo!']],
        cop: [['r2', '[beeps: that one was a policeman. Of a sort.]']],
        gazorpian: [
          ['luke', 'The big one’s down! I wasn’t sure it would go down.'],
          ['r2', '[a long, relieved whistle]'],
        ],
        any: [
          ['luke', 'Got him!'],
          ['r2', '[an approving trill]'],
        ],
      },
      hurt: [['luke', 'Ah! I’m alright, Artoo.']],
      down: [
        ['r2', '[a long, sad whistle]'],
        ['luke', 'I’m okay… I’m okay.'],
      ],
      up: [['r2', '[a relieved warble]']],
      cleared: [
        ['luke', 'That’s the last of them.'],
        ['r2', '[a smug warble]'],
      ],
      swap: {
        artoo: [['r2', '[a delighted whistle as he rolls out in front]']],
        luke: [['luke', 'Okay, Artoo. I’ll take it from here.']],
      },
      far: [['r2', '[beeps: the X-wing is back that way]']],
      nowhere: [['luke', 'There’s nothing to land on out here, Artoo.']],
      in: [
        ['luke', 'Back in the cockpit. Let’s go.'],
        ['r2', '[a happy whistle]'],
      ],
      friend: [
        ['luke', 'Another ship’s come down, Artoo.'],
        ['r2', '[a curious whistle]'],
      ],
      alt: {
        luke: [
          ['luke', 'That’s… me? From somewhere else?'],
          ['r2', '[beeps in total confusion]'],
        ],
        artoo: [
          ['r2', '[an alarmed screech at the other R2 unit]'],
          ['luke', 'Easy, Artoo. He’s you, from another dimension.'],
        ],
        any: [['luke', 'We’re not the only ones from somewhere else, Artoo.']],
      },
    },
    launch: [
      ['comms', 'May the Force be with you.', 'mayTheForce'],
      ['luke', 'Red Five, standing by.'],
      ['r2', '[an eager whistle]', 'r2Whistle'],
    ],
    boost: [
      ['luke', 'Hang on, Artoo!'],
      ['r2', '[a delighted whoop]'],
    ],
    bump: [
      ['r2', '[an alarmed shriek]'],
      ['luke', 'I have a very bad feeling about this.', 'badFeelingLuke'],
    ],
    crash: [
      ['r2', '[a long, falling scream]', 'r2Scream'],
      ['luke', 'We’re okay, Artoo. Get the spare and let’s get back up there.'],
    ],
    pulled: [
      ['luke', 'We’re caught in its gravity! Artoo, all the power you’ve got to the engines!'],
      ['r2', '[frantic beeping]'],
    ],
    swallowed: [
      ['luke', 'It’s pulling us in! Artoo, there’s something on the other side…'],
      ['r2', '[a long, falling scream]', 'r2Scream'],
    ],
    traffic: {
      tie: [
        ['luke', 'TIE fighters! Artoo, lock them down!'],
        ['r2', '[an urgent warble]'],
      ],
      interceptor: [
        ['comms', 'It’s a trap!', 'itsATrap'],
        ['luke', 'Interceptors, coming in fast!'],
        ['r2', '[a frightened whistle]'],
      ],
      xwing: [
        ['comms', 'Red Five, this is Red Leader. Glad you could join us.'],
        ['luke', 'Copy, Red Leader.'],
      ],
      slave1: [
        ['luke', 'That’s Boba Fett’s ship!'],
        ['r2', '[a nervous warble]'],
      ],
    },
    kill: {
      any: [
        ['luke', 'Got him!'],
        ['r2', '[a triumphant whistle]'],
      ],
      xwing: [
        ['comms', 'Red Five, you just shot one of ours!'],
        ['luke', 'Sorry, Red Leader!'],
      ],
      slave1: [
        ['luke', 'Got the bounty hunter!'],
        ['r2', '[a delighted whistle]'],
      ],
      freighter: [
        ['comms', 'Red Five, that was a civilian freighter!'],
        ['luke', 'It came out of nowhere!'],
      ],
      transport: [
        ['comms', 'Red Five! That was one of our transports!'],
        ['r2', '[a horrified shriek]'],
      ],
      tieadvanced: [
        ['luke', 'I hit Vader’s ship! It’s spinning away!'],
        ['r2', '[a triumphant whistle]'],
      ],
      tiebomber: [['luke', 'Bomber down!']],
      gunboat: [
        ['luke', 'Got the gunboat!'],
        ['r2', '[a relieved whistle]'],
      ],
      ig2000: [
        ['luke', 'That’s the droid’s ship down. IG-88 won’t be collecting today.'],
        ['r2', '[a smug beep]'],
      ],
      houndstooth: [
        ['luke', 'The Trandoshan’s ship is breaking up!'],
        ['r2', '[a triumphant whistle]'],
      ],
      punishingone: [
        ['luke', 'Got Dengar! His ship’s finished!'],
        ['r2', '[a cheerful whistle]'],
      ],
      skiff: [['luke', 'One less pirate!']],
      ywing: [
        ['comms', 'Red Five! That was Gold Squadron!'],
        ['luke', 'I’m sorry! It crossed right in front of me!'],
      ],
      awing: [
        ['comms', 'Red Five, watch your fire! That was Green Three!'],
        ['r2', '[a horrified shriek]'],
      ],
    },
    hunted: {
      // the ISB, sent when you're wanted (wanted.js)
      isb: [
        ['r2', '[ISB patrol, closing: an enforcer with ion cannons among them]'],
        ['luke', 'Imperial Security. Don’t let the ion fire touch us, Artoo.'],
      ],
      fett: [
        ['r2', '[A Firespray on an attack run. Boba Fett.]'],
        ['luke', 'A bounty hunter. Stay with me, Artoo. He only has to miss once.'],
      ],
      ig88: [
        ['r2', '[an alarmed shriek]'],
        ['luke', 'That’s the IG-2000. An assassin droid, Artoo. It doesn’t stop.'],
      ],
      bossk: [
        ['r2', '[a nervous warble]'],
        ['luke', 'The Hound’s Tooth. Bossk. He hunts Wookiees for sport, and he’s found us.'],
      ],
      dengar: [
        ['luke', 'The Punishing One. Dengar. Artoo, he’s fast. Keep him off our tail.'],
        ['r2', '[an urgent whistle]'],
      ],
      // what the Star Destroyer launches: TIEs, bombers, a gunboat
      navy: [
        ['comms', 'Red Five, bombers and a gunboat coming out of that Destroyer!'],
        ['luke', 'Keep moving, Artoo. The bombers can’t turn.'],
      ],
      empire: [
        ['comms', 'Red Five, you’ve got TIEs on your tail!'],
        ['luke', 'I see them! Hang on, Artoo!'],
      ],
      // Vader himself, in his TIE Advanced
      ace: [
        ['comms', 'The Force is strong with this one.', 'forceIsStrong'],
        ['luke', 'That TIE… it’s him. It’s Vader!'],
        ['comms', 'No, I am your father.', 'vader'],
      ],
    },
    // the named characters who come by (npcs/index.js), by what they're saying
    npc: {
      // Vader himself, come for you in his TIE Advanced (a nemesis: he remembers)
      vader: {
        seen: [
          ['r2', '[a long, low, frightened whistle]'],
          ['luke', 'I feel it too, Artoo. Something’s coming.'],
        ],
        hello: [
          ['comms', 'The Force is strong with this one.', 'forceIsStrong'],
          ['luke', 'That TIE… it’s him. Artoo, stay sharp!'],
        ],
        again: [
          ['comms', 'We meet again, young Skywalker. You have grown stronger. It will not be enough.'],
          ['luke', 'He’s back. And he brought friends, Artoo.'],
        ],
        hit: [['comms', 'Impressive. Most impressive.']],
        half: [
          ['comms', 'You have learned much, young one. But you are not a Jedi yet.'],
          ['r2', '[a defiant beep]'],
        ],
        weak: [
          ['comms', 'Your shields are failing. Give yourself to the dark side. It is the only way.'],
          ['luke', 'Never!'],
        ],
        evade: [['comms', 'I have you now.'], ['luke', 'No, you don’t! Artoo, hard about!']],
        fury: [['comms', 'You have failed me for the last time.'], ['luke', 'He’s coming in with everything! Artoo, keep us moving!']],
        retreat: [
          ['comms', 'Enough. You will come to me, young Skywalker. It is your destiny.'],
          ['luke', 'He’s breaking off! Artoo, I don’t think he’s done with us.'],
        ],
        bait: [['luke', 'He’s slowing down… he’s letting me pass him! Artoo, break—'], ['r2', '[a shriek: he’s behind you]']],
        search: [['comms', 'You cannot hide forever, Skywalker.'], ['luke', 'He’s lost us behind the moon. Keep it between us, Artoo.']],
        found: [['comms', 'There you are.'], ['luke', 'He’s found us! Hold on!']],
        leaving: [['r2', '[a long, relieved whistle]'], ['luke', 'He’ll be back. I know it.']],
      },
      // Imperial customs, pulling you over (an inspector: cut your engines and it scans you)
      customs: {
        seen: [['r2', '[a wary warble: an Imperial gunboat, closing]']],
        hello: [
          ['comms', 'Unidentified fighter, this is Imperial customs. Cut your engines and prepare to be scanned.'],
          ['luke', 'A customs gunboat. If we run, they’ll call the whole sector. Artoo, what do you think?'],
          ['r2', '[a nervous, noncommittal beep]'],
        ],
        clean: [
          ['comms', 'Scan complete. Your registry is in order. Move along.'],
          ['luke', 'That was close. A Rebel X-wing with its registry in order. Thanks, Artoo.'],
          ['r2', '[a smug little whistle]'],
        ],
        busted: [
          ['comms', 'Scan complete. Rebel insignia detected. You are under arrest. Fighters inbound.'],
          ['luke', 'So much for that. Artoo, lock S-foils in attack position!'],
        ],
        run: [
          ['comms', 'Fighter, you are fleeing an Imperial inspection! All units, pursue!'],
          ['luke', 'They’re calling it in. Hang on, Artoo!'],
        ],
        hit: [['comms', 'Shots fired on an Imperial vessel! Requesting immediate support!']],
        leaving: [['luke', 'They’re gone. Let’s not do that again.']],
      },
      // Hondo Ohnaka, with a toll to collect (a trickster: hold still and he pays you back with news)
      hondo: {
        seen: [['r2', '[a puzzled warble: a pirate skiff, broadcasting a very friendly hail]']],
        hello: [
          ['comms', 'Greetings, my friend! Hondo Ohnaka, at your service. You are flying through Hondo’s lane, and Hondo’s lane has a toll. Hold still, let me have a look at your cargo, and nobody gets hurt. Much.'],
          ['luke', 'A pirate? Artoo, is he serious?'],
          ['r2', '[a beep: he usually is]'],
        ],
        paid: [
          ['comms', 'Hmm. Hmm! Your hold is empty! My friend, you are poorer than I am! Ha! Hondo cannot rob a pauper. It is bad for business. But Hondo always pays his way, so, a gift: a little word of warning.'],
          ['luke', 'A pirate with manners. Go on.'],
        ],
        tip: {
          hunt: [['comms', 'The Empire has a patrol on your trail. Several ships. I would be somewhere else, my friend, and soon.']],
          destroyer: [['comms', 'A Star Destroyer is about to drop in on you. Hondo has seen it done. It is not pretty. Fly well!']],
          bounty: [['comms', 'There is a price on your head, and someone has come to collect. Not Hondo! Hondo has standards. Mostly.']],
          distress: [['comms', 'Someone nearby is about to call for help. Pirates, probably. Not mine! Probably.']],
          any: [['comms', 'Something is coming your way, my friend. Hondo does not know what. But Hondo knows the feeling.']],
        },
        angry: [
          ['comms', 'Ah. So that is how it is. Very well! Boys, this one wishes to pay the hard way!'],
          ['luke', 'Here they come. Artoo, give me full power to the guns!'],
        ],
        hit: [['comms', 'You shot Hondo! Hondo, who was being so reasonable! Boys!']],
        friend: [['comms', 'Ahh, but it is YOU! The friend of every pirate in the outer lanes! No toll for you, my friend, never! Only a little news, from Hondo, with love.'], ['luke', 'Friend of every pirate. Artoo, we need to talk about our reputation.']],
        leaving: [['comms', 'Farewell, my friend! Remember Hondo fondly, if at all!'], ['r2', '[an unconvinced beep]']],
      },
      lando: {
        seen: [['r2', '[a curious beep: a freighter, parked, broadcasting a hail]']],
        hello: [
          ['comms', 'Well, hello there. Lando Calrissian. And who might you be?'],
          ['luke', 'Luke Skywalker. Are you… selling something?'],
        ],
        offer: [
          ['comms', 'I happen to have a {part} that’d suit that X-wing. Tell your hangar Lando sent you.'],
          ['r2', '[a sceptical warble]'],
        ],
        hit: [['comms', 'Hey! That’s my ship you’re shooting at, kid!']],
        grudge: [['comms', 'You. You shot at my ship last time. No deal, kid. Not now, not ever.'], ['r2', '[a sheepish warble]']],
        shunned: [['comms', 'I’ve heard about you, kid. Freighters don’t come back from where you’ve been. I don’t deal with pirates. Calrissian out.'], ['luke', 'He’s right, Artoo. What have we been doing?']],
        leaving: [['comms', 'This deal is getting worse all the time. Calrissian out.']],
      },
    },
    interdicted: [
      ['r2', '[an alarmed shriek]'],
      ['luke', 'They’ve pulled us out of the drive! Interdictor!'],
    ],
    crashInto: {
      star: [
        ['luke', 'Too close to the star! Pull out!'],
        ['r2', '[a frantic shriek]'],
      ],
      giant: [
        ['luke', 'We’re in the clouds! I can’t see a thing!'],
        ['r2', '[a worried warble]'],
      ],
      citadel: [
        ['comms', 'Rebel fighter, you are in Council space. You will be processed.'],
        ['luke', 'Processed? Artoo, get us out of— '],
      ],
    },
    hit: [
      ['r2', '[an alarmed shriek]'],
      ['luke', 'I’m hit! Artoo, see what you can do!'],
    ],
    shields: [
      ['luke', 'Shields are failing!'],
      ['comms', 'Use the Force, Luke.', 'useTheForce'],
    ],
    destroyed: [
      ['luke', 'I’ve lost her! Artoo!'],
      ['r2', '[a long, falling whistle]'],
      ['comms', 'The Force will be with you. Always.', 'forceAlways'],
    ],
    escaped: [
      ['luke', 'We lost them!'],
      ['r2', '[a relieved whistle]'],
    ],
    cleared: [
      ['luke', 'That’s all of them!'],
      ['comms', 'Great shot, kid. That was one in a million.'],
    ],
    // (Han on the radio, as for the cleared)
    ram: {
      kill: [
        ['luke', 'I hit him! I mean, I really hit him!'],
        ['r2', '[an indignant squeal about the paintwork]'],
      ],
      cleared: [
        ['luke', 'That’s the last of them!'],
        ['comms', 'You flew right through him, kid. Don’t make a habit of it.'],
      ],
    },
    // the ship's powers (shipPowers.js)
    powers: {
      focus: {
        use: [
          ['comms', 'Use the Force, Luke.', 'useTheForce', { name: 'Ben Kenobi', color: '#cfe0ff' }],
          ['r2', '[a low, steady whistle: he’s with you]'],
        ],
      },
      salvo: {
        use: [
          ['luke', 'Artoo, lock them up. Torpedoes away!'],
          ['r2', '[four quick locking beeps, then a whoop]'],
        ],
        ready: [['r2', '[an excited whistle: the torpedoes are armed]']],
        big: [['comms', 'The Force is strong with this one.', 'forceIsStrong', { name: 'Darth Vader', color: '#ff6a5a' }]],
      },
    },
    events: {
      // friends on your wing in a long fight (wingmen.js), and going again: by who came
      wingmen: {
        xwing: [
          ['comms', 'Red Two here, Luke. Coming in on your wing!'],
          ['luke', 'Wedge! Good to see you. Watch yourself, they’re quick.'],
        ],
        ywing: [
          ['comms', 'Gold Leader here. We’re slow, Red Five, but we hit hard. Point us at them.'],
          ['luke', 'Thanks, Gold Leader. The TIEs on my tail, please!'],
        ],
        awing: [
          ['comms', 'Green Squadron, coming through. One pass, then we’re needed elsewhere.'],
          ['luke', 'One pass is plenty. Go!'],
          ['r2', '[an excited whistle]'],
        ],
      },
      wingmenGone: [
        ['comms', 'Red Two, breaking off. Good flying, Luke.'],
        ['r2', '[a cheerful whistle]'],
      ],
      // someone else's fight out ahead (skirmishes.js): seen, won with your help, lost
      skirmish: [
        ['r2', '[an alarmed whistle]'],
        ['luke', 'TIEs on one of our transports, dead ahead. Its escort’s holding them off. Let’s help.'],
      ],
      skirmishThanks: [
        ['comms', 'Thanks for the assist, Red Five. We’re clear.'],
        ['luke', 'Glad we could help. May the Force be with you.'],
      ],
      skirmishLost: [
        ['luke', 'We were too late. Artoo, log it.'],
        ['r2', '[a low, sad warble]'],
      ],
      // your standing (standing.js): the Empire marking you, the ordinary ships fearing or loving you, the pirates taking to you
      standing: {
        suspect: [['r2', '[a worried warble: Imperial patrols keep scanning us]'], ['luke', 'We’re on their list now, Artoo. Keep your eyes open.']],
        wanted: [['comms', 'All Imperial units: the Rebel fighter is wanted. Engage on sight.'], ['luke', 'Wanted. Well. I guess that makes it official.'], ['r2', '[a proud little beep]']],
        trusted: [['comms', 'Imperial customs. Your registry is… exemplary. Carry on.'], ['luke', 'Exemplary? Artoo, what did you put in our registry?'], ['r2', '[an innocent whistle]']],
        feared: [['luke', 'That freighter turned and ran when it saw us. Artoo, they’re afraid of us.'], ['r2', '[a sad, low tone]'], ['luke', 'This isn’t what the Rebellion is for.']],
        hero: [['comms', 'Red Five! It’s Red Five! Thank you, Red Five!'], ['luke', 'They know us, Artoo. We did some good out here.']],
        friend: [['comms', 'The pirates of the outer lanes salute you, Jedi! Fly free!'], ['luke', 'Friends with pirates. Han would be proud. I’m not sure I am.']],
      },
      // a patrol going past has reported you (traffic.js's spotted)
      spotted: [['r2', '[an alarmed shriek: that patrol’s seen us]'], ['luke', 'They’re calling it in. Here they come, Artoo.']],
      wanted: {
        any: [['r2', '[a warbling alarm: we’re flagged]'], ['luke', 'The Empire’s marked us. ISB patrols, Artoo. Keep your eyes open.']],
        3: [['luke', 'Interceptors with ion cannons. If they hit us we lose the drive.'], ['r2', '[a worried whistle]']],
        5: [['r2', '[a long, falling shriek]'], ['luke', 'Everything they’ve got. Stay with me, Artoo.']],
        search: [['luke', 'They’ve lost sight of us. Stay low, put the moon between us.']],
        lost: [['luke', 'We lost them.'], ['r2', '[a relieved burble, then a warning beep: the bounty’s still on us]']],
      },
      // an ace hurt into its next stage (hunterRules.js's stages), by who
      stage: {
        tieadvanced: [['comms', 'Impressive. Now you will see what a Sith can do.'], ['luke', 'He’s faster! Artoo, he’s so much faster!']],
        slave1: [['r2', '[a frantic warble: seismic charges!]'], ['luke', 'He’s dropping charges! Stay out of the blast, Artoo!']],
        ig2000: [['comms', 'Combat parameters: adjusted.'], ['luke', 'The droid’s overclocking! It’s a blur!']],
        houndstooth: [['luke', 'Bossk is backing off and pounding us from range! We have to close the distance!']],
        punishingone: [['r2', '[a confused run of beeps: the target keeps vanishing]'], ['luke', 'Dengar’s jamming our sensors. Every time we hit him, he’s gone!']],
        any: [['luke', 'It’s changed tactics! Artoo, watch it!'], ['r2', '[a tense warble]']],
      },
      // the fight with the Star Destroyer (capitalRules.js): its turbolasers,
      // your shots off its shield, its domes going, its bridge open, it
      // running or going up
      capital: {
        fired: [['r2', '[a frightened shriek]'], ['luke', 'Turbolasers! They’re firing on us! They’re slow, Artoo. Keep moving!']],
        shielded: [['luke', 'Our shots aren’t getting through! It’s shielded!'], ['r2', '[a quick run of beeps: the two domes on the tower]'], ['luke', 'The shield generators. On the bridge tower. Got it!']],
        dome: [['luke', 'That’s one generator down! One more, Artoo!']],
        open: [['r2', '[a triumphant whistle]'], ['luke', 'Shields are down! It’s turning away. The bridge, Artoo! Now, before it jumps!']],
        bridge: [['luke', 'The bridge is gone! It’s going down! Pull up, Artoo, pull up!']],
        dead: [['r2', '[a long, astonished whistle]'], ['luke', 'We did it. We took down a Star Destroyer. Nobody’s going to believe this.']],
        fled: [['luke', 'It jumped! It got away!'], ['r2', '[a grudging beep]'], ['luke', 'With no shields. It won’t forget us, Artoo.']],
        gone: [['luke', 'It’s gone. And it’s a generator short. Not bad for an X-wing.']],
        wave: [['r2', '[an alarmed warble]'], ['luke', 'More fighters coming out of it! Here we go again!']],
      },
      destroyer: [
        ['r2', '[a frantic warble]'],
        ['luke', 'Star Destroyer, right on top of us! They’re launching fighters!'],
      ],
      distress: [
        ['comms', 'This is Rebel transport Bright Hope. We’re under attack, requesting assistance!'],
        ['luke', 'Hang on, Bright Hope. Artoo, lock on!'],
      ],
      rescued: [
        ['comms', 'Thank you, Red Five. The Rebellion owes you one.'],
        ['luke', 'May the Force be with you.'],
      ],
      convoy: [
        ['luke', 'A Rebel convoy. Looks like they’re moving out.'],
        ['r2', '[a cheerful beep]'],
      ],
      comet: [
        ['luke', 'A comet! Back on Tatooine you’d see one every few years.'],
        ['r2', '[an unimpressed beep]'],
      ],
      supernova: [
        ['luke', 'Did you see that? A star just… went.'],
        ['r2', '[a long, awed whistle]'],
      ],
      deep: [
        ['luke', 'Nothing but stars out here, Artoo.'],
        ['r2', '[a nervous whistle]'],
      ],
      trench: [
        ['comms', 'Stay on target…', 'stayOnTarget'],
        ['luke', 'I’m in the trench! Artoo, watch our backs!'],
        ['r2', '[an alarmed shriek]'],
      ],
      hyperspeed: [
        ['luke', 'Navicomputer’s set. Hang on, Artoo!'],
        ['r2', '[an excited whistle]'],
      ],
      overdrive: [
        ['luke', 'I’ve never had her going this fast!'],
        ['r2', '[a frantic string of beeps]'],
      ],
      rock: [
        ['r2', '[A rock, at speed. Shields down a notch.]'],
        ['luke', 'I didn’t even see it. Keep the deflectors forward, Artoo.'],
      ],
      battle: {
        front: [
          ['r2', '[A fleet engagement ahead. Capital ships on both sides.]'],
          ['luke', 'It’s a full battle out there. Let’s see where we can help.'],
        ],
        join: [
          ['luke', 'We’re in, Artoo. S-foils in attack position.'],
          ['r2', '[an eager whistle]'],
        ],
        gens: [
          ['r2', '[Their shield generators are down.]'],
          ['luke', 'The shield’s gone! Now the bridge.'],
        ],
        bridge: [
          ['luke', 'Bridge is out. Go for the reactor!'],
          ['r2', '[a triumphant chirp]'],
        ],
        reactor: [
          ['luke', 'She’s breaking up! Artoo, look at that!'],
          ['r2', '[a long, amazed whistle]'],
        ],
        won: [
          ['luke', 'We did it. The sector’s ours.'],
          ['r2', '[a happy trill]'],
        ],
        lost: [
          ['r2', '[A low tone: the fleet is pulling out.]'],
          ['luke', 'We’ll be back. We always come back.'],
        ],
        warWon: [
          ['luke', 'That’s the last of them. The whole line is ours, Artoo.'],
          ['r2', '[a joyful string of beeps]'],
        ],
        warLost: [
          ['r2', '[Every sector lost.]'],
          ['luke', 'Then we start again. As long as there’s hope.'],
        ],
      },
      meteors: [
        ['r2', '[Meteor stream ahead. Recommend evasive action.]'],
        ['luke', 'I see them, Artoo. Just like Beggar’s Canyon.'],
      ],
      minefield: [
        ['r2', '[an urgent string of beeps]'],
        ['luke', 'A minefield. Artoo, mark the gaps. I’ll shoot us a way through.'],
      ],
      eclipse: [
        ['luke', 'Artoo, the light’s going. A moon’s crossing the sun.'],
        ['r2', '[a low, wondering whistle]'],
      ],
      escort: [
        ['comms', 'Red Five, this is the transport Sundari Dawn. We’re carrying medical supplies for the fleet. Can you see us to the next system?'],
        ['luke', 'Copy, Sundari Dawn. Stay on my wing.'],
      ],
      escortPirates: [
        ['r2', '[a frantic warble]'],
        ['luke', 'Pirates, closing on the transport. I’m going in.'],
      ],
      escorted: [
        ['comms', 'We’re clear to make the jump. Thank you, Red Five. May the Force be with you.'],
        ['luke', 'And with you. Safe journey.'],
      ],
      escortLost: [
        ['luke', 'No! We lost the transport.'],
        ['r2', '[a long, low whistle]'],
      ],
      // the director's other happenings: a star flaring, a rift (and going
      // through one), something enormous passing (purrgil), a shot into it
      flare: [
        ['r2', '[Solar flare. Shockwave inbound.]'],
        ['luke', 'I see it, Artoo. Hang on, it’s going to rattle us.'],
      ],
      rift: [
        ['luke', 'Artoo, what is that? Space is… tearing.'],
        ['r2', '[A rift. Unknown exit. Entering it is your decision.]'],
      ],
      rifted: [
        ['luke', 'Artoo, where are we?'],
        ['r2', '[Recalculating. Somewhere new. Nav computer updated.]'],
      ],
      // a portal gun of Rick's, left in the cockpit (P: gunPortal.js)
      portalgun: {
        out: [
          ['luke', 'Artoo, what is this? It was under the seat. A blaster that shoots… doors?'],
          ['r2', '[An alarmed warble: a portal is forming ahead. It leads to another dimension.]'],
        ],
        home: [['luke', 'That’s enough of this place. The green door home, Artoo.']],
      },
      gunThrough: {
        rickmorty: [
          ['luke', 'Artoo… that planet’s moving. The whole thing. And look at that station.'],
          ['r2', '[A worried trill: sensors say the Central Finite Curve. Many Ricks. Proceed with caution.]'],
        ],
        main: [['luke', 'We’re back. Artoo, remind me never to touch that thing again.']],
      },
      leviathan: [
        ['luke', 'Artoo, look at the size of them. Purrgil. I’ve only heard stories.'],
        ['r2', '[Purrgil pod. Hold your course. Let them pass.]'],
      ],
      leviathanHit: [['r2', '[Do not shoot the purrgil. They did nothing to you.]']],
    },
    wonders: {
      lantern: [
        ['r2', '[Warning: pulsar. Radiation past the safe line.]'],
        ['luke', 'I see it, Artoo. We’re keeping our distance.'],
      ],
      twins: [['luke', 'Two suns. For a second there I thought I was home.']],
      wanderer: [
        ['luke', 'A planet with no sun. It’s so dark.'],
        ['r2', '[A rogue planet. Surface temperature: very low.]'],
      ],
      graveyard: [
        ['luke', 'Look at them all. A whole fleet, just… drifting.'],
        ['r2', '[A low, sad whistle.]'],
      ],
      citadel: [
        ['luke', 'A whole city out here, full of… the same old man?'],
        ['r2', '[a confused warble]'],
      ],
      rmportal: [
        ['luke', 'A green whirlpool, just hanging in space. Artoo, is that a hyperspace lane?'],
        ['r2', '[a doubtful warble]'],
      ],
      'rmportal-back': [
        ['luke', 'The green swirl again. That should take us back the way we came.'],
        ['r2', '[a hopeful whistle]'],
      ],
      curvesun: [
        ['luke', 'This star’s light is… greener than Tatooine’s twins.'],
        ['r2', '[an unimpressed beep]'],
      ],
      maw: [
        ['luke', 'A black hole. Keep us well clear, Artoo.'],
        ['r2', '[an emphatic beep]'],
      ],
      aurelia: [['luke', 'Look at the size of that planet!']],
      glacia: [['luke', 'Reminds me of Hoth. Let’s not stop.']],
      ember: [['luke', 'Another sun. Almost feels like home.']],
      halcyon: [['luke', 'A blue sun. I’ve never seen one this close.']],
      veil: [
        ['luke', 'A nebula. It’s beautiful, Artoo.'],
        ['r2', '[a soft whistle]'],
      ],
      cradle: [['luke', 'Another nebula. Good place to hide, if we had to.']],
    },
    edge: [['luke', 'Nothing out there, Artoo. Bringing her around.']],
    arrive: {
      home: [
        ['luke', 'That’s his home base. Artoo, say hello.'],
        ['r2', '[a cheerful greeting]'],
      ],
      experience: [
        ['luke', 'Six missions logged. That’s a real flight record.'],
        ['r2', '[an impressed whistle]'],
      ],
      projects: [
        ['luke', 'A workshop! Artoo, you’d love it in there.'],
        ['r2', '[an excited spin of beeps]'],
      ],
      resume: [
        ['luke', 'His service record. One page, every word of it true.'],
        ['r2', '[a data-transfer chirp]'],
      ],
      contact: [
        ['comms', 'Help me, Obi-Wan Kenobi. You’re my only hope.', 'helpMeObiWan'],
        ['luke', 'A relay station. We can get a message to him from here.'],
        ['r2', '[a hopeful bleep]'],
      ],
      terminal: [
        ['luke', 'Artoo, plug in. See what you can find.'],
        ['r2', '[a smug, triumphant trill]'],
      ],
      starwars: [
        ['luke', 'There it is, Artoo. Our galaxy. Take us through the gate.'],
        ['r2', '[an excited whistle: home!]'],
      ],
      music: [
        ['luke', 'Artoo, are you picking up that music?'],
        ['r2', '[hums along, slightly off key]'],
      ],
      middleearth: [
        ['luke', 'A dark tower and a burning eye. Reminds me of someone.'],
        ['r2', '[a low, nervous beep]'],
      ],
      transformers: [
        ['luke', 'A whole planet of droids, Artoo.'],
        ['r2', '[an excited squeal]'],
      ],
      marvel: [
        ['luke', 'Those stones feel like the Force, only louder.'],
        ['r2', '[a cautious whistle]'],
      ],
      breakingbad: [
        ['luke', 'More desert. It looks just like Tatooine.'],
        ['r2', '[a grumpy razz]'],
      ],
      office: [
        ['luke', 'Paper? Who still uses paper?'],
        ['r2', '[a sarcastic blip]'],
      ],
      rickmorty: [
        ['luke', 'That portal isn’t on any of our charts.'],
        ['r2', '[a frantic stream of beeps]'],
      ],
      gaming: [
        ['luke', 'Look, Artoo. A droid made of blocks.'],
        ['r2', '[an 8-bit chirp]'],
      ],
      travel: [
        ['luke', 'So much blue. Nothing like home.'],
        ['r2', '[a happy trill]'],
      ],
      caribbean: [
        ['luke', 'A whole world of water, and one black ship on it.'],
        ['r2', '[a wary, bubbling whistle]'],
      ],
      invincible: [
        ['luke', 'Two of them, flying round it with no ships at all.'],
        ['r2', '[an alarmed, rising whistle]'],
      ],
    },
  },
  {
    id: 'falcon',
    ship: 'The Millennium Falcon',
    label: 'Han and Chewie',
    speakers: {
      han: { name: 'Han', color: '#e8d3b0', voice: 'han' },
      chewie: { name: 'Chewbacca', color: '#d0965a', voice: 'chewie' },
    },
    // the Citadel's siege (siege.js)
    siege: {
      shielded: [
        ['han', 'Deflector shield. Figures.'],
        ['chewie', '[a growl at the generators on the arms]'],
      ],
      gen: [['han', 'Scratch one generator!']],
      shield: [['han', 'Shield’s down, Chewie. Give ’em the concussion missiles.']],
      deflect: [['han', 'Lasers won’t crack that. Missiles, Chewie, missiles!']],
      dry: [['han', 'We’re out of missiles. Great. Just great.']],
      down: [
        ['han', 'Yahoo! You’re all clear, kid!'],
        ['chewie', '[a roar of triumph]'],
      ],
      rebuilt: [['han', 'They put it back together already? I hate Ricks.']],
      closed: [['han', 'Land where? We blew it to bits.']],
    },
    foot: {
      land: [
        ['han', 'Setting her down, Chewie. Grab your bowcaster.'],
        ['chewie', '[a happy roar: solid ground]'],
      ],
      out: [['han', 'Smells like the back end of a bantha. I love it.']],
      squad: [
        ['han', 'Stormtroopers. I’ve got a bad feeling about this.'],
        ['chewie', '[a roar: let them come]'],
      ],
      called: [
        ['han', 'That probe droid just called in its friends. Chewie, take it out next time.'],
        ['chewie', '[an annoyed growl]'],
      ],
      kill: {
        stormtrooper: [['han', 'Bucket-head down.']],
        scout: [['han', 'Scout trooper. Fast, but not that fast.']],
        probe: [
          ['han', 'It’s a probe droid. Was. Chewie, they know we’re here now.'],
          ['chewie', '[a doubtful growl]'],
        ],
        gromflomite: [['han', 'Bug’s down. Pass me another.']],
        cop: [['han', 'A cop? Chewie, we were never here.']],
        gazorpian: [
          ['chewie', '[a long, loud roar]'],
          ['han', 'Yeah, yeah, you got the big one. Save some for me.'],
        ],
        any: [
          ['chewie', '[a triumphant roar]'],
          ['han', 'That’s my partner.'],
        ],
      },
      hurt: [
        ['chewie', '[a pained growl]'],
        ['han', 'Easy, pal. We’ll patch you up later.'],
      ],
      down: [['han', 'Chewie! Get up, you walking carpet!']],
      up: [['chewie', '[a groggy growl]']],
      cleared: [['han', 'Nobody shoots at us and walks away. Well, they walked. Then they didn’t.']],
      swap: {
        chewie: [['chewie', '[a roar: my turn]']],
        han: [['han', 'Alright, my turn. Stay close, pal.']],
      },
      far: [['han', 'The Falcon’s back that way, Chewie. Don’t wander off.']],
      nowhere: [['han', 'Land where? There’s nothing out here but vacuum.']],
      in: [
        ['han', 'Back in the Falcon. Punch it.'],
        ['chewie', '[roars]'],
      ],
      friend: [
        ['han', 'Company. Keep a hand near your bowcaster, Chewie.'],
        ['chewie', '[a low growl]'],
      ],
      alt: {
        han: [
          ['han', 'Is that me? Huh. I look good.'],
          ['chewie', '[roars with laughter]'],
        ],
        chewie: [
          ['chewie', '[a puzzled roar at the other Wookiee]'],
          ['han', 'Yeah, pal, there’s two of you now. The galaxy’s in trouble.'],
        ],
        any: [['han', 'Another dimension, huh? Never heard of it.']],
      },
    },
    launch: [
      ['han', 'Chewie, we’re home.'],
      ['chewie', '[a happy roar]'],
    ],
    boost: [
      ['han', 'Punch it, Chewie!'],
      ['chewie', '[roars]'],
    ],
    bump: [
      ['han', 'Never tell me the odds.', 'neverTellOdds'],
      ['chewie', '[a furious roar]'],
    ],
    crash: [
      ['chewie', '[a horrified roar]'],
      ['han', 'Hold together, baby. Hold together!'],
    ],
    pulled: [
      ['han', 'Chewie, it’s got its hooks in us. Punch it!'],
      ['chewie', '[an alarmed roar]'],
    ],
    swallowed: [
      ['han', 'Told you, Chewie. Nothing outruns that. Hang on, we’re going through.'],
      ['chewie', '[a long, falling roar]'],
    ],
    traffic: {
      tie: [
        ['han', 'Here they come!'],
        ['chewie', '[a roar]'],
      ],
      interceptor: [
        ['comms', 'It’s a trap!', 'itsATrap'],
        ['han', 'Interceptors. Chewie, get on the guns.'],
        ['chewie', '[an eager growl]'],
      ],
      xwing: [
        ['han', 'Rebels. They’re friendly, Chewie. Don’t shoot.'],
        ['chewie', '[a grumble]'],
      ],
      slave1: [
        ['han', 'Boba Fett? Boba Fett?! Where?'],
        ['chewie', '[an alarmed roar]'],
      ],
    },
    kill: {
      any: [
        ['han', 'Great, kid! Don’t get cocky!', 'dontGetCocky'],
        ['chewie', '[a happy roar]'],
      ],
      xwing: [
        ['han', 'That was one of ours!'],
        ['chewie', '[an angry roar]'],
      ],
      slave1: [
        ['han', 'So long, Fett. No bounty today.'],
        ['chewie', '[a triumphant roar]'],
      ],
      freighter: [
        ['han', 'Hey, that guy was a smuggler like us!'],
        ['chewie', '[a scolding roar]'],
      ],
      transport: [
        ['comms', 'Falcon! That was a Rebel transport!'],
        ['han', 'My hand slipped!'],
      ],
      tieadvanced: [
        ['han', 'Ha! Vader’s spinning off into space!'],
        ['chewie', '[a delighted roar]'],
      ],
      ig2000: [
        ['han', 'Scrap metal. That’s what you get for taking a contract on me.'],
        ['chewie', '[a satisfied growl]'],
      ],
      houndstooth: [
        ['chewie', '[a long, triumphant howl]'],
        ['han', 'Yeah, buddy. That one was for you.'],
      ],
      punishingone: [
        ['han', 'Punishing One’s done. Should’ve stayed retired, Dengar.'],
        ['chewie', '[a happy roar]'],
      ],
      skiff: [['han', 'Pirates. Never liked the competition.']],
      ywing: [
        ['comms', 'Falcon! That was Gold Five!'],
        ['han', 'He flew right into it!'],
      ],
      awing: [
        ['comms', 'Falcon, you hit one of ours!'],
        ['han', 'Those things are too fast to see!'],
      ],
    },
    hunted: {
      // the ISB, sent when you're wanted (wanted.js)
      isb: [
        ['han', 'ISB. Wonderful. Chewie, watch the ones with the ion cannons.'],
        ['chewie', '[a snarl]'],
      ],
      fett: [
        ['han', 'Fett. Of course it’s Fett. Chewie, punch it!'],
        ['chewie', '[A furious roar.]'],
      ],
      empire: [
        ['han', 'Imperials on our tail. Chewie, get us some speed!'],
        ['chewie', '[a worried roar]'],
      ],
      ace: [
        ['han', 'That’s Vader’s TIE. Great. Just great.'],
        ['comms', 'No, I am your father.', 'vader'],
      ],
      ig88: [
        ['han', 'IG-88. A droid with a bounty on my head. Chewie, don’t let it get a lock.'],
        ['chewie', '[an angry growl]'],
      ],
      bossk: [
        ['chewie', '[a furious, rising roar]'],
        ['han', 'Yeah, I know it’s Bossk. Easy, pal. You can take it up with him after we shoot him.'],
      ],
      dengar: [
        ['han', 'Dengar. Still sore about that swoop race. Some people never let anything go.'],
        ['chewie', '[a grumbling roar]'],
      ],
      navy: [
        ['han', 'Bombers. Slow and stupid, Chewie. Just don’t be where the bomb goes.'],
        ['chewie', '[a doubtful growl]'],
      ],
    },
    // the named characters who come by (npcs/index.js), by what they're saying
    npc: {
      // Vader himself, come for you in his TIE Advanced (a nemesis: he remembers)
      vader: {
        seen: [
          ['chewie', '[a low, uneasy growl]'],
          ['han', 'Yeah, I see it. One TIE, coming straight at us. Nobody flies like that.'],
        ],
        hello: [
          ['comms', 'The Force is strong with this one.', 'forceIsStrong'],
          ['han', 'Vader. Of course it’s Vader. Chewie, angle the deflectors!'],
        ],
        again: [
          ['comms', 'Captain Solo. You are as foolish as you are stubborn. I expected nothing less.'],
          ['han', 'He remembers me. Great. I’m flattered. Shoot him, Chewie.'],
        ],
        hit: [['comms', 'Impressive. Most impressive.'], ['han', 'Impressive this.']],
        half: [
          ['comms', 'You cannot win, Solo. The Empire is patient. I am not.'],
          ['chewie', '[a triumphant roar]'],
        ],
        weak: [
          ['comms', 'Your shields are failing. You will make a fine addition to my collection.'],
          ['han', 'Not today, pal. Chewie, give me everything we’ve got!'],
        ],
        evade: [['comms', 'I have you now.'], ['han', 'Like hell you do!']],
        fury: [['comms', 'You have failed me for the last time.'], ['han', 'He’s throwing everything at us! Chewie, evasive! EVASIVE!']],
        retreat: [
          ['comms', 'Another time, Captain. We will meet again. Count on it.'],
          ['han', 'He’s running. Vader’s running! Chewie, remember this moment.'],
        ],
        bait: [['han', 'He’s stalling! Chewie, he WANTS us to overshoot—'], ['chewie', '[a roar, too late]']],
        search: [['comms', 'Running does not become you, Captain Solo.'], ['han', 'He’s lost us. Keep that moon between us, pal.']],
        found: [['comms', 'There you are.'], ['han', 'He’s on us again. Of course he is.']],
        leaving: [['chewie', '[a long, relieved moan]'], ['han', 'Yeah. Me too, pal.']],
      },
      // Imperial customs, pulling you over (an inspector: cut your engines and it scans you)
      customs: {
        seen: [['han', 'Imperial gunboat. Customs. Look casual, Chewie.'], ['chewie', '[a growl: how does one look casual]']],
        hello: [
          ['comms', 'Freighter, this is Imperial customs. Cut your engines and prepare to be boarded for inspection.'],
          ['han', 'Boarded. On the Falcon. With what’s in the smuggling compartments. Chewie… what do you think?'],
        ],
        clean: [
          ['comms', 'Scan complete. Freighter, your cargo is in order. Move along.'],
          ['han', 'In order. Did you hear that, Chewie? In order. Those compartments were worth every credit.'],
          ['chewie', '[a smug laugh]'],
        ],
        busted: [
          ['comms', 'Scan complete. Contraband detected. Han Solo, you are under arrest. Fighters inbound.'],
          ['han', 'Yeah, I figured. Chewie, punch it!'],
        ],
        run: [
          ['comms', 'Freighter, you are fleeing an Imperial inspection! All units, pursue!'],
          ['han', 'Fleeing is such a strong word. Hang on!'],
        ],
        hit: [['comms', 'Shots fired on an Imperial vessel! Requesting immediate support!']],
        leaving: [['han', 'And they’re gone. See, Chewie? Charm.'], ['chewie', '[a doubtful grunt]']],
      },
      // Hondo Ohnaka, with a toll to collect (a trickster: hold still and he pays you back with news)
      hondo: {
        seen: [['han', 'Weequay skiff. Hailing us. Nicely. That’s never good.']],
        hello: [
          ['comms', 'Captain Solo! Hondo Ohnaka! It has been too long! You are in Hondo’s lane, and Hondo’s lane has a toll. Hold still, my old friend, let me look in that famous hold of yours.'],
          ['han', 'Hondo. You still owe me for Florrum.'],
          ['comms', 'Do I? How time flies!'],
        ],
        paid: [
          ['comms', 'Empty! The Millennium Falcon, and the hold is empty! Solo, what has become of you? Hondo cannot rob a poor man. Hondo has a reputation. So, instead, a little news. On the house.'],
          ['han', 'Nothing’s ever on the house with you. Go ahead.'],
        ],
        tip: {
          hunt: [['comms', 'The Empire is on your trail, my friend. A patrol. I would be somewhere else, and quickly.']],
          destroyer: [['comms', 'A Star Destroyer is coming for you. Hondo has seen one up close. Do not.']],
          bounty: [['comms', 'Someone has come to collect on your head, Solo. Not me! I would never. Today.']],
          distress: [['comms', 'Someone nearby is about to call for help. Pirates. Not mine. Probably not mine.']],
          any: [['comms', 'Something is coming your way, Solo. Hondo does not know what. But Hondo knows that feeling well.']],
        },
        angry: [
          ['comms', 'So! The great Han Solo wishes to pay the hard way! Boys! Teach him some manners!'],
          ['han', 'Here we go. Chewie, guns!'],
        ],
        hit: [['comms', 'Solo! You shot at Hondo! After everything! Boys!']],
        friend: [['comms', 'Solo! My brother in piracy! No toll for you, never, not from Hondo! Only news, and my undying affection.'], ['han', 'Brother in piracy. Chewie, we’ve let ourselves go.']],
        leaving: [['comms', 'Until next time, Captain! Try to be richer!'], ['han', 'Try to be gone.']],
      },
      lando: {
        seen: [
          ['han', 'Is that who I think it is?'],
          ['chewie', '[a wary growl]'],
        ],
        hello: [
          ['comms', 'Han Solo. You’ve got a lot of guts coming out here.'],
          ['han', 'Lando, you old pirate. I’m not here for a fight.'],
        ],
        offer: [
          ['comms', 'I’ve got a {part} going cheap. For you, old buddy, almost a fair price. Hangar’s got it.'],
          ['han', 'Almost. Right.'],
        ],
        hit: [['comms', 'Han! Watch it! I just had that freighter cleaned!']],
        grudge: [['comms', 'You shot at me, Han. After everything. Find your parts somewhere else, old buddy.'], ['han', 'Still sore about that, huh.']],
        shunned: [['comms', 'Word gets around, Han. Freighters are turning tail at the sight of you. I can’t be seen dealing with that. Not even for you.'], ['han', 'Since when do you have standards, Lando?']],
        leaving: [['comms', 'Some other time, old buddy. Calrissian out.']],
      },
    },
    interdicted: [
      ['han', 'Interdictor! They’ve yanked us out of the drive!'],
      ['chewie', '[a furious roar]'],
    ],
    crashInto: {
      star: [
        ['han', 'That’s a star, Chewie! Why didn’t you say it was a star?!'],
        ['chewie', '[an indignant roar]'],
      ],
      giant: [
        ['han', 'We’re in the soup! Pull her up!'],
        ['chewie', '[a straining roar]'],
      ],
      citadel: [
        ['comms', 'Freighter, you have violated Council space. Surrender.'],
        ['han', 'A whole city of the same guy. This is the worst cantina I’ve ever seen.'],
      ],
    },
    hit: [
      ['han', 'We’re taking hits!'],
      ['chewie', '[an angry roar]'],
    ],
    shields: [
      ['han', 'Shields are going! Chewie, angle the deflector!'],
      ['chewie', '[a frantic roar]'],
    ],
    destroyed: [
      ['han', 'Chewie, punch it!'],
      ['chewie', '[a mournful howl]'],
    ],
    escaped: [
      ['han', 'Never tell me the odds.', 'neverTellOdds'],
      ['chewie', '[a happy roar]'],
    ],
    cleared: [
      ['han', 'That’s the last of them. Not bad for a hunk of junk.'],
      ['chewie', '[a triumphant roar]'],
      ['han', 'I know.'],
    ],
    ram: {
      kill: [
        ['chewie', '[an alarmed roar]'],
        ['han', 'Relax, she’s been through worse. I think.'],
      ],
      cleared: [
        ['han', 'That’s the last of them. Rammed it. Don’t tell Lando.'],
        ['chewie', '[a doubtful growl]'],
      ],
    },
    // the ship's powers (shipPowers.js)
    powers: {
      odds: { use: [['han', 'Never tell me the odds.', 'neverTellOdds']] },
      quad: {
        use: [
          ['han', 'Chewie, take the guns!'],
          ['chewie', '[a roar: he’s on the quad lasers]', 'chewieRoar'],
        ],
        ready: [['chewie', '[an eager growl: the turrets are his whenever you say]']],
        big: [['chewie', '[a big, pleased laugh]', 'chewieLaugh']],
      },
    },
    events: {
      // friends on your wing in a long fight (wingmen.js), and going again
      wingmen: {
        xwing: [
          ['comms', 'Falcon, this is Rogue Squadron. Thought you could use a hand.'],
          ['han', 'I had it under control. But sure, come on in.'],
          ['chewie', '[an approving roar]'],
        ],
        ywing: [
          ['comms', 'Gold Squadron on approach, Falcon. Try not to outrun us.'],
          ['han', 'Y-wings. They’re bricks, Chewie, but they’re bricks with cannons.'],
        ],
        awing: [
          ['comms', 'Green Squadron, Falcon. Quick pass, then we’re gone.'],
          ['han', 'Story of my life. Make it count, kid.'],
        ],
      },
      wingmenGone: [
        ['comms', 'Rogue Squadron out. Try to stay out of trouble, Solo.'],
        ['han', 'No promises.'],
      ],
      // someone else's fight out ahead (skirmishes.js): seen, won with your help, lost
      skirmish: [
        ['han', 'Somebody’s getting jumped up ahead. Rebels, by the look of it.'],
        ['chewie', '[an urgent growl]'],
        ['han', 'Yeah, yeah. We’re going.'],
      ],
      skirmishThanks: [
        ['comms', 'Falcon, we owe you one. Drinks are on us.'],
        ['han', 'I’m holding you to that.'],
      ],
      skirmishLost: [
        ['han', 'Didn’t make it. Shame.'],
        ['chewie', '[a mournful moan]'],
      ],
      // your standing (standing.js): the Empire marking you, the ordinary ships fearing or loving you, the pirates taking to you
      standing: {
        suspect: [['han', 'Every patrol we pass is scanning us, Chewie. We’re on a list.'], ['chewie', '[an unbothered grunt]'], ['han', 'Yeah. Another one.']],
        wanted: [['comms', 'All Imperial units: the freighter is wanted. Engage on sight.'], ['han', 'Wanted. Again. Chewie, we should frame this one.']],
        trusted: [['comms', 'Imperial customs. Freighter, your record is… spotless. Move along.'], ['han', 'Spotless. Did you hear that, Chewie? Spotless.'], ['chewie', '[a disbelieving laugh]']],
        feared: [['han', 'That freighter just ran from us. From us, Chewie.'], ['chewie', '[a low, unhappy moan]'], ['han', 'Yeah. I know. We’re the bad guys now.']],
        hero: [['comms', 'It’s the Falcon! Thank you, Falcon!'], ['han', 'Heroes, Chewie. Don’t get used to it. It doesn’t pay.']],
        friend: [['comms', 'The outer lanes salute the Millennium Falcon! Fly free, Solo!'], ['han', 'Pirates like us. That’s either very good or very bad for business.']],
      },
      // a patrol going past has reported you (traffic.js's spotted)
      spotted: [['han', 'That patrol made us. They’re calling it in.'], ['chewie', '[a growl]'], ['han', 'I know, I know. Guns.']],
      wanted: {
        any: [['han', 'Great. Now there’s a price on us. Again.'], ['chewie', '[an unhappy rumble]']],
        3: [['han', 'Gunboats with missiles. Chewie, when I say break, break.'], ['chewie', '[a roar]']],
        5: [['han', 'That’s the whole Imperial Security Bureau.'], ['chewie', '[a howl]'], ['han', 'Yeah. I’ve always wanted to be popular.']],
        search: [['han', 'They’ve lost us. Kill the running lights and sit tight.']],
        lost: [['han', 'Told you. Nobody catches the Falcon.'], ['chewie', '[a growl]'], ['han', 'The bounty? Sure, that’s still there. We’ll pay it. Eventually.']],
      },
      // an ace hurt into its next stage (hunterRules.js's stages), by who
      stage: {
        tieadvanced: [['comms', 'Impressive. Now you will see what a Sith can do.'], ['han', 'He just got faster. How does he just get faster?!']],
        slave1: [['han', 'Seismic charges! Chewie, he’s dropping seismic charges! Get us out of the way!'], ['chewie', '[a roar]']],
        ig2000: [['comms', 'Combat parameters: adjusted.'], ['han', 'The droid’s gone berserk! Chewie, track it!']],
        houndstooth: [['han', 'Bossk is hanging back and hammering us. Close in, Chewie, close in!']],
        punishingone: [['han', 'Dengar’s jamming us. Every time we tag him he drops off the scope!'], ['chewie', '[a frustrated roar]']],
        any: [['han', 'It’s changed up on us! Chewie, watch it!']],
      },
      // the fight with the Star Destroyer (capitalRules.js): its turbolasers,
      // your shots off its shield, its domes going, its bridge open, it
      // running or going up
      capital: {
        fired: [['han', 'Turbolasers! Chewie, don’t fly straight, whatever you do!'], ['chewie', '[a roar]']],
        shielded: [['han', 'We’re not even scratching it! Shields!'], ['chewie', '[a growl: the two domes on the tower]'], ['han', 'The generators on the tower. Yeah, I see them. Those first.']],
        dome: [['han', 'One generator down! One more, Chewie!']],
        open: [['han', 'Shields are down! It’s running! The bridge, Chewie, hit the bridge before it jumps!']],
        bridge: [['han', 'That’s the bridge! She’s going down! Get us clear!'], ['chewie', '[a roar]']],
        dead: [['chewie', '[an enormous, triumphant roar]'], ['han', 'A Star Destroyer, Chewie. We took down a Star Destroyer. In a hunk of junk. I love this ship.']],
        fled: [['han', 'It jumped. Figures. Ran with its shields down.'], ['chewie', '[a disappointed moan]'], ['han', 'Yeah. Me too.']],
        gone: [['han', 'And it’s gone. A generator lighter. Not bad.']],
        wave: [['han', 'More TIEs coming out of it! Chewie, how many fighters does one of those things carry?!'], ['chewie', '[a roar: a lot]']],
      },
      destroyer: [
        ['han', 'Star Destroyer! Why is it always a Star Destroyer?'],
        ['chewie', '[an alarmed roar]'],
      ],
      distress: [
        ['comms', 'Mayday! Pirates, Weequay pirates, we can’t shake them!'],
        ['han', 'Not our problem.'],
        ['chewie', '[an insistent growl]'],
        ['han', 'Fine, fine. Let’s go be heroes.'],
      ],
      rescued: [
        ['comms', 'Thanks, Falcon! We owe you one.'],
        ['han', 'Yeah. Pay up in credits.'],
      ],
      convoy: [
        ['han', 'A convoy. Bet there’s good cargo in those holds.'],
        ['chewie', '[a disapproving growl]'],
        ['han', 'I’m just saying.'],
      ],
      comet: [['han', 'A comet. Don’t get any ideas, Chewie. We’re not chasing it.']],
      supernova: [
        ['han', 'Whoa. That’s a whole star going up. Glad we weren’t parked there.'],
        ['chewie', '[an awed growl]'],
      ],
      deep: [
        ['han', 'Out here it’s just us and the stars, pal.'],
        ['chewie', '[a contented growl]'],
      ],
      trench: [
        ['han', 'The trench? Chewie, we’re not an X-wing!'],
        ['chewie', '[a worried roar]'],
      ],
      hyperspeed: [
        ['han', 'Coordinates are in. Hang on, Chewie.'],
        ['chewie', '[an eager roar]'],
      ],
      overdrive: [
        ['han', 'Pushing her past what she was built for. Just how I like it.'],
        ['chewie', '[a doubtful growl]'],
      ],
      rock: [
        ['chewie', '[an angry roar: a rock, right through the shields]'],
        ['han', 'I know, I know. Never tell me the odds, and never fly this fast through a rock field.'],
      ],
      battle: {
        front: [
          ['han', 'Would you look at that. A whole fleet action. Chewie, we’re not getting paid enough for this.'],
          ['chewie', '[an agreeing growl]'],
        ],
        join: [
          ['han', 'Alright, we’re in. Keep the shields up and the quad guns hot.'],
          ['chewie', '[a ready roar]'],
        ],
        gens: [
          ['han', 'Shield’s down! Told you it’d work.'],
          ['chewie', '[a pleased roar]'],
        ],
        bridge: [
          ['han', 'There goes the bridge. Now the reactor, before they work out what hit them.'],
        ],
        reactor: [
          ['chewie', '[an excited howl]'],
          ['han', 'Ha! Split right down the middle. That’s some flying.'],
        ],
        won: [
          ['han', 'Sector’s ours. Drinks are on whoever’s paying.'],
          ['chewie', '[a laughing growl]'],
        ],
        lost: [
          ['han', 'We’re pulling back. Don’t give me that look, Chewie, I know.'],
          ['chewie', '[a mournful growl]'],
        ],
        warWon: [
          ['han', 'That’s the whole war. Every sector. Not bad for a smuggler and a walking carpet.'],
          ['chewie', '[an indignant roar]'],
        ],
        warLost: [
          ['han', 'They’ve taken the lot. Fine. We start over. We always do.'],
        ],
      },
      meteors: [
        ['chewie', '[A roar: rocks ahead!]'],
        ['han', 'I see them. Never tell me the odds, Chewie.'],
      ],
      minefield: [
        ['chewie', '[an alarmed roar]'],
        ['han', 'Mines. Somebody went to a lot of trouble. Hold on, Chewie, I’m threading it.'],
      ],
      eclipse: [
        ['han', 'Huh. Eclipse. Moon right across the sun.'],
        ['chewie', '[a quiet, impressed rumble]'],
        ['han', 'Yeah, it’s pretty. Don’t get sentimental on me.'],
      ],
      escort: [
        ['comms', 'Falcon, this is the freighter Kessa Run. Pirates on our tail. We’ll pay you to see us to the next port.'],
        ['han', 'Now you’re talking.'],
        ['chewie', '[a pleased grunt]'],
      ],
      escortPirates: [
        ['han', 'Here they come. Chewie, keep ’em off that freighter, that’s our money!'],
        ['chewie', '[a battle roar]'],
      ],
      escorted: [
        ['comms', 'We made it. Sending the credits now, Falcon. Thanks.'],
        ['han', 'Pleasure doing business.'],
      ],
      escortLost: [
        ['han', 'We lost ’em. There goes the fee.'],
        ['chewie', '[a mournful moan]'],
        ['han', 'Yeah, I know. Them too.'],
      ],
      // the director's other happenings: a star flaring, a rift (and going
      // through one), something enormous passing (purrgil), a shot into it
      flare: [
        ['han', 'Chewie, that star’s about to blow its top. Hold on to something.'],
        ['chewie', '[A roar: the shockwave is coming.]'],
      ],
      rift: [
        ['han', 'Well, that’s new. A hole in space, right in front of us.'],
        ['chewie', '[A worried growl: should we go in?]'],
        ['han', 'I’ve flown through worse. Probably.'],
      ],
      rifted: [
        ['han', 'See? Told you. We’re… somewhere.'],
        ['chewie', '[A long, unimpressed groan.]'],
      ],
      // a portal gun of Rick's, won in a card game (P: gunPortal.js)
      portalgun: {
        out: [
          ['han', 'Won this off some old guy in a sabacc game. Says it opens a shortcut. Let’s find out.'],
          ['chewie', '[A worried howl: that is not a blaster.]'],
        ],
        home: [['han', 'All right, sightseeing’s over. Door home. Punch it, Chewie.']],
      },
      gunThrough: {
        rickmorty: [
          ['chewie', '[A bewildered growl: where are we?]'],
          ['han', 'Never seen this sector. Never seen a planet do that, either. I don’t like it.'],
        ],
        main: [
          ['han', 'Home. See? I know exactly what I’m doing.'],
          ['chewie', '[A sceptical rumble.]'],
        ],
      },
      leviathan: [
        ['chewie', '[An awed howl: purrgil!]'],
        ['han', 'Purrgil. Easy, Chewie. They jump to lightspeed on their own. Let’s not give them a reason.'],
      ],
      leviathanHit: [['han', 'Don’t shoot the whales, Chewie. We don’t need that kind of trouble.']],
    },
    wonders: {
      lantern: [['han', 'Pulsar. Chewie, give it a wide berth. I like my hair.']],
      twins: [['han', 'Two suns. Reminds me of a job on Tatooine I’d rather forget.']],
      wanderer: [['han', 'A planet out here on its own, no sun. Good place to hide, bad place to live.']],
      graveyard: [
        ['chewie', '[A low, uneasy growl.]'],
        ['han', 'Yeah. I see them. Ships don’t end up like that by accident, Chewie.'],
      ],
      citadel: [['han', 'A station full of the same crazy old guy. I’ve seen worse cantinas.']],
      rmportal: [['han', 'Green swirly thing. I’ve flown through worse. Probably.']],
      'rmportal-back': [['han', 'There’s our way out. Chewie, punch it.']],
      curvesun: [['han', 'Green sun. Whatever this place is, it isn’t on any of my charts.']],
      maw: [['han', 'Black hole. Even the Falcon can’t outrun that.']],
      aurelia: [['han', 'Big planet. Probably full of smugglers.']],
      glacia: [['han', 'I’ve had enough ice planets for one lifetime.']],
      ember: [['han', 'Another sun. Same old galaxy.']],
      halcyon: [['han', 'Blue star. Pretty. Don’t fly into it, Chewie.']],
      veil: [
        ['han', 'A nebula. Good place to lose the Empire.'],
        ['chewie', '[an agreeing growl]'],
      ],
      cradle: [['han', 'More nebula. The Kessel Run had more of these.']],
    },
    edge: [['han', 'Nothing out there but rocks. Turning around.']],
    arrive: {
      home: [
        ['han', 'Nice place. Not as nice as the Falcon.'],
        ['chewie', '[a polite growl]'],
      ],
      experience: [
        ['han', 'AWS, RTX, Bose. Kid’s had more jobs than I’ve had bounties.'],
        ['chewie', '[laughs]'],
      ],
      projects: [
        ['han', 'A Game Boy emulator? Chewie, we’re keeping that.'],
        ['chewie', '[a pleased rumble]'],
      ],
      resume: [
        ['han', 'One page? Mine would need a lawyer.'],
        ['chewie', '[agrees]'],
      ],
      contact: [
        ['han', 'Send him a message. Keep it short, nobody reads the long ones.'],
        ['chewie', '[a short, polite roar]'],
      ],
      terminal: [
        ['han', 'A terminal. Chewie, you’re the one who reads the manuals.'],
        ['chewie', '[an offended growl]'],
      ],
      starwars: [
        ['han', 'That’s home, pal. The whole galaxy, behind one gate.'],
        ['chewie', '[a happy roar: punch it]'],
      ],
      music: [
        ['han', 'Nice tune. Chewie, are you crying?'],
        ['chewie', '[sniffs, then roars]'],
      ],
      middleearth: [
        ['han', 'Giant eye, big volcano. Hard pass.'],
        ['chewie', '[agrees, loudly]'],
      ],
      transformers: [
        ['han', 'Robots that turn into cars? Don’t give the Falcon ideas.'],
        ['chewie', '[laughs]'],
      ],
      marvel: [
        ['han', 'Six stones. Bet I could sell those.'],
        ['chewie', '[a warning growl]'],
      ],
      breakingbad: [
        ['han', 'Albuquerque. My kind of town. Nobody asks questions.'],
        ['chewie', '[a suspicious huff]'],
      ],
      office: [
        ['han', 'Paper and coffee mugs. Looks like Imperial paperwork.'],
        ['chewie', '[a bored yawn]'],
      ],
      rickmorty: [
        ['han', 'Never trust a portal you didn’t open yourself.'],
        ['chewie', '[a nervous whine]'],
      ],
      gaming: [
        ['han', 'Blocks? Chewie, did you build this?'],
        ['chewie', '[a proud roar]'],
      ],
      travel: [
        ['han', 'Everybody’s been everywhere on this one.'],
        ['chewie', '[a contented rumble]'],
      ],
      caribbean: [
        ['han', 'Pirates. Finally, some honest people.'],
        ['chewie', '[an approving growl]'],
      ],
      invincible: [
        ['han', 'A guy who punches through starships with his bare hands. Let’s not, Chewie.'],
        ['chewie', '[a worried moan]'],
      ],
    },
  },
  {
    id: 'rv',
    ship: 'The RV',
    label: 'Walt and Jesse',
    jump: 'bluesky',
    speakers: {
      walt: { name: 'Walt', color: '#9fd27c', voice: 'walt' },
      jesse: { name: 'Jesse', color: '#ff9d55', voice: 'jesse' },
      meeseeks: { name: 'Mr. Meeseeks', color: '#7cc8ec', voice: 'morty' },
    },
    // the Citadel's siege (siege.js)
    siege: {
      shielded: [
        ['jesse', 'Yo, it’s got like a force field, Mr. White!'],
        ['walt', 'Then we cut its power. The generators, Jesse. On the arms.'],
      ],
      gen: [['jesse', 'Yeah, science! That’s one down, yo!']],
      shield: [['walt', 'The shield is down. Now, Jesse. The fulminated mercury.']],
      deflect: [['walt', 'Bullets won’t do it. We need something with a little more chemistry. Press three.']],
      dry: [['jesse', 'We’re out of the bomb stuff, Mr. White!']],
      down: [
        ['jesse', 'Yeah, Mr. White! Yeah, science!'],
        ['walt', 'Say my name.'],
      ],
      rebuilt: [['walt', 'They rebuilt it. Of course they did. Everyone wants back in the game.']],
      closed: [['jesse', 'There’s nothing there anymore, yo. We blew it up.']],
    },
    foot: {
      land: [
        ['walt', 'Jesse, we need to cook.', 'needToCook'],
        ['walt', 'We’re setting down, Jesse. Bring the gun.'],
        ['jesse', 'Yo, we’re landing the RV? On a planet?!'],
      ],
      out: [
        ['jesse', 'Solid ground, yo!'],
        ['walt', 'Stay close, Jesse. We don’t know who cooks here.'],
      ],
      squad: [
        ['jesse', 'Mr. White! Guys coming over the hill! Vests, yo, DEA vests!'],
        ['walt', 'Then we deal with them. Calmly.'],
      ],
      kill: {
        dea: [
          ['jesse', 'I-I got the agent. Mr. White, I shot a federal agent.'],
          ['walt', 'On another planet, Jesse. There’s no jurisdiction.'],
        ],
        cartel: [['jesse', 'Cartel guy’s down! Yeah!']],
        jackscrew: [
          ['jesse', 'That’s one of Uncle Jack’s guys, yo!'],
          ['walt', 'Good.'],
        ],
        gromflomite: [['jesse', 'Bug spray, yo!']],
        cop: [['walt', 'A cop, Jesse. That’s the second-worst thing you can shoot.']],
        gazorpian: [
          ['jesse', 'Mr. White, I dropped the big one!'],
          ['walt', 'Good. Now stop admiring it.'],
        ],
        any: [['jesse', 'Got him! Yeah, science!', 'yeahScience']],
      },
      hurt: [
        ['jesse', 'Ow! They tagged me, Mr. White!'],
        ['walt', 'Keep your head down, Jesse.'],
      ],
      down: [
        ['walt', 'Jesse… get up. We’re not done.'],
        ['jesse', 'Ugh. Space hurts, yo.'],
      ],
      up: [['jesse', 'I’m good. I’m good.']],
      cleared: [
        ['walt', 'That’s how it’s done. Clean. No evidence.'],
        ['jesse', 'Yo, that was crazy.'],
      ],
      swap: {
        walt: [['walt', 'I’ll take it from here.']],
        jesse: [['jesse', 'My turn, yo!']],
      },
      far: [['walt', 'The RV’s back there, Jesse. Don’t make me come get you.']],
      nowhere: [['jesse', 'Land on what? There’s nothing out here, yo.']],
      in: [
        ['walt', 'Back in the RV. We’re done here.'],
        ['jesse', 'Finally.'],
      ],
      friend: [
        ['jesse', 'Yo, somebody else just parked out here.'],
        ['walt', 'Stay calm. Let them come to us.'],
      ],
      alt: {
        walt: [
          ['jesse', 'Mr. White, there’s… another you. Like, from another dimension.'],
          ['walt', 'Then he knows exactly who he’s dealing with.'],
        ],
        jesse: [
          ['jesse', 'Yo, that’s me! That’s literally me, yo!'],
          ['walt', 'One of you is plenty, Jesse.'],
        ],
        any: [['walt', 'Another dimension. The same product, I hope.']],
      },
    },
    launch: [
      ['walt', 'Jesse. The RV has wings now. Try to keep up.'],
      ['jesse', 'Yo, Mr. White, we’re flying! In the RV!'],
    ],
    boost: [
      ['jesse', 'Yeah, Mr. White! Yeah, science!', 'yeahScience'],
      ['walt', 'Physics, Jesse. That one is physics.'],
    ],
    bump: [
      ['jesse', 'Yo! Watch the wings, man!'],
      ['walt', 'That was a rounding error, Jesse.'],
    ],
    crash: [
      ['jesse', 'Mr. White! We hit a planet! The RV is totalled!'],
      ['walt', 'Relax, Jesse. I’ve rebuilt this RV before.'],
    ],
    pulled: [
      ['jesse', 'Yo, Mr. White, it’s pulling us in! Floor it!'],
      ['walt', 'Gravity doesn’t negotiate, Jesse. Boost!'],
    ],
    swallowed: [
      ['jesse', 'Mr. White! It’s got the RV!'],
      ['walt', 'Not even light gets out, Jesse. Let’s see where it goes.'],
    ],
    idle: [
      ['walt', 'Say my name.', 'sayMyName'],
      ['jesse', 'Uh… Heisenberg? Can we go now?'],
    ],
    // the RV crosses over: both families of traffic come past it
    traffic: {
      tie: [
        ['jesse', 'Yo, those things look like bug zappers with wings!'],
        ['walt', 'TIE fighters. Keep your hands on the wheel, Jesse.'],
      ],
      interceptor: [
        ['jesse', 'Pointy ones! Mr. White, they got pointy ones!'],
        ['walt', 'Interceptors. Faster than us. We’ll see about smarter.'],
      ],
      xwing: [
        ['jesse', 'Those guys got four wings. We only got two.'],
        ['walt', 'Ours are home-made, Jesse. That counts double.'],
      ],
      slave1: [
        ['walt', 'A bounty hunter. Nobody says a word. We were never here.'],
        ['jesse', 'In a flying RV, Mr. White? Kinda hard to miss.'],
      ],
      patrol: [
        ['jesse', 'Cops! Space cops, Mr. White!'],
        ['walt', 'Act natural, Jesse. We’re a camper.'],
      ],
      gromflomite: [
        ['jesse', 'Giant bugs, yo! Giant space bugs!'],
        ['walt', 'Federation insects. Keep your voice down.'],
      ],
      meeseeks: [
        ['meeseeks', 'I’m Mr. Meeseeks! Look at me!', 'meeseeks'],
        ['jesse', 'Yo, that blue dude is way too happy.'],
      ],
      birdperson: [
        ['jesse', 'Is that a bird guy? Like, a whole bird guy?'],
        ['walt', 'Don’t stare, Jesse. It’s rude in any galaxy.'],
      ],
    },
    kill: {
      cousins: [
        ['jesse', 'They’re down! The silver cars are down, yo!'],
        ['walt', 'Both of them. Good. Now nobody tells Hector.'],
      ],
      suvace: [
        ['jesse', 'Mr. White… I think I just shot Hank.'],
        ['walt', 'You shot a truck, Jesse. A truck.'],
      ],
      gusvolvo: [
        ['jesse', 'Gus’s car is down! Yo, is he…?'],
        ['walt', 'Don’t count on it, Jesse. That man has walked out of worse.'],
      ],
      beater: [
        ['comms', 'Dude! Not cool! That’s Badger, yo!'],
        ['jesse', 'Sorry, Badger! My bad!'],
      ],
      balloon: [
        ['jesse', 'Mr. White, I shot a hot-air balloon.'],
        ['walt', 'The fiesta will survive, Jesse. Keep your eyes on the trucks.'],
      ],
      lowrider: [['jesse', 'Lowrider’s toast! Yeah!']],
      pollostruck: [['walt', 'That’s one less delivery for Gus.']],
      phoenixperson: [['jesse', 'Yo, I shot the robot bird. Was that bad? That felt bad.']],
      any: [
        ['jesse', 'Yeah! Got one! That’s sick!'],
        ['walt', 'We don’t celebrate in the middle of the job, Jesse.'],
      ],
      meeseeks: [
        ['jesse', 'Mr. White, I popped the blue guy!'],
        ['walt', 'He wanted that, Jesse. Trust me.'],
      ],
      birdperson: [
        ['jesse', 'Oh man, I shot the bird guy!'],
        ['walt', 'Keep flying. We don’t talk about the bird guy.'],
      ],
      xwing: [
        ['walt', 'Jesse! That one was on our side!'],
        ['jesse', 'They all look the same, Mr. White!'],
      ],
      slave1: [
        ['jesse', 'Yo, I tagged the bounty hunter!'],
        ['walt', 'Nobody comes after this RV. Nobody.'],
          ['walt', 'I’m the man who killed Gus Fring.', 'killedGus'],
      ],
    },
    // hunted by Albuquerque (sides.js): the DEA, the cartel, Gus's trucks,
    // the Cousins; and by whoever else is out here, met online
    hunted: {
      // APD and the DEA's tactical team, sent when you're wanted (wanted.js)
      apd: [
        ['jesse', 'Cops, Mr. White! Like, all the cops!'],
        ['walt', 'The ones with tasers will kill the engine. Keep them off us.'],
      ],
      dea: [
        ['jesse', 'Mr. White! DEA! Those are DEA trucks, yo!'],
        ['walt', 'I can see that, Jesse. Lose them. Calmly.'],
      ],
      ace: [
        ['jesse', 'That one’s got a spotlight. Mr. White, is that… is that Hank?'],
        ['walt', 'Don’t look at it, Jesse. Don’t look at him.'],
        ['walt', 'I am the one who knocks.', 'oneWhoKnocks'],
      ],
      cartel: [
        ['jesse', 'Lowriders, yo! Tuco’s guys! They’re shooting!'],
        ['walt', 'Then they’ve made a very poor business decision.'],
      ],
      pollos: [
        ['jesse', 'Chicken trucks. With rockets. Mr. White, Gus sent chicken trucks.'],
        ['walt', 'He wants the RV, Jesse, not us. Not yet.'],
      ],
      cousins: [
        ['jesse', 'Two silver cars. Just… coming. They’re not even shooting.'],
        ['walt', 'The Cousins. They don’t shoot first, Jesse. They don’t have to.'],
      ],
      // Gus himself at the head of his trucks (the pollos ace)
      gusvolvo: [
        ['jesse', 'Mr. White, the silver Volvo. That’s… that’s Gus’s car.'],
        ['walt', 'He won’t fire first, Jesse. He never does. Which is exactly why you watch him.'],
      ],
      fett: [
        ['jesse', 'Mr. White, that ship’s got a bounty hunter in it!'],
        ['walt', 'Then he’s made a very poor career decision.'],
      ],
      phoenix: [
        ['jesse', 'Is that a bird? Is that a robot bird?'],
        ['walt', 'Whatever it is, Jesse, it’s armed. Shoot it before it finishes deciding.'],
      ],
      empire: [
        ['jesse', 'Mr. White! Those bug zappers are shooting at us!'],
        ['walt', 'Then shoot back, Jesse.'],
      ],
      federation: [
        ['jesse', 'Space cops, yo! They’re shooting!'],
        ['walt', 'We don’t run, Jesse. We do the math. Then we run.'],
      ],
    },
    // the named characters who come by (npcs/index.js), by what they're saying
    npc: {
      // Tuco, come for you himself (a nemesis: he remembers)
      tuco: {
        seen: [['jesse', 'Yo, that lowrider… Mr. White, that’s Tuco. That’s Tuco’s car!']],
        hello: [
          ['comms', 'HEISENBERG! Hey! It’s me! Tuco! You thought you could just fly around out here? In MY sky? Tight! Tight tight tight!'],
          ['walt', 'Tuco. Jesse, stay calm.'],
          ['jesse', 'I AM calm! This is me calm!'],
        ],
        again: [
          ['comms', 'Heisenberg! You’re back! I been waiting! I been WAITING, man! And I brought my boys!'],
          ['walt', 'He remembers. Of course he remembers. Jesse, guns.'],
        ],
        hit: [['comms', 'You shot my car?! You SHOT MY CAR! Oh, you are DEAD, Heisenberg!']],
        half: [['comms', 'That all you got? THAT ALL YOU GOT?! I’m just getting WARMED UP!'], ['jesse', 'He’s smoking, Mr. White! Keep hitting him!']],
        weak: [
          ['comms', 'Ooh, your shield thing’s almost gone! You scared, Heisenberg? You should be scared!'],
          ['walt', 'I am not scared of you, Tuco.'],
          ['jesse', 'I am! I’m a little scared!'],
        ],
        evade: [['comms', 'Ha! Too slow! TOO SLOW!']],
        fury: [['comms', 'YOU WANT IT?! YOU GOT IT! TIGHT! TIGHT TIGHT TIGHT!'], ['jesse', 'He’s lost his mind, Mr. White! He’s coming in from everywhere!']],
        retreat: [
          ['comms', 'Okay. Okay! This ain’t over, Heisenberg. Nobody does this to Tuco. NOBODY!'],
          ['jesse', 'He’s bailing! Yo, he’s bailing!'],
          ['walt', 'He’ll be back. Angrier. They always are.'],
        ],
        bait: [['jesse', 'Yo, he’s slowing down! Mr. White, go past— no, wait, DON’T—'], ['walt', 'He’s behind us. Jesse, hold on.']],
        search: [['comms', 'HEISENBERG! Where you at, Heisenberg? You can’t hide from Tuco!'], ['jesse', 'He lost us. Stay behind the rock, yo. Stay behind the rock.']],
        found: [['comms', 'THERE you are!'], ['walt', 'He’s seen us. Jesse. Jesse!']],
        leaving: [['jesse', 'He’s gone. Oh man. Oh man, Mr. White.'], ['walt', 'Breathe, Jesse.']],
      },
      // Hank, pulling you over (an inspector: cut your engines and he scans you)
      hank: {
        seen: [['jesse', 'Yo, that SUV’s got lights on it. Mr. White… is that Hank?']],
        hello: [
          ['comms', 'This is the DEA. Pull over and cut your engines. Now. Hey, is that… Walt? Walt, is that you in that thing?'],
          ['walt', 'Hank. Jesse, not a word. Not one word.'],
          ['jesse', 'I’m not saying anything!'],
        ],
        clean: [
          ['comms', 'Huh. Clean. Hey, buddy, what are you doing flying around in an RV? Marie’s gonna want to hear about this.'],
          ['walt', 'Just… getting some air, Hank.'],
          ['comms', 'In space. Sure. Okay. Drive safe, Walt.'],
        ],
        busted: [
          ['comms', 'Walt… Walt, there’s a lot of hits on this plate. A LOT. Jesus. Walt, pull over. Walt, I’m calling it in. I have to.'],
          ['walt', 'Hank, don’t.'],
          ['comms', 'All units. All units!'],
        ],
        run: [
          ['comms', 'Walt! WALT! Where do you think you’re going?! All units, suspect fleeing!'],
          ['jesse', 'Yo, he knows it’s us! He knows!'],
        ],
        hit: [['comms', 'Did you just shoot at me? Did you just SHOOT at a federal agent?! Oh, you are done!']],
        leaving: [['walt', 'That was too close, Jesse.'], ['jesse', 'YOU think?!']],
      },
      saul: {
        seen: [['jesse', 'Mr. White, is that… Saul’s Caddy? Parked? In space?']],
        hello: [
          ['comms', 'Walter! Jesse! Saul Goodman. I’m parked right over here. Totally legitimate business.'],
          ['walt', 'What do you want, Saul?'],
        ],
        offer: [
          ['comms', 'Fell off a truck: one {part}, never used. Hangar’s got it. We’ll call it a retainer.'],
          ['jesse', 'Yo, that’s actually kind of sick.'],
        ],
        hit: [['comms', 'Hey! I’m on your side! Mostly!']],
        grudge: [['comms', 'You shot at my Caddy. You SHOT at my Caddy! You know what, find your own parts. We’re done. Professionally.'], ['walt', 'He’ll be back.']],
        shunned: [['comms', 'Walter, I’m hearing things. Trucks going missing. Everybody out here is terrified of you. I can’t be seen with that. Bad for business. Even my business.'], ['jesse', 'Even Saul won’t talk to us, yo.']],
        leaving: [
          ['comms', 'Okay, that’s my cue. You didn’t see me. I was never here.'],
          ['walt', 'He never is.'],
        ],
      },
      mike: {
        seen: [['jesse', 'That’s Mike’s car. Coming right at us.']],
        hello: [
          ['comms', 'Walter. Keep driving. Don’t look at me.'],
          ['walt', 'Mike. What is it?'],
        ],
        tip: {
          roadblock: [['comms', 'DEA’s setting up a roadblock up ahead. You’ll want to be ready for it.']],
          hunt: [['comms', 'You’ve got company coming. Several of them. I’d keep my eyes open.']],
          bounty: [['comms', 'The Cousins are out looking. If you see silver, don’t shoot first. Then do.']],
          destroyer: [['comms', 'Madrigal’s moving a freighter through. Gus’s trucks will be on it.']],
          distress: [['comms', 'Somebody’s going to call for help soon. Jack’s boys. Your call.']],
          any: [['comms', 'Something’s coming. I don’t know what yet. Stay sharp.']],
        },
        hit: [['comms', 'You’re lucky I don’t shoot back.']],
        leaving: [
          ['comms', 'That’s all I’ve got. No more half measures, Walter.'],
          ['jesse', 'Bye, Mike!'],
        ],
      },
    },
    interdicted: [
      ['jesse', 'Yo, the fast thing stopped! Why’d the fast thing stop?!'],
      ['walt', 'Interdiction, Jesse. Someone wants to talk. We don’t.'],
    ],
    crashInto: {
      star: [
        ['walt', 'Fusion, Jesse. Up close. My mistake.'],
        ['jesse', 'Your mistake?! We’re on fire!'],
      ],
      giant: [
        ['jesse', 'We’re sinking, Mr. White!'],
        ['walt', 'Pressure, Jesse. It builds. Then it crushes you.'],
      ],
      citadel: [
        ['comms', 'RV, you are in Council space. You will be processed.'],
        ['walt', 'A whole city of the same man. Imagine the chemistry.'],
      ],
    },
    hit: [
      ['jesse', 'We’re hit! The RV’s getting holes, yo!'],
      ['walt', 'Then plug them, Jesse.'],
    ],
    shields: [
      ['jesse', 'The shield thing’s almost dead, Mr. White!'],
      ['walt', 'Then stop letting them hit us!'],
    ],
    destroyed: [
      ['jesse', 'We’re going down, Mr. White!'],
      ['walt', 'We’ll rebuild. We always do.'],
    ],
    escaped: [
      ['walt', 'We lost them. Nobody catches Heisenberg.'],
      ['jesse', 'Yeah, Mr. White! Nobody!'],
    ],
    cleared: [
      ['jesse', 'We got ’em all, Mr. White!'],
      ['walt', 'Say my name.', 'sayMyName'],
    ],
    ram: {
      kill: [
        ['jesse', 'Yo, we just rammed him, Mr. White!'],
        ['walt', 'That’s not chemistry, Jesse. That’s physics. Mass times velocity.'],
      ],
      cleared: [
        ['jesse', 'We rammed the last one, yo! With the RV!'],
        ['walt', 'Mind the paint, Jesse. We still have to cook in this thing.'],
      ],
    },
    // the ship's powers (shipPowers.js)
    powers: {
      magnets: {
        use: [
          ['jesse', 'Yeah, Mr. White! Yeah, science!', 'yeahScience'],
          ['walt', 'Magnets, Jesse. Basic physics.'],
        ],
        refuse: { empty: [['jesse', 'Mr. White, there’s nothing out there to grab. Let ’em get closer, yo.']] },
      },
      heisenberg: {
        use: [['walt', 'Say my name.', 'sayMyName']],
        ready: [['jesse', 'Mr. White, the crystal’s ready. The… the boom one.']],
        big: [['walt', 'You’re goddamn right.', 'goddamnRight']],
      },
    },
    events: {
      // friends on your wing in a long fight (wingmen.js), and going again:
      // Saul, Mike, and whoever else is out here
      wingmen: {
        saulcaddy: [
          ['comms', 'Walter! Saul Goodman, attorney at law. I’m on your wing, and the meter’s running.'],
          ['jesse', 'Yo, it’s Saul! In the Caddy!'],
          ['walt', 'Just don’t get shot, Saul. I can’t afford the paperwork.'],
        ],
        mikesedan: [
          ['comms', 'Mike. Keep it straight and keep your mouth shut. I’ve got the ones behind you.'],
          ['jesse', 'Mike’s here! Mike, I knew you’d come, man!'],
          ['walt', 'He came for the money, Jesse.'],
        ],
        beater: [
          ['comms', 'Yo, yo, yo! Badger and Skinny Pete, reporting for duty, bitches!'],
          ['jesse', 'Badger! Pete! Okay, just, like, aim this time.'],
          ['walt', 'They’ll miss, Jesse. But they’ll be loud about it.'],
        ],
        xwing: [
          ['comms', 'Unidentified, uh, camper van. This is Rogue Squadron. We’ve got your back.'],
          ['jesse', 'Yo, Mr. White, the Star Wars guys are helping us!'],
          ['walt', 'Allies, Jesse. Every empire needs them.'],
        ],
        birdperson: [
          ['comms', 'I am Birdperson. I will defend your flying house.'],
          ['jesse', 'Yo, there’s a bird dude out there with a laser!'],
        ],
      },
      wingmenGone: [
        ['jesse', 'Later, yo! Thanks!'],
        ['walt', 'We were never here.'],
      ],
      // someone else's fight out ahead (skirmishes.js): seen, won with your
      // help, lost; whoever's out here, from either universe
      skirmish: {
        breakingbad: [
          ['jesse', 'Yo, there’s a shootout up ahead. Lowriders on a Madrigal truck. And… is that Saul?'],
          ['walt', 'That’s our shipment, Jesse. Nobody touches our shipment.'],
        ],
        starwars: [
          ['jesse', 'Yo, Mr. White, there’s a whole space battle up there!'],
          ['walt', 'Not our fight, Jesse. Although.'],
        ],
        rickmorty: [
          ['jesse', 'Yo, that bird dude is fighting the space cops!'],
          ['walt', 'The Federation. Never trust a government that big.'],
        ],
      },
      skirmishThanks: [
        ['comms', 'Thank you, strange flying camper!'],
        ['jesse', 'Yeah, science!'],
      ],
      skirmishLost: [['walt', 'We were never here, Jesse.']],
      distress: [
        ['comms', 'Mayday! Madrigal freight, we’ve got pickups on us! Anybody!'],
        ['jesse', 'Mr. White, we gotta help them!'],
        ['walt', 'Fine. But we were never here.'],
      ],
      rescued: [
        ['comms', 'Thank you, whoever you are!'],
        ['walt', 'Tell no one.'],
      ],
      // a Madrigal freighter jumps in, and Gus's trucks come out of it (the director's capital ship)
      // your standing (standing.js): the DEA marking you, the ordinary ships fearing or loving you, Jack's crew taking to you
      standing: {
        suspect: [['jesse', 'Yo, every DEA car we pass is looking at us, Mr. White.'], ['walt', 'We’re a person of interest, Jesse. Interest fades. Keep driving.']],
        wanted: [['comms', 'All DEA units: the RV is wanted. Engage on sight.'], ['jesse', 'Wanted?! We’re WANTED, Mr. White!'], ['walt', 'We were always wanted, Jesse. Now it’s on paper.']],
        trusted: [['comms', 'DEA. You’re… clear. Model citizens. Drive safe.'], ['walt', 'Model citizens. Jesse, don’t laugh.'], ['jesse', 'I’m not laughing! I’m… okay, I’m laughing.']],
        feared: [['jesse', 'That truck just turned around when it saw us. They’re scared of the RV, yo.'], ['walt', 'Good. Respect is just fear with manners.']],
        hero: [['comms', 'That’s them! The RV that saved us! Thank you!'], ['jesse', 'Yo, Mr. White, we’re like… heroes?'], ['walt', 'Don’t get attached to it.']],
        friend: [['comms', 'Jack says you’re good people. Fly easy.'], ['walt', 'Jack’s crew likes us. Jesse, that’s not a compliment.']],
      },
      // a patrol going past has reported you (traffic.js's spotted)
      spotted: [['jesse', 'Yo, that DEA car just saw us! They’re calling it in!'], ['walt', 'Then we have about a minute. Use it.']],
      wanted: {
        any: [['jesse', 'Mr. White, we’re wanted, yo! Like, actually wanted!'], ['walt', 'Then we act like professionals, Jesse.']],
        3: [['jesse', 'SWAT, Mr. White! They got rockets!'], ['walt', 'Take out the support van. Without it they fall apart.']],
        5: [['jesse', 'It’s everybody! APD, DEA, everybody!'], ['walt', 'Then they know who we are. Good.']],
        search: [['walt', 'They’ve lost us. Stay out of sight and say nothing.']],
        lost: [['jesse', 'We lost ’em! Yeah, science!'], ['walt', 'The bounty stays, Jesse. Somebody will come for it. Pay it off when we land.']],
      },
      // an ace hurt into its next stage (hunterRules.js's stages), by who
      stage: {
        suvace: [['comms', 'All units, all units, I need backup NOW! It’s the RV!'], ['walt', 'Hank’s pulling back and calling it in. Jesse, this just got worse.']],
        gusvolvo: [['walt', 'He’s keeping his distance. And his trucks are coming. That’s Gus. He never does anything alone.'], ['jesse', 'Great. GREAT.']],
        cousins: [['jesse', 'Yo, they got faster! Why’d they get faster?!'], ['walt', 'Because we hurt them, Jesse. Hurt them more.']],
        any: [['walt', 'It’s changed tactics. Stay sharp, Jesse.'], ['jesse', 'I AM sharp! I’m the sharpest!']],
      },
      // the fight with the Madrigal freighter (capitalRules.js): its guns, your
      // shots off its shield, its emitters going, its cab open, it running or
      // going up
      capital: {
        fired: [['jesse', 'Yo, the freighter’s shooting at us! Those are like, big ones!'], ['walt', 'Slow ones, Jesse. Watch where they go, and don’t be there.']],
        shielded: [['jesse', 'Our shots aren’t doing anything, Mr. White!'], ['walt', 'A shield. See the two glowing emitters on it? Those are its weak point. Everything has one.']],
        dome: [['walt', 'One emitter down. One more, Jesse.']],
        open: [['jesse', 'The shield’s gone! It’s turning around!'], ['walt', 'It’s running. The cab, Jesse. Hit the cab before it jumps.']],
        bridge: [['walt', 'That’s the cab. It’s coming apart. Back off, Jesse. Now.']],
        dead: [['jesse', 'Oh my god. We blew up a whole freighter. Gus’s freighter!'], ['walt', 'Gus will notice. Good. Let him.']],
        fled: [['jesse', 'It jumped! It got away!'], ['walt', 'With no shield and a hole in it. Gus will have questions. That’s enough for today.']],
        gone: [['walt', 'And it’s gone. An emitter short. Someone will have to explain that to Gus.']],
        wave: [['jesse', 'More trucks coming out of it, yo!'], ['walt', 'He ships more than chicken, Jesse.']],
      },
      destroyer: [
        ['jesse', 'Whoa! That freighter just came out of nowhere! It’s Madrigal’s!'],
        ['walt', 'Gus’s trucks, Jesse. He ships more than chicken.'],
      ],
      // Hank's spotlight on the RV (the 'spotlight' trait: the HUD goes a moment)
      spotlit: [
        ['jesse', 'Yo, I can’t see! Is that a spotlight?!'],
        ['walt', 'Hank. Keep your head down, Jesse.'],
      ],
      // the DEA across the road ahead (the director's roadblock)
      roadblock: [
        ['comms', 'This is the DEA. Cut your engines and hold position. Now.'],
        ['jesse', 'Roadblock, yo! In space! How do they even—'],
        ['walt', 'Through them, Jesse. There is no around.'],
      ],
      convoy: [
        ['jesse', 'Whoa, look at all those trucks, yo.'],
        ['walt', 'Distribution, Jesse. That’s how you build an empire.'],
      ],
      comet: [
        ['jesse', 'Mr. White, a comet!'],
        ['walt', 'Ice and dust, Jesse. Chemistry, frozen.'],
      ],
      supernova: [
        ['jesse', 'Yo! Did a star just blow up?!'],
        ['walt', 'A supernova, Jesse. Every element heavier than iron was made in one of those. Including what we cook with.'],
      ],
      deep: [
        ['jesse', 'Mr. White, where are we even going?'],
        ['walt', 'Out here, Jesse, nobody is watching.'],
      ],
      trench: [
        ['jesse', 'Why are we flying down a trench on a giant death ball?!'],
        ['walt', 'Because we can, Jesse.'],
      ],
      hyperspeed: [
        ['jesse', 'Yo, Mr. White, we just turned into crystal! Blue crystal!'],
        ['walt', 'Sublimation, Jesse. We go over as vapour and come down as product. Ninety-nine point one percent of us, anyway.'],
      ],
      overdrive: [
        ['jesse', 'This is insane, yo! Everything’s a blur!'],
        ['walt', 'Seatbelt, Jesse.'],
      ],
      rock: [
        ['jesse', 'Yo, what was that?! We hit something!'],
        ['walt', 'A rock, Jesse. At this speed it hits like a truck. The shields took it. Slow down in the fields.'],
      ],
      battle: {
        front: [
          ['jesse', 'Mr. White, that’s a war out there! Gus’s trucks and the cartel, going at it!'],
          ['walt', 'Then we choose a side, Jesse. Carefully.'],
        ],
        join: [
          ['walt', 'We’re in. Stay close, keep firing, and do not panic.'],
          ['jesse', 'Yeah, science! Okay!'],
        ],
        gens: [
          ['jesse', 'Their shield’s down! Yeah, Mr. White!'],
          ['walt', 'The command deck next. Then the core.'],
        ],
        bridge: [
          ['walt', 'The command deck is gone. Now the reactor, Jesse. Finish it.'],
        ],
        reactor: [
          ['jesse', 'It’s breaking in half! Yeah, Mr. White!'],
          ['walt', 'Chemistry, Jesse. Pressure finds the weakest point.'],
        ],
        won: [
          ['jesse', 'We won, yo! We actually won!'],
          ['walt', 'The territory is ours.'],
        ],
        lost: [
          ['jesse', 'They’re beating us back, Mr. White.'],
          ['walt', 'A tactical withdrawal. We regroup, and we come back stronger.'],
        ],
        warWon: [
          ['walt', 'Every sector. All of it. I’m in the empire business, Jesse.'],
          ['jesse', 'Yeah. Yeah, you are.'],
        ],
        warLost: [
          ['jesse', 'They took everything, Mr. White.'],
          ['walt', 'Then we start from nothing. We’ve done it before.'],
        ],
      },
      meteors: [
        ['jesse', 'Yo, Mr. White, rocks! Big ones!'],
        ['walt', 'A meteor stream, Jesse. Shoot what you can’t steer round.'],
      ],
      minefield: [
        ['jesse', 'Yo, Mr. White, are those mines? Who puts mines in space?'],
        ['walt', 'Someone who doesn’t want to be followed. Shoot them, Jesse, or go round.'],
      ],
      eclipse: [
        ['jesse', 'Yo, the sun’s going out. Mr. White, the sun’s going out!'],
        ['walt', 'It’s an eclipse, Jesse. A moon is passing in front of it. Totality lasts a few seconds. Just watch.'],
      ],
      escort: [
        ['comms', 'This is a Madrigal freighter. Our shipment has to reach the next stop, and Jack’s boys know about it. Can you ride along?'],
        ['walt', 'We’ll see it there.'],
        ['jesse', 'Since when do we do security?'],
      ],
      escortPirates: [
        ['jesse', 'Mr. White, they’re on the freighter!'],
        ['walt', 'Then get them off it.'],
      ],
      escorted: [
        ['comms', 'Shipment’s through. Madrigal appreciates your discretion.'],
        ['walt', 'Tell no one.'],
      ],
      escortLost: [
        ['jesse', 'They got the freighter, man.'],
        ['walt', 'Then we were never here.'],
      ],
      // the director's other happenings: a star flaring, a rift (and going
      // through one), something enormous passing (purrgil or a Cromulon), a shot into it
      flare: [
        ['jesse', 'Mr. White, the sun’s flaring! Is that bad?'],
        ['walt', 'A coronal mass ejection, Jesse. Charged particles. The shields will take it. Mostly.'],
      ],
      rift: [
        ['jesse', 'Yo, is that a hole in space? That’s a hole in space.'],
        ['walt', 'A rift. If we fly into it, we come out somewhere else. I’m not sure I want to know where.'],
      ],
      rifted: [
        ['jesse', 'Where are we, Mr. White?'],
        ['walt', 'Somewhere else, Jesse. Check the map.'],
      ],
      // a portal gun of Rick's, left in the RV (P: gunPortal.js)
      portalgun: {
        out: [
          ['jesse', 'Yo, Mr. White, there’s a green sci-fi gun in the glovebox. Some old dude with spiky hair left it at the car wash.'],
          ['walt', 'Then point it ahead of us, Jesse. Carefully. Let’s see what it does.'],
        ],
        home: [['walt', 'We’ve seen enough. Open it again, Jesse. We’re going home.']],
      },
      gunThrough: {
        rickmorty: [
          ['jesse', 'Yo, yo, yo… where are we? That planet is moving, Mr. White!'],
          ['walt', 'Another dimension, Jesse. Stay in the RV. Touch nothing.'],
        ],
        main: [['jesse', 'Okay. Okay, we’re back. I’m never touching that gun again, yo.']],
      },
      leviathan: {
        bear: [
          ['jesse', 'Mr. White… it’s the bear. The pink bear. The one with the eye.'],
          ['walt', 'I see it, Jesse.'],
          ['jesse', 'Why is it out here, yo? Why is it so big?'],
          ['walt', 'Keep flying. Some things follow you.'],
        ],
        purrgil: [
          ['jesse', 'Mr. White. Space whales. Actual space whales.'],
          ['walt', 'Purrgil, Jesse. Let them by. We don’t want to be in their way when they jump.'],
        ],
        cromulon: [
          ['comms', 'SHOW ME WHAT YOU GOT!'],
          ['jesse', 'What does it want, Mr. White? What have we got?'],
          ['walt', 'Nothing it wants, Jesse. Keep flying.'],
        ],
      },
      leviathanHit: [['walt', 'Jesse. Stop shooting the enormous thing.']],
    },
    wonders: {
      lantern: [
        ['jesse', 'Yo, Mr. White, that star’s flashing.'],
        ['walt', 'A pulsar, Jesse. A neutron star. A teaspoon of it weighs more than a mountain. We are not stopping.'],
      ],
      twins: [
        ['jesse', 'Two suns, Mr. White!'],
        ['walt', 'A binary pair. The smaller one is pulling gas off the larger. Chemistry, Jesse, on a scale you can see.'],
      ],
      wanderer: [
        ['jesse', 'Where’s the sun for this one?'],
        ['walt', 'There isn’t one. A rogue planet. It left, Jesse. Some things do.'],
      ],
      graveyard: [
        ['jesse', 'Mr. White. Those are wrecks. Like, hundreds.'],
        ['walt', 'A graveyard round a dead star. Whatever happened here, Jesse, it happened fast.'],
      ],
      citadel: [
        ['jesse', 'A whole city of the same old dude?'],
        ['walt', 'Imagine their supply chain.'],
      ],
      rmportal: [
        ['jesse', 'Mr. White, there’s a big green hole in the sky.'],
        ['walt', 'Then we go through it, Jesse. Carefully.'],
      ],
      'rmportal-back': [
        ['jesse', 'Is that the green hole home?'],
        ['walt', 'Back to our side of things. Yes.'],
      ],
      curvesun: [
        ['jesse', 'Yo, the sun is green. Like, actually green.'],
        ['walt', 'A different spectrum entirely. Different chemistry, Jesse.'],
      ],
      maw: [
        ['walt', 'A black hole, Jesse. Not even light gets out.'],
        ['jesse', 'That’s messed up, yo.'],
      ],
      aurelia: [
        ['jesse', 'That planet is huge, yo!'],
        ['walt', 'Hydrogen and helium, Jesse. The simplest chemistry there is.'],
      ],
      glacia: [['walt', 'Methane ice. Beautiful.']],
      ember: [
        ['jesse', 'Another sun, Mr. White!'],
        ['walt', 'Fusion, Jesse. The purest product there is.'],
      ],
      halcyon: [['walt', 'A blue star. Ninety-nine point one percent pure.']],
      veil: [
        ['jesse', 'Whoa. It’s like, pretty, yo.'],
        ['walt', 'A stellar nursery, Jesse. Show some respect.'],
      ],
      cradle: [
        ['jesse', 'Another space cloud!'],
        ['walt', 'Eyes on the road, Jesse.'],
      ],
    },
    edge: [['walt', 'There’s nothing out there, Jesse. Nothing worth the fuel. Turning back.']],
    arrive: {
      home: [
        ['jesse', 'Yo, who parks a whole space station out here?'],
        ['walt', 'Tilak’s. The man who built every planet out here. Show some respect.'],
      ],
      experience: [
        ['walt', 'Six jobs, Jesse. AWS, RTX, Bose, and every one of them done properly.'],
        ['jesse', 'Way better than working at a car wash, huh, Mr. White?'],
        ['walt', 'You’re goddamn right.', 'goddamnRight'],
      ],
      projects: [
        ['jesse', 'Yo, he made his own Game Boy? From nothing? That’s sick!'],
        ['walt', 'A shell, a file system, an emulator, all from first principles. That is craft, Jesse.'],
      ],
      resume: [
        ['walt', 'One page. Clean, precise, not one wasted word.'],
        ['jesse', 'Mine just says “Cap’n Cook.”'],
      ],
      contact: [
        ['jesse', 'Yo, that’s a serious antenna. Can it reach Saul?'],
        ['comms', 'Better call Saul!', 'callSaul'],
      ],
      terminal: [
        ['walt', 'A command line. No buttons, no hand-holding. Just precision.'],
        ['jesse', 'It’s all green letters, yo. Like a hacker movie.'],
      ],
      starwars: [
        ['jesse', 'Yo, Mr. White, there’s a whole galaxy behind that ring!'],
        ['walt', 'A galaxy far, far away, Jesse. We fly through the gate. Try not to touch anything.'],
      ],
      music: [
        ['walt', 'Indian classical music. A raga is a formula, Jesse. Every note in its place.'],
        ['jesse', 'It’s actually super chill, Mr. White.'],
      ],
      middleearth: [
        ['jesse', 'There’s a giant eye on that volcano, yo!'],
        ['walt', 'Middle-earth. One ring, and everyone loses their minds over it. I understand completely.'],
      ],
      transformers: [
        ['jesse', 'Yo, the cars down there are robots! Could the RV do that?'],
        ['walt', 'The RV already turned into a plane, Jesse. Let’s not get greedy.'],
      ],
      marvel: [
        ['walt', 'Six stones, Jesse. Whoever holds them all is in the empire business.'],
        ['jesse', 'Yo, that’s a lot of power for one glove.'],
      ],
      // reaching it plays Walt's own 'Say my name.' first (sounds.js)
      breakingbad: [
        ['jesse', 'Yo, one four eight three to the three to the six to the nine, representin’ the ABQ.', 'jesseRing'],
        ['walt', 'Albuquerque. Land quietly, Jesse. Hank lives down there.'],
      ],
      office: [
        ['jesse', 'Yo, the whole planet’s made of paper? Who needs that much paper?'],
        ['walt', 'Scranton. Thin margins, Jesse, but the product is consistent.'],
      ],
      rickmorty: [
        ['jesse', 'A crazy old scientist and his sidekick live here. Sounds kinda familiar, yo.'],
        ['walt', 'A genius who drinks on the job. Sloppy, Jesse. Sloppy.'],
      ],
      gaming: [
        ['jesse', 'Yo, it’s all blocks! It’s like being inside a video game!'],
        ['walt', 'Every chip of a Game Boy, rebuilt in code. That’s chemistry, Jesse, with electrons.'],
      ],
      travel: [
        ['walt', 'Earth, Jesse. Look at those routes. That’s a man who travels with a plan.'],
        ['jesse', 'Our plan was just “drive into the desert.”'],
      ],
      caribbean: [
        ['jesse', 'Pirates! Mr. White, there are actual pirates down there!'],
        ['walt', 'Smugglers with a dress code, Jesse.'],
      ],
      invincible: [
        ['jesse', 'Yo, that dude just flew through a building.'],
        ['walt', 'Then we do not owe him money, Jesse. Keep it that way.'],
      ],
    },
  },
];

// where the ship you fly is remembered (the map's, and the cockpit's launch
// comes out flying the ship it was)
export const SHIP_KEY = 'tp-universe-ship';

const BY_ID = new Map(CREWS.map((c) => [c.id, c]));

export const crewById = (id) => BY_ID.get(id) ?? null;

// A remembered or linked ship id, or null for anything else.
export const parseShip = (id) => (typeof id === 'string' && BY_ID.has(id) ? id : null);

// What the crew says when something happens: 'launch', 'boost', 'bump',
// 'edge', 'crash', 'pulled' and 'swallowed' (by the black hole), 'idle', 'hit',
// 'shields', 'destroyed', 'escaped' or 'cleared' (where a crew has those), a
// 'power' (by the ship power's id: its use, the big one charged, a big haul,
// a refusal),
// 'arrive' at a place, 'traffic' going
// past (by kind), a 'kill' (by kind, or any), a 'ram' (by when: 'kill' or
// 'cleared', a ship downed by flying into it), 'hunted' (by who: the
// faction, or 'ace'), an 'event' (by the director's id) or a 'wonder' (by
// its id; an event's lines may be keyed by `sub`, what came: a leviathan's
// kind), 'interdicted' (hunters cut the pulse drive), 'crashInto' (by
// what: 'star', 'giant', 'citadel'; the plain crash lines otherwise), or
// something on 'foot' (by what: 'land', 'out', 'squad', 'kill' (`sub`: by
// kind, or any), 'hurt', 'down', 'up', 'cleared', 'swap' (`sub`: who's
// played now), 'far', 'nowhere' or 'in'). An exchange, or null.
export function linesFor(crew, event, id, sub, more) {
  if (!crew) return null;
  if (event === 'arrive') return crew.arrive[id] ?? null;
  if (event === 'traffic') return crew.traffic?.[id] ?? null;
  if (event === 'kill') return crew.kill?.[id] ?? crew.kill?.any ?? null;
  if (event === 'ram') return crew.ram?.[id] ?? null;
  if (event === 'hunted') return crew.hunted?.[id] ?? null;
  if (event === 'crashInto') return crew.crashInto?.[id] ?? crew.crash ?? null;
  if (event === 'event') {
    const f = crew.events?.[id];
    if (!f) return null;
    return Array.isArray(f) ? f : (f[sub] ?? f.any ?? Object.values(f)[0] ?? null);
  }
  if (event === 'siege') return crew.siege?.[id] ?? null;
  if (event === 'npc') {
    // a character's (npcs/index.js) by what they're saying: `sub` is the
    // key ('seen', 'hello', 'offer', 'tip', 'hit', 'leaving', 'down'), and an
    // informant's tip is keyed again by what's coming (`more`), or `any`
    const f = crew.npc?.[id]?.[sub];
    if (!f) return null;
    return Array.isArray(f) ? f : (f[more] ?? f.any ?? null);
  }
  if (event === 'wonder') return crew.wonders?.[id] ?? null;
  if (event === 'power') {
    // the ship's powers (shipPowers.js): `sub` is when ('use', 'ready',
    // 'big', 'refuse'), and a refusal is keyed again by why (`more`)
    const f = crew.powers?.[id]?.[sub];
    if (!f) return null;
    return Array.isArray(f) ? f : (f[more] ?? f.any ?? null);
  }
  if (event === 'foot') {
    const f = crew.foot?.[id];
    if (!f) return null;
    return Array.isArray(f) ? f : (f[sub] ?? f.any ?? Object.values(f)[0] ?? null);
  }
  return crew[event] ?? null;
}
