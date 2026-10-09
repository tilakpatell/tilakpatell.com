// The Clone Wars' and the Remnant War's battles at their systems: the fleets
// and the fighters of the films and the shows (battles.js's TEMPLATES shape,
// by stance: the Republic's and the New Republic's `light`, the Separatists'
// and the Remnant's `dark`), made with battles.js's own `ship` and fighter
// lists so the two files don't import each other. Data, tested
// (battles.test.js).
//
// cloneTemplates({ ship, FIGHTERS }) → { [system]: template };
// remnantTemplates({ ship, FIGHTERS }) → the same.

export const cloneTemplates = ({ ship, FIGHTERS }) => ({
  // over the capital: the Invisible Hand with Palpatine aboard, and Anakin and Obi-Wan’s Delta-7s off the Guarlara
  coruscant: {
    name: "The Battle of Coruscant",
    light: {
      flagship: ship("venator", "Guarlara", 21.3),
      escorts: [
        ship("venator", "Resolute"),
        ship("venator"),
        ship("venator"),
        ship("acclamator"),
        ship("corvette"),
        ship("corvette"),
      ],
    },
    dark: {
      flagship: ship("providence", "Invisible Hand", 20.4),
      escorts: [
        ship("lucrehulk"),
        ship("munificent"),
        ship("munificent"),
        ship("munificent"),
        ship("providence"),
        ship("munificent"),
      ],
    },
    fighters: {
      light: [
        ...FIGHTERS.republic,
        { kind: "delta7", role: "interceptor", weight: 0.8 },
      ],
      dark: FIGHTERS.separatists,
    },
    ace: { light: { kind: "delta7", name: "Anakin Skywalker", hp: 16 } },
  },
  // Grievous’s raid on the cloning facility: Obi-Wan’s Delta-7 among the ARC-170s, holding the line over Tipoca City
  kamino: {
    name: "The Battle of Kamino",
    light: {
      flagship: ship("venator", "Resolute"),
      escorts: [
        ship("venator"),
        ship("acclamator"),
        ship("acclamator"),
        ship("corvette"),
      ],
    },
    dark: {
      flagship: ship("providence"),
      escorts: [
        ship("munificent"),
        ship("munificent"),
        ship("munificent"),
        ship("munificent"),
      ],
    },
    fighters: { light: FIGHTERS.republic, dark: FIGHTERS.separatists },
    ace: { light: { kind: "delta7", name: "Obi-Wan Kenobi", hp: 14 } },
  },
  // the Second Battle of Geonosis: the Republic punching through the droid blockade’s Lucrehulks, and the droid fighters swarming up off the rock
  geonosis: {
    name: "The Second Battle of Geonosis",
    light: {
      flagship: ship("venator"),
      escorts: [
        ship("venator"),
        ship("venator"),
        ship("acclamator"),
        ship("acclamator"),
        ship("corvette"),
      ],
    },
    dark: {
      flagship: ship("lucrehulk"),
      escorts: [
        ship("munificent"),
        ship("munificent"),
        ship("providence"),
        ship("munificent"),
        ship("munificent"),
      ],
    },
    fighters: {
      light: FIGHTERS.republic,
      dark: [
        ...FIGHTERS.separatists,
        { kind: "vulture", role: "fighter", weight: 1.5 },
      ],
    },
  },
  // Yoda’s war among the Wookiees: the clone navy over the wroshyr trees, and the droid army’s fleet holding the sky above it
  kashyyyk: {
    name: "The Battle of Kashyyyk",
    light: {
      flagship: ship("venator"),
      escorts: [
        ship("venator"),
        ship("acclamator"),
        ship("acclamator"),
        ship("corvette"),
        ship("corvette"),
      ],
    },
    dark: {
      flagship: ship("providence"),
      escorts: [
        ship("lucrehulk"),
        ship("munificent"),
        ship("munificent"),
        ship("munificent"),
      ],
    },
    fighters: { light: FIGHTERS.republic, dark: FIGHTERS.separatists },
  },
  // The Phantom Menace’s echo: Lucrehulks ringing Naboo again, and the Republic’s Venators this time instead of the N-1s
  naboo: {
    name: "The Battle of Naboo",
    light: {
      flagship: ship("venator"),
      escorts: [
        ship("venator"),
        ship("acclamator"),
        ship("corvette"),
        ship("corvette"),
        ship("corvette"),
      ],
    },
    dark: {
      flagship: ship("lucrehulk"),
      escorts: [
        ship("lucrehulk"),
        ship("munificent"),
        ship("munificent"),
        ship("munificent"),
        ship("providence"),
      ],
    },
    fighters: {
      light: FIGHTERS.republic,
      dark: [
        ...FIGHTERS.separatists,
        { kind: "vulture", role: "fighter", weight: 1 },
      ],
    },
  },
  // the Siege of Mandalore: Ahsoka and Rex’s 332nd dropping on Sundari to take Maul, and Maul’s droid fleet in the sky between
  mandalore: {
    name: "The Siege of Mandalore",
    light: {
      flagship: ship("venator"),
      escorts: [
        ship("venator"),
        ship("acclamator"),
        ship("acclamator"),
        ship("corvette"),
      ],
    },
    dark: {
      flagship: ship("providence"),
      escorts: [
        ship("munificent"),
        ship("munificent"),
        ship("munificent"),
        ship("munificent"),
        ship("providence"),
      ],
    },
    fighters: { light: FIGHTERS.republic, dark: FIGHTERS.separatists },
  },
  // the Separatist Council’s last hiding place: a droid picket over the lava, and the Republic come to pull it down
  mustafar: {
    name: "The Battle of Mustafar",
    light: {
      flagship: ship("venator"),
      escorts: [
        ship("venator"),
        ship("acclamator"),
        ship("corvette"),
        ship("corvette"),
      ],
    },
    dark: {
      flagship: ship("providence"),
      escorts: [
        ship("munificent"),
        ship("munificent"),
        ship("munificent"),
        ship("munificent"),
        ship("providence"),
      ],
    },
    fighters: { light: FIGHTERS.republic, dark: FIGHTERS.separatists },
  },
  // Hutt space, where the Republic courts Jabba: a light Republic task force jumped by the droids out of the Dune Sea’s skies
  tatooine: {
    name: "The Battle of Tatooine",
    light: {
      flagship: ship("venator"),
      escorts: [
        ship("acclamator"),
        ship("corvette"),
        ship("corvette"),
        ship("corvette"),
      ],
    },
    dark: {
      flagship: ship("providence"),
      escorts: [
        ship("munificent"),
        ship("munificent"),
        ship("munificent"),
        ship("munificent"),
      ],
    },
    fighters: { light: FIGHTERS.republic, dark: FIGHTERS.separatists },
  },
  // no battle of its own in the war: a Republic outpost on the ice, its transports running while the Venators hold off the droid fleet
  hoth: {
    name: "The Battle of Hoth",
    light: {
      flagship: ship("venator"),
      escorts: [
        ship("acclamator"),
        ship("corvette"),
        ship("corvette"),
        ship("acclamator"),
        ship("corvette"),
      ],
    },
    dark: {
      flagship: ship("providence"),
      escorts: [
        ship("munificent"),
        ship("munificent"),
        ship("munificent"),
        ship("lucrehulk"),
      ],
    },
    fighters: { light: FIGHTERS.republic, dark: FIGHTERS.separatists },
  },
  // no battle of its own in the war: the Republic getting its people off the jungle moon before the Separatist fleet closes in
  yavin: {
    name: "The Battle of Yavin",
    light: {
      flagship: ship("venator"),
      escorts: [
        ship("acclamator"),
        ship("corvette"),
        ship("corvette"),
        ship("corvette"),
        ship("corvette"),
      ],
    },
    dark: {
      flagship: ship("providence"),
      escorts: [
        ship("munificent"),
        ship("munificent"),
        ship("munificent"),
        ship("munificent"),
      ],
    },
    fighters: { light: FIGHTERS.republic, dark: FIGHTERS.separatists },
  },
  // no battle of its own in the war: an Outer Rim farm world, the clones lifting its colonists off ahead of the droids
  lothal: {
    name: "The Battle of Lothal",
    light: {
      flagship: ship("venator"),
      escorts: [
        ship("acclamator"),
        ship("corvette"),
        ship("corvette"),
        ship("acclamator"),
        ship("corvette"),
      ],
    },
    dark: {
      flagship: ship("providence"),
      escorts: [
        ship("munificent"),
        ship("munificent"),
        ship("munificent"),
        ship("munificent"),
      ],
    },
    fighters: { light: FIGHTERS.republic, dark: FIGHTERS.separatists },
  },
  // no battle of its own in the war: a Separatist siege line round the forest moon, and the Republic come to break it
  endor: {
    name: "The Battle of Endor",
    light: {
      flagship: ship("venator"),
      escorts: [
        ship("venator"),
        ship("venator"),
        ship("acclamator"),
        ship("acclamator"),
        ship("corvette"),
      ],
    },
    dark: {
      flagship: ship("providence"),
      escorts: [
        ship("lucrehulk"),
        ship("munificent"),
        ship("munificent"),
        ship("munificent"),
        ship("providence"),
      ],
    },
    fighters: { light: FIGHTERS.republic, dark: FIGHTERS.separatists },
  },
  // no battle of its own in the war: the droids laying siege to a quiet tropical world, long before there was ever a Shield Gate
  scarif: {
    name: "The Battle of Scarif",
    light: {
      flagship: ship("venator"),
      escorts: [
        ship("venator"),
        ship("acclamator"),
        ship("acclamator"),
        ship("corvette"),
        ship("corvette"),
      ],
    },
    dark: {
      flagship: ship("providence"),
      escorts: [
        ship("lucrehulk"),
        ship("munificent"),
        ship("munificent"),
        ship("munificent"),
      ],
    },
    fighters: { light: FIGHTERS.republic, dark: FIGHTERS.separatists },
  },
  // no battle of its own in the war: a droid flotilla pinning a Republic patrol in the Outer Rim’s backwaters
  nevarro: {
    name: "The Battle of Nevarro",
    light: {
      flagship: ship("venator"),
      escorts: [
        ship("acclamator"),
        ship("acclamator"),
        ship("corvette"),
        ship("corvette"),
      ],
    },
    dark: {
      flagship: ship("providence"),
      escorts: [
        ship("munificent"),
        ship("munificent"),
        ship("munificent"),
        ship("providence"),
      ],
    },
    fighters: { light: FIGHTERS.republic, dark: FIGHTERS.separatists },
  },
  // no battle of its own in the war: the Separatists choking off Cloud City’s tibanna, and the Republic come to run the blockade
  bespin: {
    name: "The Battle of Bespin",
    light: {
      flagship: ship("venator"),
      escorts: [
        ship("venator"),
        ship("acclamator"),
        ship("corvette"),
        ship("corvette"),
      ],
    },
    dark: {
      flagship: ship("lucrehulk"),
      escorts: [
        ship("munificent"),
        ship("munificent"),
        ship("providence"),
        ship("munificent"),
      ],
    },
    fighters: { light: FIGHTERS.republic, dark: FIGHTERS.separatists },
  },
  // no battle of its own in the war: a Separatist blockade of a backwater farm world, and the clones running supply through it
  sorgan: {
    name: "The Battle of Sorgan",
    light: {
      flagship: ship("venator"),
      escorts: [
        ship("acclamator"),
        ship("corvette"),
        ship("corvette"),
        ship("corvette"),
      ],
    },
    dark: {
      flagship: ship("lucrehulk"),
      escorts: [
        ship("munificent"),
        ship("munificent"),
        ship("munificent"),
        ship("munificent"),
      ],
    },
    fighters: { light: FIGHTERS.republic, dark: FIGHTERS.separatists },
  },
});

