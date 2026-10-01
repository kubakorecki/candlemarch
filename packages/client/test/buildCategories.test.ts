import { describe, expect, it } from 'vitest';
import { TOOLS, TREE_TOOLS } from '../src/game/tools';
import { BUILD_CATEGORIES, categoryOf } from '../src/ui/buildCategories';

describe('build categories', () => {
  it("lists every tool but Demolish and the woodcutter's hut's tree tools in exactly one category", () => {
    const listed = BUILD_CATEGORIES.flatMap((c) => c.tools);
    const tools = TOOLS.map((t) => t.id).filter(
      (id) => id !== 'demolish' && !TREE_TOOLS.includes(id),
    );
    expect([...listed].sort()).toEqual([...tools].sort());
  });

  it('finds the category a tool is in, and none for Demolish', () => {
    expect(categoryOf('woodcutters_hut')).toBe('gathering');
    expect(categoryOf('stockpile')).toBe('roads');
    expect(categoryOf('demolish')).toBeNull();
    expect(categoryOf('reserve')).toBeNull();
  });
});
