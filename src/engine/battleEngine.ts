import { PokemonInstance, MoveData, StatusCondition, MoveInstance } from '../types/pokemon';
import { BattleLogEntry, BattleAction } from '../types/battle';
import { calculateDamage, } from './damageCalculator';
import { getMoveData, getPokemonData } from '../utils/dataLoader';

/**
 * Core battle engine - handles turn execution, status effects, etc.
 * Stateless functions that operate on Pokémon instances.
 */

// ===== Status Effects =====

export function applyStatusDamage(pokemon: PokemonInstance): BattleLogEntry[] {
  const logs: BattleLogEntry[] = [];
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
  const name = pokemon.nickname || getPokemonData(pokemon.dataId).name;

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

  // Already has a status
  if (target.status !== null) return logs;

  const chance = move.effect.chance ?? 100;
  if (Math.random() * 100 >= chance) return logs;

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
  if (Math.random() * 100 >= chance) return logs;

  // For MVP, stat stages are simplified: directly modify the stat
  // A proper implementation would track stages (-6 to +6) separately
  const stat = move.effect.stat;
  const stages = move.effect.stages ?? 0;
  if (!stat || stages === 0) return logs;

  const targetName = target.nickname || getPokemonData(target.dataId).name;

  // Apply a multiplier: each stage = ~50% change
  const multiplier = stages > 0 ? 1 + 0.5 * stages : 1 / (1 + 0.5 * Math.abs(stages));

  const statKey = stat as keyof typeof target.stats;
  const oldValue = target.stats[statKey];
  target.stats[statKey] = Math.max(1, Math.floor(oldValue * multiplier));

  const direction = stages > 0 ? 'monte' : 'baisse';
  const statNames: Record<string, string> = {
    attack: 'Attaque',
    defense: 'Défense',
    spAtk: 'Attaque Spé.',
    spDef: 'Défense Spé.',
    speed: 'Vitesse',
    hp: 'PV',
  };

  logs.push({
    message: `${statNames[stat] || stat} de ${targetName} ${direction} !`,
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
  moveInstance: MoveInstance
): MoveExecutionResult {
  const logs: BattleLogEntry[] = [];
  const move = getMoveData(moveInstance.moveId);
  const attackerName = attacker.nickname || getPokemonData(attacker.dataId).name;
  const defenderName = defender.nickname || getPokemonData(defender.dataId).name;

  logs.push({ message: `${attackerName} utilise ${move.name} !`, type: 'info' });

  // Deduct PP
  moveInstance.currentPp = Math.max(0, moveInstance.currentPp - 1);

  // Accuracy check
  if (move.accuracy !== null) {
    const roll = Math.random() * 100;
    if (roll >= move.accuracy) {
      logs.push({ message: `${attackerName} rate son attaque !`, type: 'info' });
      return { logs, defenderFainted: false };
    }
  }

  let defenderFainted = false;

  if (move.category === 'status') {
    // Status move: apply effect
    if (move.target === 'self') {
      logs.push(...tryApplyStatChange(attacker, move, true));
    } else {
      logs.push(...tryApplyStatus(defender, move));
      logs.push(...tryApplyStatChange(defender, move, false));
    }
  } else {
    // Damaging move
    const result = calculateDamage(attacker, defender, move);

    defender.currentHp = Math.max(0, defender.currentHp - result.damage);

    if (result.effectiveness === 0) {
      logs.push({ message: `Ça n'affecte pas ${defenderName}...`, type: 'effective' });
    } else {
      if (result.effectiveness > 1) {
        logs.push({ message: `C'est super efficace !`, type: 'effective' });
      } else if (result.effectiveness < 1 && result.effectiveness > 0) {
        logs.push({ message: `Ce n'est pas très efficace...`, type: 'effective' });
      }

      if (result.isCritical) {
        logs.push({ message: `Coup critique !`, type: 'critical' });
      }

      logs.push({ message: `${defenderName} perd ${result.damage} PV !`, type: 'damage' });

      // Apply secondary status effect
      if (move.effect?.type === 'status') {
        logs.push(...tryApplyStatus(defender, move));
      }

      // Drain effect
      if (move.effect?.type === 'drain' && move.effect.amount) {
        const healAmount = Math.max(1, Math.floor(result.damage * move.effect.amount / 100));
        attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + healAmount);
        logs.push({ message: `${attackerName} récupère ${healAmount} PV !`, type: 'info' });
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

  // Speed check (paralysis halves speed)
  let playerSpeed = playerPokemon.stats.speed;
  let enemySpeed = enemyPokemon.stats.speed;

  if (playerPokemon.status === 'paralysis') playerSpeed = Math.floor(playerSpeed / 4);
  if (enemyPokemon.status === 'paralysis') enemySpeed = Math.floor(enemySpeed / 4);

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

  if (available.length === 0) return 0;

  const chosen = available[Math.floor(Math.random() * available.length)];
  return chosen.index;
}

/**
 * Heal a Pokémon fully (after battle in this game's design)
 */
export function fullHealTeam(team: PokemonInstance[]): void {
  for (const pokemon of team) {
    pokemon.currentHp = pokemon.maxHp;
    pokemon.status = null;
    pokemon.statusTurns = 0;
    for (const move of pokemon.moves) {
      move.currentPp = move.maxPp;
    }
  }
}
