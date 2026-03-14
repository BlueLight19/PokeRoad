// ===== Pokémon Types =====

export type PokemonType =
  | 'normal' | 'feu' | 'eau' | 'plante' | 'electrique'
  | 'glace' | 'combat' | 'poison' | 'sol' | 'vol'
  | 'psy' | 'insecte' | 'roche' | 'spectre' | 'dragon';

export type MoveCategory = 'physical' | 'special' | 'status';

export type StatName = 'hp' | 'attack' | 'defense' | 'spAtk' | 'spDef' | 'speed';

export type ExpGroup = 'fast' | 'mediumFast' | 'mediumSlow' | 'slow';

export type StatusCondition = 'paralysis' | 'sleep' | 'poison' | 'burn' | 'freeze' | null;

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

  type: 'status' | 'stat' | 'drain' | 'recoil' | 'flinch' | 'charge' | 'multi' | 'disable' | 'mist' | 'ohko' | 'trap' | 'force_switch' | 'fixed_damage' | 'rampage' | 'recoil_crash' | 'money' | 'critical';
  status?: StatusCondition;
  chance?: number;
  stat?: StatName;
  stages?: number;
  amount?: number; // For drain/recoil/fixed_damage (percent or fixed value)
  min?: number; // For multi-hit
  max?: number; // For multi-hit
  count?: number; // For fixed multi-hit
}

// ===== Instance (in-game Pokémon) =====

export interface VolatileStatus {
  confusion: number; // 0 = not confused, >0 = turns remaining
  flinch: boolean;
  leechSeed: boolean;
  bound: number; // For trapping moves like Wrap/Bind
  charging?: number; // moveId being charged
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
}

export interface MoveInstance {
  moveId: number;
  currentPp: number;
  maxPp: number;
}
