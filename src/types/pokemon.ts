// ===== Pokémon Types =====

export type PokemonType =
  | 'normal' | 'fire' | 'water' | 'grass' | 'electric'
  | 'ice' | 'fighting' | 'poison' | 'ground' | 'flying'
  | 'psychic' | 'bug' | 'rock' | 'ghost' | 'dragon'
  | 'dark' | 'steel' | 'fairy';

export type MoveCategory = 'physical' | 'special' | 'status';

export type StatName = 'hp' | 'attack' | 'defense' | 'spAtk' | 'spDef' | 'speed';
export type BattleStatName = StatName | 'accuracy' | 'evasion';

export type ExpGroup = 'fast' | 'mediumFast' | 'mediumSlow' | 'slow';

export type StatusCondition = 'paralysis' | 'sleep' | 'poison' | 'toxic' | 'burn' | 'freeze' | null;

export type EvolutionMethod = 'level' | 'stone' | 'trade';

// ===== Base Data (from JSON) =====

export interface BaseStats {
  hp: number;
  attack: number;
  defense: number;
  spAtk: number;
  spDef: number;
  speed: number;
}

export interface LearnsetEntry {
  level: number;
  moveId: number;
}

export interface EvolutionEntry {
  method: EvolutionMethod;
  level?: number;
  stone?: string;
  evolvesInto: number;
}

export interface PokemonData {
  id: number;
  name: string;
  generation: number;
  types: PokemonType[];
  baseStats: BaseStats;
  learnset: LearnsetEntry[];
  evolutions: EvolutionEntry[];
  catchRate: number;
  expGroup: ExpGroup;
  baseExp: number;
  evYield: Partial<BaseStats>;
  spriteUrl: string;
  tmLearnset?: number[];
  abilities: string[];
}

export interface MoveData {
  id: number;
  name: string;
  type: PokemonType;
  category: MoveCategory;
  power: number | null;
  accuracy: number | null;
  pp: number;
  priority: number;
  target: 'enemy' | 'self' | 'all';
  effect: MoveEffect | null;
}

export interface MoveEffect {
  type: 'status' | 'stat' | 'drain' | 'recoil' | 'flinch' | 'charge' | 'recharge' | 'multi'
    | 'disable' | 'mist' | 'ohko' | 'trap' | 'force_switch' | 'fixed_damage'
    | 'rampage' | 'recoil_crash' | 'money' | 'critical'
    | 'leech_seed' | 'self_destruct' | 'weather' | 'protect' | 'heal_self'
    | 'transform' | 'override';
  status?: StatusCondition;
  chance?: number;
  stat?: BattleStatName;
  stages?: number;
  amount?: number; // For drain/recoil/fixed_damage (percent or fixed value)
  min?: number; // For multi-hit
  max?: number; // For multi-hit
  count?: number; // For fixed multi-hit
  weather?: 'sun' | 'rain' | 'sandstorm' | 'hail';
  selfEffect?: { stat?: BattleStatName; stages?: number };
  drainPercent?: number;
  additionalStats?: Array<{ stat: BattleStatName; stages: number }>;
}

// ===== Instance (in-game Pokémon) =====

export interface VolatileStatus {
  confusion: number; // 0 = not confused, >0 = turns remaining
  flinch: boolean;
  leechSeed: boolean;
  bound: number; // For trapping moves like Wrap/Bind
  charging?: number; // moveId being charged
  disabled?: { moveId: number; turns: number };
  mistTurns: number;
  rampageTurns: number;
  rampageMoveId?: number;
  lastMoveUsed?: number;
  protected: boolean;
  protectStreak: number; // Consecutive protect uses (halves success rate)
  cursed: boolean; // Lose 1/4 HP per turn
  recharging: boolean; // Must skip turn (Hyper Beam, Giga Impact)
  lastDamageTaken?: { amount: number; category: 'physical' | 'special' }; // For Counter/Mirror Coat
  destinyBond: boolean; // If attacker faints this turn, so does opponent
  encoreTurns: number; // Turns remaining locked into last move
  encoreMoveId?: number; // Move locked by Encore
  perishTurns: number; // Perish Song countdown (3→0, faint at 0), -1 = inactive
  substituteHp: number; // 0 = no substitute, >0 = substitute's remaining HP
  toxicCounter: number; // Escalating toxic damage multiplier (1, 2, 3...)
  focusEnergy: boolean; // +2 crit stage
  lockOn: boolean; // Next move guaranteed hit
  endure: boolean; // Survive with 1 HP this turn
  trapped: boolean; // Cannot switch (Mean Look, Block)
  safeguardTurns: number; // Block status conditions
  tauntTurns: number; // Block status moves
  yawned: boolean; // Will fall asleep next turn end
  ingrain: boolean; // Heal 1/16 per turn, cannot switch
  aquaRing: boolean; // Heal 1/16 per turn
  magnetRise: number; // Ground immunity turns remaining
}

export function freshVolatile(): VolatileStatus {
  return {
    confusion: 0,
    flinch: false,
    leechSeed: false,
    bound: 0,
    mistTurns: 0,
    rampageTurns: 0,
    protected: false,
    protectStreak: 0,
    cursed: false,
    recharging: false,
    destinyBond: false,
    encoreTurns: 0,
    perishTurns: -1,
    substituteHp: 0,
    toxicCounter: 0,
    focusEnergy: false,
    lockOn: false,
    endure: false,
    trapped: false,
    safeguardTurns: 0,
    tauntTurns: 0,
    yawned: false,
    ingrain: false,
    aquaRing: false,
    magnetRise: 0,
  };
}

export interface PokemonInstance {
  uid: string;
  dataId: number;
  nickname: string | null;
  level: number;
  currentHp: number;
  maxHp: number;
  stats: BaseStats;
  ivs: BaseStats;
  evs: BaseStats;
  moves: MoveInstance[];
  status: StatusCondition;
  statusTurns: number;
  volatile: VolatileStatus;
  statStages: BaseStats; // Representing stages -6 to +6
  xp: number;
  xpToNextLevel: number;
  friendship: number;
  isShiny: boolean;
  ability: string;
  heldItem: string | null;
}

export interface MoveInstance {
  moveId: number;
  currentPp: number;
  maxPp: number;
}
