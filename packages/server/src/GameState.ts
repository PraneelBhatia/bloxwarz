import { Schema, defineTypes } from '@colyseus/schema';

// Minimal schema — Colyseus requires one, but we sync state via messages
export class GameStateSchema extends Schema {}
defineTypes(GameStateSchema, {});
