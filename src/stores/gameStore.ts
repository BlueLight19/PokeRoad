import { create } from 'zustand';
import {
  PokemonInstance,
} from '../types/pokemon';
import {
  GameView,
  PlayerData,
  ProgressData,
  TrainerData,
} from '../types/game';
import { InventoryItem } from '../types/inventory';
import { saveGame, loadGame, hasSave } from '../utils/saveManager';
import {
  getZoneData,
  getTrainerData,
  getGymData,
  getMoveData,
  getItemData,
} from '../utils/dataLoader';
import {
  createPokemonInstance,
  processLevelUp,
  calculateXpGain,
  applyEvGains,
} from '../engine/experienceCalculator';
import {
  createPCStorage,
  depositPokemon,
  withdrawPokemon,
  findPokemonInPC,
  PCStorage,
} from '../engine/pcStorage';
import { evolvePokemon } from '../engine/evolutionEngine';
import { useItem } from '../engine/itemLogic';
import { fullHealTeam } from '../engine/battleEngine';

export interface GameState {
  // Core state
  currentView: GameView;
  player: PlayerData;
  team: PokemonInstance[];
  pc: PCStorage;
  inventory: InventoryItem[];
  progress: ProgressData;
  selectedZone: string | null;
  selectedPokemonIndex: number | null;

  // Pending actions
  pendingEvolution: { pokemonIndex: number; targetId: number } | null;
  pendingMoveLearn: { pokemonIndex: number; moveId: number } | null;

  // Actions
  initGame: () => void;
  startNewGame: (playerName: string, starterId: number) => void;
  setView: (view: GameView) => void;
  selectZone: (zoneId: string) => void;

  // Team management
  addPokemonToTeam: (pokemon: PokemonInstance) => void;
  switchTeamOrder: (idx1: number, idx2: number) => void;
  releasePokemon: (uid: string) => void;
  moveToPc: (uid: string) => void;
  moveFromPc: (uid: string) => void;

  // Inventory
  addItem: (itemId: string, qty: number) => void;
  removeItem: (itemId: string, qty: number) => void;
  getItemQuantity: (itemId: string) => number;
  useItemAction: (itemId: string, pokemonUid?: string) => { success: boolean; message: string };

  // Money
  addMoney: (amount: number) => void;
  spendMoney: (amount: number) => boolean;

  // Progress
  markTrainerDefeated: (trainerId: string) => void;
  markGymDefeated: (gymId: string) => void;
  advanceLeagueProgress: () => void;
  resetLeagueProgress: () => void;
  isZoneUnlocked: (zoneId: string) => boolean;
  isTrainerDefeated: (trainerId: string) => boolean;
  getTrainersForZone: (zoneId: string) => TrainerData[];

  // Post-battle
  grantXpAndProcess: (
    pokemonIndex: number,
    defeatedId: number,
    defeatedLevel: number,
    isTrainer: boolean
  ) => void;
  healTeam: () => void;
  confirmEvolution: (accept: boolean) => void;
  learnMoveChoice: (forgetIndex: number | null) => void;

  // Save/load
  saveGameState: () => void;
  loadGameState: () => boolean;
  hasSaveData: () => boolean;
}

