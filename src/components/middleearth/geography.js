// Middle-earth as Tolkien gives it, in miles: every place, coast, range,
// river, forest and road the map draws, as points east and south of
// Hobbiton (Bag End’s hill). The frame is flat, as Tolkien’s own maps are
// grids of 100-mile squares. Every number comes from the research note
// docs/research/2026-10-18-middle-earth-map-geography.md (§1 the frame, §2
// the places, §3 the lines and areas, §4 the road), which says how each was
// reached; no map image was copied or measured. ./sheet.js projects it onto
// the 800 × 560 sheet.
//
// A row’s `source` names where its number comes from, in the note’s short
// forms: EoA <name> (the Encyclopedia of Arda’s entry), MME (mapmiddleearth’s
// nearby-places miles, used for side and short spacing only), Fonstad (the
// Atlas’s road miles, as the Éowyn legs and mileposts reproduce them),
// Letter 294 and the Baynes notes (Tolkien’s own latitudes and distances),
// FotR / RotK (the text). `confidence` is the note’s: S a number a source
// states, D derived by triangulating stated distances (±25 miles), E
// estimated from stated relations only (±50 miles).

// Note §1: Hobbiton at the origin, 2 miles to a sheet unit with Hobbiton at
// sheet (210, 165), so the sheet shows east −420 … 1,180 and south −330 …
// 790, the Grey Havens to the Sea of Rhûn and Carn Dûm to Harondor.
export const FRAME = { origin: 'hobbiton', milesPerUnit: 2, sheetOrigin: [210, 165], east: [-420, 1180], south: [-330, 790] };

const p = (id, name, kind, [east, south], confidence, source, more) => ({ id, name, kind, east, south, confidence, source, ...more });

