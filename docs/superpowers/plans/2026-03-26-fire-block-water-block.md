# Fire Block & Water Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cooperative online multiplayer puzzle game where two players control elemental blocks (fire and water) on a shared isometric grid, using Bloxorz rolling mechanics.

**Architecture:** Monorepo with three packages — `shared` (pure TS game logic, zero deps), `server` (Colyseus authoritative game server), and `client` (Three.js isometric renderer + Vite). Shared game logic runs identically on client and server.

**Tech Stack:** TypeScript, Three.js (isometric 3D), Colyseus (multiplayer), Vite (client bundler), Vitest (testing)

**Spec:** `docs/superpowers/specs/2026-03-26-fire-block-water-block-design.md`

**UI:** Use the frontend-design skill for the lobby/landing page — should feel gamey and polished, not generic.

---

## File Structure

```
FireBlockeWaterBlocki/
├── package.json                    — npm workspaces root
├── tsconfig.base.json              — shared TS compiler options
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── types.ts            — Enums, interfaces
│   │       ├── block.ts            — createBlock(), getFootprint()
│   │       ├── moves.ts            — computeRoll(), isValidMove()
│   │       ├── mechanics.ts        — checkHazard(), activateSwitch(), checkWinCondition()
│   │       ├── levels/
│   │       │   ├── index.ts        — getLevel(), getAllLevels()
│   │       │   └── level-01.ts through level-10.ts
│   │       ├── index.ts            — re-exports
│   │       └── __tests__/
│   │           ├── block.test.ts
│   │           ├── moves.test.ts
│   │           └── mechanics.test.ts
│   │
│   ├── server/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts            — Colyseus server entry
│   │       ├── GameRoom.ts         — Room lifecycle, message handlers
│   │       ├── GameState.ts        — Colyseus Schema classes
│   │       └── roomCodes.ts        — Room code generation
│   │
│   └── client/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html              — Entry HTML
│       └── src/
│           ├── main.ts             — Entry point
│           ├── renderer/
│           │   └── scene.ts        — Three.js scene, isometric camera
│           ├── entities/
│           │   ├── gridMesh.ts     — Tile mesh rendering
│           │   ├── blockMesh.ts    — Block mesh + rolling animation
│           │   └── effects.ts      — Fire/water particles
│           ├── input.ts            — Keyboard handler
│           ├── network.ts          — Colyseus client
│           └── ui/
│               ├── lobby.ts        — Create/Join room UI (use frontend-design skill)
│               ├── hud.ts          — Move counter, connection status
│               └── levelComplete.ts — Level complete overlay
```

---

### Task 1: Monorepo Scaffold

Setup npm workspaces, TypeScript configs, Vite, Vitest. Install all dependencies. Verify builds.

- [ ] Create root `package.json` with workspaces config
- [ ] Create `tsconfig.base.json` with shared compiler options
- [ ] Create `packages/shared/` with package.json, tsconfig, vitest config
- [ ] Create `packages/server/` with package.json, tsconfig (deps: @colyseus/core, @colyseus/ws-transport, tsx)
- [ ] Create `packages/client/` with package.json, tsconfig, vite.config.ts, index.html (deps: three, colyseus.js)
- [ ] Create `.gitignore` (node_modules, dist, .superpowers, *.local)
- [ ] Run `npm install` and verify all workspace packages link
- [ ] Run `npx -w packages/shared vitest run` — expect "no test files found"
- [ ] Commit: "feat: scaffold monorepo with shared, server, and client packages"

### Task 2: Shared Types

Define all game enums and interfaces in `packages/shared/src/types.ts`.

- [ ] Create `types.ts` with: Element (Fire/Water), TileType (Empty/Stone/Lava/Water/Toxic/Fragile/SwitchFire/SwitchWater/ExitFire/ExitWater), Direction (NSEW), BlockOrientation (Standing/LyingX/LyingY), Position, BlockState, SwitchEffect, LevelData, GamePhase
- [ ] Create `index.ts` re-exporting types
- [ ] Run `npx -w packages/shared tsc --noEmit` — no errors
- [ ] Commit: "feat(shared): add core type definitions"

### Task 3: Block Logic (TDD)

Implement block creation and footprint calculation with tests.

- [ ] Write failing tests in `__tests__/block.test.ts`:
  - `createBlock` returns correct state (element, position, orientation, alive)
  - `getFootprint` for Standing → 1 cell
  - `getFootprint` for LyingX → 2 cells extending east
  - `getFootprint` for LyingY → 2 cells extending north
