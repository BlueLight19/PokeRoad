import { PokemonInstance } from './pokemon';
import { PCStorage } from '../engine/pcStorage';
import { InventoryItem } from './inventory';

// ===== World / Navigation =====

export interface RouteData {
  id: string;
  type: 'route';
  name: string;
  region: string;
  generation: number;
  unlockCondition: UnlockCondition | null;
  wildEncounters: WildEncounter[];
  waterEncounters?: WildEncounter[];
  fishingEncounters?: WildEncounter[];
  staticEncounters?: StaticEncounter[];
  npcs?: NPCData[];
  trainers: string[];
  connectedZones: string[];
}

export interface WildEncounter {
  pokemonId: number;
  minLevel: number;
  maxLevel: number;
  rate: number;
  floor?: number;
}

export interface StaticEncounter {
  id: string; // Unique ID for the encounter (e.g. snorlax_route12, mewtwo)
  pokemonId: number;
  level: number;
  name: string; // Display name on map (e.g. "Ronflex endormi")
  requiredItem?: string; // e.g. "poke-flute"
  isGift?: boolean; // If true, adds directly to team/PC without combat
  dialogue?: string; // Text shown before encounter
}

export interface NPCData {
  id: string;
  name: string;
  dialogue: string[]; // Sequential dialogue or just random strings, can just be one string.
  givesItem?: string;
  givesPokemon?: {
    pokemonId: number;
    level: number;
  };
  requiredEvent?: string; // E.g., must have 'badge-foudre' to appear
  setsEvent?: string; // E.g., 'received-bike-voucher'
}

export interface CityData {
  id: string;
  type: 'city' | 'dungeon';
  name: string;
  region: string;
  generation: number;
  hasShop: boolean;
  hasCenter: boolean;
  gymId?: string; // ID of the gym leader
  trainers?: string[]; // IDs of trainers in the city (e.g. Rival)
  shopItems?: string[]; // IDs of items sold in this city's Poke Mart
  wildEncounters?: WildEncounter[]; // Surfing/Fishing/Safari?
  waterEncounters?: WildEncounter[];
  fishingEncounters?: WildEncounter[];
  staticEncounters?: StaticEncounter[];
  npcs?: NPCData[];
  connectedZones: string[];
  unlockCondition?: UnlockCondition;
  totalFloors?: number;
}

export interface GymData {
  id: string;
  city: string;
  leader: string;
  badge: string;
  reward: number;
  team: GymPokemon[];
  unlockCondition: UnlockCondition | null;
}

export interface GymPokemon {
  pokemonId: number;
  level: number;
  moves: number[];
}

export interface TrainerData {
  id: string;
  name: string;
  trainerClass: string;
  reward: number;
  team: TrainerPokemon[];
  zone: string;
  category: string; // 'route' | 'gym' | 'rival' | 'elite4'
  floor: number;
}

export interface TrainerPokemon {
  pokemonId: number;
  level: number;
  moves: number[];
}

export interface UnlockCondition {
  type: 'trainers' | 'badge' | 'gym' | 'item' | 'event';
  defeatedTrainers?: string[];
  badge?: string;
  gymId?: string;
  zones?: string[];
  itemId?: string; // Require a specific item in absolute inventory (e.g. silph-scope)
  eventId?: string; // Require a specific story event flag
}

// ===== Save Data =====

export interface SaveData {
  version: string;
  timestamp: number;
  player: PlayerData;
  team: PokemonInstance[];
  pc: PCStorage;
  inventory: InventoryItem[];
  progress: ProgressData;
}

export interface PlayerData {
  name: string;
  money: number;
  badges: string[];
  playTime: number;
  starter: number | null;
}

export interface ProgressData {
  defeatedTrainers: string[];
  unlockedZones: string[];
  currentZone: string;
  caughtPokemon: number[];
  seenPokemon: number[];
  leagueProgress: number; // 0=None, 1=Lorelei, 2=Bruno, 3=Agatha, 4=Lance, 5=Champion
  repelSteps: number;
  lastPokemonCenter: string;
  events: Record<string, boolean>; // Tracks completed story events and caught/defeated static encounters
  currentFloors: Record<string, number>; // zoneId -> current floor (1-based)
}

export interface SafariState {
  steps: number;
  balls: number;
}

// ===== Game View =====

export type GameView =
  | 'title'
  | 'starter_select'
  | 'world_map'
  | 'route_menu'
  | 'city_menu'
  | 'battle'
  | 'team'
  | 'pc'
  | 'shop'
  | 'inventory'
  | 'pokedex'
  | 'summary'
  | 'move_learn'
  | 'league'
  | 'hall_of_fame';

export interface GameContext {
  currentView: GameView;
  selectedZone: string | null;
  selectedPokemonIndex: number | null;
}
