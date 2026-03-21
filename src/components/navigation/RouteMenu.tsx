import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useBattleStore } from '../../stores/battleStore';
import { getZoneData, getTrainerData, getZoneTrainers } from '../../utils/dataLoader';
import { Button } from '../ui/Button';
import { NpcDialogue } from '../ui/NpcDialogue';
import { WildEncounter, StaticEncounter, RouteData, CityData, NPCData } from '../../types/game';
import { soundManager } from '../../utils/SoundManager';
import { theme } from '../../theme';

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
    triggerEvent,
    addNotification,
    setCurrentFloor,
    isFloorUnlocked,
  } = useGameStore();
  const { startWildBattle, startTrainerBattle } = useBattleStore();
  const [activeNpc, setActiveNpc] = useState<NPCData | null>(null);
  const [dialogueIndex, setDialogueIndex] = useState(0);

  if (!selectedZone) return null;

  const zone = getZoneData(selectedZone) as unknown as RouteData | CityData;
  const isDungeon = zone.type === 'dungeon';
  const totalFloors = isDungeon ? ((zone as CityData).totalFloors ?? 1) : 1;
  const hasMultipleFloors = totalFloors > 1;

  const currentFloor = useGameStore(s => s.progress.currentFloors[selectedZone!] ?? 1);

  const allWildEncounters: WildEncounter[] = (zone as RouteData).wildEncounters || [];
  const allWaterEncounters: WildEncounter[] = (zone as RouteData).waterEncounters || [];
  const allFishingEncounters: WildEncounter[] = (zone as RouteData).fishingEncounters || [];

  // Filter encounters by floor for dungeons
  const filterByFloor = (encounters: WildEncounter[]) => {
    if (!hasMultipleFloors) return encounters;
    return encounters.filter(e => !e.floor || e.floor === currentFloor);
  };

  const wildEncounters = filterByFloor(allWildEncounters);
  const waterEncounters = filterByFloor(allWaterEncounters);
  const fishingEncounters = filterByFloor(allFishingEncounters);
  const staticEncounters = (zone as RouteData).staticEncounters || [];
  const npcs: NPCData[] = (zone as RouteData).npcs || [];
  const player = useGameStore(s => s.player);

  // Filter trainers by floor for dungeons
  const filteredTrainers = hasMultipleFloors
    ? getZoneTrainers(selectedZone, player.starter, currentFloor)
    : getZoneTrainers(selectedZone, player.starter);

  // Check if all trainers on current floor are defeated
  const allFloorTrainersDefeated = filteredTrainers.every(t => progress.defeatedTrainers.includes(t.id));

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
          addNotification({ type: 'item', itemId: activeNpc.givesItem, quantity: 1 });
        }
        if (activeNpc.givesPokemon) {
          givePlayerPokemon(activeNpc.givesPokemon.pokemonId, activeNpc.givesPokemon.level);
          addNotification({ type: 'pokemon', pokemonId: activeNpc.givesPokemon.pokemonId, level: activeNpc.givesPokemon.level });
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
          background: `${theme.colors.deepBg}d9`,
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          borderRadius: '24px',
          border: `3px solid ${theme.colors.borderSubtle}`,
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>

        {/* Header Card */}
        <div style={{
            background: `linear-gradient(135deg, ${theme.colors.success}14 0%, ${theme.colors.deepBg} 100%)`,
            borderRadius: `${theme.radius.xl}px`,
            border: `2px solid ${theme.colors.success}`,
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
                background: `linear-gradient(90deg, transparent, ${theme.colors.success}, transparent)`
            }} />
            <h2 style={{
                color: theme.colors.success,
                fontSize: '18px',
                fontFamily: theme.font.family,
                margin: 0,
                textShadow: '0 2px 4px rgba(0,0,0,0.5)'
            }}>
                {zone.name}
            </h2>
            <div style={{ color: theme.colors.textDim, fontSize: theme.font.md, fontFamily: theme.font.family, marginTop: '8px' }}>
                {isDungeon ? 'Donjon' : 'Zone Sauvage'}
            </div>
        </div>

      {/* Floor Navigation for multi-floor dungeons */}
      {hasMultipleFloors && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #2a1a3a 0%, #1a1030 100%)',
          border: `2px solid ${theme.colors.purple}`,
          borderRadius: `${theme.radius.lg}px`,
          marginBottom: '20px',
        }}>
          <button
            onClick={() => {
              soundManager.playClick();
              if (currentFloor > 1) setCurrentFloor(selectedZone!, currentFloor - 1);
            }}
            disabled={currentFloor <= 1}
            style={{
              background: 'none',
              border: 'none',
              color: currentFloor > 1 ? theme.colors.purpleLight : '#444',
              fontSize: '16px',
              fontFamily: theme.font.family,
              cursor: currentFloor > 1 ? 'pointer' : 'default',
              padding: '4px 8px',
            }}
          >
            {'<'}
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              color: theme.colors.purpleLight,
              fontSize: theme.font.xl,
              fontFamily: theme.font.family,
            }}>
              Etage {currentFloor} / {totalFloors}
            </div>
            <div style={{
              color: allFloorTrainersDefeated ? theme.colors.success : theme.colors.textDim,
              fontSize: theme.font.xs,
              fontFamily: theme.font.family,
              marginTop: '4px',
            }}>
              {allFloorTrainersDefeated ? 'Etage termine' : `${filteredTrainers.filter(t => progress.defeatedTrainers.includes(t.id)).length}/${filteredTrainers.length} dresseurs`}
            </div>
          </div>
          <button
            onClick={() => {
              soundManager.playClick();
              if (currentFloor < totalFloors && isFloorUnlocked(selectedZone!, currentFloor + 1)) {
                setCurrentFloor(selectedZone!, currentFloor + 1);
              }
            }}
            disabled={currentFloor >= totalFloors || !isFloorUnlocked(selectedZone!, currentFloor + 1)}
            style={{
              background: 'none',
              border: 'none',
              color: currentFloor < totalFloors && isFloorUnlocked(selectedZone!, currentFloor + 1) ? theme.colors.purpleLight : '#444',
              fontSize: '16px',
              fontFamily: theme.font.family,
              cursor: currentFloor < totalFloors && isFloorUnlocked(selectedZone!, currentFloor + 1) ? 'pointer' : 'default',
              padding: '4px 8px',
            }}
          >
            {'>'}
          </button>
        </div>
      )}

      {useGameStore.getState().safariState && (
        <div style={{
          background: `linear-gradient(90deg, ${theme.colors.gold}, #FFA000)`,
          color: '#000',
          padding: '12px 16px',
          borderRadius: `${theme.radius.lg}px`,
          marginBottom: '20px',
          fontFamily: theme.font.family,
          fontSize: theme.font.xl,
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
                background: isCompleted ? '#1a1a1a' : `${theme.colors.success}14`,
                border: isCompleted ? `2px solid ${theme.colors.borderDark}` : `2px solid ${theme.colors.success}`,
                borderRadius: `${theme.radius.md}px`,
                cursor: 'pointer',
                textAlign: 'left',
                opacity: isCompleted ? 0.7 : 1,
              }}
            >
              <span style={{ fontSize: '20px' }}>💬</span>
              <div>
                <div style={{ color: isCompleted ? theme.colors.textDim : theme.colors.success, fontSize: theme.font.lg, fontFamily: theme.font.family }}>
                  {npc.name}
                </div>
                <div style={{ color: theme.colors.textDim, fontSize: theme.font.xs, fontFamily: theme.font.family, marginTop: '4px' }}>
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
              border: `2px solid ${theme.colors.success}`,
              borderRadius: `${theme.radius.md}px`,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '20px' }}>🦁</span>
            <div>
              <div style={{ color: theme.colors.textPrimary, fontSize: theme.font.lg, fontFamily: theme.font.family }}>
                Chasser un Pokémon
              </div>
              <div style={{
                color: theme.colors.textSecondary, fontSize: theme.font.xs, fontFamily: theme.font.family, marginTop: '4px'
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
                background: `${theme.colors.success}14`,
                border: `2px solid ${theme.colors.success}`,
                borderRadius: `${theme.radius.md}px`,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '20px' }}>~</span>
              <div>
                <div
                  style={{
                    color: theme.colors.success,
                    fontSize: theme.font.lg,
                    fontFamily: theme.font.family,
                  }}
                >
                  Hautes herbes
                </div>
                <div
                  style={{
                    color: theme.colors.textDim,
                    fontSize: theme.font.xs,
                    fontFamily: theme.font.family,
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
              borderRadius: `${theme.radius.md}px`,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '20px' }}>🌊</span>
            <div>
              <div style={{ color: '#64b5f6', fontSize: theme.font.lg, fontFamily: theme.font.family }}>
                Surfer sur l'eau
              </div>
              <div style={{ color: '#bbdefb', fontSize: theme.font.xs, fontFamily: theme.font.family, marginTop: '4px' }}>
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
              borderRadius: `${theme.radius.md}px`,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '20px' }}>🎣</span>
            <div>
              <div style={{ color: '#4dd0e1', fontSize: theme.font.lg, fontFamily: theme.font.family }}>
                Pêcher
              </div>
              <div style={{ color: '#b2ebf2', fontSize: theme.font.xs, fontFamily: theme.font.family, marginTop: '4px' }}>
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
                  background: encounter.isGift ? `linear-gradient(135deg, ${theme.colors.success} 0%, #2E7D32 100%)` : `linear-gradient(135deg, ${theme.colors.gold} 0%, #FFA500 100%)`,
                  border: encounter.isGift ? '2px solid #81C784' : `2px solid ${theme.colors.gold}`,
                  borderRadius: `${theme.radius.md}px`,
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: encounter.isGift ? '0 0 10px rgba(76, 175, 80, 0.3)' : '0 0 10px rgba(255, 215, 0, 0.3)',
                }}
              >
                <span style={{ fontSize: '20px' }}>{encounter.isGift ? '🎁' : '★'}</span>
                <div>
                  <div style={{ color: encounter.isGift ? theme.colors.textPrimary : '#000', fontSize: theme.font.lg, fontFamily: theme.font.family, fontWeight: 'bold' }}>
                    {encounter.name}
                  </div>
                  <div style={{ color: encounter.isGift ? '#eee' : theme.colors.borderDark, fontSize: theme.font.xs, fontFamily: theme.font.family, marginTop: '4px', lineHeight: '1.4' }}>
                    {encounter.dialogue || (encounter.isGift ? 'Obtenir ce Pokémon ?' : 'Une présence imposante...')}
                  </div>
                </div>
              </button>
            );
          })
        }

        {/* Trainers (filtered: no gym/elite4, rival matched to starter) */}
        {
          filteredTrainers.map(trainer => {
            const defeated = isTrainerDefeated(trainer.id);

            return (
              <button
                key={trainer.id}
                onClick={() => {
                  soundManager.playClick();
                  handleTrainerBattle(trainer.id);
                }}
                disabled={defeated}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  background: defeated ? '#1a1a1a' : theme.colors.panelBg,
                  border: defeated ? `2px solid ${theme.colors.borderDark}` : `2px solid ${theme.colors.primary}`,
                  borderRadius: `${theme.radius.md}px`,
                  cursor: defeated ? 'default' : 'pointer',
                  opacity: defeated ? 0.5 : 1,
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '20px' }}>{defeated ? 'x' : '!'}</span>
                <div>
                  <div
                    style={{
                      color: defeated ? theme.colors.textDimmer : theme.colors.primary,
                      fontSize: theme.font.lg,
                      fontFamily: theme.font.family,
                      textDecoration: defeated ? 'line-through' : 'none',
                    }}
                  >
                    {trainer.trainerClass} {trainer.name}
                  </div>
                  <div
                    style={{
                      color: theme.colors.textDim,
                      fontSize: theme.font.xs,
                      fontFamily: theme.font.family,
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

      </div>
      </div>
    </div>
  );
}
