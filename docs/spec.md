# Candlemarch — Design Spec v0.1

Last updated: 2026-09-29

A medieval-fantasy village builder where the fun is designing a settlement that runs itself. This is a living spec: it will change after every design round.

Tags used throughout:

- **Decided** — stated by the designer in the design rounds.
- **Proposed** — recommendation where the designer was unsure. Working default; may change.
- **v1 / v1.x / v2+** — which release a feature belongs to.

Title: Candlemarch. A march is a medieval borderland; candles are what keep the dark at bay.

## Vision

**Pitch:** Found a village in a wild fantasy valley. Gather what the land gives, invite master craftspeople to settle, and chain their trades into a self-running economy. Then keep it alive through winters, nights and whatever crawls out of the forest.

**Design pillars**

1. **The village runs itself.** Automation comes from good design: layout, roads, stock rules and supply chains. The player graduates from doing to directing. *(Decided: focus on automation.)*
2. **Every trade is earned.** A blacksmith or carpenter is a milestone, not a job slot. Masters arrive by invitation and have personalities. *(Decided)*
3. **The land pushes back.** Resources deplete and regrow, seasons change what works, nights are dangerous. *(Decided)*
4. **Cozy, with teeth.** Warm and charming, but villagers can starve, freeze or be killed, and the village can die. *(Decided)*

**Tone and references:** Graveyard Keeper's gloomy-cozy humour with a lighter dose of Don't Starve pressure. Mechanically: Factorio (production chains, automation), The Settlers (carriers and roads), Anno (needs tiers), Banished (survival and seasons), RimWorld-lite (named villagers).

## Core loops

The game runs on three nested loops, each feeding the next.

```mermaid
flowchart LR
  A[Gather raw<br/>resources] --> B[Refine in<br/>workshops]
  B --> C[Meet needs &<br/>stock up]
  C --> D[Build milestone<br/>building]
  D --> E[Village grows,<br/>new trade invited]
  E --> A
```

- **Minutes (moment to moment):** place buildings and roads, spot bottlenecks (idle workshops, overloaded carriers), fix them. Early on the hero gathers and hauls by hand.
- **A day and a season:** days bring work, nights bring monsters. Each season changes what produces and what is consumed; autumn is about stockpiling and preserving food for winter.
- **Hours (long term):** meet the conditions to invite the next master, pour resources and coin into a milestone building, rank the village up and unlock the next needs tier.

## World and map

Each game is a procedurally generated valley seeded with handcrafted points of interest. *(Decided: mix of procedural and handcrafted.)*

- **View:** isometric, square tile grid. *(Decided)*
- **Size** *(Decided at the M4 gate, [ADR-0004](adr/0004-valley-size-and-budget.md))*: the Valley is 128 × 128 tiles. It's a content number, so the playtest can move it. Hand-made maps stay for tests and debugging.
- **Terrain gates expansion** *(Decided)*: a Swamp needs Draining, a snowed-in Pass needs a Pass road.
- **Resources deplete and regrow.** Forests and game recover slowly; ore and stone do not. *(Decided)*
- **Rotating buildings:** a building is placed in one of four orientations: the layout it is designed with, then quarter turns clockwise (a south door faces west, north, then east). A turn swaps its width and height, and every placement rule (a fisher's hut's door on the riverbank, say) is checked on the turned layout, so a fisher's hut fits either bank of a river. `Q` and `E` turn the placement preview. *(Proposed)*

**Terrain** *(Decided in design session M4-03; numbers Proposed)*. Forest isn't a Terrain: it's tiles with standing trees, and a tile stops being Forest when its tree is felled. Trees and Forage patches stand on Meadow.

**Trees are walked through** *(Decided after the M4 playtest; speed Proposed)*: villagers, the Hero and Gloamlings cross a tree's tile at 50% speed, so a wood is a slow way through, not a wall. Nothing can be built, paved or piled on a tree. Forage patches and Deposits still block walking.

| Terrain | Walk | Build | Walking speed | Notes |
| --- | --- | --- | --- | --- |
| Meadow | yes | yes | 100% | Replaces "grass" |
| Rock | yes | only a quarry (M5) | 80% | At the foot of the Mountains; stone Deposits sit on it |
| Mountain | no | no | — | The Valley's rim; iron Deposits sit on its faces |
| Swamp | yes | not until Drained | 50% | Beside the river's slow bends |
| River | no | no | — | Freezes in winter but stays impassable |
| Ford | yes | no | 50% | A shallow stretch of River; Gloamlings wade it too |
| Pass snow | the Hero only, at 30% | no | — | Until a Pass road is built |

- **Drain:** laid over Swamp tiles the way a Road is laid, one construction site per tile (2 logs, 200 build ticks). When finished, the tile becomes Meadow for good.
- **Pass road:** laid through the Pass the way a Road is laid (6 logs, 600 build ticks per tile). A finished tile is open to everyone all year. Dirt paths can't be laid on Pass snow. Before the road, the Hero alone wades the snow, so the player can scout the Side valley, clear its Den and Search its POIs before paying for the road. The road is also what lets the Side valley's Gloamlings through.
- **Crossing the river:** Fords only, until **bridges** arrive as an upgrade in M6, next to cobblestone roads.

**The Valley** *(Decided in design session M4-03; numbers Proposed, for 128²)*

