import { SaveData } from '../types/game';

const SAVE_KEY = 'pokeroad-save';
const SAVE_VERSION = '0.1.0';

export function saveGame(data: Omit<SaveData, 'version' | 'timestamp'>): void {
  const save: SaveData = {
    ...data,
    version: SAVE_VERSION,
    timestamp: Date.now(),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (e) {
    console.error('Failed to save game:', e);
  }
}

export function loadGame(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    return data;
  } catch (e) {
    console.error('Failed to load save:', e);
    return null;
  }
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}
