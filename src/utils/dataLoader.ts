import { PokemonData, MoveData } from '../types/pokemon';
import { RouteData, CityData, GymData, TrainerData, ItemData } from '../types/game';
import { PokemonType } from '../types/pokemon';

// Import all JSON data statically for Vite bundling
import gen1Pokemon from '../data/gen1/pokemon.json';
import gen1Moves from '../data/gen1/moves.json';
import gen1Routes from '../data/gen1/routes.json';
import gen1Trainers from '../data/gen1/trainers.json';
import gen1Gyms from '../data/gen1/gyms.json';
import pokeballs from '../data/items/pokeballs.json';
import potions from '../data/items/potions.json';
import typeChartData from '../data/typeChart.json';

// Type chart: attackType -> defenseType -> multiplier
export type TypeChart = Record<PokemonType, Record<PokemonType, number>>;

// Data registry - allows adding new generations dynamically
const pokemonRegistry = new Map<number, PokemonData>();
const moveRegistry = new Map<number, MoveData>();
const trainerRegistry = new Map<string, TrainerData>();
const zoneRegistry = new Map<string, RouteData | CityData>();
const gymRegistry = new Map<string, GymData>();
const itemRegistry = new Map<string, ItemData>();

let typeChart: TypeChart;

function registerPokemon(list: PokemonData[]) {
  for (const p of list) {
    pokemonRegistry.set(p.id, p);
  }
}

function registerMoves(list: MoveData[]) {
  for (const m of list) {
    moveRegistry.set(m.id, m);
  }
}

function registerTrainers(list: TrainerData[]) {
  for (const t of list) {
    trainerRegistry.set(t.id, t);
  }
}

function registerZones(list: Array<RouteData | CityData>) {
  for (const z of list) {
    zoneRegistry.set(z.id, z);
  }
}

function registerGyms(list: GymData[]) {
  for (const g of list) {
    gymRegistry.set(g.id, g);
  }
}

function registerItems(list: ItemData[]) {
  for (const i of list) {
    itemRegistry.set(i.id, i);
  }
}

export function initializeData(): void {
  registerPokemon(gen1Pokemon as PokemonData[]);
  registerMoves(gen1Moves as MoveData[]);
  registerTrainers(gen1Trainers as TrainerData[]);
  registerZones(gen1Routes as Array<RouteData | CityData>);
  registerGyms(gen1Gyms as GymData[]);
  registerItems(pokeballs as ItemData[]);
  registerItems(potions as ItemData[]);
  typeChart = typeChartData as TypeChart;
}

// Getters
export function getPokemonData(id: number): PokemonData {
  const data = pokemonRegistry.get(id);
  if (!data) throw new Error(`Pokemon ${id} not found`);
  return data;
}

export function getMoveData(id: number): MoveData {
  const data = moveRegistry.get(id);
  if (!data) throw new Error(`Move ${id} not found`);
  return data;
}

export function getTrainerData(id: string): TrainerData {
  const data = trainerRegistry.get(id);
  if (!data) throw new Error(`Trainer ${id} not found`);
  return data;
}

export function getZoneData(id: string): RouteData | CityData {
  const data = zoneRegistry.get(id);
  if (!data) throw new Error(`Zone ${id} not found`);
  return data;
}

export function getGymData(id: string): GymData {
  const data = gymRegistry.get(id);
  if (!data) throw new Error(`Gym ${id} not found`);
  return data;
}

export function getItemData(id: string): ItemData {
  const data = itemRegistry.get(id);
  if (!data) throw new Error(`Item ${id} not found`);
  return data;
}

export function getTypeChart(): TypeChart {
  return typeChart;
}

export function getAllZones(): Array<RouteData | CityData> {
  return Array.from(zoneRegistry.values());
}

export function getAllItems(): ItemData[] {
  return Array.from(itemRegistry.values());
}

export function getShopItems(): ItemData[] {
  return Array.from(itemRegistry.values()).filter(i => i.price > 0);
}

export function getTypeEffectiveness(attackType: PokemonType, defenseTypes: PokemonType[]): number {
  let multiplier = 1;
  for (const defType of defenseTypes) {
    const row = typeChart[attackType];
    if (row && row[defType] !== undefined) {
      multiplier *= row[defType];
    }
  }
  return multiplier;
}