// Note §2, a row each, in its order (north and west first along the road).
export const PLACES = [
  p('hobbiton', 'Hobbiton', 'town', [0, 0], 'S', 'origin; EoA hobbiton'),
  p('bag-end', 'Bag End', 'town', [0, -1], 'S', 'the Hill, north edge of Hobbiton'),
  p('bywater', 'Bywater', 'town', [2, 2], 'S', 'Tolkien’s late note, via EoA bywater'),
  p('michel-delving', 'Michel Delving', 'town', [-45, 5], 'D', 'EoA micheldelving; the Shire 120 miles wide (Prologue)'),
  p('tower-hills', 'The Tower Hills', 'hill', [-95, 0], 'E', 'beyond the Far Downs on the road to the Havens'),
  p('brandywine-bridge', 'Brandywine Bridge', 'ford', [55, -5], 'D', 'Shire 120 miles to the Bridge; Bree 40 miles east of it'),
  p('bucklebury', 'Bucklebury Ferry', 'ford', [57, 15], 'S', 'twenty miles downriver from the Bridge (EoA baranduin)'),
  p('brandy-hall', 'Brandy Hall', 'town', [59, 14], 'S', 'Buck Hill, east bank (EoA brandyhall)'),
  p('old-forest', 'The Old Forest', 'wood', [75, 20], 'E', 'east of Buckland (EoA oldforest)'),
  p('bombadil', 'Tom Bombadil’s house', 'town', [88, 18], 'E', 'eastern edge of the Old Forest (MME tom-bombadils-house)'),
  p('barrow-downs', 'The Barrow-downs', 'hill', [92, 15], 'E', 'between the Old Forest and Bree (EoA barrowdowns)'),
  p('bree', 'Bree', 'town', [100, -8], 'D', '40 miles east of the Shire; 100 south of Fornost (EoA fornost)'),
  p('forsaken-inn', 'The Forsaken Inn', 'town', [125, -8], 'S', 'a day’s journey east of Bree (FotR I.11)'),
  p('midgewater', 'The Midgewater Marshes', 'region', [135, -25], 'E', 'north of the Road, Bree to Weathertop (MME weathertop)'),
  p('weathertop', 'Weathertop', 'hill', [175, -30], 'D', 'EoA weathertop; ~78 straight miles from Bree (MME)'),
  p('last-bridge', 'The Last Bridge', 'ford', [275, -22], 'S', 'about a hundred miles east of Weathertop (EoA lastbridge)'),
  p('trollshaws', 'The Trollshaws', 'wood', [310, -28], 'S', 'fifty miles west to east, Hoarwell to Loudwater (EoA trollshaws)'),
  p('ford-of-bruinen', 'The Ford of Bruinen', 'ford', [350, -30], 'D', 'EoA fordofbruinen; 22–29 miles short of Rivendell (MME)'),
  p('rivendell', 'Rivendell', 'town', [372, -38], 'D', 'western foothills (EoA rivendell); Oxford’s latitude (Letter 294); road 458 (Fonstad)'),
  p('high-pass', 'The High Pass', 'pass', [400, -60], 'S', 'above Rivendell, north-east (EoA highpass)'),
  p('hollin-ridge', 'Hollin ridge', 'hill', [398, 95], 'S', 'forty-five leagues as the crow flies from Rivendell (FotR II.3)'),
  p('hollin', 'Hollin', 'region', [395, 140], 'S', 'directly west of Khazad-dûm (EoA hollin)'),
  p('redhorn', 'The Redhorn Pass', 'pass', [434, 118], 'S', 'a hundred miles south of the High Pass (EoA mistymountains, redhornpass)'),
  p('moria', 'The West-gate of Moria', 'gate', [420, 128], 'D', 'west face below the Redhorn (EoA doorsofdurin)'),
  p('east-gate', 'The East-gate', 'gate', [458, 142], 'S', 'at least forty miles from the West-door (FotR II.4)'),
  p('mirrormere', 'Mirrormere', 'lake', [461, 147], 'S', 'in Dimrill Dale by the East-gate (EoA dimrilldale)'),
  p('nimrodel', 'Nimrodel', 'ford', [478, 162], 'E', 'Lórien’s first stream, a day’s march from the gate'),
  p('cerin-amroth', 'Cerin Amroth', 'hill', [492, 170], 'E', 'between Nimrodel and the city'),
  p('caras-galadhon', 'Caras Galadhon', 'city', [505, 178], 'S', 'near the meeting of Anduin and Celebrant (EoA carasgaladhon)'),
  p('lorien', 'Lothlórien', 'wood', [500, 178], 'S', 'between Silverlode and Anduin (EoA lothlorien); its middle'),
  p('dol-guldur', 'Dol Guldur', 'fortress', [580, 180], 'S', 'directly across the Anduin from Lórien (EoA dolguldur, MME)'),
  p('gladden-fields', 'The Gladden Fields', 'region', [518, 40], 'S', '150 miles north of Lórien by the river (EoA gladden)'),
  p('old-ford', 'The Old Ford', 'ford', [506, -80], 'S', 'halfway between Gundabad and Khazad-dûm (EoA oldforestroad)'),
  p('carrock', 'The Carrock', 'hill', [508, -95], 'S', 'north of the Old Ford (EoA anduin, carrock)'),
  p('beorn', 'Beorn’s house', 'town', [530, -95], 'S', 'some miles east of the Carrock (EoA carrock)'),
  p('rhosgobel', 'Rhosgobel', 'town', [565, 85], 'S', 'a hundred miles north of Dol Guldur (EoA rhosgobel)'),
  p('mountains-of-mirkwood', 'The Mountains of Mirkwood', 'mountain', [670, -45], 'E', 'north of the Old Forest Road (MME old-forest-road)'),
  p('thranduil', 'Thranduil’s halls', 'fortress', [770, -165], 'E', 'on the Forest River, upstream of the Long Lake'),
  p('esgaroth', 'Esgaroth', 'town', [840, -158], 'S', 'west shore of the Long Lake (EoA esgaroth)'),
  p('dale', 'Dale', 'town', [855, -215], 'S', 'between Erebor’s southern arms'),
  p('erebor', 'Erebor', 'mountain', [860, -235], 'D', 'north-east of Mirkwood at the Running’s source (EoA erebor)'),
  p('iron-hills', 'The Iron Hills', 'mountain', [1015, -255], 'S', 'east of Erebor, running east–west (EoA ironhills)'),
  p('gundabad', 'Mount Gundabad', 'mountain', [500, -300], 'S', 'where the Misty and Grey Mountains meet (EoA mountgundabad)'),
  p('carn-dum', 'Carn Dûm', 'fortress', [380, -290], 'S', 'far north of the Misty Mountains (EoA carndum); 115–125 west of Gundabad (MME)'),
  p('ettenmoors', 'The Ettenmoors', 'region', [280, -130], 'E', 'north of the Trollshaws, source of the Hoarwell'),
  p('fornost', 'Fornost', 'ruin', [100, -108], 'S', '100 miles north of Bree (EoA fornost)'),
  p('annuminas', 'Annúminas', 'ruin', [5, -115], 'S', 'a hundred miles west of Fornost (EoA fornost)'),
  p('evendim', 'Lake Evendim', 'lake', [-5, -140], 'S', 'Annúminas on its southern shore (EoA baranduin)'),
  p('sarn-ford', 'Sarn Ford', 'ford', [40, 85], 'S', 'the Shire’s southernmost point (EoA sarnford)'),
  p('grey-havens', 'The Grey Havens', 'haven', [-160, 5], 'D', 'eastern end of the Gulf of Lune (EoA greyhavens)'),
  p('tharbad', 'Tharbad', 'ruin', [150, 290], 'S', 'the Gwathló formed 200 miles below the Ford (EoA fordofbruinen)'),
  p('lond-daer', 'Lond Daer', 'haven', [20, 360], 'S', 'mouth of the Gwathló (EoA londdaer); ~150 below Tharbad (MME)'),
  p('isengard', 'Isengard', 'fortress', [335, 455], 'S', 'southern end of the Misty Mountains (EoA isengard)'),
  p('methedras', 'Methedras', 'mountain', [345, 440], 'S', '300 miles south of Moria, the last peak (EoA mistymountains)'),
  p('fangorn', 'Fangorn', 'wood', [405, 450], 'S', 'southern feet of the Misty Mountains (EoA fangorn)'),
  p('gap-of-rohan', 'The Gap of Rohan', 'region', [310, 525], 'S', 'some fifty miles wide (EoA mistymountains, whitemountains)'),
  p('fords-of-isen', 'The Fords of Isen', 'ford', [315, 505], 'S', 'in the Gap (EoA mistymountains)'),
  p('helms-deep', 'Helm’s Deep', 'fortress', [350, 560], 'S', 'northern White Mountains (EoA helmsdeep); ~80 west of Edoras (MME)'),
  p('edoras', 'Edoras', 'town', [430, 578], 'D', 'Harrowdale’s northern end (EoA edoras); road to Minas Tirith ~300 (Fonstad)'),
  p('dunharrow', 'Dunharrow', 'fortress', [428, 605], 'S', 'up Harrowdale under the Starkhorn (EoA dunharrow)'),
  p('paths-of-the-dead', 'The Paths of the Dead', 'gate', [420, 612], 'S', 'under the Dwimorberg (EoA dunharrow)'),
  p('erech', 'Erech', 'hill', [400, 680], 'E', 'south side of the range, Morthond vale'),
  p('firien', 'The Firien Wood', 'wood', [560, 583], 'E', 'on the Mering Stream, Rohan and Gondor’s border'),
  p('druadan', 'The Drúadan Forest', 'wood', [640, 578], 'E', 'the Road bends round it (EoA westroad)'),
  p('mindolluin', 'Mindolluin', 'mountain', [665, 600], 'S', 'the city’s mountain'),
  p('minas-tirith', 'Minas Tirith', 'city', [675, 600], 'S', '600 miles south (Letter 294), ~900 off (the Baynes notes)'),
  p('osgiliath', 'Osgiliath', 'ruin', [690, 590], 'S', 'fifteen miles north-east of Minas Tirith (EoA osgiliath)'),
  p('cair-andros', 'Cair Andros', 'fortress', [682, 540], 'S', 'island in Anduin above Osgiliath (EoA cairandros)'),
  p('henneth-annun', 'Henneth Annûn', 'fortress', [730, 530], 'D', 'North Ithilien (EoA hennethannun); 58 road miles from the Morannon (Fonstad)'),
  p('ithilien', 'Ithilien', 'region', [728, 600], 'S', 'between Anduin and the Ephel Dúath'),
  p('cross-roads', 'The Cross-roads', 'town', [745, 588], 'S', '57 road miles south of Henneth Annûn (Fonstad)'),
  p('minas-morgul', 'Minas Morgul', 'fortress', [752, 582], 'S', 'Imlad Morgul, western slopes of the Ephel Dúath (EoA minasmorgul)'),
  p('cirith-ungol', 'Cirith Ungol', 'pass', [768, 572], 'S', 'the pass above Minas Morgul (EoA cirithungol)'),
  p('cirith-ungol-tower', 'The Tower of Cirith Ungol', 'fortress', [772, 572], 'S', '~13 miles stairs to tower (Fonstad)'),
  p('mount-doom', 'Mount Doom', 'mountain', [815, 565], 'S', 'nearly forty miles east of the Morgai (RotK VI.2; EoA mountdoom)'),
  p('barad-dur', 'Barad-dûr', 'fortress', [850, 555], 'S', 'an outcrop of the Ered Lithui in Mordor’s north-west (EoA baraddur)'),
  p('gorgoroth', 'Gorgoroth', 'region', [820, 565], 'S', 'Mordor’s north-west plain'),
  p('black-gate', 'The Black Gate', 'gate', [760, 480], 'S', 'western end of the Ered Lithui (EoA morannon); 138 road miles from the city'),
  p('udun', 'Udûn', 'region', [785, 495], 'S', 'behind the Morannon (EoA eredlithui)'),
  p('isenmouthe', 'The Isenmouthe', 'gate', [800, 515], 'E', 'Udûn’s inner mouth'),
  p('dagorlad', 'Dagorlad', 'region', [760, 440], 'S', 'the plain before the Morannon'),
  p('dead-marshes', 'The Dead Marshes', 'region', [700, 465], 'S', 'between the Emyn Muil and Dagorlad (EoA deadmarshes); 112 road miles from Rauros'),
  p('emyn-muil', 'The Emyn Muil', 'hill', [672, 432], 'S', 'hills either side of Anduin above Rauros (EoA emynmuil)'),
  p('rauros', 'Rauros', 'ford', [650, 420], 'S', 'outflow of Nen Hithoel (EoA rauros)'),
  p('nen-hithoel', 'Nen Hithoel', 'lake', [650, 400], 'S', 'EoA rauros'),
  p('amon-hen', 'Amon Hen', 'hill', [643, 410], 'S', 'the lake’s west shore (EoA amonhen)'),
  p('amon-lhaw', 'Amon Lhaw', 'hill', [658, 410], 'S', 'the lake’s east shore (EoA amonhen)'),
  p('tol-brandir', 'Tol Brandir', 'hill', [651, 416], 'S', 'isle at the lake’s southern end (EoA tolbrandir)'),
  p('parth-galen', 'Parth Galen', 'region', [644, 412], 'S', 'EoA amonhen'),
  p('argonath', 'The Argonath', 'gate', [648, 375], 'S', 'gates of the river above the lake (MME argonath)'),
  p('sea-of-nurnen', 'The Sea of Núrnen', 'sea', [900, 690], 'S', 'more than a hundred miles long, some fifty across (EoA seaofnurnen)'),
  p('pelargir', 'Pelargir', 'haven', [700, 700], 'S', 'more than a hundred miles south of the city (EoA southroadgondor, anduin)'),
  p('ethir-anduin', 'The Mouths of Anduin', 'region', [665, 745], 'S', 'a delta some twenty miles long (EoA anduin); Troy’s latitude (Letter 294)'),
  p('poros-crossings', 'The Crossings of Poros', 'ford', [735, 715], 'S', 'some miles above the delta (EoA poros)'),
  p('linhir', 'Linhir', 'town', [600, 690], 'E', 'Gilrain mouth, Lebennin'),
  p('dol-amroth', 'Dol Amroth', 'fortress', [500, 710], 'S', 'headland on Belfalas’s western coast (EoA dolamroth)'),
  p('edhellond', 'Edhellond', 'haven', [478, 695], 'S', 'EoA dolamroth'),
  p('andrast', 'Andrast', 'region', [60, 665], 'S', 'west of the Lefnui (EoA andrast)'),
  p('tolfalas', 'Tolfalas', 'region', [660, 790], 'E', 'island off the delta'),
  p('umbar', 'Umbar', 'haven', [730, 965], 'S', 'Cyprus’s latitude (the Baynes notes; EoA umbar)', { beyond: true }),
  p('sea-of-rhun', 'The Sea of Rhûn', 'sea', [1070, 110], 'E', 'south-east of Mirkwood, fed by the Celduin'),
];

