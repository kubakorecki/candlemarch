import type { HeroDef, HeroId } from './types';

export const heroes: Record<HeroId, HeroDef> = {
  // Stands in for the Ranger and Smith-lord until the playtest settles the hero's role.
  placeholder: {
    id: 'placeholder',
    name: 'Hero',
    walkSpeed: 100, // 2 tiles per second, a little quicker than villagers
  },
};
