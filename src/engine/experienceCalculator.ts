import { PokemonInstance, BaseStats, ExpGroup, PokemonData } from '../types/pokemon';
import { getPokemonData } from '../utils/dataLoader';

/**
 * XP gained from defeating a Pokémon
 * Trainer: (BaseXP * EnemyLevel * 1.5) / 7
 * Wild:    (BaseXP * EnemyLevel) / 7
 */
export function calculateXpGain(
  defeatedPokemonId: number,
  defeatedLevel: number,
  isTrainerBattle: boolean
): number {
  const data = getPokemonData(defeatedPokemonId);
  const base = data.baseExp * defeatedLevel;
  const xp = isTrainerBattle ? (base * 1.5) / 7 : base / 7;
  return Math.floor(xp);
}

/**
 * XP required for a given level based on experience group
 */
export function xpForLevel(level: number, group: ExpGroup): number {
  const n = level;
  switch (group) {
    case 'fast':
      return Math.floor(0.8 * n * n * n);
    case 'mediumFast':
      return n * n * n;
    case 'mediumSlow':
      return Math.floor((6 * n * n * n) / 5 - 15 * n * n + 100 * n - 140);
    case 'slow':
      return Math.floor(1.25 * n * n * n);
    default:
      return n * n * n;
  }
}

/**
 * Calculate stat value using the Gen III+ formula
 * HP = ((IV + 2*Base + EV/4) * Level/100) + Level + 10
 * Other = ((IV + 2*Base + EV/4) * Level/100) + 5
 */
export function calculateStat(
  statName: keyof BaseStats,
  base: number,
  iv: number,
  ev: number,
  level: number
): number {
  const core = Math.floor(((iv + 2 * base + Math.floor(ev / 4)) * level) / 100);
  if (statName === 'hp') {
    return core + level + 10;
  }
  return core + 5;
}

/**
 * Recalculate all stats for a Pokémon instance
 */
export function recalculateStats(pokemon: PokemonInstance): BaseStats {
  const data = getPokemonData(pokemon.dataId);
  const stats: BaseStats = {
    hp: calculateStat('hp', data.baseStats.hp, pokemon.ivs.hp, pokemon.evs.hp, pokemon.level),
    attack: calculateStat('attack', data.baseStats.attack, pokemon.ivs.attack, pokemon.evs.attack, pokemon.level),
    defense: calculateStat('defense', data.baseStats.defense, pokemon.ivs.defense, pokemon.evs.defense, pokemon.level),
    spAtk: calculateStat('spAtk', data.baseStats.spAtk, pokemon.ivs.spAtk, pokemon.evs.spAtk, pokemon.level),
    spDef: calculateStat('spDef', data.baseStats.spDef, pokemon.ivs.spDef, pokemon.evs.spDef, pokemon.level),
    speed: calculateStat('speed', data.baseStats.speed, pokemon.ivs.speed, pokemon.evs.speed, pokemon.level),
  };
  return stats;
}

/**
 * Apply EV gains from defeating a Pokémon (max 510 total, 255 per stat)
 */
export function applyEvGains(pokemon: PokemonInstance, defeatedId: number): BaseStats {
  const defeated = getPokemonData(defeatedId);
  const evYield = defeated.evYield;
  const newEvs = { ...pokemon.evs };

  let currentTotal = Object.values(newEvs).reduce((sum, v) => sum + v, 0);
  const MAX_TOTAL = 510;
  const MAX_PER_STAT = 255;

  for (const [stat, gain] of Object.entries(evYield)) {
    if (gain === undefined) continue;
    const key = stat as keyof BaseStats;
    const remaining = Math.min(MAX_TOTAL - currentTotal, MAX_PER_STAT - newEvs[key]);
    const actualGain = Math.min(gain, remaining);
    newEvs[key] += actualGain;
    currentTotal += actualGain;
  }

  return newEvs;
}

export interface LevelUpResult {
  newLevel: number;
  newStats: BaseStats;
  newMaxHp: number;
  newXpToNextLevel: number;
  learnableMoves: number[];
  canEvolve: boolean;
  evolutionId: number | null;
}

/**
 * Process leveling up - may gain multiple levels at once
 */