const byId = new Map(PLACES.map((x) => [x.id, x]));
export function place(id) {
  const x = byId.get(id);
  if (!x) throw new Error(`no place called ${id} in Middle-earth’s geography`);
  return x;
}

// Note §3, point to point; the shapes are right in relation and rough in
// detail (E unless a point is a place above). `width` 'wide' is the Anduin.
export const LINES = [
  // north to south, Forlindon to the Ethir; the first point is where the
  // coast leaves the sheet’s top (Forlindon’s line run on north), the last
  // where it reaches its foot on the way to Umbar
  {
    id: 'coast',
    kind: 'coast',
    points: [
      [-345, -330], [-350, -260], [-380, -80], [-400, -30], [-300, -10], [-160, 5], [-300, 40], [-400, 60], [-330, 150], [-250, 210], [-105, 230], [-125, 260], [-60, 320], [20, 360], [60, 450], [95, 540], [120, 585], [120, 640], [60, 665], [150, 680], [250, 690], [478, 695], [500, 712], [540, 700], [600, 690], [665, 745], [700, 790],
    ],
  },
  // EoA mistymountains: “more than a thousand miles” in an arc, Gundabad to Methedras
  { id: 'misty-mountains', kind: 'range', points: [[500, -300], [470, -220], [430, -130], [400, -60], [405, 20], [434, 118], [430, 200], [410, 300], [380, 380], [345, 440]] },
  { id: 'mount-gram', kind: 'range', points: [[380, -290], [420, -250], [340, -230]] },
  // Ered Nimrais: Mindolluin to Andrast, and the spur north to the Thrihyrne over Helm’s Deep
  { id: 'white-mountains', kind: 'range', points: [[665, 600], [650, 582], [560, 585], [425, 615], [330, 625], [250, 635], [160, 645], [60, 665]] },
  { id: 'thrihyrne', kind: 'range', points: [[425, 615], [345, 570]] },
  { id: 'grey-mountains', kind: 'range', points: [[500, -300], [600, -315], [700, -310], [780, -305], [820, -320]] },
  { id: 'withered-heath', kind: 'range', points: [[780, -305], [830, -280]] },
  { id: 'iron-hills', kind: 'range', points: [[950, -250], [1080, -260]] },
  { id: 'mirkwood-hills', kind: 'range', points: [[640, -60], [700, -30]] },
  // EoA eredlithui: “straight from west to east for four hundred miles”
  { id: 'ered-lithui', kind: 'range', dark: true, points: [[760, 480], [900, 485], [1050, 500], [1160, 510]] },
  { id: 'ephel-duath', kind: 'range', dark: true, points: [[760, 480], [755, 540], [768, 572], [765, 640], [775, 700], [850, 725], [1000, 715]] },
  // the note starts the north half at [−420, −340], ten miles over the sheet’s top: it starts at the edge
  { id: 'blue-mountains-north', kind: 'range', points: [[-420, -330], [-380, -200], [-340, -60]] },
  { id: 'blue-mountains-south', kind: 'range', points: [[-360, 60], [-300, 150], [-230, 230]] },
  // EoA anduin: “some 1,200 miles”, the springs to the Ethir
  {
    id: 'anduin',
    kind: 'river',
    width: 'wide',
    points: [[500, -280], [480, -200], [508, -95], [506, -80], [518, 40], [530, 190], [575, 300], [640, 350], [648, 375], [650, 400], [650, 420], [655, 480], [682, 540], [690, 590], [683, 612], [700, 700], [665, 745]],
  },
  // EoA baranduin: from Lake Evendim east, then south past the Bridge, Ferry and Sarn Ford to the sea
  { id: 'brandywine', kind: 'river', width: 'wide', points: [[-5, -140], [45, -130], [55, -80], [55, -5], [57, 15], [50, 50], [40, 85], [-20, 150], [-105, 230]] },
  { id: 'hoarwell', kind: 'river', width: 'thin', points: [[280, -130], [275, -22], [262, 60], [255, 120], [200, 220], [150, 290]] },
  { id: 'bruinen', kind: 'river', width: 'thin', points: [[395, -75], [372, -38], [350, -30], [300, 40], [255, 120]] },
  { id: 'glanduin', kind: 'river', width: 'thin', points: [[390, 170], [230, 280], [150, 290]] },
  { id: 'gwathlo', kind: 'river', width: 'wide', points: [[150, 290], [20, 360]] },
  // EoA isen: “some three hundred miles”, through the Gap and across Enedwaith
  { id: 'isen', kind: 'river', width: 'thin', points: [[345, 440], [335, 455], [315, 505], [250, 540], [180, 565], [120, 585]] },
  { id: 'entwash', kind: 'river', width: 'thin', points: [[380, 470], [420, 520], [500, 530], [600, 510], [655, 480]] },
  { id: 'limlight', kind: 'river', width: 'thin', points: [[445, 345], [575, 305]] },
  { id: 'silverlode', kind: 'river', width: 'thin', points: [[458, 142], [500, 170], [530, 190]] },
  { id: 'gladden', kind: 'river', width: 'thin', points: [[445, 25], [518, 40]] },
  { id: 'morgulduin', kind: 'river', width: 'thin', points: [[752, 582], [690, 590]] },
  { id: 'poros', kind: 'river', width: 'thin', points: [[770, 700], [735, 715], [700, 720]] },
  { id: 'celduin', kind: 'river', width: 'thin', points: [[860, -235], [840, -158], [850, -80], [900, 10], [1070, 110]] },
  // from the Iron Hills (note §3: [950–1,080, −255]) to the Running at [900, 0]
  { id: 'carnen', kind: 'river', width: 'thin', points: [[1000, -245], [950, -120], [900, 0]] },
  { id: 'forest-river', kind: 'river', width: 'thin', points: [[640, -290], [770, -165], [835, -160]] },
  // the roads: the East Road, the Old Forest Road, the Greenway, the Great West Road, the Harad Road
  { id: 'east-road', kind: 'road', points: [[-160, 5], [-95, 0], [-45, 5], [0, 0], [30, -2], [55, -5], [100, -8], [125, -8], [175, -15], [275, -22], [350, -30], [372, -38], [400, -60], [506, -80]] },
  { id: 'old-forest-road', kind: 'road', points: [[506, -80], [560, -95], [800, -75], [850, -80]] },
  { id: 'greenway', kind: 'road', points: [[100, -108], [100, -8], [110, 60], [150, 290], [240, 420], [315, 505]] },
  { id: 'west-road', kind: 'road', points: [[675, 600], [645, 572], [560, 578], [430, 578], [352, 558], [315, 505]] },
  // on to the Harnen at [745, 905], cut where it leaves the sheet’s foot
  { id: 'harad-road', kind: 'road', points: [[690, 590], [745, 588], [740, 650], [735, 715], [739, 790]] },
];

