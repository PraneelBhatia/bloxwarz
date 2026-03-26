# Fire Block & Water Block — Game Design Spec

A cooperative online multiplayer puzzle game combining Bloxorz block-rolling mechanics with Fireboy & Watergirl elemental themes.

## Concept

Two players each control an elemental block (fire or water) on a shared isometric grid. Players must cooperate to navigate elemental hazards, activate switches, and guide both blocks to their respective exits. Helping your partner often changes the board in ways that block your own path — creating puzzle tension that requires coordination and communication.

## Core Mechanics

### Blocks

- Each block is a 1x1x2 rectangular prism (same as Bloxorz)
- Rolls in 4 directions (north/south/east/west) on a tile grid
- Can be **standing** (1x1 footprint) or **lying** (1x2 footprint)
- Orientation matters for certain interactions (pressure plates, falling into exits)
- **Fire block**: safe on lava tiles, destroyed by water tiles
- **Water block**: safe on water tiles, destroyed by lava tiles

### Tile Types

| Tile | Fire Block | Water Block | Notes |
|------|-----------|-------------|-------|
| Stone | Safe | Safe | Standard walkable tile |
| Lava | Safe | Dies | Orange/red animated glow |
| Water | Dies | Safe | Blue animated ripple |
| Toxic | Dies | Dies | Green, hazard for both |
| Fragile | Breaks if standing | Breaks if standing | Cracked texture, one-time use when stood on |
| Switch (fire) | Activates | No effect | Triggers a linked board change |
| Switch (water) | No effect | Activates | Triggers a linked board change |
| Exit (fire) | Goal | N/A | Block must be standing to fall in |
| Exit (water) | N/A | Goal | Block must be standing to fall in |

### Co-op Puzzle Mechanics

- **Elemental switches**: Fire block on a fire switch opens/changes paths for the water block (and vice versa). Creates interdependence.
- **Bridge toggles**: Switches that convert lava tiles to water tiles (or vice versa). Helping your partner can block your own route.
- **Pressure plates**: Some require a specific block orientation (standing vs lying) to trigger.
- **Dual exit**: Both blocks must reach their element-matching exit to complete a level. A block must be standing (1x1 footprint) to fall into its exit.

### Movement

- **Simultaneous real-time**: Both players move freely without waiting for each other
- Block rolling animation takes ~300ms, providing natural pacing
- No turn-based restrictions — coordination happens through communication

## Multiplayer

### Networking Model

- **Authoritative server**: Client sends move commands, server validates using shared game logic, Colyseus auto-syncs state to both clients
- Colyseus binary delta state sync handles all replication
- ~300ms roll animation absorbs network latency — no client-side prediction needed

### Room System

- Player 1 creates a room, receives a short room code (e.g., "FIRE42")
- Player 2 joins using the code
- Player 1 is assigned the fire block, Player 2 the water block
- No accounts or authentication required

### Room Lifecycle

1. **Waiting**: Room created, waiting for second player
2. **Playing**: Both connected, level active
3. **Paused**: One player disconnected, 30s reconnect window
4. **Completed**: Both blocks reached exits, return to level select

### Messages

```
Client -> Server:
  { type: "move", direction: "north" | "south" | "east" | "west" }
  { type: "restart" }
  { type: "selectLevel", levelId: number }

Server -> Clients:
  (automatic via Colyseus Schema state sync)
```

## Visual Style

- **Clean isometric 3D** using Three.js with OrthographicCamera at 45-degree angle
- Directional + ambient lighting for clean shadows
- Fire block: dark stone with orange emissive glow, ember particles
- Water block: dark stone with blue emissive glow, ripple particles
- Lava tiles: pulsing orange/red emissive shader
- Water tiles: sine-wave blue distortion shader
- Exits: colored hole with glow beacon effect
- Base tile assets: Kenney Isometric Blocks (CC0 license)

## UI

All UI is HTML/CSS overlaid on the Three.js canvas:

