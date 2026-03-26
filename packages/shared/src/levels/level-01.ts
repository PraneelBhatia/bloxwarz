import { BlockOrientation, LevelData, TileType } from '../types.js';

const S = TileType.Stone;
const _ = TileType.Empty;
const EF = TileType.ExitFire;
const EW = TileType.ExitWater;

// Level 1: "First Steps" — Tutorial
// Two L-shaped paths, no hazards, no switches.
// Fire goes up-left column then turns right, Water goes up-right then turns left.
//
// Solution (fire):  (0,0)→N→N→E→E→N→N = standing on ExitFire at (3,6)
// Solution (water): (8,0)→N→N→W→W→N→N = standing on ExitWater at (5,6)
//
// Visual (y increases upward):
// y=6: _  _  _  EF _  EW _  _  _
// y=5: _  _  _  S  _  S  _  _  _
// y=4: _  _  _  S  _  S  _  _  _
// y=3: S  S  S  S  _  S  S  S  S
// y=2: S  _  _  _  _  _  _  _  S
// y=1: S  _  _  _  _  _  _  _  S
// y=0: S  _  _  _  _  _  _  _  S
//      x0 x1 x2 x3 x4 x5 x6 x7 x8

export const level01: LevelData = {
  id: 1,
  name: 'First Steps',
  width: 9,
  height: 7,
  tiles: [
    /* y=0 */ [S, _, _, _, _, _, _, _, S],
    /* y=1 */ [S, _, _, _, _, _, _, _, S],
    /* y=2 */ [S, _, _, _, _, _, _, _, S],
    /* y=3 */ [S, S, S, S, _, S, S, S, S],
    /* y=4 */ [_, _, _, S, _, S, _, _, _],
    /* y=5 */ [_, _, _, S, _, S, _, _, _],
    /* y=6 */ [_, _, _, EF, _, EW, _, _, _],
  ],
  switchEffects: {},
  fireStart: { position: { x: 0, y: 0 }, orientation: BlockOrientation.Standing },
  waterStart: { position: { x: 8, y: 0 }, orientation: BlockOrientation.Standing },
};
