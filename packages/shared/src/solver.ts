import {
  BlockOrientation,
  BlockState,
  Direction,
  Element,
  LevelData,
  TileType,
} from './types.js';
import { createBlock, getFootprint } from './block.js';
import { computeRoll } from './moves.js';
import { activateSwitch, checkHazard, checkWinCondition, getFootprintTiles } from './mechanics.js';

// ─── Public types ────────────────────────────────────────────────────────────

export interface SolverMove {
  player: 'fire' | 'water';
  direction: Direction;
}

export interface SolverResult {
  solvable: boolean;
  moveCount: number;
  solution: SolverMove[];
}

// ─── Internal state ──────────────────────────────────────────────────────────

interface BfsNode {
  fireX: number;
  fireY: number;
  fireOri: BlockOrientation;
  waterX: number;
  waterY: number;
  waterOri: BlockOrientation;
  tiles: TileType[][];
  tilesKey: string;            // cached for state-key generation
  parentIndex: number;         // index into history array (-1 for root)
  move: SolverMove | null;     // the move that led here (null for root)
}

const ALL_DIRECTIONS: Direction[] = [
  Direction.North,
  Direction.South,
  Direction.East,
  Direction.West,
];

const MAX_ITERATIONS = 5_000_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hasSwitches(level: LevelData): boolean {
  return Object.keys(level.switchEffects).length > 0;
}

/**
 * Simple string hash for tile grid — only computed when the level has switches.
 */
function hashTiles(tiles: TileType[][]): string {
  // Build a compact string from the tile values.
  // Using join is faster than JSON.stringify for 2D arrays.
  let h = '';
  for (let y = 0; y < tiles.length; y++) {
    const row = tiles[y];
    for (let x = 0; x < row.length; x++) {
      // Use first char as a cheap identifier — all TileType enum values have unique first chars
      // Actually they don't (stone/switch_fire/switch_water all start with 's').
      // Use a more precise but still compact encoding.
      h += row[x][0] + row[x][row[x].length - 1] + ',';
    }
    h += '|';
  }
  return h;
}

function stateKey(node: BfsNode, includeTiles: boolean): string {
  const base = `${node.fireX},${node.fireY},${node.fireOri},${node.waterX},${node.waterY},${node.waterOri}`;
  return includeTiles ? `${base}|${node.tilesKey}` : base;
}

/**
 * Checks whether the given footprint is in bounds and on non-empty tiles.
 */
function isFootprintValid(
  footprint: { x: number; y: number }[],
  tiles: TileType[][],
  width: number,
  height: number,
): boolean {
  for (const cell of footprint) {
    if (cell.x < 0 || cell.y < 0 || cell.x >= width || cell.y >= height) {
      return false;
    }
    if (tiles[cell.y][cell.x] === TileType.Empty) {
      return false;
    }
  }
  return true;
}

/**
 * Try moving a single block. Returns the new block state and possibly-updated tiles,
 * or null if the move is illegal (out of bounds, falls off, or block dies).
 */
function tryMove(
  block: BlockState,
  direction: Direction,
  tiles: TileType[][],
  width: number,
  height: number,
  switchEffects: LevelData['switchEffects'],
): { block: BlockState; tiles: TileType[][] } | null {
  // Compute the roll
  const rolled = computeRoll(block.position, block.orientation, direction);
  const newBlock: BlockState = {
    ...block,
    position: rolled.position,
    orientation: rolled.orientation,
  };

  // Check bounds / empty
  const footprint = getFootprint(newBlock);
  if (!isFootprintValid(footprint, tiles, width, height)) {
    return null;
  }

  // Check elemental hazards
  const fpTiles = getFootprintTiles(newBlock, tiles);
  if (checkHazard(newBlock, fpTiles)) {
    return null;
  }

  // Check if block lands on a matching switch
  let currentTiles = tiles;
  for (const cell of footprint) {
    const tileAtCell = currentTiles[cell.y][cell.x];
    const isFireSwitch = tileAtCell === TileType.SwitchFire && block.element === Element.Fire;
    const isWaterSwitch = tileAtCell === TileType.SwitchWater && block.element === Element.Water;
    if (isFireSwitch || isWaterSwitch) {
      const key = `${cell.x},${cell.y}`;
      const effect = switchEffects[key];
      if (effect) {
        currentTiles = activateSwitch(currentTiles, effect);
      }
    }
  }

  return { block: newBlock, tiles: currentTiles };
}

