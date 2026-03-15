import React, { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getItemData, getPokemonData } from '../../utils/dataLoader';
import { Button } from './Button';
import { soundManager } from '../../utils/SoundManager';

type TabKey = 'soins' | 'balls' | 'combat' | 'ctcs' | 'baies' | 'objets';

interface Tab {
    key: TabKey;
    label: string;
}

const TABS: Tab[] = [
    { key: 'soins', label: 'Soins' },
    { key: 'balls', label: 'Balls' },
    { key: 'combat', label: 'Combat' },
    { key: 'ctcs', label: 'CT/CS' },
    { key: 'baies', label: 'Baies' },
    { key: 'objets', label: 'Objets' },
];

const TARGET_EFFECT_TYPES = [
    'heal', 'status_cure', 'revive', 'evolution', 'teach',
    'boost', 'rare_candy', 'ev_boost', 'pp_restore', 'full_restore',
];

function getTabForItem(item: { category: string; effect?: { type?: string } }): TabKey {
    if (item.effect?.type === 'teach') return 'ctcs';
    if (['potion', 'drink', 'revive', 'status_heal'].includes(item.category)) return 'soins';
    if (item.category === 'pokeball') return 'balls';
    if (item.category === 'battle') return 'combat';
    if (['candy', 'vitamin'].includes(item.category)) return 'baies';
    return 'objets';
}

