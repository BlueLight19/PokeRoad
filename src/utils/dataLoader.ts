import { PokemonData, MoveData } from '../types/pokemon';
import { RouteData, CityData, GymData, TrainerData, WildEncounter } from '../types/game';
import { ItemData } from '../types/inventory';
import { PokemonType } from '../types/pokemon';
import {
  getAllFromStore,
  getAllFromIndex,
  DBPokemon,
  DBMove,
  DBLearnsetEntry,
  DBItem,
  DBZone,
  DBWildEncounter,
  DBGym,
  DBTrainer,
} from './db';

// Type chart: attackType -> defenseType -> multiplier
export type TypeChart = Record<PokemonType, Record<PokemonType, number>>;

// Data registry — populated from IndexedDB on init
const pokemonRegistry = new Map<number, PokemonData>();
const moveRegistry = new Map<number, MoveData>();
const trainerRegistry = new Map<string, TrainerData>();
const zoneRegistry = new Map<string, RouteData | CityData>();
const gymRegistry = new Map<string, GymData>();
const itemRegistry = new Map<string, ItemData>();

let typeChart: TypeChart;

// ——————————————————————————————————————————————
// Conversion: DB format → Game types
// ——————————————————————————————————————————————

function convertPokemon(raw: DBPokemon, learnset: DBLearnsetEntry[]): PokemonData {
  return {
    id: raw.id,
    name: raw.name,
    generation: raw.generation,
    types: raw.types as PokemonType[],
    baseStats: raw.base_stats,
    learnset: learnset
      .sort((a, b) => a.level - b.level)
      .map(e => ({ level: e.level, moveId: e.move_id })),
    evolutions: (raw.evolutions || []).map(e => ({
      method: e.method as 'level' | 'stone' | 'trade',
      level: e.level,
      stone: e.condition,
      evolvesInto: e.to,
    })),
    catchRate: raw.catch_rate,
    expGroup: raw.exp_group as PokemonData['expGroup'],
    baseExp: raw.base_exp,
    evYield: raw.ev_yield as Partial<PokemonData['baseStats']>,
    spriteUrl: raw.sprite_url,
    tmLearnset: raw.tm_learnset ?? undefined,
  };
}

function convertMove(raw: DBMove): MoveData {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type as PokemonType,
    category: raw.category as MoveData['category'],
    power: raw.power,
    accuracy: raw.accuracy,
    pp: raw.pp,
    priority: raw.priority,
    target: (raw as any).target as MoveData['target'] ?? 'enemy',
    effect: raw.effect as MoveData['effect'],
  };
}

function convertItem(raw: DBItem): ItemData {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    category: raw.category as ItemData['category'],
    price: raw.price,
    sprite: raw.sprite ?? undefined,
    usableInBattle: raw.usable_in_battle,
    usableOutside: raw.usable_outside,
    effect: raw.effect as any as ItemData['effect'],
  };
}

function convertTrainer(raw: DBTrainer): TrainerData {
  return {
    id: raw.id,
    name: raw.name,
    trainerClass: raw.trainer_class,
    reward: raw.reward,
    zone: raw.zone_id,
    category: raw.category || 'route',
    team: (raw.team || []).map(t => ({
      pokemonId: t.pokemonId,
      level: t.level,
      moves: t.moves,
    })),
  };
}

function convertGym(raw: DBGym): GymData {
  return {
    id: raw.id,
    city: raw.zone_id,
    leader: raw.leader,
    badge: raw.badge,
    reward: raw.reward ?? 0,
    team: (raw.team || []).map(t => ({
      pokemonId: t.pokemonId,
      level: t.level,
      moves: t.moves,
    })),
    unlockCondition: null,
  };
}

function convertWildEncounter(raw: DBWildEncounter): WildEncounter {
  return {
    pokemonId: raw.pokemon_id,
    minLevel: raw.min_level,
    maxLevel: raw.max_level,
    rate: raw.rate,
  };
}

