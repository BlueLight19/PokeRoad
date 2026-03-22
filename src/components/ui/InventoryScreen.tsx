import React, { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getItemData, getPokemonData } from '../../utils/dataLoader';
import { Button } from './Button';
import { soundManager } from '../../utils/SoundManager';
import { theme } from '../../theme';
import { getHpColor } from './HealthBar';

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
    'boost', 'rare_candy', 'ev_boost', 'pp_restore', 'full_restore', 'level_up',
];

function getTabForItem(item: { category: string; effect?: { type?: string } }): TabKey {
    if (item.effect?.type === 'teach' || item.category === 'all-machines') return 'ctcs';
    if (['healing', 'revival', 'status-cures', 'pp-recovery', 'potion', 'revive', 'status_heal', 'drink'].includes(item.category)) return 'soins';
    if (['standard-balls', 'special-balls', 'apricorn-balls', 'pokeball'].includes(item.category)) return 'balls';
    if (['stat-boosts', 'nature-mints', 'miracle-shooter', 'battle'].includes(item.category)) return 'combat';
    if (['vitamins', 'species-candies', 'candy', 'vitamin'].includes(item.category)) return 'baies';
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

            const state = useGameStore.getState();
            if (state.pendingEvolution || state.pendingMoveLearn) {
                setView('world_map');
            }
        }
    };

    const spriteUrl = (item: { data: { sprite?: string }; itemId: string }) => {
        if (item.data.sprite?.startsWith('http')) return item.data.sprite;
        return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${item.data.sprite || item.itemId}.png`;
    };

    return (
        <div style={{
            padding: `${theme.spacing.lg}px`,
            margin: '0 auto',
            color: theme.colors.textPrimary,
            fontFamily: theme.font.family,
            background: 'transparent',
            minHeight: '100vh',
            boxSizing: 'border-box',
        }}>
            <h2 style={{
                color: theme.colors.gold,
                fontSize: theme.font.xxl,
                marginBottom: `${theme.spacing.md}px`,
                textAlign: 'center',
            }}>
                Sac
            </h2>

            {message && (
                <div style={{
                    background: 'rgba(51, 51, 51, 0.8)',
                    padding: `${theme.spacing.sm}px`,
                    borderRadius: `${theme.radius.sm}px`,
                    marginBottom: `${theme.spacing.md}px`,
                    fontSize: theme.font.md,
                    textAlign: 'center',
                    border: `1px solid ${theme.colors.gold}`,
                    maxWidth: '600px',
                    margin: `0 auto ${theme.spacing.md}px`,
                }}>
                    {message}
                </div>
            )}

            {!targetMode ? (
                <div style={{ width: 'fit-content', margin: '0 auto' }}>
                    {/* Tab bar */}
                    <div style={{
                        display: 'flex',
                        gap: `${theme.spacing.xs}px`,
                        paddingBottom: `${theme.spacing.sm}px`,
                        marginBottom: `${theme.spacing.sm}px`,
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
                                        fontFamily: theme.font.family,
                                        fontSize: theme.font.sm,
                                        padding: '8px 10px',
                                        border: isActive ? `2px solid ${theme.colors.gold}` : `2px solid ${theme.colors.borderDark}`,
                                        borderRadius: `${theme.radius.sm}px ${theme.radius.sm}px 0 0`,
                                        background: isActive ? `${theme.colors.navyBg}cc` : 'rgba(10, 10, 26, 0.7)',
                                        color: isActive ? theme.colors.gold : theme.colors.textDim,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        borderBottom: isActive ? `2px solid ${theme.colors.navyBg}cc` : `2px solid ${theme.colors.borderDark}`,
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
                        gap: `${theme.spacing.sm}px`,
                        background: `${theme.colors.navyBg}cc`,
                        padding: '10px',
                        borderRadius: `0 ${theme.radius.md}px ${theme.radius.md}px ${theme.radius.md}px`,
                        minHeight: '300px',
                        border: `1px solid ${theme.colors.borderDark}`,
                    }}>
                        {currentItems.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '40px 20px',
                                color: theme.colors.borderMid,
                                fontSize: theme.font.md,
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
                                    borderRadius: `${theme.radius.sm}px`,
                                    border: `1px solid ${theme.colors.borderDark}`,
                                    gap: `${theme.spacing.sm}px`,
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
                                            <div style={{ fontSize: theme.font.md, marginBottom: '2px' }}>
                                                {item.data.name}
                                                <span style={{ color: theme.colors.gold, marginLeft: `${theme.spacing.sm}px` }}>x{item.quantity}</span>
                                            </div>
                                            <div style={{
                                                fontSize: theme.font.micro,
                                                color: theme.colors.textDim,
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

                </div>
            ) : (
                <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <div style={{
                        marginBottom: `${theme.spacing.md}px`,
                        textAlign: 'center',
                        fontSize: theme.font.md,
                    }}>
                        Sélectionnez un Pokémon
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: `${theme.spacing.sm}px` }}>
                        {team.map(pokemon => {
                            const hpPercent = pokemon.maxHp > 0 ? (pokemon.currentHp / pokemon.maxHp) * 100 : 0;
                            const hpColor = getHpColor(pokemon.currentHp / pokemon.maxHp);
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
                                        background: `${theme.colors.navyBg}cc`,
                                        border: `1px solid ${theme.colors.borderDark}`,
                                        borderRadius: `${theme.radius.md}px`,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                    }}
                                >
                                    <div style={{ fontSize: theme.font.md, whiteSpace: 'nowrap' }}>
                                        {pokeName} Nv.{pokemon.level}
                                    </div>
                                    <div style={{ flex: 1, height: '6px', background: theme.colors.borderDark, borderRadius: `${theme.radius.sm}px` }}>
                                        <div style={{
                                            width: `${hpPercent}%`,
                                            height: '100%',
                                            background: hpColor,
                                            borderRadius: `${theme.radius.sm}px`,
                                            transition: 'width 0.2s',
                                        }} />
                                    </div>
                                    <div style={{ fontSize: theme.font.xs, whiteSpace: 'nowrap' }}>
                                        {pokemon.currentHp}/{pokemon.maxHp}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ marginTop: `${theme.spacing.lg}px`, display: 'flex', justifyContent: 'center' }}>
                        <Button variant="ghost" onClick={() => { setTargetMode(false); setSelectedItemId(null); setMessage(null); }}>
                            Annuler
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
