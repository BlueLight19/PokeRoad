export type ItemCategory = 
    | 'standard-balls' | 'special-balls' | 'apricorn-balls' 
    | 'healing' | 'status-cures' | 'revival' 
    | 'vitamins' | 'evolution' | 'held-items' 
    | 'jewels' | 'plates' | 'memories' 
    | 'species-candies' | 'species-specific' 
    | 'training' | 'effort-training' | 'stat-boosts' 
    | 'nature-mints' | 'pp-recovery' 
    | 'miracle-shooter' | 'mulch' | 'all-machines' | 'all-mail' 
    | 'apricorn-box' | 'gameplay' | 'plot-advancement' | 'event-items' 
    | 'dex-completion' | 'loot' | 'collectibles' | 'tm-materials' 
    | 'sandwich-ingredients' | 'curry-ingredients' | 'picnic' | 'tera-shard' 
    | 'unused' | 'potion' | 'revive' | 'status_heal' | 'pokeball' | 'key' | 'misc' | 'battle' | 'vitamin' | 'drink' | 'sellable' | 'pp_restore' | 'candy';

export interface ItemEffect {
    type: 'heal' | 'revive' | 'status_cure' | 'cure' | 'catch' | 'evolution' | 'boost' | 'repel' | 'escape_rope' | 'teach' | 'pp_restore' | 'rare_candy' | 'ev_boost' | 'battle_stat' | 'full_restore';
    value?: number; // Healing amount or general value
    hpPercent?: number; // For revives
    target?: string; // For status cures or specific targets
    healAmount?: number; // Legacy
    healFull?: boolean; // Legacy
    reviveHpPercent?: number; // Legacy
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
