import { describe, expect, it } from 'vitest';
import { content, type SeasonId } from '../src/index';

const { resources, terrain, mapObjects, jobs, recipes, buildings, heroes, roads } = content;

function expectPositiveInt(value: number, label: string): void {
  expect(Number.isInteger(value) && value > 0, `${label} = ${value}`).toBe(true);
}

function expectNonNegativeInt(value: number, label: string): void {
  expect(Number.isInteger(value) && value >= 0, `${label} = ${value}`).toBe(true);
}

describe('content validation', () => {
  it('every record key matches its id', () => {
    for (const table of [resources, terrain, mapObjects, jobs, recipes, buildings, heroes, roads]) {
      for (const [key, def] of Object.entries(table)) {
        expect(def.id).toBe(key);
      }
    }
  });

  it('map objects reference existing resources and use positive integers', () => {
    for (const obj of Object.values(mapObjects)) {
      expect(resources).toHaveProperty(obj.resource);
      // A forage patch may start empty (mushrooms in spring); anything else would vanish at once.
      if (obj.forage) expectNonNegativeInt(obj.amount, `${obj.id}.amount`);
      else if (obj.grows) expect(obj.amount, `${obj.id} growing holds nothing`).toBe(0);
      else expectPositiveInt(obj.amount, `${obj.id}.amount`);
      expectPositiveInt(obj.gatherTicks, `${obj.id}.gatherTicks`);
      expectPositiveInt(obj.yieldPerGather, `${obj.id}.yieldPerGather`);
    }
  });

  it('forage patches have a stock for every season and a shade that exists', () => {
    const first = content.calendar.seasons[0]?.id as SeasonId;
    for (const obj of Object.values(mapObjects)) {
      if (!obj.forage) continue;
      for (const season of content.calendar.seasons) {
        expectNonNegativeInt(obj.forage.stock[season.id], `${obj.id}.forage.stock.${season.id}`);
      }
      expect(mapObjects, `${obj.id}.forage.shadedBy`).toHaveProperty(obj.forage.shadedBy);
      expect(mapObjects[obj.forage.shadedBy].forage, `${obj.id} shaded by a patch`).toBeUndefined();
      expectPositiveInt(obj.forage.shadeTiles, `${obj.id}.forage.shadeTiles`);
      // A game starts on the first season's first day: the patch starts with that season's stock.
      expect(obj.amount, `${obj.id} starts with ${first}'s stock`).toBe(obj.forage.stock[first]);
    }
  });

  it('growing things grow into map objects that exist, over whole days and stages', () => {
    const growing = Object.values(mapObjects).filter((obj) => obj.grows);
    expect(growing.map((g) => g.id)).toEqual(['sapling', 'stump']);
    for (const obj of growing) {
      const { grows } = obj;
      if (!grows) continue;
      expect(mapObjects, `${obj.id}.grows.into`).toHaveProperty(grows.into);
      expect(grows.into, `${obj.id} grows into itself`).not.toBe(obj.id);
      expectPositiveInt(grows.days, `${obj.id}.grows.days`);
      expectPositiveInt(grows.stages, `${obj.id}.grows.stages`);
      expect(obj.forage ?? obj.deposit, `${obj.id} forages or is a Deposit`).toBeUndefined();
    }
  });

  it('what a building plants is something growing, on terrain that exists', () => {
    for (const b of Object.values(buildings)) {
      if (!b.plants) continue;
      expect(mapObjects[b.plants.object].grows, `${b.id} plants ${b.plants.object}`).toBeDefined();
      expect(terrain, `${b.id}.plants.on`).toHaveProperty(b.plants.on);
      expectPositiveInt(b.plants.spacing, `${b.id}.plants.spacing`);
      expectPositiveInt(b.plants.plantTicks, `${b.id}.plants.plantTicks`);
      expect(b.workRadius, `${b.id} plants without a radius`).toBeDefined();
    }
  });

  it('terrain walks at a positive speed, or at 0 where nobody walks', () => {
    for (const t of Object.values(terrain)) {
      if (t.walkable) expectPositiveInt(t.speedPercent, `${t.id}.speedPercent`);
      else expect(t.speedPercent, `${t.id}.speedPercent`).toBe(0);
      // Building needs somewhere to stand.
      if (t.buildable) expect(t.walkable, `${t.id} buildable but not walkable`).toBe(true);
    }
  });

  it('map objects walked through slow walkers by a whole percent from 1 to 100', () => {
    for (const obj of Object.values(mapObjects)) {
      if (obj.walkSpeedPercent === undefined) continue;
      expectPositiveInt(obj.walkSpeedPercent, `${obj.id}.walkSpeedPercent`);
      expect(obj.walkSpeedPercent, `${obj.id}.walkSpeedPercent`).toBeLessThanOrEqual(100);
      // Something growing is walked over at full speed already.
      expect(obj.grows, `${obj.id} grows and slows`).toBeUndefined();
    }
  });

  it('Deposits hold a Stockpile good and stand on terrain that exists', () => {
    const deposits = Object.values(mapObjects).filter((obj) => obj.deposit);
    expect(deposits.map((d) => d.id).sort()).toEqual([
      'clay_deposit',
      'iron_deposit',
      'stone_deposit',
    ]);
    for (const obj of deposits) {
      const { deposit } = obj;
      if (!deposit) continue;
      expect(resources[obj.resource].storage, `${obj.id} holds Food`).toBe('stockpile');
      expect(obj.forage, `${obj.id} forages`).toBeUndefined();
      expect(terrain, `${obj.id}.deposit.terrain`).toHaveProperty(deposit.terrain);
      // A riverbank is walkable ground by the river; a face is the edge of ground nobody walks on.
      if (deposit.edge === 'riverbank') expect(terrain[deposit.terrain].walkable).toBe(true);
      if (deposit.edge === 'face') expect(terrain[deposit.terrain].walkable).toBe(false);
    }
    expect(mapObjects.stone_deposit.deposit).toEqual({ terrain: 'rock' });
    expect(mapObjects.clay_deposit.deposit).toEqual({ terrain: 'meadow', edge: 'riverbank' });
    expect(mapObjects.iron_deposit.deposit).toEqual({ terrain: 'mountain', edge: 'face' });
  });

  it('groundwork is a 1×1 construction that changes terrain that exists into what exists', () => {
    for (const b of Object.values(buildings)) {
      const { groundwork } = b;
      if (!groundwork) continue;
      expect(b.size, `${b.id}.size`).toEqual({ w: 1, h: 1 });
      expect(b.door, `${b.id}.door`).toEqual({ x: 0, y: 0 });
      expect(b.employs, `${b.id}.employs`).toEqual([]);
      expect(b.construction, `${b.id}.construction`).toBeDefined();
      expect(terrain, `${b.id}.groundwork.on`).toHaveProperty(groundwork.on);
      if ('terrain' in groundwork.becomes) {
        expect(terrain, `${b.id} becomes`).toHaveProperty(groundwork.becomes.terrain);
      } else {
        expect(roads, `${b.id} becomes`).toHaveProperty(groundwork.becomes.road);
      }
    }
    for (const t of Object.values(terrain)) {
      if (t.heroSpeedPercent !== undefined) {
        expectPositiveInt(t.heroSpeedPercent, `${t.id}.heroSpeedPercent`);
        expect(t.walkable, `${t.id} waded by the Hero alone`).toBe(false);
      }
    }
  });

  it('jobs use positive integers', () => {
    for (const job of Object.values(jobs)) {
      expectPositiveInt(job.walkSpeed, `${job.id}.walkSpeed`);
      expectPositiveInt(job.carryCapacity, `${job.id}.carryCapacity`);
      expectPositiveInt(job.idleRetryTicks, `${job.id}.idleRetryTicks`);
    }
  });

  it('heroes use positive integers', () => {
    for (const hero of Object.values(heroes)) {
      expectPositiveInt(hero.walkSpeed, `${hero.id}.walkSpeed`);
      expectPositiveInt(hero.carryCapacity, `${hero.id}.carryCapacity`);
      expectPositiveInt(hero.aura.radiusTiles, `${hero.id}.aura.radiusTiles`);
      expectPositiveInt(hero.aura.speedPercent, `${hero.id}.aura.speedPercent`);
    }
  });

  it('roads use positive integer speeds', () => {
    for (const road of Object.values(roads)) {
      expectPositiveInt(road.speedPercent, `${road.id}.speedPercent`);
    }
  });

  it('logistics numbers are positive integers', () => {
    expectPositiveInt(content.logistics.stockpileTileCapacity, 'stockpileTileCapacity');
    expectPositiveInt(content.logistics.yardCapacity, 'yardCapacity');
  });

  it('the calendar has whole-tick days with a night shorter than the day', () => {
    const { dayTicks, daysPerSeason, seasons } = content.calendar;
    expectPositiveInt(dayTicks, 'dayTicks');
    expectPositiveInt(daysPerSeason, 'daysPerSeason');
    // Typed as a Record so a new SeasonId must be added here too.
    const every: Record<SeasonId, true> = {
      spring: true,
      summer: true,
      autumn: true,
      winter: true,
    };
    expect(seasons.map((s) => s.id).sort()).toEqual(Object.keys(every).sort());
    for (const season of seasons) {
      expectPositiveInt(season.nightTicks, `${season.id}.nightTicks`);
      expect(season.nightTicks < dayTicks, `${season.id} night shorter than the day`).toBe(true);
    }
  });

  it('needs use percents from 1 to 100', () => {
    const { tired, hungry, cold } = content.needs;
    for (const [label, value] of [
      ['tired.minSleepPercent', tired.minSleepPercent],
      ['tired.speedPercent', tired.speedPercent],
      ['hungry.speedPercent', hungry.speedPercent],
      ['cold.speedPercent', cold.speedPercent],
    ] as const) {
      expectPositiveInt(value, label);
      expect(value <= 100, `${label} = ${value}`).toBe(true);
    }
  });

  it('Meals and starving use positive integers', () => {
    const { hungry } = content.needs;
    expectPositiveInt(hungry.mealUnits, 'hungry.mealUnits');
    expectPositiveInt(hungry.starveAfterMissedMeals, 'hungry.starveAfterMissedMeals');
  });

  it('warmth burns an existing, non-Food resource from whole-number buffers in real seasons', () => {
    const { cold } = content.needs;
    expect(content.resources, 'cold.fuel').toHaveProperty(cold.fuel);
    expect(content.resources[cold.fuel].storage, 'cold.fuel is not Food').not.toBe('granary');
    expectPositiveInt(cold.houseBuffer, 'cold.houseBuffer');
    expectPositiveInt(cold.burnPerNight, 'cold.burnPerNight');
    expect(cold.burnPerNight <= cold.houseBuffer, 'a House can hold a night of fuel').toBe(true);
    expectPositiveInt(cold.freezeAfterColdNights, 'cold.freezeAfterColdNights');
    const seasons = content.calendar.seasons.map((s) => s.id);
    for (const id of [...cold.stockUpSeasons, ...cold.coldSeasons]) expect(seasons).toContain(id);
    // Houses must be asking for fuel whenever they burn it.
    for (const id of cold.coldSeasons) expect(cold.stockUpSeasons).toContain(id);
  });

  it('immigration asks for a whole number of Meals and closes in real seasons', () => {
    const { mealsPerHead, closedSeasons } = content.immigration;
    expectPositiveInt(mealsPerHead, 'immigration.mealsPerHead');
    const seasons = content.calendar.seasons.map((s) => s.id);
    for (const id of closedSeasons) expect(seasons).toContain(id);
  });

  it('houses hold a positive whole number of residents', () => {
    for (const b of Object.values(buildings)) {
      if (b.residents !== undefined) expectPositiveInt(b.residents, `${b.id}.residents`);
    }
  });

  it('lights burn an existing, non-Food fuel they can hold, over a whole-tile radius', () => {
    for (const b of Object.values(buildings)) {
      if (!b.light) continue;
      const { radiusTiles, fuel, burnPerNight, holds } = b.light;
      expect(resources, `${b.id}.light.fuel`).toHaveProperty(fuel);
      expect(resources[fuel].storage, `${b.id} burns Food`).not.toBe('granary');
      expectPositiveInt(radiusTiles, `${b.id}.light.radiusTiles`);
      expectPositiveInt(burnPerNight, `${b.id}.light.burnPerNight`);
      expectPositiveInt(holds, `${b.id}.light.holds`);
      expect(holds, `${b.id} holds a night's fuel`).toBeGreaterThanOrEqual(burnPerNight);
    }
  });

  it('granaries hold a positive whole number of Food, and some Food is stored in them', () => {
    for (const b of Object.values(buildings)) {
      if (b.foodCapacity !== undefined) expectPositiveInt(b.foodCapacity, `${b.id}.foodCapacity`);
    }
    const food = Object.values(resources).filter((r) => r.storage === 'granary');
    expect(food.length).toBeGreaterThan(0);
  });

  it('Food and seasons spoil at whole percents from 0 to 100', () => {
    const percents = [
      ...Object.values(resources).flatMap((r) =>
        r.storage === 'granary' ? [[`${r.id}.spoilPercent`, r.spoilPercent] as const] : [],
      ),
      ...content.calendar.seasons.map((s) => [`${s.id}.spoilPercent`, s.spoilPercent] as const),
    ];
    for (const [label, value] of percents) {
      expect(Number.isInteger(value) && value >= 0 && value <= 100, `${label} = ${value}`).toBe(
        true,
      );
    }
  });

  it('has at least 60 distinct, non-empty villager names', () => {
    const names = content.villagerNames;
    expect(names.length).toBeGreaterThanOrEqual(60);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name.trim()).toBe(name);
    for (const name of names) expect(name).not.toBe('');
  });

  it('buildings reference existing ids', () => {
    for (const b of Object.values(buildings)) {
      for (const slot of b.employs) {
        expect(jobs, `${b.id} employs`).toHaveProperty(slot.job);
        expectPositiveInt(slot.count, `${b.id}.employs.${slot.job}`);
      }
      for (const obj of b.gathers ?? []) {
        expect(mapObjects, `${b.id}.gathers`).toHaveProperty(obj);
      }
      for (const obj of b.digs ?? []) {
        expect(mapObjects, `${b.id}.digs`).toHaveProperty(obj);
      }
      if (b.workRadius !== undefined) expectPositiveInt(b.workRadius, `${b.id}.workRadius`);
      for (const resource of b.outputBuffer?.resources ?? []) {
        expect(resources, `${b.id}.outputBuffer`).toHaveProperty(resource);
      }
      for (const cost of b.construction?.cost ?? []) {
        expect(resources, `${b.id} cost`).toHaveProperty(cost.resource);
        expectPositiveInt(cost.amount, `${b.id} cost ${cost.resource}`);
      }
    }
  });

  it('recipes reference existing resources and use positive integers', () => {
    for (const recipe of Object.values(recipes)) {
      expectPositiveInt(recipe.workTicks, `${recipe.id}.workTicks`);
      expect(recipe.outputs.length, `${recipe.id} has outputs`).toBeGreaterThan(0);
      for (const side of [recipe.inputs, recipe.outputs]) {
        for (const r of side) {
          expect(resources, `${recipe.id} uses`).toHaveProperty(r.resource);
          expectPositiveInt(r.amount, `${recipe.id} ${r.resource}`);
        }
      }
    }
  });

  it('workshops reference existing recipes and have buffers that hold a batch', () => {
    for (const b of Object.values(buildings)) {
      for (const slot of b.inputBuffer ?? []) {
        expect(resources, `${b.id}.inputBuffer`).toHaveProperty(slot.resource);
        expectPositiveInt(slot.capacity, `${b.id}.inputBuffer.${slot.resource}`);
      }
      if (b.stockTarget) {
        expect(resources, `${b.id}.stockTarget`).toHaveProperty(b.stockTarget.resource);
        expectPositiveInt(b.stockTarget.amount, `${b.id}.stockTarget.amount`);
      }
      if (b.recipes === undefined) continue;
      expect(b.employs.length, `${b.id} employs someone`).toBeGreaterThan(0);
      for (const id of b.recipes) {
        expect(recipes, `${b.id}.recipes`).toHaveProperty(id);
        for (const input of recipes[id].inputs) {
          const slot = b.inputBuffer?.find((s) => s.resource === input.resource);
          expect(
            slot?.capacity ?? 0,
            `${b.id} holds ${id}'s ${input.resource}`,
          ).toBeGreaterThanOrEqual(input.amount);
        }
        for (const output of recipes[id].outputs) {
          expect(b.outputBuffer?.resources, `${b.id} holds ${id}'s output`).toContain(
            output.resource,
          );
        }
        const batch = recipes[id].outputs.reduce((sum, o) => sum + o.amount, 0);
        expect(batch, `${b.id}'s yard holds a batch of ${id}`).toBeLessThanOrEqual(
          content.logistics.yardCapacity,
        );
      }
    }
  });

  it('buildings have a sane footprint and a door outside it', () => {
    for (const b of Object.values(buildings)) {
      expectPositiveInt(b.size.w, `${b.id}.size.w`);
      expectPositiveInt(b.size.h, `${b.id}.size.h`);
      if (b.wall || b.groundwork) continue; // walls and groundwork: see below
      const { x, y } = b.door;
      const inside = x >= 0 && x < b.size.w && y >= 0 && y < b.size.h;
      expect(inside, `${b.id} door inside footprint`).toBe(false);
      // The door must touch the footprint, including diagonally.
      const touches = x >= -1 && x <= b.size.w && y >= -1 && y <= b.size.h;
      expect(touches, `${b.id} door not adjacent`).toBe(true);
    }
  });

  it('a Workplace with an output has a yard: a tile touching its side, beside the door', () => {
    for (const b of Object.values(buildings)) {
      if (!b.outputBuffer) continue;
      expect(b.outputBuffer.resources.length, `${b.id} makes something`).toBeGreaterThan(0);
      expect(b.employs.length, `${b.id} employs someone`).toBeGreaterThan(0);
      const { x, y } = b.outputBuffer.yard;
      const { w, h } = b.size;
      // Outside the body, sharing a side with it (not only a corner), and not the door.
      const dx = Math.max(0, -x, x - (w - 1));
      const dy = Math.max(0, -y, y - (h - 1));
      expect(dx + dy, `${b.id} yard beside the building`).toBe(1);
      expect({ x, y }, `${b.id} yard not the door`).not.toEqual(b.door);
      // Next to the door tile, including diagonally.
      const nearDoor = Math.max(Math.abs(x - b.door.x), Math.abs(y - b.door.y)) === 1;
      expect(nearDoor, `${b.id} yard beside the door`).toBe(true);
    }
  });

  it('walls are single tiles whose door is their own tile, with HP', () => {
    for (const b of Object.values(buildings)) {
      if (!b.wall) continue;
      expect(b.size, `${b.id}.size`).toEqual({ w: 1, h: 1 });
      expect(b.door, `${b.id}.door`).toEqual({ x: 0, y: 0 });
      expectPositiveInt(b.wall.hp, `${b.id}.wall.hp`);
      expect(b.employs, `${b.id}.employs`).toEqual([]);
    }
  });

  it('placeable buildings can be constructed', () => {
    for (const b of Object.values(buildings)) {
      if (!b.placeable) continue;
      expect(b.construction, `${b.id}.construction`).toBeDefined();
      expectPositiveInt(b.construction?.buildTicks ?? 0, `${b.id}.buildTicks`);
    }
  });

  it('a gathering building has somewhere to put what it gathers', () => {
    for (const b of Object.values(buildings)) {
      for (const obj of [...(b.gathers ?? []), ...(b.digs ?? [])]) {
        const resource = mapObjects[obj].resource;
        expect(b.outputBuffer?.resources, `${b.id} holds ${resource}`).toContain(resource);
        expect(mapObjects[obj].yieldPerGather, `${b.id}'s yard holds a gather`).toBeLessThanOrEqual(
          content.logistics.yardCapacity,
        );
      }
    }
  });

  it('a fishing building fishes from a riverbank into a buffer that holds a catch', () => {
    for (const b of Object.values(buildings)) {
      if (b.fishes === undefined) continue;
      expectPositiveInt(b.fishes.catchTicks, `${b.id}.fishes.catchTicks`);
      expectPositiveInt(b.fishes.yieldPerCatch, `${b.id}.fishes.yieldPerCatch`);
      expect(b.doorOnRiverbank, `${b.id}.doorOnRiverbank`).toBe(true);
      expect(b.employs.length, `${b.id} employs someone`).toBeGreaterThan(0);
      expect(b.outputBuffer?.resources.length, `${b.id} has one output`).toBe(1);
      expect(b.fishes.yieldPerCatch, `${b.id}'s yard holds a catch`).toBeLessThanOrEqual(
        content.logistics.yardCapacity,
      );
    }
  });

  it('a hunting building has a radius and a buffer that holds a catch', () => {
    for (const b of Object.values(buildings)) {
      if (b.hunts === undefined) continue;
      expectPositiveInt(b.hunts.huntTicks, `${b.id}.hunts.huntTicks`);
      expect(b.workRadius, `${b.id}.workRadius`).toBeDefined();
      expect(b.employs.length, `${b.id} employs someone`).toBeGreaterThan(0);
      expect(b.hunts.catch.length, `${b.id} catches something`).toBeGreaterThan(0);
      for (const c of b.hunts.catch) {
        expect(resources, `${b.id}.hunts.catch`).toHaveProperty(c.resource);
        expectPositiveInt(c.amount, `${b.id}.hunts.catch.${c.resource}`);
        expect(b.outputBuffer?.resources, `${b.id} holds ${c.resource}`).toContain(c.resource);
      }
      const bag = b.hunts.catch.reduce((sum, c) => sum + c.amount, 0);
      expect(bag, `${b.id}'s yard holds a whole catch`).toBeLessThanOrEqual(
        content.logistics.yardCapacity,
      );
    }
  });

  it('hunting grounds are made of a map object and use sane percents', () => {
    const { forest, maxCatchPermille, thrivingPercent, scarcePercent } = content.hunting;
    expect(mapObjects).toHaveProperty(forest);
    expectPositiveInt(maxCatchPermille, 'hunting.maxCatchPermille');
    expect(maxCatchPermille <= 1000, 'hunting.maxCatchPermille <= 1000').toBe(true);
    expectPositiveInt(scarcePercent, 'hunting.scarcePercent');
    expect(scarcePercent < thrivingPercent, 'scarce below thriving').toBe(true);
    expect(thrivingPercent <= 100, 'hunting.thrivingPercent <= 100').toBe(true);
  });

  it('Dens use whole numbers and a budding band that can be met', () => {
    const { spawnsPerDusk, darkRingTiles, budding } = content.dens;
    for (const season of content.calendar.seasons) {
      expectNonNegativeInt(spawnsPerDusk[season.id], `dens.spawnsPerDusk.${season.id}`);
    }
    expectPositiveInt(darkRingTiles, 'dens.darkRingTiles');
    expectPositiveInt(budding.closerMin, 'dens.budding.closerMin');
    expect(budding.closerMin <= budding.closerMax, 'closerMin <= closerMax').toBe(true);
    // A bud must keep its own dark ring clear of buildings.
    expect(budding.minBuildingTiles > darkRingTiles, 'buds keep their ring clear').toBe(true);
    expectPositiveInt(budding.maxDens, 'dens.budding.maxDens');
    const { cleared } = content.dens;
    for (const { resource, amount } of cleared.cache) {
      expect(resources, 'dens.cleared.cache').toHaveProperty(resource);
      expectPositiveInt(amount, `dens.cleared.cache ${resource}`);
    }
    expectPositiveInt(cleared.calmTiles, 'dens.cleared.calmTiles');
    expectPositiveInt(cleared.calmDays, 'dens.cleared.calmDays');
  });

  it('the Valley uses whole numbers, ranges that can be met, and enough names', () => {
    const { valley } = content;
    const ranges = [
      valley.rim.thickness,
      valley.entry.alongPercent,
      valley.river.fords,
      valley.sideValley.wallThickness,
      valley.swamp.patches,
      valley.swamp.radiusTiles,
      valley.pois.shrineAlongPercent,
    ];
    for (const range of ranges) {
      expectPositiveInt(range.min, 'valley range min');
      expect(range.min <= range.max, `valley range ${range.min}–${range.max}`).toBe(true);
    }
    const numbers = [
      valley.size,
      valley.attempts,
      valley.rim.cellTiles,
      valley.entry.gapTiles,
      valley.entry.nearThickness,
      valley.camp.entryTiles,
      valley.camp.carriers,
      ...Object.values(valley.guarantees).flatMap((g) =>
        typeof g === 'number' ? [g] : Object.values(g),
      ),
      ...Object.values(valley.river).filter((n) => typeof n === 'number'),
      valley.sideValley.widthTiles,
      valley.sideValley.heightTiles,
      valley.sideValley.passWidthTiles,
      ...Object.values(valley.forest),
      ...Object.values(valley.rock),
      ...Object.values(valley.deposits),
      ...Object.values(valley.dens),
      ...Object.values(valley.pois).filter((n) => typeof n === 'number'),
      valley.huntingGrounds.maxTiles,
      valley.huntingGrounds.minTiles,
      valley.huntingGrounds.treesPerGame,
    ];
    for (const n of numbers) expectPositiveInt(n as number, 'valley number');
    const { forest } = valley;
    expect(forest.foragePercent + Math.max(forest.treePercent, forest.campTreePercent) <= 100).toBe(
      true,
    );
    expect(valley.dens.sideValley <= valley.dens.count, 'Side valley Dens').toBe(true);
    const { pois } = valley;
    expect(pois.shrineAlongPercent.max <= 100, 'Shrine along the way').toBe(true);
    // Stamps never overlap: their cleared squares stay apart.
    expect(pois.spacingTiles > 2 * pois.clearTiles, 'POI stamps apart').toBe(true);
    expect(valley.huntingGrounds.minTiles <= valley.huntingGrounds.maxTiles).toBe(true);
    for (const { resource, amount } of [
      ...valley.camp.granaryStock,
      ...valley.camp.stockpileGoods,
    ]) {
      expect(resources, 'valley.camp').toHaveProperty(resource);
      expectPositiveInt(amount, `valley.camp ${resource}`);
    }
    const names = valley.huntingGrounds.names;
    expect(new Set(names).size, 'distinct Hunting ground names').toBe(names.length);
    expect(names.every((name) => name.trim() === name && name.length > 0)).toBe(true);
  });

  it('points of interest search for real goods and ward with whole tiles', () => {
    for (const [key, poi] of Object.entries(content.pois)) {
      expect(poi.id).toBe(key);
      if (poi.search) {
        expectPositiveInt(poi.search.ticks, `${poi.id}.search.ticks`);
        expectNonNegativeInt(poi.search.spreadPercent, `${poi.id}.search.spreadPercent`);
        expect(poi.search.spreadPercent < 100, `${poi.id} can find nothing`).toBe(true);
        expect(poi.search.cache.length).toBeGreaterThan(0);
        for (const { resource, amount } of poi.search.cache) {
          expect(resources, `${poi.id}.search.cache`).toHaveProperty(resource);
          expectPositiveInt(amount, `${poi.id}.search.cache ${resource}`);
        }
      }
      if (poi.wardTiles !== undefined) expectPositiveInt(poi.wardTiles, `${poi.id}.wardTiles`);
    }
  });

  it('fighters use positive whole numbers', () => {
    const { gloamling, villager, hero, den } = content.combat;
    for (const [name, f] of Object.entries({ gloamling, villager, hero, den })) {
      for (const key of ['hp', 'damage', 'cooldownTicks', 'reachTiles'] as const) {
        expectPositiveInt(f[key], `combat.${name}.${key}`);
      }
    }
    expectPositiveInt(gloamling.walkSpeed, 'combat.gloamling.walkSpeed');
    expectPositiveInt(gloamling.sightTiles, 'combat.gloamling.sightTiles');
  });

  it('every resource has a known store', () => {
    for (const r of Object.values(resources)) {
      expect(['stockpile', 'granary'], `${r.id}.storage`).toContain(r.storage);
    }
  });
});
