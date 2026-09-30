# Candlemarch

A medieval-fantasy village builder in which the player designs a settlement that runs itself. This glossary fixes the words used in the spec, code, tickets and tests.

## Language

### Buildings

**House**:
A building villagers live in. It upgrades with its residents' needs tier: Hut → Cottage → Townhouse.
_Avoid_: Home (as a building type), dwelling

**Hut**:
The Settlers-tier House. Only a House, never a workplace, even though some workplaces have "hut" in their name.
_Avoid_: Shack

**Workplace**:
Any building that employs villagers, such as the woodcutter's hut, the quarry or the smithy. Its name may include "hut".
_Avoid_: Job building, production building

**Granary**:
The building that stores Food and where villagers eat their Meal. Food never goes to a Stockpile.
_Avoid_: Food store, pantry, storehouse

**Chopping block**:
The Workplace where Logs are split into Firewood. The woodcutter's hut only fells trees.
_Avoid_: Woodshed, splitting hut

**Rank building**:
The building whose completion raises the village to its next rank: village hall, tavern, guildhall.
_Avoid_: Milestone building

### Progression

**Rank**:
The village's stage of growth: Camp, Hamlet, Village, Town. Each rank unlocks buildings, trades and invitations.
_Avoid_: Level, era, age

### Logistics

**Road**:
A line of tiles that villagers walk faster on. Comes as a Dirt path or, later, a Cobblestone road.
_Avoid_: Street, track

**Dirt path**:
The first kind of Road: free, laid instantly, gives a modest speed bonus.
_Avoid_: Trail, dirt road

**Carrier**:
A villager whose Job is moving goods between buildings. The default Job of a villager without a Workplace.
_Avoid_: Hauler, porter (porters are a late magical upgrade)

**Haul**:
One delivery by a Carrier: pick up goods at one building and drop them at another.
_Avoid_: Job (a Job is what a villager does), task, delivery

**Stockpile**:
An open-air patch of land, marked as bare dirt, where bulk goods (logs, firewood, stone, clay, hides) are stored. Each tile holds a fixed amount of one resource. Food never goes on one; it goes to a Granary.
_Avoid_: Warehouse, depot, storage zone

### People

**Job**:
What a villager currently does: the work of their Workplace, or Carrier if they have none. A villager's Job can change; the person stays the same.
_Avoid_: Role, profession, occupation

**Home**:
The House a villager is assigned to live in. A villager keeps their Home when their Job changes.
_Avoid_: Residence, lodging

**Homeless**:
A villager with no Home. They sleep in the open where they stand.
_Avoid_: Unhoused, vagrant

**Tired**:
The state of a villager who didn't get their sleep at Home (at night, or by day for a Watchman): they walk and work slower until their next sleep.
_Avoid_: Exhausted, sleepy

**Hungry**:
The state of a villager who missed their last Meal: they walk and work slower. Too many missed Meals in a row and they starve.
_Avoid_: Starving (as a state), famished

**Cold**:
The state of a villager who spent the last winter night in a cold House or in the open: they walk and work slower. Two such nights in a row and they freeze.
_Avoid_: Chilled, freezing (as a state)

**Newcomer**:
A villager who arrives by immigration. They enter at the map's entry tile and start as a Carrier.
_Avoid_: Immigrant, settler (settlers are the starting villagers)

**Hero**:
The one unit the player controls directly, with the mouse, RTS style. Not a villager: has no Job and can't die. Its aura makes nearby Workplaces work faster.
_Avoid_: Player character, avatar, champion

**Knocked out**:
The Hero's state at zero health: out of action where it fell for a while, ignored by Gloamlings, then back on its feet at full health.
_Avoid_: Dead, downed, defeated (as a state)

**Watchman**:
The Job of a villager who stands in a watchtower through the night and shoots Gloamlings in range. Eats at Dusk and sleeps at Home by day.
_Avoid_: Guard, sentry, archer

