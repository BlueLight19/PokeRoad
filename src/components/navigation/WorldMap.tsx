import React from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getAllZones } from '../../utils/dataLoader';
import { Button } from '../ui/Button';

export function WorldMap() {
  const { player, progress, selectZone, setView } = useGameStore();

  const zones = getAllZones();

  // Define zone order for display
  const zoneOrder = ['bourg-palette', 'route-1', 'jadielle', 'route-2', 'foret-jade', 'argenta', 'route-3'];

  const orderedZones = zoneOrder
    .map(id => zones.find(z => z.id === id))
    .filter(Boolean);

  return (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          padding: '12px',
          background: '#1a1a2e',
          borderRadius: '8px',
          border: '2px solid #333',
        }}
      >
        <div>
          <div style={{ color: '#e94560', fontSize: '12px', fontFamily: "'Press Start 2P', monospace" }}>
            {player.name}
          </div>
          <div style={{ color: '#FFD600', fontSize: '10px', fontFamily: "'Press Start 2P', monospace", marginTop: '4px' }}>
            {player.money}P
          </div>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: i < player.badges.length ? '#FFD600' : '#333',
                border: '1px solid #555',
              }}
            />
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <Button variant="secondary" size="sm" onClick={() => setView('team')}>
          Equipe
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setView('pc')}>
          PC
        </Button>
      </div>

      {/* Zone map */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        {orderedZones.map(zone => {
          if (!zone) return null;
          const isUnlocked = progress.unlockedZones.includes(zone.id);
          const isCurrent = progress.currentZone === zone.id;
          const isCity = (zone as any).type === 'city';

          // Check if all trainers in this zone are defeated
          const zoneTrainers: string[] = (zone as any).trainers || [];
          const allDefeated = zoneTrainers.length > 0 &&
            zoneTrainers.every(t => progress.defeatedTrainers.includes(t));

          return (
            <button
              key={zone.id}
              onClick={() => isUnlocked && selectZone(zone.id)}
              disabled={!isUnlocked}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: isCurrent
                  ? 'linear-gradient(90deg, #e94560 0%, #1a1a2e 100%)'
                  : isUnlocked
                    ? '#1a1a2e'
                    : '#0a0a15',
                border: isUnlocked ? '2px solid' : '2px solid #222',
                borderColor: isCurrent ? '#e94560' : isCity ? '#FFD600' : '#4CAF50',
                borderRadius: '8px',
                cursor: isUnlocked ? 'pointer' : 'not-allowed',
                opacity: isUnlocked ? 1 : 0.4,
                transition: 'all 0.2s ease',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: isCity ? '8px' : '50%',
                  background: isCity ? '#FFD600' : '#4CAF50',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  flexShrink: 0,
                }}
              >
                {isCity ? 'V' : 'R'}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    color: '#fff',
                    fontSize: '11px',
                    fontFamily: "'Press Start 2P', monospace",
                  }}
                >
                  {zone.name}
                </div>
                {!isCity && zoneTrainers.length > 0 && (
                  <div
                    style={{
                      color: allDefeated ? '#4CAF50' : '#aaa',
                      fontSize: '8px',
                      fontFamily: "'Press Start 2P', monospace",
                      marginTop: '4px',
                    }}
                  >
                    Dresseurs: {progress.defeatedTrainers.filter(t => zoneTrainers.includes(t)).length}/{zoneTrainers.length}
                    {allDefeated && ' OK'}
                  </div>
                )}
              </div>
              {isCurrent && (
                <div style={{ color: '#e94560', fontSize: '16px' }}>&#9658;</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
