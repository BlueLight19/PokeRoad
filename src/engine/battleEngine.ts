import { PokemonInstance, MoveData, StatusCondition, MoveInstance, freshVolatile, freshStatStages } from '../types/pokemon';
import { BattleLogEntry, BattleAction, SideConditions } from '../types/battle';
import { calculateDamage, } from './damageCalculator';
import { getEffectiveStat } from './statCalculator';
import { getMoveData, getPokemonData, getTypeEffectiveness } from '../utils/dataLoader';
import { getEffectHandler, EffectContext } from './moveEffects';
import {
  triggerAbility, abilityIsNoGuard, abilityIsCompoundEyes,
  abilityIsSkillLink, abilityBlocksFlinch, abilityBlocksRecoil,
  abilityIsSturdy, abilityIsMoldBreaker,
} from './abilityEffects';
import { triggerHeldItem, heldItemBlocksHazards } from './heldItemEffects';

/**
 * Core battle engine - handles turn execution, status effects, etc.
 * Stateless functions that operate on Pokémon instances.
 */

// ===== Status Effects =====

export function applyStatusDamage(pokemon: PokemonInstance, opponent?: PokemonInstance): BattleLogEntry[] {
  const logs: BattleLogEntry[] = [];
  const originalPush = logs.push.bind(logs);
  logs.push = (...items: BattleLogEntry[]) => {
    for (const item of items) {
      if (!item.state) {
        item.state = {
          attackerHp: pokemon.currentHp,
          attackerStatus: pokemon.status,
        };
      }
      originalPush(item);
    }
    return logs.length;
  };

  const name = pokemon.nickname || getPokemonData(pokemon.dataId).name;

  if (pokemon.currentHp <= 0) return logs;

  // Poison damage (1/8 max HP)
  if (pokemon.status === 'poison') {
    const damage = Math.max(1, Math.floor(pokemon.maxHp / 8));
    pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
    logs.push({ message: `${name} souffre du poison ! (-${damage} PV)`, type: 'status' });
  }

  // Toxic damage (escalating: 1/16 * counter per turn)
  if (pokemon.status === 'toxic') {
    pokemon.volatile.toxicCounter = Math.min(15, pokemon.volatile.toxicCounter + 1);
    const damage = Math.max(1, Math.floor(pokemon.maxHp * pokemon.volatile.toxicCounter / 16));
    pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
    logs.push({ message: `${name} souffre gravement du poison ! (-${damage} PV)`, type: 'status' });
  }

  // Burn damage (1/16 max HP)
  if (pokemon.status === 'burn') {
    const damage = Math.max(1, Math.floor(pokemon.maxHp / 16));
    pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
    logs.push({ message: `${name} souffre de sa brûlure ! (-${damage} PV)`, type: 'status' });
  }

  // Trap damage (Wrap/Bind/Fire Spin: 1/8 max HP per turn)
  if (pokemon.volatile.bound > 0) {
    pokemon.volatile.bound--;
    const damage = Math.max(1, Math.floor(pokemon.maxHp / 8));
    pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
    logs.push({ message: `${name} est blessé par l'étreinte ! (-${damage} PV)`, type: 'status' });
    if (pokemon.volatile.bound <= 0) {
      logs.push({ message: `${name} se libère !`, type: 'info' });
    }
  }

  // Leech Seed drain (1/8 max HP, heal opponent)
  if (pokemon.volatile.leechSeed && pokemon.currentHp > 0) {
    const damage = Math.max(1, Math.floor(pokemon.maxHp / 8));
    pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
    logs.push({ message: `Vampigraine draine ${name} ! (-${damage} PV)`, type: 'status' });
    if (opponent && opponent.currentHp > 0) {
      opponent.currentHp = Math.min(opponent.maxHp, opponent.currentHp + damage);
    }
  }

  // Curse damage (1/4 max HP per turn)
  if (pokemon.volatile.cursed && pokemon.currentHp > 0) {
    const damage = Math.max(1, Math.floor(pokemon.maxHp / 4));
    pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
    logs.push({ message: `${name} est blessé par la malédiction ! (-${damage} PV)`, type: 'status' });
  }

  // Recharging state is consumed at the start of executeMove, not here

  // Decrement volatile timers
  if (pokemon.volatile.disabled) {
    pokemon.volatile.disabled.turns--;
    if (pokemon.volatile.disabled.turns <= 0) {
      pokemon.volatile.disabled = undefined;
    }
  }
  if (pokemon.volatile.mistTurns > 0) {
    pokemon.volatile.mistTurns--;
  }

  // Encore timer
  if (pokemon.volatile.encoreTurns > 0) {
    pokemon.volatile.encoreTurns--;
    if (pokemon.volatile.encoreTurns <= 0) {
      pokemon.volatile.encoreMoveId = undefined;
      logs.push({ message: `L'effet de Encore s'estompe !`, type: 'info' });
    }
  }

  // Perish Song countdown
  if (pokemon.volatile.perishTurns >= 0) {
    logs.push({ message: `${name} : Requiem ${pokemon.volatile.perishTurns} !`, type: 'info' });
    if (pokemon.volatile.perishTurns === 0) {
      pokemon.currentHp = 0;
      logs.push({ message: `${name} est K.O. par le Requiem !`, type: 'info' });
    }
    pokemon.volatile.perishTurns--;
  }

  // Future Sight / Doom Desire: delayed damage lands
  if (pokemon.volatile.futureAttack && pokemon.currentHp > 0) {
    pokemon.volatile.futureAttack.turnsLeft--;
    if (pokemon.volatile.futureAttack.turnsLeft <= 0) {
      const fa = pokemon.volatile.futureAttack;
      pokemon.currentHp = Math.max(0, pokemon.currentHp - fa.damage);
      logs.push({ message: `${fa.moveName} frappe ${name} ! (-${fa.damage} PV)`, type: 'damage' });
      pokemon.volatile.futureAttack = undefined;
    }
  }

  // Ingrain: heal 1/16 max HP per turn
  if (pokemon.volatile.ingrain && pokemon.currentHp > 0 && pokemon.currentHp < pokemon.maxHp) {
    const heal = Math.max(1, Math.floor(pokemon.maxHp / 16));
    pokemon.currentHp = Math.min(pokemon.maxHp, pokemon.currentHp + heal);
    logs.push({ message: `${name} récupère des PV grâce à Enracinement ! (+${heal} PV)`, type: 'heal' });
  }

  // Aqua Ring: heal 1/16 max HP per turn
  if (pokemon.volatile.aquaRing && pokemon.currentHp > 0 && pokemon.currentHp < pokemon.maxHp) {
    const heal = Math.max(1, Math.floor(pokemon.maxHp / 16));
    pokemon.currentHp = Math.min(pokemon.maxHp, pokemon.currentHp + heal);
    logs.push({ message: `${name} récupère des PV grâce à Anneau Hydro ! (+${heal} PV)`, type: 'heal' });
  }

  // Yawn: fall asleep at end of the turn after being yawned
  if (pokemon.volatile.yawned && pokemon.currentHp > 0) {
    pokemon.volatile.yawned = false;
    if (pokemon.status === null) {
      pokemon.status = 'sleep';
      pokemon.statusTurns = 1 + Math.floor(Math.random() * 3);
      logs.push({ message: `${name} s'endort à cause du Bâillement !`, type: 'status' });
    }
  }

  // Decrement safeguard turns
  if (pokemon.volatile.safeguardTurns > 0) {
    pokemon.volatile.safeguardTurns--;
    if (pokemon.volatile.safeguardTurns <= 0) {
      logs.push({ message: `L'effet de Protection s'estompe !`, type: 'info' });
    }
  }

  // Decrement taunt turns
  if (pokemon.volatile.tauntTurns > 0) {
    pokemon.volatile.tauntTurns--;
    if (pokemon.volatile.tauntTurns <= 0) {
      logs.push({ message: `L'effet de Provocation s'estompe !`, type: 'info' });
    }
  }

  // Decrement Magnet Rise
  if (pokemon.volatile.magnetRise > 0) {
    pokemon.volatile.magnetRise--;
  }

  // Reset protect (only lasts one turn)
  pokemon.volatile.protected = false;

  // Reset endure (only lasts one turn)
  pokemon.volatile.endure = false;

  return logs;
}