**Militia**:
Every villager while the bell rings: they drop their Jobs and fight near the bell until it is rung again or Dawn comes. Watchmen stay in their towers.
_Avoid_: Army, guards, soldiers

### Time

**Dusk**:
The moment night begins. The working day ends: villagers finish what they hold, eat and go Home.
_Avoid_: Evening, nightfall

**Dawn**:
The moment night ends and a new day begins. Spoilage happens here.
_Avoid_: Morning, daybreak

### Threats

**Gloamling**:
v1's one monster: small, shadowy, many-eyed, comes in packs. Spawns at a Den at Dusk, never steps into Light, and vanishes at Dawn. It goes for villagers out in the open, the Hero, and lived-in Houses.
_Avoid_: Monster (except as the category), creature, enemy

**Den**:
A Gloamling lair in the wilds. It spawns Gloamlings at every Dusk and slowly buds new Dens closer to the village. The Hero can clear one: it stings whoever stands next to it, and at 0 HP it leaves a Cache and a calm area where no Den buds for a while.
_Avoid_: Nest, lair, spawner

**Cache**:
The loose goods a cleared Den leaves on its tile. Carriers and the Hero pick them up; it's gone once empty.
_Avoid_: Loot, drop, stash

**Light**:
The tiles a torch or brazier lights at night. Gloamlings never step onto them. House windows give none.
_Avoid_: Glow (a drawing word), lit zone, safe zone

**Palisade**:
A wall of log segments laid like a Road. It blocks villagers and Gloamlings alike. A Gloamling that can't reach its target batters the palisade in its way; the damage heals at Dawn.
_Avoid_: Wall, fence, stockade

**Gate**:
A Palisade segment that villagers and the Hero walk through and Gloamlings don't.
_Avoid_: Door (a Door belongs to a building)

**Monster rate**:
The per-game setting for how hard nights are. 0 means off: no spawns, no budding, and any Gloamlings out vanish at once.
_Avoid_: Difficulty, threat level

### Food

**Food**:
Any resource a villager can eat as a Meal: for now berries, mushrooms, fish and meat.
_Avoid_: Provisions, rations

**Meal**:
The Food a villager eats at a Granary once a day, at Dusk.
_Avoid_: Ration, feeding

**Spoilage**:
The share of every stack of Food that is lost at each Dawn. Each Food has its own rate.
_Avoid_: Rot, decay

### Land

**Valley**:
The whole generated map: a rim of Mountain with one river through it, entered through one gap in the rim.
_Avoid_: World, level

**Terrain**:
The ground of a tile: Meadow, Rock, Mountain, Swamp or River. Trees, Forage patches and Deposits stand on it; they aren't Terrain.
_Avoid_: Tile type, biome

**Meadow**:
Open ground that villagers walk on and build on.
_Avoid_: Grass, field (a field is farmland)

**Forest**:
Tiles with standing trees. Not a Terrain: a tile stops being Forest when its tree is felled. Walkers cross it slowly; nothing is built on it.
_Avoid_: Woods, woodland, forest terrain

**Rock**:
Stony ground at the foot of the Mountains. Walkable but slow, and nothing is built on it except a quarry. Stone Deposits sit on it.
_Avoid_: Stone (the resource), crag

**Mountain**:
Ground nobody can walk on or build on. It forms the Valley's rim; iron Deposits sit on its faces.
_Avoid_: Cliff, hill

**Swamp**:
Wet, slow ground that can't be built on until it is Drained.
_Avoid_: Marsh, bog

**Drain**:
Construction laid over Swamp tiles the way a Road is laid. When finished, the tile becomes Meadow for good.
_Avoid_: Ditch, draining

**Ford**:
A shallow stretch of River that villagers, the Hero and Gloamlings wade across slowly. Nothing is built on it.
_Avoid_: Crossing, shallows

