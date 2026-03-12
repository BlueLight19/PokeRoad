export type ItemCategory = 'potion' | 'revive' | 'status_heal' | 'pokeball' | 'evolution' | 'key' | 'misc' | 'battle' | 'vitamin' | 'drink' | 'sellable' | 'pp_restore' | 'candy';

export interface ItemEffect {
    type: 'heal' | 'revive' | 'status_cure' | 'catch' | 'evolution' | 'boost' | 'repel' | 'escape_rope' | 'teach' | 'pp_restore' | 'rare_candy' | 'ev_boost' | 'battle_stat' | 'full_restore';
    healAmount?: number;
    healFull?: boolean;
    reviveHpPercent?: number;
    curesStatus?: string[];
    catchMultiplier?: number;
    stone?: string; // For evolution stone ID
    stat?: string; // For stat boost (X Attack, vitamins, etc.)
    stages?: number; // For battle stat boosts (X Attack = +1)
    repelSteps?: number;
    moveId?: number; // For TMs
    ppAmount?: number; // For Ether/Elixir (specific PP restore)
    ppAll?: boolean; // For Elixir (restore all moves)
    ppFull?: boolean; // Restore to max PP
    evAmount?: number; // For vitamins (EV gain)
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
