import { PokemonInstance, MoveData, StatusCondition, MoveInstance, freshVolatile, freshStatStages } from '../types/pokemon';
import { BattleLogEntry, BattleAction, SideConditions } from '../types/battle';
import { calculateDamage, } from './damageCalculator';
import { getEffectiveStat } from './statCalculator';
import { getMoveData, getPokemonData, getTypeEffectiveness, getItemData } from '../utils/dataLoader';
import { getEffectHandler, EffectContext } from './moveEffects';
import {
  triggerAbility, abilityIsNoGuard, abilityIsCompoundEyes,
  abilityIsSkillLink, abilityBlocksFlinch, abilityBlocksRecoil,
  abilityIsSturdy, abilityIsMoldBreaker, abilityIsShieldDust,
  abilityIsSereneGrace, abilityIsScrappy, abilityIsLiquidOoze,
  abilityIsEarlyBird,
} from './abilityEffects';
import { triggerHeldItem, heldItemBlocksHazards, isChoiceItem } from './heldItemEffects';

/**
 * Core battle engine - handles turn execution, status effects, etc.
 * Stateless functions that operate on Pokémon instances.
 */

/** Push a log entry, auto-injecting current HP/status state if not already set. */
function pushLog(
  logs: BattleLogEntry[],
  entry: BattleLogEntry,
  attacker: PokemonInstance,
  defender?: PokemonInstance,
): void {
  if (!entry.state) {
    entry.state = {
      attackerHp: attacker.currentHp,
      attackerStatus: attacker.status,
      ...(defender ? { defenderHp: defender.currentHp, defenderStatus: defender.status } : {}),
    };
  }
  logs.push(entry);
}

// ===== Status Effects =====

