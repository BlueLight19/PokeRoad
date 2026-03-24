import { PokemonInstance, MoveData, PokemonType } from '../types/pokemon';
import { DamageResult, SideConditions } from '../types/battle';
import { getPokemonData, getTypeEffectiveness } from '../utils/dataLoader';
import { getEffectiveStat } from './statCalculator';
import { abilityBlocksCrit, triggerAbility, abilityIsMoldBreaker, abilityIsScrappy } from './abilityEffects';
import { triggerHeldItem } from './heldItemEffects';

/**
 * Pokémon damage formula:
 * Damage = ((((2*Level/5 + 2) * Power * Atk/Def) / 50) + 2) * Modifiers
 */
export function calculateDamage(
  attacker: PokemonInstance,
  defender: PokemonInstance,
  move: MoveData,
  attackerBadges: string[] = [],
  weather: 'sun' | 'rain' | 'sandstorm' | 'hail' | null = null,
  defenderSide?: SideConditions
): DamageResult {
  // Status moves do no damage
  if (move.category === 'status' || move.power === null) {
    return { damage: 0, effectiveness: 1, isCritical: false, stab: false };
  }

  const attackerData = getPokemonData(attacker.dataId);
  const defenderData = getPokemonData(defender.dataId);

  // Critical hit check (Gen 9 standard: stage-based)
  // Shell Armor / Battle Armor block crits (unless attacker has Mold Breaker)
  const defenderBlocksCrit = abilityBlocksCrit(defender.ability) && !abilityIsMoldBreaker(attacker.ability);
  let critStage = 0;
  if (move.effect?.type === 'critical' || (move.effect as any)?.high_crit) critStage += 1;
  // Focus Energy: +2 crit stage
  if (attacker.volatile.focusEnergy) critStage += 2;
  // Held item crit boost (Scope Lens, Razor Claw)
  const critItemResult = triggerHeldItem(attacker, 'modify-crit', { opponent: defender, move });
  if (critItemResult.critStageBonus) critStage += critItemResult.critStageBonus;
  const critRates = [1 / 24, 1 / 8, 1 / 2, 1, 1];
  const critChance = critRates[Math.min(critStage, 4)];
  const isCritical = !defenderBlocksCrit && Math.random() < critChance;

  // Physical vs Special split
  const atkStat = move.category === 'physical' ? 'attack' : 'spAtk';
  const defStat = move.category === 'physical' ? 'defense' : 'spDef';

  let atk: number;
  let def: number;

  if (isCritical) {
    // Gen 9: crits ignore attacker's negative atk stages and defender's positive def stages
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

  // Weather modifier (sun: fire x1.5 water x0.5, rain: water x1.5 fire x0.5)
  if (weather === 'sun') {
    if (move.type === 'fire') baseDamage = Math.floor(baseDamage * 1.5);
    else if (move.type === 'water') baseDamage = Math.floor(baseDamage * 0.5);
  } else if (weather === 'rain') {
    if (move.type === 'water') baseDamage = Math.floor(baseDamage * 1.5);
    else if (move.type === 'fire') baseDamage = Math.floor(baseDamage * 0.5);
  }

  // Type effectiveness
  let effectiveness = getTypeEffectiveness(move.type, defenderData.types as PokemonType[]);
  // Scrappy: Normal/Fighting moves hit Ghost types (remove Ghost immunity)
  if (effectiveness === 0 && abilityIsScrappy(attacker.ability) && (move.type === 'normal' || move.type === 'fighting') && defenderData.types.includes('ghost' as PokemonType)) {
    effectiveness = 1;
  }
  baseDamage = Math.floor(baseDamage * effectiveness);

  // Critical hit multiplier (Gen 9: 1.5x, Sniper: 2.25x)
  if (isCritical) {
    const critMult = attacker.ability === 'sniper' ? 2.25 : 1.5;
    baseDamage = Math.floor(baseDamage * critMult);
  }

  // Screen damage reduction (Gen 9: 0.5x, ignored by crits)
  if (!isCritical && defenderSide) {
    if (move.category === 'physical' && (defenderSide.reflect > 0 || defenderSide.auroraVeil > 0)) {
      baseDamage = Math.floor(baseDamage * 0.5);
    } else if (move.category === 'special' && (defenderSide.lightScreen > 0 || defenderSide.auroraVeil > 0)) {
      baseDamage = Math.floor(baseDamage * 0.5);
    }
  }

  // Attacker ability damage modifier (Overgrow, Blaze, Torrent, Guts, Technician, etc.)
  if (attacker.ability) {
    const atkAbilityResult = triggerAbility(attacker.ability, 'modify-damage', {
      pokemon: attacker, opponent: defender, trigger: 'modify-damage',
      move, pokemonName: '', weather,
    });
    if (atkAbilityResult.damageMultiplier) {
      baseDamage = Math.floor(baseDamage * atkAbilityResult.damageMultiplier);
    }
  }

  // Defender ability damage modifier (Thick Fat, Filter, Solid Rock, Dry Skin)
  if (defender.ability && !abilityIsMoldBreaker(attacker.ability)) {
    const defAbilityResult = triggerAbility(defender.ability, 'modify-damage', {
      pokemon: defender, opponent: attacker, trigger: 'modify-damage',
      move, pokemonName: '', weather,
    });
    if (defAbilityResult.damageMultiplier) {
      baseDamage = Math.floor(baseDamage * defAbilityResult.damageMultiplier);
    }
  }

  // Attacker held item damage modifier (type boost, Life Orb, Choice Band, etc.)
  const atkItemResult = triggerHeldItem(attacker, 'modify-damage', {
    opponent: defender, move, effectiveness, weather,
  });
  if (atkItemResult.damageMultiplier) {
    baseDamage = Math.floor(baseDamage * atkItemResult.damageMultiplier);
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
