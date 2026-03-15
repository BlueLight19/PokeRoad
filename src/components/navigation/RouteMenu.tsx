import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useBattleStore } from '../../stores/battleStore';
import { getZoneData, getTrainerData } from '../../utils/dataLoader';
import { Button } from '../ui/Button';
import { WildEncounter, StaticEncounter, RouteData, CityData, NPCData } from '../../types/game';
import { soundManager } from '../../utils/SoundManager';

export function RouteMenu() {
  const {
    selectedZone,
    progress,
    team,
    setView,
    isTrainerDefeated,
    decrementRepelSteps,
    setRepelSteps, // In case we want to show it
    addItem,
    givePlayerPokemon,
    triggerEvent
  } = useGameStore();
  const { startWildBattle, startTrainerBattle } = useBattleStore();
  const [activeNpc, setActiveNpc] = useState<NPCData | null>(null);
  const [dialogueIndex, setDialogueIndex] = useState(0);

  if (!selectedZone) return null;

  const zone = getZoneData(selectedZone) as unknown as RouteData | CityData;
  const wildEncounters: WildEncounter[] = (zone as RouteData).wildEncounters || [];
  const waterEncounters: WildEncounter[] = (zone as RouteData).waterEncounters || [];
  const fishingEncounters: WildEncounter[] = (zone as RouteData).fishingEncounters || [];
  const staticEncounters = (zone as RouteData).staticEncounters || [];
  const npcs: NPCData[] = (zone as RouteData).npcs || [];
  const trainerIds: string[] = zone.trainers || [];

  const hasSurf = progress.events['hm-03-acquired'] || useGameStore.getState().inventory.some(i => i.itemId === 'hm-03');
  const hasRod = useGameStore.getState().inventory.some(i => ['old-rod', 'good-rod', 'super-rod'].includes(i.itemId));

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

  const handleWaterEncounter = () => {
    if (waterEncounters.length === 0) return;
    startWildBattle(waterEncounters, team);
    setView('battle');
  };

  const handleFishingEncounter = () => {
    if (fishingEncounters.length === 0) return;
    startWildBattle(fishingEncounters, team);
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
    <div style={{ padding: '24px', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{
          width: '100%',
          maxWidth: '600px',
          background: 'rgba(13, 17, 23, 0.85)',
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          borderRadius: '24px',
          border: '3px solid #1a2a3a',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        {/* Header Card */}
        <div style={{
            background: 'linear-gradient(135deg, #1a2e1a 0%, #0f190f 100%)',
            borderRadius: '16px',
            border: '2px solid #4CAF50',
            padding: '20px',
            marginBottom: '24px',
            boxShadow: '0 4px 15px rgba(76, 175, 80, 0.15)',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '4px',
                background: 'linear-gradient(90deg, transparent, #4CAF50, transparent)'
            }} />
            <h2 style={{
                color: '#4CAF50',
                fontSize: '18px',
                fontFamily: "'Press Start 2P', monospace",
                margin: 0,
                textShadow: '0 2px 4px rgba(0,0,0,0.5)'
            }}>
                {zone.name}
            </h2>
            <div style={{ color: '#888', fontSize: '10px', fontFamily: "'Press Start 2P', monospace", marginTop: '8px' }}>
                Zone Sauvage
            </div>
        </div>

      {useGameStore.getState().safariState && (
        <div style={{
          background: 'linear-gradient(90deg, #FFD700, #FFA000)',
          color: '#000',
          padding: '12px 16px',
          borderRadius: '12px',
          marginBottom: '20px',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          fontWeight: 'bold',
          boxShadow: '0 4px 10px rgba(255, 215, 0, 0.2)'
        }}>
          <span>Safari Balls: {useGameStore.getState().safariState?.balls}</span>
          <span>Pas restants: {useGameStore.getState().safariState?.steps}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* NPCs */}
        {npcs.map(npc => {
          if (npc.requiredEvent && !progress.events[npc.requiredEvent]) return null;

          const isCompleted = npc.setsEvent ? progress.events[npc.setsEvent] : false;

          return (
            <button
              key={npc.id}
              onClick={() => {
                soundManager.playClick();
                handleNpcClick(npc);
              }}
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

        {/* Safari Action */}
        {useGameStore.getState().safariState ? (
          <button
            onClick={() => {
              soundManager.playClick();
              handleSafariSearch();
            }}
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
              onClick={() => {
                soundManager.playClick();
                handleWildEncounter();
              }}
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

        {/* Surf Encounters */}
        {!useGameStore.getState().safariState && waterEncounters.length > 0 && hasSurf && (
          <button
            onClick={() => {
              soundManager.playClick();
              handleWaterEncounter();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 16px',
              background: '#0d47a1',
              border: '2px solid #2196f3',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '20px' }}>🌊</span>
            <div>
              <div style={{ color: '#64b5f6', fontSize: '11px', fontFamily: "'Press Start 2P', monospace" }}>
                Surfer sur l'eau
              </div>
              <div style={{ color: '#bbdefb', fontSize: '8px', fontFamily: "'Press Start 2P', monospace", marginTop: '4px' }}>
                Créatures aquatiques
              </div>
            </div>
          </button>
        )}

        {/* Fishing Encounters */}
        {!useGameStore.getState().safariState && fishingEncounters.length > 0 && hasRod && (
          <button
            onClick={() => {
              soundManager.playClick();
              handleFishingEncounter();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 16px',
              background: '#006064',
              border: '2px solid #00bcd4',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '20px' }}>🎣</span>
            <div>
              <div style={{ color: '#4dd0e1', fontSize: '11px', fontFamily: "'Press Start 2P', monospace" }}>
                Pêcher
              </div>
              <div style={{ color: '#b2ebf2', fontSize: '8px', fontFamily: "'Press Start 2P', monospace", marginTop: '4px' }}>
                Lancer la ligne
              </div>
            </div>
          </button>
        )}

        {/* Dynamic Static Encounters (Legendaries/Snorlax) */}
        {
          staticEncounters.map((encounter: StaticEncounter) => {
            // Check if already captured/defeated/completed
            if (progress.events[encounter.id]) return null;
            // Check if required item is in inventory
            if (encounter.requiredItem && !useGameStore.getState().inventory.some(i => i.itemId === encounter.requiredItem && i.quantity > 0)) return null;

            return (
              <button
                key={encounter.id}
                onClick={() => {
                  soundManager.playClick();
                  if (encounter.isGift) {
                    // Direct add without battle
                    const state = useGameStore.getState();
                    // Create pokemon at level
                    // Normally we should expose `createPokemonInstance` but we can't easily import it here cleanly in a JSX dump
                    // Actually we can, but since this is just UI, the easiest is to call a store action. Let's just trigger a battle for now as "gifts" might need a new action. 
                    // To keep it simple, we'll assume all static encounters trigger battles, and gifts run away?
                    // Let's just trigger a standard battle for simplicity. If it's a gift we could add an action.
                    startWildBattle([{ pokemonId: encounter.pokemonId, minLevel: encounter.level, maxLevel: encounter.level, rate: 100 }], team, encounter.id);
                    setView('battle');
                  } else {
                    startWildBattle([{ pokemonId: encounter.pokemonId, minLevel: encounter.level, maxLevel: encounter.level, rate: 100 }], team, encounter.id);
                    setView('battle');
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  background: encounter.isGift ? 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)' : 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                  border: encounter.isGift ? '2px solid #81C784' : '2px solid #FFD700',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: encounter.isGift ? '0 0 10px rgba(76, 175, 80, 0.3)' : '0 0 10px rgba(255, 215, 0, 0.3)',
                }}
              >
                <span style={{ fontSize: '20px' }}>{encounter.isGift ? '🎁' : '★'}</span>
                <div>
                  <div style={{ color: encounter.isGift ? '#fff' : '#000', fontSize: '11px', fontFamily: "'Press Start 2P', monospace", fontWeight: 'bold' }}>
                    {encounter.name}
                  </div>
                  <div style={{ color: encounter.isGift ? '#eee' : '#333', fontSize: '8px', fontFamily: "'Press Start 2P', monospace", marginTop: '4px', lineHeight: '1.4' }}>
                    {encounter.dialogue || (encounter.isGift ? 'Obtenir ce Pokémon ?' : 'Une présence imposante...')}
                  </div>
                </div>
              </button>
            );
          })
        }

        {/* Trainers */}
        {
          trainerIds.map(trainerId => {
            const trainer = getTrainerData(trainerId);
            const defeated = isTrainerDefeated(trainerId);

            return (
              <button
                key={trainerId}
                onClick={() => {
                  soundManager.playClick();
                  handleTrainerBattle(trainerId);
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
          })
        }

        {/* Back button */}
        <div style={{ marginTop: '12px' }}>
          <Button variant="ghost" onClick={() => setView('world_map')}>
            Retour
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}

function NpcDialogue({ npc, dialogueIndex, onAdvance }: { npc: NPCData; dialogueIndex: number; onAdvance: () => void }) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const fullText = npc.dialogue[dialogueIndex];
  const gameSpeed = useGameStore(s => s.settings.gameSpeed);

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
    }, 10 / gameSpeed);
    return () => clearInterval(interval);
  }, [fullText, gameSpeed]);

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
            {dialogueIndex < npc.dialogue.length - 1 ? '▼' : '✕'}
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