// Note §3’s forests, lakes and marshes. A box the note gives as ranges is
// an ellipse inscribed in it, which reads as a wood rather than a plot.
const box = ([e0, e1], [s0, s1]) => ({ at: [(e0 + e1) / 2, (s0 + s1) / 2], rx: (e1 - e0) / 2, ry: (s1 - s0) / 2 });
export const AREAS = [
  { id: 'old-forest', kind: 'forest', ellipse: { at: [75, 20], rx: 13, ry: 18 } },
  { id: 'trollshaws', kind: 'forest', ellipse: box([285, 335], [-40, -15]) },
  { id: 'eregion', kind: 'forest', ellipse: box([360, 430], [80, 200]) },
  { id: 'lorien', kind: 'forest', tint: 'gold', ellipse: box([465, 535], [150, 205]) },
  { id: 'fangorn', kind: 'forest', ellipse: box([360, 450], [380, 520]) },
  {
    id: 'mirkwood',
    kind: 'forest',
    tint: 'dark',
    points: [[560, -200], [650, -250], [810, -200], [800, -75], [760, 30], [620, 150], [580, 200], [560, 120], [560, -95]],
  },
  { id: 'druadan', kind: 'forest', ellipse: box([625, 655], [570, 590]) },
  { id: 'ithilien', kind: 'forest', ellipse: box([700, 755], [500, 700]) },
  { id: 'firien', kind: 'forest', ellipse: box([550, 570], [578, 592]) },
  { id: 'evendim', kind: 'lake', ellipse: { at: [-5, -140], rx: 25, ry: 17.5 } },
  { id: 'mirrormere', kind: 'lake', ellipse: { at: [461, 147], rx: 3, ry: 2 } },
  { id: 'nen-hithoel', kind: 'lake', ellipse: { at: [650, 400], rx: 5, ry: 12.5 } },
  { id: 'long-lake', kind: 'lake', ellipse: { at: [840, -158], rx: 5, ry: 20 } },
  { id: 'sea-of-nurnen', kind: 'lake', ellipse: { at: [900, 690], rx: 50, ry: 25 } },
  // the Sea of Rhûn: its west shore at [1,070, 110], the body running on east off the sheet
  { id: 'sea-of-rhun', kind: 'sea', points: [[1180, 20], [1100, 35], [1070, 110], [1095, 190], [1180, 225]] },
  // between the Emyn Muil and Dagorlad, north-west of the Morannon (EoA deadmarshes)
  { id: 'dead-marshes', kind: 'marsh', ellipse: { at: [705, 458], rx: 25, ry: 14 } },
  // the Entwash’s mouths (note §3, Anduin at [655, 480])
  { id: 'nindalf', kind: 'marsh', ellipse: { at: [652, 488], rx: 12, ry: 16 } },
  { id: 'midgewater', kind: 'marsh', ellipse: { at: [135, -25], rx: 15, ry: 8 } },
];