// Sleep Talk (214) and Snore (173) can be used while asleep
const SLEEP_USABLE_MOVES = new Set([214, 173]);

export function checkStatusBlock(pokemon: PokemonInstance, moveId?: number): { blocked: boolean; logs: BattleLogEntry[] } {
  const logs: BattleLogEntry[] = [];
  const originalPush = logs.push.bind(logs);
  logs.push = (...items: BattleLogEntry[]) => {
    for (const item of items) {
      if (!item.state) {
        item.state = {
          attackerHp: pokemon.currentHp,
          attackerStatus: pokemon.status,
        };
      }
      originalPush(item);
    }
    return logs.length;
  };

  const name = pokemon.nickname || getPokemonData(pokemon.dataId).name;

  // Flinch (Peur)
  if (pokemon.volatile.flinch) {
    pokemon.volatile.flinch = false; // Consumed
    logs.push({ message: `${name} a peur !`, type: 'status' });
    return { blocked: true, logs };
  }

  // Confusion
  if (pokemon.volatile.confusion > 0) {
    pokemon.volatile.confusion--;
    logs.push({ message: `${name} est confus !`, type: 'status' });
    if (Math.random() < 0.5) {
      // Hurt self: Power 40 physical hit (uses effective stats for attack/defense)
      const confAtk = getEffectiveStat(pokemon, 'attack');
      const confDef = getEffectiveStat(pokemon, 'defense');
      const damage = Math.floor((((2 * pokemon.level / 5 + 2) * 40 * confAtk / confDef) / 50) + 2);
      pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
      logs.push({ message: `Il se blesse dans sa confusion !`, type: 'damage' });
      return { blocked: true, logs };
    }
  }

  if (pokemon.status === 'paralysis') {
    if (Math.random() < 0.25) {
      logs.push({ message: `${name} est paralysé ! Il ne peut pas attaquer !`, type: 'status' });
      return { blocked: true, logs };
    }
  }

  if (pokemon.status === 'sleep') {
    pokemon.statusTurns--;
    if (pokemon.statusTurns <= 0) {
      pokemon.status = null;
      pokemon.statusTurns = 0;
      logs.push({ message: `${name} se réveille !`, type: 'status' });
      return { blocked: false, logs };
    }
    // Sleep Talk / Snore can be used while asleep
    if (moveId && SLEEP_USABLE_MOVES.has(moveId)) {
      logs.push({ message: `${name} dort...`, type: 'status' });
      return { blocked: false, logs };
    }
    logs.push({ message: `${name} dort profondément...`, type: 'status' });
    return { blocked: true, logs };
  }

  if (pokemon.status === 'freeze') {
    if (Math.random() < 0.2) {
      pokemon.status = null;
      pokemon.statusTurns = 0;
      logs.push({ message: `${name} a dégelé !`, type: 'status' });
      return { blocked: false, logs };
    }
    logs.push({ message: `${name} est gelé et ne peut pas bouger !`, type: 'status' });
    return { blocked: true, logs };
  }

  return { blocked: false, logs };
}

/**
 * Try to apply a status effect from a move
 */
