import { create } from 'zustand';
import {
  PokemonInstance,
  MoveInstance,
} from '../types/pokemon';
import { BattlePhase, BattleType, BattleLogEntry } from '../types/battle';
import {
  executeMove,
  checkStatusBlock,
  applyStatusDamage,
  determineOrder,
  chooseEnemyMove,
  fullHealTeam,
} from '../engine/battleEngine';
import { attemptCatch } from '../engine/catchCalculator';
import { createPokemonInstance } from '../engine/experienceCalculator';
import { getMoveData, getPokemonData, getItemData } from '../utils/dataLoader';
import { WildEncounter, TrainerData, GymData } from '../types/game';
import { useGameStore } from './gameStore';

export interface BattleStore {
  // State
  active: boolean;
  type: BattleType;
  phase: BattlePhase;
  playerTeam: PokemonInstance[];
  activePlayerIndex: number;
  enemyTeam: PokemonInstance[];
  activeEnemyIndex: number;
  logs: BattleLogEntry[];
  turnNumber: number;
  trainerId: string | null;
  trainerName: string | null;
  trainerReward: number;
  isGym: boolean;
  gymId: string | null;

  // Results
  xpGained: { pokemonIndex: number; defeatedId: number; defeatedLevel: number }[];
  caughtPokemon: PokemonInstance | null;
  moneyGained: number;
  encounterId?: string; // For one-time encounters

  // Actions
  startWildBattle: (encounters: WildEncounter[], playerTeam: PokemonInstance[], encounterId?: string) => void;
  startTrainerBattle: (trainer: TrainerData, playerTeam: PokemonInstance[]) => void;
  startGymBattle: (gym: GymData, playerTeam: PokemonInstance[]) => void;

  selectMove: (moveIndex: number) => void;
  selectSwitch: (teamIndex: number) => void;
  useItem: (itemId: string, targetIndex?: number) => void;
  attemptFlee: () => void;
  attemptCapture: (ballId: string) => void;

  addLog: (message: string, type?: BattleLogEntry['type']) => void;
  clearBattle: () => void;
  getActivePlayer: () => PokemonInstance | null;
  getActiveEnemy: () => PokemonInstance | null;
}

