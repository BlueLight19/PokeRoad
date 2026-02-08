import { PokemonInstance } from './pokemon';

// ===== World / Navigation =====

export interface RouteData {
  id: string;
  name: string;
  region: string;
  generation: number;
  unlockCondition: UnlockCondition | null;
  wildEncounters: WildEncounter[];
  trainers: string[];
  connectedZones: string[];
}

export interface WildEncounter {
  pokemonId: number;
  minLevel: number;
  maxLevel: number;
  rate: number;
}

export interface CityData {
  id: string;
  name: string;
  region: string;
  generation: number;
  hasShop: boolean;
  gymId: string | null;
  connectedZones: string[];
  unlockCondition: UnlockCondition | null;
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
}

export interface TrainerPokemon {
  pokemonId: number;
  level: number;
  moves: number[];
}

export interface UnlockCondition {
  type: 'trainers' | 'badge' | 'gym';
  defeatedTrainers?: string[];
  badge?: string;
  gymId?: string;
  zones?: string[];
}

// ===== Items =====

export interface ItemData {
  id: string;
  name: string;
  category: 'pokeball' | 'potion' | 'status_heal' | 'revive' | 'evolution_stone' | 'misc';
  price: number;
  description: string;
  effect: ItemEffect;
  usableInBattle: boolean;
  usableOutside: boolean;
}

export interface ItemEffect {
  type: 'heal' | 'catch' | 'status_cure' | 'revive' | 'evolve' | 'pp_restore';
  healAmount?: number;
  healFull?: boolean;
  catchMultiplier?: number;
  curesStatus?: string[];
  reviveHpPercent?: number;
  stone?: string;
  ppAmount?: number;
}

export interface InventoryItem {
  itemId: string;
  quantity: number;
}

// ===== Save Data =====

export interface SaveData {
  version: string;
  timestamp: number;
  player: PlayerData;
  team: PokemonInstance[];
  pc: PokemonInstance[];
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
  | 'summary'
  | 'move_learn';

export interface GameContext {
  currentView: GameView;
  selectedZone: string | null;
  selectedPokemonIndex: number | null;
}
