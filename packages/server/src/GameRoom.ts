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
import { GameStateSchema } from './GameState.js';
import { generateRoomCode, removeRoomCode } from './roomCodes.js';

interface PlainBlock {
  position: { x: number; y: number };
  orientation: string;
  element: string;
  alive: boolean;
}

interface PlainPlayer {
  sessionId: string;
  assignedElement: string;
  connected: boolean;
}

interface GameSettings {
  fallOffEdge: boolean;
}

interface PlainGameState {
  phase: string;
  levelId: number;
  roomCode: string;
  moveCount: number;
  tilesJson: string;
  fireBlock: PlainBlock;
  waterBlock: PlainBlock;
  player1: PlainPlayer;
  player2: PlainPlayer;
  settings: GameSettings;
}

export class GameRoom extends Room<GameStateSchema> {
  maxClients = 2;

  private currentTiles: TileType[][] = [];
  private currentLevel: LevelData | undefined;
  private playerCount = 0;

  private fallOffEdge = true; // setting: can blocks fall off edges?

  private gameState: PlainGameState = {
    phase: 'waiting',
    levelId: 0,
    roomCode: '',
    moveCount: 0,
    tilesJson: '',
    fireBlock: { position: { x: 0, y: 0 }, orientation: 'standing', element: 'fire', alive: true },
    waterBlock: { position: { x: 0, y: 0 }, orientation: 'standing', element: 'water', alive: true },
    player1: { sessionId: '', assignedElement: '', connected: false },
    player2: { sessionId: '', assignedElement: '', connected: false },
    settings: { fallOffEdge: true },
  };

  onCreate() {
    // Colyseus requires a Schema instance — keep it empty
    this.setState(new GameStateSchema());

    const code = generateRoomCode(this.roomId);
    this.gameState.roomCode = code;

    this.onMessage('move', (client, data: { direction: string }) => {
      this.handleMove(client, data.direction as Direction);
    });

    this.onMessage('restart', () => {
      if (this.gameState.levelId > 0) {
        this.loadLevel(this.gameState.levelId);
      }
    });

    this.onMessage('selectLevel', (_client, data: { levelId: number }) => {
      this.loadLevel(data.levelId);
    });

    this.onMessage('toggleFallOff', () => {
      this.fallOffEdge = !this.fallOffEdge;
      this.gameState.settings.fallOffEdge = this.fallOffEdge;
      this.broadcast('state', this.gameState);
    });
  }

  onJoin(client: Client) {
    this.playerCount++;

    if (this.playerCount === 1) {
      this.gameState.player1.sessionId = client.sessionId;
      this.gameState.player1.assignedElement = Element.Fire;
      this.gameState.player1.connected = true;
    } else {
      this.gameState.player2.sessionId = client.sessionId;
      this.gameState.player2.assignedElement = Element.Water;
      this.gameState.player2.connected = true;
    }

    // Send room code and assigned element directly to the joining client
    client.send('welcome', {
      roomCode: this.gameState.roomCode,
      element: this.playerCount === 1 ? Element.Fire : Element.Water,
    });

    // Send current state to the newly joined client
    client.send('state', this.gameState);

    // When both players have joined, load level 1
    if (this.playerCount === 2) {
      this.loadLevel(1);
    }
  }

  private getPlayer(sessionId: string): PlainPlayer | null {
    if (this.gameState.player1.sessionId === sessionId) return this.gameState.player1;
    if (this.gameState.player2.sessionId === sessionId) return this.gameState.player2;
    return null;
  }

