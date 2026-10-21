# Middle-earth’s geography, as numbers (2026-10-18)

The Middle-earth page paints its own map from data (`src/components/middleearth/mapData.js`, `road.js`, `chapters.js`, `hidden.js`), and the owner says that map is not accurate to Tolkien. This note gathers the facts a builder needs to redraw it from data: a frame in miles, a table of places, the lines and areas as polylines, the Ring’s road with mileage and dates, what the current sheet gets wrong, and the scale facts behind it all. No map image was copied or measured; positions, distances and courses are facts from Tolkien’s text and letters and from secondary sources that quote them, and the picture drawn from them is ours.

Confidence marks used throughout: **S** a number a source states (Tolkien’s text or letters, or a source quoting them, including Karen Wynn Fonstad’s *Atlas of Middle-earth* as quoted by others); **D** derived here by triangulating stated distances and directions; **E** estimated here from stated relations only (“east of”, “between”, “at the foot of”), with no numeric source. Treat **D** as ±25 miles and **E** as ±50 miles unless said otherwise.

## Sources, in short

- Tolkien’s Letter 294 (8 February 1967, to Charlotte and Denis Plimmer; numbered 376 in the 2023 expanded *Letters*): Hobbiton and Rivendell “at about the latitude of Oxford”, Minas Tirith “600 miles south” of Hobbiton “at about the latitude of Florence”, the Mouths of Anduin and Pelargir “at about the latitude of ancient Troy”. Quoted at https://en.wikipedia.org/wiki/Minas_Tirith and discussed at https://beta.tolkiengateway.net/wiki/File:Didier_Willis_-_Middle-earth_and_Europe_projection.png (Oxford 51–52° N, Florence 43.7° N, Troy 39.9° N).
- Tolkien’s green-ink notes on Pauline Baynes’s copy of the 1954 map (found 2015, now in the Bodleian): “Hobbiton is assumed to be approx. at latitude of Oxford”; Minas Tirith “about the latitude of Ravenna” and “900 miles east of Hobbiton more near Belgrade”; the map’s bottom edge about Jerusalem’s latitude, 1,400–1,450 miles south of Hobbiton; Umbar about Cyprus’s latitude. https://www.exeter.ox.ac.uk/tolkien-annotated-map-of-middle-earth-acquired-by-bodleian-library , https://www.tolkiensociety.org/?p=4902 , https://mg.co.za/friday/2015-10-29-tolkien-s-precision-revealed-in-a-map/
- Tolkien’s working maps: the 1943 map, 4 cm to 100 miles (https://tolkiengateway.net/wiki/The_1943_Map_of_The_Lord_of_the_Rings); the “Third Map”, the basis of the published general map, on 2 cm squares of 100 miles (https://tolkiengateway.net/wiki/The_Third_Map_of_The_Lord_of_the_Rings , https://en.wikipedia.org/wiki/Tolkien%27s_maps).
- The Encyclopedia of Arda (EoA), which states many distances from the text; entry URLs are `https://www.encyclopedia-of-arda.com/<letter>/<name>.html` and are given inline below as `EoA <name>`.
- Fonstad’s road mileages, as reproduced by the Éowyn Challenge’s successors: legs Hobbiton–Mount Doom at https://renaissancedaze.blogspot.com/p/walking-to-mordor-challenge.html (“Éowyn legs”), the Rauros–Mount Doom milepost table at https://visibleprocrastinations.wordpress.com/2019/11/06/the-walk-to-rivendell-rauros-to-mt-doom-the-journey-of-frodo-and-sam/ (“Fonstad mileposts”), and the other journeys’ totals at https://mizkit.com/walk-to-rivendell/ .
- Dates: the Encyclopedia of Arda’s chronicle, https://www.encyclopedia-of-arda.com/chronicle.html?startyear=3018&startage=3 (Appendix B’s Tale of Years).
- Local relations and short straight-line distances: the fan map https://mapmiddleearth.com/places/<slug> (“MME”), which redraws Tolkien’s map and lists six “nearby places” with straight-line miles per place. Its short distances agree with the text (Rivendell–Ford 29, Last Bridge–Ford 89, Weathertop–Last Bridge 100) but its long ones run 10–40 % high against Tolkien and Fonstad (Hobbiton–Bree 161 straight against ~100; Minas Tirith–Mount Doom 258 against ~145), so it is used here only for order, side and short spacing, never for the frame.

Where a source could not be reached (Tolkien Gateway refuses automated fetches; the LotR Project map’s host fails its certificate) the fact is taken from a mirror or a quoting source, named beside the number.

## 1. The frame

Origin Hobbiton (Bag End’s hill) at **[0, 0]**; axis **east** in miles, axis **south** in miles, so a place is `[east, south]` and the sheet’s y grows downward like the screen’s. It is a flat frame (no projection): Tolkien’s own maps are flat grids of 100-mile squares and his latitude notes only loosely fit a globe, so nothing is gained by curving it.

Two of Tolkien’s own numbers pin the scale: Minas Tirith 600 miles south of Hobbiton (Letter 294) and “900 miles east” of it (Baynes notes). Those cannot both be components, because the road from Hobbiton to Rivendell is only ~385 miles and runs almost due east, and Rauros lies nearly due north of Minas Tirith (the Anduin falls south from Rauros past Cair Andros to Osgiliath): with Rivendell at ~372 east and Lórien at ~505 east, a river running south-south-east for 260 straight miles reaches Rauros at ~650 east, and Minas Tirith cannot be 250 miles east of Rauros. Read as a distance, “900 miles” fits exactly: **Minas Tirith = [675, 600]**, 895 miles from Hobbiton (D). Everything else is chained from these anchors and Tolkien’s stated distances in §2.

Extent to show the Grey Havens to the Sea of Rhûn’s west shore and Forodwaith’s edge (Carn Dûm, Gundabad) to Umbar: **east −420 … 1,180, south −350 … 980** (1,600 × 1,330 miles). Cropping at Near Harad’s edge instead of Umbar gives south −350 … 820 (1,600 × 1,170). For the site’s 800 × 560 sheet, 2 miles per sheet unit with origin at sheet (210, 165) covers east −420 … 1,180 and south −330 … 790, which keeps Umbar off the bottom edge; 2.4 miles per unit with origin at (175, 150) keeps Umbar (and the Baynes notes’ 1,400-mile bottom edge is far beyond either).

## 2. Places

`[E, S]` in miles from Hobbiton. “Basis” gives the stated facts the point rests on and where they come from.

| place | [E, S] | conf. | basis |
|---|---|---|---|
| Hobbiton | [0, 0] | S | origin; “a town in the centre of the Shire, near the eastern borders of the Westfarthing” (EoA hobbiton) |
| Bag End | [0, −1] | S | the Hill, north edge of Hobbiton |
| Bywater | [2, 2] | S | Tolkien’s late note: Bywater “much more nearly southward of Hobbiton”, 1¼ miles from Hobbiton’s junction; the published map puts it “somewhat too far east” (EoA bywater) |
| Michel Delving | [−45, 5] | D | on the White Downs west of Hobbiton on the Road (EoA micheldelving); the Shire is 120 miles Far Downs–Bridge (Prologue, via https://en.wikipedia.org/wiki/The_Shire) and Hobbiton sits ~50 miles west of the Bridge |
| Tower Hills (Elostirion) | [−95, 0] | E | beyond the Far Downs, on the road to the Havens |
| Brandywine Bridge | [55, −5] | D | Shire 120 miles wide Far Downs–Bridge; Bree “some 40 miles east of the Shire” (https://en.wikipedia.org/wiki/Bree_(Middle-earth)) |
| Bucklebury Ferry | [57, 15] | S | “twenty miles downriver from the Bridge” (EoA baranduin) |
| Brandy Hall / Buckland | [59, 14] | S | Buck Hill, east bank, north of Buckland (EoA brandyhall) |
| The Old Forest | [75, 20] (centre; 62–88 east, 5–40 south) | E | east of Buckland, between the High Hay and the Barrow-downs (EoA oldforest) |
| Tom Bombadil’s house | [88, 18] | E | eastern edge of the Old Forest, above the Withywindle, downs to the east (MME tom-bombadils-house) |
| Barrow-downs | [92, 15] (centre) | E | between the Old Forest and Bree, south of the Road (EoA barrowdowns) |
| Bree | [100, −8] | D | 40 miles east of the Shire; “roughly one hundred miles” south of Fornost (EoA fornost) |
| Forsaken Inn | [125, −8] | S | “a day’s journey east of Bree” (Strider, FotR I.11, via https://tolkiengateway.net/wiki/From_Weathertop_to_the_Ford) |
| Midgewater Marshes | [135, −25] | E | north of the Road between Bree and Weathertop (MME weathertop) |
| Weathertop (Amon Sûl) | [175, −30] | D | southern end of the Weather Hills, east of Bree (EoA weathertop); ~78 straight miles from Bree (MME); “about halfway” Bree–Rivendell in Strider’s words, which Strachey reads as halfway to the Last Bridge (https://tolkiengateway.net/wiki/Journeys_of_Frodo) |
| Last Bridge (Mitheithel) | [275, −22] | S | “about a hundred miles east of Weathertop” (EoA lastbridge) |
| The Trollshaws | [285–335, −40…−15] | S | woods “running some fifty miles from west to east” between Hoarwell and Loudwater, directly west of Rivendell (EoA trollshaws) |
| Ford of Bruinen | [350, −30] | D | at the entrance to Rivendell’s valley (EoA fordofbruinen); ~80–89 miles beyond the Last Bridge, ~22–29 short of Rivendell (https://www.docsity.com/en/docs/middle-earth-distances-table/9593042/ , MME) |
| Rivendell | [372, −38] | D | western foothills of the Misty Mountains (EoA rivendell); Oxford’s latitude with Hobbiton (Letter 294), so near south 0; road Hobbiton–Rivendell 458 miles (Éowyn legs) |
| High Pass | [400, −60] | S | “above Rivendell”, north-east of it (EoA highpass); ~39 miles (MME) |
| Hollin ridge | [398, 95] | S | “forty-five leagues as the crow flies” from Rivendell, i.e. 135 miles, reached 8 January (FotR II.3, via https://tolkiengateway.net/wiki/Hollin_ridge) |
| Hollin / Eregion | [360–430, 80–200] | S | “directly to the west of Khazad-dûm” (EoA hollin) |
| Caradhras / Redhorn Pass | [434, 118] | S | pass between Redhorn and Silvertine from Hollin into Dimrill Dale (EoA redhornpass); the southern pass lies “about a hundred miles southward of the High Pass” (EoA mistymountains) |
| West-gate of Moria (Doors of Durin, Sirannon) | [420, 128] | D | west face below the Redhorn, Sirannon flowing west (EoA doorsofdurin) |
| East-gate / Dimrill Dale | [458, 142] | S | Moria is “at least forty miles” West-door to East-gate in a direct line (FotR II.4, via https://tolkiengateway.net/wiki/Khazad-d%C3%BBm) |
| Mirrormere | [461, 147] | S | in Dimrill Dale, a short walk from the East-gate (EoA dimrilldale) |
| Nimrodel | [478, 162] | E | first stream of Lórien, a day’s march from the gate |
| Cerin Amroth | [492, 170] | E | between Nimrodel and the city |
| Caras Galadhon | [505, 178] | S | “near the meeting of the Rivers Anduin and Celebrant” (EoA carasgaladhon); East-gate to Lórien 80 road miles (Éowyn legs) |
| Lothlórien (wood) | [465–535, 150–205] | S | between Silverlode and Anduin, south-east of Khazad-dûm (EoA lothlorien); “some hundred and fifty miles southward of the Gladden Fields” (EoA anduin) |
| Dol Guldur | [580, 180] | S | southern tip of Mirkwood, “directly across the Anduin from Lothlórien” (MME dol-guldur; EoA dolguldur) |
| Gladden Fields | [518, 40] | S | 150 miles north of Lórien by the river; the Gladden “roughly halfway between the Carrock and Lórien” (EoA gladden) |
| Old Ford | [506, −80] | S | “almost exactly halfway between Gundabad and Khazad-dûm” (EoA oldforestroad) |
| The Carrock | [508, −95] | S | north of the Old Ford; “some hundred miles south of the confluence of Langwell and Greylin” (EoA anduin, carrock) |
| Beorn’s house | [530, −95] | S | “some miles to the east” of the Carrock (EoA carrock); ~25 (MME) |
| Rhosgobel | [565, 85] | S | western edge of Mirkwood, “about a hundred miles north from Dol Guldur” (EoA rhosgobel; other sources put it nearer the Carrock) |
| Mountains of Mirkwood | [640–700, −60…−30] | E | north of the Old Forest Road (MME old-forest-road) |
| Thranduil’s halls | [770, −165] | E | far north-east of Mirkwood on the Forest River, upstream of the Long Lake |
| Long Lake / Esgaroth | [840, −158] | S | Esgaroth on the west shore near the Forest River’s inflow (EoA esgaroth) |
| Dale | [855, −215] | S | between Erebor’s southern arms, upstream of the lake |
| Erebor | [860, −235] | D | “north-east of Mirkwood, at the source of the River Running” (EoA erebor); ~520 straight miles from Rivendell against MME’s 636 |
| Iron Hills | [950–1,080, −255] | S | east of Erebor, running east–west (EoA ironhills) |
| Mount Gundabad | [500, −300] | S | junction of Misty and Grey Mountains (EoA mountgundabad); equidistant with Khazad-dûm from the Old Ford (220 miles each here) |
| Carn Dûm | [380, −290] | S | far north of the Misty Mountains in Angmar (EoA carndum); ~115–125 miles west of Gundabad (MME) |
| Ettenmoors | [280, −130] | E | north of the Trollshaws, source of the Hoarwell |
| Fornost | [100, −108] | S | 100 miles north of Bree; Annúminas “about a hundred miles to the west” (EoA fornost) |
| Annúminas / Lake Evendim | [5, −115] / lake [−5, −140] | S | Annúminas on the lake’s southern shore; the Baranduin runs east ~50 miles from the lake then turns south (EoA baranduin) |
| Sarn Ford | [40, 85] | S | the Shire’s southernmost point, where the road from Waymeet crosses after “more than a hundred miles” (EoA sarnford); the river is “little more than halfway” along its course there |
| The Grey Havens | [−160, 5] | D | eastern end of the Gulf of Lune (EoA greyhavens); the Road runs west from Michel Delving past the Tower Hills; ~60–70 miles Towers–Havens |
| Tharbad | [150, 290] | S | North–South Road’s crossing of the Gwathló; Gwathló formed “about two hundred miles below the Ford” of Bruinen (EoA fordofbruinen) |
| Lond Daer | [20, 360] | S | mouth of the Gwathló (EoA londdaer); ~150 miles below Tharbad (MME) |
| Isengard / Orthanc | [335, 455] | S | southern end of the Misty Mountains, source of the Isen (EoA isengard); Methedras is 300 miles south of Moria (EoA mistymountains) |
| Methedras | [345, 440] | S | last peak of the range |
| Fangorn | [360–450, 380–520] | S | southern feet of the Misty Mountains, between them and the Entwash (EoA fangorn) |
| Gap of Rohan / Fords of Isen | [310, 525] / [315, 505] | S | plain “some fifty miles wide” between Methedras and the Thrihyrne (EoA mistymountains, whitemountains) |
| Helm’s Deep | [350, 560] | S | northern White Mountains, south-east of the Gap (EoA helmsdeep); ~80 miles west of Edoras (MME) |
| Edoras | [430, 578] | D | northern end of Harrowdale beneath the White Mountains (EoA edoras); Fonstad’s road from Edoras to Minas Tirith is ~300 miles (Isengard–Dunharrow–Edoras–Minas Tirith 578, mizkit) and the road along the range’s northern feet runs “nearly four hundred miles” (EoA whitemountains); a French fan wiki quotes 102 leagues, unverified (https://www.archivesdegondor.net/lieux/edoras.php) |
| Dunharrow / Dwimorberg / Paths of the Dead | [428, 605] / [420, 612] | S | up Harrowdale south of Edoras, under Starkhorn and Dwimorberg (EoA dunharrow); ~37 miles (MME) |
| Erech | [400, 680] | E | south side of the range, Morthond vale |
| Firien Wood / Halifirien | [560, 583] | E | on the Mering Stream, Rohan–Gondor border |
| Drúadan Forest / Amon Dîn | [640, 578] | E | the Road bends round it north of Mindolluin (EoA westroad) |
| Minas Tirith / Mindolluin | [675, 600] / [665, 600] | S | anchor: 600 miles south and ~900 miles from Hobbiton (Letter 294; Baynes notes) |
| Osgiliath | [690, 590] | S | “about fifteen miles northeast of Minas Tirith” (EoA osgiliath); the Rammas is four leagues from the Great Gate at the Causeway Forts (RotK V.1, via https://www.encyclopedia-of-arda.com/w/wallofthepelennor.html) |
| Cair Andros | [682, 540] | S | island “a little over ten miles in length” in Anduin above Osgiliath, between Anórien and North Ithilien (EoA cairandros) |
| Henneth Annûn | [730, 530] | D | North Ithilien, east of Cair Andros (EoA hennethannun); ~58 road miles from the Morannon viewpoint (Fonstad mileposts 166→224) |
| Ithilien | [700–760, 480–720] | S | between Anduin and the Ephel Dúath |
| Cross-roads | [745, 588] | S | 57 road miles south of Henneth Annûn, 3 before the Morgul bridge (Fonstad mileposts) |
| Minas Morgul | [752, 582] | S | Imlad Morgul, western slopes of the Ephel Dúath (EoA minasmorgul) |
| Cirith Ungol (pass) / Tower | [768, 572] / [772, 572] | S | the pass above Minas Morgul (EoA cirithungol); ~13 miles stairs to tower (Fonstad mileposts 284→304) |
| Mount Doom (Orodruin) | [815, 565] | S | Gorgoroth, northern Mordor (EoA mountdoom); “nearly forty miles” east of the Morgai (RotK VI.2, via https://v6.elanillounico.com/tolkienpedia/sin_clasificar/the-land-of-shadow/) |
| Barad-dûr | [850, 555] | S | “on an outcrop of Ered Lithui, in the northwest of Mordor”, Sauron’s Road running west to the mountain (EoA baraddur); ~35 miles (D) |
| Gorgoroth plain | [780–860, 510–620] | S | |
| Black Gate (Morannon) / Cirith Gorgor / Udûn | [760, 480] / [785, 495] | S | western end of the Ered Lithui, across Cirith Gorgor (EoA morannon, eredlithui); Minas Tirith–Morannon 138 road miles (mizkit) |
| Isenmouthe | [800, 515] | E | Udûn’s inner mouth |
| Dagorlad | [760, 440] | S | plain before the Morannon |
| The Dead Marshes | [700, 465] | S | between the Emyn Muil and Dagorlad, north-west of Mordor (EoA deadmarshes); Rauros→heart of the marshes 112 road miles, →Morannon 166 (Fonstad mileposts) |
| Emyn Muil | [625–720, 395–470] | S | hills either side of Anduin above Rauros, the eastern mass “some fifty miles” towards the marshes (EoA emynmuil, anduin) |
| Rauros / Nen Hithoel | [650, 420] / [650, 400] | S | outflow of Nen Hithoel above the Entwash mouths (EoA rauros) |
| Amon Hen / Amon Lhaw / Tol Brandir / Parth Galen | [643, 410] / [658, 410] / [651, 416] / [644, 412] | S | west shore, east shore, isle at the lake’s southern end (EoA amonhen, tolbrandir) |
| Argonath | [648, 375] | S | gates of the river above the lake (MME argonath) |
| Sea of Núrnen | [900, 690] (100 × 50) | S | “more than a hundred miles in length, some fifty miles across” in Nurn (EoA seaofnurnen) |
| Pelargir | [700, 700] | S | “more than a hundred miles” south of Minas Tirith (EoA southroadgondor); “about a hundred miles upriver from the Mouths” (EoA anduin) |
| Mouths of Anduin (Ethir) | [665, 745] | S | delta “some twenty miles long” (EoA anduin); Troy’s latitude (Letter 294) |
| Crossings of Poros | [735, 715] | S | Poros meets Anduin “some miles above the delta” (EoA poros) |
| Linhir | [600, 690] | E | Gilrain mouth, Lebennin |
| Dol Amroth / Edhellond | [500, 710] / [478, 695] | S | headland on Belfalas’s western coast (EoA dolamroth) |
| Belfalas bay | centre [450, 820] | S | between Andrast and Tolfalas (EoA andrast) |
| Andrast / Ras Morthil tip | [60, 665] | S | peninsula west of the Lefnui, north-west bound of the bay (EoA andrast) |
| Tolfalas | [660, 790] | E | island off the delta |
| Umbar | [730, 965] | S | cape and haven far south of Gondor (EoA umbar); Harad Road runs ~200 miles Poros→Harnen (EoA haradroad); Cyprus’s latitude (Baynes notes) |
| Sea of Rhûn (west shore) | [1,070, 110] | E | far east, south-east of Mirkwood, fed by the Celduin |
| Forodwaith’s edge | south ≈ −350 | E | north of Carn Dûm and the Grey Mountains |

## 3. Lines and areas

Polylines in the same frame, point to point; shapes are right in relation and rough in detail (all **E** unless a point above is **S**/**D**).

**Coast** (north to south): Forlindon [−350, −260] → [−380, −80] → Gulf of Lune mouth, north lip [−400, −30] → gulf’s north shore [−300, −10] → Grey Havens [−160, 5] → south shore [−300, 40] → south lip [−400, 60] → Harlindon [−330, 150] → [−250, 210] → Baranduin mouth [−105, 230] → Eryn Vorn [−125, 260] → [−60, 320] → Lond Daer [20, 360] → [60, 450] → [95, 540] → Isen mouth [120, 585] → Lefnui mouth [120, 640] → Andrast tip [60, 665] → [150, 680] → Anfalas [250, 690] → Edhellond [478, 695] → Dol Amroth [500, 712] → [540, 700] → Linhir [600, 690] → Ethir Anduin [665, 745] → [700, 790] → Harondor [730, 850] → Umbar [730, 965]. Tolfalas island at [660, 790].

**Misty Mountains** (Carn Dûm/Gundabad to Methedras; “more than a thousand miles” in a shallow arc, EoA mistymountains): Carn Dûm [380, −290] → [420, −250] → Mount Gram [340, −230] is a western branch; main spine Gundabad [500, −300] → [470, −220] → [430, −130] → High Pass [400, −60] → [405, 20] → Caradhras [434, 118] → [430, 200] → [410, 300] → [380, 380] → Methedras [345, 440].

**White Mountains** (Ered Nimrais): Mindolluin [665, 600] → Amon Dîn [650, 582] → Halifirien [560, 585] → Starkhorn [425, 615]; northern spur Starkhorn → Thrihyrne [345, 570] (Helm’s Deep at its foot); main spine Starkhorn → [330, 625] → [250, 635] → [160, 645] → Andrast [60, 665].

**Grey Mountains** (Ered Mithrin): Gundabad [500, −300] → [600, −315] → [700, −310] → [780, −305] → Withered Heath [820, −320]; a spur south-east to [830, −280] north of Erebor. **Lonely Mountain** a single peak at [860, −235], ~30 miles across. **Iron Hills** [950, −250] → [1,080, −260]. **Mountains of Mirkwood** [640, −60] → [700, −30].

**Mordor’s box**: Ered Lithui (“straight from west to east for four hundred miles”, EoA eredlithui) Morannon [760, 480] → [900, 485] → [1,050, 500] → [1,160, 510]; Ephel Dúath Morannon [760, 480] → [755, 540] → Cirith Ungol [768, 572] → [765, 640] → [775, 700] → turning east [850, 725] → [1,000, 715]. Udûn is the pocket inside the corner; Gorgoroth the north-west plain; Nurn the south-east lowland.

**Blue Mountains** (Ered Luin): north half [−420, −340] → [−380, −200] → [−340, −60] (to the Gulf of Lune); south half [−360, 60] → [−300, 150] → [−230, 230].

**Rivers**
- Anduin (“some 1,200 miles”, EoA anduin): springs [500, −280] → Langwell/Greylin meet [480, −200] → Carrock [508, −95] → Old Ford [506, −80] → Gladden Fields [518, 40] → Silverlode mouth [530, 190] → [575, 300] (Limlight mouth, Brown Lands east) → Sarn Gebir [640, 350] → Argonath [648, 375] → Nen Hithoel [650, 400] → Rauros [650, 420] → Entwash mouths/Nindalf [655, 480] → Cair Andros [682, 540] → Osgiliath [690, 590] → Harlond [683, 612] → Pelargir [700, 700] → Ethir [665, 745].
- Baranduin/Brandywine: Lake Evendim [−5, −140] → east [45, −130] → turning south [55, −80] → Bridge [55, −5] → Ferry [57, 15] → [50, 50] → Sarn Ford [40, 85] → south-west [−20, 150] → [−105, 230] (sea).
- Gwathló system: Hoarwell/Mitheithel Ettenmoors [280, −130] → Last Bridge [275, −22] → [262, 60] → meets Bruinen [255, 120] → [200, 220] → Tharbad [150, 290]; Loudwater/Bruinen source [395, −75] → Rivendell [372, −38] → Ford [350, −30] → [300, 40] → [255, 120]; Glanduin [390, 170] → Swanfleet [230, 280] → Tharbad; Gwathló Tharbad → Lond Daer [20, 360].
- Isen (“some three hundred miles”, EoA isen): Methedras [345, 440] → Isengard [335, 455] → Fords [315, 505] → [250, 540] → [180, 565] → sea [120, 585].
- Entwash: Fangorn [380, 470] → [420, 520] → [500, 530] → [600, 510] → Nindalf [655, 480]. Limlight: [445, 345] → [575, 305]. Silverlode/Celebrant: Dimrill Dale [458, 142] → Caras Galadhon’s north [500, 170] → [530, 190]. Nimrodel: [470, 150] → [478, 162] → Silverlode. Gladden: [445, 25] → [518, 40]. Morgulduin: Minas Morgul [752, 582] → Osgiliath [690, 590]. Poros: [770, 700] → [735, 715] → Anduin [700, 720].
- Celduin/Running: Erebor [860, −235] → Long Lake [840, −158] → [850, −80] → [900, 10] → Sea of Rhûn [1,070, 110]; Carnen joins at [900, 0] from the Iron Hills. Forest River: [640, −290] → Thranduil’s halls [770, −165] → Long Lake [835, −160].

**Forests**: Old Forest ellipse centre [75, 20], 13 × 18 miles; Trollshaws belt [285–335] × [−40…−15]; Eregion’s holly scattered [360–430] × [80–200]; Lothlórien [465–535] × [150–205]; Fangorn [360–450] × [380–520]; Mirkwood polygon [560, −200] → [650, −250] → [810, −200] → [800, −75] (Old Forest Road’s exit) → [760, 30] (East Bight) → [620, 150] → [580, 200] (Dol Guldur) → [560, 120] → [560, −95] (Forest Gate); Drúadan [625–655] × [570–590]; Ithilien’s woods [700–755] × [500–700]; Firien Wood [550–570] × [578–592].

**Lakes and seas**: Lake Evendim centre [−5, −140], 50 × 35; Mirrormere [461, 147], a few miles; Nen Hithoel [650, 400], 10 × 25; Long Lake [840, −158], 10 × 40; Sea of Núrnen [900, 690], 100 × 50; Sea of Rhûn west shore [1,070, 110], body stretching east and south.

**Roads**: East Road Grey Havens [−160, 5] → Tower Hills [−95, 0] → Michel Delving [−45, 5] → Hobbiton [0, 0] → Frogmorton [30, −2] → Bridge [55, −5] → Bree [100, −8] → Forsaken Inn [125, −8] → south of Weathertop [175, −15] → Last Bridge [275, −22] → Ford [350, −30] → Rivendell [372, −38] → High Pass [400, −60] → Old Ford [506, −80]; Old Forest Road Old Ford → Forest Gate [560, −95] → straight east → exit [800, −75] → Celduin (“more than two hundred miles beneath the canopy”, EoA oldforestroad). Greenway/North–South Road Fornost [100, −108] → Bree → Andrath [110, 60] → Tharbad [150, 290] → [240, 420] → Fords of Isen [315, 505]; Sarn Ford is on a branch from Waymeet. Great West Road Minas Tirith [675, 600] → round Amon Dîn [645, 572] → Halifirien [560, 578] → Edoras [430, 578] → Helm’s Deep gate [352, 558] → Fords of Isen [315, 505]. Harad Road Osgiliath → Cross-roads [745, 588] → [740, 650] → Poros [735, 715] → Harnen [745, 905] → Harad.

## 4. The Ring’s road

Road miles are Fonstad’s as reproduced by the Éowyn legs and mileposts (cumulative from Hobbiton); straight miles are between the points in §2 (D); dates are Shire Reckoning from the Tale of Years (EoA chronicle). The film trilogy follows this road; its visible departures are listed in §6.

| stop (site id) | arrive | road miles, cumulative | leg, road / straight | notes |
|---|---|---|---|---|
| Hobbiton | leaves 23 Sept 3018 | 0 | | Ferry 25–26 Sept, Bombadil 26, Barrow 28 (the films skip these) |
| Bree | 29 Sept | 135 | 135 / 100 | leaves 30 Sept |
| Weathertop | 6 Oct | 240 | 105 / 78 | Strider: twelve days to the Ford on his own feet, a fortnight for them |
| Rivendell | 20 Oct (Ford) | 458 | 218 / 197 | Last Bridge 13 Oct; Council 25 Oct; leaves 25 Dec |
| Moria (West-gate) | 13 Jan 3019 | 798 | 340 / 175 | Hollin ridge 8 Jan (232 miles), Caradhras 11–12 Jan, gate 108 more; Bridge 15 Jan; East-gate 840 |
| Lothlórien | 15 Jan borders, 17 Jan Caras Galadhon | 920 | 122 / 55 | leaves 16 Feb |
| Amon Hen | 25 Feb Argonath and Parth Galen, 26 Feb the breaking | 1,309 | 389 / 265 | by boat, nine to ten days |
| The Dead Marshes | 1–2 Mar | 1,421 (heart) | 112 / 75 | Gollum caught 29 Feb at the Emyn Muil’s foot |
| The Black Gate | 5 Mar | 1,475 | 54 / 62 | Desolation 4 Mar; Henneth Annûn 7–8 Mar (1,533); Cross-roads and Minas Morgul 10 Mar (1,590–1,593) |
| Cirith Ungol | 12–13 Mar stairs and Shelob, 14 Mar Sam in the Tower | 1,613 (tower) | 138 / 97 | escape 15 Mar |
| Mount Doom | 24 Mar foot, 25 Mar the Fire | 1,779 | 166 / 47 | via the Morgai and the Isenmouthe road, 18–19 Mar |

Sept 23 to Mar 25 is 183 days (Shire months are 30 days), ~10 miles a day (https://mapmiddleearth.com/distances). A progress bar true to the journey should move by road miles, not straight ones: the Rivendell stop sits at 26 %, Lórien at 52 %, Amon Hen at 74 %, the Black Gate at 83 %. A time bar is different again: 61 of the 183 days are spent in Rivendell and 30 in Lórien.

## 5. What is wrong today

Method: a best-fit affine from the 800 × 560 sheet to this frame through three anchors, Hobbiton (186, 196) → [0, 0], Minas Tirith (520, 444) → [675, 600] and Erebor (590, 62) → [860, −235]. It comes out as 2.10 miles per sheet unit across and 2.22 down with a small shear, so the sheet’s corners land at [−370, −462] and [1,250, 900]: the sheet already spans about the right extent (Forlindon to Rhûn, the far north to Umbar), which means the errors below are errors of relation, not of scale. Sheet points are then compared with §2 (script in the session’s scratchpad, `fit.mjs`).

Biggest first:

- **Mordor is ~250 miles too far east and ~40 % too large.** Mount Doom lands at [971, 568] (true [815, 565]), 296 miles from Minas Tirith instead of ~145; Barad-dûr at [1,083, 514], 390 miles from the city instead of ~180; the box drawn by the three `RANGES` is 390 × 330 miles against ~400 × 240, with its south wall at south ≈ 780 (true ≈ 720).
- **Minas Tirith and Osgiliath are on the wrong side of the Anduin.** The river path passes sheet x ≈ 476 at the city’s row while the city is at 520 and Osgiliath at 548, so both sit east of the river; the city is on the west bank and Osgiliath straddles it 15 miles north-east. The river then flows south-west into the bay at [478, 763], west of the city’s longitude, where the real Mouths are south-south-east of it at [665, 745].
- **Weathertop is two-thirds of the way from Bree to Rivendell; it should be a third.** Fitted Bree–Weathertop is 105 miles and Weathertop–Rivendell 163; the text gives ~80 and ~200 (one hundred to the Last Bridge alone). Hobbiton–Bree is also 159 against ~100.
- **Rivendell is east of the Misty Mountains’ line** (the range runs sheet x 372 → 396 and Rivendell is at 388, 6 units east of it at its row); it belongs in the western foothills, west of the ridge, with the High Pass north-east of it.
- **The Anduin’s upper course and Mirkwood are too far east, and Lórien is 100 miles from the river.** The river rises at [610, −280] (true ~[500, −280]); Mirkwood’s west edge at east ≈ 635 is ~100 miles east of the river (true 25–50); Dol Guldur at [694, 175] is 114 miles east of its true place, which is directly across the river from Lórien; Lórien itself (fitted [519, 229]) stands 100 miles west of the river it borders.
- **The Isen flows through the White Mountains.** Its path crosses the range line (sheet y 432, x 334–512) at x ≈ 350; the Isen runs west through the Gap and across Enedwaith to the sea at [120, 585], 300 miles long.
- **The western coast runs straight south ~200 miles too far west.** The sea path keeps x ≈ 60–118 all the way down; the coast swings east after Lindon to the Baranduin mouth [−105, 230], Lond Daer [20, 360] and Andrast [60, 665], and the Gulf of Lune is a gulf, not a straight shore.
- **Cirith Ungol is inside Mordor**, ~40 miles east of the Ephel Dúath line, with the last leg to Mount Doom 137 straight miles (true ~47); it belongs in the range’s western face above Minas Morgul, 15 miles east of the Cross-roads.
- **The Dead Marshes and the Black Gate are ~85 and ~35 miles too far north** and the marshes 73 miles too far east; the marshes lie between the Emyn Muil and Dagorlad, north-west of the Gate.
- **Edoras, Helm’s Deep and Isengard are 60–85 miles too far north**; Helm’s Deep floats 70 miles north of the White Mountains line instead of in its northern valleys, though the three are in the right order and relation to one another.
- **The Misty Mountains are a straight rule** from [404, −290] to [426, 338]; the range arcs, bending north-east to Gundabad and south-west to Methedras, and passes Rivendell’s west, not its east.
- **The Brandywine ends inland** at south ≈ 370 and does not start at Lake Evendim; the Grey Havens and the Shire are otherwise about right (Grey Havens fitted [−197, −5], true [−160, 5]).
- **Labels**: `MORDOR` at (680, 470) lands at [1,008, 679], south-east of the whole land; `RHOVANION`, `ROHAN`, `GONDOR`, `ERIADOR` and `THE SHIRE` are fine.
- **Road ratios** along `STOPS`, fitted / true straight: Hobbiton–Bree 159/100, Bree–Weathertop 105/78, Weathertop–Rivendell 163/197, Rivendell–Moria 181/175, Moria–Lórien 130/55, Lórien–Amon Hen 176/265, Amon Hen–Dead Marshes 159/75, Dead Marshes–Black Gate 107/62, Black Gate–Cirith Ungol 142/97, Cirith Ungol–Mount Doom 137/47. The order is right throughout.

## 6. Scale facts

- Tolkien’s latitude analogies, confirmed in two documents: Letter 294 (Oxford for Hobbiton and Rivendell, Florence for Minas Tirith “600 miles south”, Troy for Pelargir and the Mouths) and the 2015 Baynes-map notes (Oxford again; Ravenna and “900 miles east … more near Belgrade” for Minas Tirith; Jerusalem for the map’s bottom edge 1,400–1,450 miles south of Hobbiton; Cyprus for Umbar). Florence (43.7° N) and Ravenna (44.4° N) are 50 miles apart in latitude, so the two notes agree within Tolkien’s own tolerance. As a globe they do not close (Troy is twice as far south of Florence as the Mouths are of Minas Tirith), which is why this note uses a flat frame. Sources in “Sources, in short”.
- Tolkien drew on grids of 100-mile squares: 4 cm per square on the 1943 map, 2 cm on the Third Map that Christopher Tolkien’s published map follows (https://tolkiengateway.net/wiki/The_1943_Map_of_The_Lord_of_the_Rings , https://tolkiengateway.net/wiki/The_Third_Map_of_The_Lord_of_the_Rings). The published general map carries a scale bar in miles; Fonstad worked from its scale and notes that stated distances occasionally differed from the drawn ones, so she “altered the maps slightly to more closely agree with the text” (https://en.wikipedia.org/wiki/The_Atlas_of_Middle-earth). Where this note’s chain of stated distances and the map disagree, the text wins, as it did for her.
- The Shire: 40 leagues (120 miles) from the Far Downs to the Brandywine Bridge and 50 leagues (150 miles) from the northern moors to the southern marshes (Prologue, https://en.wikipedia.org/wiki/The_Shire); “A Part of the Shire” is drawn at a larger scale than the general map, which is why Shire places need their own spacing rather than a share of the general map’s pixels. Tolkien’s league is three miles (https://thetolkien.forum/goto/post?id=519475 quoting the appendix to *Unfinished Tales*).
- Distances Tolkien states in the narrative, used above: 45 leagues Rivendell–Hollin ridge as the crow flies; at least 40 miles through Moria; the Rammas one league from the Great Gate at its nearest, four at the Causeway Forts; Mount Doom “nearly forty miles” from the Morgai; Strider’s twelve days Weathertop–Ford; Théoden’s week from Edoras to Minas Tirith for the full muster (https://tolkiengateway.net/wiki/Muster_of_Edoras), ridden in five days by the host.
- Fonstad’s totals for the other journeys (mizkit, Éowyn legs): Rauros–Isengard 355 (Merry and Pippin) and 484 (the Three Hunters); Isengard–Minas Tirith 517 (Gandalf and Pippin), 578 via Dunharrow and Edoras (the Rohirrim), 786 via the Paths of the Dead and Pelargir (Aragorn); Minas Tirith–Morannon 138; Rivendell–Bag End 397 by the direct road home; Hobbiton–Grey Havens 467 as the last ride went. The Encyclopedia of Arda’s summary of the Anduin gives 340 river miles Lórien–Rauros against Fonstad’s 389; this note keeps Fonstad’s for the road table and the point spacing is unaffected.
- The films: Peter Jackson’s productions used Tolkien’s map, redrawn by Daniel Reeve, so the film map’s geography is the book’s (https://en.wikipedia.org/wiki/Tolkien%27s_maps ; https://tolkiengateway.net/wiki/Daniel_Reeve). The journeys differ from the map in a few places worth knowing for the Ring’s road: the hobbits go Hobbiton → Bucklebury Ferry → Bree with no Old Forest, Bombadil or Barrow-downs; Arwen, not Glorfindel, rides from near the Trollshaws to the Ford; Frodo and Sam are taken to Osgiliath in *The Two Towers*, which the book never does; in the extended *Return of the King*, Aragorn leaves the Paths of the Dead at the Anduin, where the book’s exit is a long ride from the river (https://www.theonering.net/torwp/2012/09/28/62350-j-w-brauns-bookshelf-september). None of these moves a place on the map; they only change which stops the site may show as “the films”.
- Two numeric checks the builder can keep as tests: Hobbiton–Minas Tirith straight ≈ 895 miles and Minas Tirith 600 south; Rivendell–Hollin ridge 135; Moria 40 across; Osgiliath 15 miles north-east of Minas Tirith; Minas Tirith more than 100 miles north of Pelargir; the Ered Lithui 400 miles long; Fornost 100 north of Bree and Annúminas 100 west of Fornost.
