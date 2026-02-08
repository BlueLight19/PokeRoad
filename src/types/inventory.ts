export type ItemCategory = 'potion' | 'revive' | 'status_heal' | 'pokeball' | 'evolution' | 'key' | 'misc';

export interface ItemEffect {
    type: 'heal' | 'revive' | 'status_cure' | 'catch' | 'evolution' | 'boost';
    healAmount?: number;
    healFull?: boolean;
    reviveHpPercent?: number;
    curesStatus?: string[];
    catchMultiplier?: number;
    stone?: string; // For evolution stone ID
    stat?: string; // For stat boost (X Attack etc)
}

export interface ItemData {
    id: string;
    name: string;
    description: string;
    category: ItemCategory;
    effect?: ItemEffect;
    price: number;
    sprite?: string;
    usableInBattle?: boolean;
    usableOutside?: boolean;
}

export interface InventoryItem {
    itemId: string;
    quantity: number;
}

export interface Inventory {
    items: Record<string, number>; // itemId -> quantity
}

export interface ShopItem {
    itemId: string;
    price: number;
}