export function processLevelUp(pokemon: PokemonInstance): LevelUpResult | null {
  const data = getPokemonData(pokemon.dataId);
  const nextLevelXp = xpForLevel(pokemon.level + 1, data.expGroup);

  if (pokemon.xp < nextLevelXp) return null;

  let newLevel = pokemon.level + 1;
  // Check for multiple level ups
  while (newLevel < 100 && pokemon.xp >= xpForLevel(newLevel + 1, data.expGroup)) {
    newLevel++;
  }

  // Temporarily set level for stat calculation
  const tempPokemon = { ...pokemon, level: newLevel };
  const newStats = recalculateStats(tempPokemon);
  const oldMaxHp = pokemon.maxHp;
  const newMaxHp = newStats.hp;

  // Find moves learnable between old and new level
  const learnableMoves: number[] = [];
  for (const entry of data.learnset) {
    if (entry.level > pokemon.level && entry.level <= newLevel) {
      learnableMoves.push(entry.moveId);
    }
  }

  // Check evolution
  let canEvolve = false;
  let evolutionId: number | null = null;
  for (const evo of data.evolutions) {
    if (evo.method === 'level' && evo.level !== undefined && newLevel >= evo.level) {
      canEvolve = true;
      evolutionId = evo.evolvesInto;
      break;
    }
  }

  return {
    newLevel,
    newStats,
    newMaxHp,
    newXpToNextLevel: xpForLevel(newLevel + 1, data.expGroup),
    learnableMoves,
    canEvolve,
    evolutionId,
  };
}

/**
 * Generate random IVs (0-31 for each stat)
 */
export function generateIVs(): BaseStats {
  return {
    hp: Math.floor(Math.random() * 32),
    attack: Math.floor(Math.random() * 32),
    defense: Math.floor(Math.random() * 32),
    spAtk: Math.floor(Math.random() * 32),
    spDef: Math.floor(Math.random() * 32),
    speed: Math.floor(Math.random() * 32),
  };
}

/**
 * Create empty EVs
 */
export function emptyEvs(): BaseStats {
  return { hp: 0, attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 };
}

/**
 * Create a new PokemonInstance from data
 */
export function createPokemonInstance(
  dataId: number,
  level: number,
  moveIds?: number[]
): PokemonInstance {
  const data = getPokemonData(dataId);
  const ivs = generateIVs();
  const evs = emptyEvs();

  const uid = `${dataId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Calculate stats
  const stats: BaseStats = {
    hp: calculateStat('hp', data.baseStats.hp, ivs.hp, evs.hp, level),
    attack: calculateStat('attack', data.baseStats.attack, ivs.attack, evs.attack, level),
    defense: calculateStat('defense', data.baseStats.defense, ivs.defense, evs.defense, level),
    spAtk: calculateStat('spAtk', data.baseStats.spAtk, ivs.spAtk, evs.spAtk, level),
    spDef: calculateStat('spDef', data.baseStats.spDef, ivs.spDef, evs.spDef, level),
    speed: calculateStat('speed', data.baseStats.speed, ivs.speed, evs.speed, level),
  };

  // Determine moves
  let assignedMoveIds: number[];
  if (moveIds && moveIds.length > 0) {
    assignedMoveIds = moveIds.slice(0, 4);
  } else {
    // Learn the last 4 moves from learnset up to current level
    const available = data.learnset
      .filter(e => e.level <= level)
      .map(e => e.moveId);
    assignedMoveIds = available.slice(-4);
  }

  const moves = assignedMoveIds.map(id => {
    // We'll need getMoveData but import would be circular - use a safe default
    return { moveId: id, currentPp: 99, maxPp: 99 };
  });

  const xpCurrent = xpForLevel(level, data.expGroup);
  const xpNext = xpForLevel(level + 1, data.expGroup);

  return {
    uid,
    dataId,
    nickname: null,
    level,
    currentHp: stats.hp,
    maxHp: stats.hp,
    stats,
    ivs,
    evs,
    moves,
    status: null,
    statusTurns: 0,
    volatile: {
      confusion: 0,
      flinch: false,
      leechSeed: false,
      bound: 0,
    },
    statStages: { hp: 0, attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 },
    xp: xpCurrent,
    xpToNextLevel: xpNext,
    friendship: 70,
  };
}

/**
 * Create a PokemonInstance and correctly set PP from move data
 */
export function createPokemonWithMoves(
  dataId: number,
  level: number,
  moveIds?: number[],
  getMoveData?: (id: number) => { pp: number }
): PokemonInstance {
  const instance = createPokemonInstance(dataId, level, moveIds);

  if (getMoveData) {
    instance.moves = instance.moves.map(m => {
      const data = getMoveData(m.moveId);
      return { moveId: m.moveId, currentPp: data.pp, maxPp: data.pp };
    });
  }

  return instance;
}
