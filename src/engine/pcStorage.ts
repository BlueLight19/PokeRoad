import { PokemonInstance } from '../types/pokemon';

export interface PCBox {
    id: number;
    name: string;
    pokemon: (PokemonInstance | null)[]; // Fixed size, e.g., 20 or 30 slots
}

export interface PCStorage {
    boxes: PCBox[];
    currentBoxId: number;
}

export const BOX_CAPACITY = 30;
export const NUM_BOXES = 12;

export function createPCStorage(): PCStorage {
    const boxes: PCBox[] = [];
    for (let i = 0; i < NUM_BOXES; i++) {
        boxes.push({
            id: i,
            name: `Boîte ${i + 1}`,
            pokemon: Array(BOX_CAPACITY).fill(null),
        });
    }
    return {
        boxes,
        currentBoxId: 0,
    };
}

/**
 * Deposit a Pokémon from the party into the current box (or next available).
 * Returns true if successful, false if PC is full.
 */
export function depositPokemon(pc: PCStorage, pokemon: PokemonInstance): boolean {
    // Try current box first
    const currentBox = pc.boxes[pc.currentBoxId];
    const emptySlot = currentBox.pokemon.findIndex(p => p === null);

    if (emptySlot !== -1) {
        currentBox.pokemon[emptySlot] = pokemon;
        return true;
    }

    // Try other boxes
    for (let i = 0; i < pc.boxes.length; i++) {
        if (i === pc.currentBoxId) continue;

        const box = pc.boxes[i];
        const slot = box.pokemon.findIndex(p => p === null);
        if (slot !== -1) {
            box.pokemon[slot] = pokemon;
            // Optionally switch current box? For now, no.
            return true;
        }
    }

    return false; // PC Full
}

/**
 * Withdraw a Pokémon from a specific box and slot.
 * Returns the Pokémon or null if slot is empty.
 */
export function withdrawPokemon(pc: PCStorage, boxId: number, slotId: number): PokemonInstance | null {
    const box = pc.boxes[boxId];
    if (!box) return null;

    const pokemon = box.pokemon[slotId];
    if (pokemon) {
        box.pokemon[slotId] = null;
        return pokemon;
    }
    return null;
}

/**
 * Move a Pokémon from one slot to another (can be different boxes).
 * Swaps if target is occupied.
 */
export function movePokemon(
    pc: PCStorage,
    fromBoxId: number,
    fromSlotId: number,
    toBoxId: number,
    toSlotId: number
): boolean {
    const fromBox = pc.boxes[fromBoxId];
    const toBox = pc.boxes[toBoxId];

    if (!fromBox || !toBox) return false;

    const pokemonFrom = fromBox.pokemon[fromSlotId];
    const pokemonTo = toBox.pokemon[toSlotId];

    // If source is empty, do nothing
    if (!pokemonFrom) return false;

    // Swap
    fromBox.pokemon[fromSlotId] = pokemonTo;
    toBox.pokemon[toSlotId] = pokemonFrom;

    return true;
}

/**
 * Get the first empty slot in the current box
 */
export function getFirstEmptySlot(pc: PCStorage): { boxId: number; slotId: number } | null {
    const currentBox = pc.boxes[pc.currentBoxId];
    const emptySlot = currentBox.pokemon.findIndex(p => p === null);

    if (emptySlot !== -1) {
        return { boxId: pc.currentBoxId, slotId: emptySlot };
    }

    // Iterate all boxes
    for (let i = 0; i < pc.boxes.length; i++) {
        const box = pc.boxes[i];
        const slot = box.pokemon.findIndex(p => p === null);
        if (slot !== -1) {
            return { boxId: i, slotId: slot };
        }
    }

    return null;
}

/**
 * Find a Pokémon by UID in the PC
 */
export function findPokemonInPC(pc: PCStorage, uid: string): { boxId: number; slotId: number; pokemon: PokemonInstance } | null {
    for (let i = 0; i < pc.boxes.length; i++) {
        const box = pc.boxes[i];
        for (let j = 0; j < box.pokemon.length; j++) {
            const p = box.pokemon[j];
            if (p && p.uid === uid) {
                return { boxId: i, slotId: j, pokemon: p };
            }
        }
    }
    return null;
}
