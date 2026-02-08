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
  } = useGameStore();
  const { startWildBattle, startTrainerBattle } = useBattleStore();

  if (!selectedZone) return null;

  const zone = getZoneData(selectedZone) as any;
  const wildEncounters: WildEncounter[] = zone.wildEncounters || [];
  const trainerIds: string[] = zone.trainers || [];

  const handleWildEncounter = () => {
    if (wildEncounters.length === 0) return;
    startWildBattle(wildEncounters, team);
    setView('battle');
  };

  const handleTrainerBattle = (trainerId: string) => {
    if (isTrainerDefeated(trainerId)) return;
    const trainer = getTrainerData(trainerId);
    startTrainerBattle(trainer, team);
    setView('battle');
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Wild encounters */}
        {wildEncounters.length > 0 && (
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
        )}

        {/* Special Encounters (Legendaries/Snorlax) */}
        {(() => {
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
        })()}

        {/* Trainers */}
        {trainerIds.map(trainerId => {
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
        })}

        {/* Back button */}
        <div style={{ marginTop: '12px' }}>
          <Button variant="ghost" onClick={() => setView('world_map')}>
            Retour
          </Button>
        </div>
      </div>
    </div >
  );
}