- **Shape:** a Mountain rim all around. One river crosses the Valley from edge to edge, off-centre, with 2–3 Fords. One entry, a gap in the rim on an edge, holds the entry tile where Newcomers arrive; it isn't a Pass. Forest grows in noise-shaped patches, Swamp lies beside the river's slow bends, and Rock outcrops sit at the foot of the Mountains.
- **Side valley:** a pocket behind the Pass through the rim. It holds both iron Deposits, the Abandoned mine and at least one Den, so the Pass road is what opens M5's metal chain.
- **The Camp** (the Starting Camp: Granary, Stockpile, settlers and Hero) starts within 10 tiles of the entry. The generator guarantees near it:
    - 24 × 24 tiles of buildable Meadow at the Camp, with no Swamp;
    - at least 150 trees within 15 tiles, forming at least one Hunting ground;
    - at least 6 Forage patches within 20 tiles;
    - a Riverbank within 20 tiles and a Ford within 30;
    - a stone Deposit and a clay Deposit within 30 tiles;
    - no Den within 40 tiles.
- **Per Valley:** 3 Dens at the start (each at least 40 tiles from the Camp, at least one in the Side valley), 2 Ruins, 1 Shrine (on the way from the entry toward the Pass), 1 Abandoned mine (Side valley), 5 stone, 4 clay and 2 iron Deposits, 2–4 Swamp patches.
- **Same seed, same Valley.** The generator uses only the seeded PRNG. If a guarantee fails, it retries with a seed derived from the first. The player doesn't choose where the Camp starts in v1 (see the backlog).

