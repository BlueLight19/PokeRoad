import { create } from 'zustand';
import {
  PokemonInstance,
  MoveInstance,
} from '../types/pokemon';
import { BattlePhase, BattleType, BattleLogEntry } from '../types/battle';
import {
  executeMove,
  executeStruggle,
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

  // Safari
  safariCatchFactor?: number; // Modified by Rock/Bait
  safariFleeFactor?: number; // Modified by Rock/Bait

  // Actions
  startWildBattle: (encounters: WildEncounter[], playerTeam: PokemonInstance[], encounterId?: string) => void;
  startTrainerBattle: (trainer: TrainerData, playerTeam: PokemonInstance[]) => void;
  startGymBattle: (gym: GymData, playerTeam: PokemonInstance[]) => void;

  selectMove: (moveIndex: number) => void;
  selectSwitch: (teamIndex: number) => void;
  useItem: (itemId: string, targetIndex?: number) => void;
  attemptFlee: () => void;
  attemptCapture: (ballId: string) => void;
  throwSafariBall: () => void;
  throwRock: () => void;
  throwBait: () => void;

  addLog: (message: string, type?: BattleLogEntry['type']) => void;
  clearBattle: () => void;
  getActivePlayer: () => PokemonInstance | null;
  getActiveEnemy: () => PokemonInstance | null;
}