  handleMove(client: Client, direction: Direction) {
    const player = this.getPlayer(client.sessionId);
    if (!player) return;

    const element = player.assignedElement as Element;
    const block = element === Element.Fire ? this.gameState.fireBlock : this.gameState.waterBlock;

    // Skip if block is dead or game is not playing
    if (!block.alive || this.gameState.phase !== 'playing') return;

    // Build a BlockState from the plain object for shared logic
    const blockState: BlockState = {
      position: { x: block.position.x, y: block.position.y },
      orientation: block.orientation as BlockOrientation,
      element,
      alive: block.alive,
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

    // Check if block falls off the edge (out of bounds or empty tile)
    let fellOff = false;
    for (const cell of footprint) {
      if (cell.x < 0 || cell.y < 0 || cell.x >= width || cell.y >= height) {
        fellOff = true;
        break;
      }
      if (this.currentTiles[cell.y][cell.x] === TileType.Empty) {
        fellOff = true;
        break;
      }
    }

    if (fellOff) {
      if (this.fallOffEdge) {
        // Block falls off — kill and auto-restart
        block.position.x = rolled.position.x;
        block.position.y = rolled.position.y;
        block.orientation = rolled.orientation;
        block.alive = false;
        this.gameState.moveCount++;
        this.broadcast('state', this.gameState);
        this.clock.setTimeout(() => {
          this.loadLevel(this.gameState.levelId);
        }, 2000);
      }
      // If fallOffEdge disabled, silently reject the move
      return;
    }

    // Apply move
    block.position.x = rolled.position.x;
    block.position.y = rolled.position.y;
    block.orientation = rolled.orientation;

    // Increment move count
    this.gameState.moveCount++;

    // Check hazard
    const updatedBlock: BlockState = {
      ...blockState,
      position: rolled.position,
      orientation: rolled.orientation,
    };
    const fpTiles = getFootprintTiles(updatedBlock, this.currentTiles);
    if (checkHazard(updatedBlock, fpTiles)) {
      block.alive = false;
      // Broadcast death immediately, then auto-restart after 2 seconds
      this.broadcast('state', this.gameState);
      this.clock.setTimeout(() => {
        this.loadLevel(this.gameState.levelId);
      }, 2000);
      return;
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
          this.gameState.tilesJson = JSON.stringify(this.currentTiles);
        }
      }
    }

    // Check win condition
    const fireBlock = this.buildBlockState(this.gameState.fireBlock, Element.Fire);
    const waterBlock = this.buildBlockState(this.gameState.waterBlock, Element.Water);
    if (checkWinCondition(fireBlock, waterBlock, this.currentTiles)) {
      this.gameState.phase = 'completed';
    }

    // Broadcast updated state to all clients
    this.broadcast('state', this.gameState);
  }

  async onLeave(client: Client, consented: boolean) {
    const player = this.getPlayer(client.sessionId);
    if (player) {
      player.connected = false;
      this.broadcast('state', this.gameState);
    }

    if (!consented) {
      try {
        await this.allowReconnection(client, 30);
        if (player) {
          player.connected = true;
          this.broadcast('state', this.gameState);
        }
      } catch {
        // Reconnection timed out
      }
    }
  }

  onDispose() {
    removeRoomCode(this.gameState.roomCode);
  }

  loadLevel(levelId: number) {
    const level = getLevel(levelId);
    if (!level) return;

    this.currentLevel = level;
    this.currentTiles = level.tiles.map((row: TileType[]) => [...row]);

    this.gameState.levelId = levelId;
    this.gameState.phase = 'playing';
    this.gameState.moveCount = 0;
    this.gameState.tilesJson = JSON.stringify(this.currentTiles);

    this.applyBlockStart(this.gameState.fireBlock, level.fireStart, Element.Fire);
    this.applyBlockStart(this.gameState.waterBlock, level.waterStart, Element.Water);

    // Broadcast updated state to all clients
    this.broadcast('state', this.gameState);
  }

  private applyBlockStart(
    block: PlainBlock,
    start: { position: { x: number; y: number }; orientation: BlockOrientation },
    element: Element,
  ) {
    block.position.x = start.position.x;
    block.position.y = start.position.y;
    block.orientation = start.orientation;
    block.element = element;
    block.alive = true;
  }

  private buildBlockState(block: PlainBlock, element: Element): BlockState {
    return {
      position: { x: block.position.x, y: block.position.y },
      orientation: block.orientation as BlockOrientation,
      element,
      alive: block.alive,
    };
  }
}
