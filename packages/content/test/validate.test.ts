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
      if (b.workRadius !== undefined) expectPositiveInt(b.workRadius, `${b.id}.workRadius`);
      for (const slot of b.outputBuffer ?? []) {
        expect(resources, `${b.id}.outputBuffer`).toHaveProperty(slot.resource);
        expectPositiveInt(slot.capacity, `${b.id}.outputBuffer.${slot.resource}`);
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
          const slot = b.outputBuffer?.find((s) => s.resource === output.resource);
          expect(slot?.capacity ?? 0, `${b.id} holds ${id}'s output`).toBeGreaterThanOrEqual(
            output.amount,
          );
        }
      }
    }
  });

  it('buildings have a sane footprint and a door outside it', () => {
    for (const b of Object.values(buildings)) {
      expectPositiveInt(b.size.w, `${b.id}.size.w`);
      expectPositiveInt(b.size.h, `${b.id}.size.h`);
      if (b.wall) continue; // walls: see below
      const { x, y } = b.door;
      const inside = x >= 0 && x < b.size.w && y >= 0 && y < b.size.h;
      expect(inside, `${b.id} door inside footprint`).toBe(false);
      // The door must touch the footprint, including diagonally.
      const touches = x >= -1 && x <= b.size.w && y >= -1 && y <= b.size.h;
      expect(touches, `${b.id} door not adjacent`).toBe(true);
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
      for (const obj of b.gathers ?? []) {
        const resource = mapObjects[obj].resource;
        const slot = b.outputBuffer?.find((s) => s.resource === resource);
        expect(slot?.capacity ?? 0, `${b.id} holds ${resource}`).toBeGreaterThanOrEqual(
          mapObjects[obj].yieldPerGather,
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
      expect(b.outputBuffer?.length, `${b.id} has one output`).toBe(1);
      expect(b.outputBuffer?.[0]?.capacity ?? 0, `${b.id} holds a catch`).toBeGreaterThanOrEqual(
        b.fishes.yieldPerCatch,
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
        const slot = b.outputBuffer?.find((s) => s.resource === c.resource);
        expect(slot?.capacity ?? 0, `${b.id} holds ${c.resource}`).toBeGreaterThanOrEqual(c.amount);
      }
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
