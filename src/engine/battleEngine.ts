import { PokemonInstance, MoveData, StatusCondition, MoveInstance } from '../types/pokemon';
import { BattleLogEntry, BattleAction } from '../types/battle';
import { calculateDamage, } from './damageCalculator';
import { getEffectiveStat } from './statCalculator';
import { getMoveData, getPokemonData } from '../utils/dataLoader';

/**
 * Core battle engine - handles turn execution, status effects, etc.
 * Stateless functions that operate on Pokémon instances.
 */

// ===== Status Effects =====

export function applyStatusDamage(pokemon: PokemonInstance): BattleLogEntry[] {
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

  if (pokemon.status === 'poison') {
    const damage = Math.max(1, Math.floor(pokemon.maxHp / 8));
    pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
    logs.push({ message: `${name} souffre du poison ! (-${damage} PV)`, type: 'status' });
  }

  if (pokemon.status === 'burn') {
    const damage = Math.max(1, Math.floor(pokemon.maxHp / 16));
    pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
    logs.push({ message: `${name} souffre de sa brûlure ! (-${damage} PV)`, type: 'status' });
  }

  return logs;
}

export function checkStatusBlock(pokemon: PokemonInstance): { blocked: boolean; logs: BattleLogEntry[] } {
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

  target.status = move.effect.status;

  // Set sleep turns
  if (target.status === 'sleep') {
    target.statusTurns = 1 + Math.floor(Math.random() * 3); // 1-3 turns
  }

  const statusNames: Record<string, string> = {
    paralysis: 'paralysé',
    sleep: 'endormi',
    poison: 'empoisonné',
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

  // Apply stage
  const currentStage = target.statStages[stat];
  const newStage = Math.max(-6, Math.min(6, currentStage + stages));

  if (currentStage === newStage) {
    logs.push({ message: `Les stats de ${targetName} ne peuvent pas aller plus loin !`, type: 'info' });
    return logs;
  }

  target.statStages[stat] = newStage;

  const direction = stages > 0 ? 'monte' : 'baisse';
  const intensity = Math.abs(stages) > 1 ? 'beaucoup' : '';

  const statNames: Record<string, string> = {
    attack: 'Attaque',
    defense: 'Défense',
    spAtk: 'Attaque Spé.',
    spDef: 'Défense Spé.',
    speed: 'Vitesse',
    hp: 'PV',
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
  attackerBadges: string[] = []
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

  logs.push({ message: `${attackerName} utilise ${move.name} !`, type: 'info' });

  // Deduct PP
  moveInstance.currentPp = Math.max(0, moveInstance.currentPp - 1);

  // Charge Check (Solar Beam etc)
  if (move.effect?.type === 'charge') {
    if (attacker.volatile.charging !== move.id) {
      attacker.volatile.charging = move.id;
      logs.push({ message: `${attackerName} accumule de l’énergie !`, type: 'info' });
      return { logs, defenderFainted: false };
    } else {
      attacker.volatile.charging = undefined; // Unleash
    }
  }

  // Accuracy check
  if (move.accuracy !== null) {
    const roll = Math.random() * 100;
    if (roll > move.accuracy) {
      logs.push({ message: `${attackerName} rate son attaque !`, type: 'info' });
      attacker.volatile.charging = undefined; // Reset charge if miss? Usually yes.
      return { logs, defenderFainted: false };
    }
  }

  let defenderFainted = false;

  if (move.category === 'status') {
    // Status move: apply effect
    if (move.target === 'self') {
      // Handle Rest specially: heal fully, cure status, apply 2-turn sleep
      if (move.effect?.type === 'status' && move.effect.status === 'sleep') {
        if (attacker.currentHp >= attacker.maxHp) {
          logs.push({ message: `Mais cela échoue !`, type: 'info' });
        } else {
          attacker.status = null; // Clear any existing status
          attacker.statusTurns = 0;
          attacker.currentHp = attacker.maxHp;
          attacker.status = 'sleep';
          attacker.statusTurns = 2;
          logs.push({ message: `${attackerName} récupère tous ses PV et s'endort !`, type: 'info' });
        }
      } else {
        // Other self-targeting status/stat moves (e.g., Swords Dance)
        logs.push(...tryApplyStatus(attacker, move));
        logs.push(...tryApplyStatChange(attacker, move, true));
      }
    } else {
      logs.push(...tryApplyStatus(defender, move));
      logs.push(...tryApplyStatChange(defender, move, false));
    }
  } else {
    // Damaging move (Single or Multi-hit)
    let hits = 1;
    if (move.effect?.type === 'multi') {
      if (move.effect.count) {
        hits = move.effect.count;
      } else {
        const min = move.effect.min ?? 2;
        const max = move.effect.max ?? 5;
        // Weighted distribution for 2-5
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
    const defenderHpBefore = defender.currentHp; // Track for drain cap

    for (let i = 0; i < hits; i++) {
      const result = calculateDamage(attacker, defender, move, attackerBadges);
      defender.currentHp = Math.max(0, defender.currentHp - result.damage);
      totalDamage += result.damage;
      hitCount++;

      // Only log effectiveness/crit once or per hit? 
      // Usually, Gen 1 logs "Critical hit!" per hit, but effectiveness once.
      // Simplified: Log damage per hit.

      if (result.isCritical) logs.push({ message: `Coup critique !`, type: 'critical' });

      // Show effectiveness only on first hit to reduce spam
      if (i === 0) {
        if (result.effectiveness > 1) logs.push({ message: `C'est super efficace !`, type: 'effective' });
        if (result.effectiveness < 1 && result.effectiveness > 0) logs.push({ message: `Ce n'est pas très efficace...`, type: 'effective' });
        if (result.effectiveness === 0) logs.push({ message: `Ça n'affecte pas ${defenderName}...`, type: 'effective' });
      }

      // logs.push({ message: `${defenderName} perd ${result.damage} PV !`, type: 'damage' });

      if (defender.currentHp <= 0) break;
    }

    logs.push({ message: `${defenderName} perd ${totalDamage} PV !`, type: 'damage' });

    if (hits > 1) {
      logs.push({ message: `Touché ${hitCount} fois !`, type: 'info' });
    }

    // Recoil
    if (move.effect?.type === 'recoil' && move.effect.amount) {
      const recoil = Math.max(1, Math.floor(totalDamage * move.effect.amount / 100));
      attacker.currentHp = Math.max(0, attacker.currentHp - recoil);
      logs.push({ message: `${attackerName} subit le contrecoup ! (-${recoil} PV)`, type: 'damage' });
    }

    // Drain (capped at actual HP the defender lost, not raw calculated damage)
    if (move.effect?.type === 'drain' && move.effect.amount) {
      const actualHpLost = defenderHpBefore - defender.currentHp;
      const healAmount = Math.max(1, Math.floor(actualHpLost * move.effect.amount / 100));
      attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + healAmount);
      logs.push({ message: `${attackerName} récupère ${healAmount} PV !`, type: 'info' });
    }

    // Secondary Effects (Status/Flinch) - Only if not fainted? Usually trigger anyway.
    if (defender.currentHp > 0) {
      if (move.effect?.type === 'status') {
        logs.push(...tryApplyStatus(defender, move));
      }
      if (move.effect?.type === 'flinch') {
        const chance = move.effect.chance ?? 30;
        if (Math.random() * 100 < chance) {
          defender.volatile.flinch = true;
        }
      }
    }

    defenderFainted = defender.currentHp <= 0;
    if (defenderFainted) {
      logs.push({ message: `${defenderName} est K.O. !`, type: 'info' });
    }
  }

  return { logs, defenderFainted };
}

/**
 * Determine turn order based on speed and priority
 */
export function determineOrder(
  playerPokemon: PokemonInstance,
  enemyPokemon: PokemonInstance,
  playerAction: BattleAction,
  enemyMoveIndex: number
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

  // Speed check (accounts for stat stages and paralysis)
  const playerSpeed = getEffectiveStat(playerPokemon, 'speed');
  const enemySpeed = getEffectiveStat(enemyPokemon, 'speed');

  if (playerSpeed !== enemySpeed) {
    return playerSpeed > enemySpeed ? 'player' : 'enemy';
  }

  // Speed tie: random
  return Math.random() < 0.5 ? 'player' : 'enemy';
}

/**
 * Choose a random move for AI (enemy Pokémon)
 * Picks a random move that has PP > 0
 */
export function chooseEnemyMove(pokemon: PokemonInstance): number {
  const available = pokemon.moves
    .map((m, i) => ({ ...m, index: i }))
    .filter(m => m.currentPp > 0);

  if (available.length === 0) return -1; // Signal: use Struggle

  const chosen = available[Math.floor(Math.random() * available.length)];
  return chosen.index;
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
 * Heal a Pokémon fully (after battle in this game's design)
 */
export function fullHealTeam(team: PokemonInstance[]): void {
  for (const pokemon of team) {
    pokemon.currentHp = pokemon.maxHp;
    pokemon.status = null;
    pokemon.statusTurns = 0;
    pokemon.volatile = { confusion: 0, flinch: false, leechSeed: false, bound: 0 };
    pokemon.statStages = { hp: 0, attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 };
    for (const move of pokemon.moves) {
      move.currentPp = move.maxPp;
    }
  }
}
