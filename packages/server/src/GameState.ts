import { Schema, ArraySchema, defineTypes } from '@colyseus/schema';

export class PositionSchema extends Schema {
  x: number = 0;
  y: number = 0;
}
defineTypes(PositionSchema, {
  x: 'int16',
  y: 'int16',
});

export class BlockSchema extends Schema {
  position: PositionSchema = new PositionSchema();
  orientation: string = 'standing';
  element: string = 'fire';
  alive: boolean = true;
}
defineTypes(BlockSchema, {
  position: PositionSchema,
  orientation: 'string',
  element: 'string',
  alive: 'boolean',
});

export class PlayerSchema extends Schema {
  sessionId: string = '';
  assignedElement: string = '';
  connected: boolean = false;
}
defineTypes(PlayerSchema, {
  sessionId: 'string',
  assignedElement: 'string',
  connected: 'boolean',
});

export class GameStateSchema extends Schema {
  phase: string = 'waiting';
  levelId: number = 0;
  roomCode: string = '';
  fireBlock: BlockSchema = new BlockSchema();
  waterBlock: BlockSchema = new BlockSchema();
  players: ArraySchema<PlayerSchema> = new ArraySchema<PlayerSchema>();
  moveCount: number = 0;
  tilesJson: string = '';
}
defineTypes(GameStateSchema, {
  phase: 'string',
  levelId: 'int16',
  roomCode: 'string',
  fireBlock: BlockSchema,
  waterBlock: BlockSchema,
  players: { array: PlayerSchema },
  moveCount: 'int32',
  tilesJson: 'string',
});
