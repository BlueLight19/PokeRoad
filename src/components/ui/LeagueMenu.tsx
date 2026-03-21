
import React from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useBattleStore } from '../../stores/battleStore';
import { getTrainerData } from '../../utils/dataLoader';
import { Button } from '../ui/Button';

export const LeagueMenu: React.FC = () => {
    const { setView, progress } = useGameStore();
    const { startTrainerBattle } = useBattleStore();

    const handleChallenge = (trainerId: string) => {
        const trainer = getTrainerData(trainerId);
        if (!trainer) return;

        // Set last Pokemon Center to Plateau Indigo for league
        const state = useGameStore.getState();
        useGameStore.setState({
            progress: { ...state.progress, lastPokemonCenter: 'plateau-indigo' },
        });

        // Start battle
        startTrainerBattle(trainer, useGameStore.getState().team);
        setView('battle');
    };

    const elite4 = [
        { id: 'league-lorelei', name: 'Olga (Glace/Eau)', req: 0 },
        { id: 'league-bruno', name: 'Aldo (Combat/Roche)', req: 1 },
        { id: 'league-agatha', name: 'Agatha (Spectre)', req: 2 },
        { id: 'league-lance', name: 'Peter (Dragon)', req: 3 },
        { id: 'league-champion', name: 'Maître Blue', req: 4 },
    ];

    const currentStep = progress.leagueProgress || 0;

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #2c3e50 0%, #000000 100%)',
            padding: '20px',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
        }}>
            <h1 style={{ fontFamily: "'Press Start 2P', monospace", color: '#FFD700', marginBottom: '30px', textAlign: 'center', lineHeight: '1.5' }}>
                LIGUE POKEMON<br />PLATEAU INDIGO
            </h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '400px' }}>
                {elite4.map((e4, index) => {
                    const isUnlocked = currentStep >= e4.req;
                    const isDefeated = currentStep > e4.req;
                    const isNext = currentStep === e4.req;

                    return (
                        <div key={e4.id} style={{
                            opacity: isUnlocked ? 1 : 0.5,
                            transform: isNext ? 'scale(1.05)' : 'scale(1)',
                            transition: 'all 0.3s ease'
                        }}>
                            <Button
                                variant={isNext ? 'primary' : 'secondary'}
                                disabled={!isUnlocked || isDefeated}
                                onClick={() => handleChallenge(e4.id)}
                                style={{ width: '100%' }}
                            >
                                {isDefeated ? `✅ ${e4.name} (Vaincu)` : isUnlocked ? `⚔️ ${e4.name}` : `???`}
                            </Button>
                        </div>
                    );
                })}
            </div>

            <div style={{ marginTop: '40px' }}>
                <Button variant="danger" onClick={() => setView('world_map')}>
                    Quitter la Ligue
                </Button>
            </div>

            {currentStep > 0 && (
                <div style={{ marginTop: '20px', color: '#aaa', fontSize: '10px', textAlign: 'center' }}>
                    Attention: Quitter maintenant ne réinitialise pas votre progression,<br />
                    mais perdre un combat vous fera recommencer du début !
                </div>
            )}
        </div>
    );
};
