import { PokemonInstance } from '../types/pokemon';
import { getPokemonData } from '../utils/dataLoader';
import { recalculateStats, xpForLevel } from './experienceCalculator';

export interface EvolutionResult {
  evolved: boolean;
  newDataId: number;
  oldName: string;
  newName: string;
}

/**
 * Perform an evolution on a Pokémon instance
 * Updates dataId, recalculates stats, adjusts HP proportionally
 */
export function evolvePokemon(pokemon: PokemonInstance, targetId: number): EvolutionResult {
  const oldData = getPokemonData(pokemon.dataId);
  const newData = getPokemonData(targetId);

  const oldName = pokemon.nickname || oldData.name;
  const hpRatio = pokemon.currentHp / pokemon.maxHp;

  // Update dataId
  pokemon.dataId = targetId;

  // Recalculate stats with new base stats
  pokemon.stats = recalculateStats(pokemon);
  pokemon.maxHp = pokemon.stats.hp;
  pokemon.currentHp = Math.max(1, Math.floor(pokemon.maxHp * hpRatio));

  // Update XP thresholds (exp group may change)
  pokemon.xpToNextLevel = xpForLevel(pokemon.level + 1, newData.expGroup);

  return {
    evolved: true,
    newDataId: targetId,
    oldName,
    newName: newData.name,
  };
}

/**
 * Check if a Pokémon can evolve by level
 */
export function checkLevelEvolution(pokemon: PokemonInstance): number | null {
  const data = getPokemonData(pokemon.dataId);

  for (const evo of data.evolutions) {
    if (evo.method === 'level' && evo.level !== undefined && pokemon.level >= evo.level) {
      return evo.evolvesInto;
    }
  }

  return null;
}

/**
 * Check if a Pokémon can evolve with a specific stone
 */
export function checkStoneEvolution(pokemon: PokemonInstance, stoneId: string): number | null {
  const data = getPokemonData(pokemon.dataId);

  for (const evo of data.evolutions) {
    if (evo.method === 'stone' && evo.stone === stoneId) {
      return evo.evolvesInto;
    }
  }

  return null;
}