export const remnantTemplates = ({ ship, FIGHTERS }) => ({
  // the old capital, where the New Republic runs its Amnesty Programme, and a Remnant siege line of Star Destroyers come to take it back: the whole Mon Cal fleet out to break it
  coruscant: {
    name: "The Battle of Coruscant",
    light: {
      flagship: ship("moncal"),
      escorts: [
        ship("moncal"),
        ship("nebulon"),
        ship("nebulon"),
        ship("hammerhead"),
        ship("corvette"),
        ship("corvette"),
      ],
    },
    dark: {
      flagship: ship("destroyer"),
      escorts: [
        ship("destroyer"),
        ship("destroyer"),
        ship("lightcruiser"),
        ship("lightcruiser"),
        ship("gozanti"),
      ],
    },
    fighters: {
      light: [
        ...FIGHTERS.newrepublic,
        { kind: "xwing", role: "fighter", weight: 1 },
      ],
      dark: FIGHTERS.remnant,
    },
  },
  // the cloners’ empty halls, and the Remnant hunting what was left of their science for Gideon’s cloning work: a cordon of light cruisers round the ocean world
  kamino: {
    name: "The Battle of Kamino",
    light: {
      flagship: ship("moncal"),
      escorts: [
        ship("nebulon"),
        ship("corvette"),
        ship("corvette"),
        ship("hammerhead"),
      ],
    },
    dark: {
      flagship: ship("destroyer"),
      escorts: [
        ship("lightcruiser"),
        ship("lightcruiser"),
        ship("gozanti"),
        ship("gozanti"),
      ],
    },
    fighters: { light: FIGHTERS.newrepublic, dark: FIGHTERS.remnant },
  },
  // the sterilised world where the first Death Star was built, and a Remnant salvage fleet waiting in its rings for the New Republic patrol that comes looking
  geonosis: {
    name: "The Battle of Geonosis",
    light: {
      flagship: ship("moncal"),
      escorts: [
        ship("nebulon"),
        ship("hammerhead"),
        ship("corvette"),
        ship("corvette"),
      ],
    },
    dark: {
      flagship: ship("destroyer"),
      escorts: [
        ship("lightcruiser"),
        ship("gozanti"),
        ship("gozanti"),
        ship("gozanti"),
      ],
    },
    fighters: {
      light: FIGHTERS.newrepublic,
      dark: [
        ...FIGHTERS.remnant,
        { kind: "interceptor", role: "interceptor", weight: 1 },
      ],
    },
  },
  // the Wookiees’ world, freed of the Empire’s labour camps, and the Remnant trying to close it off again: a Star Destroyer’s cordon and the New Republic’s corvettes running it
  kashyyyk: {
    name: "The Battle of Kashyyyk",
    light: {
      flagship: ship("moncal"),
      escorts: [
        ship("nebulon"),
        ship("corvette"),
        ship("corvette"),
        ship("hammerhead"),
        ship("transport"),
      ],
    },
    dark: {
      flagship: ship("destroyer"),
      escorts: [
        ship("destroyer"),
        ship("lightcruiser"),
        ship("gozanti"),
        ship("gozanti"),
      ],
    },
    fighters: { light: FIGHTERS.newrepublic, dark: FIGHTERS.remnant },
  },
  // a Mid Rim world the Remnant tries to starve: Gozantis and a light cruiser across the shipping lanes, and New Republic CR90s running the blockade the way Padmé’s people once had to
  naboo: {
    name: "The Battle of Naboo",
    light: {
      flagship: ship("moncal"),
      escorts: [
        ship("corvette"),
        ship("corvette"),
        ship("corvette"),
        ship("nebulon"),
      ],
    },
    dark: {
      flagship: ship("destroyer"),
      escorts: [
        ship("lightcruiser"),
        ship("gozanti"),
        ship("gozanti"),
        ship("gozanti"),
      ],
    },
    fighters: { light: FIGHTERS.newrepublic, dark: FIGHTERS.remnant },
  },
  // the world the Empire glassed in the Great Purge, and the Mandalorians taking it back from Gideon’s hidden base: TIE interceptors and an Interdictor’s well holding the sky
  mandalore: {
    name: "The Battle of Mandalore",
    light: {
      flagship: ship("moncal"),
      escorts: [
        ship("nebulon"),
        ship("corvette"),
        ship("corvette"),
        ship("hammerhead"),
      ],
    },
    dark: {
      flagship: ship("destroyer"),
      escorts: [
        ship("interdictor"),
        ship("lightcruiser"),
        ship("lightcruiser"),
        ship("gozanti"),
      ],
    },
    fighters: {
      light: FIGHTERS.newrepublic,
      dark: [
        ...FIGHTERS.remnant,
        { kind: "interceptor", role: "interceptor", weight: 2 },
      ],
    },
  },
  // Vader’s old fortress world, where the Remnant keeps its secrets behind an Interdictor’s well and a pair of light cruisers
  mustafar: {
    name: "The Battle of Mustafar",
    light: {
      flagship: ship("moncal"),
      escorts: [
        ship("nebulon"),
        ship("hammerhead"),
        ship("corvette"),
        ship("corvette"),
      ],
    },
    dark: {
      flagship: ship("destroyer"),
      escorts: [
        ship("interdictor"),
        ship("lightcruiser"),
        ship("lightcruiser"),
        ship("gozanti"),
      ],
    },
    fighters: {
      light: [
        ...FIGHTERS.newrepublic,
        { kind: "ywing", role: "bomber", weight: 1 },
      ],
      dark: FIGHTERS.remnant,
    },
  },
  // the Dune Sea’s skies, where the Adelphi rangers run down what slips out of Mos Eisley: a few Remnant Gozantis and their TIEs caught by Teva’s X-wings
  tatooine: {
    name: "The Battle of Tatooine",
    light: {
      flagship: ship("moncal"),
      escorts: [
        ship("corvette"),
        ship("corvette"),
        ship("nebulon"),
        ship("hammerhead"),
      ],
    },
    dark: {
      flagship: ship("destroyer"),
      escorts: [
        ship("lightcruiser"),
        ship("gozanti"),
        ship("gozanti"),
        ship("gozanti"),
      ],
    },
    fighters: {
      light: [
        ...FIGHTERS.newrepublic,
        { kind: "xwing", role: "fighter", weight: 1 },
      ],
      dark: FIGHTERS.remnant,
    },
    ace: { light: { kind: "xwing", name: "Carson Teva", hp: 12 } },
  },
  // Echo Base’s old ice, and the New Republic getting its people out ahead of a Remnant Star Destroyer, the way the Rebellion once did
  hoth: {
    name: "The Battle of Hoth",
    light: {
      flagship: ship("moncal"),
      escorts: [
        ship("transport"),
        ship("transport"),
        ship("transport"),
        ship("corvette"),
        ship("nebulon"),
      ],
    },
    dark: {
      flagship: ship("destroyer"),
      escorts: [
        ship("destroyer"),
        ship("lightcruiser"),
        ship("gozanti"),
        ship("gozanti"),
      ],
    },
    fighters: { light: FIGHTERS.newrepublic, dark: FIGHTERS.remnant },
  },
  // the old Massassi base cleared out under the Remnant’s guns: CR90s and transports running while the X-wings hold the line
  yavin: {
    name: "The Battle of Yavin",
    light: {
      flagship: ship("moncal"),
      escorts: [
        ship("corvette"),
        ship("corvette"),
        ship("transport"),
        ship("transport"),
        ship("nebulon"),
      ],
    },
    dark: {
      flagship: ship("destroyer"),
      escorts: [
        ship("destroyer"),
        ship("lightcruiser"),
        ship("gozanti"),
        ship("gozanti"),
      ],
    },
    fighters: { light: FIGHTERS.newrepublic, dark: FIGHTERS.remnant },
  },
  // Hera’s homeworld and Ezra’s, and the Chimaera back from wherever the purrgil took it, with Thrawn on its bridge: the Ghost among the X-wings while Lothal’s people get out
  lothal: {
    name: "The Battle of Lothal",
    light: {
      flagship: ship("moncal"),
      escorts: [
        ship("transport"),
        ship("transport"),
        ship("corvette"),
        ship("corvette"),
        ship("nebulon"),
      ],
    },
    dark: {
      flagship: ship("destroyer", "Chimaera"),
      escorts: [
        ship("lightcruiser"),
        ship("gozanti"),
        ship("gozanti"),
        ship("gozanti"),
      ],
    },
    fighters: { light: FIGHTERS.newrepublic, dark: FIGHTERS.remnant },
    ace: { light: { kind: "ghost", name: "Hera Syndulla", hp: 20 } },
  },
  // where the Emperor fell, and the Remnant back to besiege the moon: its Star Destroyers in a line over the forest and the New Republic’s Mon Cals come to break it, as the Rebellion once did
  endor: {
    name: "The Battle of Endor",
    light: {
      flagship: ship("moncal"),
      escorts: [
        ship("moncal"),
        ship("nebulon"),
        ship("hammerhead"),
        ship("corvette"),
        ship("corvette"),
      ],
    },
    dark: {
      flagship: ship("destroyer"),
      escorts: [
        ship("destroyer"),
        ship("destroyer"),
        ship("lightcruiser"),
        ship("gozanti"),
        ship("gozanti"),
      ],
    },
    fighters: {
      light: [
        ...FIGHTERS.newrepublic,
        { kind: "bwing", role: "bomber", weight: 1 },
      ],
      dark: FIGHTERS.remnant,
    },
  },
  // the Citadel’s ruins, glassed by the Death Star, and a Remnant siege of the Shield Gate’s wreck: the New Republic’s Mon Cals come to break it
  scarif: {
    name: "The Battle of Scarif",
    light: {
      flagship: ship("moncal"),
      escorts: [
        ship("hammerhead"),
        ship("hammerhead"),
        ship("nebulon"),
        ship("corvette"),
        ship("corvette"),
      ],
    },
    dark: {
      flagship: ship("destroyer"),
      escorts: [
        ship("destroyer"),
        ship("lightcruiser"),
        ship("gozanti"),
        ship("gozanti"),
      ],
    },
    fighters: {
      light: [
        ...FIGHTERS.newrepublic,
        { kind: "uwing", role: "fighter", weight: 1 },
      ],
      dark: FIGHTERS.remnant,
    },
  },
  // Greef Karga’s port, where Moff Gideon flew his own TIE against the Mandalorian, and where Teva’s Adelphi rangers later came calling: the Remnant back behind an Interdictor’s well
  nevarro: {
    name: "The Battle of Nevarro",
    light: {
      flagship: ship("moncal"),
      escorts: [
        ship("nebulon"),
        ship("corvette"),
        ship("corvette"),
        ship("hammerhead"),
      ],
    },
    dark: {
      flagship: ship("destroyer"),
      escorts: [
        ship("interdictor"),
        ship("lightcruiser"),
        ship("gozanti"),
        ship("gozanti"),
      ],
    },
    fighters: { light: FIGHTERS.newrepublic, dark: FIGHTERS.remnant },
    ace: {
      light: { kind: "xwing", name: "Carson Teva", hp: 12 },
      dark: { kind: "tie", name: "Moff Gideon", hp: 14 },
    },
  },
  // Cloud City’s Tibanna, which the Remnant wants for its warlords’ fleets: a Star Destroyer, light cruisers and Gozantis over the gas giant while the New Republic runs the cordon
  bespin: {
    name: "The Battle of Bespin",
    light: {
      flagship: ship("moncal"),
      escorts: [
        ship("corvette"),
        ship("corvette"),
        ship("corvette"),
        ship("nebulon"),
        ship("hammerhead"),
      ],
    },
    dark: {
      flagship: ship("destroyer"),
      escorts: [
        ship("lightcruiser"),
        ship("lightcruiser"),
        ship("gozanti"),
        ship("gozanti"),
      ],
    },
    fighters: { light: FIGHTERS.newrepublic, dark: FIGHTERS.remnant },
  },
  // the Outer Rim backwater the Mandalorian once hid on, too small for a Star Destroyer: a Remnant Gozanti and its consorts holding the lanes, and a few New Republic ships to run them
  sorgan: {
    name: "The Battle of Sorgan",
    light: {
      flagship: ship("moncal"),
      escorts: [
        ship("corvette"),
        ship("corvette"),
        ship("nebulon"),
        ship("transport"),
      ],
    },
    dark: {
      flagship: ship("gozanti"),
      escorts: [
        ship("lightcruiser"),
        ship("gozanti"),
        ship("gozanti"),
        ship("gozanti"),
      ],
    },
    fighters: { light: FIGHTERS.newrepublic, dark: FIGHTERS.remnant },
  },
});