function convertZone(
  raw: DBZone,
  encounters: DBWildEncounter[],
  trainerIds: string[]
): RouteData | CityData {
  const grassEncounters = encounters
    .filter(e => e.encounter_type === 'grass' || e.encounter_type === 'cave')
    .map(convertWildEncounter);
  const waterEnc = encounters
    .filter(e => e.encounter_type === 'water')
    .map(convertWildEncounter);
  const fishingEnc = encounters
    .filter(e => e.encounter_type === 'fishing')
    .map(convertWildEncounter);

  const npcs = (raw.npcs || []).map((npc: Record<string, unknown>) => ({
    id: npc.id as string,
    name: npc.name as string,
    dialogue: (npc.dialogue as string[]) || [],
    givesItem: npc.givesItem as string | undefined,
    givesPokemon: npc.givesPokemon as { pokemonId: number; level: number } | undefined,
    requiredEvent: npc.requiredEvent as string | undefined,
    setsEvent: npc.setsEvent as string | undefined,
  }));

  const unlockCondition = raw.unlock_condition
    ? (raw.unlock_condition as any as RouteData['unlockCondition'])
    : null;

  const connectedZones = raw.connected_zones || [];

  if (raw.type === 'city' || raw.type === 'building') {
    const city: CityData = {
      id: raw.id,
      type: raw.type === 'building' ? 'dungeon' : 'city',
      name: raw.name,
      region: raw.region,
      generation: raw.generation,
      hasShop: raw.has_shop,
      hasCenter: raw.has_center,
      gymId: raw.gym_id ?? undefined,
      trainers: trainerIds.length > 0 ? trainerIds : undefined,
      shopItems: raw.shop_items ?? undefined,
      wildEncounters: grassEncounters.length > 0 ? grassEncounters : undefined,
      waterEncounters: waterEnc.length > 0 ? waterEnc : undefined,
      fishingEncounters: fishingEnc.length > 0 ? fishingEnc : undefined,
      npcs: npcs.length > 0 ? npcs : undefined,
      connectedZones,
      unlockCondition: unlockCondition ?? undefined,
    };
    return city;
  }

  // route, cave, special, etc.
  const route: RouteData = {
    id: raw.id,
    type: 'route',
    name: raw.name,
    region: raw.region,
    generation: raw.generation,
    unlockCondition,
    wildEncounters: grassEncounters,
    waterEncounters: waterEnc.length > 0 ? waterEnc : undefined,
    fishingEncounters: fishingEnc.length > 0 ? fishingEnc : undefined,
    npcs: npcs.length > 0 ? npcs : undefined,
    trainers: trainerIds,
    connectedZones,
  };
  return route;
}

// ——————————————————————————————————————————————
// Build type chart from moves/pokemon data
// We need typeChart data — it's not in a Supabase table,
// so we keep the static import as fallback, or store it in IDB.
// For now, import the static typeChart JSON.
// ——————————————————————————————————————————————
import typeChartData from '../data/typeChart.json';

// ——————————————————————————————————————————————
// initializeData: async, loads from IndexedDB → registries
// ——————————————————————————————————————————————

