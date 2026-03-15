import { create } from 'zustand';
import {
  PokemonInstance,
} from '../types/pokemon';
import {
  GameView,
  PlayerData,
  ProgressData,
  TrainerData,
  SafariState,
} from '../types/game';
import { InventoryItem } from '../types/inventory';
import { saveGame, loadGame, hasSave } from '../utils/saveManager';
import {
  getZoneData,
  getTrainerData,
  getGymData,
  getMoveData,
  getItemData,
  getAllZones,
  getPokemonData,
  getZoneTrainers,
} from '../utils/dataLoader';
import {
  createPokemonInstance,
  processLevelUp,
  calculateXpGain,
  applyEvGains,
  recalculateStats,
} from '../engine/experienceCalculator';
import {
  createPCStorage,
  depositPokemon,
  withdrawPokemon,
  findPokemonInPC,
  movePokemon,
  PCStorage,
} from '../engine/pcStorage';
import { evolvePokemon } from '../engine/evolutionEngine';
import { useItem } from '../engine/itemLogic';
import { fullHealTeam } from '../engine/battleEngine';

export interface GameNotification {
  id: string;
  type: 'item' | 'pokemon';
  itemId?: string;
  pokemonId?: number;
  quantity?: number;
  level?: number;
}

export interface GameState {
  // Core state
  currentView: GameView;
  player: PlayerData;
  team: PokemonInstance[];
  pc: PCStorage;
  inventory: InventoryItem[];
  progress: ProgressData;
  safariState: SafariState | null;
  selectedZone: string | null;
  selectedPokemonIndex: number | null;

  // Pending actions
  pendingEvolution: { pokemonIndex: number; targetId: number } | null;
  pendingEvolutionQueue: { pokemonIndex: number; targetId: number }[];
  pendingMoveLearn: { pokemonIndex: number; moveId: number; sourceItem?: string } | null;
  pendingMoveQueue: { pokemonIndex: number; moveId: number }[];

  // Settings
  settings: {
    gameSpeed: number;
  };

  // UI state
  notifications: GameNotification[];
  addNotification: (notification: Omit<GameNotification, 'id'>) => void;
  removeNotification: (id: string) => void;

  // Loading state
  hasSaveLoaded: boolean; // Whether we've checked for a save

  // Actions
  initGame: () => void;
  startNewGame: (playerName: string, starterId: number) => void;
  setView: (view: GameView) => void;
  selectZone: (zoneId: string) => void;
  startSafari: () => void;
  quitSafari: () => void;
  setGameSpeed: (speed: number) => void;

  // Team management
  addPokemonToTeam: (pokemon: PokemonInstance) => void;
  givePlayerPokemon: (pokemonId: number, level: number) => void;
  switchTeamOrder: (idx1: number, idx2: number) => void;
  releasePokemon: (uid: string) => void;
  moveToPc: (uid: string) => void;
  moveFromPc: (uid: string) => void;
  movePokemonInPC: (fromBoxId: number, fromSlotId: number, toBoxId: number, toSlotId: number) => void;

  // Inventory
  addItem: (itemId: string, qty: number) => void;
  removeItem: (itemId: string, qty: number) => void;
  sellItemAction: (itemId: string, qty: number) => void;
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
  decrementRepelSteps: () => void;
  setRepelSteps: (steps: number) => void;
  triggerEvent: (eventId: string) => void;

  // Dungeon floors
  setCurrentFloor: (zoneId: string, floor: number) => void;
  getCurrentFloor: (zoneId: string) => number;
  isFloorUnlocked: (zoneId: string, floor: number) => boolean;
  getMaxUnlockedFloor: (zoneId: string, totalFloors: number) => number;

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

  // Post-game
  handleGameCleared: () => void;

  // Save/load (async)
  saveGameState: () => void;
  loadGameState: () => Promise<boolean>;
  checkForSave: () => Promise<boolean>;
}