export const useGameStore = create<GameState>((set, get) => ({
  currentView: 'title',
  player: {
    name: '',
    money: 3000,
    badges: [],
    playTime: 0,
    starter: null,
  },
  team: [],
  pc: createPCStorage(),
  inventory: [],
  progress: {
    defeatedTrainers: [],
    unlockedZones: ['bourg-palette', 'route-1'],
    currentZone: 'bourg-palette',
    caughtPokemon: [],
    seenPokemon: [],
    leagueProgress: 0,
  },
  selectedZone: null,
  selectedPokemonIndex: null,
  pendingEvolution: null,
  pendingMoveLearn: null,

  initGame: () => {
    set({ currentView: 'title' });
  },

  startNewGame: (playerName: string, starterId: number) => {
    const starter = createPokemonInstance(starterId, 5);
    // Fix PP from move data
    starter.moves = starter.moves.map(m => {
      const data = getMoveData(m.moveId);
      return { moveId: m.moveId, currentPp: data.pp, maxPp: data.pp };
    });

    const initialItems: InventoryItem[] = [
      { itemId: 'pokeball', quantity: 5 },
      { itemId: 'potion', quantity: 3 },
    ];

    set({
      currentView: 'world_map',
      player: {
        name: playerName,
        money: 3000,
        badges: [],
        playTime: 0,
        starter: starterId,
      },
      team: [starter],
      pc: createPCStorage(),
      inventory: initialItems,
      progress: {
        defeatedTrainers: [],
        unlockedZones: ['bourg-palette', 'route-1'],
        currentZone: 'bourg-palette',
        caughtPokemon: [starterId],
        seenPokemon: [starterId],
        leagueProgress: 0,
      },
      selectedZone: null,
      pendingEvolution: null,
      pendingMoveLearn: null,
    });

    get().saveGameState();
  },

  setView: (view: GameView) => set({ currentView: view }),

  selectZone: (zoneId: string) => {
    const zone = getZoneData(zoneId);
    // Determine view based on zone type field
    const zoneData = zone as any;
    let view: GameView = zoneData.type === 'city' ? 'city_menu' : 'route_menu';

    if (zoneId === 'league-hall') {
      view = 'league';
    }

    set({
      selectedZone: zoneId,
      currentView: view,
      progress: { ...get().progress, currentZone: zoneId },
    });
  },

  addPokemonToTeam: (pokemon: PokemonInstance) => {
    const state = get();
    if (state.team.length < 6) {
      set({ team: [...state.team, pokemon] });
    } else {
      const success = depositPokemon(state.pc, pokemon);
      if (success) {
        set({ pc: { ...state.pc } }); // Trigger update
      }
    }

    // Track caught
    if (!state.progress.caughtPokemon.includes(pokemon.dataId)) {
      set({
        progress: {
          ...state.progress,
          caughtPokemon: [...state.progress.caughtPokemon, pokemon.dataId],
        },
      });
    }

    get().saveGameState();
  },

  switchTeamOrder: (idx1: number, idx2: number) => {
    const team = [...get().team];
    if (idx1 < 0 || idx1 >= team.length || idx2 < 0 || idx2 >= team.length) return;
    [team[idx1], team[idx2]] = [team[idx2], team[idx1]];
    set({ team });
  },

  releasePokemon: (uid: string) => {
    const state = get();
    // Check team
    const inTeam = state.team.find(p => p.uid === uid);
    if (inTeam) {
      if (state.team.length <= 1) return;
      set({ team: state.team.filter(p => p.uid !== uid) });
      return;
    }

    // Check PC
    const found = findPokemonInPC(state.pc, uid);
    if (found) {
      withdrawPokemon(state.pc, found.boxId, found.slotId); // Remove from box (returns pokemon, but we ignore it)
      set({ pc: { ...state.pc } });
    }
  },

  moveToPc: (uid: string) => {
    const state = get();
    if (state.team.length <= 1) return;
    const pokemon = state.team.find(p => p.uid === uid);
    if (!pokemon) return;

    const success = depositPokemon(state.pc, pokemon);
    if (success) {
      set({
        team: state.team.filter(p => p.uid !== uid),
        pc: { ...state.pc }
      });
    }
  },

  moveFromPc: (uid: string) => {
    const state = get();
    if (state.team.length >= 6) return;

    const found = findPokemonInPC(state.pc, uid);
    if (!found) return;

    const pokemon = withdrawPokemon(state.pc, found.boxId, found.slotId);
    if (pokemon) {
      set({
        team: [...state.team, pokemon],
        pc: { ...state.pc }
      });
    }
  },

  addItem: (itemId: string, qty: number) => {
    const inventory = [...get().inventory];
    const existing = inventory.find(i => i.itemId === itemId);
    if (existing) {
      existing.quantity += qty;
    } else {
      inventory.push({ itemId, quantity: qty });
    }
    set({ inventory });
  },

  removeItem: (itemId: string, qty: number) => {
    const inventory = [...get().inventory];
    const existing = inventory.find(i => i.itemId === itemId);
    if (!existing) return;
    existing.quantity -= qty;
    if (existing.quantity <= 0) {
      set({ inventory: inventory.filter(i => i.itemId !== itemId) });
    } else {
      set({ inventory });
    }
  },

  useItemAction: (itemId: string, pokemonUid?: string) => {
    const state = get();
    // Check quantity
    const qty = get().getItemQuantity(itemId);
    if (qty <= 0) return { success: false, message: "Vous n'en avez pas !" };

    const itemData = getItemData(itemId);
    if (!itemData) return { success: false, message: "Objet inconnu." };

    // If item requires a target
    const requiresTarget = ['heal', 'status', 'revive', 'evolution'].includes(itemData.effect?.type || '');

    if (requiresTarget) {
      if (!pokemonUid) return { success: false, message: "Utiliser sur qui ?" };
      const pokemon = state.team.find(p => p.uid === pokemonUid);
      if (!pokemon) return { success: false, message: "Pokémon introuvable." };

      // Use logic
      const result = useItem(itemData, pokemon);
      if (result.success && result.consumed) {
        get().removeItem(itemId, 1);
        set({ team: [...state.team] }); // Update UI

        // Check evolution
        if (result.newPokemonId) {
          // Evolution handled inside useItem? 
          // evolvePokemon updates the instance.
          // But we might want to show a modal or animation.
          // For now, straightforward update.
        }
      }
      return { success: result.success, message: result.message };
    }

    return { success: false, message: "Impossible d'utiliser ça pour le moment." };
  },

  getItemQuantity: (itemId: string) => {
    const item = get().inventory.find(i => i.itemId === itemId);
    return item?.quantity ?? 0;
  },

  addMoney: (amount: number) => {
    set({ player: { ...get().player, money: get().player.money + amount } });
  },

  spendMoney: (amount: number) => {
    const state = get();
    if (state.player.money < amount) return false;
    set({ player: { ...state.player, money: state.player.money - amount } });
    return true;
  },

  markTrainerDefeated: (trainerId: string) => {
    const state = get();
    if (state.progress.defeatedTrainers.includes(trainerId)) return;

    const newProgress = {
      ...state.progress,
      defeatedTrainers: [...state.progress.defeatedTrainers, trainerId],
    };

    // Check if this unlocks new zones
    const allZones = ['bourg-palette', 'route-1', 'jadielle', 'route-2', 'foret-jade', 'argenta', 'route-3'];
    for (const zoneId of allZones) {
      if (newProgress.unlockedZones.includes(zoneId)) continue;
      try {
        const zone = getZoneData(zoneId);
        const condition = (zone as any).unlockCondition;
        if (!condition) {
          if (!newProgress.unlockedZones.includes(zoneId)) {
            newProgress.unlockedZones.push(zoneId);
          }
          continue;
        }

        if (condition.type === 'trainers' && condition.zones) {
          const allDefeated = condition.zones.every((z: string) => {
            try {
              const zoneData = getZoneData(z) as any;
              const zoneTrainers: string[] = zoneData.trainers || [];
              return zoneTrainers.every((t: string) =>
                newProgress.defeatedTrainers.includes(t)
              );
            } catch {
              return true;
            }
          });
          if (allDefeated && !newProgress.unlockedZones.includes(zoneId)) {
            newProgress.unlockedZones.push(zoneId);
          }
        }

        if (condition.type === 'gym' && condition.gymId) {
          const gym = getGymData(condition.gymId);
          if (state.player.badges.includes(gym.badge) && !newProgress.unlockedZones.includes(zoneId)) {
            newProgress.unlockedZones.push(zoneId);
          }
        }
      } catch {
        // Zone not found, skip
      }
    }

    set({ progress: newProgress });
    get().saveGameState();
  },

  markGymDefeated: (gymId: string) => {
    const gym = getGymData(gymId);
    const state = get();

    if (!state.player.badges.includes(gym.badge)) {
      const newPlayer = {
        ...state.player,
        badges: [...state.player.badges, gym.badge],
      };
      set({ player: newPlayer });
    }

    // Re-check zone unlocks
    const newProgress = { ...get().progress };
    const allZones = ['bourg-palette', 'route-1', 'jadielle', 'route-2', 'foret-jade', 'argenta', 'route-3'];
    for (const zoneId of allZones) {
      if (newProgress.unlockedZones.includes(zoneId)) continue;
      try {
        const zone = getZoneData(zoneId);
        const condition = (zone as any).unlockCondition;
        if (!condition) continue;
        if (condition.type === 'gym' && condition.gymId === gymId) {
          newProgress.unlockedZones.push(zoneId);
        }
      } catch {
        // Skip
      }
    }

    set({ progress: newProgress });
    get().saveGameState();
  },

  isZoneUnlocked: (zoneId: string) => {
    return get().progress.unlockedZones.includes(zoneId);
  },

  isTrainerDefeated: (trainerId: string) => {
    return get().progress.defeatedTrainers.includes(trainerId);
  },

  advanceLeagueProgress: () => {
    const state = get();
    // 0 -> 1 (defeated Lorelei) -> 2 (Bruno) -> 3 (Agatha) -> 4 (Lance) -> 5 (Champion)
    const newProgress = {
      ...state.progress,
      leagueProgress: state.progress.leagueProgress + 1
    };
    set({ progress: newProgress });
    get().saveGameState();
  },

  resetLeagueProgress: () => {
    const state = get();
    const newProgress = {
      ...state.progress,
      leagueProgress: 0
    };
    set({ progress: newProgress });
    get().saveGameState();
  },

  getTrainersForZone: (zoneId: string) => {
    try {
      const zone = getZoneData(zoneId) as any;
      const trainerIds: string[] = zone.trainers || [];
      return trainerIds.map(id => getTrainerData(id));
    } catch {
      return [];
    }
  },

  grantXpAndProcess: (pokemonIndex: number, defeatedId: number, defeatedLevel: number, isTrainer: boolean) => {
    const team = [...get().team];
    const pokemon = team[pokemonIndex];
    if (!pokemon) return;

    const xp = calculateXpGain(defeatedId, defeatedLevel, isTrainer);
    pokemon.xp += xp;

    // Apply EV gains
    pokemon.evs = applyEvGains(pokemon, defeatedId);

    // Check level up
    const result = processLevelUp(pokemon);
    if (result) {
      const hpDiff = result.newMaxHp - pokemon.maxHp;
      pokemon.level = result.newLevel;
      pokemon.stats = result.newStats;
      pokemon.maxHp = result.newMaxHp;
      pokemon.currentHp = Math.min(pokemon.maxHp, pokemon.currentHp + hpDiff);
      pokemon.xpToNextLevel = result.newXpToNextLevel;

      // Handle move learning
      if (result.learnableMoves.length > 0) {
        const moveId = result.learnableMoves[0]; // Learn first available
        if (pokemon.moves.length < 4) {
          const moveData = getMoveData(moveId);
          pokemon.moves.push({ moveId, currentPp: moveData.pp, maxPp: moveData.pp });
        } else {
          set({ pendingMoveLearn: { pokemonIndex, moveId } });
        }
      }

      // Handle evolution
      if (result.canEvolve && result.evolutionId) {
        set({ pendingEvolution: { pokemonIndex, targetId: result.evolutionId } });
      }
    }

    // Track seen
    const progress = get().progress;
    if (!progress.seenPokemon.includes(defeatedId)) {
      set({
        progress: { ...progress, seenPokemon: [...progress.seenPokemon, defeatedId] },
      });
    }

    set({ team });
    get().saveGameState();
  },

  healTeam: () => {
    const team = [...get().team];
    fullHealTeam(team);
    set({ team });
  },

  confirmEvolution: (accept: boolean) => {
    const { pendingEvolution, team } = get();
    if (!pendingEvolution) return;

    if (accept) {
      const newTeam = [...team];
      const pokemon = newTeam[pendingEvolution.pokemonIndex];
      if (pokemon) {
        evolvePokemon(pokemon, pendingEvolution.targetId);
      }
      set({ team: newTeam, pendingEvolution: null });
    } else {
      set({ pendingEvolution: null });
    }

    get().saveGameState();
  },

  learnMoveChoice: (forgetIndex: number | null) => {
    const { pendingMoveLearn, team } = get();
    if (!pendingMoveLearn) return;

    const newTeam = [...team];
    const pokemon = newTeam[pendingMoveLearn.pokemonIndex];
    if (!pokemon) {
      set({ pendingMoveLearn: null });
      return;
    }

    if (forgetIndex !== null && forgetIndex >= 0 && forgetIndex < 4) {
      const moveData = getMoveData(pendingMoveLearn.moveId);
      pokemon.moves[forgetIndex] = {
        moveId: pendingMoveLearn.moveId,
        currentPp: moveData.pp,
        maxPp: moveData.pp,
      };
    }
    // If forgetIndex is null, the move is not learned

    set({ team: newTeam, pendingMoveLearn: null });
    get().saveGameState();
  },

  saveGameState: () => {
    const state = get();
    saveGame({
      player: state.player,
      team: state.team,
      pc: state.pc,
      inventory: state.inventory,
      progress: state.progress,
    });
  },

  loadGameState: () => {
    const data = loadGame();
    if (!data) return false;

    // Migration for legacy PC (array)
    let pc: PCStorage = createPCStorage();
    if (Array.isArray(data.pc)) {
      (data.pc as any[]).forEach(p => {
        depositPokemon(pc, p);
      });
    } else {
      pc = data.pc;
    }

    set({
      currentView: 'world_map',
      player: data.player,
      team: data.team,
      pc,
      inventory: data.inventory,
      progress: data.progress,
      selectedZone: null,
      pendingEvolution: null,
      pendingMoveLearn: null,
    });
    return true;
  },

  hasSaveData: () => hasSave(),
}));
