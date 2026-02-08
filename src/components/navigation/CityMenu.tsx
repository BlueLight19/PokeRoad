import React from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useBattleStore } from '../../stores/battleStore';
import { getZoneData, getGymData } from '../../utils/dataLoader';
import { Button } from '../ui/Button';

export function CityMenu() {
  const { selectedZone, team, player, setView } = useGameStore();
  const { startGymBattle } = useBattleStore();

  if (!selectedZone) return null;

  const zone = getZoneData(selectedZone) as any;
  const hasShop = zone.hasShop;
  const gymId = zone.gymId;

  let gym = null;
  let gymDefeated = false;
  if (gymId) {
    gym = getGymData(gymId);
    gymDefeated = player.badges.includes(gym.badge);
  }

  const handleGymBattle = () => {
    if (!gym || gymDefeated) return;
    startGymBattle(gym, team);
    setView('battle');
  };

  return (
    <div style={{ padding: '16px', maxWidth: '500px', margin: '0 auto' }}>
      <h2
        style={{
          color: '#FFD600',
          fontSize: '16px',
          fontFamily: "'Press Start 2P', monospace",
          marginBottom: '20px',
          textAlign: 'center',
        }}
      >
        {zone.name}
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Shop */}
        {hasShop && (
          <button
            onClick={() => setView('shop')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 16px',
              background: '#1a1a2e',
              border: '2px solid #2196F3',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '20px', color: '#2196F3' }}>$</span>
            <div>
              <div
                style={{
                  color: '#2196F3',
                  fontSize: '11px',
                  fontFamily: "'Press Start 2P', monospace",
                }}
              >
                Boutique
              </div>
              <div
                style={{
                  color: '#888',
                  fontSize: '8px',
                  fontFamily: "'Press Start 2P', monospace",
                  marginTop: '4px',
                }}
              >
                Acheter des objets
              </div>
            </div>
          </button>
        )}

        {/* Gym */}
        {gym && (
          <button
            onClick={handleGymBattle}
            disabled={gymDefeated}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 16px',
              background: gymDefeated ? '#1a1a1a' : '#2e1a1a',
              border: gymDefeated ? '2px solid #333' : '2px solid #e94560',
              borderRadius: '8px',
              cursor: gymDefeated ? 'default' : 'pointer',
              opacity: gymDefeated ? 0.6 : 1,
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '20px' }}>
              {gymDefeated ? '★' : '!'}
            </span>
            <div>
              <div
                style={{
                  color: gymDefeated ? '#FFD600' : '#e94560',
                  fontSize: '11px',
                  fontFamily: "'Press Start 2P', monospace",
                }}
              >
                Arene - {gym.leader}
              </div>
              <div
                style={{
                  color: '#888',
                  fontSize: '8px',
                  fontFamily: "'Press Start 2P', monospace",
                  marginTop: '4px',
                }}
              >
                {gymDefeated ? 'Badge obtenu !' : `${gym.team.length} Pokemon`}
              </div>
            </div>
          </button>
        )}

        {/* Heal */}
        <button
          onClick={() => {
            useGameStore.getState().healTeam();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 16px',
            background: '#1a2e2e',
            border: '2px solid #4CAF50',
            borderRadius: '8px',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: '20px', color: '#4CAF50' }}>+</span>
          <div>
            <div
              style={{
                color: '#4CAF50',
                fontSize: '11px',
                fontFamily: "'Press Start 2P', monospace",
              }}
            >
              Centre Pokemon
            </div>
            <div
              style={{
                color: '#888',
                fontSize: '8px',
                fontFamily: "'Press Start 2P', monospace",
                marginTop: '4px',
              }}
            >
              Soigner votre equipe
            </div>
          </div>
        </button>

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
