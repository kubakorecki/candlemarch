import { describe, expect, it } from 'vitest';
import { TOOLS } from '../src/game/tools';
import { BUILD_CATEGORIES, categoryOf } from '../src/ui/buildCategories';

describe('build categories', () => {
  it('lists every tool but Demolish in exactly one category', () => {
    const listed = BUILD_CATEGORIES.flatMap((c) => c.tools);
    const tools = TOOLS.map((t) => t.id).filter((id) => id !== 'demolish');
    expect([...listed].sort()).toEqual([...tools].sort());
  });

  it('finds the category a tool is in, and none for Demolish', () => {
    expect(categoryOf('woodcutters_hut')).toBe('gathering');
    expect(categoryOf('stockpile')).toBe('roads');
    expect(categoryOf('demolish')).toBeNull();
  });
});
