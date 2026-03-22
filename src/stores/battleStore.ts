import { create } from 'zustand';
import {
  PokemonInstance,
  MoveInstance,
  freshVolatile,
  freshStatStages,
} from '../types/pokemon';
import { BattlePhase, BattleType, BattleLogEntry, SideConditions, freshSideConditions } from '../types/battle';
import {
  executeMove,
  executeStruggle,
  checkStatusBlock,
  applyStatusDamage,
  determineOrder,
  chooseEnemyMove,
  fullHealTeam,
  applyEntryHazards,
} from '../engine/battleEngine';
import { attemptCatch } from '../engine/catchCalculator';
import { getEffectiveStat } from '../engine/statCalculator';
import { createPokemonInstance } from '../engine/experienceCalculator';
import { getMoveData, getPokemonData, getItemData } from '../utils/dataLoader';
import { WildEncounter, TrainerData, GymData } from '../types/game';
import { useGameStore } from './gameStore';
import { triggerAbility } from '../engine/abilityEffects';
import { triggerHeldItem } from '../engine/heldItemEffects';

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

  // Weather
  weather: 'sun' | 'rain' | 'sandstorm' | 'hail' | null;
  weatherTurns: number;

  // Side conditions (hazards, screens)
  playerSide: SideConditions;
  enemySide: SideConditions;

  // Field effects
  trickRoom: number; // Turns remaining (0 = inactive)

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

/** Process switch-in abilities for a Pokémon entering the field.
 *  Returns logs and weather change (if any). Also mutates opponent statStages for Intimidate. */
function processSwitchInAbility(
  pokemon: PokemonInstance,
  opponent: PokemonInstance | undefined
): { logs: BattleLogEntry[]; weather?: 'sun' | 'rain' | 'sandstorm' | 'hail' } {
  if (!pokemon.ability || pokemon.currentHp <= 0) return { logs: [] };
  const name = pokemon.nickname || getPokemonData(pokemon.dataId).name;
  const oppName = opponent ? (opponent.nickname || getPokemonData(opponent.dataId).name) : undefined;
  const result = triggerAbility(pokemon.ability, 'switch-in', {
    pokemon, trigger: 'switch-in', pokemonName: name,
    opponent, opponentName: oppName,
  });
  let weather: 'sun' | 'rain' | 'sandstorm' | 'hail' | undefined;
  if (pokemon.ability === 'drizzle') weather = 'rain';
  else if (pokemon.ability === 'drought') weather = 'sun';
  else if (pokemon.ability === 'sand-stream') weather = 'sandstorm';
  return { logs: result.logs, weather };
}

/** Execute the enemy's turn: choose move, attack, apply status damage, animate logs, check KO.
 *  Uses get() for fresh state after awaits — fixes stale-closure bugs.
 *  Adds !active guard after each await — fixes ghost setTimeout errors. */
