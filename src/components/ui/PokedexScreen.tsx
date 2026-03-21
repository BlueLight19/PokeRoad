import React, { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getPokemonData, getAllPokemon } from '../../utils/dataLoader';
import { Button } from './Button';

export function PokedexScreen() {
    const { progress, setView, inventory, addItem } = useGameStore();
    const [selectedId, setSelectedId] = useState<number | null>(null);

    // Get all 151
    const allPokemon = getAllPokemon().filter(p => p.id <= 151).sort((a, b) => a.id - b.id);

    const seenCount = progress.seenPokemon.length;
    const caughtCount = progress.caughtPokemon.length;

    return (
        <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto', color: '#fff', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ color: '#e94560', fontSize: '14px', fontFamily: "'Press Start 2P', monospace", marginBottom: '8px', textAlign: 'center' }}>
                Pokédex
            </h2>
            <div style={{ textAlign: 'center', fontSize: '8px', fontFamily: "'Press Start 2P', monospace", color: '#888', marginBottom: '16px' }}>
                Vus: {seenCount} | Pris: {caughtCount}
            </div>

            {caughtCount >= 151 && !inventory.some(i => i.itemId === 'chroma-charm') && (
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                    <Button variant="primary" onClick={() => addItem('chroma-charm', 1)}>
                        ⭐ Réclamer le Charme Chroma ! ⭐
                    </Button>
                </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(22, 33, 62, 0.8)', borderRadius: '8px', padding: '8px', border: '2px solid #333' }}>
                {allPokemon.map(p => {
                    const seen = progress.seenPokemon.includes(p.id);
                    const caught = progress.caughtPokemon.includes(p.id);

                    return (
                        <div key={p.id}
                            onClick={() => seen && setSelectedId(selectedId === p.id ? null : p.id)}
                            style={{
                                padding: '8px',
                                borderBottom: '1px solid #333',
                                display: 'flex',
                                alignItems: 'center',
                                opacity: seen ? 1 : 0.5,
                                background: selectedId === p.id ? 'rgba(26, 58, 92, 0.7)' : 'transparent',
                                cursor: seen ? 'pointer' : 'default'
                            }}>
                            <div style={{ width: '30px', fontFamily: "'Press Start 2P', monospace", fontSize: '8px', color: '#666' }}>
                                {p.id.toString().padStart(3, '0')}
                            </div>
                            <div style={{ width: '20px', textAlign: 'center' }}>
                                {caught && <span style={{ color: '#FFD600', fontSize: '10px' }}>★</span>}
                            </div>
                            <div style={{ flex: 1, fontFamily: "'Press Start 2P', monospace", fontSize: '9px' }}>
                                {seen ? p.name : '???'}
                            </div>

                            {selectedId === p.id && seen && (
                                <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(15, 25, 35, 0.9)', border: '2px solid #e94560', padding: '16px', borderRadius: '8px', zIndex: 100, width: '250px', boxShadow: '0 0 20px rgba(0,0,0,0.8)' }}>
                                    <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                                        <img src={p.spriteUrl} alt={p.name} style={{ width: '96px', height: '96px', imageRendering: 'pixelated' }} />
                                    </div>
                                    <div style={{ textAlign: 'center', fontFamily: "'Press Start 2P', monospace", fontSize: '12px', marginBottom: '8px', color: '#fff' }}>
                                        {p.name}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
                                        {p.types.map(t => (
                                            <span key={t} style={{ fontSize: '8px', padding: '2px 6px', background: '#333', borderRadius: '4px', textTransform: 'uppercase' }}>
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                    {/* Description would go here if we had it in data */}

                                    <div style={{ textAlign: 'center', marginTop: '12px' }}>
                                        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setSelectedId(null); }}>
                                            Fermer
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

        </div>
    );
}
