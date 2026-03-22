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

    const allPokemon = getAllPokemon().filter(p => p.id <= 151).sort((a, b) => a.id - b.id);

    const seenCount = progress.seenPokemon.length;
    const caughtCount = progress.caughtPokemon.length;
    const total = allPokemon.length;
    const completionPercent = total > 0 ? Math.round((caughtCount / total) * 100) : 0;

    const selectedPokemon = selectedId !== null ? allPokemon.find(p => p.id === selectedId) ?? null : null;

    return (
        <div style={{ padding: `${theme.spacing.lg}px`, maxWidth: '600px', margin: '0 auto', color: theme.colors.textPrimary, height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: `${theme.spacing.lg}px` }}>
                <h2 style={{ color: theme.colors.primary, fontSize: theme.font.xxl, fontFamily: theme.font.family, margin: 0 }}>
                    Pokedex
                </h2>
                <div style={{
                    width: '40px',
                    height: '2px',
                    background: `linear-gradient(90deg, transparent, ${theme.colors.primary}, transparent)`,
                    margin: '8px auto 12px',
                }} />

                {/* Progress bar */}
                <div style={{
                    background: `${theme.colors.navyBg}cc`,
                    borderRadius: `${theme.radius.lg}px`,
                    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
                    border: theme.borders.thin(theme.colors.borderDark),
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: `${theme.spacing.sm}px` }}>
                        <div style={{ display: 'flex', gap: `${theme.spacing.lg}px` }}>
                            <span style={{ fontSize: theme.font.xs, fontFamily: theme.font.family, color: theme.colors.textDim }}>
                                Vus <span style={{ color: theme.colors.info }}>{seenCount}</span>
                            </span>
                            <span style={{ fontSize: theme.font.xs, fontFamily: theme.font.family, color: theme.colors.textDim }}>
                                Pris <span style={{ color: theme.colors.gold }}>{caughtCount}</span>
                            </span>
                        </div>
                        <span style={{ fontSize: theme.font.xs, fontFamily: theme.font.family, color: theme.colors.textMuted }}>
                            {completionPercent}%
                        </span>
                    </div>
                    <div style={{ height: '6px', background: theme.colors.borderDark, borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                            width: `${completionPercent}%`,
                            height: '100%',
                            background: completionPercent >= 100
                                ? `linear-gradient(90deg, ${theme.colors.gold}, #FFA000)`
                                : `linear-gradient(90deg, ${theme.colors.primary}, ${theme.colors.primaryLight})`,
                            borderRadius: '3px',
                            transition: 'width 0.5s ease',
                        }} />
                    </div>
                </div>
            </div>

            {caughtCount >= 151 && !inventory.some(i => i.itemId === 'chroma-charm') && (
                <div style={{
                    textAlign: 'center',
                    marginBottom: `${theme.spacing.lg}px`,
                    padding: `${theme.spacing.md}px`,
                    background: `${theme.colors.gold}0c`,
                    border: theme.borders.thin(`${theme.colors.gold}44`),
                    borderRadius: `${theme.radius.md}px`,
                }}>
                    <Button variant="primary" onClick={() => addItem('chroma-charm', 1)}>
                        Reclamer le Charme Chroma !
                    </Button>
                </div>
            )}

            {/* Pokemon grid */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                background: `${theme.colors.navyBg}cc`,
                borderRadius: `${theme.radius.md}px`,
                padding: `${theme.spacing.sm}px`,
                border: theme.borders.medium(theme.colors.borderDark),
            }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: '4px',
                }}>
                    {allPokemon.map(p => {
                        const seen = progress.seenPokemon.includes(p.id);
                        const caught = progress.caughtPokemon.includes(p.id);
                        const isSelected = selectedId === p.id;

                        return (
                            <button
                                key={p.id}
                                onClick={() => seen && setSelectedId(isSelected ? null : p.id)}
                                style={{
                                    aspectRatio: '1',
                                    background: isSelected
                                        ? `${theme.colors.primary}22`
                                        : seen
                                            ? `rgba(15, 23, 42, 0.6)`
                                            : `rgba(15, 23, 42, 0.3)`,
                                    border: isSelected
                                        ? `2px solid ${theme.colors.primary}`
                                        : caught
                                            ? `2px solid ${theme.colors.gold}44`
                                            : `2px solid transparent`,
                                    borderRadius: `${theme.radius.sm}px`,
                                    cursor: seen ? 'pointer' : 'default',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    position: 'relative',
                                    transition: 'border-color 0.2s, background 0.2s',
                                    padding: '2px',
                                }}
                            >
                                {seen ? (
                                    <img
                                        src={p.spriteUrl}
                                        alt={p.name}
                                        style={{
                                            width: '85%',
                                            height: '85%',
                                            imageRendering: 'pixelated',
                                            opacity: caught ? 1 : 0.45,
                                            filter: caught ? 'none' : 'brightness(0.6)',
                                        }}
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                ) : (
                                    <span style={{
                                        color: theme.colors.borderDark,
                                        fontSize: theme.font.xs,
                                        fontFamily: theme.font.family,
                                    }}>?</span>
                                )}
                                {/* Number badge */}
                                <span style={{
                                    position: 'absolute',
                                    bottom: '1px',
                                    left: '2px',
                                    fontSize: '5px',
                                    fontFamily: theme.font.family,
                                    color: seen ? theme.colors.textDimmer : theme.colors.borderDark,
                                }}>
                                    {p.id}
                                </span>
                                {/* Caught star */}
                                {caught && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '1px',
                                        right: '2px',
                                        fontSize: '6px',
                                        color: theme.colors.gold,
                                    }}>★</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Detail Modal */}
            <Modal open={selectedPokemon !== null} title={selectedPokemon?.name ?? ''} onClose={() => setSelectedId(null)}>
                {selectedPokemon && (() => {
                    const seen = progress.seenPokemon.includes(selectedPokemon.id);
                    const caught = progress.caughtPokemon.includes(selectedPokemon.id);
                    const primaryType = selectedPokemon.types[0];
                    const typeColor = typeColors[primaryType] || theme.colors.textDim;

                    return (
                        <>
                            {/* Sprite + number */}
                            <div style={{
                                textAlign: 'center',
                                marginBottom: `${theme.spacing.md}px`,
                                position: 'relative',
                            }}>
                                <div style={{
                                    background: `radial-gradient(circle, ${typeColor}15 0%, transparent 70%)`,
                                    display: 'inline-block',
                                    borderRadius: `${theme.radius.lg}px`,
                                    padding: '8px',
                                }}>
                                    <img src={selectedPokemon.spriteUrl} alt={selectedPokemon.name} style={{ width: '112px', height: '112px', imageRendering: 'pixelated' }} />
                                </div>
                                <div style={{ fontSize: theme.font.xs, fontFamily: theme.font.family, color: theme.colors.textDimmer, marginTop: '4px' }}>
                                    #{selectedPokemon.id.toString().padStart(3, '0')}
                                    {caught && <span style={{ color: theme.colors.gold, marginLeft: '6px' }}>★ Capturé</span>}
                                    {!caught && seen && <span style={{ color: theme.colors.info, marginLeft: '6px' }}>Vu</span>}
                                </div>
                            </div>

                            {/* Types */}
                            <div style={{ display: 'flex', justifyContent: 'center', gap: `${theme.spacing.sm}px`, marginBottom: `${theme.spacing.lg}px` }}>
                                {selectedPokemon.types.map(t => (
                                    <span key={t} style={{
                                        fontSize: theme.font.xs,
                                        fontFamily: theme.font.family,
                                        padding: '3px 10px',
                                        background: `linear-gradient(180deg, ${typeColors[t] || theme.colors.borderDark}, ${typeColors[t] || theme.colors.borderDark}aa)`,
                                        borderRadius: `${theme.radius.sm}px`,
                                        textTransform: 'uppercase',
                                        color: theme.colors.textPrimary,
                                        letterSpacing: '0.5px',
                                    }}>
                                        {t}
                                    </span>
                                ))}
                            </div>

                            {/* Base stats */}
                            <div style={{
                                background: `${theme.colors.deepBg}cc`,
                                borderRadius: `${theme.radius.md}px`,
                                padding: `${theme.spacing.md}px`,
                                marginBottom: `${theme.spacing.lg}px`,
                                border: theme.borders.thin(theme.colors.borderDark),
                            }}>
                                <div style={{
                                    color: theme.colors.textDim,
                                    fontSize: theme.font.micro,
                                    fontFamily: theme.font.family,
                                    marginBottom: `${theme.spacing.sm}px`,
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px',
                                }}>
                                    Stats de base
                                </div>
                                {([
                                    ['PV', selectedPokemon.baseStats.hp],
                                    ['ATK', selectedPokemon.baseStats.attack],
                                    ['DEF', selectedPokemon.baseStats.defense],
                                    ['SPA', selectedPokemon.baseStats.spAtk],
                                    ['SPD', selectedPokemon.baseStats.spDef],
                                    ['VIT', selectedPokemon.baseStats.speed],
                                ] as [string, number][]).map(([label, value]) => {
                                    const barPercent = Math.min(100, (value / 255) * 100);
                                    const barColor = value >= 120 ? theme.colors.success : value >= 80 ? theme.colors.info : value >= 50 ? theme.colors.warning : theme.colors.danger;
                                    return (
                                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                            <span style={{ color: theme.colors.textDim, fontSize: theme.font.micro, fontFamily: theme.font.family, width: '24px', flexShrink: 0 }}>
                                                {label}
                                            </span>
                                            <span style={{ color: theme.colors.textPrimary, fontSize: theme.font.micro, fontFamily: theme.font.family, width: '24px', textAlign: 'right', flexShrink: 0 }}>
                                                {value}
                                            </span>
                                            <div style={{ flex: 1, height: '5px', background: theme.colors.borderDark, borderRadius: '3px', overflow: 'hidden' }}>
                                                <div style={{
                                                    width: `${barPercent}%`,
                                                    height: '100%',
                                                    background: `linear-gradient(90deg, ${barColor}, ${barColor}88)`,
                                                    borderRadius: '3px',
                                                }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>
                                    Fermer
                                </Button>
                            </div>
                        </>
                    );
                })()}
            </Modal>
        </div>
    );
}
