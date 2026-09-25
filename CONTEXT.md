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

**Flag**:
A point on a Road where goods are set down and handed on in the flag-relay model. Every building door counts as a Flag.
_Avoid_: Waypoint, node

**Segment**:
The stretch of Road between two neighbouring Flags, worked by one Carrier in the flag-relay model.
_Avoid_: Edge, link, leg

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
