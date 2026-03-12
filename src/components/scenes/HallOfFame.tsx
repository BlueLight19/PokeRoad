import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
// Removed PlayArea import
import { Button } from '../ui/Button';
import { PokemonInstance } from '../../types/pokemon';
import pokemonData from '../../data/gen1/pokemon.json';

interface HallOfFameProps {
    onComplete: () => void;
}

export const HallOfFame: React.FC<HallOfFameProps> = ({ onComplete }) => {
    const { team, player } = useGameStore();
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [showFinale, setShowFinale] = useState(false);

    // Play a victory fanfare on mount
    useEffect(() => {
        // In a real app we'd trigger the sound manager here
        const autoAdvance = setInterval(() => {
            setCurrentIndex((prev) => {
                if (prev >= team.length - 1) {
                    clearInterval(autoAdvance);
                    setTimeout(() => setShowFinale(true), 1500);
                    return prev;
                }
                return prev + 1;
            });
        }, 2000); // Show each Pokemon for 2 seconds

        return () => clearInterval(autoAdvance);
    }, [team.length]);

    const displayedPokemon = currentIndex >= 0 ? team[currentIndex] : null;
    const displayedData = displayedPokemon ? pokemonData.find(p => p.id === displayedPokemon.dataId) : null;

    return (
        <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'linear-gradient(to bottom, #111, #000)', // Darker, solemn background
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            zIndex: 100 // Ensure it covers everything
        }}>
            {/* Sparkles / Confetti Effects */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                pointerEvents: 'none',
                backgroundImage: 'radial-gradient(circle, white 2px, transparent 2px)',
                backgroundSize: '100px 100px',
                opacity: 0.1,
                animation: 'panBackground 10s linear infinite',
            }} />
            <style>{`
        @keyframes panBackground {
          from { background-position: 0 0; }
          to { background-position: -100px 100px; }
        }
        @keyframes slideInUp {
          from { transform: translateY(50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

            {!showFinale ? (
                <div style={{ textAlign: 'center', zIndex: 10 }}>
                    {currentIndex === -1 ? (
                        <h1 style={{ color: '#FFD700', fontFamily: "'Press Start 2P', monospace", fontSize: '24px', animation: 'fadeIn 2s' }}>
                            Panthéon des Dresseurs
                        </h1>
                    ) : displayedPokemon ? (
                        <div key={displayedPokemon.uid} style={{ animation: 'slideInUp 0.5s ease-out' }}>
                            <img
                                src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${displayedPokemon.dataId}.png`}
                                alt={displayedPokemon.nickname || displayedData?.name || `Pokemon ${displayedPokemon.dataId}`}
                                style={{ width: '250px', height: '250px', objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(255, 215, 0, 0.5))' }}
                            />
                            <h2 style={{ color: '#FFF', fontFamily: "'Press Start 2P', monospace", fontSize: '20px', margin: '20px 0 10px 0' }}>
                                {displayedPokemon.nickname || displayedData?.name}
                            </h2>
                            <div style={{ color: '#AAA', fontFamily: "'Press Start 2P', monospace", fontSize: '12px', lineHeight: '1.5' }}>
                                Niveau {displayedPokemon.level}<br />
                                Numéro ID: {player.name.substring(0, 5).toUpperCase() + '01'}
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : (
                <div style={{ textAlign: 'center', zIndex: 10, animation: 'fadeIn 2s' }}>
                    <h1 style={{ color: '#FFD700', fontFamily: "'Press Start 2P', monospace", fontSize: '28px', lineHeight: '1.5', marginBottom: '40px' }}>
                        Félicitations {player.name} !<br />
                        Tu as vaincu la Ligue Pokémon !
                    </h1>
                    <p style={{ color: '#FFF', fontFamily: "'Press Start 2P', monospace", fontSize: '14px', marginBottom: '40px' }}>
                        Ton nom et tes Pokémon resteront à jamais gravés<br />dans l'histoire de Kanto.
                    </p>
                    <Button onClick={onComplete} style={{ fontSize: '16px', padding: '15px 30px' }}>
                        Fin
                    </Button>
                </div>
            )}
        </div>
    );
};
