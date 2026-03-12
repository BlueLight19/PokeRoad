import React, { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getItemData, getPokemonData } from '../../utils/dataLoader';
import { Button } from './Button';

export function InventoryScreen() {
    const { inventory, setView, useItemAction, team } = useGameStore();
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [targetMode, setTargetMode] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const inventoryItems = inventory.map(i => {
        try {
            return { ...i, data: getItemData(i.itemId) };
        } catch {
            return null;
        }
    }).filter((i): i is NonNullable<typeof i> => i !== null && !!i.data);

    const handleUse = (itemId: string) => {
        const item = getItemData(itemId);
        if (!item) return;

        const requiresTarget = ['heal', 'status', 'status_cure', 'revive', 'evolution', 'teach', 'boost'].includes(item.effect?.type || '');
        if (requiresTarget) {
            setSelectedItemId(itemId);
            setTargetMode(true);
            setMessage("Utiliser sur qui ?");
        } else {
            // Use immediately (e.g. key item or field effect without target)
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

    return (
        <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto', color: '#fff' }}>
            <h2 style={{ color: '#FFD600', fontSize: '14px', fontFamily: "'Press Start 2P', monospace", marginBottom: '16px', textAlign: 'center' }}>
                Sac
            </h2>

            {message && (
                <div style={{
                    background: '#333',
                    padding: '8px',
                    borderRadius: '4px',
                    marginBottom: '12px',
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: '10px',
                    textAlign: 'center',
                    border: '1px solid #FFD600'
                }}>
                    {message}
                </div>
            )}

            {!targetMode ? (
                <>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        background: '#16213e',
                        padding: '10px',
                        borderRadius: '8px',
                        minHeight: '300px'
                    }}>
                        {inventoryItems.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '20px', color: '#666', fontSize: '10px', fontFamily: "'Press Start 2P', monospace" }}>
                                Sac vide
                            </div>
                        ) : (
                            inventoryItems.map(item => (
                                <div key={item.itemId} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: '#0f172a',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    border: '1px solid #333'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${item.data.sprite}.png`} alt={item.data.name} style={{ width: '24px', height: '24px' }} onError={(e) => { (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png' }} />
                                        <div>
                                            <div style={{ fontSize: '10px', fontFamily: "'Press Start 2P', monospace" }}>{item.data.name}</div>
                                            <div style={{ fontSize: '8px', color: '#888' }}>x{item.quantity}</div>
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
                        <Button variant="ghost" onClick={() => setView('world_map')}>Fermer</Button>
                    </div>
                </>
            ) : (
                <div>
                    <div style={{ marginBottom: '12px', textAlign: 'center', fontSize: '10px', fontFamily: "'Press Start 2P', monospace" }}>
                        Selectionnez un Pokemon
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {team.map(pokemon => (
                            <div key={pokemon.uid}
                                onClick={() => handleTargetSelect(pokemon.uid)}
                                style={{
                                    padding: '10px',
                                    background: '#16213e',
                                    border: '1px solid #333',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}
                            >
                                <div style={{ fontSize: '10px', fontFamily: "'Press Start 2P', monospace" }}>
                                    {pokemon.nickname || getPokemonData(pokemon.dataId).name} Nv.{pokemon.level}
                                </div>
                                <div style={{ flex: 1, height: '4px', background: '#333', borderRadius: '2px' }}>
                                    <div style={{
                                        width: `${(pokemon.currentHp / pokemon.maxHp) * 100}%`,
                                        height: '100%',
                                        background: pokemon.currentHp < pokemon.maxHp / 5 ? '#f00' : '#0f0',
                                        borderRadius: '2px'
                                    }} />
                                </div>
                                <div style={{ fontSize: '8px', fontFamily: "'Press Start 2P', monospace" }}>
                                    {pokemon.currentHp}/{pokemon.maxHp}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
                        <Button variant="ghost" onClick={() => { setTargetMode(false); setMessage(null); }}>Annuler</Button>
                    </div>
                </div>
            )}
        </div>
    );
}