// The lands’ names, where each sits (E: the middle of the land the sources
// bound, nudged off the road’s own names).
export const LABELS = [
  { name: 'LINDON', east: -330, south: -120 },
  { name: 'ERIADOR', east: 180, south: -160 },
  { name: 'THE SHIRE', east: -30, south: 50 },
  { name: 'ENEDWAITH', east: 180, south: 430 },
  { name: 'RHOVANION', east: 760, south: -20 },
  { name: 'ROHAN', east: 470, south: 500 },
  { name: 'GONDOR', east: 520, south: 680 },
  { name: 'MORDOR', east: 980, south: 620 },
  { name: 'RHÛN', east: 1100, south: 0 },
  { name: 'HARAD', east: 880, south: 760 },
];

// Note §4: Fonstad’s cumulative road miles from Hobbiton, a stop each.
export const ROAD_MILES = {
  hobbiton: 0,
  bree: 135,
  weathertop: 240,
  rivendell: 458,
  moria: 798,
  lorien: 920,
  'amon-hen': 1309,
  'dead-marshes': 1421,
  'black-gate': 1475,
  'cirith-ungol': 1613,
  'mount-doom': 1779,
};

// Note §4: the Tale of Years (Shire Reckoning), when the Ring reached each stop.
export const DATES = {
  hobbiton: '23 September 3018',
  bree: '29 September 3018',
  weathertop: '6 October 3018',
  rivendell: '20 October 3018',
  moria: '13 January 3019',
  lorien: '17 January 3019',
  'amon-hen': '26 February 3019',
  'dead-marshes': '2 March 3019',
  'black-gate': '5 March 3019',
  'cirith-ungol': '13 March 3019',
  'mount-doom': '25 March 3019',
};