- [ ] Run tests — expect FAIL (module not found)
- [ ] Implement `block.ts`: `createBlock(element, position, orientation?)` and `getFootprint(block)`
- [ ] Run tests — expect PASS
- [ ] Commit: "feat(shared): add block creation and footprint calculation"

### Task 4: Move Validation & Rolling Logic (TDD)

Implement Bloxorz rolling mechanics with full test coverage.

- [ ] Write failing tests in `__tests__/moves.test.ts`:
  - Standing roll in all 4 directions → correct new position and orientation
  - LyingX roll along axis (east/west) → becomes Standing
  - LyingX roll perpendicular (north/south) → stays LyingX, shifts position
  - LyingY roll along axis (north/south) → becomes Standing
  - LyingY roll perpendicular (east/west) → stays LyingY, shifts position
  - `isValidMove` accepts valid moves within bounds
  - `isValidMove` rejects out-of-bounds moves
  - `isValidMove` rejects moves onto Empty tiles
- [ ] Run tests — expect FAIL
- [ ] Implement `moves.ts`: `computeRoll(position, orientation, direction)` returns `{position, orientation}`, `isValidMove(block, direction, tiles)` returns boolean
- [ ] Run tests — expect PASS
- [ ] Commit: "feat(shared): add block rolling logic and move validation"

Rolling rules reference (anchor = south-west corner of footprint):
- **Standing → North**: LyingY at (x, y+1)
- **Standing → South**: LyingY at (x, y-2)
- **Standing → East**: LyingX at (x+1, y)
- **Standing → West**: LyingX at (x-2, y)
- **LyingX → East**: Standing at (x+2, y)
- **LyingX → West**: Standing at (x-1, y)
- **LyingX → North/South**: LyingX shifted ±1 in y
- **LyingY → North**: Standing at (x, y+2)
- **LyingY → South**: Standing at (x, y-1)
- **LyingY → East/West**: LyingY shifted ±1 in x

### Task 5: Game Mechanics — Hazards, Switches, Win Condition (TDD)

- [ ] Write failing tests in `__tests__/mechanics.test.ts`:
  - Fire on lava = safe, water on lava = dies
  - Fire on water = dies, water on water = safe
  - Any block on toxic = dies
  - Standing block on fragile = dies (breaks), lying = safe
  - LyingX with one foot on hazard tile = dies
  - `activateSwitch` changes target tiles from fromType to toType
  - Toggle switch reverts when activated again
  - `checkWinCondition`: both standing on correct exits = true
  - `checkWinCondition`: wrong exit = false, not standing = false
- [ ] Run tests — expect FAIL
- [ ] Implement `mechanics.ts`: `checkHazard(block, footprintTiles)`, `getFootprintTiles(block, tiles)`, `activateSwitch(tiles, effect)`, `checkWinCondition(fireBlock, waterBlock, tiles)`
- [ ] Run tests — expect PASS
- [ ] Commit: "feat(shared): add hazard checking, switch activation, and win condition"

### Task 6: Level 1 — Tutorial

- [ ] Create `levels/level-01.ts`: 8x6 grid, two separate stone paths, no hazards, no switches. Fire starts at (1,0), water at (5,0). Exits at (3,4) and (6,4).
- [ ] Create `levels/index.ts`: `getLevel(id)` and `getAllLevels()`
- [ ] Update `shared/src/index.ts` to re-export levels
- [ ] Verify TypeScript compiles
- [ ] Commit: "feat(shared): add Level 1 — First Steps tutorial"

### Task 7: Colyseus Server

- [ ] Create `GameState.ts` with Colyseus Schema classes: PositionSchema, BlockSchema, PlayerSchema, GameStateSchema (phase, levelId, roomCode, fireBlock, waterBlock, players, moveCount, tilesJson)
- [ ] Create `roomCodes.ts`: `generateRoomCode(roomId)` returns adjective+number codes (e.g., "FIRE42"), `getRoomIdByCode(code)`, `removeRoomCode(code)`
- [ ] Create `GameRoom.ts`: Room with maxClients=2. onCreate sets up message handlers (move, restart, selectLevel). onJoin assigns element (first=fire, second=water), loads level when both join. handleMove validates via shared logic, updates state, checks hazards/switches/win. onLeave allows 30s reconnect. onDispose cleans up room code.
- [ ] Create `index.ts`: HTTP server with `/api/room-by-code/:code` endpoint (CORS enabled), Colyseus server with WebSocket transport, defines "game" room.
- [ ] Run `npm run dev:server` — expect "Game server listening on port 2567"
- [ ] Commit: "feat(server): add Colyseus game server with rooms, state sync, and game logic"

