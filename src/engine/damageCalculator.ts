import { PokemonInstance, MoveData, PokemonType } from '../types/pokemon';
import { DamageResult } from '../types/battle';
import { getPokemonData, getTypeEffectiveness } from '../utils/dataLoader';
import { getEffectiveStat } from './statCalculator';

/**
 * Pokémon damage formula (Gen III+):
 * Damage = ((((2*Level/5 + 2) * Power * Atk/Def) / 50) + 2) * Modifiers
 *
 * Modifiers = STAB * TypeEffectiveness * Critical * Random(0.85-1.00)
 */
export function calculateDamage(
  attacker: PokemonInstance,
  defender: PokemonInstance,
  move: MoveData
): DamageResult {
  // Status moves do no damage
  if (move.category === 'status' || move.power === null) {
    return { damage: 0, effectiveness: 1, isCritical: false, stab: false };
  }

  const attackerData = getPokemonData(attacker.dataId);
  const defenderData = getPokemonData(defender.dataId);

  // Critical hit check (1/16 chance)
  const isCritical = Math.random() < (1 / 16);

  // Physical vs Special split
  // Critical hits ignore attacker's negative attack stages and defender's positive defense stages
  const atkStat = move.category === 'physical' ? 'attack' : 'spAtk';
  const defStat = move.category === 'physical' ? 'defense' : 'spDef';

  let atk: number;
  let def: number;

  if (isCritical) {
    // Use raw stat if attacker has negative stages, otherwise use effective stat
    atk = attacker.statStages[atkStat] < 0
      ? attacker.stats[atkStat]
      : getEffectiveStat(attacker, atkStat);
    // Use raw stat if defender has positive stages, otherwise use effective stat
    def = defender.statStages[defStat] > 0
      ? defender.stats[defStat]
      : getEffectiveStat(defender, defStat);
  } else {
    atk = getEffectiveStat(attacker, atkStat);
    def = getEffectiveStat(defender, defStat);
  }

  // Base damage
  const levelFactor = ((2 * attacker.level) / 5 + 2);
  let baseDamage = Math.floor((levelFactor * move.power * atk / def) / 50) + 2;

  // STAB (Same Type Attack Bonus)
  const stab = attackerData.types.includes(move.type);
  if (stab) {
    baseDamage = Math.floor(baseDamage * 1.5);
  }

  // Type effectiveness
  const effectiveness = getTypeEffectiveness(move.type, defenderData.types as PokemonType[]);
  baseDamage = Math.floor(baseDamage * effectiveness);

  // Critical hit multiplier (1.5x)
  if (isCritical) {
    baseDamage = Math.floor(baseDamage * 1.5);
  }

  // Random factor (85-100%)
  const randomFactor = 0.85 + Math.random() * 0.15;
  baseDamage = Math.floor(baseDamage * randomFactor);

  // Burn penalty is already applied in getEffectiveStat for attack

  // Minimum 1 damage for damaging moves
  if (baseDamage < 1) baseDamage = 1;

  return {
    damage: baseDamage,
    effectiveness,
    isCritical,
    stab,
  };
}
