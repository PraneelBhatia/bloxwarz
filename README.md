# Fire Block & Water Block

Co-op multiplayer puzzle game. Bloxorz mechanics + Fireboy & Watergirl elemental theme.

Two players control elemental blocks (fire and water) on a shared isometric grid. Roll your block to its matching exit — but helping your partner often blocks your own path.

## Play

```bash
npm install
npm run dev:server   # terminal 1
npm run dev:client   # terminal 2
```

Open http://localhost:3000. Pick **Local Co-Op** (WASD + Arrows, same keyboard) or **Online Co-Op** (room codes).

## Stack

- **Client:** Three.js (isometric 3D), Vite
- **Server:** Colyseus (WebSocket multiplayer)
- **Shared:** Pure TypeScript game logic + BFS co-op solver
- **Levels:** 34 levels (1 tutorial + 33 converted from original Bloxorz)

## Structure

```
packages/
  shared/   — game rules, types, levels, solver (zero deps)
  server/   — Colyseus authoritative game server
  client/   — Three.js renderer, input, UI
```

## Credits & References

- Level layouts adapted from [jgordon510/quick_bloxorz](https://github.com/jgordon510/quick_bloxorz) (33 levels in Tiled JSON format)
- Rolling mechanics referenced from [TerryOShea/bloxy](https://github.com/TerryOShea/bloxy) and [binary-signal/bloxorz-game-clone](https://github.com/binary-signal/bloxorz-game-clone)
- Original [Bloxorz](https://www.miniclip.com/games/bloxorz) by Damien Clarke
- Tile assets: placeholder (production art via Nano Banana Pro, sounds via ElevenLabs — coming soon)
