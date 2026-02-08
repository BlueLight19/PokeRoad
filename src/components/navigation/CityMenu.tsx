import React, { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useBattleStore } from '../../stores/battleStore';
import { getZoneData, getGymData, getTrainerData } from '../../utils/dataLoader';
import { Button } from '../ui/Button';

export function CityMenu() {
  const { selectedZone, team, player, progress, setView } = useGameStore();
  const { startGymBattle } = useBattleStore();
  const [healMessage, setHealMessage] = useState('');

  if (!selectedZone) return null;

  const zone = getZoneData(selectedZone) as any;
  const hasShop = zone.hasShop;
  const gymId = zone.gymId;
  const trainers: string[] = zone.trainers || [];

  let gym: any = null;
  let gymDefeated = false;
  let gymLocked = false;
  let gymLockReason = '';
  if (gymId) {
    try {
      gym = getGymData(gymId);
      gymDefeated = player.badges.includes(gym.badge);

      // Check gym unlock condition
      const condition = gym.unlockCondition;
      if (condition && !gymDefeated) {
        if (condition.type === 'gym' && condition.gymId) {
          const reqGym = getGymData(condition.gymId);
          if (!player.badges.includes(reqGym.badge)) {
            gymLocked = true;
            gymLockReason = `Battez ${reqGym.leader} d'abord`;
          }
        }
        if (condition.type === 'trainers' && condition.zones) {
          const allDefeated = condition.zones.every((z: string) => {
            try {
              const zoneData = getZoneData(z) as any;
              const zoneTrainers: string[] = zoneData.trainers || [];
              return zoneTrainers.every((t: string) =>
                progress.defeatedTrainers.includes(t)
              );
            } catch {
              return true;
            }
          });
          if (!allDefeated) {
            gymLocked = true;
            gymLockReason = 'Explorez les zones environnantes';
          }
        }
        if (condition.type === 'badge' && condition.badge) {
          if (!player.badges.includes(condition.badge)) {
            gymLocked = true;
            gymLockReason = 'Badge requis manquant';
          }
        }
      }
    } catch {
      gym = null;
    }
  }

  const handleGymBattle = () => {
    if (!gym || gymDefeated || gymLocked) return;
    startGymBattle(gym, team);
    setView('battle');
  };

  const handleHeal = () => {
    useGameStore.getState().healTeam();
    setHealMessage('Votre equipe est soignee !');
    setTimeout(() => setHealMessage(''), 2000);
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
            disabled={gymDefeated || gymLocked}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 16px',
              background: gymDefeated ? '#1a1a1a' : gymLocked ? '#1a1a1a' : '#2e1a1a',
              border: gymDefeated ? '2px solid #333' : gymLocked ? '2px solid #555' : '2px solid #e94560',
              borderRadius: '8px',
              cursor: gymDefeated || gymLocked ? 'default' : 'pointer',
              opacity: gymDefeated ? 0.6 : gymLocked ? 0.5 : 1,
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '20px' }}>
              {gymDefeated ? '\u2605' : gymLocked ? '\u{1F512}' : '!'}
            </span>
            <div>
              <div
                style={{
                  color: gymDefeated ? '#FFD600' : gymLocked ? '#888' : '#e94560',
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
                {gymDefeated ? 'Badge obtenu !' : gymLocked ? gymLockReason : `${gym.team.length} Pokemon`}
              </div>
            </div>
          </button>
        )}

        {/* Zone trainers (for cities with trainers like Rival battles) */}
        {trainers.length > 0 && trainers.map(trainerId => {
          const defeated = progress.defeatedTrainers.includes(trainerId);
          let trainer;
          try {
            trainer = getTrainerData(trainerId);
          } catch {
            return null;
          }
          if (!trainer) return null;

          return (
            <button
              key={trainerId}
              onClick={() => {
                if (defeated) return;
                const { startTrainerBattle } = useBattleStore.getState();
                startTrainerBattle(trainer, team);
                setView('battle');
              }}
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

        {/* Safari Zone */}
        {zone.id === 'parmanie' && (
          <button
            onClick={useGameStore.getState().startSafari}
            disabled={useGameStore.getState().player.money < 500}
            className={`p-4 rounded-xl text-left transition-all border-b-4 flex items-center gap-3 shadow-lg group ${useGameStore.getState().player.money < 500
                ? 'bg-gray-800 border-gray-900 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 border-green-800 text-white hover:scale-[1.02] active:scale-[0.98]'
              }`}
          >
            <div className="bg-black/20 p-2 rounded-lg group-hover:bg-black/30 transition-colors">
              <span className="text-xl">🦁</span>
            </div>
            <div>
              <div className="font-bold font-press-start text-sm">Parc Safari</div>
              <div className="text-xs opacity-75 mt-1 font-press-start">Coût: 500 $</div>
            </div>
          </button>
        )}

        {/* Heal */}
        <button
          onClick={handleHeal}
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
                color: healMessage ? '#4CAF50' : '#888',
                fontSize: '8px',
                fontFamily: "'Press Start 2P', monospace",
                marginTop: '4px',
              }}
            >
              {healMessage || 'Soigner votre equipe'}
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
