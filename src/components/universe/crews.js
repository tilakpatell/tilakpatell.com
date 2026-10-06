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

export const CREWS = [
  {
    id: 'cruiser',
    ship: 'The space cruiser',
    label: 'Rick and Morty',
    speakers: {
      rick: { name: 'Rick', color: '#a8dcf0', voice: 'rick' },
      morty: { name: 'Morty', color: '#f5d33f', voice: 'morty' },
      meeseeks: { name: 'Mr. Meeseeks', color: '#7cc8ec', voice: 'morty' },
      birdperson: { name: 'Birdperson', color: '#c98b52', voice: null },
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
      squad: [
        ['morty', 'Rick! Federation guys, over the hill!'],
        ['rick', 'Gromflomites, Morty. Shoot the bugs.'],
      ],
      kill: {
        gromflomite: [['rick', 'Bug splat! Ha!']],
        cop: [
          ['morty', 'I-I shot a cop, Rick!'],
          ['rick', 'A Federation cop, Morty. Different rules.'],
        ],
        gazorpian: [['morty', 'The big one went down! The big one went down!']],
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
    },
    // hunters after you (hunters.js), by who they are
    hunted: {
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
    },
    // their lasers hitting you, your shields low, shot down
    // dropped out of the pulse drive by hunters, and crashes of other kinds
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
    // the director's set pieces (director.js), and going out into deep space
    events: {
      // friends on your wing in a long fight (wingmen.js), and going again
      wingmen: [
        ['birdperson', 'Rick. I am here to assist. It is what friends do.'],
        ['rick', 'Birdperson! Thank God. I mean, took you long enough.'],
      ],
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
      meteors: [
        ['morty', 'Rick! Rocks! A lot of rocks!'],
        ['rick', 'Meteor stream, Morty. Shoot the big ones, dodge the rest, don’t cry about it.'],
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
      kill: {
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
    },
    hunted: {
      fett: [
        ['r2', '[A Firespray on an attack run. Boba Fett.]'],
        ['luke', 'A bounty hunter. Stay with me, Artoo. He only has to miss once.'],
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
    events: {
      // friends on your wing in a long fight (wingmen.js), and going again
      wingmen: [
        ['comms', 'Red Two here, Luke. Coming in on your wing!'],
        ['luke', 'Wedge! Good to see you. Watch yourself, they’re quick.'],
      ],
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
      meteors: [
        ['r2', '[Meteor stream ahead. Recommend evasive action.]'],
        ['luke', 'I see them, Artoo. Just like Beggar’s Canyon.'],
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
        ['han', 'Bugs with blasters. I’ve got a bad feeling about this.'],
        ['chewie', '[a roar: let them come]'],
      ],
      kill: {
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
    },
    hunted: {
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
      ['han', 'I know.', 'hanIKnow'],
    ],
    events: {
      // friends on your wing in a long fight (wingmen.js), and going again
      wingmen: [
        ['comms', 'Falcon, this is Rogue Squadron. Thought you could use a hand.'],
        ['han', 'I had it under control. But sure, come on in.'],
        ['chewie', '[an approving roar]'],
      ],
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
      destroyer: [
        ['han', 'Star Destroyer! Why is it always a Star Destroyer?'],
        ['chewie', '[an alarmed roar]'],
      ],
      distress: [
        ['comms', 'Mayday! Imperial fighters, we can’t shake them!'],
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
      meteors: [
        ['chewie', '[A roar: rocks ahead!]'],
        ['han', 'I see them. Never tell me the odds, Chewie.'],
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
        ['jesse', 'Mr. White! Bug dudes, coming over the hill!'],
        ['walt', 'Then we deal with them. Calmly.'],
      ],
      kill: {
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
    // hunted by whoever's out (the RV is wanted in both universes)
    hunted: {
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
      ace: [
        ['jesse', 'Who’s the guy in the black TIE, yo?'],
        ['walt', 'Someone who thinks he’s the danger. He’s mistaken.'],
        ['walt', 'I am the one who knocks.', 'oneWhoKnocks'],
      ],
      federation: [
        ['jesse', 'Space cops, yo! They’re shooting!'],
        ['walt', 'We don’t run, Jesse. We do the math. Then we run.'],
      ],
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
    events: {
      // friends on your wing in a long fight (wingmen.js), and going again:
      // whoever's out here, from either universe
      wingmen: {
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
        ['comms', 'Mayday! Anybody! We’re under attack!'],
        ['jesse', 'Mr. White, we gotta help them!'],
        ['walt', 'Fine. But we were never here.'],
      ],
      rescued: [
        ['comms', 'Thank you, whoever you are!'],
        ['walt', 'Tell no one.'],
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
        ['jesse', 'Yo, Mr. White, the RV does lightspeed now?!'],
        ['walt', 'Apply yourself, Jesse. It’s just physics.'],
      ],
      overdrive: [
        ['jesse', 'This is insane, yo! Everything’s a blur!'],
        ['walt', 'Seatbelt, Jesse.'],
      ],
      meteors: [
        ['jesse', 'Yo, Mr. White, rocks! Big ones!'],
        ['walt', 'A meteor stream, Jesse. Shoot what you can’t steer round.'],
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
      leviathan: {
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
// 'shields', 'destroyed', 'escaped' or 'cleared' (where a crew has those),
// 'arrive' at a place, 'traffic' going
// past (by kind), a 'kill' (by kind, or any), 'hunted' (by who: the
// faction, or 'ace'), an 'event' (by the director's id) or a 'wonder' (by
// its id; an event's lines may be keyed by `sub`, what came: a leviathan's
// kind), 'interdicted' (hunters cut the pulse drive), 'crashInto' (by
// what: 'star', 'giant', 'citadel'; the plain crash lines otherwise), or
// something on 'foot' (by what: 'land', 'out', 'squad', 'kill' (`sub`: by
// kind, or any), 'hurt', 'down', 'up', 'cleared', 'swap' (`sub`: who's
// played now), 'far', 'nowhere' or 'in'). An exchange, or null.
export function linesFor(crew, event, id, sub) {
  if (!crew) return null;
  if (event === 'arrive') return crew.arrive[id] ?? null;
  if (event === 'traffic') return crew.traffic?.[id] ?? null;
  if (event === 'kill') return crew.kill?.[id] ?? crew.kill?.any ?? null;
  if (event === 'hunted') return crew.hunted?.[id] ?? null;
  if (event === 'crashInto') return crew.crashInto?.[id] ?? crew.crash ?? null;
  if (event === 'event') {
    const f = crew.events?.[id];
    if (!f) return null;
    return Array.isArray(f) ? f : (f[sub] ?? f.any ?? Object.values(f)[0] ?? null);
  }
  if (event === 'siege') return crew.siege?.[id] ?? null;
  if (event === 'wonder') return crew.wonders?.[id] ?? null;
  if (event === 'foot') {
    const f = crew.foot?.[id];
    if (!f) return null;
    return Array.isArray(f) ? f : (f[sub] ?? f.any ?? Object.values(f)[0] ?? null);
  }
  return crew[event] ?? null;
}
