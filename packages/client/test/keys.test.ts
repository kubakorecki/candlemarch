import { describe, expect, it } from 'vitest';
import { keyAction } from '../src/game/keys';

describe('keyboard shortcuts', () => {
  it('selects the Hero with 1', () => {
    expect(keyAction('1')).toEqual({ kind: 'hero' });
  });

  it('sets game speed with F1, F2 and F3', () => {
    expect(keyAction('F1')).toEqual({ kind: 'speed', speed: 1 });
    expect(keyAction('F2')).toEqual({ kind: 'speed', speed: 2 });
    expect(keyAction('F3')).toEqual({ kind: 'speed', speed: 3 });
  });

  it('no longer sets speed with the number keys', () => {
    expect(keyAction('2')).toBeNull();
    expect(keyAction('3')).toBeNull();
  });

  it('keeps Space for pause, Esc for cancel and letters for views, turns and tools', () => {
    expect(keyAction(' ')).toEqual({ kind: 'pause' });
    expect(keyAction('Escape')).toEqual({ kind: 'cancel' });
    expect(keyAction('V')).toEqual({ kind: 'workers' });
    expect(keyAction('t')).toEqual({ kind: 'heatMap' });
    expect(keyAction('q')).toEqual({ kind: 'turn', quarters: 3 });
    expect(keyAction('b')).toEqual({ kind: 'tool', tool: 'hut' });
    expect(keyAction('F4')).toBeNull();
  });
});
