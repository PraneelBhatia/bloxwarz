# Game Reference

Technical reference for AI agents and contributors working on Fire Block & Water Block.

## Core Concept

2-player co-op puzzle game. Each player controls a 1x1x2 rectangular block (fire or water) on a shared isometric grid. Blocks roll like the original Bloxorz. Both must reach their element-matching exit to complete a level.

## Block

- Dimensions: 1x1x2 rectangular prism
- Orientations: `Standing` (1x1 footprint), `LyingX` (1x2 east), `LyingY` (1x2 north)
- Anchor point: south-west corner of footprint
- Must be `Standing` on exit tile to complete level
- Rolling alternates standing/lying — from standing at y=0, block arrives standing at y=0, 3, 6, 9...

### Rolling Rules (anchor = south-west corner)

| From | Direction | Result | New Anchor |
|------|-----------|--------|------------|
| Standing (x,y) | North | LyingY | (x, y+1) |
| Standing (x,y) | South | LyingY | (x, y-2) |
| Standing (x,y) | East | LyingX | (x+1, y) |
| Standing (x,y) | West | LyingX | (x-2, y) |
| LyingX (x,y) | East | Standing | (x+2, y) |
| LyingX (x,y) | West | Standing | (x-1, y) |
| LyingX (x,y) | North | LyingX | (x, y+1) |
| LyingX (x,y) | South | LyingX | (x, y-1) |
| LyingY (x,y) | North | Standing | (x, y+2) |
| LyingY (x,y) | South | Standing | (x, y-1) |
| LyingY (x,y) | East | LyingY | (x+1, y) |
| LyingY (x,y) | West | LyingY | (x-1, y) |

## Tile Types

| Type | Enum | Fire Block | Water Block | Hex Color | Visual |
|------|------|-----------|-------------|-----------|--------|
| Empty | `empty` | Falls off | Falls off | N/A | No tile rendered |
| Stone | `stone` | Safe | Safe | `#666677` | Gray flat box |
| Lava | `lava` | Safe | Dies | `#ff4500` | Orange, emissive pulse |
| Water | `water` | Dies | Safe | `#0277bd` | Blue, emissive shimmer |
| Toxic | `toxic` | Dies | Dies | `#44aa00` | Green |
| Fragile | `fragile` | Breaks if Standing | Breaks if Standing | `#555555` | Dark gray (safe when lying) |
| Switch (fire) | `switch_fire` | Activates | No effect | `#ff8c00` | Orange |
| Switch (water) | `switch_water` | No effect | Activates | `#4fc3f7` | Cyan |
| Exit (fire) | `exit_fire` | Goal | N/A | `#ff6b35` | Orange exit |
| Exit (water) | `exit_water` | N/A | Goal | `#29b6f6` | Blue exit |

## Block Visuals

| Block | Mesh Color | Emissive | Particles |
|-------|-----------|----------|-----------|
| Fire | `#ff6b35` | `#ff2200` | Orange rising embers (20 points, additive blending) |
| Water | `#4fc3f7` | `#0066cc` | Blue orbiting droplets (15 points, additive blending) |

Both blocks: `BoxGeometry(0.9, 1.8, 0.9)`, `MeshStandardMaterial`, cast shadows.

## Switch Effects

```ts
interface SwitchEffect {
  targets: Position[];    // tiles that change
  fromType: TileType;     // what they change from
  toType: TileType;       // what they change to
  toggle: boolean;        // re-activating reverts the change
}
```

Switches are element-specific — fire block can only activate `switch_fire`, water block only `switch_water`. This forces co-op: one player opens paths for the other.

## Level Format

```ts
interface LevelData {
  id: number;
  name: string;
  width: number;
  height: number;
  tiles: TileType[][];    // [y][x], y=0 is bottom row
  switchEffects: Record<string, SwitchEffect>;  // key = "x,y"
  fireStart: { position: Position; orientation: BlockOrientation };
  waterStart: { position: Position; orientation: BlockOrientation };
}
```

Levels stored in `packages/shared/src/levels/level-XX.ts`. Currently 34 levels (1 tutorial + 33 adapted from original Bloxorz).

## Game Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `fallOffEdge` | `true` | ON: blocks die when rolling off edges. OFF: edges silently block movement. |

## Controls

| Mode | Fire Block | Water Block |
|------|-----------|-------------|
| Local Co-Op | WASD | Arrow Keys |
| Online Co-Op | WASD or Arrows (your block) | WASD or Arrows (partner's device) |

## Rendering

- **Engine:** Three.js with `OrthographicCamera`
- **Camera:** 315° rotation, 35° elevation (matches original Bloxorz perspective)
- **Tile mesh:** `BoxGeometry(0.95, 0.2, 0.95)` per tile
- **Block mesh:** `BoxGeometry(0.9, 1.8, 0.9)` with emissive glow
- **Animation:** Pivot-based rolling (rotation around leading edge, 300ms, ease-in-out)
- **Effects:** Lava tiles pulse emissive, water tiles shimmer, blocks have particle systems
- **Coordinate system:** Grid x=East, y=North. World x=East, y=Up, z=-North.

## Networking

- **Transport:** Colyseus (WebSocket) on port 2567
- **Model:** Authoritative server. Client sends move commands, server validates and broadcasts state as JSON messages.
- **State sync:** `room.onMessage('state', ...)` — full game state sent on every change
- **Room codes:** Adjective + 2-digit number (e.g., FIRE42, EMBER25)
- **Reconnection:** 30-second window on disconnect

## Solver

Joint BFS solver at `packages/shared/src/solver.ts`. Explores `(fireState, waterState, switchStates)` simultaneously. Used to verify all levels are solvable before shipping.

```ts
solveLevelCoOp(level: LevelData): { solvable: boolean; moveCount: number; solution: [...] }
```

## Current Assets (All Placeholder)

All visuals are procedural Three.js materials and particles — no texture files. Planned:
- **Textures/sprites:** Generate with Nano Banana Pro
- **Sound effects:** Generate with ElevenLabs (rolling, falling, win, hazard death, switch activation)
- **Background music:** TBD

## Key Source Files

| File | Purpose |
|------|---------|
| `packages/shared/src/types.ts` | All enums and interfaces |
| `packages/shared/src/block.ts` | Block creation, footprint calculation |
| `packages/shared/src/moves.ts` | Rolling logic, move validation |
| `packages/shared/src/mechanics.ts` | Hazards, switches, win condition |
| `packages/shared/src/solver.ts` | Joint BFS co-op solver |
| `packages/shared/src/levels/` | All 34 level definitions |
| `packages/server/src/GameRoom.ts` | Colyseus room, game state, move processing |
| `packages/client/src/renderer/scene.ts` | Three.js scene, isometric camera |
| `packages/client/src/entities/blockMesh.ts` | Block rendering + rolling animation |
| `packages/client/src/entities/gridMesh.ts` | Tile grid rendering |
| `packages/client/src/entities/effects.ts` | Fire/water particles, tile animations |
| `packages/client/src/input.ts` | Keyboard input (online + local co-op) |
| `packages/client/src/network.ts` | Colyseus client connection |
| `packages/client/src/main.ts` | Entry point, UI, state sync |
