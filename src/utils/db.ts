// db.ts — IndexedDB module with Supabase sync
// Uses 'idb' (Promise wrapper around IndexedDB) and Supabase client

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { supabase } from './supabaseClient';

const DB_NAME = 'pokemon_game_db';
const DB_VERSION = 1;
const SYNC_KEY = 'last_sync_timestamp';
// Bump this to force a re-sync on next app load (bypasses IndexedDB cache)
const LOCAL_DATA_VERSION = '0.4.0';

// ——————————————————————————————————————————————
// 1. Raw DB types (snake_case, matching Supabase columns)
// ——————————————————————————————————————————————

export interface DBPokemon {
  id: number;
  name: string;
  generation: number;
  types: string[];
  base_stats: { hp: number; attack: number; defense: number; spAtk: number; spDef: number; speed: number };
  catch_rate: number;
  exp_group: string;
  base_exp: number;
  ev_yield: Record<string, number>;
  tm_learnset: number[] | null;
  sprite_url: string;
  shiny_sprite_url?: string;
  evolutions: Array<{ to: number; level?: number; method: string; condition?: string }>;
  abilities: string[];
}

export interface DBMove {
  id: number;
  name: string;
  type: string;
  category: string;
  power: number | null;
  accuracy: number | null;
  pp: number;
  priority: number;
  target?: string;
  effect: Record<string, unknown> | null;
  description?: string;
}

export interface DBLearnsetEntry {
  id?: number; // auto-increment
  pokemon_id: number;
  move_id: number;
  level: number;
}

export interface DBItem {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  usable_in_battle: boolean;
  usable_outside: boolean;
  effect: Record<string, unknown> | null;
  sprite: string | null;
}

export interface DBZone {
  id: string;
  type: string;
  name: string;
  region: string;
  generation: number;
  has_shop: boolean;
  has_center: boolean;
  gym_id: string | null;
  connected_zones: string[];
  unlock_condition: Record<string, unknown> | null;
  npcs: Array<Record<string, unknown>> | null;
  shop_items?: string[];
  total_floors?: number;
}

export interface DBWildEncounter {
  id: number;
  zone_id: string;
  pokemon_id: number;
  min_level: number;
  max_level: number;
  rate: number;
  encounter_type: string;
  floor?: number | null;
}

export interface DBGym {
  id: string;
  name: string;
  leader: string;
  type?: string;
  badge: string;
  order: number;
  zone_id: string;
  team?: Array<{ pokemonId: number; level: number; moves: number[] }>;
  reward?: number;
}

export interface DBTrainer {
  id: string;
  name: string;
  trainer_class: string;
  reward: number;
  zone_id: string;
  team: Array<{ pokemonId: number; level: number; moves: number[] }>;
  category?: string; // 'route' | 'gym' | 'rival' | 'elite4'
  floor?: number;
  require_condition?: { type: string; value: string; label?: string } | null;
}

// Player stores
export interface DBPlayerTeamEntry {
  slot: number;
  data: Record<string, unknown>; // Serialized PokemonInstance
}

export interface DBPlayerInventoryEntry {
  item_id: string;
  quantity: number;
  category: string;
}

export interface DBProgressEntry {
  key: string;
  value: unknown;
}

export interface DBPokedexEntry {
  pokemon_id: number;
  seen: boolean;
  caught: boolean;
  caught_count: number;
}

// ——————————————————————————————————————————————
// 2. IndexedDB Schema
// ——————————————————————————————————————————————