export async function initializeData(): Promise<void> {
  // Clear registries
  pokemonRegistry.clear();
  moveRegistry.clear();
  trainerRegistry.clear();
  zoneRegistry.clear();
  gymRegistry.clear();
  itemRegistry.clear();

  // Load all data from IndexedDB in parallel
  const [
    rawPokemon,
    rawMoves,
    rawLearnset,
    rawItems,
    rawZones,
    rawEncounters,
    rawGyms,
    rawTrainers,
  ] = await Promise.all([
    getAllFromStore('pokemon'),
    getAllFromStore('moves'),
    getAllFromStore('pokemon_learnset'),
    getAllFromStore('items'),
    getAllFromStore('zones'),
    getAllFromStore('wild_encounters'),
    getAllFromStore('gyms'),
    getAllFromStore('trainers'),
  ]);

  // Group learnset by pokemon_id
  const learnsetMap = new Map<number, DBLearnsetEntry[]>();
  for (const entry of rawLearnset as DBLearnsetEntry[]) {
    const list = learnsetMap.get(entry.pokemon_id) || [];
    list.push(entry);
    learnsetMap.set(entry.pokemon_id, list);
  }

  // Register Pokemon
  for (const raw of rawPokemon as DBPokemon[]) {
    const learnset = learnsetMap.get(raw.id) || [];
    pokemonRegistry.set(raw.id, convertPokemon(raw, learnset));
  }

  // Register Moves
  for (const raw of rawMoves as DBMove[]) {
    moveRegistry.set(raw.id, convertMove(raw));
  }

  // Register Items
  for (const raw of rawItems as DBItem[]) {
    itemRegistry.set(raw.id, convertItem(raw));
  }

  // Register Gyms
  for (const raw of rawGyms as DBGym[]) {
    gymRegistry.set(raw.id, convertGym(raw));
  }

  // Group encounters by zone_id
  const encounterMap = new Map<string, DBWildEncounter[]>();
  for (const enc of rawEncounters as DBWildEncounter[]) {
    const list = encounterMap.get(enc.zone_id) || [];
    list.push(enc);
    encounterMap.set(enc.zone_id, list);
  }

  const allTrainers = rawTrainers as DBTrainer[];

  // Register all trainers and group by zone_id
  const trainersByZone = new Map<string, string[]>();
  for (const t of allTrainers) {
    const converted = convertTrainer(t);

    // Auto-detect Elite 4
    if (t.id.startsWith('league-') || t.id.startsWith('elite-') || t.id.startsWith('conseil-')) {
      converted.category = 'elite4';
    }

    trainerRegistry.set(t.id, converted);

    const cat = converted.category;

    // Elite 4 never shown in zones
    if (cat === 'elite4') continue;

    // Regular zone trainers (route + rival + gym trainers)
    const list = trainersByZone.get(t.zone_id) || [];
    list.push(t.id);
    trainersByZone.set(t.zone_id, list);
  }

  // Register Zones
  for (const raw of rawZones as DBZone[]) {
    const encounters = encounterMap.get(raw.id) || [];
    const trainerIds = trainersByZone.get(raw.id) || [];
    zoneRegistry.set(raw.id, convertZone(raw, encounters, trainerIds));
  }

  // --- HARDCODED PATCHES (Overrides until Supabase is updated) ---
  const route2 = zoneRegistry.get('route-2');
  if (route2) {
    route2.unlockCondition = { type: 'trainers', zones: ['route-1'] };
  }

  const viridianGym = gymRegistry.get('viridian-gym');
  if (viridianGym) {
    viridianGym.unlockCondition = { type: 'gym', gymId: 'cinnabar-gym' };
  }
  
  const foretJade = zoneRegistry.get('foret-jade');
  if (foretJade) {
    foretJade.unlockCondition = null; // Route 2 a pas de dresseurs dans la DB pour l'instant
  }
  // ---------------------------------------------------------------

  // Type chart (static — not in Supabase)
  typeChart = typeChartData as TypeChart;

  // Validation & debug
  console.log(`[dataLoader] Registries loaded: ${pokemonRegistry.size} pokemon, ${moveRegistry.size} moves, ${itemRegistry.size} items, ${zoneRegistry.size} zones, ${gymRegistry.size} gyms, ${trainerRegistry.size} trainers`);
  for (const [zoneId, zone] of zoneRegistry) {
    const trainers = (zone as any).trainers;
    if (trainers && trainers.length > 0) {
      console.log(`[dataLoader] zone "${zoneId}" trainers:`, trainers);
    }
    if ((zone as any).gymId) {
      console.log(`[dataLoader] zone "${zoneId}" has gymId:`, (zone as any).gymId);
    }
  }

  if (pokemonRegistry.size === 0) {
    throw new Error(
      'Aucun Pokémon chargé depuis IndexedDB. ' +
      'Vérifiez que les tables Supabase sont remplies et que le RLS autorise la lecture (anon SELECT).'
    );
  }
}

// ——————————————————————————————————————————————
// Synchronous getters (unchanged API)
// ——————————————————————————————————————————————

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

// Get zone trainers filtered by category and rival starter logic
export function getZoneTrainers(zoneId: string, playerStarter: number | null): TrainerData[] {
  const zone = zoneRegistry.get(zoneId);
  if (!zone) return [];

  const trainerIds: string[] = (zone as any).trainers || [];

  return trainerIds
    .map(id => trainerRegistry.get(id))
    .filter((t): t is TrainerData => {
      if (!t) return false;
      // For rivals: only show the variant matching the player's starter
      if (t.category === 'rival' && playerStarter !== null) {
        return isRivalMatchingStarter(t, playerStarter);
      }
      return true;
    });
}

// Determine which rival variant matches the player's starter choice
// Player picks 1 (Bulbasaur) → rival has 4 (Charmander) as final pokemon
// Player picks 4 (Charmander) → rival has 7 (Squirtle)
// Player picks 7 (Squirtle)   → rival has 1 (Bulbasaur)
const RIVAL_STARTER_MAP: Record<number, number[]> = {
  1: [4, 5, 6],     // Player Bulbasaur → rival Charmander line
  4: [7, 8, 9],     // Player Charmander → rival Squirtle line
  7: [1, 2, 3],     // Player Squirtle → rival Bulbasaur line
};

function isRivalMatchingStarter(trainer: TrainerData, playerStarter: number): boolean {
  const rivalLine = RIVAL_STARTER_MAP[playerStarter];
  if (!rivalLine) return true; // Unknown starter, show all

  // Check if any pokemon in the rival's team is from the expected starter line
  return trainer.team.some(p => rivalLine.includes(p.pokemonId));
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

export function getAllPokemon(): PokemonData[] {
  return Array.from(pokemonRegistry.values());
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

export function getCityShopItems(cityId: string): ItemData[] {
  const city = getZoneData(cityId) as CityData;
  if (!city.hasShop || !city.shopItems) return [];

  return city.shopItems.map(itemId => {
    try {
      return getItemData(itemId);
    } catch {
      return null;
    }
  }).filter((i): i is ItemData => i !== null);
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
