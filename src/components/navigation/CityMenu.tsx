import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useBattleStore } from '../../stores/battleStore';
import { getZoneData, getGymData, getZoneTrainers } from '../../utils/dataLoader';
import { Button } from '../ui/Button';
import { NpcDialogue } from '../ui/NpcDialogue';
import { NPCData, CityData, RouteData, StaticEncounter } from '../../types/game';
import { soundManager } from '../../utils/SoundManager';
import { theme } from '../../theme';

export function CityMenu() {
  const { selectedZone, team, player, progress, setView, addItem, givePlayerPokemon, triggerEvent, addNotification } = useGameStore();
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
            background: `linear-gradient(135deg, ${theme.colors.panelBg} 0%, ${theme.colors.deepBg} 100%)`,
            borderRadius: `${theme.radius.xl}px`,
            border: `2px solid ${theme.colors.gold}`,
            padding: '20px',
            marginBottom: '24px',
            boxShadow: '0 4px 15px rgba(255, 214, 0, 0.15)',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '4px',
                background: `linear-gradient(90deg, transparent, ${theme.colors.gold}, transparent)`
            }} />
            <h2 style={{
                color: theme.colors.gold,
                fontSize: '18px',
                fontFamily: theme.font.family,
                margin: 0,
                textShadow: '0 2px 4px rgba(0,0,0,0.5)'
            }}>
                {zone.name}
            </h2>
            <div style={{ color: theme.colors.textDim, fontSize: theme.font.md, fontFamily: theme.font.family, marginTop: '8px' }}>
                Ville de Kanto
            </div>
        </div>

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

        {/* Shop */}
        {hasShop && (
          <button
            onClick={() => {
              soundManager.playClick();
              setView('shop');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 16px',
              background: theme.colors.panelBg,
              border: `2px solid ${theme.colors.info}`,
              borderRadius: `${theme.radius.md}px`,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '20px', color: theme.colors.info }}>$</span>
            <div>
              <div
                style={{
                  color: theme.colors.info,
                  fontSize: theme.font.lg,
                  fontFamily: theme.font.family,
                }}
              >
                Boutique
              </div>
              <div
                style={{
                  color: theme.colors.textDim,
                  fontSize: theme.font.xs,
                  fontFamily: theme.font.family,
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
              soundManager.playClick();
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
              background: gymDefeated ? '#1a1a1a' : gymLocked ? '#1a1a1a' : `${theme.colors.primary}14`,
              border: gymDefeated ? `2px solid ${theme.colors.borderDark}` : gymLocked ? `2px solid ${theme.colors.borderMid}` : `2px solid ${theme.colors.primary}`,
                  borderRadius: gymExpanded && !gymDefeated && !gymLocked ? `${theme.radius.md}px ${theme.radius.md}px 0 0` : `${theme.radius.md}px`,
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
                  color: gymDefeated ? theme.colors.gold : gymLocked ? theme.colors.textDim : theme.colors.primary,
                  fontSize: theme.font.lg,
                  fontFamily: theme.font.family,
                }}
              >
                Arene - {gym.leader}
              </div>
              <div
                style={{
                  color: theme.colors.textDim,
                  fontSize: theme.font.xs,
                  fontFamily: theme.font.family,
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
                  border: `2px solid ${theme.colors.primary}`,
                  borderTop: 'none',
                  borderRadius: `0 0 ${theme.radius.md}px ${theme.radius.md}px`,
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
                          border: defeated ? `1px solid ${theme.colors.borderDark}` : `1px solid ${theme.colors.dangerDark}`,
                          borderRadius: '6px',
                          cursor: defeated ? 'default' : 'pointer',
                          opacity: defeated ? 0.5 : 1,
                          textAlign: 'left',
                          width: '100%',
                        }}
                      >
                        <span style={{ fontSize: theme.font.xxl }}>{defeated ? 'x' : '!'}</span>
                        <div>
                          <div style={{
                            color: defeated ? theme.colors.textDimmer : theme.colors.dangerDark,
                            fontSize: theme.font.sm,
                            fontFamily: theme.font.family,
                            textDecoration: defeated ? 'line-through' : 'none',
                          }}>
                            {trainer.trainerClass} {trainer.name}
                          </div>
                          <div style={{
                            color: theme.colors.textDim,
                            fontSize: theme.font.micro,
                            fontFamily: theme.font.family,
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
                      border: allTrainersDefeated ? `2px solid ${theme.colors.gold}` : '2px solid #444',
                      borderRadius: '6px',
                      cursor: allTrainersDefeated ? 'pointer' : 'default',
                      opacity: allTrainersDefeated ? 1 : 0.4,
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <span style={{ fontSize: '16px', color: allTrainersDefeated ? theme.colors.gold : theme.colors.borderMid }}>
                      {'\u2605'}
                    </span>
                    <div>
                      <div style={{
                        color: allTrainersDefeated ? theme.colors.gold : theme.colors.borderMid,
                        fontSize: theme.font.md,
                        fontFamily: theme.font.family,
                      }}>
                        Champion: {gym.leader}
                      </div>
                      <div style={{
                        color: theme.colors.textDim,
                        fontSize: theme.font.micro,
                        fontFamily: theme.font.family,
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
                soundManager.playClick();
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
        })}

        {/* Static Encounters */}
        {staticEncounters.map((encounter: StaticEncounter) => {
          if (progress.events[encounter.id]) return null;
          if (encounter.requiredItem && !useGameStore.getState().inventory.some(i => i.itemId === encounter.requiredItem && i.quantity > 0)) return null;

          return (
            <button
              key={encounter.id}
              onClick={() => {
                soundManager.playClick();
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
                borderRadius: `${theme.radius.md}px`,
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: '0 0 10px rgba(255, 215, 0, 0.3)',
              }}
            >
              <span style={{ fontSize: '20px' }}>★</span>
              <div>
                <div style={{ color: '#000', fontSize: theme.font.lg, fontFamily: theme.font.family, fontWeight: 'bold' }}>
                  {encounter.name}
                </div>
                <div style={{ color: theme.colors.borderDark, fontSize: theme.font.xs, fontFamily: theme.font.family, marginTop: '4px', lineHeight: '1.4' }}>
                  {encounter.dialogue || 'Une présence imposante...'}
                </div>
              </div>
            </button>
          );
        })}

        {/* Safari Zone */}
        {zone.id === 'parmanie' && (
          <button
            onClick={() => {
              soundManager.playClick();
              useGameStore.getState().startSafari();
            }}
            disabled={useGameStore.getState().player.money < 500}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 16px',
              background: useGameStore.getState().player.money < 500 ? '#1a1a1a' : '#2E7D32',
              border: useGameStore.getState().player.money < 500 ? `2px solid ${theme.colors.borderDark}` : `2px solid ${theme.colors.success}`,
              borderRadius: `${theme.radius.md}px`,
              cursor: useGameStore.getState().player.money < 500 ? 'not-allowed' : 'pointer',
              opacity: useGameStore.getState().player.money < 500 ? 0.5 : 1,
              textAlign: 'left' as const,
            }}
          >
            <span style={{ fontSize: '20px' }}>S</span>
            <div>
              <div style={{
                color: theme.colors.textPrimary,
                fontSize: theme.font.lg,
                fontFamily: theme.font.family,
              }}>
                Parc Safari
              </div>
              <div style={{
                color: theme.colors.textSecondary,
                fontSize: theme.font.xs,
                fontFamily: theme.font.family,
                marginTop: '4px',
              }}>
                Cout: 500P
              </div>
            </div>
          </button>
        )}

        {/* Heal */}
        <button
          onClick={() => {
            soundManager.playClick();
            handleHeal();
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
          <span style={{ fontSize: '20px', color: theme.colors.success }}>+</span>
          <div>
            <div
              style={{
                color: theme.colors.success,
                fontSize: theme.font.lg,
                fontFamily: theme.font.family,
              }}
            >
              Centre Pokemon
            </div>
            <div
              style={{
                color: healMessage ? theme.colors.success : theme.colors.textDim,
                fontSize: theme.font.xs,
                fontFamily: theme.font.family,
                marginTop: '4px',
              }}
            >
              {healMessage || 'Soigner votre equipe'}
            </div>
          </div>
        </button>

      </div>
      </div>
    </div>
  );
}
