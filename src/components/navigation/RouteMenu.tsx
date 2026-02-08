import React from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useBattleStore } from '../../stores/battleStore';
import { getZoneData, getTrainerData } from '../../utils/dataLoader';
import { Button } from '../ui/Button';
import { WildEncounter } from '../../types/game';

export function RouteMenu() {
  const {
    selectedZone,
    progress,
    team,
    setView,
    isTrainerDefeated,
    decrementRepelSteps,
    setRepelSteps, // In case we want to show it
  } = useGameStore();
  const { startWildBattle, startTrainerBattle } = useBattleStore();

  if (!selectedZone) return null;

  const zone = getZoneData(selectedZone) as any;
  const wildEncounters: WildEncounter[] = zone.wildEncounters || [];
  const trainerIds: string[] = zone.trainers || [];

  const handleWildEncounter = () => {
    if (wildEncounters.length === 0) return;

    // Repel Logic
    if (progress.repelSteps > 0) {
      decrementRepelSteps();

      const leadLevel = team[0]?.level || 0;
      // Filter out pokemon that are strictly lower level than lead
      // Note: wildEncounter has minLevel/maxLevel. 
      // Simplified: if maxLevel < leadLevel, it's blocked.
      const available = wildEncounters.filter(e => e.maxLevel >= leadLevel);

      if (available.length === 0) {
        // All blocked
        if (progress.repelSteps === 1) {
          alert("L'effet du Repousse se dissipe.");
        }
        return;
      }

      // If we are here, some pokemon can appear.
      // We should probably pass the filtered list to startWildBattle?
      // Yes.
      startWildBattle(available, team);
    } else {
      startWildBattle(wildEncounters, team);
    }

    setView('battle');
  };

  const handleTrainerBattle = (trainerId: string) => {
    if (isTrainerDefeated(trainerId)) return;
    const trainer = getTrainerData(trainerId);
    startTrainerBattle(trainer, team);
    setView('battle');
  };

  const handleSafariSearch = () => {
    const { safariState } = useGameStore.getState();
    if (!safariState || safariState.steps <= 0) {
      useGameStore.getState().quitSafari();
      alert("Safari terminé !");
      return;
    }

    // Decrement steps
    const newSteps = safariState.steps - 1;
    useGameStore.setState({ safariState: { ...safariState, steps: newSteps } });

    // Trigger encounter
    if (wildEncounters.length > 0) {
      startWildBattle(wildEncounters, team);
      setView('battle');
    }

    if (newSteps <= 0) {
      // Should we force quit now or after battle? 
      // Usually after battle. 
      // StartBattle works. When coming back, if steps 0, auto-quit?
      // Let's handle auto-quit in handleEndBattle or here if no encounter.
    }
  };

  return (
    <div style={{ padding: '16px', maxWidth: '500px', margin: '0 auto' }}>
      <h2
        style={{
          color: '#4CAF50',
          fontSize: '16px',
          fontFamily: "'Press Start 2P', monospace",
          marginBottom: '20px',
          textAlign: 'center',
        }}
      >
        {zone.name}
      </h2>

      {useGameStore.getState().safariState && (
        <div style={{
          background: '#FFD700',
          color: '#000',
          padding: '10px',
          borderRadius: '8px',
          marginBottom: '10px',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '10px',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <span>Balls: {useGameStore.getState().safariState?.balls}</span>
          <span>Pas: {useGameStore.getState().safariState?.steps}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

        {/* Safari Action */}
        {useGameStore.getState().safariState ? (
          <button
            onClick={handleSafariSearch}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 16px',
              background: '#2E7D32',
              border: '2px solid #4CAF50',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '20px' }}>🦁</span>
            <div>
              <div style={{ color: '#fff', fontSize: '11px', fontFamily: "'Press Start 2P', monospace" }}>
                Chasser un Pokémon
              </div>
              <div style={{
                color: '#ccc', fontSize: '8px', fontFamily: "'Press Start 2P', monospace", marginTop: '4px'
              }}>
                Chercher dans les herbes
              </div>
            </div>
          </button>
        ) : (
          /* Standard Wild encounters */
          wildEncounters.length > 0 && (
            <button
              onClick={handleWildEncounter}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                background: '#1a2e1a',
                border: '2px solid #4CAF50',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '20px' }}>~</span>
              <div>
                <div
                  style={{
                    color: '#4CAF50',
                    fontSize: '11px',
                    fontFamily: "'Press Start 2P', monospace",
                  }}
                >
                  Hautes herbes
                </div>
                <div
                  style={{
                    color: '#888',
                    fontSize: '8px',
                    fontFamily: "'Press Start 2P', monospace",
                    marginTop: '4px',
                  }}
                >
                  Pokemon sauvages
                </div>
              </div>
            </button>
          ))
        }

        {/* Special Encounters (Legendaries/Snorlax) */}
        {
          (() => {
            const specialEncounters: Record<string, { id: string, name: string, description: string, pokemonId: number, level: number }> = {
              'victory-road': { id: 'legendary-moltres', name: 'Oiseau de Feu', description: 'Une créature légendaire brûle dans l\'ombre.', pokemonId: 146, level: 50 },
              'power-plant': { id: 'legendary-zapdos', name: 'Oiseau de Foudre', description: 'L\'air crépite d\'électricité...', pokemonId: 145, level: 50 },
              'seafoam-islands': { id: 'legendary-articuno', name: 'Oiseau de Glace', description: 'Un froid surnaturel émane du fond.', pokemonId: 144, level: 50 },
              'cerulean-cave': { id: 'legendary-mewtwo', name: '???', description: 'Une pression psychique écrasante...', pokemonId: 150, level: 70 },
              'route-12': { id: 'snorlax-12', name: 'Ronflex', description: 'Un gros Pokémon bloque le chemin.', pokemonId: 143, level: 30 },
              'route-16': { id: 'snorlax-16', name: 'Ronflex', description: 'Un gros Pokémon dort paisiblement.', pokemonId: 143, level: 30 },
            };

            const encounter = specialEncounters[selectedZone];
            if (!encounter) return null;

            // Check if already defeated
            if (isTrainerDefeated(encounter.id)) return null;

            return (
              <button
                onClick={() => {
                  startWildBattle([{ pokemonId: encounter.pokemonId, minLevel: encounter.level, maxLevel: encounter.level, rate: 100 }], team, encounter.id);
                  setView('battle');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                  border: '2px solid #FFD700',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: '0 0 10px rgba(255, 215, 0, 0.3)',
                }}
              >
                <span style={{ fontSize: '20px' }}>★</span>
                <div>
                  <div style={{ color: '#000', fontSize: '11px', fontFamily: "'Press Start 2P', monospace", fontWeight: 'bold' }}>
                    {encounter.name}
                  </div>
                  <div style={{ color: '#333', fontSize: '8px', fontFamily: "'Press Start 2P', monospace", marginTop: '4px' }}>
                    {encounter.description}
                  </div>
                </div>
              </button>
            );
          })()
        }

        {/* Trainers */}
        {
          trainerIds.map(trainerId => {
            const trainer = getTrainerData(trainerId);
            const defeated = isTrainerDefeated(trainerId);

            return (
              <button
                key={trainerId}
                onClick={() => handleTrainerBattle(trainerId)}
                disabled={defeated}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  background: defeated ? '#1a1a1a' : '#1a1a2e',
                  border: defeated ? '2px solid #333' : '2px solid #e94560',
                  borderRadius: '8px',
                  cursor: defeated ? 'default' : 'pointer',
                  opacity: defeated ? 0.5 : 1,
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '20px' }}>{defeated ? 'x' : '!'}</span>
                <div>
                  <div
                    style={{
                      color: defeated ? '#666' : '#e94560',
                      fontSize: '11px',
                      fontFamily: "'Press Start 2P', monospace",
                      textDecoration: defeated ? 'line-through' : 'none',
                    }}
                  >
                    {trainer.trainerClass} {trainer.name}
                  </div>
                  <div
                    style={{
                      color: '#888',
                      fontSize: '8px',
                      fontFamily: "'Press Start 2P', monospace",
                      marginTop: '4px',
                    }}
                  >
                    {defeated ? 'Vaincu' : `${trainer.team.length} Pokemon`}
                  </div>
                </div>
              </button>
            );
          })
        }

        {/* Quit Safari or Back */}
        <div style={{ marginTop: '12px' }}>
          {useGameStore.getState().safariState ? (
            <Button variant="danger" onClick={useGameStore.getState().quitSafari}>
              Quitter le Safari
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setView('world_map')}>
              Retour
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
