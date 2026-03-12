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
  safariState: SafariState | null;
  selectedZone: string | null;
  selectedPokemonIndex: number | null;

  // Pending actions
  pendingEvolution: { pokemonIndex: number; targetId: number } | null;
  pendingMoveLearn: { pokemonIndex: number; moveId: number; sourceItem?: string } | null;
  pendingMoveQueue: { pokemonIndex: number; moveId: number }[];

  // Actions
  initGame: () => void;
  startNewGame: (playerName: string, starterId: number) => void;
  setView: (view: GameView) => void;
  selectZone: (zoneId: string) => void;
  startSafari: () => void;
  quitSafari: () => void;

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
  decrementRepelSteps: () => void;
  setRepelSteps: (steps: number) => void;
  triggerEvent: (eventId: string) => void;

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
    repelSteps: 0,
    lastPokemonCenter: 'bourg-palette',
    events: {},
  },
  safariState: null,
  selectedZone: null,
  selectedPokemonIndex: null,
  pendingEvolution: null,
  pendingMoveLearn: null,
  pendingMoveQueue: [],

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
      },
      selectedZone: null,
      pendingEvolution: null,
      pendingMoveLearn: null,
      pendingMoveQueue: [],
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

    // Field items
    if (itemData.effect?.type === 'repel') {
      get().setRepelSteps(itemData.effect.repelSteps || 100);
      get().removeItem(itemId, 1);
      return { success: true, message: "Les Pokémon sauvages seront repoussés." };
    }

    if (itemData.effect?.type === 'escape_rope') {
      get().selectZone('bourg-palette'); // Teleport to home for now
      get().removeItem(itemId, 1);
      return { success: true, message: "Vous utilisez la Corde Sortie." };
    }

    if (itemData.effect?.type === 'teach' && itemData.effect.moveId) {
      const idx = state.team.findIndex(p => p.uid === pokemonUid);
      const pokemon = state.team[idx]; // Use team index via uid
      if (!pokemon) return { success: false, message: "Utiliser sur qui ?" };

      const moveId = itemData.effect.moveId;
      const moveData = getMoveData(moveId);

      // Check if already known
      if (pokemon.moves.some(m => m.moveId === moveId)) {
        return { success: false, message: `${pokemon.nickname || getPokemonData(pokemon.dataId).name} connait déjà ${moveData.name} !` };
      }

      // Check move count
      if (pokemon.moves.length < 4) {
        // Learn immediately
        pokemon.moves.push({
          moveId,
          currentPp: moveData.pp,
          maxPp: moveData.pp
        });

        const name = pokemon.nickname || getPokemonData(pokemon.dataId).name;
        get().removeItem(itemId, 1);
        // Force update
        set({ team: [...state.team] });
        return { success: true, message: `${name} apprend ${moveData.name} !` };
      } else {
        // Needs to forget a move
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

    // If item requires a target
    const requiresTarget = ['heal', 'status', 'status_cure', 'revive', 'evolution', 'boost'].includes(itemData.effect?.type || '');

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

    // Check if this unlocks new zones - iterate ALL zones
    const allZones = getAllZones();
    // We might need multiple passes if unlocking one zone unlocks another immediately (cascade)
    // For now, simple pass. If cascade is needed, we'd loop until no changes.
    // Actually, one pass is usually enough per action in this simple logic.

    // Optimization: we can't just check neighbors of current zone because 
    // "unlocking a zone" might happen ANYWHERE if conditions are met.
    // BUT, we only want to unlock if it connects to something we HAVE.

    for (const zone of allZones) {
      const zoneId = zone.id;
      if (newProgress.unlockedZones.includes(zoneId)) continue;

      // connectivity check
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

        // Check Event/Item Locks
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

    // Re-check zone unlocks for ALL zones
    const newProgress = { ...get().progress };
    const allZonesData = getAllZones();

    for (const zone of allZonesData) {
      const zoneId = zone.id;
      if (newProgress.unlockedZones.includes(zoneId)) continue;

      // connectivity check
      const isConnected = zone.connectedZones.some(z => newProgress.unlockedZones.includes(z));
      if (!isConnected) continue;

      try {
        const condition = (zone as any).unlockCondition;
        if (!condition) {
          newProgress.unlockedZones.push(zoneId);
          continue;
        }

        // Check Event/Item Locks
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

  triggerEvent: (eventId: string) => {
    const state = get();
    const newEvents = { ...state.progress.events, [eventId]: true };
    const newProgress = { ...state.progress, events: newEvents };

    // Trigger zone unlocks after event completion
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
        }
      } catch { }
    }

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

      // Handle move learning - process all learnable moves
      if (result.learnableMoves.length > 0) {
        const movesToQueue: { pokemonIndex: number; moveId: number }[] = [];
        for (const moveId of result.learnableMoves) {
          // Skip if already known
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
          // Set first as pendingMoveLearn, rest go to queue
          set({
            pendingMoveLearn: movesToQueue[0],
            pendingMoveQueue: [...existing, ...movesToQueue.slice(1)],
          });
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

  startSafari: () => {
    const state = get();
    if (state.player.money < 500) return;
    state.spendMoney(500);
    set({
      safariState: { steps: 30, balls: 30 }, // 30 "actions" or steps? Plan said 30 actions. 
      // Steps usually 500. But for this text-based/click-based movement, maybe 30 actions (search) is better?
      // "Search" action decrements steps.
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

      // Consume TM if applicable
      if (pendingMoveLearn.sourceItem) {
        const { inventory } = get();
        const currentQty = inventory.find(i => i.itemId === pendingMoveLearn.sourceItem)?.quantity || 0;
        if (currentQty > 0) {
          // We need to decrease quantity. 
          // NOTE: We can't call set() inside this function easily without recreating the inventory array properly.
          // But we can reuse the logic or just map it.
          const newInventory = inventory
            .map(i => i.itemId === pendingMoveLearn.sourceItem ? { ...i, quantity: i.quantity - 1 } : i)
            .filter(i => i.quantity > 0);
          set({ inventory: newInventory });
        }
      }
    }
    // If forgetIndex is null, the move is not learned (and TM is not consumed)

    // Check if there are more moves in the queue
    const queue = get().pendingMoveQueue;
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      set({ team: newTeam, pendingMoveLearn: next, pendingMoveQueue: rest });
    } else {
      set({ team: newTeam, pendingMoveLearn: null });
    }
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

    // Migration: add lastPokemonCenter and events if missing
    const progress = {
      ...data.progress,
      lastPokemonCenter: data.progress.lastPokemonCenter || 'bourg-palette',
      events: data.progress.events || {},
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
      pendingMoveLearn: null,
      pendingMoveQueue: [],
    });
    return true;
  },

  hasSaveData: () => hasSave(),
}));
