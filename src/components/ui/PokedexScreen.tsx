import React, { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getPokemonData, getAllPokemon } from '../../utils/dataLoader';
import { Button } from './Button';
import { Modal } from './Modal';
import { theme } from '../../theme';
import { typeColors } from '../../utils/typeColors';

export function PokedexScreen() {
    const { progress, setView, inventory, addItem } = useGameStore();
    const [selectedId, setSelectedId] = useState<number | null>(null);

    // Get all 151
    const allPokemon = getAllPokemon().filter(p => p.id <= 151).sort((a, b) => a.id - b.id);

    const seenCount = progress.seenPokemon.length;
    const caughtCount = progress.caughtPokemon.length;

    const selectedPokemon = selectedId !== null ? allPokemon.find(p => p.id === selectedId) ?? null : null;

    return (
        <div style={{ padding: `${theme.spacing.lg}px`, maxWidth: '600px', margin: '0 auto', color: theme.colors.textPrimary, height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ color: theme.colors.primary, fontSize: theme.font.xxl, fontFamily: theme.font.family, marginBottom: `${theme.spacing.sm}px`, textAlign: 'center' }}>
                Pokédex
            </h2>
            <div style={{ textAlign: 'center', fontSize: theme.font.xs, fontFamily: theme.font.family, color: theme.colors.textDim, marginBottom: `${theme.spacing.lg}px` }}>
                Vus: {seenCount} | Pris: {caughtCount}
            </div>

            {caughtCount >= 151 && !inventory.some(i => i.itemId === 'chroma-charm') && (
                <div style={{ textAlign: 'center', marginBottom: `${theme.spacing.lg}px` }}>
                    <Button variant="primary" onClick={() => addItem('chroma-charm', 1)}>
                        ⭐ Réclamer le Charme Chroma ! ⭐
                    </Button>
                </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', background: `${theme.colors.navyBg}cc`, borderRadius: `${theme.radius.md}px`, padding: `${theme.spacing.sm}px`, border: theme.borders.medium(theme.colors.borderDark) }}>
                {allPokemon.map(p => {
                    const seen = progress.seenPokemon.includes(p.id);
                    const caught = progress.caughtPokemon.includes(p.id);

                    return (
                        <div key={p.id}
                            onClick={() => seen && setSelectedId(selectedId === p.id ? null : p.id)}
                            style={{
                                padding: `${theme.spacing.sm}px`,
                                borderBottom: theme.borders.thin(theme.colors.borderDark),
                                display: 'flex',
                                alignItems: 'center',
                                opacity: seen ? 1 : 0.5,
                                background: selectedId === p.id ? 'rgba(26, 58, 92, 0.7)' : 'transparent',
                                cursor: seen ? 'pointer' : 'default'
                            }}>
                            <div style={{ width: '30px', fontFamily: theme.font.family, fontSize: theme.font.xs, color: theme.colors.textDimmer }}>
                                {p.id.toString().padStart(3, '0')}
                            </div>
                            <div style={{ width: '20px', textAlign: 'center' }}>
                                {caught && <span style={{ color: theme.colors.gold, fontSize: theme.font.md }}>★</span>}
                            </div>
                            <div style={{ flex: 1, fontFamily: theme.font.family, fontSize: theme.font.sm }}>
                                {seen ? p.name : '???'}
                            </div>
                        </div>
                    );
                })}
            </div>

            <Modal open={selectedPokemon !== null} title={selectedPokemon?.name ?? ''} onClose={() => setSelectedId(null)}>
                {selectedPokemon && (
                    <>
                        <div style={{ textAlign: 'center', marginBottom: `${theme.spacing.md}px` }}>
                            <img src={selectedPokemon.spriteUrl} alt={selectedPokemon.name} style={{ width: '96px', height: '96px', imageRendering: 'pixelated' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: `${theme.spacing.sm}px`, marginBottom: `${theme.spacing.md}px` }}>
                            {selectedPokemon.types.map(t => (
                                <span key={t} style={{ fontSize: theme.font.xs, padding: '2px 6px', background: typeColors[t] || theme.colors.borderDark, borderRadius: `${theme.radius.sm}px`, textTransform: 'uppercase', color: theme.colors.textPrimary }}>
                                    {t}
                                </span>
                            ))}
                        </div>
                        {/* Description would go here if we had it in data */}
                        <div style={{ textAlign: 'center', marginTop: `${theme.spacing.md}px` }}>
                            <Button size="sm" variant="secondary" onClick={() => setSelectedId(null)}>
                                Fermer
                            </Button>
                        </div>
                    </>
                )}
            </Modal>

        </div>
    );
}