- **Lobby**: Create room / Join room (code input) buttons
- **HUD**: Move counter, level name, partner connection indicator
- **Level select**: Grid of unlocked levels (Player 1 picks)
- **Level complete**: Move count summary, next level / restart options

## Tech Stack

- **Language**: TypeScript throughout
- **Renderer**: Three.js (OrthographicCamera for isometric projection)
- **Multiplayer**: Colyseus (authoritative server, room-based state sync)
- **Build**: Vite (client bundling), tsx (server dev)
- **Assets**: Kenney Isometric Blocks (CC0), custom Three.js shaders for fire/water FX

### Reference Code

- [TerryOShea/bloxy](https://github.com/TerryOShea/bloxy) — Three.js Bloxorz clone, reference for block-rolling animation and grid logic

## Project Structure

```
FireBlockeWaterBlocki/
├── packages/
│   ├── shared/          — Game rules engine (pure TS, zero dependencies)
│   │   ├── src/
│   │   │   ├── grid.ts          — Grid data structure, tile types, coordinates
│   │   │   ├── block.ts         — Block state (position, orientation, element)
│   │   │   ├── moves.ts         — Move validation, rolling logic
│   │   │   ├── mechanics.ts     — Switch triggers, bridge toggles, hazard checks
│   │   │   ├── levels.ts        — Level definitions
│   │   │   └── types.ts         — Shared type definitions
│   │   └── package.json
│   │
│   ├── server/          — Colyseus game server
│   │   ├── src/
│   │   │   ├── index.ts         — Server entry, Colyseus setup
│   │   │   ├── GameRoom.ts      — Room lifecycle, message handling
│   │   │   ├── GameState.ts     — Colyseus Schema (synced state)
│   │   │   └── roomCodes.ts     — Room code generation & lookup
│   │   └── package.json
│   │
│   └── client/          — Three.js game client (static site)
│       ├── src/
│       │   ├── index.ts         — Entry, Colyseus client connect
│       │   ├── renderer/        — Scene, camera, lighting
│       │   ├── entities/        — Block/tile meshes, fire/water shaders
│       │   ├── input.ts         — Keyboard → move commands
│       │   └── ui/              — HTML/CSS overlays (lobby, HUD)
│       ├── public/              — Static assets (Kenney tiles)
│       └── package.json
│
├── package.json         — Workspace root (npm workspaces)
└── tsconfig.base.json   — Shared TypeScript config
```

**Key principle**: `shared` runs identically on client and server. The server uses it for authoritative validation; the client uses it for instant local feedback.

## Campaign Levels

10 hand-crafted levels with progressive difficulty:

| # | Name | Concept | Introduces |
|---|------|---------|------------|
| 1 | First Steps | Solo paths, no interaction needed | Basic rolling, exits |
| 2 | Hot & Cold | Elemental tiles block one player | Lava/water tiles |
| 3 | Open Sesame | One player unlocks the other's path | Fire/water switches |
| 4 | Give & Take | Both must help each other | Mutual switch dependency |
| 5 | Watch Your Step | Orientation-sensitive tiles | Fragile tiles |
| 6 | Flip the Script | Switch converts lava to water and vice versa | Bridge toggles |
| 7 | One at a Time | Switches must be activated in sequence | Ordered sequences |
| 8 | Fork in the Road | Multiple routes require coordination | Split path puzzles |
| 9 | No Safe Ground | Toxic tiles threaten both players | Toxic tiles |
| 10 | The Gauntlet | Everything combined | All mechanics |

Levels stored as JSON in `shared/src/levels/`. Format adaptable during development.

## Scope & Flexibility

This spec is a guiding design, not a rigid contract. During development:

- Architecture, file organization, and APIs will adapt based on what works in practice
- Level designs will be tuned through playtesting
- Visual effects will be iterated based on what looks good in the isometric view
- Additional tile types or mechanics may be added if they serve the puzzles
