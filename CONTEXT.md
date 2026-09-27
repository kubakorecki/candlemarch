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
An open-air patch of land, marked as bare dirt, where goods are stored. Each tile holds a fixed amount.
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
The state of a villager who didn't get a night's sleep at Home: they walk and work slower the next day.
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

### Time

**Dusk**:
The moment night begins. The working day ends: villagers finish what they hold, eat and go Home.
_Avoid_: Evening, nightfall

**Dawn**:
The moment night ends and a new day begins. Spoilage happens here.
_Avoid_: Morning, daybreak

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

**Hunting ground**:
A region of forest holding Game. Felling its trees lowers how much Game it can hold, and the surplus flees.
_Avoid_: Game region, hunting area

**Game**:
The animals in a Hunting ground, counted as one number. Hunts take them; logging drives them away.
_Avoid_: Wildlife, animals (as a count)

**Forage patch**:
A berry bush or mushroom patch in the forest, where foragers gather Food. It refills each season only while a standing tree is near enough to shade it.
_Avoid_: Bush (alone), forage tree

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
