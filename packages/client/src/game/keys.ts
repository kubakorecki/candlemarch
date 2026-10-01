// What each keyboard shortcut does (`KeyboardEvent.key` → action). Game.onKey carries them out.
import type { Speed } from './clock';
import { TOOLS, type ToolId } from './tools';

export type KeyAction =
  | { kind: 'cancel' }
  | { kind: 'pause' }
  | { kind: 'speed'; speed: Exclude<Speed, 0> }
  | { kind: 'hero' }
  | { kind: 'workers' }
  | { kind: 'heatMap' }
  | { kind: 'turn'; quarters: 1 | 3 }
  | { kind: 'tool'; tool: ToolId };

/** Game speed keys: F1, F2 and F3 for 1×, 2× and 3×. */
const SPEED_KEYS: Record<string, Exclude<Speed, 0>> = { F1: 1, F2: 2, F3: 3 };

/**
 * The action for key `key`, or null for none. Esc cancels, Space pauses, F1–F3 set speed, 1
 * selects the Hero, V and T open views, Q and E turn the building in hand, other letters pick
 * build tools.
 */
export function keyAction(key: string): KeyAction | null {
  if (key === 'Escape') return { kind: 'cancel' };
  if (key === ' ') return { kind: 'pause' };
  const speed = SPEED_KEYS[key];
  if (speed) return { kind: 'speed', speed };
  if (key === '1') return { kind: 'hero' };
  const letter = key.toLowerCase();
  if (letter === 'v') return { kind: 'workers' };
  if (letter === 't') return { kind: 'heatMap' };
  if (letter === 'e') return { kind: 'turn', quarters: 1 };
  if (letter === 'q') return { kind: 'turn', quarters: 3 };
  const tool = TOOLS.find((t) => t.key === letter);
  return tool ? { kind: 'tool', tool: tool.id } : null;
}
