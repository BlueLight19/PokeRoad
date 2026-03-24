import { PokemonInstance, MoveData, StatusCondition } from './pokemon';

export type BattleType = 'wild' | 'trainer' | 'gym' | 'safari' | 'static';

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
  type: 'info' | 'damage' | 'status' | 'effective' | 'critical' | 'catch' | 'xp' | 'heal';
  // Optional state captured at the exact moment the log is generated
  state?: {
    attackerHp?: number;
    defenderHp?: number;
    attackerStatus?: any;
    defenderStatus?: any;
    // Animation hints
    target?: 'player' | 'enemy';
    isCritical?: boolean;
    effectiveness?: number;
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

export interface SideConditions {
  reflect: number;       // Turns remaining (0 = inactive)
  lightScreen: number;   // Turns remaining
  auroraVeil: number;    // Turns remaining
  spikes: number;        // Layers (0-3)
  toxicSpikes: number;   // Layers (0-2)
  stealthRock: boolean;
  stickyWeb: boolean;
  tailwind: number;      // Turns remaining
}

export function freshSideConditions(): SideConditions {
  return {
    reflect: 0,
    lightScreen: 0,
    auroraVeil: 0,
    spikes: 0,
    toxicSpikes: 0,
    stealthRock: false,
    stickyWeb: false,
    tailwind: 0,
  };
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