// ─── Main solver ─────────────────────────────────────────────────────────────

export function solveLevelCoOp(level: LevelData): SolverResult {
  const { width, height, switchEffects } = level;
  const includeTilesInKey = hasSwitches(level);

  // Initial state
  const initialTiles = level.tiles;
  const initialTilesKey = includeTilesInKey ? hashTiles(initialTiles) : '';

  const rootNode: BfsNode = {
    fireX: level.fireStart.position.x,
    fireY: level.fireStart.position.y,
    fireOri: level.fireStart.orientation,
    waterX: level.waterStart.position.x,
    waterY: level.waterStart.position.y,
    waterOri: level.waterStart.orientation,
    tiles: initialTiles,
    tilesKey: initialTilesKey,
    parentIndex: -1,
    move: null,
  };

  // Check immediate win
  const fireBlockInit = createBlock(Element.Fire, level.fireStart.position, level.fireStart.orientation);
  const waterBlockInit = createBlock(Element.Water, level.waterStart.position, level.waterStart.orientation);
  if (checkWinCondition(fireBlockInit, waterBlockInit, initialTiles)) {
    return { solvable: true, moveCount: 0, solution: [] };
  }

  // BFS queue — store full nodes for path reconstruction
  const history: BfsNode[] = [rootNode];
  const visited = new Set<string>();
  visited.add(stateKey(rootNode, includeTilesInKey));

  let head = 0;
  let iterations = 0;

  while (head < history.length && iterations < MAX_ITERATIONS) {
    iterations++;
    const current = history[head++];

    // Try all 8 possible moves: 4 directions x 2 players
    for (let p = 0; p < 2; p++) {
      const player = p === 0 ? 'fire' : 'water' as const;
      const element = p === 0 ? Element.Fire : Element.Water;

      // Build block state for the moving player
      const movingBlock: BlockState = {
        element,
        position: p === 0
          ? { x: current.fireX, y: current.fireY }
          : { x: current.waterX, y: current.waterY },
        orientation: p === 0 ? current.fireOri : current.waterOri,
        alive: true,
      };

      for (const direction of ALL_DIRECTIONS) {
        const result = tryMove(movingBlock, direction, current.tiles, width, height, switchEffects);
        if (!result) continue;

        // Build the new BFS node
        const newNode: BfsNode = {
          fireX: p === 0 ? result.block.position.x : current.fireX,
          fireY: p === 0 ? result.block.position.y : current.fireY,
          fireOri: p === 0 ? result.block.orientation : current.fireOri,
          waterX: p === 1 ? result.block.position.x : current.waterX,
          waterY: p === 1 ? result.block.position.y : current.waterY,
          waterOri: p === 1 ? result.block.orientation : current.waterOri,
          tiles: result.tiles,
          tilesKey: includeTilesInKey
            ? (result.tiles === current.tiles ? current.tilesKey : hashTiles(result.tiles))
            : '',
          parentIndex: head - 1,
          move: { player, direction },
        };

        const key = stateKey(newNode, includeTilesInKey);
        if (visited.has(key)) continue;
        visited.add(key);

        // Check win condition
        const fireCheck = createBlock(
          Element.Fire,
          { x: newNode.fireX, y: newNode.fireY },
          newNode.fireOri,
        );
        const waterCheck = createBlock(
          Element.Water,
          { x: newNode.waterX, y: newNode.waterY },
          newNode.waterOri,
        );
        if (checkWinCondition(fireCheck, waterCheck, newNode.tiles)) {
          // Reconstruct path
          const solution: SolverMove[] = [];
          let traceIndex = history.length; // the new node's index
          // Push the current new node's move first
          solution.push(newNode.move!);
          let parentIdx = newNode.parentIndex;
          while (parentIdx >= 0) {
            const ancestor = history[parentIdx];
            if (ancestor.move) {
              solution.push(ancestor.move);
            }
            parentIdx = ancestor.parentIndex;
          }
          solution.reverse();
          return { solvable: true, moveCount: solution.length, solution };
        }

        history.push(newNode);
      }
    }
  }

  return { solvable: false, moveCount: 0, solution: [] };
}
