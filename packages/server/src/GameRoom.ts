import { Room, Client } from '@colyseus/core';
import {
  Direction,
  Element,
  BlockOrientation,
  TileType,
  type BlockState,
  type LevelData,
  computeRoll,
  getFootprint,
  checkHazard,
  getFootprintTiles,
  activateSwitch,
  checkWinCondition,
  getLevel,
} from '@fbwb/shared';
import { GameStateSchema, BlockSchema, PlayerSchema, PositionSchema } from './GameState.js';
import { generateRoomCode, removeRoomCode } from './roomCodes.js';

export class GameRoom extends Room<GameStateSchema> {
  maxClients = 2;

  private currentTiles: TileType[][] = [];
  private currentLevel: LevelData | undefined;

  onCreate() {
    const state = new GameStateSchema();
    this.setState(state);

    const code = generateRoomCode(this.roomId);
    state.roomCode = code;

    this.onMessage('move', (client, data: { direction: string }) => {
      this.handleMove(client, data.direction as Direction);
    });

    this.onMessage('restart', () => {
      if (this.state.levelId > 0) {
        this.loadLevel(this.state.levelId);
      }
    });

    this.onMessage('selectLevel', (_client, data: { levelId: number }) => {
      this.loadLevel(data.levelId);
    });
  }

  onJoin(client: Client) {
    const player = new PlayerSchema();
    player.sessionId = client.sessionId;
    player.connected = true;

    if (this.state.players.length === 0) {
      player.assignedElement = Element.Fire;
    } else {
      player.assignedElement = Element.Water;
    }

    this.state.players.push(player);

    // When both players have joined, load level 1
    if (this.state.players.length === 2) {
      this.loadLevel(1);
    }
  }

  handleMove(client: Client, direction: Direction) {
    // Find which element this client controls
    const player = this.state.players.find((p) => p.sessionId === client.sessionId);
    if (!player) return;

    const element = player.assignedElement as Element;
    const blockSchema = element === Element.Fire ? this.state.fireBlock : this.state.waterBlock;

    // Skip if block is dead or game is not playing
    if (!blockSchema.alive || this.state.phase !== 'playing') return;

    // Build a BlockState from the schema for shared logic
    const blockState: BlockState = {
      position: { x: blockSchema.position.x, y: blockSchema.position.y },
      orientation: blockSchema.orientation as BlockOrientation,
      element,
      alive: blockSchema.alive,
    };

    // Compute the roll
    const rolled = computeRoll(blockState.position, blockState.orientation, direction);

    // Check bounds and empty tiles
    const rolledBlock: BlockState = {
      ...blockState,
      position: rolled.position,
      orientation: rolled.orientation,
    };
    const footprint = getFootprint(rolledBlock);
    const height = this.currentTiles.length;
    const width = this.currentTiles[0]?.length ?? 0;

    for (const cell of footprint) {
      if (cell.x < 0 || cell.y < 0 || cell.x >= width || cell.y >= height) {
        return; // Out of bounds — reject
      }
      if (this.currentTiles[cell.y][cell.x] === TileType.Empty) {
        return; // Empty tile — reject
      }
    }

    // Apply move to schema state
    blockSchema.position.x = rolled.position.x;
    blockSchema.position.y = rolled.position.y;
    blockSchema.orientation = rolled.orientation;

    // Increment move count
    this.state.moveCount++;

    // Check hazard
    const updatedBlock: BlockState = {
      ...blockState,
      position: rolled.position,
      orientation: rolled.orientation,
    };
    const fpTiles = getFootprintTiles(updatedBlock, this.currentTiles);
    if (checkHazard(updatedBlock, fpTiles)) {
      blockSchema.alive = false;
    }

    // Check for switches
    for (const cell of footprint) {
      const key = `${cell.x},${cell.y}`;
      if (this.currentLevel?.switchEffects[key]) {
        const tileAtCell = this.currentTiles[cell.y][cell.x];
        const isMatchingSwitch =
          (element === Element.Fire && tileAtCell === TileType.SwitchFire) ||
          (element === Element.Water && tileAtCell === TileType.SwitchWater);

        if (isMatchingSwitch) {
          this.currentTiles = activateSwitch(this.currentTiles, this.currentLevel.switchEffects[key]);
          this.state.tilesJson = JSON.stringify(this.currentTiles);
        }
      }
    }

    // Check win condition
    const fireBlock = this.buildBlockState(this.state.fireBlock, Element.Fire);
    const waterBlock = this.buildBlockState(this.state.waterBlock, Element.Water);
    if (checkWinCondition(fireBlock, waterBlock, this.currentTiles)) {
      this.state.phase = 'completed';
    }
  }

  async onLeave(client: Client, consented: boolean) {
    const player = this.state.players.find((p) => p.sessionId === client.sessionId);
    if (player) {
      player.connected = false;
    }

    if (!consented) {
      try {
        await this.allowReconnection(client, 30);
        // Client reconnected
        if (player) {
          player.connected = true;
        }
      } catch {
        // Reconnection timed out — player is gone
      }
    }
  }

  onDispose() {
    removeRoomCode(this.state.roomCode);
  }

  loadLevel(levelId: number) {
    const level = getLevel(levelId);
    if (!level) return;

    this.currentLevel = level;
    this.currentTiles = level.tiles.map((row: TileType[]) => [...row]);

    this.state.levelId = levelId;
    this.state.phase = 'playing';
    this.state.moveCount = 0;
    this.state.tilesJson = JSON.stringify(this.currentTiles);

    // Set fire block
    this.applyBlockStart(this.state.fireBlock, level.fireStart, Element.Fire);
    // Set water block
    this.applyBlockStart(this.state.waterBlock, level.waterStart, Element.Water);
  }

  private applyBlockStart(
    block: BlockSchema,
    start: { position: { x: number; y: number }; orientation: BlockOrientation },
    element: Element,
  ) {
    block.position.x = start.position.x;
    block.position.y = start.position.y;
    block.orientation = start.orientation;
    block.element = element;
    block.alive = true;
  }

  private buildBlockState(block: BlockSchema, element: Element): BlockState {
    return {
      position: { x: block.position.x, y: block.position.y },
      orientation: block.orientation as BlockOrientation,
      element,
      alive: block.alive,
    };
  }
}