export function tryApplyStatus(
  target: PokemonInstance,
  move: MoveData
): BattleLogEntry[] {
  const logs: BattleLogEntry[] = [];
  const name = target.nickname || getPokemonData(target.dataId).name;

  if (!move.effect) return logs;
  if (move.effect.type !== 'status') return logs;
  if (!move.effect.status) return logs;

  const chance = move.effect.chance ?? 100;
  if (Math.random() * 100 > chance) return logs;

  // Safeguard blocks status conditions from opponents
  if (target.volatile.safeguardTurns > 0) {
    logs.push({ message: `${name} est protégé par Protection !`, type: 'info' });
    return logs;
  }

  // Handle Confusion (Volatile)
  // Cast to specific comparison because string might be 'confusion' coming from JSON
  if ((move.effect.status as string) === 'confusion') {
    if (target.volatile.confusion > 0) {
      logs.push({ message: `${name} est déjà confus !`, type: 'info' });
      return logs;
    }
    target.volatile.confusion = 2 + Math.floor(Math.random() * 4); // 2-5 turns
    logs.push({ message: `${name} devient confus !`, type: 'status' });
    return logs;
  }

  // Already has a persistent status
  if (target.status !== null) return logs;

  // Ability-based status immunities
  if (target.ability && move.effect.status) {
    const abilityResult = triggerAbility(target.ability, 'on-status', {
      pokemon: target, trigger: 'on-status',
      statusToApply: move.effect.status as string,
      pokemonName: name,
    });
    if (abilityResult.prevented) {
      logs.push(...abilityResult.logs);
      return logs;
    }
  }

  // Type-based status immunities (Gen 9)
  const targetData = getPokemonData(target.dataId);
  const targetTypes = targetData.types as string[];
  const statusToApply = move.effect.status;
  if (statusToApply === 'burn' && targetTypes.includes('fire')) {
    logs.push({ message: `Ça n'affecte pas ${name}...`, type: 'info' });
    return logs;
  }
  if (statusToApply === 'paralysis' && targetTypes.includes('electric')) {
    logs.push({ message: `Ça n'affecte pas ${name}...`, type: 'info' });
    return logs;
  }
  if ((statusToApply === 'poison' || statusToApply === 'toxic') && (targetTypes.includes('poison') || targetTypes.includes('steel'))) {
    logs.push({ message: `Ça n'affecte pas ${name}...`, type: 'info' });
    return logs;
  }
  if (statusToApply === 'freeze' && targetTypes.includes('ice')) {
    logs.push({ message: `Ça n'affecte pas ${name}...`, type: 'info' });
    return logs;
  }

  target.status = move.effect.status;

  // Set sleep turns
  if (target.status === 'sleep') {
    target.statusTurns = 1 + Math.floor(Math.random() * 3); // 1-3 turns
  }

  // Reset toxic counter when newly toxic'd
  if (target.status === 'toxic') {
    target.volatile.toxicCounter = 0;
  }

  const statusNames: Record<string, string> = {
    paralysis: 'paralysé',
    sleep: 'endormi',
    poison: 'empoisonné',
    toxic: 'gravement empoisonné',
    burn: 'brûlé',
    freeze: 'gelé',
  };

  logs.push({
    message: `${name} est ${statusNames[target.status] || target.status} !`,
    type: 'status',
  });

  return logs;
}

/**
 * Apply stat changes from a move
 */
export function tryApplyStatChange(
  target: PokemonInstance,
  move: MoveData,
  isUser: boolean
): BattleLogEntry[] {
  const logs: BattleLogEntry[] = [];
  if (!move.effect || move.effect.type !== 'stat') return logs;

  const chance = move.effect.chance ?? 100;
  if (Math.random() * 100 > chance) return logs;

  // Stat Stage Modification
  const stat = move.effect.stat;
  const stages = move.effect.stages ?? 0;
  if (!stat || stages === 0) return logs;

  const targetName = target.nickname || getPokemonData(target.dataId).name;

  // Mist blocks opponent stat drops (not self-inflicted)
  if (!isUser && stages < 0 && target.volatile.mistTurns > 0) {
    logs.push({ message: `La Brume protège ${targetName} !`, type: 'info' });
    return logs;
  }

  // Apply stage (supports accuracy/evasion as extended battle stats)
  const currentStage = (target.statStages as any)[stat] ?? 0;
  const newStage = Math.max(-6, Math.min(6, currentStage + stages));

  if (currentStage === newStage) {
    logs.push({ message: `Les stats de ${targetName} ne peuvent pas aller plus loin !`, type: 'info' });
    return logs;
  }

  (target.statStages as any)[stat] = newStage;

  const direction = stages > 0 ? 'monte' : 'baisse';
  const intensity = Math.abs(stages) > 1 ? 'beaucoup' : '';

  const statNames: Record<string, string> = {
    attack: 'Attaque',
    defense: 'Défense',
    spAtk: 'Attaque Spé.',
    spDef: 'Défense Spé.',
    speed: 'Vitesse',
    hp: 'PV',
    accuracy: 'Précision',
    evasion: 'Esquive',
  };

  logs.push({
    message: `${statNames[stat] || stat} de ${targetName} ${direction} ${intensity} !`,
    type: 'info',
  });

  return logs;
}

// ===== Turn Execution =====

export interface MoveExecutionResult {
  logs: BattleLogEntry[];
  defenderFainted: boolean;
}

/**
 * Execute a single move from attacker to defender
 */