export const useBattleStore = create<BattleStore>((set, get) => ({
  active: false,
  type: 'wild',
  phase: 'intro',
  playerTeam: [],
  activePlayerIndex: 0,
  enemyTeam: [],
  activeEnemyIndex: 0,
  logs: [],
  turnNumber: 0,
  trainerId: null,
  trainerName: null,
  trainerReward: 0,
  isGym: false,
  gymId: null,
  xpGained: [],
  caughtPokemon: null,
  moneyGained: 0,

  startWildBattle: (encounters: WildEncounter[], playerTeam: PokemonInstance[], encounterId?: string) => {
    // Pick random encounter based on rates
    const totalRate = encounters.reduce((sum, e) => sum + e.rate, 0);
    let roll = Math.random() * totalRate;
    let chosen = encounters[0];
    for (const enc of encounters) {
      roll -= enc.rate;
      if (roll <= 0) {
        chosen = enc;
        break;
      }
    }

    const level = chosen.minLevel + Math.floor(Math.random() * (chosen.maxLevel - chosen.minLevel + 1));
    const wildPokemon = createPokemonInstance(chosen.pokemonId, level);
    // Fix PP
    wildPokemon.moves = wildPokemon.moves.map(m => {
      const data = getMoveData(m.moveId);
      return { moveId: m.moveId, currentPp: data.pp, maxPp: data.pp };
    });

    const wildName = getPokemonData(chosen.pokemonId).name;

    // Find first non-fainted pokemon
    const activeIdx = playerTeam.findIndex(p => p.currentHp > 0);

    set({
      active: true,
      type: 'wild',
      phase: 'choosing',
      playerTeam: playerTeam.map(p => ({ ...p })),
      activePlayerIndex: activeIdx >= 0 ? activeIdx : 0,
      enemyTeam: [wildPokemon],
      activeEnemyIndex: 0,
      logs: [{ message: `Un ${wildName} sauvage apparaît !`, type: 'info' }],
      turnNumber: 1,
      trainerId: null,
      trainerName: null,
      trainerReward: 0,
      isGym: false,
      gymId: null,
      xpGained: [],
      caughtPokemon: null,
      moneyGained: 0,
      encounterId
    });
  },

  startTrainerBattle: (trainer: TrainerData, playerTeam: PokemonInstance[]) => {
    const enemyTeam = trainer.team.map(t => {
      const p = createPokemonInstance(t.pokemonId, t.level, t.moves);
      p.moves = p.moves.map(m => {
        const data = getMoveData(m.moveId);
        return { moveId: m.moveId, currentPp: data.pp, maxPp: data.pp };
      });
      return p;
    });

    const activeIdx = playerTeam.findIndex(p => p.currentHp > 0);

    set({
      active: true,
      type: 'trainer',
      phase: 'choosing',
      playerTeam: playerTeam.map(p => ({ ...p })),
      activePlayerIndex: activeIdx >= 0 ? activeIdx : 0,
      enemyTeam,
      activeEnemyIndex: 0,
      logs: [{ message: `${trainer.trainerClass} ${trainer.name} veut se battre !`, type: 'info' }],
      turnNumber: 1,
      trainerId: trainer.id,
      trainerName: `${trainer.trainerClass} ${trainer.name}`,
      trainerReward: trainer.reward,
      isGym: false,
      gymId: null,
      xpGained: [],
      caughtPokemon: null,
      moneyGained: 0,
    });
  },

  startGymBattle: (gym: GymData, playerTeam: PokemonInstance[]) => {
    const enemyTeam = gym.team.map(t => {
      const p = createPokemonInstance(t.pokemonId, t.level, t.moves);
      p.moves = p.moves.map(m => {
        const data = getMoveData(m.moveId);
        return { moveId: m.moveId, currentPp: data.pp, maxPp: data.pp };
      });
      return p;
    });

    const activeIdx = playerTeam.findIndex(p => p.currentHp > 0);

    set({
      active: true,
      type: 'gym',
      phase: 'choosing',
      playerTeam: playerTeam.map(p => ({ ...p })),
      activePlayerIndex: activeIdx >= 0 ? activeIdx : 0,
      enemyTeam,
      activeEnemyIndex: 0,
      logs: [{ message: `Champion ${gym.leader} veut se battre !`, type: 'info' }],
      turnNumber: 1,
      trainerId: null,
      trainerName: `Champion ${gym.leader}`,
      trainerReward: gym.reward,
      isGym: true,
      gymId: gym.id,
      xpGained: [],
      caughtPokemon: null,
      moneyGained: 0,
    });
  },

  selectMove: (moveIndex: number) => {
    const state = get();
    if (state.phase !== 'choosing') return;

    const player = state.playerTeam[state.activePlayerIndex];
    const enemy = state.enemyTeam[state.activeEnemyIndex];
    if (!player || !enemy) return;

    const playerMove = player.moves[moveIndex];
    if (!playerMove || playerMove.currentPp <= 0) return;

    set({ phase: 'executing' });

    const newLogs: BattleLogEntry[] = [];
    const enemyMoveIndex = chooseEnemyMove(enemy);
    const enemyMove = enemy.moves[enemyMoveIndex];

    // Determine order
    const order = determineOrder(player, enemy, { type: 'move', moveIndex }, enemyMoveIndex);

    const first = order === 'player' ? player : enemy;
    const second = order === 'player' ? enemy : player;
    const firstMove = order === 'player' ? playerMove : enemyMove;
    const secondMove = order === 'player' ? enemyMove : playerMove;

    // Execute first attack
    const firstBlocked = checkStatusBlock(first);
    newLogs.push(...firstBlocked.logs);

    let secondFainted = false;
    if (!firstBlocked.blocked && firstMove) {
      const result = executeMove(first, second, firstMove);
      newLogs.push(...result.logs);
      secondFainted = result.defenderFainted;
    }

    // Status damage for first
    newLogs.push(...applyStatusDamage(first));

    // Execute second attack (if not fainted)
    if (!secondFainted && second.currentHp > 0) {
      const secondBlocked = checkStatusBlock(second);
      newLogs.push(...secondBlocked.logs);

      if (!secondBlocked.blocked && secondMove) {
        const result = executeMove(second, first, secondMove);
        newLogs.push(...result.logs);
        if (result.defenderFainted) {
          // First attacker fainted
        }
      }

      // Status damage for second
      newLogs.push(...applyStatusDamage(second));
    }

    // Update state with new logs
    const allLogs = [...state.logs, ...newLogs];
    const newState: Partial<BattleStore> = {
      logs: allLogs,
      turnNumber: state.turnNumber + 1,
    };

    // Check enemy fainted
    if (enemy.currentHp <= 0) {
      const xpEntry = {
        pokemonIndex: state.activePlayerIndex,
        defeatedId: enemy.dataId,
        defeatedLevel: enemy.level,
      };

      // Check if there are more enemy Pokémon (trainer battle)
      const nextEnemy = state.enemyTeam.findIndex(
        (p, i) => i > state.activeEnemyIndex && p.currentHp > 0
      );

      if (nextEnemy >= 0 && (state.type === 'trainer' || state.type === 'gym')) {
        const nextName = getPokemonData(state.enemyTeam[nextEnemy].dataId).name;
        newState.activeEnemyIndex = nextEnemy;
        newState.phase = 'choosing';
        newState.xpGained = [...state.xpGained, xpEntry];
        newState.logs = [
          ...allLogs,
          { message: `${state.trainerName} envoie ${nextName} !`, type: 'info' },
        ];
      } else {
        // Victory!
        newState.phase = 'victory';

        // League Progression
        if (state.trainerId?.startsWith('league-')) {
          useGameStore.getState().advanceLeagueProgress();
        }

        newState.xpGained = [...state.xpGained, xpEntry];
        newState.moneyGained = state.trainerReward;
        newState.logs = [
          ...allLogs,
          {
            message: state.type === 'wild'
              ? 'Vous avez gagné le combat !'
              : `Vous avez battu ${state.trainerName} !`,
            type: 'info',
          },
        ];
        if (state.trainerReward > 0) {
          newState.logs = [
            ...(newState.logs as BattleLogEntry[]),
            { message: `Vous gagnez ${state.trainerReward}₽ !`, type: 'xp' },
          ];
        }
      }
    }
    // Check player fainted
    else if (player.currentHp <= 0) {
      const nextPlayer = state.playerTeam.findIndex(
        (p, i) => i !== state.activePlayerIndex && p.currentHp > 0
      );

      if (nextPlayer >= 0) {
        newState.activePlayerIndex = nextPlayer;
        newState.phase = 'switching';
        const nextName = getPokemonData(state.playerTeam[nextPlayer].dataId).name;
        newState.logs = [
          ...allLogs,
          { message: `Envoyez votre prochain Pokémon !`, type: 'info' },
        ];
      } else {
        // All fainted - defeat
        newState.phase = 'defeat';
        newState.logs = [
          ...allLogs,
          { message: 'Tous vos Pokémon sont K.O...', type: 'info' },
        ];

        // League Reset
        if (state.trainerId?.startsWith('league-')) {
          useGameStore.getState().resetLeagueProgress();
        }
      }
    } else {
      newState.phase = 'choosing';
    }

    set(newState as any);
  },

  selectSwitch: (teamIndex: number) => {
    const state = get();
    const target = state.playerTeam[teamIndex];
    if (!target || target.currentHp <= 0) return;

    const targetName = target.nickname || getPokemonData(target.dataId).name;

    set({
      activePlayerIndex: teamIndex,
      phase: 'choosing',
      logs: [...state.logs, { message: `Go ! ${targetName} !`, type: 'info' }],
    });
  },

  useItem: (itemId: string, targetIndex?: number) => {
    const state = get();
    const item = getItemData(itemId);
    if (!item.effect) return;

    if (item.effect.type === 'heal') {
      const idx = targetIndex ?? state.activePlayerIndex;
      const pokemon = state.playerTeam[idx];
      if (!pokemon || pokemon.currentHp <= 0) return;

      const name = pokemon.nickname || getPokemonData(pokemon.dataId).name;
      const healAmount = item.effect.healFull
        ? pokemon.maxHp - pokemon.currentHp
        : Math.min(item.effect.healAmount ?? 0, pokemon.maxHp - pokemon.currentHp);

      pokemon.currentHp += healAmount;

      set({
        logs: [...state.logs, { message: `${name} récupère ${healAmount} PV !`, type: 'info' }],
      });

      // Enemy still attacks
      if (state.phase === 'choosing') {
        const enemy = state.enemyTeam[state.activeEnemyIndex];
        if (enemy && enemy.currentHp > 0) {
          const enemyMoveIdx = chooseEnemyMove(enemy);
          const enemyMove = enemy.moves[enemyMoveIdx];
          if (enemyMove) {
            const blocked = checkStatusBlock(enemy);
            const newLogs = [...blocked.logs];
            if (!blocked.blocked) {
              const player = state.playerTeam[state.activePlayerIndex];
              const result = executeMove(enemy, player, enemyMove);
              newLogs.push(...result.logs);
            }
            set({ logs: [...get().logs, ...newLogs] });
          }
        }
        set({ phase: 'choosing', turnNumber: state.turnNumber + 1 });
      }
    }

    if (item.effect.type === 'status_cure') {
      const idx = targetIndex ?? state.activePlayerIndex;
      const pokemon = state.playerTeam[idx];
      if (!pokemon) return;

      const cures = item.effect.curesStatus ?? [];
      if (pokemon.status && cures.includes(pokemon.status)) {
        const name = pokemon.nickname || getPokemonData(pokemon.dataId).name;
        pokemon.status = null;
        pokemon.statusTurns = 0;
        set({
          logs: [...state.logs, { message: `${name} est soigné !`, type: 'info' }],
        });
      }
    }

    if (item.effect.type === 'revive') {
      const idx = targetIndex ?? 0;
      const pokemon = state.playerTeam[idx];
      if (!pokemon || pokemon.currentHp > 0) return;

      const name = pokemon.nickname || getPokemonData(pokemon.dataId).name;
      pokemon.currentHp = Math.floor(pokemon.maxHp * (item.effect.reviveHpPercent ?? 50) / 100);
      pokemon.status = null;
      pokemon.statusTurns = 0;
      set({
        logs: [...state.logs, { message: `${name} est ranimé !`, type: 'info' }],
      });
    }
  },

  attemptFlee: () => {
    const state = get();
    if (state.type !== 'wild') {
      set({ logs: [...state.logs, { message: 'Impossible de fuir un combat de dresseur !', type: 'info' }] });
      return;
    }

    // Simple flee formula: 50% + 10% per speed advantage
    const player = state.playerTeam[state.activePlayerIndex];
    const enemy = state.enemyTeam[state.activeEnemyIndex];
    if (!player || !enemy) return;

    const fleeChance = Math.min(0.95, 0.5 + (player.stats.speed - enemy.stats.speed) * 0.01);

    if (Math.random() < fleeChance) {
      set({
        phase: 'fled',
        logs: [...state.logs, { message: 'Vous avez pris la fuite !', type: 'info' }],
      });
    } else {
      // Enemy attacks
      const enemyMoveIdx = chooseEnemyMove(enemy);
      const enemyMove = enemy.moves[enemyMoveIdx];
      const newLogs: BattleLogEntry[] = [{ message: 'Fuite impossible !', type: 'info' }];

      if (enemyMove) {
        const blocked = checkStatusBlock(enemy);
        newLogs.push(...blocked.logs);
        if (!blocked.blocked) {
          const result = executeMove(enemy, player, enemyMove);
          newLogs.push(...result.logs);
        }
      }

      set({
        logs: [...state.logs, ...newLogs],
        turnNumber: state.turnNumber + 1,
      });
    }
  },

  attemptCapture: (ballId: string) => {
    const state = get();
    if (state.type !== 'wild') {
      set({ logs: [...state.logs, { message: 'Impossible de capturer un Pokémon dresseur !', type: 'info' }] });
      return;
    }

    const enemy = state.enemyTeam[state.activeEnemyIndex];
    if (!enemy) return;

    const ball = getItemData(ballId);
    const multiplier = ball.effect?.catchMultiplier ?? 1;

    const result = attemptCatch(enemy, multiplier);
    const newLogs: BattleLogEntry[] = [];

    const shakeMsgs = ['...', '...', '...', '...'];
    for (let i = 0; i < result.shakes && i < 4; i++) {
      newLogs.push({ message: shakeMsgs[i], type: 'catch' });
    }

    newLogs.push(...result.messages.map(m => ({ message: m, type: 'catch' as const })));

    if (result.success) {
      const enemyName = getPokemonData(enemy.dataId).name;
      newLogs.push({ message: `${enemyName} a été capturé !`, type: 'catch' });
      set({
        phase: 'caught',
        logs: [...state.logs, ...newLogs],
        caughtPokemon: enemy,
      });

      if (state.encounterId) {
        useGameStore.getState().markTrainerDefeated(state.encounterId);
      }
    } else {
      // Enemy attacks after failed capture
      const player = state.playerTeam[state.activePlayerIndex];
      if (player && enemy.currentHp > 0) {
        const enemyMoveIdx = chooseEnemyMove(enemy);
        const enemyMove = enemy.moves[enemyMoveIdx];
        if (enemyMove) {
          const blocked = checkStatusBlock(enemy);
          newLogs.push(...blocked.logs);
          if (!blocked.blocked) {
            const execResult = executeMove(enemy, player, enemyMove);
            newLogs.push(...execResult.logs);

            if (player.currentHp <= 0) {
              const nextPlayer = state.playerTeam.findIndex(
                (p, i) => i !== state.activePlayerIndex && p.currentHp > 0
              );
              if (nextPlayer < 0) {
                set({
                  phase: 'defeat',
                  logs: [...state.logs, ...newLogs, { message: 'Tous vos Pokémon sont K.O...', type: 'info' }],
                });
                return;
              }
            }
          }
        }
      }

      set({
        logs: [...state.logs, ...newLogs],
        turnNumber: state.turnNumber + 1,
      });
    }
  },

  addLog: (message: string, type: BattleLogEntry['type'] = 'info') => {
    set({ logs: [...get().logs, { message, type }] });
  },

  clearBattle: () => {
    set({
      active: false,
      phase: 'intro',
      playerTeam: [],
      activePlayerIndex: 0,
      enemyTeam: [],
      activeEnemyIndex: 0,
      logs: [],
      turnNumber: 0,
      trainerId: null,
      trainerName: null,
      trainerReward: 0,
      isGym: false,
      gymId: null,
      xpGained: [],
      caughtPokemon: null,
      moneyGained: 0,
    });
  },

  getActivePlayer: () => {
    const state = get();
    return state.playerTeam[state.activePlayerIndex] ?? null;
  },

  getActiveEnemy: () => {
    const state = get();
    return state.enemyTeam[state.activeEnemyIndex] ?? null;
  },
}));
