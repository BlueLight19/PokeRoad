import { PokemonInstance, MoveData, StatusCondition } from './pokemon';

export type BattleType = 'wild' | 'trainer' | 'gym' | 'safari';

export type BattlePhase =
  | 'intro'
  | 'choosing'
  | 'executing'
  | 'switching'
  | 'catching'
  | 'victory'
  | 'defeat'
  | 'fled'
  | 'caught';

export interface BattleState {
  type: BattleType;
  phase: BattlePhase;
  playerTeam: PokemonInstance[];
  activePlayerIndex: number;
  enemyTeam: PokemonInstance[];
  activeEnemyIndex: number;
  logs: BattleLogEntry[];
  turnNumber: number;
  trainerData: TrainerBattleData | null;
  catchAttempts: number;
}

export interface BattleLogEntry {
  message: string;
  type: 'info' | 'damage' | 'status' | 'effective' | 'critical' | 'catch' | 'xp';
  // Optional state captured at the exact moment the log is generated
  state?: {
    attackerHp?: number;
    defenderHp?: number;
    attackerStatus?: any;
    defenderStatus?: any;
  };
}

export interface TrainerBattleData {
  id: string;
  name: string;
  trainerClass: string;
  reward: number;
}

export interface BattleAction {
  type: 'move' | 'switch' | 'item' | 'flee' | 'catch';
  moveIndex?: number;
  switchIndex?: number;
  itemId?: string;
}

export interface DamageResult {
  damage: number;
  effectiveness: number;
  isCritical: boolean;
  stab: boolean;
}

export interface TurnResult {
  playerAction: ActionResult;
  enemyAction: ActionResult;
  playerFirst: boolean;
}

export interface ActionResult {
  attacker: PokemonInstance;
  defender: PokemonInstance;
  move: MoveData;
  damage: DamageResult;
  statusApplied: StatusCondition;
  fainted: boolean;
  messages: BattleLogEntry[];
}
