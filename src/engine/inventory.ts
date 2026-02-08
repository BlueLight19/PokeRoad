import { Inventory, ItemData } from '../types/inventory';
import { getItemData } from '../utils/dataLoader';

/**
 * createEmptyInventory
 */
export function createEmptyInventory(): Inventory {
    return {
        items: {},
    };
}

/**
 * Add items to inventory
 */
export function addItem(inventory: Inventory, itemId: string, count: number = 1): void {
    const current = inventory.items[itemId] || 0;
    inventory.items[itemId] = current + count;
}

/**
 * Remove items from inventory. Returns success boolean.
 */
export function removeItem(inventory: Inventory, itemId: string, count: number = 1): boolean {
    const current = inventory.items[itemId] || 0;
    if (current < count) return false;

    inventory.items[itemId] = current - count;
    if (inventory.items[itemId] <= 0) {
        delete inventory.items[itemId];
    }
    return true;
}

/**
 * Check if player has item
 */
export function hasItem(inventory: Inventory, itemId: string, count: number = 1): boolean {
    return (inventory.items[itemId] || 0) >= count;
}

/**
 * Get item quantity
 */
export function getItemCount(inventory: Inventory, itemId: string): number {
    return inventory.items[itemId] || 0;
}
