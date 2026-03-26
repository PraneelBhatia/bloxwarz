import { describe, it, expect } from 'vitest';
import { solveLevelCoOp } from '../solver.js';
import { BlockOrientation, LevelData, TileType } from '../types.js';
import { level01 } from '../levels/level-01.js';

// Helpers
function makeGrid(width: number, height: number, fill: TileType = TileType.Stone): TileType[][] {
  return Array.from({ length: height }, () => Array(width).fill(fill));
}

describe('solveLevelCoOp', () => {
  it('finds solution for Level 1 in 12 moves', () => {
    const result = solveLevelCoOp(level01);

    expect(result.solvable).toBe(true);
    expect(result.moveCount).toBe(12);
    expect(result.solution).toHaveLength(12);

    // Each move must have valid player and direction
    for (const move of result.solution) {
      expect(['fire', 'water']).toContain(move.player);
      expect(['north', 'south', 'east', 'west']).toContain(move.direction);
    }
  });

  it('rejects unsolvable grid (exits unreachable)', () => {
    // 3x3 grid: fire and water start on opposite corners,
    // exits in the middle, but a gap makes them unreachable.
    const EF = TileType.ExitFire;
    const EW = TileType.ExitWater;
    const S = TileType.Stone;
    const _ = TileType.Empty;

    const level: LevelData = {
      id: 999,
      name: 'Unsolvable',
      width: 5,
      height: 3,
      tiles: [
        /* y=0 */ [S, _, _, _, S],
        /* y=1 */ [_, _, _, _, _],
        /* y=2 */ [EF, _, _, _, EW],
      ],
      switchEffects: {},
      fireStart: { position: { x: 0, y: 0 }, orientation: BlockOrientation.Standing },
      waterStart: { position: { x: 4, y: 0 }, orientation: BlockOrientation.Standing },
    };

    const result = solveLevelCoOp(level);
    expect(result.solvable).toBe(false);
    expect(result.moveCount).toBe(0);
    expect(result.solution).toEqual([]);
  });

  it('handles independent paths (no interaction needed)', () => {
    // Two straight columns: fire goes up left, water goes up right
    const EF = TileType.ExitFire;
    const EW = TileType.ExitWater;
    const S = TileType.Stone;
    const _ = TileType.Empty;

    const level: LevelData = {
      id: 998,
      name: 'Independent Paths',
      width: 5,
      height: 4,
      tiles: [
        /* y=0 */ [S, _, _, _, S],
        /* y=1 */ [S, _, _, _, S],
        /* y=2 */ [S, _, _, _, S],
        /* y=3 */ [EF, _, _, _, EW],
      ],
      switchEffects: {},
      fireStart: { position: { x: 0, y: 0 }, orientation: BlockOrientation.Standing },
      waterStart: { position: { x: 4, y: 0 }, orientation: BlockOrientation.Standing },
    };

    const result = solveLevelCoOp(level);
    expect(result.solvable).toBe(true);
    // Each block: Standing N -> LyingY N -> Standing (2 moves each = 4 total minimum,
    // but they must reach y=3 from y=0 which is 3 tiles up)
    // Standing(0,0) N -> LyingY(0,1) N -> Standing(0,3)=EF  (2 moves)
    // Standing(4,0) N -> LyingY(4,1) N -> Standing(4,3)=EW  (2 moves)
    // Total = 4 moves (BFS optimal)
    expect(result.moveCount).toBe(4);
  });

  it('solves when one block starts on its exit', () => {
    // Fire starts on ExitFire, only water needs to move
    const EF = TileType.ExitFire;
    const EW = TileType.ExitWater;
    const S = TileType.Stone;
    const _ = TileType.Empty;

    const level: LevelData = {
      id: 997,
      name: 'One Already There',
      width: 5,
      height: 4,
      tiles: [
        /* y=0 */ [EF, _, _, _, S],
        /* y=1 */ [_, _, _, _, S],
        /* y=2 */ [_, _, _, _, S],
        /* y=3 */ [_, _, _, _, EW],
      ],
      switchEffects: {},
      fireStart: { position: { x: 0, y: 0 }, orientation: BlockOrientation.Standing },
      waterStart: { position: { x: 4, y: 0 }, orientation: BlockOrientation.Standing },
    };

    const result = solveLevelCoOp(level);
    expect(result.solvable).toBe(true);
    // Water: Standing(4,0) N -> LyingY(4,1) N -> Standing(4,3)=EW  (2 moves)
    // Fire doesn't need to move (already on exit and standing)
    expect(result.moveCount).toBe(2);
    // All moves should be water moves
    for (const move of result.solution) {
      expect(move.player).toBe('water');
    }
  });
});
