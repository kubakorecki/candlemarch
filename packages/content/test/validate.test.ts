import { describe, expect, it } from 'vitest';
import { content } from '../src/index';

const { resources, terrain, mapObjects, jobs, buildings, heroes, roads } = content;

function expectPositiveInt(value: number, label: string): void {
  expect(Number.isInteger(value) && value > 0, `${label} = ${value}`).toBe(true);
}

describe('content validation', () => {
  it('every record key matches its id', () => {
    for (const table of [resources, terrain, mapObjects, jobs, buildings, heroes, roads]) {
      for (const [key, def] of Object.entries(table)) {
        expect(def.id).toBe(key);
      }
    }
  });

  it('map objects reference existing resources and use positive integers', () => {
    for (const obj of Object.values(mapObjects)) {
      expect(resources).toHaveProperty(obj.resource);
      expectPositiveInt(obj.amount, `${obj.id}.amount`);
      expectPositiveInt(obj.gatherTicks, `${obj.id}.gatherTicks`);
      expectPositiveInt(obj.yieldPerGather, `${obj.id}.yieldPerGather`);
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

  it('buildings reference existing ids', () => {
    for (const b of Object.values(buildings)) {
      for (const slot of b.employs) {
        expect(jobs, `${b.id} employs`).toHaveProperty(slot.job);
        expectPositiveInt(slot.count, `${b.id}.employs.${slot.job}`);
      }
      if (b.gathers !== undefined) {
        expect(mapObjects, `${b.id}.gathers`).toHaveProperty(b.gathers);
      }
      if (b.outputBuffer) {
        expect(resources, `${b.id}.outputBuffer`).toHaveProperty(b.outputBuffer.resource);
        expectPositiveInt(b.outputBuffer.capacity, `${b.id}.outputBuffer.capacity`);
      }
      for (const cost of b.construction?.cost ?? []) {
        expect(resources, `${b.id} cost`).toHaveProperty(cost.resource);
        expectPositiveInt(cost.amount, `${b.id} cost ${cost.resource}`);
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
      if (b.gathers === undefined) continue;
      expect(b.outputBuffer?.resource).toBe(mapObjects[b.gathers].resource);
    }
  });
});