export function InventoryScreen() {
    const { inventory, setView, useItemAction, team } = useGameStore();
    const [activeTab, setActiveTab] = useState<TabKey>('soins');
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [targetMode, setTargetMode] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const inventoryItems = inventory.map(i => {
        try {
            const data = getItemData(i.itemId);
            return data ? { ...i, data } : null;
        } catch {
            return null;
        }
    }).filter((i): i is NonNullable<typeof i> => i !== null && !!i.data);

    const itemsByTab: Record<TabKey, typeof inventoryItems> = {
        soins: [], balls: [], combat: [], ctcs: [], baies: [], objets: [],
    };
    for (const item of inventoryItems) {
        const tab = getTabForItem(item.data);
        itemsByTab[tab].push(item);
    }

    const currentItems = itemsByTab[activeTab];

    const handleUse = (itemId: string) => {
        const item = getItemData(itemId);
        if (!item) return;

        const requiresTarget = TARGET_EFFECT_TYPES.includes(item.effect?.type || '');
        if (requiresTarget) {
            setSelectedItemId(itemId);
            setTargetMode(true);
            setMessage('Utiliser sur qui ?');
        } else {
            const result = useItemAction(itemId);
            setMessage(result.message);
        }
    };

    const handleTargetSelect = (pokemonUid: string) => {
        if (!selectedItemId) return;
        const result = useItemAction(selectedItemId, pokemonUid);
        setMessage(result.message);
        if (result.success) {
            setTargetMode(false);
            setSelectedItemId(null);
        }
    };

    const spriteUrl = (item: { data: { sprite?: string }; itemId: string }) =>
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${item.data.sprite || item.itemId}.png`;

    return (
        <div style={{
            padding: '16px',
            margin: '0 auto',
            color: '#fff',
            fontFamily: "'Press Start 2P', monospace",
            background: 'transparent',
            minHeight: '100vh',
            boxSizing: 'border-box',
        }}>
            <h2 style={{
                color: '#FFD600',
                fontSize: '14px',
                marginBottom: '12px',
                textAlign: 'center',
            }}>
                Sac
            </h2>

            {message && (
                <div style={{
                    background: 'rgba(51, 51, 51, 0.8)',
                    padding: '8px',
                    borderRadius: '4px',
                    marginBottom: '12px',
                    fontSize: '10px',
                    textAlign: 'center',
                    border: '1px solid #FFD600',
                    maxWidth: '600px',
                    margin: '0 auto 12px',
                }}>
                    {message}
                </div>
            )}

            {!targetMode ? (
                <div style={{ width: 'fit-content', margin: '0 auto' }}>
                    {/* Tab bar */}
                    <div style={{
                        display: 'flex',
                        gap: '4px',
                        paddingBottom: '8px',
                        marginBottom: '8px',
                    }}>
                        {TABS.map(tab => {
                            const count = itemsByTab[tab.key].length;
                            const isActive = activeTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => { 
                                        soundManager.playClick();
                                        setActiveTab(tab.key); 
                                        setMessage(null); 
                                    }}
                                    style={{
                                        fontFamily: "'Press Start 2P', monospace",
                                        fontSize: '9px',
                                        padding: '8px 10px',
                                        border: isActive ? '2px solid #FFD600' : '2px solid #333',
                                        borderRadius: '6px 6px 0 0',
                                        background: isActive ? 'rgba(22, 33, 62, 0.8)' : 'rgba(10, 10, 26, 0.7)',
                                        color: isActive ? '#FFD600' : '#888',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        borderBottom: isActive ? '2px solid rgba(22, 33, 62, 0.8)' : '2px solid #333',
                                        transition: 'color 0.15s, border-color 0.15s',
                                    }}
                                >
                                    {tab.label}{count > 0 ? ` (${count})` : ''}
                                </button>
                            );
                        })}
                    </div>

                    {/* Item list */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        background: 'rgba(22, 33, 62, 0.8)',
                        padding: '10px',
                        borderRadius: '0 8px 8px 8px',
                        minHeight: '300px',
                        border: '1px solid #333',
                    }}>
                        {currentItems.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '40px 20px',
                                color: '#555',
                                fontSize: '10px',
                            }}>
                                Aucun objet
                            </div>
                        ) : (
                            currentItems.map(item => (
                                <div key={item.itemId} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: 'rgba(15, 15, 35, 0.7)',
                                    padding: '8px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid #333',
                                    gap: '8px',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                        <img
                                            src={spriteUrl(item)}
                                            alt={item.data.name}
                                            style={{ width: '32px', height: '32px', imageRendering: 'pixelated', flexShrink: 0 }}
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src =
                                                    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png';
                                            }}
                                        />
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: '10px', marginBottom: '2px' }}>
                                                {item.data.name}
                                                <span style={{ color: '#FFD600', marginLeft: '8px' }}>x{item.quantity}</span>
                                            </div>
                                            <div style={{
                                                fontSize: '7px',
                                                color: '#888',
                                                lineHeight: '1.4',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                maxWidth: '300px',
                                            }}>
                                                {item.data.description}
                                            </div>
                                        </div>
                                    </div>
                                    <Button size="sm" variant="primary" onClick={() => handleUse(item.itemId)}>
                                        Utiliser
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>

                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
                        <Button variant="ghost" onClick={() => setView('world_map')}>Retour</Button>
                    </div>
                </div>
            ) : (
                <div style={{maxWidth: '600px', margin: '0 auto'}}>
                    <div style={{
                        marginBottom: '12px',
                        textAlign: 'center',
                        fontSize: '10px',
                    }}>
                        Sélectionnez un Pokémon
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {team.map(pokemon => {
                            const hpPercent = pokemon.maxHp > 0 ? (pokemon.currentHp / pokemon.maxHp) * 100 : 0;
                            const hpColor = hpPercent < 20 ? '#f44' : hpPercent < 50 ? '#fa0' : '#4f4';
                            let pokeName: string;
                            try {
                                pokeName = pokemon.nickname || getPokemonData(pokemon.dataId).name;
                            } catch {
                                pokeName = `#${pokemon.dataId}`;
                            }
                            return (
                                <div
                                    key={pokemon.uid}
                                    onClick={() => handleTargetSelect(pokemon.uid)}
                                    style={{
                                        padding: '10px',
                                        background: 'rgba(22, 33, 62, 0.8)',
                                        border: '1px solid #333',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                    }}
                                >
                                    <div style={{ fontSize: '10px', whiteSpace: 'nowrap' }}>
                                        {pokeName} Nv.{pokemon.level}
                                    </div>
                                    <div style={{ flex: 1, height: '6px', background: '#333', borderRadius: '3px' }}>
                                        <div style={{
                                            width: `${hpPercent}%`,
                                            height: '100%',
                                            background: hpColor,
                                            borderRadius: '3px',
                                            transition: 'width 0.2s',
                                        }} />
                                    </div>
                                    <div style={{ fontSize: '8px', whiteSpace: 'nowrap' }}>
                                        {pokemon.currentHp}/{pokemon.maxHp}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
                        <Button variant="ghost" onClick={() => { setTargetMode(false); setSelectedItemId(null); setMessage(null); }}>
                            Annuler
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
