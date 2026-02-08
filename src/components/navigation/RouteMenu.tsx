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
    </div>
  );
}
