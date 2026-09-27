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
    const { tired, hungry } = content.needs;
    for (const [label, value] of [
      ['tired.minSleepPercent', tired.minSleepPercent],
      ['tired.speedPercent', tired.speedPercent],
      ['hungry.speedPercent', hungry.speedPercent],
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

  it('houses hold a positive whole number of residents', () => {
    for (const b of Object.values(buildings)) {
      if (b.residents !== undefined) expectPositiveInt(b.residents, `${b.id}.residents`);
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
      const { x, y } = b.door;
      const inside = x >= 0 && x < b.size.w && y >= 0 && y < b.size.h;
      expect(inside, `${b.id} door inside footprint`).toBe(false);
      // The door must touch the footprint, including diagonally.
      const touches = x >= -1 && x <= b.size.w && y >= -1 && y <= b.size.h;
      expect(touches, `${b.id} door not adjacent`).toBe(true);
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

  it('every resource has a known store', () => {
    for (const r of Object.values(resources)) {
      expect(['stockpile', 'granary'], `${r.id}.storage`).toContain(r.storage);
    }
  });
});
