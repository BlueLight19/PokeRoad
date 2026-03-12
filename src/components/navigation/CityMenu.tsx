import React, { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useBattleStore } from '../../stores/battleStore';
import { getZoneData, getGymData, getTrainerData } from '../../utils/dataLoader';
import { Button } from '../ui/Button';
import { NPCData, CityData, RouteData, StaticEncounter } from '../../types/game';

export function CityMenu() {
  const { selectedZone, team, player, progress, setView, addItem, givePlayerPokemon, triggerEvent } = useGameStore();
  const { startGymBattle, startWildBattle } = useBattleStore();
  const [healMessage, setHealMessage] = useState('');
  const [activeNpc, setActiveNpc] = useState<NPCData | null>(null);
  const [dialogueIndex, setDialogueIndex] = useState(0);

  if (!selectedZone) return null;

  const zone = getZoneData(selectedZone) as CityData | RouteData;
  const isCity = zone.type === 'city';
  const hasShop = (zone as CityData).hasShop;
  const gymId = (zone as CityData).gymId;
  const trainers: string[] = zone.trainers || [];
  const npcs: NPCData[] = zone.npcs || [];
  const staticEncounters: StaticEncounter[] = (zone as any).staticEncounters || [];

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
    const state = useGameStore.getState();
    state.healTeam();
    // Track last Pokemon Center for blackout
    if (selectedZone) {
      useGameStore.setState({
        progress: { ...state.progress, lastPokemonCenter: selectedZone },
      });
    }
    setHealMessage('Votre equipe est soignee !');
    setTimeout(() => setHealMessage(''), 2000);
    useGameStore.getState().saveGameState();
  };

  const handleNpcClick = (npc: NPCData) => {
    setActiveNpc(npc);
    setDialogueIndex(0);
  };

  const advanceDialogue = () => {
    if (!activeNpc) return;

    if (dialogueIndex < activeNpc.dialogue.length - 1) {
      setDialogueIndex(prev => prev + 1);
    } else {
      // End of dialogue, give rewards if any
      if (activeNpc.setsEvent && !progress.events[activeNpc.setsEvent]) {
        triggerEvent(activeNpc.setsEvent);
        if (activeNpc.givesItem) {
          addItem(activeNpc.givesItem, 1);
        }
        if (activeNpc.givesPokemon) {
          givePlayerPokemon(activeNpc.givesPokemon.pokemonId, activeNpc.givesPokemon.level);
        }
      }
      setActiveNpc(null);
    }
  };

  if (activeNpc) {
    return (
      <div style={{ padding: '16px', maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <h2 style={{ color: '#FFD600', fontSize: '16px', fontFamily: "'Press Start 2P', monospace", marginBottom: '20px', textAlign: 'center' }}>
          {activeNpc.name}
        </h2>
        <div style={{
          flex: 1,
          background: '#0a0a15',
          border: '2px solid #333',
          borderRadius: '8px',
          padding: '16px',
          color: '#fff',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '12px',
          lineHeight: '1.6',
          marginBottom: '20px',
        }}>
          {activeNpc.dialogue[dialogueIndex]}
        </div>
        <Button onClick={advanceDialogue} style={{ width: '100%' }}>
          {dialogueIndex < activeNpc.dialogue.length - 1 ? 'Suivant' : 'Fermer'}
        </Button>
      </div>
    );
  }

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
        {/* NPCs */}
        {npcs.map(npc => {
          if (npc.requiredEvent && !progress.events[npc.requiredEvent]) return null;

          const isCompleted = npc.setsEvent ? progress.events[npc.setsEvent] : false;

          return (
            <button
              key={npc.id}
              onClick={() => handleNpcClick(npc)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                background: isCompleted ? '#1a1a1a' : '#1a2e1a',
                border: isCompleted ? '2px solid #333' : '2px solid #4CAF50',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
                opacity: isCompleted ? 0.7 : 1,
              }}
            >
              <span style={{ fontSize: '20px' }}>💬</span>
              <div>
                <div style={{ color: isCompleted ? '#888' : '#4CAF50', fontSize: '11px', fontFamily: "'Press Start 2P', monospace" }}>
                  {npc.name}
                </div>
                <div style={{ color: '#888', fontSize: '8px', fontFamily: "'Press Start 2P', monospace", marginTop: '4px' }}>
                  {isCompleted ? 'Deja parle' : 'Interagir'}
                </div>
              </div>
            </button>
          );
        })}

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

        {/* Static Encounters */}
        {staticEncounters.map((encounter: StaticEncounter) => {
          if (progress.events[encounter.id]) return null;
          if (encounter.requiredItem && !useGameStore.getState().inventory.some(i => i.itemId === encounter.requiredItem && i.quantity > 0)) return null;

          return (
            <button
              key={encounter.id}
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
                <div style={{ color: '#333', fontSize: '8px', fontFamily: "'Press Start 2P', monospace", marginTop: '4px', lineHeight: '1.4' }}>
                  {encounter.dialogue || 'Une présence imposante...'}
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
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 16px',
              background: useGameStore.getState().player.money < 500 ? '#1a1a1a' : '#2E7D32',
              border: useGameStore.getState().player.money < 500 ? '2px solid #333' : '2px solid #4CAF50',
              borderRadius: '8px',
              cursor: useGameStore.getState().player.money < 500 ? 'not-allowed' : 'pointer',
              opacity: useGameStore.getState().player.money < 500 ? 0.5 : 1,
              textAlign: 'left' as const,
            }}
          >
            <span style={{ fontSize: '20px' }}>S</span>
            <div>
              <div style={{
                color: '#fff',
                fontSize: '11px',
                fontFamily: "'Press Start 2P', monospace",
              }}>
                Parc Safari
              </div>
              <div style={{
                color: '#ccc',
                fontSize: '8px',
                fontFamily: "'Press Start 2P', monospace",
                marginTop: '4px',
              }}>
                Cout: 500P
              </div>
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