interface GameDB extends DBSchema {
  pokemon: { key: number; value: DBPokemon };
  moves: { key: number; value: DBMove };
  pokemon_learnset: {
    key: number;
    value: DBLearnsetEntry;
    indexes: { 'pokemon_id': number };
  };
  items: {
    key: string;
    value: DBItem;
    indexes: { 'category': string };
  };
  zones: {
    key: string;
    value: DBZone;
    indexes: { 'region': string };
  };
  wild_encounters: {
    key: number;
    value: DBWildEncounter;
    indexes: { 'zone_id': string };
  };
  gyms: {
    key: string;
    value: DBGym;
    indexes: { 'order': number };
  };
  trainers: {
    key: string;
    value: DBTrainer;
    indexes: { 'zone_id': string };
  };
  // Player stores (local only)
  player_team: { key: number; value: DBPlayerTeamEntry };
  player_inventory: {
    key: string;
    value: DBPlayerInventoryEntry;
    indexes: { 'category': string };
  };
  player_progress: { key: string; value: DBProgressEntry };
  player_pokedex: { key: number; value: DBPokedexEntry };
}

// ——————————————————————————————————————————————
// 3. Open / Create database
// ——————————————————————————————————————————————

let dbInstance: IDBPDatabase<GameDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<GameDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<GameDB>(DB_NAME, DB_VERSION, {
    upgrade(db: IDBPDatabase<GameDB>) {
      // Game Data stores (synced from Supabase)
      db.createObjectStore('pokemon', { keyPath: 'id' });
      db.createObjectStore('moves', { keyPath: 'id' });

      const ls = db.createObjectStore('pokemon_learnset', { autoIncrement: true });
      ls.createIndex('pokemon_id', 'pokemon_id');

      const items = db.createObjectStore('items', { keyPath: 'id' });
      items.createIndex('category', 'category');

      const zones = db.createObjectStore('zones', { keyPath: 'id' });
      zones.createIndex('region', 'region');

      const we = db.createObjectStore('wild_encounters', { keyPath: 'id' });
      we.createIndex('zone_id', 'zone_id');

      const gyms = db.createObjectStore('gyms', { keyPath: 'id' });
      gyms.createIndex('order', 'order');

      const tr = db.createObjectStore('trainers', { keyPath: 'id' });
      tr.createIndex('zone_id', 'zone_id');

      // Player Data stores (local only)
      db.createObjectStore('player_team', { keyPath: 'slot' });

      const pi = db.createObjectStore('player_inventory', { keyPath: 'item_id' });
      pi.createIndex('category', 'category');

      db.createObjectStore('player_progress', { keyPath: 'key' });
      db.createObjectStore('player_pokedex', { keyPath: 'pokemon_id' });
    },
  });

  return dbInstance;
}

// ——————————————————————————————————————————————
// 4. JSON column parsing
// ——————————————————————————————————————————————

const JSON_COLUMNS: Record<string, string[]> = {
  pokemon: ['types', 'base_stats', 'ev_yield', 'tm_learnset', 'evolutions'],
  items: ['effect'],
  zones: ['connected_zones', 'unlock_condition', 'npcs', 'shop_items'],
  trainers: ['team'],
  moves: ['effect'],
  gyms: ['team'],
};

function parseJsonCols(row: Record<string, unknown>, table: string): Record<string, unknown> {
  const cols = JSON_COLUMNS[table] ?? [];
  for (const col of cols) {
    if (typeof row[col] === 'string') {
      try {
        row[col] = JSON.parse(row[col] as string);
      } catch {
        // already parsed or invalid
      }
    }
  }
  return row;
}

// ——————————————————————————————————————————————
// 5. Sync from Supabase
// ——————————————————————————————————————————————

const GAME_TABLES = [
  'pokemon', 'moves', 'pokemon_learnset', 'items',
  'zones', 'wild_encounters', 'gyms',
  'trainers',
] as const;

async function fetchAllRows(table: string): Promise<any[]> {
  let allData: any[] = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + step - 1);

    if (error) throw error;
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = [...allData, ...data];
      if (data.length < step) {
        hasMore = false;
      } else {
        from += step;
      }
    }
  }
  return allData;
}

