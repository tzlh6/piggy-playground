/** 猪猪夺宝后端契约 1.0.0。运行时模块为 heist-core.js。 */
export type Direction = 'E' | 'SE' | 'SW' | 'W' | 'NW' | 'NE';
export type Position = { q: number; r: number };
export type Config = { players?: 2 | 3 | 4; first?: number; target?: number; maxRounds?: number };
export type Action =
  | { type: 'move' | 'push' | 'plant'; dir: Direction }
  | { type: 'rotate'; at: Position; step: -1 | 1 }
  | { type: 'toggle'; at: Position }
  | { type: 'end' };
export type Tile = Position & (
  | {kind: 'floor' | 'pit'}
  | {kind: 'home'; owner: number}
  | {kind: 'well'; rate: number; cap: number}
  | {kind: 'spring'; dir: Direction}
  | {kind: 'portal'; exit: Position}
  | {kind: 'gate'; group: number; open: boolean}
);
export type Player = {id: number; home: Position; pos: Position | null; carry: number; score: number; ammo: number; falls: number};
export type Bomb = Position & {id: number; owner: number; dueTurn: number};
export type Result = {reason: 'target' | 'round-limit'; winners: number[]; scores: number[]; round: number};
export type View = {
  schemaVersion: 1; rulesVersion: string; config: Required<Config>;
  board: {radius: number; tiles: Tile[]}; players: Player[];
  piles: (Position & {count: number})[]; bombs: Bomb[];
  turn: number; round: number; turnNumber: number; ap: number; revision: number;
  nextBombId: number; phase: 'playing' | 'finished'; result: Result | null;
};
export type Entity = {entity: 'pig' | 'bomb'; entityId: number};
export type EventPayload =
  | {type: 'action'; seat: number; action: Action}
  | {type: 'ap'; seat: number; ap: number}
  | ({type: 'move'; from: Position; to: Position; mode: 'walk' | 'push' | 'follow' | 'domino' | 'launch' | 'blast'} & Entity)
  | ({type: 'bump'; at: Position; against: Position; reason: 'terrain' | 'occupied'} & Entity)
  | ({type: 'spring'; at: Position; dir: Direction; to: Position} & Entity)
  | ({type: 'teleport'; from: Position; to: Position} & Entity)
  | ({type: 'portalBlocked'; at: Position; exit: Position} & Entity)
  | ({type: 'chainStopped'; at: Position; reason: 'cycle-or-limit' | 'repeated-device'} & Entity)
  | ({type: 'fall'; from: Position; to: Position; reason: 'pit' | 'edge'; respawn: 'next-own-turn' | null} & Entity)
  | {type: 'pickup'; seat: number; at: Position; amount: number; carry: number; left: number}
  | {type: 'deposit'; seat: number; amount: number; score: number}
  | {type: 'restock'; seat: number; ammo: number}
  | {type: 'spill'; seat: number; amount: number; carry: number; reason: 'fall' | 'blast' | 'push'; drops: (Position & {count: number})[]}
  | {type: 'push'; seat: number; target: {kind: 'pig' | 'bomb'; id: number}; at: Position}
  | {type: 'plant'; seat: number; bomb: Bomb; ammo: number}
  | {type: 'rotate'; seat: number; at: Position; from: Direction; to: Direction}
  | {type: 'gates'; seat: number; group: number; open: boolean; tiles: Position[]}
  | {type: 'explode'; bombId: number; owner: number; at: Position; cells: Position[]}
  | {type: 'hit'; seat: number; bombId: number; at: Position; dir: Direction}
  | {type: 'fuse'; bombId: number; remainingTurns: number}
  | {type: 'respawn'; seat: number; at: Position; ammo: number}
  | {type: 'turnEnd'; seat: number; turnNumber: number}
  | {type: 'turnStart'; seat: number; turnNumber: number; round: number; ap: number}
  | {type: 'roundEnd'; round: number; scores: number[]}
  | {type: 'roundStart'; round: number}
  | {type: 'supply'; at: Position; amount: number; count: number}
  | ({type: 'finish'} & Result)
  | {type: 'restored'};
export type GameEvent = EventPayload & {id: string};
export type Transition = {ok: boolean; code: string | null; message?: string; events: GameEvent[]; view: View};
export type Archive = {schemaVersion: 1; rulesVersion: string; config: Required<Config>; actions: {seat: number; action: Action}[]};
export const RULES_VERSION: string;
export const DIRS: ReadonlyArray<Readonly<{id: Direction; q: number; r: number}>>;
export const LIMITS: Readonly<{radius: number; ap: number; bag: number; bombs: number; blast: number; launch: number; chain: number}>;
export const COSTS: Readonly<Record<Action['type'], number>>;
export const ERRORS: Readonly<Record<string, string>>;
export class Game {
  constructor(config?: Config);
  view(): View;
  legalActions(): Action[];
  act(seat: number, action: Action, expectedRevision: number): Transition;
  preview(seat: number, action: Action, expectedRevision: number): Transition;
  save(): Archive;
  undo(): {ok: boolean; code?: string; view: View; events: GameEvent[]};
  static load(data: Archive | string): Game;
  static replay(data: Archive | string): ({events: GameEvent[]; view: View; ok?: boolean})[];
}
/** 只接受当前引擎产生的可信公开快照；不用于导入玩家文件。 */
export function simulate(view: View, action: Action): Transition;
export function legalActions(view: View): Action[];
/** 忽略实体占用的估计落点，仅用于 AI 路线估值。界面预览必须用 Game.preview。 */
export function landing(view: View, seat: number, from: Position, dir: Direction): Position | null;
export function distance(a: Position, b: Position): number;