export function executeMove(
  attacker: PokemonInstance,
  defender: PokemonInstance,
  moveInstance: MoveInstance,
  attackerBadges: string[] = [],
  weather: 'sun' | 'rain' | 'sandstorm' | 'hail' | null = null,
  attackerSide?: SideConditions,
  defenderSide?: SideConditions
): MoveExecutionResult {
  const logs: BattleLogEntry[] = [];
  const originalPush = logs.push.bind(logs);
  logs.push = (...items: BattleLogEntry[]) => {
    for (const item of items) {
      if (!item.state) {
        item.state = {
          attackerHp: attacker.currentHp,
          defenderHp: defender.currentHp,
          attackerStatus: attacker.status,
          defenderStatus: defender.status,
        };
      }
      originalPush(item);
    }
    return logs.length;
  };

  const move = getMoveData(moveInstance.moveId);
  const attackerName = attacker.nickname || getPokemonData(attacker.dataId).name;
  const defenderName = defender.nickname || getPokemonData(defender.dataId).name;

  // Recharge check: if recharging from a previous turn, skip this turn
  if (attacker.volatile.recharging) {
    attacker.volatile.recharging = false;
    logs.push({ message: `${attackerName} doit se reposer !`, type: 'info' });
    return { logs, defenderFainted: false };
  }

  logs.push({ message: `${attackerName} utilise ${move.name} !`, type: 'info' });

  // Deduct PP
  moveInstance.currentPp = Math.max(0, moveInstance.currentPp - 1);

  // Track last move used (for Disable)
  attacker.volatile.lastMoveUsed = move.id;

  // Protect check: if defender is protected, block the move
  if (defender.volatile.protected && move.target !== 'self') {
    logs.push({ message: `${defenderName} se protège !`, type: 'info' });
    return { logs, defenderFainted: false };
  }

  // Protect setup: if this move is protect-type, set flag and return
  if (move.effect?.type === 'protect') {
    // Consecutive use degrades success: 1/1, 1/2, 1/4, etc.
    const successChance = 1 / Math.pow(2, attacker.volatile.protectStreak);
    attacker.volatile.protectStreak++;
    if (Math.random() >= successChance) {
      logs.push({ message: `Mais cela échoue !`, type: 'info' });
      return { logs, defenderFainted: false };
    }
    attacker.volatile.protected = true;
    logs.push({ message: `${attackerName} se protège !`, type: 'info' });
    return { logs, defenderFainted: false };
  }

  // Reset protect streak if not using protect
  attacker.volatile.protectStreak = 0;

  // Charge Check (Solar Beam etc)
  if (move.effect?.type === 'charge') {
    if (attacker.volatile.charging !== move.id) {
      attacker.volatile.charging = move.id;
      logs.push({ message: `${attackerName} accumule de l'énergie !`, type: 'info' });
      return { logs, defenderFainted: false };
    } else {
      attacker.volatile.charging = undefined; // Unleash
    }
  }

  // Rampage: lock into move for 2-3 turns, confuse after
  if (move.effect?.type === 'rampage') {
    if (attacker.volatile.rampageTurns <= 0) {
      attacker.volatile.rampageTurns = 2 + Math.floor(Math.random() * 2); // 2-3
      attacker.volatile.rampageMoveId = move.id;
    }
    attacker.volatile.rampageTurns--;
    if (attacker.volatile.rampageTurns <= 0) {
      // Rampage ended, become confused
      attacker.volatile.rampageMoveId = undefined;
      attacker.volatile.confusion = 2 + Math.floor(Math.random() * 4);
      logs.push({ message: `${attackerName} devient confus par fatigue !`, type: 'status' });
    }
  }

  // Defender ability: absorb/immunity check (Levitate, Water Absorb, Volt Absorb, Flash Fire)
  if (defender.ability && move.target !== 'self' && !abilityIsMoldBreaker(attacker.ability)) {
    const absorbResult = triggerAbility(defender.ability, 'before-move', {
      pokemon: defender, opponent: attacker, trigger: 'before-move',
      move, pokemonName: defenderName, opponentName: attackerName,
    });
    if (absorbResult.prevented) {
      logs.push(...absorbResult.logs);
      return { logs, defenderFainted: false };
    }
  }

  // OHKO moves: special accuracy + instant KO
  if (move.effect?.type === 'ohko') {
    if (defender.level > attacker.level) {
      logs.push({ message: `Mais cela échoue !`, type: 'info' });
      return { logs, defenderFainted: false };
    }
    const hitChance = attacker.level - defender.level + 30;
    if (Math.random() * 100 >= hitChance) {
      logs.push({ message: `${attackerName} rate son attaque !`, type: 'info' });
      return { logs, defenderFainted: false };
    }
    defender.currentHp = 0;
    logs.push({ message: `K.O. en un coup !`, type: 'damage' });
    logs.push({ message: `${defenderName} est K.O. !`, type: 'info' });
    return { logs, defenderFainted: true };
  }

  // Fixed damage moves (Dragon Rage, Sonic Boom)
  if (move.effect?.type === 'fixed_damage') {
    // Still check accuracy
    if (move.accuracy !== null) {
      if (Math.random() * 100 > move.accuracy) {
        logs.push({ message: `${attackerName} rate son attaque !`, type: 'info' });
        return { logs, defenderFainted: false };
      }
    }
    const fixedAmount = move.effect.amount ?? 40;
    defender.currentHp = Math.max(0, defender.currentHp - fixedAmount);
    logs.push({ message: `${defenderName} perd ${fixedAmount} PV !`, type: 'damage' });
    const defenderFainted = defender.currentHp <= 0;
    if (defenderFainted) {
      logs.push({ message: `${defenderName} est K.O. !`, type: 'info' });
    }
    return { logs, defenderFainted };
  }

  // Future Sight (248) / Doom Desire (353): delayed attack — store damage, hit in 2 turns
  const FUTURE_MOVES = [248, 353];
  if (FUTURE_MOVES.includes(move.id)) {
    if (defender.volatile.futureAttack) {
      logs.push({ message: `Mais cela échoue !`, type: 'info' });
      return { logs, defenderFainted: false };
    }
    const result = calculateDamage(attacker, defender, move, attackerBadges, weather, defenderSide);
    defender.volatile.futureAttack = {
      moveId: move.id,
      damage: Math.max(1, result.damage),
      turnsLeft: 2,
      moveName: move.name,
    };
    logs.push({ message: `${attackerName} prévoit une attaque future !`, type: 'info' });
    return { logs, defenderFainted: false };
  }

  // No Guard: all moves hit (both attacker and defender)
  const noGuard = abilityIsNoGuard(attacker.ability) || abilityIsNoGuard(defender.ability);

  // Lock-On / Mind Reader: guaranteed hit this turn
  const lockOnActive = attacker.volatile.lockOn;
  if (lockOnActive) attacker.volatile.lockOn = false; // Consumed

  // Accuracy check (with accuracy/evasion stat stages)
  if (move.accuracy !== null && !noGuard && !lockOnActive) {
    // Accuracy stage multipliers: stages -6..+6 map to 3/9, 3/8, 3/7, 3/6, 3/5, 3/4, 3/3, 4/3, 5/3, 6/3, 7/3, 8/3, 9/3
    const accEvaStageMultiplier = (stage: number) => {
      if (stage >= 0) return (3 + stage) / 3;
      return 3 / (3 - stage);
    };
    const accStage = attacker.statStages.accuracy;
    const evaStage = defender.statStages.evasion;
    let baseAccuracy = move.accuracy;
    if (abilityIsCompoundEyes(attacker.ability)) baseAccuracy = Math.floor(baseAccuracy * 1.3);
    // Held item accuracy boost (Wide Lens, Zoom Lens)
    const accItemResult = triggerHeldItem(attacker, 'modify-accuracy', { move, opponent: defender });
    if (accItemResult.accuracyMultiplier) baseAccuracy = Math.floor(baseAccuracy * accItemResult.accuracyMultiplier);
    const effectiveAccuracy = baseAccuracy * accEvaStageMultiplier(accStage) / accEvaStageMultiplier(evaStage);
    const roll = Math.random() * 100;
    if (roll > effectiveAccuracy) {
      logs.push({ message: `${attackerName} rate son attaque !`, type: 'info' });
      attacker.volatile.charging = undefined;
      // Recoil on miss (Jump Kick, Hi Jump Kick)
      if (move.effect?.type === 'recoil_crash') {
        const crashDmg = Math.max(1, Math.floor(attacker.maxHp / 2));
        attacker.currentHp = Math.max(0, attacker.currentHp - crashDmg);
        logs.push({ message: `${attackerName} s'écrase au sol ! (-${crashDmg} PV)`, type: 'damage' });
      }
      return { logs, defenderFainted: false };
    }
  }

  let defenderFainted = false;

  if (move.category === 'status') {
    // Determine if this is a self-targeting move:
    // - Explicit target === 'self'
    // - Stat boost moves with positive stages (DB has target='all' for self-buffs like Swords Dance, Harden)
    const isSelfTarget = move.target === 'self'
      || (move.effect?.type === 'stat' && (move.effect.stages ?? 0) > 0);

    // Status move: apply effect via registry or inline
    if (isSelfTarget) {
      // Handle Rest specially: heal fully, cure status, apply 2-turn sleep
      if (move.effect?.type === 'status' && move.effect.status === 'sleep') {
        if (attacker.currentHp >= attacker.maxHp) {
          logs.push({ message: `Mais cela échoue !`, type: 'info' });
        } else {
          attacker.status = null;
          attacker.statusTurns = 0;
          attacker.currentHp = attacker.maxHp;
          attacker.status = 'sleep';
          attacker.statusTurns = 2;
          logs.push({ message: `${attackerName} récupère tous ses PV et s'endort !`, type: 'info' });
        }
      } else if (move.effect && getEffectHandler(move.effect.type)) {
        // Use registry for status moves with known handlers (heal_self, mist, disable, etc.)
        const ctx: EffectContext = {
          attacker, defender, move, damageDealt: 0,
          defenderHpBefore: defender.currentHp, attackerName, defenderName,
          attackerSide, defenderSide,
        };
        logs.push(...getEffectHandler(move.effect.type)!(ctx));
      } else {
        // Fallback: generic self-targeting status/stat moves (e.g., Swords Dance)
        logs.push(...tryApplyStatus(attacker, move));
        logs.push(...tryApplyStatChange(attacker, move, true));
      }
    } else {
      // Enemy-targeting status moves: try registry first
      if (move.effect && getEffectHandler(move.effect.type)) {
        const ctx: EffectContext = {
          attacker, defender, move, damageDealt: 0,
          defenderHpBefore: defender.currentHp, attackerName, defenderName,
          attackerSide, defenderSide,
        };
        logs.push(...getEffectHandler(move.effect.type)!(ctx));
      } else {
        logs.push(...tryApplyStatus(defender, move));
        logs.push(...tryApplyStatChange(defender, move, false));
      }
    }
  } else {
    // Damaging move (Single or Multi-hit)
    let hits = 1;
    if (move.effect?.type === 'multi') {
      if (abilityIsSkillLink(attacker.ability)) {
        // Skill Link: always hit max times
        hits = move.effect.count ?? (move.effect.max ?? 5);
      } else if (move.effect.count) {
        hits = move.effect.count;
      } else {
        const min = move.effect.min ?? 2;
        const max = move.effect.max ?? 5;
        if (max === 5 && min === 2) {
          const r = Math.random();
          if (r < 0.375) hits = 2;
          else if (r < 0.75) hits = 3;
          else if (r < 0.875) hits = 4;
          else hits = 5;
        } else {
          hits = Math.floor(Math.random() * (max - min + 1)) + min;
        }
      }
    }

    let totalDamage = 0;
    let hitCount = 0;
    const defenderHpBefore = defender.currentHp;

    for (let i = 0; i < hits; i++) {
      const result = calculateDamage(attacker, defender, move, attackerBadges, weather, defenderSide);
      hitCount++;

      // Substitute absorbs damage
      if (defender.volatile.substituteHp > 0) {
        const subDmg = Math.min(defender.volatile.substituteHp, result.damage);
        defender.volatile.substituteHp -= subDmg;
        totalDamage += subDmg;
        let msg = `Le clone de ${defenderName} encaisse ${subDmg} dégâts !`;
        if (defender.volatile.substituteHp <= 0) {
          msg += ' Le clone se brise !';
          defender.volatile.substituteHp = 0;
        }
        if (result.isCritical) msg += ' Coup critique !';
        logs.push({ message: msg, type: 'damage', state: {
          attackerHp: attacker.currentHp, defenderHp: defender.currentHp,
          attackerStatus: attacker.status, defenderStatus: defender.status,
          isCritical: result.isCritical, effectiveness: i === 0 ? result.effectiveness : undefined,
          target: 'defender' as any
        }});
      } else {
        defender.currentHp = Math.max(0, defender.currentHp - result.damage);
        totalDamage += result.damage;

        let combinedMessage = `${defenderName} perd ${result.damage} PV !`;
        if (result.isCritical) combinedMessage += ' Coup critique !';
        if (i === 0) {
          if (result.effectiveness > 1) combinedMessage += ' C\'est super efficace !';
          if (result.effectiveness < 1 && result.effectiveness > 0) combinedMessage += ' Ce n\'est pas très efficace...';
          if (result.effectiveness === 0) combinedMessage += ` Ça n'affecte pas ${defenderName}...`;
        }

        logs.push({
          message: combinedMessage,
          type: 'damage',
          state: {
            attackerHp: attacker.currentHp,
            defenderHp: defender.currentHp,
            attackerStatus: attacker.status,
            defenderStatus: defender.status,
            isCritical: result.isCritical,
            effectiveness: i === 0 ? result.effectiveness : undefined,
            target: 'defender' as any
          }
        });
      }

      if (defender.currentHp <= 0) break;
    }

    if (hits > 1) {
      logs.push({ message: `Touché ${hitCount} fois !`, type: 'info' });
    }

    // Track damage taken for Counter/Mirror Coat
    if (totalDamage > 0) {
      defender.volatile.lastDamageTaken = {
        amount: totalDamage,
        category: move.category as 'physical' | 'special',
      };
    }

    // Apply effect via registry for damaging moves
    if (move.effect && move.effect.type !== 'multi' && move.effect.type !== 'charge' && move.effect.type !== 'recharge') {
      const handler = getEffectHandler(move.effect.type);
      if (handler) {
        const ctx: EffectContext = {
          attacker, defender, move, damageDealt: totalDamage,
          defenderHpBefore, attackerName, defenderName,
          attackerSide, defenderSide,
        };
        logs.push(...handler(ctx));
      }
    }

    // Recharge moves: attacker must skip next turn (Hyper Beam, Giga Impact)
    if (move.effect?.type === 'recharge') {
      attacker.volatile.recharging = true;
    }

    // Focus Sash: survive with 1 HP from full HP (held item)
    if (defender.currentHp <= 0 && defenderHpBefore >= defender.maxHp) {
      const sashResult = triggerHeldItem(defender, 'on-hit', {
        opponent: attacker, move, opponentName: attackerName,
      });
      if (sashResult.preventedKO) {
        defender.currentHp = 1;
        logs.push(...sashResult.logs);
      }
    }

    // Sturdy: survive with 1 HP from full HP
    if (defender.currentHp <= 0 && defenderHpBefore >= defender.maxHp && abilityIsSturdy(defender.ability) && !abilityIsMoldBreaker(attacker.ability)) {
      defender.currentHp = 1;
      logs.push({ message: `${defenderName} résiste grâce à Fermeté !`, type: 'info' });
    }

    // Endure: survive with 1 HP this turn
    if (defender.currentHp <= 0 && defender.volatile.endure) {
      defender.currentHp = 1;
      logs.push({ message: `${defenderName} tient bon grâce à Ténacité !`, type: 'info' });
    }

    // Pinch berries: check if HP dropped below threshold
    if (defender.currentHp > 0 && defender.heldItem) {
      const pinchResult = triggerHeldItem(defender, 'on-pinch', { opponent: attacker });
      logs.push(...pinchResult.logs);
    }

    // Contact abilities: Static, Flame Body, Poison Point, Effect Spore
    if (totalDamage > 0 && defender.currentHp > 0 && defender.ability && move.category === 'physical') {
      const contactResult = triggerAbility(defender.ability, 'after-hit', {
        pokemon: defender, opponent: attacker, trigger: 'after-hit',
        move, pokemonName: defenderName, opponentName: attackerName,
      });
      logs.push(...contactResult.logs);
    }

    // Rocky Helmet: contact damage to attacker
    if (totalDamage > 0 && defender.currentHp > 0 && defender.heldItem && move.category === 'physical') {
      const helmetResult = triggerHeldItem(defender, 'on-hit', {
        opponent: attacker, move, opponentName: attackerName,
      });
      logs.push(...helmetResult.logs);
    }

    // After-attack: attacker held item effects (Life Orb recoil, Shell Bell heal, King's Rock flinch)
    if (totalDamage > 0 && attacker.currentHp > 0 && attacker.heldItem) {
      const afterAtkResult = triggerHeldItem(attacker, 'after-attack', {
        opponent: defender, move, damageDealt: totalDamage, opponentName: defenderName,
      });
      logs.push(...afterAtkResult.logs);
    }

    // Attacker pinch berry check (from recoil/Life Orb)
    if (attacker.currentHp > 0 && attacker.heldItem) {
      const atkPinch = triggerHeldItem(attacker, 'on-pinch', { opponent: defender });
      logs.push(...atkPinch.logs);
    }

    // Rock Head: no recoil damage
    if (abilityBlocksRecoil(attacker.ability) && move.effect?.type === 'recoil') {
      // Marker; the recoil handler in moveEffects checks this
    }

    defenderFainted = defender.currentHp <= 0;
    if (defenderFainted) {
      logs.push({ message: `${defenderName} est K.O. !`, type: 'info' });
      // Destiny Bond: if the defender had it active, attacker faints too
      if (defender.volatile.destinyBond) {
        attacker.currentHp = 0;
        logs.push({ message: `${attackerName} est emporté par le Lien du Destin !`, type: 'info' });
      }
    }
  }

  // Reset Destiny Bond at end of move (only lasts until next action)
  attacker.volatile.destinyBond = false;

  return { logs, defenderFainted };
}