export async function syncFromSupabase(
  onProgress?: (table: string, pct: number) => void
): Promise<void> {
  const db = await getDB();
  const total = GAME_TABLES.length;

  for (let i = 0; i < total; i++) {
    const table = GAME_TABLES[i];
    onProgress?.(table, ((i) / total) * 100);

    // Fetch all rows from Supabase (with pagination)
    const data = await fetchAllRows(table);

    if (!data || data.length === 0) {
      console.warn(`[sync] Table "${table}" returned 0 rows. Check RLS policies or table data.`);
    } else {
      console.log(`[sync] ${table}: ${data.length} rows`);
    }

    // Parse JSON columns
    const parsed = (data || []).map((row: any) => parseJsonCols(row, table));

    // Write to IndexedDB in a single transaction
    const tx = db.transaction(table, 'readwrite');
    await tx.store.clear();
    for (const row of parsed) {
      await tx.store.put(row as never);
    }
    await tx.done;
  }

  // Validate that critical data was actually synced
  const pokemonCount = await db.count('pokemon');
  const moveCount = await db.count('moves');
  const itemCount = await db.count('items');
  const zoneCount = await db.count('zones');

  if (pokemonCount === 0) {
    throw new Error(
      'Sync terminée mais 0 Pokémon récupérés. Vérifiez les policies RLS (anon SELECT) sur toutes les tables.'
    );
  }
  if (moveCount === 0) {
    throw new Error(
      'Sync terminée mais 0 Attaque récupérée. Vérifiez la table "moves" et les policies RLS.'
    );
  }
  if (itemCount === 0) {
    throw new Error(
      'Sync terminée mais 0 Objet récupéré. Vérifiez la table "items" et les policies RLS.'
    );
  }
  if (zoneCount === 0) {
    throw new Error(
      'Sync terminée mais 0 Zone récupérée. Vérifiez la table "zones" et les policies RLS.'
    );
  }

  // Mark sync timestamp only if data is valid
  const pdb = db.transaction('player_progress', 'readwrite');
  await pdb.store.put({ key: SYNC_KEY, value: Date.now() });
  await pdb.done;

  onProgress?.('done', 100);
}

// ——————————————————————————————————————————————
// 6. Init: check freshness & sync if needed
// ——————————————————————————————————————————————

export async function initGameData(
  onProgress?: (t: string, p: number) => void
): Promise<void> {
  const db = await getDB();

  // Check if we already synced
  const syncEntry = await db.get('player_progress', SYNC_KEY);

  if (!syncEntry) {
    // First launch: full sync
    await syncFromSupabase(onProgress);
    await db.put('player_progress', { key: 'data_version', value: LOCAL_DATA_VERSION });
    return;
  }

  // Check local code version — forces re-sync when LOCAL_DATA_VERSION is bumped
  const localVersion = await db.get('player_progress', 'data_version');
  if ((localVersion as DBProgressEntry | undefined)?.value !== LOCAL_DATA_VERSION) {
    console.log(`[sync] Local version mismatch (${(localVersion as DBProgressEntry | undefined)?.value} → ${LOCAL_DATA_VERSION}), re-syncing...`);
    await syncFromSupabase(onProgress);
    await db.put('player_progress', { key: 'data_version', value: LOCAL_DATA_VERSION });
    return;
  }

  // Also check remote version for hot Supabase updates
  try {
    const { data } = await supabase
      .from('game_meta')
      .select('value')
      .eq('key', 'data_version')
      .single();

    if (data?.value && data.value !== LOCAL_DATA_VERSION) {
      console.log(`[sync] Remote version ${data.value} differs, re-syncing...`);
      await syncFromSupabase(onProgress);
      await db.put('player_progress', { key: 'data_version', value: data.value });
    }
  } catch {
    // game_meta table might not exist — not critical since local version check covers it
    console.warn('[sync] game_meta check failed');
  }
}

// ——————————————————————————————————————————————
// 7. Game Data readers (from IndexedDB)
// ——————————————————————————————————————————————

export async function getAllFromStore<T extends keyof GameDB>(
  storeName: T
): Promise<GameDB[T]['value'][]> {
  const db = await getDB();
  return db.getAll(storeName as any);
}

export async function getFromStore<T extends keyof GameDB>(
  storeName: T,
  key: GameDB[T]['key']
): Promise<GameDB[T]['value'] | undefined> {
  const db = await getDB();
  return db.get(storeName as any, key as any);
}