### Task 8: Client — Three.js Isometric Scene

- [ ] Create `renderer/scene.ts`: GameRenderer class with Three.js Scene, OrthographicCamera at isometric angle (position 10,10,10 looking at origin), WebGLRenderer with shadows, ambient + directional lighting, resize handler, `gridToWorld(x, y)` coordinate conversion, render loop.
- [ ] Create minimal `main.ts` with a test cube to verify rendering
- [ ] Run `npm run dev:client` — expect orange cube on dark background from isometric view at http://localhost:3000
- [ ] Commit: "feat(client): add Three.js isometric renderer"

### Task 9: Client — Grid & Block Rendering

- [ ] Create `entities/gridMesh.ts`: GridMesh class that builds tile meshes from `TileType[][]`. Color map: stone=gray, lava=orange with emissive, water=blue with emissive, toxic=green, fragile=dark gray, switches=colored, exits=colored with glow. Each tile is a flat BoxGeometry(0.95, 0.2, 0.95).
- [ ] Create `entities/blockMesh.ts`: BlockMesh class with BoxGeometry(0.9, 1.8, 0.9). Fire=orange with emissive, water=blue with emissive. `setPositionImmediate(position, orientation)` places block correctly for standing/lyingX/lyingY. `setVisible(bool)`.
- [ ] Update `main.ts` to load Level 1, render grid and both blocks at starting positions
- [ ] Run dev client — expect isometric grid with orange + blue blocks
- [ ] Commit: "feat(client): render tile grid and blocks from level data"

### Task 10: Client — Input & Network

- [ ] Create `input.ts`: Map Arrow keys and WASD to Direction enum. `setupInput(onMove)` callback.
- [ ] Create `network.ts`: NetworkClient class wrapping Colyseus Client. `createRoom()` returns room code. `joinByCode(code)` fetches roomId from server API then joins. `sendMove(direction)`, `sendRestart()`, `sendSelectLevel(levelId)`. `onStateChange` callback.
- [ ] Update `main.ts`: Wire state changes to update grid/block visuals. Wire input to `network.sendMove()`. Create simple lobby UI using DOM createElement (not raw string HTML — use safe DOM methods: createElement, textContent, appendChild).
- [ ] Test: Run server + client in two tabs, create room, join with code, move blocks
- [ ] Commit: "feat(client): add input handling, network connection, and lobby"

### Task 11: Visual Effects

- [ ] Create `entities/effects.ts`: Fire particles (rising embers, additive blending), water particles (orbiting droplets). Tile animation functions for lava (emissive pulse) and water (shimmer).
- [ ] Add particles to BlockMesh constructor based on element
- [ ] Add tile animation to GridMesh update loop
- [ ] Wire time/dt into render loop for animations
- [ ] Commit: "feat(client): add fire/water particle effects and tile animations"

### Task 12: Campaign Levels 2-10

- [ ] Level 2 "Hot & Cold": Introduce lava + water tiles as hazards, separate paths
- [ ] Level 3 "Open Sesame": Fire switch opens path for water block
- [ ] Level 4 "Give & Take": Both must activate switches for each other
- [ ] Level 5 "Watch Your Step": Fragile tiles (must cross lying down)
- [ ] Level 6 "Flip the Script": Toggle switch converts lava↔water
- [ ] Level 7 "One at a Time": Sequential switch activation
- [ ] Level 8 "Fork in the Road": Multiple paths requiring coordination
- [ ] Level 9 "No Safe Ground": Toxic tiles threatening both
- [ ] Level 10 "The Gauntlet": All mechanics combined
- [ ] Register all levels in `levels/index.ts`
- [ ] Add level select UI (list of levels, player 1 picks)
- [ ] Commit: "feat: add campaign levels 2-10 and level select"

### Task 13: Smooth Rolling Animation

- [ ] Replace snap-to-position with rotation around leading edge over 300ms
- [ ] Queue moves during animation
- [ ] Detect state changes and trigger animation vs immediate placement
- [ ] Commit: "feat(client): add smooth rolling animation for blocks"

### Task 14: Landing Page & Polish (use frontend-design skill)

- [ ] Use the `frontend-design` skill to create a polished, gamey lobby/landing page
- [ ] Add level complete overlay with move count, next level, replay buttons
- [ ] Add connection status indicator (green/red dot)
- [ ] Add block death feedback (flash red, show message, auto-restart)
- [ ] Full end-to-end playtest across all 10 levels
- [ ] Commit: "feat: add polished landing page, level complete, and game feedback"