/**
 * Determine turn order based on speed and priority
 */
export function determineOrder(
  playerPokemon: PokemonInstance,
  enemyPokemon: PokemonInstance,
  playerAction: BattleAction,
  enemyMoveIndex: number,
  playerSide?: SideConditions,
  enemySide?: SideConditions,
  trickRoom: number = 0,
  weather: string | null = null
): 'player' | 'enemy' {
  // If player is using an item or switching, they go first (conceptually)
  if (playerAction.type === 'item' || playerAction.type === 'switch' || playerAction.type === 'catch') {
    return 'player';
  }

  const playerMoveId = playerPokemon.moves[playerAction.moveIndex ?? 0]?.moveId;
  const enemyMoveId = enemyPokemon.moves[enemyMoveIndex]?.moveId;

  if (!playerMoveId || !enemyMoveId) return 'player';

  const playerMove = getMoveData(playerMoveId);
  const enemyMove = getMoveData(enemyMoveId);

  // Priority check
  if (playerMove.priority !== enemyMove.priority) {
    return playerMove.priority > enemyMove.priority ? 'player' : 'enemy';
  }

  // Speed check (accounts for stat stages, paralysis, Tailwind, and speed abilities)
  let playerSpeed = getEffectiveStat(playerPokemon, 'speed');
  let enemySpeed = getEffectiveStat(enemyPokemon, 'speed');
  if (playerSide && playerSide.tailwind > 0) playerSpeed *= 2;
  if (enemySide && enemySide.tailwind > 0) enemySpeed *= 2;

  // Held item speed modifiers (Choice Scarf, Iron Ball, Quick Claw)
  const pItemSpeed = triggerHeldItem(playerPokemon, 'modify-speed', { weather });
  if (pItemSpeed.speedMultiplier) playerSpeed = Math.floor(playerSpeed * pItemSpeed.speedMultiplier);
  if (pItemSpeed.logs.length > 0) { /* Quick Claw message handled in store */ }
  const eItemSpeed = triggerHeldItem(enemyPokemon, 'modify-speed', { weather });
  if (eItemSpeed.speedMultiplier) enemySpeed = Math.floor(enemySpeed * eItemSpeed.speedMultiplier);

  // Speed-modifying abilities (Swift Swim, Chlorophyll, Sand Rush)
  if (playerPokemon.ability) {
    const pSpeedResult = triggerAbility(playerPokemon.ability, 'modify-speed', {
      pokemon: playerPokemon, trigger: 'modify-speed', pokemonName: '', weather,
    });
    if (pSpeedResult.speedMultiplier) playerSpeed = Math.floor(playerSpeed * pSpeedResult.speedMultiplier);
  }
  if (enemyPokemon.ability) {
    const eSpeedResult = triggerAbility(enemyPokemon.ability, 'modify-speed', {
      pokemon: enemyPokemon, trigger: 'modify-speed', pokemonName: '', weather,
    });
    if (eSpeedResult.speedMultiplier) enemySpeed = Math.floor(enemySpeed * eSpeedResult.speedMultiplier);
  }

  if (playerSpeed !== enemySpeed) {
    // Trick Room inverts speed order
    if (trickRoom > 0) {
      return playerSpeed < enemySpeed ? 'player' : 'enemy';
    }
    return playerSpeed > enemySpeed ? 'player' : 'enemy';
  }

  // Speed tie: random
  return Math.random() < 0.5 ? 'player' : 'enemy';
}

