import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useBattleStore } from '../../stores/battleStore';
import { getZoneData, getGymData, getZoneTrainers } from '../../utils/dataLoader';
import { Button } from '../ui/Button';
import { NPCData, CityData, RouteData, StaticEncounter } from '../../types/game';

export function CityMenu() {
  const { selectedZone, team, player, progress, setView, addItem, givePlayerPokemon, triggerEvent } = useGameStore();
  const { startGymBattle, startWildBattle } = useBattleStore();
  const [healMessage, setHealMessage] = useState('');
  const [activeNpc, setActiveNpc] = useState<NPCData | null>(null);
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [gymExpanded, setGymExpanded] = useState(false);

  if (!selectedZone) return null;

  const zone = getZoneData(selectedZone) as CityData | RouteData;
  const isCity = zone.type === 'city';
  const hasShop = (zone as CityData).hasShop;
  const gymId = (zone as CityData).gymId;
  const filteredTrainers = getZoneTrainers(selectedZone, player.starter);
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
      <NpcDialogue
        npc={activeNpc}
        dialogueIndex={dialogueIndex}
        onAdvance={advanceDialogue}
      />
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

        {/* Gym (with all zone trainers inside) */}
        {gym && (() => {
          const allTrainersDefeated = filteredTrainers.every(t => progress.defeatedTrainers.includes(t.id));
          const trainerCount = filteredTrainers.length;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
              {/* Gym header button */}
              <button
                onClick={() => {
                  if (gymLocked) return;
                  if (gymDefeated) return;
                  setGymExpanded(!gymExpanded);
                }}
                disabled={gymLocked}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  background: gymDefeated ? '#1a1a1a' : gymLocked ? '#1a1a1a' : '#2e1a1a',
                  border: gymDefeated ? '2px solid #333' : gymLocked ? '2px solid #555' : '2px solid #e94560',
                  borderRadius: gymExpanded && !gymDefeated && !gymLocked ? '8px 8px 0 0' : '8px',
                  cursor: gymDefeated || gymLocked ? 'default' : 'pointer',
                  opacity: gymDefeated ? 0.6 : gymLocked ? 0.5 : 1,
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <span style={{ fontSize: '20px' }}>
                  {gymDefeated ? '\u2605' : gymLocked ? '\u{1F512}' : gymExpanded ? '\u25BC' : '\u25B6'}
                </span>
                <div style={{ flex: 1 }}>
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
                    {gymDefeated
                      ? 'Badge obtenu !'
                      : gymLocked
                        ? gymLockReason
                        : trainerCount > 0
                          ? `${trainerCount} dresseur${trainerCount > 1 ? 's' : ''} + Champion`
                          : `Champion - ${gym.team.length} Pokemon`}
                  </div>
                </div>
              </button>

              {/* Expanded: all zone trainers + gym leader */}
              {gymExpanded && !gymDefeated && !gymLocked && (
                <div style={{
                  background: '#1a1a1a',
                  border: '2px solid #e94560',
                  borderTop: 'none',
                  borderRadius: '0 0 8px 8px',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}>
                  {/* Zone trainers */}
                  {filteredTrainers.map(trainer => {
                    const defeated = progress.defeatedTrainers.includes(trainer.id);
                    return (
                      <button
                        key={trainer.id}
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
                          gap: '10px',
                          padding: '10px 12px',
                          background: defeated ? '#111' : '#2a1a1a',
                          border: defeated ? '1px solid #333' : '1px solid #c0392b',
                          borderRadius: '6px',
                          cursor: defeated ? 'default' : 'pointer',
                          opacity: defeated ? 0.5 : 1,
                          textAlign: 'left',
                          width: '100%',
                        }}
                      >
                        <span style={{ fontSize: '14px' }}>{defeated ? 'x' : '!'}</span>
                        <div>
                          <div style={{
                            color: defeated ? '#666' : '#c0392b',
                            fontSize: '9px',
                            fontFamily: "'Press Start 2P', monospace",
                            textDecoration: defeated ? 'line-through' : 'none',
                          }}>
                            {trainer.trainerClass} {trainer.name}
                          </div>
                          <div style={{
                            color: '#888',
                            fontSize: '7px',
                            fontFamily: "'Press Start 2P', monospace",
                            marginTop: '3px',
                          }}>
                            {defeated ? 'Vaincu' : `${trainer.team.length} Pokemon`}
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {/* Gym leader — only clickable when all trainers defeated */}
                  <button
                    onClick={() => {
                      if (!allTrainersDefeated) return;
                      handleGymBattle();
                    }}
                    disabled={!allTrainersDefeated}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px',
                      background: allTrainersDefeated ? '#3a1a1a' : '#111',
                      border: allTrainersDefeated ? '2px solid #FFD600' : '2px solid #444',
                      borderRadius: '6px',
                      cursor: allTrainersDefeated ? 'pointer' : 'default',
                      opacity: allTrainersDefeated ? 1 : 0.4,
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <span style={{ fontSize: '16px', color: allTrainersDefeated ? '#FFD600' : '#555' }}>
                      {'\u2605'}
                    </span>
                    <div>
                      <div style={{
                        color: allTrainersDefeated ? '#FFD600' : '#555',
                        fontSize: '10px',
                        fontFamily: "'Press Start 2P', monospace",
                      }}>
                        Champion: {gym.leader}
                      </div>
                      <div style={{
                        color: '#888',
                        fontSize: '7px',
                        fontFamily: "'Press Start 2P', monospace",
                        marginTop: '3px',
                      }}>
                        {allTrainersDefeated
                          ? `${gym.team.length} Pokemon - Pret au combat !`
                          : 'Battez tous les dresseurs d\'abord'}
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Zone trainers — only shown if NO gym in this city */}
        {!gym && filteredTrainers.map(trainer => {
          const defeated = progress.defeatedTrainers.includes(trainer.id);

          return (
            <button
              key={trainer.id}
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

function NpcDialogue({ npc, dialogueIndex, onAdvance }: { npc: NPCData; dialogueIndex: number; onAdvance: () => void }) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const fullText = npc.dialogue[dialogueIndex];

  useEffect(() => {
    setDisplayedText('');
    setIsTyping(true);
    let current = 0;
    const interval = setInterval(() => {
      current++;
      setDisplayedText(fullText.slice(0, current));
      if (current >= fullText.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 10);
    return () => clearInterval(interval);
  }, [fullText]);

  const handleClick = () => {
    if (isTyping) {
      setDisplayedText(fullText);
      setIsTyping(false);
    } else {
      onAdvance();
    }
  };

  return (
    <div style={{ padding: '16px', maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
      {/* NPC name tag */}
      <div style={{
        background: 'linear-gradient(90deg, #FFD600, #FFA000)',
        padding: '6px 16px',
        borderRadius: '8px 8px 0 0',
        display: 'inline-block',
        alignSelf: 'flex-start',
      }}>
        <span style={{ color: '#000', fontSize: '10px', fontFamily: "'Press Start 2P', monospace", fontWeight: 'bold' }}>
          {npc.name}
        </span>
      </div>

      {/* Dialogue box */}
      <div
        onClick={handleClick}
        style={{
          flex: 1,
          background: '#0f1923',
          border: '3px solid #FFD600',
          borderRadius: '0 12px 12px 12px',
          padding: '20px',
          color: '#fff',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '10px',
          lineHeight: '2',
          marginBottom: '16px',
          cursor: 'pointer',
          minHeight: '120px',
          position: 'relative',
          boxShadow: '0 0 15px rgba(255, 214, 0, 0.1), inset 0 0 30px rgba(0, 0, 0, 0.3)',
        }}
      >
        {displayedText}
        {!isTyping && (
          <span style={{
            position: 'absolute',
            bottom: '10px',
            right: '14px',
            fontSize: '8px',
            color: '#FFD600',
            animation: 'pulse 1s infinite alternate',
          }}>
            {dialogueIndex < npc.dialogue.length - 1 ? '\u25BC' : '\u2715'}
          </span>
        )}
      </div>

      {/* Progress dots */}
      {npc.dialogue.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '12px' }}>
          {npc.dialogue.map((_, i) => (
            <div key={i} style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: i === dialogueIndex ? '#FFD600' : i < dialogueIndex ? '#666' : '#333',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
      )}

      <Button onClick={handleClick} style={{ width: '100%' }}>
        {isTyping ? 'Passer' : dialogueIndex < npc.dialogue.length - 1 ? 'Suivant' : 'Fermer'}
      </Button>
    </div>
  );
}
