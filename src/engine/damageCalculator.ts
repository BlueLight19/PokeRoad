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

  // Physical vs Special split
  const atk = move.category === 'physical'
    ? getEffectiveStat(attacker, 'attack')
    : getEffectiveStat(attacker, 'spAtk');

  const def = move.category === 'physical'
    ? getEffectiveStat(defender, 'defense')
    : getEffectiveStat(defender, 'spDef');

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

  // Critical hit (1/16 chance, 1.5x multiplier)
  const isCritical = Math.random() < (1 / 16);
  if (isCritical) {
    baseDamage = Math.floor(baseDamage * 1.5);
  }

  // Random factor (85-100%)
  const randomFactor = 0.85 + Math.random() * 0.15;
  baseDamage = Math.floor(baseDamage * randomFactor);

  // Burn halves physical attack damage
  if (attacker.status === 'burn' && move.category === 'physical') {
    baseDamage = Math.floor(baseDamage * 0.5);
  }

  // Minimum 1 damage for damaging moves
  if (baseDamage < 1) baseDamage = 1;

  return {
    damage: baseDamage,
    effectiveness,
    isCritical,
    stab,
  };
}