/**
 * Choose a move for AI (enemy Pokémon)
 * Uses weighted scoring: prefers super-effective, STAB, and high-power moves.
 * 20% chance of random pick to keep it unpredictable.
 */
export function chooseEnemyMove(pokemon: PokemonInstance, defender?: PokemonInstance): number {
  // Rampage lock-in: must use the same move
  if (pokemon.volatile.rampageTurns > 0 && pokemon.volatile.rampageMoveId !== undefined) {
    const idx = pokemon.moves.findIndex(m => m.moveId === pokemon.volatile.rampageMoveId);
    if (idx >= 0 && pokemon.moves[idx].currentPp > 0) return idx;
  }

  // Encore lock-in: must use the encored move
  if (pokemon.volatile.encoreTurns > 0 && pokemon.volatile.encoreMoveId !== undefined) {
    const idx = pokemon.moves.findIndex(m => m.moveId === pokemon.volatile.encoreMoveId);
    if (idx >= 0 && pokemon.moves[idx].currentPp > 0) return idx;
    // If encored move has no PP, encore ends
    pokemon.volatile.encoreTurns = 0;
    pokemon.volatile.encoreMoveId = undefined;
  }

  let available = pokemon.moves
    .map((m, i) => ({ ...m, index: i }))
    .filter(m => m.currentPp > 0)
    .filter(m => !(pokemon.volatile.disabled && pokemon.volatile.disabled.moveId === m.moveId));

  // Taunt: block status moves
  if (pokemon.volatile.tauntTurns > 0) {
    const nonStatus = available.filter(m => {
      const mData = getMoveData(m.moveId);
      return mData.category !== 'status';
    });
    if (nonStatus.length > 0) available = nonStatus;
  }

  if (available.length === 0) return -1; // Signal: use Struggle
  if (available.length === 1) return available[0].index;

  // 20% chance of pure random to keep battles unpredictable
  if (Math.random() < 0.2 || !defender) {
    return available[Math.floor(Math.random() * available.length)].index;
  }

  // Score each move
  const attackerData = getPokemonData(pokemon.dataId);
  const defenderData = getPokemonData(defender.dataId);

  let bestScore = -Infinity;
  let bestIdx = available[0].index;

  for (const m of available) {
    const move = getMoveData(m.moveId);
    let score = 0;

    if (move.category === 'status') {
      // Status moves get a base score; prefer them if defender has no status
      score = 30;
      if (move.effect?.type === 'stat' && move.target === 'self') score = 40; // Buff moves
      if (move.effect?.type === 'status' && defender.status !== null) score = 5; // Don't try to re-status
    } else {
      // Damaging moves: base power * effectiveness * STAB
      const power = move.power ?? 0;
      const effectiveness = getTypeEffectiveness(move.type, defenderData.types as any);
      const stab = attackerData.types.includes(move.type) ? 1.5 : 1;
      score = power * effectiveness * stab;
      // Avoid immune moves
      if (effectiveness === 0) score = -100;
    }

    // Small random noise so ties don't always pick the same move
    score += Math.random() * 10;

    if (score > bestScore) {
      bestScore = score;
      bestIdx = m.index;
    }
  }

  return bestIdx;
}