// Helper: fire-and-forget save (non-blocking)
function fireAndForgetSave(state: GameState) {
  saveGame({
    player: state.player,
    team: state.team,
    pc: state.pc,
    inventory: state.inventory,
    progress: state.progress,
  }).catch(e => console.error('Auto-save failed:', e));
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
    repelSteps: 0,
    lastPokemonCenter: 'bourg-palette',
    events: {},
    currentFloors: {},
  },
  safariState: null,
  selectedZone: null,
  selectedPokemonIndex: null,
  pendingEvolution: null,
  pendingEvolutionQueue: [],
  pendingMoveLearn: null,
  pendingMoveQueue: [],
  settings: {
    gameSpeed: 1,
  },
  notifications: [],
  hasSaveLoaded: false,

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
      { itemId: 'poke-ball', quantity: 5 },
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
        repelSteps: 0,
        lastPokemonCenter: 'bourg-palette',
        events: {},
        currentFloors: {},
      },
      selectedZone: null,
      pendingEvolution: null,
      pendingEvolutionQueue: [],
      pendingMoveLearn: null,
      pendingMoveQueue: [],
      // Keep existing settings
      settings: get().settings,
    });

    get().saveGameState();
  },

  setView: (view: GameView) => set({ currentView: view }),

  setGameSpeed: (speed: number) => set({ settings: { ...get().settings, gameSpeed: speed } }),

  addNotification: (notification) => {
    const id = Math.random().toString(36).substring(2, 9);
    set({ notifications: [...get().notifications, { ...notification, id }] });
  },

  removeNotification: (id) => {
    set({ notifications: get().notifications.filter(n => n.id !== id) });
  },

  selectZone: (zoneId: string) => {
    const zone = getZoneData(zoneId);
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
        set({ pc: { ...state.pc } });
      }
    }

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

  givePlayerPokemon: (pokemonId: number, level: number) => {
    const data = getPokemonData(pokemonId);
    const availableMoves = data.learnset
      .filter(e => e.level <= level)
      .map(e => getMoveData(e.moveId))
      .reverse();

    const damageMoves = availableMoves.filter(m => m.power && m.power > 0);
    const statusMoves = availableMoves.filter(m => !m.power || m.power === 0);

    const selectedMoves = [];
    for (let i = 0; i < 2 && i < damageMoves.length; i++) {
      selectedMoves.push(damageMoves[i]);
    }
    for (let i = 0; selectedMoves.length < 4 && i < statusMoves.length; i++) {
      if (!selectedMoves.some(m => m.id === statusMoves[i].id)) {
        selectedMoves.push(statusMoves[i]);
      }
    }
    for (let i = 0; selectedMoves.length < 4 && i < availableMoves.length; i++) {
      if (!selectedMoves.some(m => m.id === availableMoves[i].id)) {
        selectedMoves.push(availableMoves[i]);
      }
    }

    const moves = selectedMoves.map(m => m.id);

    const pokemon = createPokemonInstance(pokemonId, level, moves);
    pokemon.moves = pokemon.moves.map(m => {
      const moveData = getMoveData(m.moveId);
      return { moveId: m.moveId, currentPp: moveData.pp, maxPp: moveData.pp };
    });

    const state = get();
    const newProgress = { ...state.progress };
    if (!newProgress.seenPokemon.includes(pokemonId)) {
      newProgress.seenPokemon.push(pokemonId);
    }
    if (!newProgress.caughtPokemon.includes(pokemonId)) {
      newProgress.caughtPokemon.push(pokemonId);
    }
    set({ progress: newProgress });

    get().addPokemonToTeam(pokemon);
  },

  switchTeamOrder: (idx1: number, idx2: number) => {
    const team = [...get().team];
    if (idx1 < 0 || idx1 >= team.length || idx2 < 0 || idx2 >= team.length) return;
    [team[idx1], team[idx2]] = [team[idx2], team[idx1]];
    set({ team });
  },

  releasePokemon: (uid: string) => {
    const state = get();
    const inTeam = state.team.find(p => p.uid === uid);
    if (inTeam) {
      if (state.team.length <= 1) return;
      set({ team: state.team.filter(p => p.uid !== uid) });
      return;
    }

    const found = findPokemonInPC(state.pc, uid);
    if (found) {
      withdrawPokemon(state.pc, found.boxId, found.slotId);
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

  movePokemonInPC: (fromBoxId: number, fromSlotId: number, toBoxId: number, toSlotId: number) => {
    const state = get();
    const success = movePokemon(state.pc, fromBoxId, fromSlotId, toBoxId, toSlotId);
    if (success) {
      set({ pc: { ...state.pc } });
      get().saveGameState();
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
    get().saveGameState();

    const newProgress = { ...get().progress };
    const allZones = getAllZones();
    let changed = false;
    for (const zone of allZones) {
      const zoneId = zone.id;
      if (newProgress.unlockedZones.includes(zoneId)) continue;
      const isConnected = zone.connectedZones.some(z => newProgress.unlockedZones.includes(z));
      if (!isConnected) continue;
      try {
        const condition = (zone as any).unlockCondition;
        if (!condition) {
          newProgress.unlockedZones.push(zoneId);
          changed = true;
          continue;
        }
        if (condition.type === 'item' && condition.itemId) {
          if (get().inventory.some(i => i.itemId === condition.itemId && i.quantity > 0)) {
            newProgress.unlockedZones.push(zoneId);
            changed = true;
          }
        }
      } catch {}
    }
    if (changed) {
      set({ progress: newProgress });
      get().saveGameState();
    }
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
    get().saveGameState();
  },

  sellItemAction: (itemId: string, qty: number) => {
    const itemData = getItemData(itemId);
    if (!itemData) return;
    
    const currentQty = get().getItemQuantity(itemId);
    const sellQty = Math.min(qty, currentQty);
    if (sellQty <= 0) return;

    const sellPrice = Math.floor((itemData.price || 0) / 2) * sellQty;
    
    get().removeItem(itemId, sellQty);
    get().addMoney(sellPrice);
    get().saveGameState();
  },

  useItemAction: (itemId: string, pokemonUid?: string) => {
    const state = get();
    const qty = get().getItemQuantity(itemId);
    if (qty <= 0) return { success: false, message: "Vous n'en avez pas !" };

    const itemData = getItemData(itemId);
    if (!itemData) return { success: false, message: "Objet inconnu." };

    if (itemData.effect?.type === 'repel') {
      get().setRepelSteps(itemData.effect.repelSteps || 100);
      get().removeItem(itemId, 1);
      return { success: true, message: "Les Pokémon sauvages seront repoussés." };
    }

    if (itemData.effect?.type === 'escape_rope') {
      get().selectZone('bourg-palette');
      get().removeItem(itemId, 1);
      return { success: true, message: "Vous utilisez la Corde Sortie." };
    }

    if (itemData.effect?.type === 'teach' && itemData.effect.moveId) {
      const idx = state.team.findIndex(p => p.uid === pokemonUid);
      const pokemon = state.team[idx];
      if (!pokemon) return { success: false, message: "Utiliser sur qui ?" };

      const moveId = itemData.effect.moveId;
      const moveData = getMoveData(moveId);
      const pokemonData = getPokemonData(pokemon.dataId);

      if (pokemonData.tmLearnset && !pokemonData.tmLearnset.includes(moveId)) {
        return { success: false, message: `${pokemon.nickname || pokemonData.name} ne peut pas apprendre ${moveData.name} !` };
      }

      if (pokemon.moves.some(m => m.moveId === moveId)) {
        return { success: false, message: `${pokemon.nickname || getPokemonData(pokemon.dataId).name} connait déjà ${moveData.name} !` };
      }

      if (pokemon.moves.length < 4) {
        pokemon.moves.push({
          moveId,
          currentPp: moveData.pp,
          maxPp: moveData.pp
        });

        const name = pokemon.nickname || getPokemonData(pokemon.dataId).name;
        get().removeItem(itemId, 1);
        set({ team: [...state.team] });
        return { success: true, message: `${name} apprend ${moveData.name} !` };
      } else {
        set({
          pendingMoveLearn: {
            pokemonIndex: idx,
            moveId,
            sourceItem: itemId
          }
        });
        return { success: true, message: "Voulez-vous oublier une capacité ?" };
      }
    }

    const requiresTarget = ['heal', 'status', 'status_cure', 'revive', 'evolution', 'boost', 'full_restore', 'rare_candy', 'ev_boost', 'pp_restore'].includes(itemData.effect?.type || '');

    if (requiresTarget) {
      if (!pokemonUid) return { success: false, message: "Utiliser sur qui ?" };
      const pokemon = state.team.find(p => p.uid === pokemonUid);
      if (!pokemon) return { success: false, message: "Pokémon introuvable." };

      const result = useItem(itemData, pokemon);
      if (result.success && result.consumed) {
        get().removeItem(itemId, 1);

        if (result.levelUpResult) {
          const lResult = result.levelUpResult;
          const pokemonIdx = state.team.findIndex(p => p.uid === pokemonUid);

          let currentPendingMove = get().pendingMoveLearn;
          const currentMoveQueue = [...get().pendingMoveQueue];
          let currentPendingEvo = get().pendingEvolution;
          const currentEvoQueue = [...get().pendingEvolutionQueue];

          if (lResult.learnableMoves.length > 0) {
            for (const moveId of lResult.learnableMoves) {
              if (pokemon.moves.some(m => m.moveId === moveId)) continue;
              if (pokemon.moves.length < 4) {
                const moveData = getMoveData(moveId);
                pokemon.moves.push({ moveId, currentPp: moveData.pp, maxPp: moveData.pp });
              } else {
                const moveEntry = { pokemonIndex: pokemonIdx, moveId };
                if (!currentPendingMove) {
                  currentPendingMove = moveEntry;
                } else {
                  currentMoveQueue.push(moveEntry);
                }
              }
            }
          }

          if (lResult.canEvolve && lResult.evolutionId) {
            const evoEntry = { pokemonIndex: pokemonIdx, targetId: lResult.evolutionId };
            if (!currentPendingEvo) {
              currentPendingEvo = evoEntry;
            } else {
              currentEvoQueue.push(evoEntry);
            }
          }

          set({
            pendingMoveLearn: currentPendingMove,
            pendingMoveQueue: currentMoveQueue,
            pendingEvolution: currentPendingEvo,
            pendingEvolutionQueue: currentEvoQueue,
          });
        }

        const newTeam = [...state.team];
        newTeam[newTeam.findIndex(p => p.uid === pokemonUid)] = {
          ...pokemon,
          moves: pokemon.moves.map(m => ({ ...m })),
          stats: { ...pokemon.stats },
          evs: { ...pokemon.evs },
        };
        set({ team: newTeam });
        get().saveGameState();
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

    const allZones = getAllZones();

    for (const zone of allZones) {
      const zoneId = zone.id;
      if (newProgress.unlockedZones.includes(zoneId)) continue;

      const isConnected = zone.connectedZones.some(z => newProgress.unlockedZones.includes(z));
      if (!isConnected) continue;

      try {
        const condition = (zone as any).unlockCondition;
        if (!condition) {
          if (!newProgress.unlockedZones.includes(zoneId)) {
            newProgress.unlockedZones.push(zoneId);
          }
          continue;
        }

        if (condition.eventId && !newProgress.events[condition.eventId]) continue;
        if (condition.itemId && !get().inventory.some(i => i.itemId === condition.itemId && i.quantity > 0)) continue;

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

        if (condition.type === 'badge' && condition.badge) {
          if (state.player.badges.includes(condition.badge) && !newProgress.unlockedZones.includes(zoneId)) {
            newProgress.unlockedZones.push(zoneId);
          }
        }

        if (condition.type === 'item' && condition.itemId) {
          if (get().inventory.some(i => i.itemId === condition.itemId && i.quantity > 0) && !newProgress.unlockedZones.includes(zoneId)) {
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

    const newProgress = { ...get().progress };
    const allZonesData = getAllZones();

    for (const zone of allZonesData) {
      const zoneId = zone.id;
      if (newProgress.unlockedZones.includes(zoneId)) continue;

      const isConnected = zone.connectedZones.some(z => newProgress.unlockedZones.includes(z));
      if (!isConnected) continue;

      try {
        const condition = (zone as any).unlockCondition;
        if (!condition) {
          newProgress.unlockedZones.push(zoneId);
          continue;
        }

        if (condition.eventId && !newProgress.events[condition.eventId]) continue;
        if (condition.itemId && !get().inventory.some(i => i.itemId === condition.itemId && i.quantity > 0)) continue;
        if (condition.type === 'gym' && condition.gymId) {
          const condGym = getGymData(condition.gymId);
          if (get().player.badges.includes(condGym.badge)) {
            newProgress.unlockedZones.push(zoneId);
          }
        }
        if (condition.type === 'badge' && condition.badge) {
          if (get().player.badges.includes(condition.badge)) {
            newProgress.unlockedZones.push(zoneId);
          }
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
          if (allDefeated) {
            newProgress.unlockedZones.push(zoneId);
          }
        }
        if (condition.type === 'item' && condition.itemId) {
          if (get().inventory.some(i => i.itemId === condition.itemId && i.quantity > 0)) {
            newProgress.unlockedZones.push(zoneId);
          }
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

  triggerEvent: (eventId: string) => {
    const state = get();
    const newEvents = { ...state.progress.events, [eventId]: true };
    const newProgress = { ...state.progress, events: newEvents };

    const allZones = getAllZones();
    for (const zone of allZones) {
      const zoneId = zone.id;
      if (newProgress.unlockedZones.includes(zoneId)) continue;

      const isConnected = zone.connectedZones.some(z => newProgress.unlockedZones.includes(z));
      if (!isConnected) continue;

      try {
        const condition = (zone as any).unlockCondition;
        if (!condition) {
          newProgress.unlockedZones.push(zoneId);
          continue;
        }

        if (condition.eventId && !newEvents[condition.eventId]) continue;
        if (condition.itemId && !get().inventory.some(i => i.itemId === condition.itemId && i.quantity > 0)) continue;

        if (condition.type === 'trainers' && condition.zones) {
          const allDefeated = condition.zones.every((z: string) => {
            try {
              const zoneData = getZoneData(z) as any;
              const zoneTrainers: string[] = zoneData.trainers || [];
              return zoneTrainers.every((t: string) => newProgress.defeatedTrainers.includes(t));
            } catch { return true; }
          });
          if (allDefeated) newProgress.unlockedZones.push(zoneId);
        } else if (condition.type === 'gym' && condition.gymId) {
          if (get().player.badges.includes(getGymData(condition.gymId).badge)) newProgress.unlockedZones.push(zoneId);
        } else if (condition.type === 'badge' && condition.badge) {
          if (get().player.badges.includes(condition.badge)) newProgress.unlockedZones.push(zoneId);
        } else if (condition.type === 'item' && condition.itemId) {
          if (get().inventory.some(i => i.itemId === condition.itemId && i.quantity > 0)) newProgress.unlockedZones.push(zoneId);
        }
      } catch { }
    }

    set({ progress: newProgress });
    get().saveGameState();
  },

  // Dungeon floors
  setCurrentFloor: (zoneId: string, floor: number) => {
    const state = get();
    set({
      progress: {
        ...state.progress,
        currentFloors: { ...state.progress.currentFloors, [zoneId]: floor },
      },
    });
    get().saveGameState();
  },

  getCurrentFloor: (zoneId: string) => {
    return get().progress.currentFloors[zoneId] ?? 1;
  },

  isFloorUnlocked: (zoneId: string, floor: number) => {
    if (floor <= 1) return true;
    const state = get();
    // All trainers on the previous floor must be defeated
    const prevFloorTrainers = getZoneTrainers(zoneId, state.player.starter, floor - 1);
    return prevFloorTrainers.every(t => state.progress.defeatedTrainers.includes(t.id));
  },

  getMaxUnlockedFloor: (zoneId: string, totalFloors: number) => {
    const state = get();
    for (let f = totalFloors; f >= 1; f--) {
      if (state.isFloorUnlocked(zoneId, f)) return f;
    }
    return 1;
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

  decrementRepelSteps: () => {
    const { progress } = get();
    if (progress.repelSteps > 0) {
      set({
        progress: { ...progress, repelSteps: progress.repelSteps - 1 }
      });
    }
  },

  setRepelSteps: (steps: number) => {
    set({
      progress: { ...get().progress, repelSteps: steps }
    });
  },

  grantXpAndProcess: (pokemonIndex: number, defeatedId: number, defeatedLevel: number, isTrainer: boolean) => {
    const team = [...get().team];
    const pokemon = team[pokemonIndex];
    if (!pokemon) return;

    const xp = calculateXpGain(defeatedId, defeatedLevel, isTrainer);
    pokemon.xp += xp;

    pokemon.evs = applyEvGains(pokemon, defeatedId);

    const result = processLevelUp(pokemon);
    if (result) {
      const hpDiff = result.newMaxHp - pokemon.maxHp;
      pokemon.level = result.newLevel;
      pokemon.stats = result.newStats;
      pokemon.maxHp = result.newMaxHp;
      pokemon.currentHp = Math.min(pokemon.maxHp, pokemon.currentHp + hpDiff);
      pokemon.xpToNextLevel = result.newXpToNextLevel;

      if (result.learnableMoves.length > 0) {
        const movesToQueue: { pokemonIndex: number; moveId: number }[] = [];
        for (const moveId of result.learnableMoves) {
          if (pokemon.moves.some(m => m.moveId === moveId)) continue;
          if (pokemon.moves.length < 4) {
            const moveData = getMoveData(moveId);
            pokemon.moves.push({ moveId, currentPp: moveData.pp, maxPp: moveData.pp });
          } else {
            movesToQueue.push({ pokemonIndex, moveId });
          }
        }
        if (movesToQueue.length > 0) {
          const existing = get().pendingMoveQueue;
          if (!get().pendingMoveLearn) {
            set({
              pendingMoveLearn: movesToQueue[0],
              pendingMoveQueue: [...existing, ...movesToQueue.slice(1)],
            });
          } else {
            set({
              pendingMoveQueue: [...existing, ...movesToQueue],
            });
          }
        }
      }

      if (result.canEvolve && result.evolutionId) {
        const evoEntry = { pokemonIndex, targetId: result.evolutionId };
        if (!get().pendingEvolution) {
          set({ pendingEvolution: evoEntry });
        } else {
          set({ pendingEvolutionQueue: [...get().pendingEvolutionQueue, evoEntry] });
        }
      }
    } else {
      const newStats = recalculateStats(pokemon);
      const hpDiff = newStats.hp - pokemon.maxHp;
      pokemon.stats = newStats;
      pokemon.maxHp = newStats.hp;
      pokemon.currentHp = Math.min(pokemon.maxHp, pokemon.currentHp + Math.max(0, hpDiff));
    }

    const progress = get().progress;
    if (!progress.seenPokemon.includes(defeatedId)) {
      set({
        progress: { ...progress, seenPokemon: [...progress.seenPokemon, defeatedId] },
      });
    }

    team[pokemonIndex] = {
      ...pokemon,
      moves: pokemon.moves.map(m => ({ ...m })),
      stats: { ...pokemon.stats },
      evs: { ...pokemon.evs },
    };
    set({ team });
    get().saveGameState();
  },

  healTeam: () => {
    const team = [...get().team];
    fullHealTeam(team);
    set({ team });
  },

  startSafari: () => {
    const state = get();
    if (state.player.money < 500) return;
    const success = get().spendMoney(500);
    if (!success) return;
    set({
      safariState: { steps: 30, balls: 30 },
      selectedZone: 'parc-safari',
      currentView: 'route_menu'
    });
  },

  quitSafari: () => {
    set({
      safariState: null,
      selectedZone: 'parmanie',
      currentView: 'city_menu'
    });
  },

  confirmEvolution: (accept: boolean) => {
    const { pendingEvolution, pendingEvolutionQueue, team } = get();
    if (!pendingEvolution) return;

    if (accept) {
      const newTeam = [...team];
      const pokemon = newTeam[pendingEvolution.pokemonIndex];
      if (pokemon) {
        const result = evolvePokemon(pokemon, pendingEvolution.targetId);
        
        if (result.learnableMoves.length > 0) {
          const movesToQueue = result.learnableMoves.map(moveId => ({
            pokemonIndex: pendingEvolution.pokemonIndex,
            moveId
          }));
          
          const existingQueue = get().pendingMoveQueue;
          const currentPending = get().pendingMoveLearn;
          
          if (!currentPending) {
            set({
              pendingMoveLearn: movesToQueue[0],
              pendingMoveQueue: [...existingQueue, ...movesToQueue.slice(1)]
            });
          } else {
            set({
              pendingMoveQueue: [...existingQueue, ...movesToQueue]
            });
          }
        }
      }
      if (pendingEvolutionQueue.length > 0) {
        const [next, ...rest] = pendingEvolutionQueue;
        set({ team: newTeam, pendingEvolution: next, pendingEvolutionQueue: rest });
      } else {
        set({ team: newTeam, pendingEvolution: null });
      }
    } else {
      if (pendingEvolutionQueue.length > 0) {
        const [next, ...rest] = pendingEvolutionQueue;
        set({ pendingEvolution: next, pendingEvolutionQueue: rest });
      } else {
        set({ pendingEvolution: null });
      }
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

      const sourceItem = pendingMoveLearn.sourceItem;
      if (sourceItem) {
        const { inventory } = get();
        const currentQty = inventory.find(i => i.itemId === sourceItem)?.quantity || 0;
        if (currentQty > 0) {
          const newInventory = inventory
            .map(i => i.itemId === sourceItem ? { ...i, quantity: i.quantity - 1 } : i)
            .filter(i => i.quantity > 0);
          set({ inventory: newInventory });
        }
      }
    }

    const queue = get().pendingMoveQueue;
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      set({ team: newTeam, pendingMoveLearn: next, pendingMoveQueue: rest });
    } else {
      set({ team: newTeam, pendingMoveLearn: null });
    }
    get().saveGameState();
  },

  handleGameCleared: () => {
    const state = get();
    const newEvents = { ...state.progress.events, 'champion-defeated': true };
    set({
      currentView: 'world_map',
      progress: { ...state.progress, leagueProgress: 0, events: newEvents },
    });
    get().saveGameState();
  },

  // Save: fire-and-forget async write to IndexedDB
  saveGameState: () => {
    fireAndForgetSave(get());
  },

  // Load: async read from IndexedDB
  loadGameState: async () => {
    const data = await loadGame();
    if (!data) return false;

    // Migration for legacy PC (array)
    let pc: PCStorage = createPCStorage();
    if (Array.isArray(data.pc)) {
      (data.pc as any[]).forEach(p => {
        depositPokemon(pc, p);
      });
    } else if (data.pc) {
      pc = data.pc;
    }

    const progress = {
      ...data.progress,
      lastPokemonCenter: data.progress.lastPokemonCenter || 'bourg-palette',
      events: data.progress.events || {},
      currentFloors: data.progress.currentFloors || {},
    };

    set({
      currentView: 'world_map',
      player: data.player,
      team: data.team,
      pc,
      inventory: data.inventory,
      progress,
      selectedZone: null,
      pendingEvolution: null,
      pendingEvolutionQueue: [],
      pendingMoveLearn: null,
      pendingMoveQueue: [],
    });
    return true;
  },

  // Check if a save exists in IndexedDB
  checkForSave: async () => {
    const exists = await hasSave();
    set({ hasSaveLoaded: true });
    return exists;
  },
}));