export function applyStatusDamage(pokemon: PokemonInstance, opponent?: PokemonInstance): BattleLogEntry[] {
  const logs: BattleLogEntry[] = [];

  const name = pokemon.nickname || getPokemonData(pokemon.dataId).name;

  if (pokemon.currentHp <= 0) return logs;

  // Poison damage (1/8 max HP)
  if (pokemon.status === 'poison') {
    const damage = Math.max(1, Math.floor(pokemon.maxHp / 8));
    pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
    pushLog(logs, { message: `${name} souffre du poison ! (-${damage} PV)`, type: 'status' }, pokemon, opponent);
  }

  // Toxic damage (escalating: 1/16 * counter per turn)
  if (pokemon.status === 'toxic') {
    pokemon.volatile.toxicCounter = Math.min(15, pokemon.volatile.toxicCounter + 1);
    const damage = Math.max(1, Math.floor(pokemon.maxHp * pokemon.volatile.toxicCounter / 16));
    pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
    pushLog(logs, { message: `${name} souffre gravement du poison ! (-${damage} PV)`, type: 'status' }, pokemon, opponent);
  }

  // Burn damage (1/16 max HP)
  if (pokemon.status === 'burn') {
    const damage = Math.max(1, Math.floor(pokemon.maxHp / 16));
    pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
    pushLog(logs, { message: `${name} souffre de sa brûlure ! (-${damage} PV)`, type: 'status' }, pokemon, opponent);
  }

  // Trap damage (Wrap/Bind/Fire Spin: 1/8 max HP per turn)
  if (pokemon.volatile.bound > 0) {
    pokemon.volatile.bound--;
    const damage = Math.max(1, Math.floor(pokemon.maxHp / 8));
    pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
    pushLog(logs, { message: `${name} est blessé par l'étreinte ! (-${damage} PV)`, type: 'status' }, pokemon, opponent);
    if (pokemon.volatile.bound <= 0) {
      pushLog(logs, { message: `${name} se libère !`, type: 'info' }, pokemon, opponent);
    }
  }

  // Leech Seed drain (1/8 max HP, heal opponent — Liquid Ooze: damage opponent instead)
  if (pokemon.volatile.leechSeed && pokemon.currentHp > 0) {
    const damage = Math.max(1, Math.floor(pokemon.maxHp / 8));
    pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
    pushLog(logs, { message: `Vampigraine draine ${name} ! (-${damage} PV)`, type: 'status' }, pokemon, opponent);
    if (opponent && opponent.currentHp > 0) {
      if (pokemon.ability === 'liquid-ooze') {
        opponent.currentHp = Math.max(0, opponent.currentHp - damage);
        pushLog(logs, { message: `Suintement blesse l'adversaire !`, type: 'damage' }, pokemon, opponent);
      } else {
        opponent.currentHp = Math.min(opponent.maxHp, opponent.currentHp + damage);
      }
    }
  }

  // Curse damage (1/4 max HP per turn)
  if (pokemon.volatile.cursed && pokemon.currentHp > 0) {
    const damage = Math.max(1, Math.floor(pokemon.maxHp / 4));
    pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
    pushLog(logs, { message: `${name} est blessé par la malédiction ! (-${damage} PV)`, type: 'status' }, pokemon, opponent);
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
      pushLog(logs, { message: `L'effet de Encore s'estompe !`, type: 'info' }, pokemon, opponent);
    }
  }

  // Perish Song countdown
  if (pokemon.volatile.perishTurns >= 0) {
    pushLog(logs, { message: `${name} : Requiem ${pokemon.volatile.perishTurns} !`, type: 'info' }, pokemon, opponent);
    if (pokemon.volatile.perishTurns === 0) {
      pokemon.currentHp = 0;
      pushLog(logs, { message: `${name} est K.O. par le Requiem !`, type: 'info' }, pokemon, opponent);
    }
    pokemon.volatile.perishTurns--;
  }

  // Future Sight / Doom Desire: delayed damage lands
  if (pokemon.volatile.futureAttack && pokemon.currentHp > 0) {
    pokemon.volatile.futureAttack.turnsLeft--;
    if (pokemon.volatile.futureAttack.turnsLeft <= 0) {
      const fa = pokemon.volatile.futureAttack;
      pokemon.currentHp = Math.max(0, pokemon.currentHp - fa.damage);
      pushLog(logs, { message: `${fa.moveName} frappe ${name} ! (-${fa.damage} PV)`, type: 'damage' }, pokemon, opponent);
      pokemon.volatile.futureAttack = undefined;
    }
  }

  // Ingrain: heal 1/16 max HP per turn
  if (pokemon.volatile.ingrain && pokemon.currentHp > 0 && pokemon.currentHp < pokemon.maxHp) {
    const heal = Math.max(1, Math.floor(pokemon.maxHp / 16));
    pokemon.currentHp = Math.min(pokemon.maxHp, pokemon.currentHp + heal);
    pushLog(logs, { message: `${name} récupère des PV grâce à Enracinement ! (+${heal} PV)`, type: 'heal' }, pokemon, opponent);
  }

  // Aqua Ring: heal 1/16 max HP per turn
  if (pokemon.volatile.aquaRing && pokemon.currentHp > 0 && pokemon.currentHp < pokemon.maxHp) {
    const heal = Math.max(1, Math.floor(pokemon.maxHp / 16));
    pokemon.currentHp = Math.min(pokemon.maxHp, pokemon.currentHp + heal);
    pushLog(logs, { message: `${name} récupère des PV grâce à Anneau Hydro ! (+${heal} PV)`, type: 'heal' }, pokemon, opponent);
  }

  // Yawn: fall asleep at end of the turn after being yawned
  if (pokemon.volatile.yawned && pokemon.currentHp > 0) {
    pokemon.volatile.yawned = false;
    if (pokemon.status === null) {
      pokemon.status = 'sleep';
      pokemon.statusTurns = 1 + Math.floor(Math.random() * 3);
      pushLog(logs, { message: `${name} s'endort à cause du Bâillement !`, type: 'status' }, pokemon, opponent);
    }
  }

  // Decrement safeguard turns
  if (pokemon.volatile.safeguardTurns > 0) {
    pokemon.volatile.safeguardTurns--;
    if (pokemon.volatile.safeguardTurns <= 0) {
      pushLog(logs, { message: `L'effet de Protection s'estompe !`, type: 'info' }, pokemon, opponent);
    }
  }

  // Decrement taunt turns
  if (pokemon.volatile.tauntTurns > 0) {
    pokemon.volatile.tauntTurns--;
    if (pokemon.volatile.tauntTurns <= 0) {
      pushLog(logs, { message: `L'effet de Provocation s'estompe !`, type: 'info' }, pokemon, opponent);
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

  const name = pokemon.nickname || getPokemonData(pokemon.dataId).name;

  // Flinch (Peur)
  if (pokemon.volatile.flinch) {
    pokemon.volatile.flinch = false; // Consumed
    pushLog(logs, { message: `${name} a peur !`, type: 'status' }, pokemon);
    return { blocked: true, logs };
  }

  // Confusion
  if (pokemon.volatile.confusion > 0) {
    pokemon.volatile.confusion--;
    pushLog(logs, { message: `${name} est confus !`, type: 'status' }, pokemon);
    if (Math.random() < 0.5) {
      // Hurt self: Power 40 physical hit (uses effective stats for attack/defense)
      const confAtk = getEffectiveStat(pokemon, 'attack');
      const confDef = getEffectiveStat(pokemon, 'defense');
      const damage = Math.floor((((2 * pokemon.level / 5 + 2) * 40 * confAtk / confDef) / 50) + 2);
      pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
      pushLog(logs, { message: `Il se blesse dans sa confusion !`, type: 'damage' }, pokemon);
      return { blocked: true, logs };
    }
  }

  if (pokemon.status === 'paralysis') {
    if (Math.random() < 0.25) {
      pushLog(logs, { message: `${name} est paralysé ! Il ne peut pas attaquer !`, type: 'status' }, pokemon);
      return { blocked: true, logs };
    }
  }

  if (pokemon.status === 'sleep') {
    // Early Bird: decrement sleep turns twice as fast
    pokemon.statusTurns -= abilityIsEarlyBird(pokemon.ability) ? 2 : 1;
    if (pokemon.statusTurns <= 0) {
      pokemon.status = null;
      pokemon.statusTurns = 0;
      pushLog(logs, { message: `${name} se réveille !`, type: 'status' }, pokemon);
      return { blocked: false, logs };
    }
    // Sleep Talk / Snore can be used while asleep
    if (moveId && SLEEP_USABLE_MOVES.has(moveId)) {
      pushLog(logs, { message: `${name} dort...`, type: 'status' }, pokemon);
      return { blocked: false, logs };
    }
    pushLog(logs, { message: `${name} dort profondément...`, type: 'status' }, pokemon);
    return { blocked: true, logs };
  }

  if (pokemon.status === 'freeze') {
    if (Math.random() < 0.2) {
      pokemon.status = null;
      pokemon.statusTurns = 0;
      pushLog(logs, { message: `${name} a dégelé !`, type: 'status' }, pokemon);
      return { blocked: false, logs };
    }
    pushLog(logs, { message: `${name} est gelé et ne peut pas bouger !`, type: 'status' }, pokemon);
    return { blocked: true, logs };
  }

  return { blocked: false, logs };
}

/**
 * Try to apply a status effect from a move
 */
export function tryApplyStatus(
  target: PokemonInstance,
  move: MoveData,
  weather?: string | null,
  attacker?: PokemonInstance
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
    // Own Tempo blocks confusion
    if (target.ability === 'own-tempo') {
      logs.push({ message: `Tempo Perso protège ${name} de la confusion !`, type: 'info' });
      return logs;
    }
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
      weather,
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

  // Synchronize: copy burn/paralysis/poison back to attacker
  if (target.ability === 'synchronize' && attacker && target.status) {
    logs.push(...applySynchronize(attacker, target.status));
  }

  return logs;
}

/**
 * Apply Synchronize: copy burn/paralysis/poison to the attacker after the target is statused.
 * Call this after tryApplyStatus succeeds, passing the move user as syncTarget.
 */
export function applySynchronize(
  syncTarget: PokemonInstance,
  statusApplied: StatusCondition
): BattleLogEntry[] {
  if (!statusApplied) return [];
  // Only Synchronize copies burn, paralysis, poison/toxic
  if (!['burn', 'paralysis', 'poison', 'toxic'].includes(statusApplied)) return [];
  if (syncTarget.status !== null) return [];
  const targetData = getPokemonData(syncTarget.dataId);
  const targetTypes = targetData.types as string[];
  // Type immunities still apply
  if (statusApplied === 'burn' && targetTypes.includes('fire')) return [];
  if (statusApplied === 'paralysis' && targetTypes.includes('electric')) return [];
  if ((statusApplied === 'poison' || statusApplied === 'toxic') && (targetTypes.includes('poison') || targetTypes.includes('steel'))) return [];

  syncTarget.status = statusApplied;
  if (statusApplied === 'toxic') syncTarget.volatile.toxicCounter = 0;
  const syncName = syncTarget.nickname || targetData.name;
  return [{ message: `Synchro inflige ${statusApplied === 'burn' ? 'une brûlure' : statusApplied === 'paralysis' ? 'la paralysie' : 'l\'empoisonnement'} à ${syncName} !`, type: 'status' }];
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

  // Ability blocks stat drops (Clear Body, Hyper Cutter, Keen Eye, etc.)
  if (!isUser && stages < 0 && target.ability) {
    const abilityResult = triggerAbility(target.ability, 'on-stat-drop', {
      pokemon: target, trigger: 'on-stat-drop',
      statDrop: { stat, stages },
      pokemonName: targetName,
    });
    if (abilityResult.prevented) {
      logs.push(...abilityResult.logs);
      return logs;
    }
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

  const move = getMoveData(moveInstance.moveId);
  const attackerName = attacker.nickname || getPokemonData(attacker.dataId).name;
  const defenderName = defender.nickname || getPokemonData(defender.dataId).name;

  // Recharge check: if recharging from a previous turn, skip this turn
  if (attacker.volatile.recharging) {
    attacker.volatile.recharging = false;
    pushLog(logs, { message: `${attackerName} doit se reposer !`, type: 'info' }, attacker, defender);
    return { logs, defenderFainted: false };
  }

  pushLog(logs, { message: `${attackerName} utilise ${move.name} !`, type: 'info' }, attacker, defender);

  // Deduct PP (Pressure: extra PP deducted when targeting a Pressure Pokemon)
  const ppCost = (defender.ability === 'pressure' && !abilityIsMoldBreaker(attacker.ability)) ? 2 : 1;
  moveInstance.currentPp = Math.max(0, moveInstance.currentPp - ppCost);

  // Track last move used (for Disable)
  attacker.volatile.lastMoveUsed = move.id;

  // Choice lock: lock to this move if holding a Choice item
  if (isChoiceItem(attacker.heldItem) && !attacker.volatile.choiceLock) {
    attacker.volatile.choiceLock = move.id;
  }

  // Protect check: if defender is protected, block the move
  if (defender.volatile.protected && move.target !== 'self') {
    pushLog(logs, { message: `${defenderName} se protège !`, type: 'info' }, attacker, defender);
    return { logs, defenderFainted: false };
  }

  // Protect setup: if this move is protect-type, set flag and return
  if (move.effect?.type === 'protect') {
    // Consecutive use degrades success: 1/1, 1/2, 1/4, etc.
    const successChance = 1 / Math.pow(2, attacker.volatile.protectStreak);
    attacker.volatile.protectStreak++;
    if (Math.random() >= successChance) {
      pushLog(logs, { message: `Mais cela échoue !`, type: 'info' }, attacker, defender);
      return { logs, defenderFainted: false };
    }
    attacker.volatile.protected = true;
    pushLog(logs, { message: `${attackerName} se protège !`, type: 'info' }, attacker, defender);
    return { logs, defenderFainted: false };
  }

  // Reset protect streak if not using protect
  attacker.volatile.protectStreak = 0;

  // Charge Check (Solar Beam etc)
  if (move.effect?.type === 'charge') {
    if (attacker.volatile.charging !== move.id) {
      attacker.volatile.charging = move.id;
      pushLog(logs, { message: `${attackerName} accumule de l'énergie !`, type: 'info' }, attacker, defender);
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
      pushLog(logs, { message: `${attackerName} devient confus par fatigue !`, type: 'status' }, attacker, defender);
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

  // Damp: prevent Self-Destruct/Explosion
  if (move.effect?.type === 'self_destruct' && defender.ability === 'damp' && !abilityIsMoldBreaker(attacker.ability)) {
    pushLog(logs, { message: `Moiteur empêche ${attackerName} d'exploser !`, type: 'info' }, attacker, defender);
    return { logs, defenderFainted: false };
  }

  // OHKO moves: special accuracy + instant KO
  if (move.effect?.type === 'ohko') {
    if (defender.level > attacker.level) {
      pushLog(logs, { message: `Mais cela échoue !`, type: 'info' }, attacker, defender);
      return { logs, defenderFainted: false };
    }
    const hitChance = attacker.level - defender.level + 30;
    if (Math.random() * 100 >= hitChance) {
      pushLog(logs, { message: `${attackerName} rate son attaque !`, type: 'info' }, attacker, defender);
      return { logs, defenderFainted: false };
    }
    defender.currentHp = 0;
    pushLog(logs, { message: `K.O. en un coup !`, type: 'damage' }, attacker, defender);
    pushLog(logs, { message: `${defenderName} est K.O. !`, type: 'info' }, attacker, defender);
    return { logs, defenderFainted: true };
  }

  // Fixed damage moves (Dragon Rage, Sonic Boom)
  if (move.effect?.type === 'fixed_damage') {
    // Still check accuracy
    if (move.accuracy !== null) {
      if (Math.random() * 100 > move.accuracy) {
        pushLog(logs, { message: `${attackerName} rate son attaque !`, type: 'info' }, attacker, defender);
        return { logs, defenderFainted: false };
      }
    }
    // amount 65535 = level-based damage (Seismic Toss, Night Shade)
    const fixedAmount = (move.effect.amount === 65535) ? attacker.level : (move.effect.amount ?? 40);
    defender.currentHp = Math.max(0, defender.currentHp - fixedAmount);
    pushLog(logs, { message: `${defenderName} perd ${fixedAmount} PV !`, type: 'damage' }, attacker, defender);
    const defenderFainted = defender.currentHp <= 0;
    if (defenderFainted) {
      pushLog(logs, { message: `${defenderName} est K.O. !`, type: 'info' }, attacker, defender);
    }
    return { logs, defenderFainted };
  }

  // Future Sight (248) / Doom Desire (353): delayed attack — store damage, hit in 2 turns
  const FUTURE_MOVES = [248, 353];
  if (FUTURE_MOVES.includes(move.id)) {
    if (defender.volatile.futureAttack) {
      pushLog(logs, { message: `Mais cela échoue !`, type: 'info' }, attacker, defender);
      return { logs, defenderFainted: false };
    }
    const result = calculateDamage(attacker, defender, move, attackerBadges, weather, defenderSide);
    defender.volatile.futureAttack = {
      moveId: move.id,
      damage: Math.max(1, result.damage),
      turnsLeft: 2,
      moveName: move.name,
    };
    pushLog(logs, { message: `${attackerName} prévoit une attaque future !`, type: 'info' }, attacker, defender);
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
      pushLog(logs, { message: `${attackerName} rate son attaque !`, type: 'info' }, attacker, defender);
      attacker.volatile.charging = undefined;
      // Recoil on miss (Jump Kick, Hi Jump Kick)
      if (move.effect?.type === 'recoil_crash') {
        const crashDmg = Math.max(1, Math.floor(attacker.maxHp / 2));
        attacker.currentHp = Math.max(0, attacker.currentHp - crashDmg);
        pushLog(logs, { message: `${attackerName} s'écrase au sol ! (-${crashDmg} PV)`, type: 'damage' }, attacker, defender);
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
          pushLog(logs, { message: `Mais cela échoue !`, type: 'info' }, attacker, defender);
        } else {
          attacker.status = null;
          attacker.statusTurns = 0;
          attacker.currentHp = attacker.maxHp;
          attacker.status = 'sleep';
          attacker.statusTurns = 2;
          pushLog(logs, { message: `${attackerName} récupère tous ses PV et s'endort !`, type: 'info' }, attacker, defender);
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
        logs.push(...tryApplyStatus(attacker, move, weather));
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
        logs.push(...tryApplyStatus(defender, move, weather));
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
    let anyCrit = false;

    for (let i = 0; i < hits; i++) {
      const result = calculateDamage(attacker, defender, move, attackerBadges, weather, defenderSide);
      if (result.isCritical) anyCrit = true;
      // Knock Off (282): 1.5x damage if target holds an item
      if (move.id === 282 && defender.heldItem) {
        result.damage = Math.floor(result.damage * 1.5);
      }
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
        pushLog(logs, { message: msg, type: 'damage', state: {
          attackerHp: attacker.currentHp, defenderHp: defender.currentHp,
          attackerStatus: attacker.status, defenderStatus: defender.status,
          isCritical: result.isCritical, effectiveness: i === 0 ? result.effectiveness : undefined,
          target: 'defender' as any
        }}, attacker, defender);
      } else {
        // False Swipe (206) / Hold Back (610): always leave defender at 1 HP minimum
        let actualDamage = result.damage;
        if ((move.id === 206 || move.id === 610) && defender.currentHp - result.damage <= 0 && defender.currentHp > 1) {
          actualDamage = defender.currentHp - 1;
          defender.currentHp = 1;
        } else {
          defender.currentHp = Math.max(0, defender.currentHp - result.damage);
        }
        totalDamage += actualDamage;

        let combinedMessage = `${defenderName} perd ${actualDamage} PV !`;
        if (result.isCritical) combinedMessage += ' Coup critique !';
        if (i === 0) {
          if (result.effectiveness > 1) combinedMessage += ' C\'est super efficace !';
          if (result.effectiveness < 1 && result.effectiveness > 0) combinedMessage += ' Ce n\'est pas très efficace...';
          if (result.effectiveness === 0) combinedMessage += ` Ça n'affecte pas ${defenderName}...`;
        }

        pushLog(logs, {
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
        }, attacker, defender);
      }

      if (defender.currentHp <= 0) break;
    }

    if (hits > 1) {
      pushLog(logs, { message: `Touché ${hitCount} fois !`, type: 'info' }, attacker, defender);
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
      // Shield Dust: block secondary effects (chance < 100%) on the defender
      const isSecondary = move.effect.chance !== undefined && move.effect.chance < 100;
      const shieldDustBlocks = isSecondary && defender.ability && abilityIsShieldDust(defender.ability) && !abilityIsMoldBreaker(attacker.ability);

      if (!shieldDustBlocks) {
        // Serene Grace: double secondary effect chances
        const originalChance = move.effect.chance;
        if (isSecondary && attacker.ability && abilityIsSereneGrace(attacker.ability)) {
          (move.effect as any).chance = Math.min(100, (move.effect.chance ?? 100) * 2);
        }

        const handler = getEffectHandler(move.effect.type);
        if (handler) {
          const ctx: EffectContext = {
            attacker, defender, move, damageDealt: totalDamage,
            defenderHpBefore, attackerName, defenderName,
            attackerSide, defenderSide,
          };
          logs.push(...handler(ctx));
        }

        // Restore original chance to avoid permanent mutation
        if (originalChance !== undefined) (move.effect as any).chance = originalChance;
      }
    }

    // Knock Off (282): remove defender's held item after damage
    if (move.id === 282 && defender.heldItem && defender.currentHp > 0) {
      const removedItem = getItemData(defender.heldItem);
      pushLog(logs, { message: `${defenderName} perd son ${removedItem.name} !`, type: 'info' }, attacker, defender);
      defender.heldItem = null;
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
      pushLog(logs, { message: `${defenderName} résiste grâce à Fermeté !`, type: 'info' }, attacker, defender);
    }

    // Endure: survive with 1 HP this turn
    if (defender.currentHp <= 0 && defender.volatile.endure) {
      defender.currentHp = 1;
      pushLog(logs, { message: `${defenderName} tient bon grâce à Ténacité !`, type: 'info' }, attacker, defender);
    }

    // Pinch berries: check if HP dropped below threshold
    if (defender.currentHp > 0 && defender.heldItem) {
      const pinchResult = triggerHeldItem(defender, 'on-pinch', { opponent: attacker });
      logs.push(...pinchResult.logs);
    }

    // Contact abilities: Static, Flame Body, Poison Point, Effect Spore, Cursed Body
    if (totalDamage > 0 && defender.currentHp > 0 && defender.ability && move.category === 'physical') {
      const contactResult = triggerAbility(defender.ability, 'after-hit', {
        pokemon: defender, opponent: attacker, trigger: 'after-hit',
        move, pokemonName: defenderName, opponentName: attackerName,
      });
      logs.push(...contactResult.logs);
    }

    // Anger Point: max attack on crit received
    if (anyCrit && defender.currentHp > 0 && defender.ability === 'anger-point') {
      defender.statStages.attack = 6;
      pushLog(logs, { message: `Colérique maximise l'Attaque de ${defenderName} !`, type: 'info' }, attacker, defender);
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
      pushLog(logs, { message: `${defenderName} est K.O. !`, type: 'info' }, attacker, defender);
      // Destiny Bond: if the defender had it active, attacker faints too
      if (defender.volatile.destinyBond) {
        attacker.currentHp = 0;
        pushLog(logs, { message: `${attackerName} est emporté par le Lien du Destin !`, type: 'info' }, attacker, defender);
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

  // Ability-based priority modification
  let playerPriority = playerMove.priority;
  let enemyPriority = enemyMove.priority;
  // Prankster: +1 priority on status moves
  if (playerPokemon.ability === 'prankster' && playerMove.category === 'status') playerPriority += 1;
  if (enemyPokemon.ability === 'prankster' && enemyMove.category === 'status') enemyPriority += 1;
  // Gale Wings: +1 priority on Flying-type moves at full HP
  if (playerPokemon.ability === 'gale-wings' && playerMove.type === 'flying' && playerPokemon.currentHp >= playerPokemon.maxHp) playerPriority += 1;
  if (enemyPokemon.ability === 'gale-wings' && enemyMove.type === 'flying' && enemyPokemon.currentHp >= enemyPokemon.maxHp) enemyPriority += 1;

  // Priority check
  if (playerPriority !== enemyPriority) {
    return playerPriority > enemyPriority ? 'player' : 'enemy';
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

  // Choice lock: must use the locked move
  if (pokemon.volatile.choiceLock) {
    const idx = pokemon.moves.findIndex(m => m.moveId === pokemon.volatile.choiceLock);
    if (idx >= 0 && pokemon.moves[idx].currentPp > 0) return idx;
    // If locked move has no PP, can pick any — lock will be cleared
    pokemon.volatile.choiceLock = undefined;
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

  // Assault Vest: block status moves
  if (pokemon.heldItem === 'assault-vest') {
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

  const attackerName = attacker.nickname || getPokemonData(attacker.dataId).name;
  const defenderName = defender.nickname || getPokemonData(defender.dataId).name;

  pushLog(logs, { message: `${attackerName} n'a plus de PP !`, type: 'info' }, attacker, defender);
  pushLog(logs, { message: `${attackerName} utilise Lutte !`, type: 'info' }, attacker, defender);

  // Struggle: 50 base power, typeless (neutral effectiveness), no STAB
  const atk = getEffectiveStat(attacker, 'attack');
  const def = getEffectiveStat(defender, 'defense');
  const levelFactor = ((2 * attacker.level) / 5 + 2);
  let damage = Math.floor((levelFactor * 50 * atk / def) / 50) + 2;

  // Random factor (85-100%)
  const randomFactor = 0.85 + Math.random() * 0.15;
  damage = Math.max(1, Math.floor(damage * randomFactor));

  defender.currentHp = Math.max(0, defender.currentHp - damage);
  pushLog(logs, { message: `${defenderName} perd ${damage} PV !`, type: 'damage' }, attacker, defender);

  // 25% recoil of damage dealt
  const recoil = Math.max(1, Math.floor(damage / 4));
  attacker.currentHp = Math.max(0, attacker.currentHp - recoil);
  pushLog(logs, { message: `${attackerName} subit le contrecoup ! (-${recoil} PV)`, type: 'damage' }, attacker, defender);

  const defenderFainted = defender.currentHp <= 0;
  if (defenderFainted) {
    pushLog(logs, { message: `${defenderName} est K.O. !`, type: 'info' }, attacker, defender);
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
  const isGrounded = !types.includes('flying') && pokemon.volatile.magnetRise <= 0 && pokemon.ability !== 'levitate'; // Flying, Magnet Rise, Levitate = not grounded

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