**Deposit**:
A map object holding a fixed amount of stone, clay or iron ore. What is dug out never comes back.
_Avoid_: Node, vein (as a term), ore patch

**Reserve**:
Forest tiles the player paints so woodcutters never fell there. Foragers, hunters and foresters still work in it.
_Avoid_: Foraging area, preserve, protected forest

**Side valley**:
The part of the Valley behind the Pass, where the iron Deposits and the Abandoned mine are.
_Avoid_: Back valley, second valley

**Pass**:
The gap through the Mountain rim into the Side valley. It is snowed in, and nobody walks through it until a Pass road is built.
_Avoid_: Gap, col

**Pass road**:
Construction laid through the Pass the way a Road is laid. Once built, the Pass stays open all year.
_Avoid_: Mountain road

**Stump**:
What a felled tree leaves on its tile. After a long while it sprouts a Sapling, unless a building or Road is put on the tile.
_Avoid_: Clearing

**Sapling**:
A young tree, planted by a forester or sprouted from a Stump. It can't be felled and doesn't block walking. It counts as a standing tree (for shade, Game and Forest) only once it matures.
_Avoid_: Young tree, seedling

**Point of interest (POI)**:
A handcrafted spot the generator places in the Valley: Ruins, an Abandoned mine, a Shrine or a Den.
_Avoid_: Landmark, site (a site is construction)

**Ruins**:
A POI the Hero Searches by day. It leaves a Cache and may hide a trapped master.
_Avoid_: Dungeon, tomb

**Abandoned mine**:
A POI on a Mountain face marking an iron Deposit, with a Den at its mouth.
_Avoid_: Old mine, cave

**Shrine**:
A roadside POI. No Den buds near it.
_Avoid_: Chapel (a building), altar

**Fog**:
What hides the Valley from the player. A tile is unrevealed (black), Revealed, or In sight. Fog changes what the player knows and where they may build, never what happens in the world. It can be switched off per game.
_Avoid_: Fog of war (in code and tickets), shroud, darkness

**Revealed**:
A tile the player has seen at least once. It stays Revealed and shows ground, trees and buildings as last seen, but nothing that moves unless it is also In sight. Only Revealed tiles can be built on.
_Avoid_: Explored, discovered, scouted

**In sight**:
A tile the Hero, a villager, a building, a manned watchtower or Light can see right now. Gloamlings show only on these.
_Avoid_: Visible, lit (Light is its own term)

**Search**:
The Hero's order at a POI: stand on it for a while by day to find what it holds.
_Avoid_: Explore, scout, loot (as a verb)

**Hunting ground**:
A connected stretch of Forest holding Game. Felling its trees lowers how much Game it can hold, and the surplus flees. Game slowly regrows toward that limit, but a ground hunted empty stays empty for seasons.
_Avoid_: Game region, forest region, hunting area

**Game**:
The animals in a Hunting ground, counted as one number. Hunts take them; logging drives them away.
_Avoid_: Wildlife, animals (as a count)

**Forage patch**:
A berry bush or mushroom patch in the forest, where foragers gather Food. It refills each season only while a standing tree is near enough to shade it.
_Avoid_: Bush (alone), forage tree

**Withered**:
A Forage patch with no standing tree within 2 tiles. It yields nothing, is drawn bare, and doesn't refill until shade returns.
_Avoid_: Dead, dried out, unshaded

**Riverbank**:
A land tile right next to the river (north, east, south or west). A fisher's hut must have its door on one. The river freezes in winter, and nobody fishes then.
_Avoid_: Shore, river edge

### Resources

**Logs**:
Raw timber from felled trees. The only raw wood resource.
_Avoid_: Wood, timber, lumber

**Planks**:
Logs refined at a sawpit. A separate resource from Logs.
_Avoid_: Wood, boards, lumber

**Firewood**:
Logs split for burning, for warmth, kilns and light. A separate resource from Logs.
_Avoid_: Wood, fuel