async function executeEnemyTurn(
  get: () => BattleStore,
  set: (updater: Partial<BattleStore> | ((s: BattleStore) => Partial<BattleStore>)) => void,
  playerIndex: number,
): Promise<'defeat' | 'switching' | 'continue'> {
  const state = get();
  if (!state.active) return 'continue';

  const enemy = state.enemyTeam[state.activeEnemyIndex];
  const player = state.playerTeam[playerIndex];
  if (!enemy || enemy.currentHp <= 0 || !player || player.currentHp <= 0) return 'continue';

  const enemyClone = deepCopyPokemon(enemy);
  const playerClone = deepCopyPokemon(player);

  const enemyMoveIdx = chooseEnemyMove(enemyClone, playerClone);
  const logs: BattleLogEntry[] = [];

  if (enemyMoveIdx === -1) {
    logs.push(...executeStruggle(enemyClone, playerClone).logs);
  } else {
    const enemyMove = enemyClone.moves[enemyMoveIdx];
    if (enemyMove) {
      const blocked = checkStatusBlock(enemyClone);
      logs.push(...blocked.logs);
      if (!blocked.blocked) {
        const result = executeMove(
          enemyClone, playerClone, enemyMove, [],
          get().weather, get().enemySide, get().playerSide
        );
        logs.push(...result.logs);
      }
    }
  }
  logs.push(...applyStatusDamage(enemyClone));

  for (const log of logs) {
    if (!get().active) return 'continue';

    let nextPlayerHp = playerClone.currentHp;
    let nextEnemyHp = enemyClone.currentHp;
    let nextPlayerStatus = playerClone.status;
    let nextEnemyStatus = enemyClone.status;

    if (log.state) {
      if (log.state.attackerHp !== undefined) nextEnemyHp = log.state.attackerHp;
      if (log.state.attackerStatus !== undefined) nextEnemyStatus = log.state.attackerStatus;
      if (log.state.defenderHp !== undefined) nextPlayerHp = log.state.defenderHp;
      if (log.state.defenderStatus !== undefined) nextPlayerStatus = log.state.defenderStatus;
      if ((log.state.target as any) === 'defender') log.state.target = 'player';
    }

    set((s: BattleStore) => {
      const newPT = [...s.playerTeam];
      const newET = [...s.enemyTeam];
      newPT[playerIndex] = { ...newPT[playerIndex], currentHp: nextPlayerHp, status: nextPlayerStatus };
      newET[s.activeEnemyIndex] = { ...newET[s.activeEnemyIndex], currentHp: nextEnemyHp, status: nextEnemyStatus };
      return { logs: [...s.logs, log], playerTeam: newPT, enemyTeam: newET };
    });

    const delay = (log.message.length * 15 + 300) / useGameStore.getState().settings.gameSpeed;
    await new Promise(r => setTimeout(r, delay));
  }

  if (!get().active) return 'continue';

  // Check KO using FRESH state (fixes stale closure bug)
  const freshState = get();
  const freshPlayer = freshState.playerTeam[playerIndex];
  if (freshPlayer && freshPlayer.currentHp <= 0) {
    const nextAlive = freshState.playerTeam.findIndex((p, i) => i !== playerIndex && p.currentHp > 0);
    if (nextAlive < 0) {
      set((s: BattleStore) => ({
        phase: 'defeat' as BattlePhase,
        logs: [...s.logs, { message: 'Tous vos Pokémon sont K.O...', type: 'info' as const }],
      }));
      return 'defeat';
    } else {
      set((s: BattleStore) => ({
        phase: 'switching' as BattlePhase,
        logs: [...s.logs, { message: 'Envoyez votre prochain Pokémon !', type: 'info' as const }],
        turnNumber: s.turnNumber + 1,
      }));
      return 'switching';
    }
  }

  return 'continue';
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
  weather: null,
  weatherTurns: 0,
  playerSide: freshSideConditions(),
  enemySide: freshSideConditions(),
  trickRoom: 0,
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

    // Check for shiny Charms
    const gameStore = useGameStore.getState();
    const inventory = gameStore.inventory;
    const shinyCharms = inventory.find(i => i.itemId === 'shiny-charm')?.quantity || 0;

    // Base rate 1/4096. 1 charm = +75% (x1.75).
    const shinyRate = (1 / 4096) * Math.pow(1.75, shinyCharms);
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
      weather: null,
      weatherTurns: 0,
      playerSide: freshSideConditions(),
      enemySide: freshSideConditions(),
      trickRoom: 0,
      safariCatchFactor: 1,
      safariFleeFactor: 1
    });

    // Switch-in abilities at battle start
    const battleState = get();
    const pActive = battleState.playerTeam[battleState.activePlayerIndex];
    const eActive = battleState.enemyTeam[0];
    const introLogs: BattleLogEntry[] = [];
    let newWeather: 'sun' | 'rain' | 'sandstorm' | 'hail' | null = null;

    const pEntry = processSwitchInAbility(pActive, eActive);
    introLogs.push(...pEntry.logs);
    if (pEntry.weather) newWeather = pEntry.weather;

    const eEntry = processSwitchInAbility(eActive, pActive);
    introLogs.push(...eEntry.logs);
    if (eEntry.weather) newWeather = eEntry.weather; // Last one wins (slower Pokémon)

    if (introLogs.length > 0 || newWeather) {
      set(s => ({
        logs: [...s.logs, ...introLogs],
        ...(newWeather ? { weather: newWeather, weatherTurns: 5 } : {}),
        // Sync Intimidate stat changes
        enemyTeam: s.enemyTeam.map((e, i) => i === 0 ? { ...e, statStages: { ...eActive.statStages } } : e),
        playerTeam: s.playerTeam.map((p, i) => i === s.activePlayerIndex ? { ...p, statStages: { ...pActive.statStages } } : p),
      }));
    }
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
      weather: null,
      weatherTurns: 0,
      playerSide: freshSideConditions(),
      enemySide: freshSideConditions(),
      trickRoom: 0,
    });

    // Switch-in abilities at battle start
    {
      const bs = get();
      const pA = bs.playerTeam[bs.activePlayerIndex];
      const eA = bs.enemyTeam[0];
      const il: BattleLogEntry[] = [];
      let nw: 'sun' | 'rain' | 'sandstorm' | 'hail' | null = null;
      const pe = processSwitchInAbility(pA, eA);
      il.push(...pe.logs); if (pe.weather) nw = pe.weather;
      const ee = processSwitchInAbility(eA, pA);
      il.push(...ee.logs); if (ee.weather) nw = ee.weather;
      if (il.length > 0 || nw) {
        set(s => ({
          logs: [...s.logs, ...il],
          ...(nw ? { weather: nw, weatherTurns: 5 } : {}),
          enemyTeam: s.enemyTeam.map((e, i) => i === 0 ? { ...e, statStages: { ...eA.statStages } } : e),
          playerTeam: s.playerTeam.map((p, i) => i === s.activePlayerIndex ? { ...p, statStages: { ...pA.statStages } } : p),
        }));
      }
    }
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
      weather: null,
      weatherTurns: 0,
      playerSide: freshSideConditions(),
      enemySide: freshSideConditions(),
      trickRoom: 0,
    });

    // Switch-in abilities at battle start
    {
      const bs = get();
      const pA = bs.playerTeam[bs.activePlayerIndex];
      const eA = bs.enemyTeam[0];
      const il: BattleLogEntry[] = [];
      let nw: 'sun' | 'rain' | 'sandstorm' | 'hail' | null = null;
      const pe = processSwitchInAbility(pA, eA);
      il.push(...pe.logs); if (pe.weather) nw = pe.weather;
      const ee = processSwitchInAbility(eA, pA);
      il.push(...ee.logs); if (ee.weather) nw = ee.weather;
      if (il.length > 0 || nw) {
        set(s => ({
          logs: [...s.logs, ...il],
          ...(nw ? { weather: nw, weatherTurns: 5 } : {}),
          enemyTeam: s.enemyTeam.map((e, i) => i === 0 ? { ...e, statStages: { ...eA.statStages } } : e),
          playerTeam: s.playerTeam.map((p, i) => i === s.activePlayerIndex ? { ...p, statStages: { ...pA.statStages } } : p),
        }));
      }
    }
  },

  selectMove: async (moveIndex: number) => {
    const state = get();
    if (state.phase !== 'choosing') return;

    const player = state.playerTeam[state.activePlayerIndex];
    const enemy = state.enemyTeam[state.activeEnemyIndex];
    if (!player || !enemy) return;

    const playerUseStruggle = moveIndex === -1;
    let playerMove = playerUseStruggle ? null : player.moves[moveIndex];
    if (!playerUseStruggle && (!playerMove || playerMove.currentPp <= 0)) return;

    // Block disabled moves
    if (!playerUseStruggle && playerMove && player.volatile.disabled &&
      player.volatile.disabled.moveId === playerMove.moveId) return;

    // Taunt: block status moves
    if (!playerUseStruggle && playerMove) {
      const moveData = getMoveData(playerMove.moveId);
      if (player.volatile.tauntTurns > 0 && moveData.category === 'status') {
        set(s => ({ logs: [...s.logs, { message: `La Provocation empêche l'utilisation de ${moveData.name} !`, type: 'info' }] }));
        return;
      }
    }

    set({ phase: 'executing' });

    // Use clones for calculation
    const playerClone = deepCopyPokemon(state.playerTeam[state.activePlayerIndex]);
    const enemyClone = deepCopyPokemon(enemy);
    if (!playerUseStruggle) playerMove = playerClone.moves[moveIndex];
    const playerBadges = useGameStore.getState().player.badges;
    const currentWeather = state.weather;

    const enemyMoveIndex = chooseEnemyMove(enemyClone, playerClone);
    const enemyUseStruggle = enemyMoveIndex === -1;
    const enemyMove = enemyUseStruggle ? null : enemyClone.moves[enemyMoveIndex];

    // Side conditions (mutable references so handlers can modify them)
    const pSide = { ...state.playerSide };
    const eSide = { ...state.enemySide };

    const order = determineOrder(
      playerClone, enemyClone,
      { type: 'move', moveIndex: playerUseStruggle ? 0 : moveIndex },
      enemyUseStruggle ? 0 : enemyMoveIndex,
      pSide, eSide, state.trickRoom, currentWeather
    );

    const steps: {
      log: BattleLogEntry;
      playerHp?: number;
      enemyHp?: number;
      playerStatus?: any;
      enemyStatus?: any;
    }[] = [];

    const first = order === 'player' ? playerClone : enemyClone;
    const second = order === 'player' ? enemyClone : playerClone;
    const firstMove = order === 'player' ? playerMove : enemyMove;
    const secondMove = order === 'player' ? enemyMove : playerMove;
    const firstUseStruggle = order === 'player' ? playerUseStruggle : enemyUseStruggle;
    const secondUseStruggle = order === 'player' ? enemyUseStruggle : playerUseStruggle;
    const firstBadges = order === 'player' ? playerBadges : [];
    const secondBadges = order === 'player' ? [] : playerBadges;

    const addStepForAttack = (logs: BattleLogEntry[], attacker: PokemonInstance, defender?: PokemonInstance) => {
      for (const log of logs) {
        let pHP = playerClone.currentHp;
        let eHP = enemyClone.currentHp;
        let pStatus = playerClone.status;
        let eStatus = enemyClone.status;

        if (log.state) {
          // Map attacker/defender state back to player/enemy based on who is who
          if (attacker === playerClone) {
            if (log.state.attackerHp !== undefined) pHP = log.state.attackerHp;
            if (log.state.attackerStatus !== undefined) pStatus = log.state.attackerStatus;
            if (defender === enemyClone) {
              if (log.state.defenderHp !== undefined) eHP = log.state.defenderHp;
              if (log.state.defenderStatus !== undefined) eStatus = log.state.defenderStatus;
              if ((log.state.target as any) === 'defender') log.state.target = 'enemy';
            }
          } else if (attacker === enemyClone) {
            if (log.state.attackerHp !== undefined) eHP = log.state.attackerHp;
            if (log.state.attackerStatus !== undefined) eStatus = log.state.attackerStatus;
            if (defender === playerClone) {
              if (log.state.defenderHp !== undefined) pHP = log.state.defenderHp;
              if (log.state.defenderStatus !== undefined) pStatus = log.state.defenderStatus;
              if ((log.state.target as any) === 'defender') log.state.target = 'player';
            }
          }
        }

        steps.push({
          log,
          playerHp: pHP,
          enemyHp: eHP,
          playerStatus: pStatus,
          enemyStatus: eStatus,
        });
      }
    };

    // First attack
    const firstBlocked = checkStatusBlock(first, firstMove?.moveId);
    addStepForAttack(firstBlocked.logs, first);

    let secondFainted = false;
    if (!firstBlocked.blocked) {
      if (firstUseStruggle) {
        const result = executeStruggle(first, second);
        addStepForAttack(result.logs, first, second);
        secondFainted = result.defenderFainted;
      } else if (firstMove) {
        const firstSide = order === 'player' ? pSide : eSide;
        const firstDefSide = order === 'player' ? eSide : pSide;
        const result = executeMove(first, second, firstMove, firstBadges, currentWeather, firstSide, firstDefSide);
        addStepForAttack(result.logs, first, second);
        secondFainted = result.defenderFainted;
      }
    }

    addStepForAttack(applyStatusDamage(first, second), first);

    // End-turn ability for first attacker (Shed Skin)
    if (first.currentHp > 0 && first.ability) {
      const firstName = first.nickname || getPokemonData(first.dataId).name;
      const etResult = triggerAbility(first.ability, 'end-turn', {
        pokemon: first, trigger: 'end-turn', pokemonName: firstName,
      });
      addStepForAttack(etResult.logs, first);
    }

    // End-turn held item for first attacker (Leftovers, Black Sludge, Flame Orb, Toxic Orb)
    if (first.currentHp > 0 && first.heldItem) {
      const heldResult = triggerHeldItem(first, 'end-turn', { opponent: second, weather: currentWeather });
      addStepForAttack(heldResult.logs, first);
    }

    // Second attack
    if (!secondFainted && second.currentHp > 0) {
      const secondBlocked = checkStatusBlock(second, secondMove?.moveId);
      addStepForAttack(secondBlocked.logs, second);

      if (!secondBlocked.blocked) {
        if (secondUseStruggle) {
          const result = executeStruggle(second, first);
          addStepForAttack(result.logs, second, first);
        } else if (secondMove) {
          const secondSide = order === 'player' ? eSide : pSide;
          const secondDefSide = order === 'player' ? pSide : eSide;
          const result = executeMove(second, first, secondMove, secondBadges, currentWeather, secondSide, secondDefSide);
          addStepForAttack(result.logs, second, first);
        }
      }
      addStepForAttack(applyStatusDamage(second, first), second);

      // End-turn ability for second attacker (Shed Skin)
      if (second.currentHp > 0 && second.ability) {
        const secondName = second.nickname || getPokemonData(second.dataId).name;
        const etResult2 = triggerAbility(second.ability, 'end-turn', {
          pokemon: second, trigger: 'end-turn', pokemonName: secondName,
        });
        addStepForAttack(etResult2.logs, second);
      }

      // End-turn held item for second attacker (Leftovers, Black Sludge, Flame Orb, Toxic Orb)
      if (second.currentHp > 0 && second.heldItem) {
        const heldResult2 = triggerHeldItem(second, 'end-turn', { opponent: first, weather: currentWeather });
        addStepForAttack(heldResult2.logs, second);
      }
    }

    // Process steps one by one
    for (const step of steps) {
      set(s => {
        const newPlayerTeam = [...s.playerTeam];
        const newEnemyTeam = [...s.enemyTeam];

        if (step.playerHp !== undefined) newPlayerTeam[s.activePlayerIndex].currentHp = step.playerHp;
        if (step.enemyHp !== undefined) newEnemyTeam[s.activeEnemyIndex].currentHp = step.enemyHp;
        if (step.playerStatus !== undefined) newPlayerTeam[s.activePlayerIndex].status = step.playerStatus;
        if (step.enemyStatus !== undefined) newEnemyTeam[s.activeEnemyIndex].status = step.enemyStatus;

        return {
          logs: [...s.logs, step.log],
          playerTeam: newPlayerTeam,
          enemyTeam: newEnemyTeam,
        };
      });

      const delay = (step.log.message.length * 15 + 300) / useGameStore.getState().settings.gameSpeed;
      await new Promise(r => setTimeout(r, delay));
    }

    // Sync full clone state back to store (volatile, statStages, moves/PP, statusTurns)
    set(s => {
      const newPlayerTeam = [...s.playerTeam];
      const newEnemyTeam = [...s.enemyTeam];
      const pIdx = s.activePlayerIndex;
      const eIdx = s.activeEnemyIndex;
      newPlayerTeam[pIdx] = {
        ...newPlayerTeam[pIdx],
        volatile: { ...playerClone.volatile },
        statStages: { ...playerClone.statStages },
        moves: playerClone.moves.map(m => ({ ...m })),
        statusTurns: playerClone.statusTurns,
        status: playerClone.status,
        currentHp: playerClone.currentHp,
        heldItem: playerClone.heldItem,
      };
      newEnemyTeam[eIdx] = {
        ...newEnemyTeam[eIdx],
        volatile: { ...enemyClone.volatile },
        statStages: { ...enemyClone.statStages },
        moves: enemyClone.moves.map(m => ({ ...m })),
        statusTurns: enemyClone.statusTurns,
        status: enemyClone.status,
        currentHp: enemyClone.currentHp,
        heldItem: enemyClone.heldItem,
      };
      return { playerTeam: newPlayerTeam, enemyTeam: newEnemyTeam, playerSide: { ...pSide }, enemySide: { ...eSide } };
    });

    // Decrement screen/tailwind turns
    if (pSide.reflect > 0) pSide.reflect--;
    if (pSide.lightScreen > 0) pSide.lightScreen--;
    if (pSide.auroraVeil > 0) pSide.auroraVeil--;
    if (pSide.tailwind > 0) pSide.tailwind--;
    if (eSide.reflect > 0) eSide.reflect--;
    if (eSide.lightScreen > 0) eSide.lightScreen--;
    if (eSide.auroraVeil > 0) eSide.auroraVeil--;
    if (eSide.tailwind > 0) eSide.tailwind--;
    set({ playerSide: { ...pSide }, enemySide: { ...eSide } });

    // Post-turn move checks: weather, Trick Room, Pay Day
    const usedMoves = [firstMove, secondMove].filter(Boolean);
    for (const m of usedMoves) {
      if (!m) continue;
      const mData = getMoveData(m.moveId);
      if (mData.effect?.type === 'weather' && mData.effect.weather) {
        set({ weather: mData.effect.weather as any, weatherTurns: 5 });
      }
      // Override weather moves (tagged as 'override' in DB but are weather setters)
      const WEATHER_MOVE_MAP: Record<number, 'sandstorm' | 'rain' | 'sun' | 'hail'> = {
        201: 'sandstorm', 240: 'rain', 241: 'sun', 258: 'hail', 883: 'hail',
      };
      if (WEATHER_MOVE_MAP[mData.id]) {
        set({ weather: WEATHER_MOVE_MAP[mData.id], weatherTurns: 5 });
      }
      // Trick Room: toggle (using it again while active cancels it)
      if (mData.id === 433 || mData.name?.toLowerCase().includes('distorsion')) {
        set(s => ({ trickRoom: s.trickRoom > 0 ? 0 : 5 }));
      }
      // Pay Day: add bonus money (5x attacker level per use)
      if (mData.effect?.type === 'money') {
        const attLevel = m === firstMove
          ? (order === 'player' ? playerClone.level : enemyClone.level)
          : (order === 'player' ? enemyClone.level : playerClone.level);
        set(s => ({ moneyGained: s.moneyGained + attLevel * 5 }));
      }
    }

    // Decrement Trick Room turns
    {
      const trState = get();
      if (trState.trickRoom > 0) {
        const newTr = trState.trickRoom - 1;
        if (newTr <= 0) {
          set(s => ({ trickRoom: 0, logs: [...s.logs, { message: 'Les dimensions redeviennent normales !', type: 'info' }] }));
        } else {
          set({ trickRoom: newTr });
        }
      }
    }

    // Weather end-of-turn damage (sandstorm/hail: 1/16 HP to non-immune types)
    {
      const ws = get();
      if (ws.weather && ws.weatherTurns > 0) {
        const weatherLogs: BattleLogEntry[] = [];
        const pTeam = [...ws.playerTeam];
        const eTeam = [...ws.enemyTeam];
        const pActive = pTeam[ws.activePlayerIndex];
        const eActive = eTeam[ws.activeEnemyIndex];

        const applyWeatherDmg = (mon: PokemonInstance): void => {
          if (mon.currentHp <= 0) return;
          const data = getPokemonData(mon.dataId);
          const name = mon.nickname || data.name;
          if (ws.weather === 'sandstorm') {
            // Rock, Ground, Steel immune
            if (!data.types.some((t: string) => ['rock', 'ground', 'steel'].includes(t))) {
              const dmg = Math.max(1, Math.floor(mon.maxHp / 16));
              mon.currentHp = Math.max(0, mon.currentHp - dmg);
              weatherLogs.push({ message: `${name} est blessé par la tempête de sable ! (-${dmg} PV)`, type: 'status' });
            }
          } else if (ws.weather === 'hail') {
            // Ice immune
            if (!data.types.includes('ice')) {
              const dmg = Math.max(1, Math.floor(mon.maxHp / 16));
              mon.currentHp = Math.max(0, mon.currentHp - dmg);
              weatherLogs.push({ message: `${name} est blessé par la grêle ! (-${dmg} PV)`, type: 'status' });
            }
          }
        };

        applyWeatherDmg(pActive);
        applyWeatherDmg(eActive);

        const newWeatherTurns = ws.weatherTurns - 1;
        if (newWeatherTurns <= 0) {
          weatherLogs.push({ message: 'Le temps redevient normal.', type: 'info' });
        }

        if (weatherLogs.length > 0) {
          set(s => ({
            logs: [...s.logs, ...weatherLogs],
            playerTeam: pTeam,
            enemyTeam: eTeam,
            weatherTurns: newWeatherTurns,
            weather: newWeatherTurns <= 0 ? null : s.weather,
          }));
        } else {
          set({ weatherTurns: newWeatherTurns, weather: newWeatherTurns <= 0 ? null : ws.weather });
        }
      }
    }

    // Force switch: Roar/Whirlwind — wild battles end, trainer battles random switch
    for (const m of usedMoves) {
      if (!m) continue;
      const mData = getMoveData(m.moveId);
      if (mData.effect?.type === 'force_switch') {
        const fsState = get();
        if (fsState.type === 'wild') {
          // Wild battle: the wild pokemon flees
          set(s => ({
            logs: [...s.logs, { message: 'Le Pokémon sauvage s\'enfuit !', type: 'info' }],
            phase: 'fled' as BattlePhase,
          }));
          return;
        } else if (fsState.type === 'trainer' || fsState.type === 'gym') {
          // Trainer battle: force random switch of the defender
          // Determine who was the defender (whose pokemon was forced to switch)
          const wasPlayerForced = (order === 'player' && m === secondMove) || (order === 'enemy' && m === firstMove);
          if (wasPlayerForced) {
            // Force player to switch — go to switching phase
            const nextIdx = fsState.playerTeam.findIndex((p, i) => i !== fsState.activePlayerIndex && p.currentHp > 0);
            if (nextIdx >= 0) {
              set(s => ({
                phase: 'switching' as BattlePhase,
                logs: [...s.logs, { message: 'Vous devez changer de Pokémon !', type: 'info' }],
              }));
              return;
            }
          } else {
            // Force enemy to switch
            const nextIdx = fsState.enemyTeam.findIndex((p, i) => i !== fsState.activeEnemyIndex && p.currentHp > 0);
            if (nextIdx >= 0) {
              const eSideFs = { ...fsState.enemySide };
              const incomingEnemy = fsState.enemyTeam[nextIdx];
              const hazardFs = applyEntryHazards(incomingEnemy, eSideFs);
              const fsPlayer = fsState.playerTeam[fsState.activePlayerIndex];
              const fsEntry = processSwitchInAbility(incomingEnemy, fsPlayer);
              const fsLogs: BattleLogEntry[] = [
                { message: `${fsState.trainerName} envoie ${getPokemonData(incomingEnemy.dataId).name} !`, type: 'info' },
                ...hazardFs.logs, ...fsEntry.logs,
              ];
              set(s => ({
                activeEnemyIndex: nextIdx,
                enemySide: { ...eSideFs },
                ...(fsEntry.weather ? { weather: fsEntry.weather, weatherTurns: 5 } : {}),
                enemyTeam: s.enemyTeam.map((e, i) => i === nextIdx ? { ...e, statStages: { ...incomingEnemy.statStages } } : e),
                playerTeam: s.playerTeam.map((p, i) => i === s.activePlayerIndex ? { ...p, statStages: { ...fsPlayer.statStages } } : p),
                logs: [...s.logs, ...fsLogs],
                phase: 'choosing' as BattlePhase,
                turnNumber: s.turnNumber + 1,
              }));
              return;
            }
          }
        }
      }
    }

    // Final result checks (win/loss/switch)
    const currentState = get();
    const finalPlayer = currentState.playerTeam[currentState.activePlayerIndex];
    const finalEnemy = currentState.enemyTeam[currentState.activeEnemyIndex];

    const finalNewState: Partial<BattleStore> = {
      turnNumber: currentState.turnNumber + 1,
    };

    if (finalEnemy.currentHp <= 0) {
      const xpEntry = {
        pokemonIndex: currentState.activePlayerIndex,
        defeatedId: finalEnemy.dataId,
        defeatedLevel: finalEnemy.level,
      };

      if (finalPlayer.currentHp <= 0) {
        const nextPlayer = currentState.playerTeam.findIndex(
          (p, i) => i !== currentState.activePlayerIndex && p.currentHp > 0
        );
        finalNewState.xpGained = [...currentState.xpGained, xpEntry];
        const nextEnemy = currentState.enemyTeam.findIndex(
          (p, i) => i > currentState.activeEnemyIndex && p.currentHp > 0
        );

        if (nextPlayer < 0) {
          finalNewState.phase = 'defeat';
          finalNewState.logs = [...get().logs, { message: 'Tous vos Pokémon sont K.O...', type: 'info' }];
          if (currentState.trainerId?.startsWith('league-')) {
            useGameStore.getState().resetLeagueProgress();
          }
        } else if (nextEnemy >= 0 && (currentState.type === 'trainer' || currentState.type === 'gym')) {
          const nextName = getPokemonData(currentState.enemyTeam[nextEnemy].dataId).name;
          finalNewState.activeEnemyIndex = nextEnemy;
          finalNewState.phase = 'switching';
          const eSideCopy = { ...get().enemySide };
          const incomingE = currentState.enemyTeam[nextEnemy];
          const hazardRes = applyEntryHazards(incomingE, eSideCopy);
          const eSwEntry = processSwitchInAbility(incomingE, undefined); // no player alive to intimidate
          finalNewState.enemySide = { ...eSideCopy };
          if (eSwEntry.weather) { finalNewState.weather = eSwEntry.weather; (finalNewState as any).weatherTurns = 5; }
          finalNewState.logs = [...get().logs,
          { message: `${currentState.trainerName} envoie ${nextName} !`, type: 'info' },
          ...hazardRes.logs, ...eSwEntry.logs,
          { message: 'Envoyez votre prochain Pokémon !', type: 'info' }
          ];
        } else {
          finalNewState.phase = 'victory';
          if (currentState.trainerId?.startsWith('league-')) {
            useGameStore.getState().advanceLeagueProgress();
          }
          if (currentState.encounterId) {
            useGameStore.getState().triggerEvent(currentState.encounterId);
          }
          finalNewState.moneyGained = currentState.trainerReward;
          finalNewState.logs = [...get().logs, {
            message: currentState.type === 'wild' ? 'Vous avez gagné le combat !' : `Vous avez battu ${currentState.trainerName} !`,
            type: 'info',
          }];
          if (currentState.trainerReward > 0) {
            finalNewState.logs.push({ message: `Vous gagnez ${currentState.trainerReward}₽ !`, type: 'xp' });
          }
        }
      } else {
        const nextEnemy = currentState.enemyTeam.findIndex(
          (p, i) => i > currentState.activeEnemyIndex && p.currentHp > 0
        );

        if (nextEnemy >= 0 && (currentState.type === 'trainer' || currentState.type === 'gym')) {
          const nextName = getPokemonData(currentState.enemyTeam[nextEnemy].dataId).name;
          finalNewState.activeEnemyIndex = nextEnemy;
          finalNewState.phase = 'choosing';
          finalNewState.xpGained = [...currentState.xpGained, xpEntry];
          const eSideCopy2 = { ...get().enemySide };
          const incomingE2 = currentState.enemyTeam[nextEnemy];
          const hazardRes2 = applyEntryHazards(incomingE2, eSideCopy2);
          const playerForIntim = currentState.playerTeam[currentState.activePlayerIndex];
          const eSwEntry2 = processSwitchInAbility(incomingE2, playerForIntim);
          finalNewState.enemySide = { ...eSideCopy2 };
          if (eSwEntry2.weather) { finalNewState.weather = eSwEntry2.weather; (finalNewState as any).weatherTurns = 5; }
          finalNewState.logs = [...get().logs, { message: `${currentState.trainerName} envoie ${nextName} !`, type: 'info' }, ...hazardRes2.logs, ...eSwEntry2.logs];
        } else {
          finalNewState.phase = 'victory';
          if (currentState.trainerId?.startsWith('league-')) {
            useGameStore.getState().advanceLeagueProgress();
          }
          if (currentState.encounterId) {
            useGameStore.getState().triggerEvent(currentState.encounterId);
          }
          finalNewState.xpGained = [...currentState.xpGained, xpEntry];
          finalNewState.moneyGained = currentState.trainerReward;
          finalNewState.logs = [...get().logs, {
            message: currentState.type === 'wild' ? 'Vous avez gagné le combat !' : `Vous avez battu ${currentState.trainerName} !`,
            type: 'info',
          }];
          if (currentState.trainerReward > 0) {
            finalNewState.logs.push({ message: `Vous gagnez ${currentState.trainerReward}₽ !`, type: 'xp' });
          }
        }
      }
    } else if (finalPlayer.currentHp <= 0) {
      const nextPlayer = currentState.playerTeam.findIndex(
        (p, i) => i !== currentState.activePlayerIndex && p.currentHp > 0
      );
      if (nextPlayer >= 0) {
        finalNewState.phase = 'switching';
        finalNewState.logs = [...get().logs, { message: `Envoyez votre prochain Pokémon !`, type: 'info' }];
      } else {
        finalNewState.phase = 'defeat';
        finalNewState.logs = [...get().logs, { message: 'Tous vos Pokémon sont K.O...', type: 'info' }];
        if (currentState.trainerId?.startsWith('league-')) {
          useGameStore.getState().resetLeagueProgress();
        }
      }
    } else {
      finalNewState.phase = 'choosing';
    }

    set(finalNewState as any);
  },

  selectSwitch: async (teamIndex: number) => {
    const state = get();
    const target = state.playerTeam[teamIndex];
    if (!target || target.currentHp <= 0) return;

    // Block voluntary switching if trapped (Mean Look, Block, Ingrain, etc.) — unless forced (fainted)
    const leaving = state.playerTeam[state.activePlayerIndex];
    if (leaving && leaving.currentHp > 0 && state.phase === 'choosing') {
      if (leaving.volatile.trapped || leaving.volatile.ingrain) {
        set(s => ({ logs: [...s.logs, { message: `${leaving.nickname || getPokemonData(leaving.dataId).name} ne peut pas être rappelé !`, type: 'info' }] }));
        return;
      }
    }

    const targetName = target.nickname || getPokemonData(target.dataId).name;
    const newLogs: BattleLogEntry[] = [];
    if (leaving && leaving.currentHp > 0 && leaving.ability) {
      const switchOutResult = triggerAbility(leaving.ability, 'switch-out', {
        pokemon: leaving, trigger: 'switch-out',
        pokemonName: leaving.nickname || getPokemonData(leaving.dataId).name,
      });
      newLogs.push(...switchOutResult.logs);
    }

    newLogs.push({ message: `Go ! ${targetName} !`, type: 'info' });

    set({
      activePlayerIndex: teamIndex,
      phase: 'choosing',
      logs: [...state.logs, ...newLogs],
    });

    // Reset volatile status for the switched-in Pokemon
    set(s => {
      const newTeam = [...s.playerTeam];
      newTeam[teamIndex] = {
        ...newTeam[teamIndex],
        volatile: freshVolatile(),
        statStages: freshStatStages()
      };
      return { playerTeam: newTeam };
    });

    // We must await log delay for the switch message
    const switchDelay = 1000 / useGameStore.getState().settings.gameSpeed;
    await new Promise(r => setTimeout(r, switchDelay));

    // Apply entry hazards on switch-in
    {
      const currentState = get();
      const switchedIn = currentState.playerTeam[teamIndex];
      const pSide = { ...currentState.playerSide };
      const hazardResult = applyEntryHazards(switchedIn, pSide);
      if (hazardResult.logs.length > 0) {
        set(s => {
          const newTeam = [...s.playerTeam];
          newTeam[teamIndex] = { ...newTeam[teamIndex], currentHp: switchedIn.currentHp, status: switchedIn.status, statStages: { ...switchedIn.statStages } };
          return { logs: [...s.logs, ...hazardResult.logs], playerTeam: newTeam, playerSide: { ...pSide } };
        });
        for (const log of hazardResult.logs) {
          const delay = (log.message.length * 15 + 300) / useGameStore.getState().settings.gameSpeed;
          await new Promise(r => setTimeout(r, delay));
        }
        if (hazardResult.fainted) {
          const afterHazard = get();
          const nextAlive = afterHazard.playerTeam.findIndex((p, i) => i !== teamIndex && p.currentHp > 0);
          if (nextAlive < 0) {
            set(s => ({ phase: 'defeat', logs: [...s.logs, { message: 'Tous vos Pokémon sont K.O...', type: 'info' }] }));
            return;
          }
          set(s => ({ phase: 'switching', logs: [...s.logs, { message: 'Envoyez votre prochain Pokémon !', type: 'info' }] }));
          return;
        }
      }
    }

    // Switch-in ability trigger
    {
      const afterHazardState = get();
      const switchedMon = afterHazardState.playerTeam[teamIndex];
      const opponent = afterHazardState.enemyTeam[afterHazardState.activeEnemyIndex];
      const switchInResult = processSwitchInAbility(switchedMon, opponent);
      if (switchInResult.logs.length > 0) {
        if (switchInResult.weather) set({ weather: switchInResult.weather, weatherTurns: 5 });
        // Intimidate mutates opponent statStages — sync it
        set(s => {
          const newET = [...s.enemyTeam];
          if (opponent) newET[s.activeEnemyIndex] = { ...newET[s.activeEnemyIndex], statStages: { ...opponent.statStages } };
          return { logs: [...s.logs, ...switchInResult.logs], enemyTeam: newET };
        });
        for (const log of switchInResult.logs) {
          const delay = (log.message.length * 15 + 300) / useGameStore.getState().settings.gameSpeed;
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    // Enemy gets a free attack when switching (except during forced switch after fainting)
    if (state.phase !== 'switching') {
      const result = await executeEnemyTurn(get, set, teamIndex);
      if (result !== 'continue') return;
    }

    set(s => ({
      turnNumber: state.phase !== 'switching' ? s.turnNumber + 1 : s.turnNumber,
    }));
  },

  useItem: async (itemId: string, targetIndex?: number) => {
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

      set(s => {
        const newTeam = [...s.playerTeam];
        newTeam[idx] = { ...newTeam[idx], currentHp: newTeam[idx].currentHp + healAmount };
        return { playerTeam: newTeam, logs: [...s.logs, { message: `${name} récupère ${healAmount} PV !`, type: 'info' }] };
      });

      if (state.phase === 'choosing') {
        const result = await executeEnemyTurn(get, set, state.activePlayerIndex);
        if (result !== 'continue') return;
        set(s => ({ phase: 'choosing', turnNumber: s.turnNumber + 1 }));
      }
    }

    if (item.effect.type === 'status_cure') {
      const idx = targetIndex ?? state.activePlayerIndex;
      const pokemon = state.playerTeam[idx];
      if (!pokemon) return;

      const cures = item.effect.curesStatus ?? [];
      if (pokemon.status && (cures.includes(pokemon.status) || cures.includes('all'))) {
        const name = pokemon.nickname || getPokemonData(pokemon.dataId).name;
        set(s => {
          const newTeam = [...s.playerTeam];
          newTeam[idx] = { ...newTeam[idx], status: null, statusTurns: 0 };
          return { playerTeam: newTeam, logs: [...s.logs, { message: `${name} est soigné !`, type: 'info' }] };
        });
      }

      if (state.phase === 'choosing') {
        const result = await executeEnemyTurn(get, set, state.activePlayerIndex);
        if (result !== 'continue') return;
        set(s => ({ phase: 'choosing', turnNumber: s.turnNumber + 1 }));
      }
    }

    if (item.effect.type === 'revive') {
      const idx = targetIndex ?? 0;
      const pokemon = state.playerTeam[idx];
      if (!pokemon || pokemon.currentHp > 0) return;

      const name = pokemon.nickname || getPokemonData(pokemon.dataId).name;
      const newHp = Math.floor(pokemon.maxHp * (item.effect.reviveHpPercent ?? 50) / 100);
      set(s => {
        const newTeam = [...s.playerTeam];
        newTeam[idx] = { ...newTeam[idx], currentHp: newHp, status: null, statusTurns: 0 };
        return { playerTeam: newTeam, logs: [...s.logs, { message: `${name} est ranimé !`, type: 'info' }] };
      });

      if (state.phase === 'choosing') {
        const result = await executeEnemyTurn(get, set, state.activePlayerIndex);
        if (result !== 'continue') return;
        set(s => ({ phase: 'choosing', turnNumber: s.turnNumber + 1 }));
      }
    }

    if (item.effect.type === 'full_restore') {
      const idx = targetIndex ?? state.activePlayerIndex;
      const pokemon = state.playerTeam[idx];
      if (!pokemon || pokemon.currentHp <= 0) return;

      const name = pokemon.nickname || getPokemonData(pokemon.dataId).name;
      set(s => {
        const newTeam = [...s.playerTeam];
        newTeam[idx] = {
          ...newTeam[idx],
          currentHp: newTeam[idx].maxHp,
          status: null,
          statusTurns: 0,
          volatile: { ...newTeam[idx].volatile, confusion: 0 },
        };
        return { playerTeam: newTeam, logs: [...s.logs, { message: `${name} est complètement soigné !`, type: 'info' }] };
      });

      if (state.phase === 'choosing') {
        const result = await executeEnemyTurn(get, set, state.activePlayerIndex);
        if (result !== 'continue') return;
        set(s => ({ phase: 'choosing', turnNumber: s.turnNumber + 1 }));
      }
    }

    if (item.effect.type === 'battle_stat') {
      const pokemon = state.playerTeam[state.activePlayerIndex];
      if (!pokemon || pokemon.currentHp <= 0) return;

      const stat = item.effect.stat as keyof typeof pokemon.statStages;
      const stages = item.effect.stages ?? 1;
      if (stat && stat in pokemon.statStages) {
        const current = pokemon.statStages[stat];
        const newVal = Math.max(-6, Math.min(6, current + stages));
        const name = pokemon.nickname || getPokemonData(pokemon.dataId).name;

        const statNames: Record<string, string> = {
          attack: 'Attaque', defense: 'Défense', spAtk: 'Attaque Spé.',
          spDef: 'Défense Spé.', speed: 'Vitesse',
        };

        set(s => {
          const newTeam = [...s.playerTeam];
          newTeam[state.activePlayerIndex] = {
            ...newTeam[state.activePlayerIndex],
            statStages: { ...newTeam[state.activePlayerIndex].statStages, [stat]: newVal },
          };
          return { playerTeam: newTeam, logs: [...s.logs, { message: `${statNames[stat] || stat} de ${name} monte !`, type: 'info' }] };
        });
      }

      if (state.phase === 'choosing') {
        const result = await executeEnemyTurn(get, set, state.activePlayerIndex);
        if (result !== 'continue') return;
        set(s => ({ phase: 'choosing', turnNumber: s.turnNumber + 1 }));
      }
    }
  },

  attemptFlee: async () => {
    const state = get();
    if (state.type !== 'wild' && state.type !== 'safari') {
      set(s => ({ logs: [...s.logs, { message: 'Impossible de fuir un combat de dresseur !', type: 'info' }] }));
      return;
    }

    if (state.type === 'safari') {
      set(s => ({
        phase: 'fled',
        logs: [...s.logs, { message: 'Vous avez pris la fuite !', type: 'info' }],
      }));
      return;
    }

    const player = state.playerTeam[state.activePlayerIndex];
    const enemy = state.enemyTeam[state.activeEnemyIndex];
    if (!player || !enemy) return;

    // Trapped: cannot flee (Mean Look, Block, Bind, etc.)
    if (player.volatile.trapped || player.volatile.ingrain || player.volatile.bound > 0) {
      set(s => ({ logs: [...s.logs, { message: 'Impossible de fuir !', type: 'info' }] }));
      return;
    }

    const playerSpeed = getEffectiveStat(player, 'speed');
    const enemySpeed = getEffectiveStat(enemy, 'speed');
    const fleeChance = Math.min(0.95, 0.5 + (playerSpeed - enemySpeed) * 0.01);

    if (Math.random() < fleeChance) {
      set(s => ({
        phase: 'fled',
        logs: [...s.logs, { message: 'Vous avez pris la fuite !', type: 'info' }],
      }));
    } else {
      set(s => ({ logs: [...s.logs, { message: 'Fuite impossible !', type: 'info' }] }));
      const fleeDelay = ('Fuite impossible !'.length * 15 + 300) / useGameStore.getState().settings.gameSpeed;
      await new Promise(r => setTimeout(r, fleeDelay));

      const result = await executeEnemyTurn(get, set, state.activePlayerIndex);
      if (result !== 'continue') return;

      set(s => ({ phase: 'choosing', turnNumber: s.turnNumber + 1 }));
    }
  },

  attemptCapture: async (ballId: string) => {
    const state = get();
    if (state.type !== 'wild') {
      set(s => ({ logs: [...s.logs, { message: 'Impossible de capturer un Pokémon dresseur !', type: 'info' }] }));
      return;
    }

    const enemy = state.enemyTeam[state.activeEnemyIndex];
    if (!enemy) return;

    const ball = getItemData(ballId);
    const multiplier = ball.effect?.catchMultiplier ?? 1;

    const result = attemptCatch(enemy, multiplier);
    const newLogs: BattleLogEntry[] = [{ message: `Vous lancez une ${ball.name} !`, type: 'catch' }];

    const shakeMsgs = ['...', '...', '...', '...'];
    for (let i = 0; i < result.shakes && i < 4; i++) {
      newLogs.push({ message: shakeMsgs[i], type: 'catch' });
    }

    newLogs.push(...result.messages.map(m => ({ message: m, type: 'catch' as const })));

    if (result.success) {
      const enemyName = getPokemonData(enemy.dataId).name;
      newLogs.push({ message: `${enemyName} a été capturé !`, type: 'catch' });

      for (const log of newLogs) {
        set(s => ({ logs: [...s.logs, log] }));
        await new Promise(r => setTimeout(r, 700));
      }

      set(s => ({
        phase: 'caught',
        caughtPokemon: enemy,
      }));

      if (state.encounterId) {
        useGameStore.getState().triggerEvent(state.encounterId);
      }
    } else {
      for (const log of newLogs) {
        set(s => ({ logs: [...s.logs, log] }));
        await new Promise(r => setTimeout(r, 700));
      }

      const captureResult = await executeEnemyTurn(get, set, state.activePlayerIndex);
      if (captureResult !== 'continue') return;

      set(s => ({ phase: 'choosing', turnNumber: s.turnNumber + 1 }));
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
      weather: null,
      weatherTurns: 0,
      trickRoom: 0,
      playerSide: freshSideConditions(),
      enemySide: freshSideConditions(),
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