/**
 * Execute Struggle (Lutte) - typeless move with 50 base power and 25% recoil
 * Used when a Pokémon has no PP left on any move.
 */
export function executeStruggle(
  attacker: PokemonInstance,
  defender: PokemonInstance
): MoveExecutionResult {
  const logs: BattleLogEntry[] = [];
  const originalPush = logs.push.bind(logs);
  logs.push = (...items: BattleLogEntry[]) => {
    for (const item of items) {
      if (!item.state) {
        item.state = {
          attackerHp: attacker.currentHp,
          defenderHp: defender.currentHp,
          attackerStatus: attacker.status,
          defenderStatus: defender.status,
        };
      }
      originalPush(item);
    }
    return logs.length;
  };

  const attackerName = attacker.nickname || getPokemonData(attacker.dataId).name;
  const defenderName = defender.nickname || getPokemonData(defender.dataId).name;

  logs.push({ message: `${attackerName} n'a plus de PP !`, type: 'info' });
  logs.push({ message: `${attackerName} utilise Lutte !`, type: 'info' });

  // Struggle: 50 base power, typeless (neutral effectiveness), no STAB
  const atk = getEffectiveStat(attacker, 'attack');
  const def = getEffectiveStat(defender, 'defense');
  const levelFactor = ((2 * attacker.level) / 5 + 2);
  let damage = Math.floor((levelFactor * 50 * atk / def) / 50) + 2;

  // Random factor (85-100%)
  const randomFactor = 0.85 + Math.random() * 0.15;
  damage = Math.max(1, Math.floor(damage * randomFactor));

  defender.currentHp = Math.max(0, defender.currentHp - damage);
  logs.push({ message: `${defenderName} perd ${damage} PV !`, type: 'damage' });

  // 25% recoil of damage dealt
  const recoil = Math.max(1, Math.floor(damage / 4));
  attacker.currentHp = Math.max(0, attacker.currentHp - recoil);
  logs.push({ message: `${attackerName} subit le contrecoup ! (-${recoil} PV)`, type: 'damage' });

  const defenderFainted = defender.currentHp <= 0;
  if (defenderFainted) {
    logs.push({ message: `${defenderName} est K.O. !`, type: 'info' });
  }

  return { logs, defenderFainted };
}