/** Deep copy a PokemonInstance so battle mutations don't leak to game store */
function deepCopyPokemon(p: PokemonInstance): PokemonInstance {
  return {
    ...p,
    moves: p.moves.map(m => ({ ...m })),
    volatile: { ...p.volatile },
    statStages: { ...p.statStages },
    stats: { ...p.stats },
    ivs: { ...p.ivs },
    evs: { ...p.evs },
  };
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
  safariCatchFactor: 1,
  safariFleeFactor: 1,

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

    // Check for Chroma Charms
    const gameStore = useGameStore.getState();
    const inventory = gameStore.inventory;
    const chromaCharms = inventory.find(i => i.itemId === 'chroma-charm')?.quantity || 0;

    // Base rate 1/4096. 1 charm = +75% (x1.75).
    const shinyRate = (1 / 4096) * Math.pow(1.75, chromaCharms);
    const isShiny = Math.random() < shinyRate;

    const level = chosen.minLevel + Math.floor(Math.random() * (chosen.maxLevel - chosen.minLevel + 1));
    const wildPokemon = createPokemonInstance(chosen.pokemonId, level, undefined, isShiny);
    // Fix PP
    wildPokemon.moves = wildPokemon.moves.map(m => {
      const data = getMoveData(m.moveId);
      return { moveId: m.moveId, currentPp: data.pp, maxPp: data.pp };
    });

    const wildName = getPokemonData(chosen.pokemonId).name;

    // Find first non-fainted pokemon
    const activeIdx = playerTeam.findIndex(p => p.currentHp > 0);

    // Check safari
    const safariState = useGameStore.getState().safariState;
    const isSafari = !!safariState;

    set({
      active: true,
      type: isSafari ? 'safari' : 'wild',
      phase: 'choosing',
      playerTeam: playerTeam.map(deepCopyPokemon),
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
      encounterId,
      safariCatchFactor: 1,
      safariFleeFactor: 1
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
      playerTeam: playerTeam.map(deepCopyPokemon),
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
      playerTeam: playerTeam.map(deepCopyPokemon),
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

    // Player Struggle: moveIndex === -1 means all PP are 0
    const playerUseStruggle = moveIndex === -1;
    const playerMove = playerUseStruggle ? null : player.moves[moveIndex];
    if (!playerUseStruggle && (!playerMove || playerMove.currentPp <= 0)) return;

    set({ phase: 'executing' });

    const newLogs: BattleLogEntry[] = [];
    const enemyMoveIndex = chooseEnemyMove(enemy);
    const enemyUseStruggle = enemyMoveIndex === -1;
    const enemyMove = enemyUseStruggle ? null : enemy.moves[enemyMoveIndex];

    // Determine order (if using Struggle, still compare speeds; use index 0 as placeholder)
    const order = determineOrder(
      player, enemy,
      { type: 'move', moveIndex: playerUseStruggle ? 0 : moveIndex },
      enemyUseStruggle ? 0 : enemyMoveIndex
    );

    const first = order === 'player' ? player : enemy;
    const second = order === 'player' ? enemy : player;
    const firstMove = order === 'player' ? playerMove : enemyMove;
    const secondMove = order === 'player' ? enemyMove : playerMove;
    const firstUseStruggle = order === 'player' ? playerUseStruggle : enemyUseStruggle;
    const secondUseStruggle = order === 'player' ? enemyUseStruggle : playerUseStruggle;

    // Execute first attack
    const firstBlocked = checkStatusBlock(first);
    newLogs.push(...firstBlocked.logs);

    let secondFainted = false;
    if (!firstBlocked.blocked) {
      if (firstUseStruggle) {
        const result = executeStruggle(first, second);
        newLogs.push(...result.logs);
        secondFainted = result.defenderFainted;
      } else if (firstMove) {
        const result = executeMove(first, second, firstMove);
        newLogs.push(...result.logs);
        secondFainted = result.defenderFainted;
      }
    }

    // Status damage for first
    newLogs.push(...applyStatusDamage(first));

    // Check if first attacker fainted (from recoil or status damage) - double K.O. case
    const firstFaintedAfterAttack = first.currentHp <= 0;

    // Execute second attack (if not fainted)
    if (!secondFainted && second.currentHp > 0) {
      const secondBlocked = checkStatusBlock(second);
      newLogs.push(...secondBlocked.logs);

      if (!secondBlocked.blocked) {
        if (secondUseStruggle) {
          const result = executeStruggle(second, first);
          newLogs.push(...result.logs);
        } else if (secondMove) {
          const result = executeMove(second, first, secondMove);
          newLogs.push(...result.logs);
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

      // Double K.O. check: if player also fainted (from recoil/status), handle player faint
      if (player.currentHp <= 0) {
        const nextPlayer = state.playerTeam.findIndex(
          (p, i) => i !== state.activePlayerIndex && p.currentHp > 0
        );

        // Still grant XP for the KO
        newState.xpGained = [...state.xpGained, xpEntry];

        // Check if there are more enemy Pokémon (trainer battle)
        const nextEnemy = state.enemyTeam.findIndex(
          (p, i) => i > state.activeEnemyIndex && p.currentHp > 0
        );

        if (nextPlayer < 0) {
          // All player Pokémon fainted - defeat
          newState.phase = 'defeat';
          newState.logs = [
            ...allLogs,
            { message: 'Tous vos Pokémon sont K.O...', type: 'info' },
          ];
          if (state.trainerId?.startsWith('league-')) {
            useGameStore.getState().resetLeagueProgress();
          }
        } else if (nextEnemy >= 0 && (state.type === 'trainer' || state.type === 'gym')) {
          // More enemies remain, player needs to switch
          const nextName = getPokemonData(state.enemyTeam[nextEnemy].dataId).name;
          newState.activeEnemyIndex = nextEnemy;
          newState.phase = 'switching';
          newState.logs = [
            ...allLogs,
            { message: `${state.trainerName} envoie ${nextName} !`, type: 'info' },
            { message: 'Envoyez votre prochain Pokémon !', type: 'info' },
          ];
        } else {
          // No more enemies - victory (despite player also fainting)
          newState.phase = 'victory';
          if (state.trainerId?.startsWith('league-')) {
            useGameStore.getState().advanceLeagueProgress();
          }
          if (state.encounterId) {
            useGameStore.getState().triggerEvent(state.encounterId);
          }
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
      } else {
        // Normal case: enemy fainted, player alive
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

          // Static Encounter Defeat (Legendaries/Snorlax)
          if (state.encounterId) {
            useGameStore.getState().triggerEvent(state.encounterId);
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
    }
    // Check player fainted
    else if (player.currentHp <= 0) {
      const nextPlayer = state.playerTeam.findIndex(
        (p, i) => i !== state.activePlayerIndex && p.currentHp > 0
      );

      if (nextPlayer >= 0) {
        // Do NOT update activePlayerIndex here. 
        // We want the user to click the next pokemon. 
        // If we update it now, the UI sees it as "active" and disables the button.
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
    const newLogs: BattleLogEntry[] = [{ message: `Go ! ${targetName} !`, type: 'info' }];

    // Reset volatile status for the switched-in Pokemon
    target.volatile = { confusion: 0, flinch: false, leechSeed: false, bound: 0 };
    target.statStages = { hp: 0, attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 };

    // Enemy gets a free attack when switching (except during forced switch after fainting)
    if (state.phase !== 'switching') {
      const enemy = state.enemyTeam[state.activeEnemyIndex];
      if (enemy && enemy.currentHp > 0) {
        const enemyMoveIdx = chooseEnemyMove(enemy);
        if (enemyMoveIdx === -1) {
          const result = executeStruggle(enemy, target);
          newLogs.push(...result.logs);
        } else {
          const enemyMove = enemy.moves[enemyMoveIdx];
          if (enemyMove) {
            const blocked = checkStatusBlock(enemy);
            newLogs.push(...blocked.logs);
            if (!blocked.blocked) {
              const result = executeMove(enemy, target, enemyMove);
              newLogs.push(...result.logs);
            }
          }
        }
        newLogs.push(...applyStatusDamage(enemy));
      }
    }

    set({
      activePlayerIndex: teamIndex,
      phase: 'choosing',
      logs: [...state.logs, ...newLogs],
      turnNumber: state.phase !== 'switching' ? state.turnNumber + 1 : state.turnNumber,
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
          const newLogs: BattleLogEntry[] = [];

          if (enemyMoveIdx === -1) {
            // Struggle
            const result = executeStruggle(enemy, state.playerTeam[state.activePlayerIndex]);
            newLogs.push(...result.logs);
          } else {
            const enemyMove = enemy.moves[enemyMoveIdx];
            if (enemyMove) {
              const blocked = checkStatusBlock(enemy);
              newLogs.push(...blocked.logs);
              if (!blocked.blocked) {
                const player = state.playerTeam[state.activePlayerIndex];
                const result = executeMove(enemy, player, enemyMove);
                newLogs.push(...result.logs);
              }
            }
          }
          newLogs.push(...applyStatusDamage(enemy));

          // Check if player fainted after enemy attack
          const player = state.playerTeam[state.activePlayerIndex];
          if (player.currentHp <= 0) {
            const nextPlayer = state.playerTeam.findIndex(
              (p, i) => i !== state.activePlayerIndex && p.currentHp > 0
            );
            if (nextPlayer < 0) {
              set({
                phase: 'defeat',
                logs: [...get().logs, ...newLogs, { message: 'Tous vos Pokémon sont K.O...', type: 'info' }],
              });
              return;
            } else {
              set({
                phase: 'switching',
                logs: [...get().logs, ...newLogs, { message: 'Envoyez votre prochain Pokémon !', type: 'info' }],
                turnNumber: state.turnNumber + 1,
              });
              return;
            }
          }
          set({ logs: [...get().logs, ...newLogs] });
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

      // Enemy still attacks after status cure
      if (state.phase === 'choosing') {
        const enemy = state.enemyTeam[state.activeEnemyIndex];
        if (enemy && enemy.currentHp > 0) {
          const enemyMoveIdx = chooseEnemyMove(enemy);
          const newLogs: BattleLogEntry[] = [];

          if (enemyMoveIdx === -1) {
            const result = executeStruggle(enemy, state.playerTeam[state.activePlayerIndex]);
            newLogs.push(...result.logs);
          } else {
            const enemyMove = enemy.moves[enemyMoveIdx];
            if (enemyMove) {
              const blocked = checkStatusBlock(enemy);
              newLogs.push(...blocked.logs);
              if (!blocked.blocked) {
                const result = executeMove(enemy, state.playerTeam[state.activePlayerIndex], enemyMove);
                newLogs.push(...result.logs);
              }
            }
          }
          newLogs.push(...applyStatusDamage(enemy));

          const player = state.playerTeam[state.activePlayerIndex];
          if (player.currentHp <= 0) {
            const nextPlayer = state.playerTeam.findIndex(
              (p, i) => i !== state.activePlayerIndex && p.currentHp > 0
            );
            if (nextPlayer < 0) {
              set({
                phase: 'defeat',
                logs: [...get().logs, ...newLogs, { message: 'Tous vos Pokémon sont K.O...', type: 'info' }],
              });
              return;
            } else {
              set({
                phase: 'switching',
                logs: [...get().logs, ...newLogs, { message: 'Envoyez votre prochain Pokémon !', type: 'info' }],
                turnNumber: state.turnNumber + 1,
              });
              return;
            }
          }
          set({ logs: [...get().logs, ...newLogs] });
        }
        set({ phase: 'choosing', turnNumber: state.turnNumber + 1 });
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

      // Enemy still attacks after revive
      if (state.phase === 'choosing') {
        const enemy = state.enemyTeam[state.activeEnemyIndex];
        if (enemy && enemy.currentHp > 0) {
          const enemyMoveIdx = chooseEnemyMove(enemy);
          const newLogs: BattleLogEntry[] = [];

          if (enemyMoveIdx === -1) {
            const result = executeStruggle(enemy, state.playerTeam[state.activePlayerIndex]);
            newLogs.push(...result.logs);
          } else {
            const enemyMove = enemy.moves[enemyMoveIdx];
            if (enemyMove) {
              const blocked = checkStatusBlock(enemy);
              newLogs.push(...blocked.logs);
              if (!blocked.blocked) {
                const result = executeMove(enemy, state.playerTeam[state.activePlayerIndex], enemyMove);
                newLogs.push(...result.logs);
              }
            }
          }
          newLogs.push(...applyStatusDamage(enemy));

          const player = state.playerTeam[state.activePlayerIndex];
          if (player.currentHp <= 0) {
            const nextPlayer = state.playerTeam.findIndex(
              (p, i) => i !== state.activePlayerIndex && p.currentHp > 0
            );
            if (nextPlayer < 0) {
              set({
                phase: 'defeat',
                logs: [...get().logs, ...newLogs, { message: 'Tous vos Pokémon sont K.O...', type: 'info' }],
              });
              return;
            } else {
              set({
                phase: 'switching',
                logs: [...get().logs, ...newLogs, { message: 'Envoyez votre prochain Pokémon !', type: 'info' }],
                turnNumber: state.turnNumber + 1,
              });
              return;
            }
          }
          set({ logs: [...get().logs, ...newLogs] });
        }
        set({ phase: 'choosing', turnNumber: state.turnNumber + 1 });
      }
    }

    // Full Restore (heal + cure status)
    if (item.effect.type === 'full_restore') {
      const idx = targetIndex ?? state.activePlayerIndex;
      const pokemon = state.playerTeam[idx];
      if (!pokemon || pokemon.currentHp <= 0) return;

      const name = pokemon.nickname || getPokemonData(pokemon.dataId).name;
      const healAmount = pokemon.maxHp - pokemon.currentHp;
      pokemon.currentHp = pokemon.maxHp;
      pokemon.status = null;
      pokemon.statusTurns = 0;
      pokemon.volatile.confusion = 0;

      set({
        logs: [...state.logs, { message: `${name} est complètement soigné !`, type: 'info' }],
      });

      // Enemy still attacks
      if (state.phase === 'choosing') {
        const enemy = state.enemyTeam[state.activeEnemyIndex];
        if (enemy && enemy.currentHp > 0) {
          const enemyMoveIdx = chooseEnemyMove(enemy);
          const newLogs: BattleLogEntry[] = [];

          if (enemyMoveIdx === -1) {
            const result = executeStruggle(enemy, state.playerTeam[state.activePlayerIndex]);
            newLogs.push(...result.logs);
          } else {
            const enemyMove = enemy.moves[enemyMoveIdx];
            if (enemyMove) {
              const blocked = checkStatusBlock(enemy);
              newLogs.push(...blocked.logs);
              if (!blocked.blocked) {
                const result = executeMove(enemy, state.playerTeam[state.activePlayerIndex], enemyMove);
                newLogs.push(...result.logs);
              }
            }
          }
          newLogs.push(...applyStatusDamage(enemy));

          const player = state.playerTeam[state.activePlayerIndex];
          if (player.currentHp <= 0) {
            const nextPlayer = state.playerTeam.findIndex(
              (p, i) => i !== state.activePlayerIndex && p.currentHp > 0
            );
            if (nextPlayer < 0) {
              set({
                phase: 'defeat',
                logs: [...get().logs, ...newLogs, { message: 'Tous vos Pokémon sont K.O...', type: 'info' }],
              });
              return;
            } else {
              set({
                phase: 'switching',
                logs: [...get().logs, ...newLogs, { message: 'Envoyez votre prochain Pokémon !', type: 'info' }],
                turnNumber: state.turnNumber + 1,
              });
              return;
            }
          }
          set({ logs: [...get().logs, ...newLogs] });
        }
        set({ phase: 'choosing', turnNumber: state.turnNumber + 1 });
      }
    }

    // Battle stat boost (X Attack, X Defense, etc.)
    if (item.effect.type === 'battle_stat') {
      const pokemon = state.playerTeam[state.activePlayerIndex];
      if (!pokemon || pokemon.currentHp <= 0) return;

      const stat = item.effect.stat as keyof typeof pokemon.statStages;
      const stages = item.effect.stages ?? 1;
      if (stat && stat in pokemon.statStages) {
        const current = pokemon.statStages[stat];
        const newVal = Math.max(-6, Math.min(6, current + stages));
        pokemon.statStages[stat] = newVal;
        const name = pokemon.nickname || getPokemonData(pokemon.dataId).name;

        const statNames: Record<string, string> = {
          attack: 'Attaque', defense: 'Défense', spAtk: 'Attaque Spé.',
          spDef: 'Défense Spé.', speed: 'Vitesse',
        };

        set({
          logs: [...state.logs, { message: `${statNames[stat] || stat} de ${name} monte !`, type: 'info' }],
        });
      }

      // Enemy still attacks
      if (state.phase === 'choosing') {
        const enemy = state.enemyTeam[state.activeEnemyIndex];
        if (enemy && enemy.currentHp > 0) {
          const enemyMoveIdx = chooseEnemyMove(enemy);
          const newLogs: BattleLogEntry[] = [];

          if (enemyMoveIdx === -1) {
            const result = executeStruggle(enemy, state.playerTeam[state.activePlayerIndex]);
            newLogs.push(...result.logs);
          } else {
            const enemyMove = enemy.moves[enemyMoveIdx];
            if (enemyMove) {
              const blocked = checkStatusBlock(enemy);
              newLogs.push(...blocked.logs);
              if (!blocked.blocked) {
                const result = executeMove(enemy, state.playerTeam[state.activePlayerIndex], enemyMove);
                newLogs.push(...result.logs);
              }
            }
          }
          newLogs.push(...applyStatusDamage(enemy));

          const player = state.playerTeam[state.activePlayerIndex];
          if (player.currentHp <= 0) {
            const nextPlayer = state.playerTeam.findIndex(
              (p, i) => i !== state.activePlayerIndex && p.currentHp > 0
            );
            if (nextPlayer < 0) {
              set({
                phase: 'defeat',
                logs: [...get().logs, ...newLogs, { message: 'Tous vos Pokémon sont K.O...', type: 'info' }],
              });
              return;
            } else {
              set({
                phase: 'switching',
                logs: [...get().logs, ...newLogs, { message: 'Envoyez votre prochain Pokémon !', type: 'info' }],
                turnNumber: state.turnNumber + 1,
              });
              return;
            }
          }
          set({ logs: [...get().logs, ...newLogs] });
        }
        set({ phase: 'choosing', turnNumber: state.turnNumber + 1 });
      }
    }
  },

  attemptFlee: () => {
    const state = get();
    if (state.type !== 'wild' && state.type !== 'safari') {
      set({ logs: [...state.logs, { message: 'Impossible de fuir un combat de dresseur !', type: 'info' }] });
      return;
    }

    // Safari flee always succeeds (player runs away)
    if (state.type === 'safari') {
      set({
        phase: 'fled',
        logs: [...state.logs, { message: 'Vous avez pris la fuite !', type: 'info' }],
      });
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
      const newLogs: BattleLogEntry[] = [{ message: 'Fuite impossible !', type: 'info' }];

      if (enemyMoveIdx === -1) {
        const result = executeStruggle(enemy, player);
        newLogs.push(...result.logs);
      } else {
        const enemyMove = enemy.moves[enemyMoveIdx];
        if (enemyMove) {
          const blocked = checkStatusBlock(enemy);
          newLogs.push(...blocked.logs);
          if (!blocked.blocked) {
            const result = executeMove(enemy, player, enemyMove);
            newLogs.push(...result.logs);
          }
        }
      }
      newLogs.push(...applyStatusDamage(enemy));

      // Check if player fainted
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
        } else {
          set({
            phase: 'switching',
            logs: [...state.logs, ...newLogs, { message: 'Envoyez votre prochain Pokémon !', type: 'info' }],
            turnNumber: state.turnNumber + 1,
          });
          return;
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
        useGameStore.getState().triggerEvent(state.encounterId);
      }
    } else {
      // Enemy attacks after failed capture
      const player = state.playerTeam[state.activePlayerIndex];
      if (player && enemy.currentHp > 0) {
        const enemyMoveIdx = chooseEnemyMove(enemy);

        if (enemyMoveIdx === -1) {
          const result = executeStruggle(enemy, player);
          newLogs.push(...result.logs);
        } else {
          const enemyMove = enemy.moves[enemyMoveIdx];
          if (enemyMove) {
            const blocked = checkStatusBlock(enemy);
            newLogs.push(...blocked.logs);
            if (!blocked.blocked) {
              const execResult = executeMove(enemy, player, enemyMove);
              newLogs.push(...execResult.logs);
            }
          }
        }
        newLogs.push(...applyStatusDamage(enemy));

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
          } else {
            set({
              phase: 'switching',
              logs: [...state.logs, ...newLogs, { message: 'Envoyez votre prochain Pokémon !', type: 'info' }],
              turnNumber: state.turnNumber + 1,
            });
            return;
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
  throwSafariBall: () => {
    const state = get();
    if (state.type !== 'safari') return;

    // Decrement ball in gameStore? 
    // We should probably sync or just track locally if we want... 
    // uniqueness of data sources.
    // gameStore has the master safariState.
    const gameStore = useGameStore.getState();
    if (!gameStore.safariState || gameStore.safariState.balls <= 0) {
      set({ logs: [...state.logs, { message: "Vous n'avez plus de Safari Balls !", type: 'info' }] });
      // Force quit? Or just show message. Usually auto-quit when 0.
      return;
    }

    // Decrement
    const newBalls = gameStore.safariState.balls - 1;
    useGameStore.setState({ safariState: { ...gameStore.safariState, balls: newBalls } });

    const enemy = state.enemyTeam[state.activeEnemyIndex];
    if (!enemy) return;

    const multiplier = 1.5 * (state.safariCatchFactor || 1); // Safari Ball ~1.5x + factors

    const result = attemptCatch(enemy, multiplier);
    const newLogs: BattleLogEntry[] = [{ message: 'Vous lancez une Safari Ball...', type: 'catch' }];

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
        useGameStore.getState().triggerEvent(state.encounterId);
      }
    } else {
      // Pokemon might flee
      const fleeFactor = 1.0 * (state.safariFleeFactor || 1);
      // Base flee chance ~ low for some, high for others. 
      // For now, fixed 10% * fleeFactor? Or based on speed?
      // Gen 1 safari mechanics are complex (speed based).
      // Let's use simple speed check + factor.
      const speed = enemy.stats.speed;
      const fleeChance = (speed / 100) * 0.1 * fleeFactor; // purely arbitrary simple math
      // Or flat 20% * factor?
      // Let's go with flat 15% * factor
      const actualFleeChance = 0.15 * fleeFactor;

      if (Math.random() < actualFleeChance) {
        newLogs.push({ message: `Le ${getPokemonData(enemy.dataId).name} s'enfuit !`, type: 'info' });
        set({
          phase: 'fled',
          logs: [...state.logs, ...newLogs],
        });
      } else {
        set({
          logs: [...state.logs, ...newLogs, { message: `Le ${getPokemonData(enemy.dataId).name} vous observe attentivement.`, type: 'info' }],
          turnNumber: state.turnNumber + 1
        });
      }
    }

    // Check balls if 0 -> End safari (handled by GameStore/UI usually, but BattleStore should signal it?)
    // Logic: If balls 0, battle ends? Or wait for player to try acting?
  },

  throwRock: () => {
    const state = get();
    if (state.type !== 'safari') return;

    const newLogs: BattleLogEntry[] = [{ message: "Vous lancez un caillou !", type: 'info' }];
    const enemy = state.enemyTeam[state.activeEnemyIndex];
    const enemyName = getPokemonData(enemy.dataId).name;

    newLogs.push({ message: `${enemyName} est en colère !`, type: 'info' });

    // Catch x2, Flee x2
    const newCatchFactor = Math.min(4, (state.safariCatchFactor || 1) * 2);
    const newFleeFactor = Math.min(4, (state.safariFleeFactor || 1) * 2);

    // Chance to flee immediately? Usually at end of turn.
    // We process flee check after action. same as ball miss.
    const actualFleeChance = 0.15 * newFleeFactor;
    if (Math.random() < actualFleeChance) {
      newLogs.push({ message: `${enemyName} s'enfuit !`, type: 'info' });
      set({
        safariCatchFactor: newCatchFactor,
        safariFleeFactor: newFleeFactor,
        phase: 'fled',
        logs: [...state.logs, ...newLogs],
      });
    } else {
      set({
        safariCatchFactor: newCatchFactor,
        safariFleeFactor: newFleeFactor,
        logs: [...state.logs, ...newLogs],
        turnNumber: state.turnNumber + 1
      });
    }
  },

  throwBait: () => {
    const state = get();
    if (state.type !== 'safari') return;

    const newLogs: BattleLogEntry[] = [{ message: "Vous lancez un appât !", type: 'info' }];
    const enemy = state.enemyTeam[state.activeEnemyIndex];
    const enemyName = getPokemonData(enemy.dataId).name;

    newLogs.push({ message: `${enemyName} mange l'appât !`, type: 'info' });

    // Catch / 2, Flee / 2
    const newCatchFactor = Math.max(0.25, (state.safariCatchFactor || 1) / 2);
    const newFleeFactor = Math.max(0.25, (state.safariFleeFactor || 1) / 2);

    // Check flee
    const actualFleeChance = 0.15 * newFleeFactor;
    if (Math.random() < actualFleeChance) {
      newLogs.push({ message: `${enemyName} s'enfuit !`, type: 'info' });
      set({
        safariCatchFactor: newCatchFactor,
        safariFleeFactor: newFleeFactor,
        phase: 'fled',
        logs: [...state.logs, ...newLogs],
      });
    } else {
      set({
        safariCatchFactor: newCatchFactor,
        safariFleeFactor: newFleeFactor,
        logs: [...state.logs, ...newLogs],
        turnNumber: state.turnNumber + 1
      });
    }
  }
}));