export async function getAllFromIndex<T extends keyof GameDB>(
  storeName: T,
  indexName: string,
  value: string | number
): Promise<GameDB[T]['value'][]> {
  const db = await getDB();
  const tx = db.transaction(storeName as any, 'readonly');
  const index = (tx.store as any).index(indexName);
  return index.getAll(value);
}

// ——————————————————————————————————————————————
// 8. Player Data CRUD
// ——————————————————————————————————————————————

import { PokemonInstance } from '../types/pokemon';
import { InventoryItem } from '../types/inventory';
import { ProgressData, PlayerData } from '../types/game';
import { PCStorage } from '../engine/pcStorage';

export async function savePlayerTeam(team: PokemonInstance[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('player_team', 'readwrite');
  await tx.store.clear();
  for (let i = 0; i < team.length; i++) {
    await tx.store.put({ slot: i, data: team[i] as unknown as Record<string, unknown> });
  }
  await tx.done;
}

export async function loadPlayerTeam(): Promise<PokemonInstance[]> {
  const db = await getDB();
  const entries = await db.getAll('player_team');
  return entries
    .sort((a: any, b: any) => a.slot - b.slot)
    .map((e: any) => e.data as unknown as PokemonInstance);
}

export async function savePlayerInventory(inventory: InventoryItem[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('player_inventory', 'readwrite');
  await tx.store.clear();
  for (const item of inventory) {
    await tx.store.put({
      item_id: item.itemId,
      quantity: item.quantity,
      category: '',
    });
  }
  await tx.done;
}

export async function loadPlayerInventory(): Promise<InventoryItem[]> {
  const db = await getDB();
  const entries = await db.getAll('player_inventory');
  return entries.map((e: any) => ({ itemId: e.item_id, quantity: e.quantity }));
}

export async function savePlayerProgress(
  player: PlayerData,
  progress: ProgressData,
  pc: PCStorage
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('player_progress', 'readwrite');

  // Preserve sync keys
  const syncTimestamp = await tx.store.get(SYNC_KEY);
  const dataVersion = await tx.store.get('data_version');

  // Write all progress entries
  const entries: DBProgressEntry[] = [
    { key: 'player_name', value: player.name },
    { key: 'money', value: player.money },
    { key: 'badges', value: player.badges },
    { key: 'play_time', value: player.playTime },
    { key: 'starter', value: player.starter },
    { key: 'defeated_trainers', value: progress.defeatedTrainers },
    { key: 'unlocked_zones', value: progress.unlockedZones },
    { key: 'current_zone', value: progress.currentZone },
    { key: 'caught_pokemon', value: progress.caughtPokemon },
    { key: 'seen_pokemon', value: progress.seenPokemon },
    { key: 'league_progress', value: progress.leagueProgress },
    { key: 'repel_steps', value: progress.repelSteps },
    { key: 'last_pokemon_center', value: progress.lastPokemonCenter },
    { key: 'events', value: progress.events },
    { key: 'current_floors', value: progress.currentFloors },
    { key: 'pc', value: pc },
    { key: 'save_version', value: '0.3.0' },
    { key: 'save_timestamp', value: Date.now() },
  ];

  // Don't clear — re-put preserves sync keys
  for (const entry of entries) {
    await tx.store.put(entry);
  }

  // Restore sync keys if they were overwritten
  if (syncTimestamp) await tx.store.put(syncTimestamp);
  if (dataVersion) await tx.store.put(dataVersion);

  await tx.done;
}

export async function loadPlayerProgress(): Promise<{
  player: PlayerData;
  progress: ProgressData;
  pc: PCStorage;
} | null> {
  const db = await getDB();
  const tx = db.transaction('player_progress', 'readonly');

  const get = async (key: string) => {
    const entry = await tx.store.get(key);
    return entry?.value;
  };

  const playerName = await get('player_name');
  if (playerName === undefined) return null; // No save exists

  const player: PlayerData = {
    name: playerName as string,
    money: (await get('money') as number) ?? 3000,
    badges: (await get('badges') as string[]) ?? [],
    playTime: (await get('play_time') as number) ?? 0,
    starter: (await get('starter') as number | null) ?? null,
  };

  const progress: ProgressData = {
    defeatedTrainers: (await get('defeated_trainers') as string[]) ?? [],
    unlockedZones: (await get('unlocked_zones') as string[]) ?? ['bourg-palette', 'route-1'],
    currentZone: (await get('current_zone') as string) ?? 'bourg-palette',
    caughtPokemon: (await get('caught_pokemon') as number[]) ?? [],
    seenPokemon: (await get('seen_pokemon') as number[]) ?? [],
    leagueProgress: (await get('league_progress') as number) ?? 0,
    repelSteps: (await get('repel_steps') as number) ?? 0,
    lastPokemonCenter: (await get('last_pokemon_center') as string) ?? 'bourg-palette',
    events: (await get('events') as Record<string, boolean>) ?? {},
    currentFloors: (await get('current_floors') as Record<string, number>) ?? {},
  };

  const pc = (await get('pc') as PCStorage) ?? null;

  await tx.done;

  return { player, progress, pc: pc! };
}

export async function savePokedex(
  seen: number[],
  caught: number[]
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('player_pokedex', 'readwrite');
  await tx.store.clear();

  const allIds = new Set([...seen, ...caught]);
  for (const id of allIds) {
    await tx.store.put({
      pokemon_id: id,
      seen: seen.includes(id),
      caught: caught.includes(id),
      caught_count: caught.includes(id) ? 1 : 0,
    });
  }
  await tx.done;
}

export async function hasSaveInDB(): Promise<boolean> {
  const db = await getDB();
  const entry = await db.get('player_progress', 'player_name');
  return entry !== undefined;
}

export async function deleteSaveFromDB(): Promise<void> {
  const db = await getDB();

  // Preserve sync-related keys in player_progress
  const syncTimestamp = await db.get('player_progress', SYNC_KEY);
  const dataVersion = await db.get('player_progress', 'data_version');

  const tx = db.transaction(
    ['player_team', 'player_inventory', 'player_progress', 'player_pokedex'],
    'readwrite'
  );

  await tx.objectStore('player_team').clear();
  await tx.objectStore('player_inventory').clear();
  await tx.objectStore('player_progress').clear();
  await tx.objectStore('player_pokedex').clear();

  // Restore sync keys so we don't re-sync from Supabase unnecessarily
  if (syncTimestamp) await tx.objectStore('player_progress').put(syncTimestamp);
  if (dataVersion) await tx.objectStore('player_progress').put(dataVersion);

  await tx.done;
}

export async function resetGameData(): Promise<void> {
  const db = await getDB();

  // Preserve sync-related keys in player_progress
  const syncTimestamp = await db.get('player_progress', SYNC_KEY);
  const dataVersion = await db.get('player_progress', 'data_version');

  const tx = db.transaction(
    ['player_team', 'player_inventory', 'player_progress', 'player_pokedex'],
    'readwrite'
  );
  await tx.objectStore('player_team').clear();
  await tx.objectStore('player_inventory').clear();
  await tx.objectStore('player_progress').clear();
  await tx.objectStore('player_pokedex').clear();

  // Restore sync keys
  if (syncTimestamp) await tx.objectStore('player_progress').put(syncTimestamp);
  if (dataVersion) await tx.objectStore('player_progress').put(dataVersion);

  await tx.done;
}

export async function forceFullSync(): Promise<void> {
  const db = await getDB();
  const allStores = [
    'pokemon', 'moves', 'pokemon_learnset', 'items',
    'zones', 'wild_encounters', 'gyms', 'trainers',
    'player_team', 'player_inventory', 'player_progress', 'player_pokedex'
  ] as const;

  const tx = db.transaction(allStores as any, 'readwrite');
  for (const storeName of allStores) {
    await tx.objectStore(storeName as any).clear();
  }
  await tx.done;
}
