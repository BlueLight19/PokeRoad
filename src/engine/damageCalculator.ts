import { PokemonInstance, MoveData, PokemonType } from '../types/pokemon';
import { DamageResult } from '../types/battle';
import { getPokemonData, getTypeEffectiveness } from '../utils/dataLoader';
import { getEffectiveStat } from './statCalculator';

/**
 * Pokémon damage formula:
 * Damage = ((((2*Level/5 + 2) * Power * Atk/Def) / 50) + 2) * Modifiers
 */
export function calculateDamage(
  attacker: PokemonInstance,
  defender: PokemonInstance,
  move: MoveData,
  attackerBadges: string[] = []
): DamageResult {
  // Status moves do no damage
  if (move.category === 'status' || move.power === null) {
    return { damage: 0, effectiveness: 1, isCritical: false, stab: false };
  }

  const attackerData = getPokemonData(attacker.dataId);
  const defenderData = getPokemonData(defender.dataId);

  // Critical hit check (Gen 1 style: based on base speed)
  // Base chance: BaseSpeed / 512. For simplicity, we'll use a slightly boosted version or 1/16 if data missing.
  const baseSpeed = attackerData.baseStats.speed;
  let critThreshold = baseSpeed / 512;
  // High crit moves have 8x multiplier in Gen 1
  if (move.effect?.type === 'high_crit') critThreshold *= 8;
  const isCritical = Math.random() < Math.min(0.99, critThreshold);

  // Physical vs Special split
  const atkStat = move.category === 'physical' ? 'attack' : 'spAtk';
  const defStat = move.category === 'physical' ? 'defense' : 'spDef';

  let atk: number;
  let def: number;

  if (isCritical) {
    // Critical hits ignore stat stages in Gen 1 if they are detrimental
    atk = attacker.statStages[atkStat] < 0 ? attacker.stats[atkStat] : getEffectiveStat(attacker, atkStat);
    def = defender.statStages[defStat] > 0 ? defender.stats[defStat] : getEffectiveStat(defender, defStat);
  } else {
    atk = getEffectiveStat(attacker, atkStat);
    def = getEffectiveStat(defender, defStat);
  }

  // Badge Boosts (Gen 1: 1.125x boost to stats)
  // Boulder (Roche): Attack, Cascade: Speed, Thunder (Foudre): Defense, Rainbow (Prisme): Special
  if (attackerBadges.length > 0) {
    if (attackerBadges.includes('badge-roche') && atkStat === 'attack') atk = Math.floor(atk * 1.125);
    if (attackerBadges.includes('badge-foudre') && defStat === 'defense') def = Math.floor(def * 1.125);
    if (attackerBadges.includes('badge-prisme')) {
        if (atkStat === 'spAtk') atk = Math.floor(atk * 1.125);
        if (defStat === 'spDef') def = Math.floor(def * 1.125);
    }
  }

  // Base damage
  const levelFactor = Math.floor((2 * attacker.level) / 5 + 2);
  let baseDamage = Math.floor((levelFactor * move.power * atk / def) / 50) + 2;

  // STAB (Same Type Attack Bonus)
  const stab = attackerData.types.includes(move.type);
  if (stab) {
    baseDamage = Math.floor(baseDamage * 1.5);
  }

  // Type effectiveness
  const effectiveness = getTypeEffectiveness(move.type, defenderData.types as PokemonType[]);
  baseDamage = Math.floor(baseDamage * effectiveness);

  // Critical hit multiplier
  if (isCritical) {
    // Gen 1 Crits are 2x (or near 2x)
    baseDamage = Math.floor(baseDamage * 2);
  }

  // Random factor (85-100%)
  const randomFactor = 0.85 + Math.random() * 0.15;
  baseDamage = Math.floor(baseDamage * randomFactor);

  // Minimum 1 damage for damaging moves
  if (baseDamage < 1) baseDamage = 1;

  return {
    damage: baseDamage,
    effectiveness,
    isCritical,
    stab,
  };
}
