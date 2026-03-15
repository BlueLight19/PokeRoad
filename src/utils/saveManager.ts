import { PokemonInstance } from '../types/pokemon';
import { PlayerData, ProgressData } from '../types/game';
import { InventoryItem } from '../types/inventory';
import { PCStorage } from '../engine/pcStorage';
import {
  savePlayerTeam,
  savePlayerInventory,
  savePlayerProgress,
  savePokedex,
  loadPlayerTeam,
  loadPlayerInventory,
  loadPlayerProgress,
  hasSaveInDB,
  deleteSaveFromDB,
} from './db';

export interface SavePayload {
  player: PlayerData;
  team: PokemonInstance[];
  pc: PCStorage;
  inventory: InventoryItem[];
  progress: ProgressData;
}

export async function saveGame(data: SavePayload): Promise<void> {
  try {
    await Promise.all([
      savePlayerTeam(data.team),
      savePlayerInventory(data.inventory),
      savePlayerProgress(data.player, data.progress, data.pc),
      savePokedex(data.progress.seenPokemon, data.progress.caughtPokemon),
    ]);
  } catch (e) {
    console.error('Failed to save game:', e);
  }
}

export async function loadGame(): Promise<SavePayload | null> {
  try {
    const [progressData, team, inventory] = await Promise.all([
      loadPlayerProgress(),
      loadPlayerTeam(),
      loadPlayerInventory(),
    ]);

    if (!progressData) return null;

    return {
      player: progressData.player,
      team,
      pc: progressData.pc,
      inventory,
      progress: progressData.progress,
    };
  } catch (e) {
    console.error('Failed to load save:', e);
    return null;
  }
}

export async function deleteSave(): Promise<void> {
  await deleteSaveFromDB();
}

export async function hasSave(): Promise<boolean> {
  return hasSaveInDB();
}