/**
 * Apply entry hazards when a Pokémon switches in.
 * Returns logs and whether the Pokémon fainted from hazard damage.
 */
export function applyEntryHazards(
  pokemon: PokemonInstance,
  side: SideConditions
): { logs: BattleLogEntry[]; fainted: boolean } {
  const logs: BattleLogEntry[] = [];

  // Heavy-Duty Boots: immune to entry hazards
  if (heldItemBlocksHazards(pokemon)) return { logs: [], fainted: false };

  const name = pokemon.nickname || getPokemonData(pokemon.dataId).name;
  const pokeData = getPokemonData(pokemon.dataId);
  const types = pokeData.types as string[];
  const isGrounded = !types.includes('flying') && pokemon.volatile.magnetRise <= 0; // Flying, Magnet Rise = not grounded

  // Stealth Rock: type-effectiveness-based damage (Rock vs switch-in types)
  if (side.stealthRock) {
    const effectiveness = getTypeEffectiveness('rock', pokeData.types as any);
    // Base 1/8 max HP * effectiveness (so 1/4 for 2x, 1/2 for 4x, 1/16 for 0.5x, 1/32 for 0.25x)
    const damage = Math.max(1, Math.floor(pokemon.maxHp * effectiveness / 8));
    pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
    logs.push({ message: `Les roches pointues blessent ${name} ! (-${damage} PV)`, type: 'damage' });
  }

  // Spikes: grounded only, damage by layers (1/8, 1/6, 1/4)
  if (side.spikes > 0 && isGrounded) {
    const spikeDivisors = [8, 6, 4];
    const divisor = spikeDivisors[Math.min(side.spikes, 3) - 1];
    const damage = Math.max(1, Math.floor(pokemon.maxHp / divisor));
    pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
    logs.push({ message: `Les picots blessent ${name} ! (-${damage} PV)`, type: 'damage' });
  }

  // Toxic Spikes: grounded only. Poison-types absorb (remove spikes).
  if (side.toxicSpikes > 0 && isGrounded) {
    if (types.includes('poison')) {
      // Poison-type absorbs toxic spikes
      side.toxicSpikes = 0;
      logs.push({ message: `${name} absorbe les pics empoisonnés !`, type: 'info' });
    } else if (!types.includes('steel') && pokemon.status === null) {
      // 1 layer = poison, 2 layers = toxic (badly poisoned)
      if (side.toxicSpikes >= 2) {
        pokemon.status = 'toxic';
        pokemon.volatile.toxicCounter = 0;
        logs.push({ message: `${name} est gravement empoisonné par les pics !`, type: 'status' });
      } else {
        pokemon.status = 'poison';
        logs.push({ message: `${name} est empoisonné par les pics !`, type: 'status' });
      }
    }
  }

  // Sticky Web: grounded only, -1 Speed
  if (side.stickyWeb && isGrounded) {
    const currentSpd = pokemon.statStages.speed;
    if (currentSpd > -6) {
      pokemon.statStages.speed = Math.max(-6, currentSpd - 1);
      logs.push({ message: `La toile gluante ralentit ${name} !`, type: 'info' });
    }
  }

  return { logs, fainted: pokemon.currentHp <= 0 };
}

/**
 * Heal a Pokémon fully (after battle in this game's design)
 */
export function fullHealTeam(team: PokemonInstance[]): void {
  for (const pokemon of team) {
    pokemon.currentHp = pokemon.maxHp;
    pokemon.status = null;
    pokemon.statusTurns = 0;
    pokemon.volatile = freshVolatile();
    pokemon.statStages = freshStatStages();
    for (const move of pokemon.moves) {
      move.currentPp = move.maxPp;
    }
  }
}