**Deposits** *(Decided in design session M4-03; amounts come with M5's quarry, clay pit and mine)*: map objects holding a fixed amount of stone (on Rock), clay (on a Riverbank) or iron ore (on a Mountain face). The M4 generator places them; M5 works them. What is dug out never comes back. What happens when they run out is an open question.

**Points of interest** *(Decided in design session M4-03; numbers Proposed)*: handcrafted stamps the generator places. What a POI holds is unknown until it's Searched.

- **Ruins:** the Hero **Searches** them by standing on the tile for 200 ticks by day. A searched Ruins leaves a Cache (M4: 15 firewood and 6 hides, each ±30% from the PRNG; M5 adds iron bars, tools and coin to the table) and can't be Searched again. Hook: Ruins can hold a trapped master (M6 rescue invitations).
- **Abandoned mine:** on a Mountain face in the Side valley, over an iron Deposit, with a Den at its mouth. In M5 a mine placed on it costs less.
- **Shrine:** no Den buds within 12 tiles of it. Hook for the Pious trait (M6). It gives no Light, since ADR-0003 keeps Light expensive.
- **Den:** M3's Den, placed by the generator.

**Fog** *(Decided in design session M4-03, [ADR-0005](adr/0005-fog-lives-in-the-sim.md); numbers Proposed)*

- A tile is unrevealed (black), **Revealed** (seen at least once: ground, trees and buildings drawn as last seen, dimmed, and nothing that moves), or **In sight** (live).
- Fog changes what the player knows and where they may build, never what the world does: Gloamlings, Dens and villagers act as if it weren't there.
    - Buildings, Roads, Drains, Pass roads and Reserves go only on Revealed tiles.
    - Dens and POIs show once their tile is Revealed, including Dens that bud in the dark. Gloamlings show only In sight.
    - The Hero can be ordered into Fog.
- **Sight** (Chebyshev tiles, day / night): Hero 8 / 4 (the Ranger's "sees further at night" hooks in here in M7); villager 4 / 2; finished building 3 / 1; watchtower with its Watchman 8 / 8; Light: its lit tiles at night.
- At the start, everything within 12 tiles of the Camp is Revealed, plus the entry.
- **Fog setting:** per game, in state, like the Monster rate. It's chosen at New game (dev panel for now) and changed mid-game by a dev command. Off means every tile is Revealed and In sight. Switching it back on keeps what's already Revealed. It defaults to on for generated Valleys and off for hand-made maps. M7 moves it into the sandbox settings.

**Forest ecology** *(Decided: logging and foraging compete; mechanics Decided in design session M4-03, numbers Proposed)*

- **Reserve:** the player paints Forest tiles as a Reserve, and woodcutters never fell there. Foragers, hunters and foresters still work in it. It's painted and erased like a Dirt path, free and instant. It doesn't block building (the tree still has to go first). The woodcutter's hut placement preview shows Reserve tiles in its radius. This is how "a forest tile is either logged or foraged, never both" works: foraging never harms trees, so foragers need no rule.
- **Forester's lodge:** plants Saplings on empty Meadow in its radius. A Sapling matures into a tree in about a year.
- **Stumps:** a felled tree leaves a Stump, which sprouts a Sapling after a year. A clear-cut therefore heals on the same ground in about two years, with no creep onto new land. A building or Road on the tile removes the Stump. The forester is the fast way to grow Forest, and the only way to grow it somewhere new.
- A **Sapling** can't be felled and doesn't block walking. It counts as a standing tree (shade for Forage patches, a Hunting ground's ceiling, Forest) only once it matures.
- **Hunting grounds:** each is a connected stretch of Forest of at most 250 tiles. The generator splits bigger stretches and names each ground from a list. Max Game is 1 per 10 trees at the start.
- **Recovery:** while 0 < Game < ceiling, a ground gains 1 animal every 2 days. A ground hunted to 0 stays empty for 2 full seasons, then 2 animals return. Maturing Saplings raise the ceiling again.
- Result: the player sets aside forest reserves for food instead of clear-cutting.

**Before full ecology (M2)** *(Decided in design session M2-01; numbers Proposed)*. M4 adds regrowth and recovery on top of these rules.

- **Hunting grounds:** a Hunting ground is a region of forest (hand-drawn on M2 maps, generated in M4) holding a single **Game** count, e.g. 20. Its ceiling follows the forest: `max game × standing trees ÷ trees at the start`. Felling trees lowers the ceiling, and animals above it **flee** at once.
- **Hunt chance** = 50% × game ÷ max game, rolled with the seeded PRNG. A catch gives 4 meat and 1 hide and removes one animal; a miss comes back empty. Overhunting shows as more and more empty trips. Nothing recovers until M4, when game regrows toward the ceiling and foresters raise it.
- **Visible:** each ground is outlined with a health word and colour (Thriving / Thinning / Scarce / Empty). Selecting it or a hunter's lodge shows "Game 12 / 20 · 2 fled due to logging · catch chance 30%". A "fled" puff shows when felling drives game out, a "no catch" icon over a hunter back empty-handed, and the woodcutter's hut placement preview warns when its radius overlaps a Hunting ground.
- **Forage patches:** berry bushes and mushroom patches are their own map objects in the forest. Trees don't give food. A patch's stock refills at the start of its seasons (bushes: small in spring, large in summer; mushrooms: autumn; nothing in winter), but only while a standing tree is within 2 tiles (shade). A patch without shade withers: drawn bare, with a "no shade" hint when selected. The forager gathers from the nearest patch in radius with stock left.
- **Fish** don't deplete; fishing stops while the river is frozen.

## Time, day/night and seasons

One in-game year lasts about 60 minutes at 1× speed. *(Decided: roughly an hour; the split below is Proposed and tunable.)*

- **Controls:** real-time with pause and 1× / 2× / 3× speed. *(Decided)*
- **Day/night:** visible cycle, villagers go home and sleep at night. *(Decided)* Proposed length: 3 minutes per day (2 day, 1 night), 5 days per season.
- **Night length is set per season** in content, and winter nights are longer (Proposed: 1.5 of the 3 minutes). *(Decided)* The day stays 3 minutes; longer nights mean less work time and more cold nights.
- A new game starts at **Dawn on spring day 1**.
- **Night** is when monsters spawn. *(Decided)*

| Season | Production | Consumption | Threat |
| --- | --- | --- | --- |
| Spring | Sowing; forest regrows fastest | Normal | Low |
| Summer | Harvest begins; berries peak | Normal | Bandits more active |
| Autumn | Main harvest; mushrooms peak | Stockpiling, preserving | Rising |
| Winter | Fields idle, river freezes (mill stops, no fishing), no foraging; hunting goes on | Every house burns firewood; food spoils slower in the cold | Highest; longer nights |

*(Table is Proposed.)* Winter is the yearly exam: without enough preserved food and firewood, villagers freeze or starve.

## Resources and production chains (v1)

v1 has 10 raw resources and 12 refined goods across three tiers. *(Proposed; the categories and wild food are Decided.)* Buildings can offer several recipes where it makes sense. *(Decided)*

**Raw resources** — gathered by ordinary villagers, no master needed:

| Resource | Source | Building | Notes |
| --- | --- | --- | --- |
| Logs | Forest tiles | Woodcutter's hut | Removes trees |
| Berries, mushrooms | Forage patches (need standing trees nearby) | Forager's hut | Seasonal; spoil fast |
| Game meat, hides | Hunting ground | Hunter's lodge | Can be overhunted, and logging drives game away; hides are sold until the tannery arrives (v1.x) |
| Fish | River | Fisher's hut | Stops when river freezes |
| Stone | Rock | Quarry | Depletes |
| Clay | Riverbank | Clay pit | Depletes slowly |
| Iron ore | Mountain | Mine | Depletes |
| Grain | Field tiles | Farm | Idle in winter |

**Refined goods:**

| Tier | Output | Inputs | Building | Needs master |
| --- | --- | --- | --- | --- |
| 1 | Firewood | Logs | Chopping block | — |
| 1 | Charcoal | Logs | Charcoal kiln | — |
| 1 | Planks | Logs | Sawpit | Carpenter |
| 1 | Cut stone | Stone | Stonecutter | Mason |
| 1 | Bricks | Clay, firewood | Brick kiln | Mason |
| 1 | Smoked meat/fish | Meat or fish, firewood | Smokehouse | Butcher |
| 2 | Iron bars | Iron ore, charcoal | Bloomery | Smith |
| 2 | Flour | Grain | Windmill or watermill | Miller |
| 2 | Ale | Grain, firewood | Brewery | Brewer |
| 3 | Tools | Iron bars, planks | Smithy | Smith |
| 3 | Bread | Flour, firewood | Bakery | Baker |
| 3 | Furniture | Planks, iron bars | Carpenter's workshop | Carpenter |

**Firewood** *(Decided: its own building; details Proposed)*: the woodcutter's hut only fells trees. A **Chopping block** (1×1, cheap in logs) employs one Woodsplitter and splits 1 log into 2 firewood. It pauses while the village holds at least a target amount of firewood (Stockpiles plus House buffers; content default, e.g. 40), so it doesn't turn every log into firewood. The target becomes an editable standing order in M5. Logs go to construction sites first, then workshop inputs, then Stockpiles.

**Spoilage** *(Decided: food spoils and preservation is its own tech)*

- Raw meat, fish, berries and mushrooms spoil in days; bread in about a season; smoked meat, grain and flour last much longer.
- A **root cellar** slows spoilage for food stored in it.
- **Model** *(Decided, [ADR-0002](adr/0002-spoilage-daily-share.md))*: at each Dawn every stack of Food in a Granary or workplace buffer loses `ceil(amount × rate%)`. Food in someone's hands doesn't spoil. Rates are per Food in content (Proposed: berries 35%, fish and meat 25%, smoked goods about 3%).
- **Cold keeps food** *(Decided)*: in winter every rate is multiplied by a content percentage (Proposed 20%, so meat loses 5% a day). With winter hunting, this is how a Camp gets through its first winter before the Butcher's smokehouse (M5). There is no no-master drying rack; it would undercut the smokehouse.

**Mills:** windmills and watermills are ordinary production buildings that must sit on a hill or river. There is no power network. *(Proposed, following the no-power rule.)*

## Logistics

Carriers walking on roads are the village's conveyor belts. *(Decided)*

**Model: job dispatch** *(Decided, [ADR-0001](adr/0001-logistics-model.md))*. A dispatcher assigns each haul (pick up at A, drop at B) to an idle carrier. Carriers path over any walkable tiles and walk faster on roads; the dispatcher measures nearness by walking cost, so better roads draw traffic. Throughput is set by carrier count and distance.

Flag relay (Settlers 2 style: one carrier per road segment between flags, handing goods on at each flag) was prototyped against it and dropped: laying out flags was fiddly. What it would have given, bottlenecks visible on the road itself, now has to come from the readability tools below.

**Collisions:** villagers never block each other; they pass through. This is standard in the genre and removes merging and jam logic. A soft slowdown on crowded road tiles can come later if bottlenecks need to be more visible. *(Proposed)*

**Making bottlenecks readable** *(Proposed)*: icons over idle workshops ("waiting for charcoal", "output full", "no worker"), a carrier-utilization meter, and a road heat-map overlay. **Carrier utilization** is the share of Carriers holding a Haul, averaged over the last in-game day; **road traffic** is Carrier steps onto each Road tile over the same window. *(Decided in design session M2-01)*

**Construction** *(Decided for M2)*: no builder villagers. A site's build timer starts once every material has arrived and runs only by day. Builders come back only if a playtest asks for them.

**Storage** *(Decided: a mix; details Proposed)*

- **Workshop buffers:** each workshop holds a few units of inputs and outputs.
- **Stockpile zones:** open-air areas for bulk raw goods (logs, stone, clay).
- **Food store (granary):** villagers eat from it. *(Decided)* The root cellar is its preserving upgrade. Food never goes to a Stockpile.
- **Market stockpile:** goods set aside for sale. *(Decided)*
- **Standing orders:** "keep 50 planks, pause the sawpit above 100." These are the main automation tool.

**Logistics upgrades** *(Decided in principle; order Proposed)*

| Stage | Unlock | Effect | Release |
| --- | --- | --- | --- |
| 1 | Hero hand-carry | Starting state | v1 |
| 2 | Carriers on dirt paths | Automated hauling | v1 |
| 3 | Cobblestone roads | Faster walking | v1 |
| 4 | Handcarts | More per trip | v1 |
| 5 | Ox carts on set routes | Long-distance lines to outposts | v1.x |
| 6 | River barges | Bulk transport by river | v1.x |
| 7 | Magical porters (golems, enchanted carts) | Late-game automation | v2+ |

## Villagers, needs and population

Every villager is a named individual with a home, a job and needs. *(Decided)* Ordinary villagers do basic jobs (gathering, hauling, farming); trades need a master (next section).

**Needs tiers** *(Decided: needs exist and gate growth; tiers Proposed)*

A house's residents rise a tier when their needs are met, and the house upgrades with them.

| Tier | House | Needs | Release |
| --- | --- | --- | --- |
| Settlers | Hut | Food, shelter, warmth (firewood in winter) | v1 |
| Craftsfolk | Cottage | Two kinds of food, ale at a tavern, furniture | v1 |
| Burghers | Townhouse | Bread, chapel, market, safety (walls) | v1.x |

**Daily life and survival** *(Decided in design session M2-01; every number is content and Proposed)*

- **Meals:** each villager eats one Meal a day, at Dusk, on the way home: 1 unit of Food at the nearest Granary that has some, fastest-spoiling Food first (ties by resource ID). No delivery to houses. Food variety doesn't matter until Craftsfolk. A villager who finds no food goes home hungry.
- **Homes:** a Hut holds 3. A Homeless villager is given a free place automatically, in the House nearest their Workplace by walking cost (Carriers: nearest to where they stand), villagers in ID order. Nobody is moved once housed, and there's no manual assignment yet. A demolished House makes its residents Homeless. Homeless villagers sleep in the open where they stand.
- **Dusk:** no new work or Haul starts. A Carrier holding goods finishes delivering them; one still walking to a pickup drops the Haul. A gatherer abandons a chop in progress and drops goods in hand at their Workplace. Then everyone eats, walks home and sleeps. At Dawn they walk to work. A villager who hasn't reached home by Dawn turns back to work. There's no rule that Houses must be near Workplaces; the morning commute costs daylight.
- **Tired:** a villager who slept less than half the night at Home (Homeless ones included) walks and works 50% slower until the next Dusk, with a "zzz" icon.
- **Hungry:** a villager who missed their last Meal walks and works 50% slower; the panel shows "2 days without food; dies after 3". After 3 missed Meals in a row they starve at that Dusk. One Meal resets the count.
- **Warmth:** in winter each occupied House burns 1 firewood per night, taken at Dusk (per House, not per resident). A House that can't pay is cold that night. Houses keep a firewood buffer of 5 and ask for firewood from the start of autumn to the end of winter.
- **Cold:** a winter night in a cold House or in the open makes a villager Cold: 50% slower, with an icon. After 2 cold nights in a row they freeze at Dawn. A warm night resets the count. Freezing is deliberately faster than starving.
- **Slowdowns don't stack:** only the worst of Tired, Hungry and Cold applies, and every icon shows. The hero's aura still multiplies on top.

**Happiness** raises or lowers work speed. The tavern, for example, makes nearby villagers work a bit faster. *(Decided)* Long unhappiness makes villagers leave. *(Decided as an option)*

**Population** *(Proposed)*

- v1: growth by **immigration only**. Newcomers arrive when there is free housing, surplus food and good happiness.
- **Immigration rule (M2)** *(Decided in design session M2-01; numbers Proposed)*: checked at each Dawn. One Newcomer arrives when there's at least one free place in a House, Food in Granaries is at least 5 Meals × (population + 1), and it isn't winter (the roads are snowed in). Newcomers enter at the map's entry tile, walk to the House they're given and start as Carriers. Happiness joins the rule in M5.
- v2: families, births and aging.
- Villager-to-villager relationships (friendships, marriages) stay out of v1; they distract from management. A good home is what villagers care about. *(Decided)*

**Death** *(Decided)*: starvation, freezing (no shelter or warmth in winter) and monsters. A dead master is a serious loss.

**Graveyard** *(Proposed, v1 stretch)*: the dead must be buried. Unburied bodies lower happiness and raise disease risk. Cheap to build, and very on-tone.

## Trades and masters

A trade exists in the village only once its master has settled there. *(Decided: trades are earned; masters are characters.)* v1 has 7 masters: Carpenter, Mason, Butcher, Smith, Miller, Brewer, Baker. *(Proposed)*

**How a trade scales without apprentices** *(Proposed; apprentices are v2)*

- The master runs their own workshop with a speed bonus.
- Once the master lives in the village, you can build more workshops of that trade and staff them with ordinary villagers.
- If the master dies or leaves, those workshops slow to a crawl until a new master is invited. Masters stay precious.

**Ways to invite a master** *(Decided: conditions, with several types; types Proposed)*

| Type | How it works | Example |
| --- | --- | --- |
| Charter | Meet listed conditions, then pay a signing fee | Smith: iron ore supply, 15 residents, a tavern, 500 gold |
| Passing caravan | A travelling master stays a few days; win them over in time | Brewer visits in autumn, wants 50 grain and a cottage |
| Rescue | The hero finds the master at a point of interest | Mason trapped in the ruins by monsters |
| Recommendation | A happy master vouches for a friend | Happy Miller brings a Baker |

**Notice board** *(Decided)*: invitations and side quests are posted on a notice board building in the village. Charter conditions, caravan visits and rescue leads all appear there, alongside side quests that reward coin, goods or reputation.

**Personality** *(Decided: masters have personalities)* — each master has 1–2 traits drawn from a pool. Examples:

- *Drunkard:* works faster within reach of a tavern, slower without.
- *Proud:* quits if a second master of the same trade is invited.
- *Early riser:* works longer days, grumpy if housed near the tavern's noise.
- *Pious:* happiness boost from a nearby shrine or chapel.

**Adjacency rules** *(Decided: yes)* — buildings have likes and dislikes that affect nearby homes and workshops. The tannery and smokehouse smell; the bakery makes neighbours happier; the smithy is loud. Layout becomes a social puzzle, not only a logistics one.

**Fantasy races** *(Decided: optional)* — v1 masters are human. From v1.x a master can be a dwarf, elf or halfling, with a race bonus and extra needs (a dwarf smith wants ale and stone housing).

## Economy: goods, tools and coin

Every good ends up in one of three places: consumed by the village, built into the village, or sold for coin. Coin buys what the village can't make itself. *(Proposed)*

```mermaid
flowchart LR
  P[Production] --> U[Upkeep<br/>food, firewood, tools]
  P --> B[Construction<br/>houses, milestones]
  P --> S[Market stockpile]
  S --> M[Trade post<br/>merchants buy]
  M --> C((Coin))
  C --> I[Invite masters]
  C --> B
  C --> X[Import goods<br/>you can't make]
  C --> T[Crown tribute]
```

**Tools: used and sold** *(Proposed; undecided, revisit once the first chains are playable)*

- Gatherers and craftspeople need a tool to work at full speed (axe, pick, sickle, hammer). Without one they work at half speed, so there is no hard lock.
- Tools wear out after about a year of use. The metal chain therefore has permanent demand, not a one-off build.
- Surplus tools are one of the best-selling goods at the trade post.

**Coin sources** *(Proposed)*

- **Trade post:** merchants visit on a schedule and buy from the market stockpile. Prices drop when you flood a good, which rewards a varied economy. Higher village reputation means more frequent and richer merchants.
- **Taxes** from Craftsfolk and Burghers. *(v1.x)*

**Coin sinks** *(Proposed)*

- Master signing fees.
- Milestone buildings, which cost coin plus goods. *(Decided)* Example: a tavern for 10,000 gold, 1,000 wood and 100 iron bars. Real numbers will come from balance simulations.
- Imports: seeds, iron bars before you have a mine, goods you can't produce yet.
- **Crown tribute** *(leaning yes)*: the lord's tax collector demands a set sum each year. Paying keeps the charter safe; missing it brings penalties. A gentle, recurring pressure that gives surplus a purpose early on.
- Mercenaries in an emergency. *(v1.x)*

## Heroes

The player controls one hero, an RTS-style unit who kickstarts the village and then becomes a specialist. *(Decided)* The hero picked at game start shapes the run. *(Decided: multiple heroes)*

**What a hero does**

- Gathers and hauls by hand in the first days, before carriers exist.
- Gives a production bonus to buildings nearby or to one chain (an aura).
- Fights monsters and bandits, and leads the militia.
- Searches points of interest and rescues masters. It alone can wade a snowed-in Pass.

**Heroes in v1** *(Proposed: two, to prove the system; more in v1.x)*

| Hero | Strength | Bonus |
| --- | --- | --- |
| Ranger | Forest and scouting | Faster foraging and hunting nearby; slower game depletion; sees further at night |
| Smith-lord | Metal and building | Faster bloomery and smithy nearby; tools last longer |

Later candidates: Priest (happiness, healing), Merchant (better trade prices), Warden (defence).

**The hero has no needs** *(Decided)*: it doesn't eat, sleep or freeze, and can keep working at night.

**The hero can't die.** *(Decided)* When defeated, the hero is knocked out and recovers at the village hall after a while. *(Proposed)* Before a village hall exists, it recovers where it fell (see Nights in v1). This costs time and leaves the village exposed that night.

**Progression** *(Proposed)*: heroes gain a new perk at each village rank instead of grinding XP, keeping the focus on the village.

**Control** *(Decided)*: no WASD. The hero is selected and ordered with the mouse, RTS style. How the hero fits the automation loop will be playtested once logistics works.

## Threats and combat

Combat is light and automatic: the player positions and prepares, units fight on their own. *(Decided: light combat; auto-resolve Proposed)*

**Night monsters** *(Decided: they spawn at night)*

- Monsters come from **dens** in the wilds. Left alone, dens slowly multiply toward the village. *(Proposed)*
- The hero and militia can clear a den by day, which rewards loot and calms the area.
- **Light keeps them out** *(Decided in design session M3-01; see ADR-0003)*: torches and braziers burn firewood, and monsters never step onto a lit tile. It's a Don't Starve nod, and another reason the wood chain matters.

**Defence** *(Decided)*

- **Militia:** a bell calls villagers to arms. They drop their jobs, so every fight costs production.
- **Hero:** the strongest single fighter.
- **Palisades** block paths; **watchtowers** spot and shoot.

**Nights in v1 (M3)** *(Decided in design session M3-01; numbers Proposed and in content)*

- **Gloamling:** v1's one monster. Small, shadowy, many-eyed, comes in packs. 20 HP, 4 damage every 20 ticks at an adjacent tile, villager walking speed, sight 12 tiles.
- **Combat:** integer HP, damage per hit and a cooldown in ticks. A fighter hits its target when in reach and off cooldown. Within a tick, hits resolve in entity-ID order; targets are the nearest by walking distance, ties to the lowest ID. Villagers: 20 HP, 3 damage every 20 ticks, back to full HP at Dawn. A villager a Gloamling reaches fights back, militia or not.
- **Targets:** a Gloamling goes for the nearest villager out in the open (not asleep at Home), the Hero, or, with neither in sight, the nearest lived-in House. It batters the House's door (60 HP); when the door breaks, the residents asleep inside come out and fight it (and any other Gloamling that reaches them) until Dawn. *(Decided by the owner, replacing "kills one resident and moves on")* It picks again when its target dies, is Knocked out or steps into Light. Doors heal at Dawn, so nothing needs repairing. Watchtowers can't be attacked.
- **Dens:** a map object. At each Dusk a Den spawns Gloamlings on its tile: spring 1, summer 2, autumn 3, winter 4. Once a season it **buds**: a new Den 6–10 tiles closer to the nearest building, on a dark tile at least 12 tiles from any building and from any Shrine (M4), at most 5 Dens. Nothing can be built within 6 tiles of a Den, so it always keeps a dark ring. At Dawn every Gloamling still out vanishes.
- **Clearing a Den** (Hero only in M3; militia later): a Den has 80 HP and stings anything adjacent for 5 every 20 ticks. At 0 it's removed and leaves a cache of 4 hides and 6 firewood. No Den buds within 15 tiles of a cleared one for 10 days.
- **Light:** torch (1×1, 1 log, radius 2, 1 firewood a night, holds 3) and brazier (1×1, 4 logs, radius 4, 2 firewood a night, holds 6), Chebyshev radius. Each burns its night's firewood at Dusk; one that can't stays dark all night. Carriers fill them after Houses and before Stockpiles, and their firewood counts toward the chopping block's target. House windows give no Light.
- **Palisades:** segments laid like a Road (2 logs, 40 build ticks, 100 HP). A **Gate** (4 logs, 80 build ticks) lets villagers and the Hero through, but not Gloamlings. A Gloamling that can't reach its target batters the palisade in its way; damage heals at Dawn.
- **Watchtowers:** 1×1, 12 logs, staffed by one **Watchman** on a night shift: eats at Dusk, stands in the tower until Dawn, sleeps at Home by day (day sleep counts for Tired). Shoots Gloamlings within 6 tiles for 5 every 30 ticks, only while its Watchman is in it.
- **Militia bell:** 1×1, 5 logs, one per village. Ringing it (panel or HUD) calls every villager but Watchmen: they drop their work by the unassign rule and fight Gloamlings within 10 tiles of the bell. Ringing again, or Dawn, stands them down. A night at the bell is a night away from Home: Tired the next day, and Cold in winter.
- **Hero:** 100 HP, 10 damage every 20 ticks. Fights in reach on its own and can be ordered to attack. At 0 HP it's **Knocked out** where it falls for 400 ticks, ignored by Gloamlings, then gets up at full HP. The village hall (M5) becomes where it recovers.
- **Monster rate:** a per-game setting in state, chosen at New game (dev panel for now) and changeable mid-game by a dev command. It scales each Dusk's spawns (`trunc(n × rate ÷ 100)`). 0 is off: no spawns, no budding, and Gloamlings out vanish at once. M7 turns it into player-facing levels.
- **Pressure** grows through the seasons' spawn counts, longer winter nights and budding, not through a separate difficulty curve.

**Bandits** *(Decided as a threat; Proposed for v1.x)*: daytime raids in summer that target the granary and market stockpile. Pushed to v1.x to keep v1 combat to one enemy type.

**Other pressures** *(Decided)*: winter cold, hunger, unhappiness and emigration.

## Progression

The village climbs four ranks; each rank-up is a milestone building you pour goods and coin into. *(Decided: milestone buildings as resource dumps; ranks Proposed)*

| Rank | Milestone building | Requires | Unlocks |
| --- | --- | --- | --- |
| Camp | — (start) | Hero + 5 settlers | Gathering, huts, carriers, stockpiles |
| Hamlet | Village hall | Logs, stone, 10 residents | Trade post; invitations for Carpenter, Mason, Butcher, Brewer, Smith |
| Village | Tavern | Coin, planks, iron bars, ale in stock, 25 residents | Craftsfolk tier; Miller and Baker invitations; cobblestone roads, handcarts |
| Town | Town charter (guildhall) | Coin, cut stone, bricks, tools, 50 residents, all tier-2 needs met | v1 "win" in sandbox; endless play continues |

**Starting Camp** *(Decided in design session M2-01; amounts Proposed)*: a new game starts at Dawn on spring day 1 with a Granary holding 20 meat, a 2×2 Stockpile holding 30 logs, and 5 settlers (Carriers, all Homeless) plus the hero at the map's entry tile. No Houses or Workplaces. The first day's job is two Huts; anyone without a Home at Dusk is Tired on day 2.

Exact numbers come from balance simulation. The example tavern cost (10,000 gold, 1,000 wood, 100 iron bars) sets the scale.

**Game modes** *(Decided: campaign with missions, plus sandbox)*

- **Sandbox:** endless. Settings for map seed, hero, winter harshness and monster rate. Rank goals give structure but play never ends. *(Decided: endless sandbox)*
- **Campaign, chapter 1** *(Proposed for v1)*: five missions that double as the tutorial.
    1. Survive the first winter.
    2. Invite your first master.
    3. Clear the den in the old forest.
    4. Pay the crown's tribute.
    5. Earn the town charter.

## Failure states

The village can die, and the game ends when it does. *(Decided)*

- **Game over:** no living villagers remain (the hero alone can't sustain a village). *(Proposed trigger)*
- **Death spiral warnings** *(Proposed)*: clear alerts before it's too late, such as "8 days of food left, winter in 3 days" or "no firewood in 4 homes."
- **Alerts** *(Decided in design session M2-01; thresholds Proposed)*: worked out from the current state, not stored, listed in the HUD; clicking one moves the camera to it.
    - **Red**, someone dies at the next Dusk or Dawn: "Wynn will starve at dusk", "Oda will freeze at dawn".
    - **Amber**: "About N days of Food left" (Granary Food ÷ population under 3 days); in autumn, "Food for N days, winter in M days" (Food can't cover the rest of autumn plus winter); in autumn and winter, "N Houses have no firewood" (an occupied House's buffer is empty); in autumn, "Firewood for N nights, winter needs M" (stock below occupied Houses × winter nights); "N villagers Hungry / Cold / Homeless"; "Old Wood is Scarce" (a Hunting ground turns Scarce).
    - Food projections ignore Spoilage and say "about". Deaths go to a short message log ("Ada starved, day 14"), not the alert list. Through autumn the HUD shows "winter in N days".
- **Soft losses along the way:** masters dying or leaving, villagers emigrating, the crown revoking privileges after missed tribute.
- In campaign missions, some objectives can also fail (e.g. the mission fails if a key master dies).

## Tech and art direction

Build a code-first TypeScript game, packaged for desktop, so Claude Code can work on every part of it. *(Proposed)*

**Stack** *(Proposed)*

| Layer | Choice | Why |
| --- | --- | --- |
| Language | TypeScript | Strongest language of the developer; fast to review generated code |
| Simulation | Headless, deterministic, fixed-tick ECS in a Web Worker | Easy saves, testable economy, balance runs without rendering |
| Rendering | PixiJS (WebGL/WebGPU) | Mature 2D sprite renderer, handles isometric maps |
| UI | React (or similar) over the canvas | Panels and menus in a familiar stack |
| Content | Typed data files for resources, recipes, buildings, masters, traits | Claude can add and balance content in bulk |
| Desktop and Steam | Electron (well-trodden Steamworks path) or Tauri (lighter) | Ship to Steam and itch.io |

**Why simulation and rendering are separated:** the same simulation code runs in the game, in automated tests and in balance scripts ("does a 20-person village survive winter 3?"). Claude Code can then test design changes without anyone playing.

**Input and saves** *(Decided)*: mouse and keyboard only. Free saving at any time, plus an autosave at the start of each day.

**Repository layout** *(Proposed)*: a pnpm monorepo, so the simulation/rendering split is enforced by package boundaries.

| Package | Contents | May import |
| --- | --- | --- |
| `packages/sim` | Game state, `step(state, commands)`, save format | `content` only; no DOM, no Pixi |
| `packages/content` | Typed data: resources, recipes, buildings | Nothing |
| `packages/client` | Vite, PixiJS v8, React UI, Web Worker hosting the sim | `sim`, `content` |
| `apps/desktop` | Electron wrapper for Steam | Later, not in milestone 0 |

**Simulation rules** *(Proposed)*

- Fixed tick rate of 20 ticks per second, independent of frame rate.
- A seeded random number generator; no `Math.random` or `Date.now` in the sim.
- State is plain, serializable data; a save is the serialized state.
- Quantities are integers.
- Small hand-rolled entity-component system; switch to a library only if performance demands it.
- Every sim feature ships with a headless test.

**Tooling** *(Proposed)*: strict TypeScript, Vitest, Biome.

**Art** *(Decided: polished, cartoony, a bit dark, aimed at adults; not strict pixel art)*

- **References** *(Decided)*: Don't Starve (ink outlines, muted palette, paper-cutout animation), Hollow Knight (hand-painted, moody), Graveyard Keeper (tone and density).
- **Style** *(Proposed)*: hand-drawn 2D with bold, slightly wobbly ink outlines and a desaturated earthy palette. At night, warm light sources (torches, windows, forges) pop against the dark, tying the look to the light-keeps-monsters-away mechanic.
- **Animation** *(Proposed)*: cutout (skeletal) animation, as in Don't Starve. Characters are split into parts and moved by a rig (Spine or similar; PixiJS supports Spine). One rig serves many villagers with swapped heads, clothes and tools, and animations are data Claude Code can script.
- **Base tile, explained**: the size in pixels of one ground tile at 100% zoom. Every sprite is drawn to that scale, so it fixes how detailed art can be. For painted art, draw at high resolution (e.g. 256×128 per tile) and let camera zoom scale it down. *(Proposed)*
- **Pipeline** *(Proposed)*: Claude Code draws placeholder art as SVG (ink outline plus flat fills), which suits this style far better than pixel art. It also builds the tooling: export, texture atlases, rig setup and a consistent lighting treatment.
- **Final art**: a commissioned artist, or image generation followed by cleanup. Polished hand-drawn art is the hardest part of this project to automate, so budget for an artist eventually.

## v1 scope

v1 is a complete, winnable loop from Camp to Town on one procedural valley, with one enemy type and two heroes.

| Area | In v1 | Held for later |
| --- | --- | --- |
| Map | Procedural valley, isometric square grid, 4–5 handcrafted POI types | Multiple biomes, outposts, bigger regions |
| Time | Day/night, 4 seasons, pause and 3 speeds | Weather events |
| Resources | 10 raw, 12 refined, spoilage, root cellar, forest ecology | Textiles, leather, luxury goods |
| Logistics | Carriers, dirt and cobblestone roads, handcarts, standing orders | Ox carts, barges, magical porters |
| People | Named villagers, 2 needs tiers, happiness, immigration, death | Burghers tier, families, births, relationships |
| Trades | 7 human masters, 4 invitation types, traits, adjacency | Apprentices, fantasy races, more masters |
| Economy | Trade post, coin, tools that wear out, imports, crown tribute | Taxes, mercenaries, dynamic markets |
| Heroes | Ranger and Smith-lord, perks per rank | More heroes, hero gear |
| Threats | Night monsters from dens, militia, palisades, watchtowers, torches | Bandits, sieges, bosses |
| Modes | Endless sandbox with rank goals, campaign chapter 1 (5 missions) | Further chapters, challenge maps |
| Platform | Desktop (Steam and itch.io) | Co-op or multiplayer |

## Expansion backlog

v1.x deepens the v1 loop; v2+ adds new layers. Order within each release is not yet prioritized.

| Feature | Release | Idea |
| --- | --- | --- |
| Bandits | v1.x | Summer daytime raids on food and market stock |
| Burghers tier | v1.x | Townhouses; bread, chapel, market, walls |
| Leather and textiles | v1.x | Tannery, sheep, wool, weaver, tailor; clothing as a need |
| Fantasy races | v1.x | Dwarf, elf, halfling masters with bonuses and extra needs |
| More heroes | v1.x | Priest, Merchant, Warden |
| Ox carts and barges | v1.x | Route-based transport to outposts and along rivers |
| Taxes and mercenaries | v1.x | Coin from higher tiers; hired defence |
| Weather events | v1.x | Storms, drought, harsh winters, plague |
| Festivals | v1.x | Seasonal events that spend goods for big happiness boosts |
| Kitchens and tavern meals | v1.x | Places to eat besides the Granary, serving cooked meals that give buffs instead of raw food |
| More House types | v1.x | A family house, a single room for loners who dislike company, larger shared houses |
| Choose a starting point | v1.x | The player picks where on the map the Camp starts |
| Apprentices | v2 | Villagers train into journeymen under a master |
| Families and births | v2 | Aging, children, generations |
| Villager relationships | v2 | Friendships, rivalries, marriages |
| Enchanting | v2 | Enchanted tools and goods as a production tier (no power grid) |
| Magical logistics | v2 | Golem porters, enchanted carts |
| Outposts and biomes | v2 | Satellite mining and logging camps; mountain, marsh, coast maps |
| Mod support | v2 | Content is already data files, so mods follow naturally (Steam Workshop) |
| Co-op or trade between players | v2+ | Multiplayer villages sharing a region |

## First build target

Milestone 0 is one resource gathered, carried and turned into a building. *(Decided)* Done when you can watch logs flow from the forest into a finished hut.

**Milestone 0 contents** *(Proposed)*

- A small isometric map with trees, with camera pan and zoom.
- A woodcutter chops trees into logs at a woodcutter's hut.
- The player places a construction site for a hut.
- A carrier hauls logs from the woodcutter's hut to the site; the hut completes when enough logs arrive.
- Pause and speed controls, save and load.
- A headless test proves the simulation builds the hut within a set number of ticks.

**After milestone 0** *(Proposed order)*

1. ~~Logistics prototypes A and B, then pick one.~~ Done: job dispatch (ADR-0001).
2. Hero playtesting on top of the chosen logistics.
3. ~~Map-size prototype.~~ Done: a 128² Valley (ADR-0004).

## Open questions

These stay open until prototypes and playtests answer them. Everything tagged Proposed above is the working default until then.

- [x] Title: Candlemarch (Lanternwood is taken on Steam)
- [x] Logistics: job dispatch (ADR-0001), after an A/B playtest against flag relay.
- [ ] Economy: should tools wear out?
- [ ] Hero role in the automation loop? Decided by playtest.
- [x] Map size: 128² with a performance budget (ADR-0004).
- [ ] Deposits: when a non-renewable Deposit runs out, can the village get stone or ore some other way? For the M5 design session.
- [ ] Art: confirm cutout animation and a 256×128 base tile.
- [x] Hero control: mouse, RTS style, no WASD.
- [x] Master invitations: notice board, which also hosts side quests.
- [x] Saves: free plus autosave each dawn.
- [x] Input: mouse and keyboard.
- [x] First build target: one resource gathered, hauled and built with.
