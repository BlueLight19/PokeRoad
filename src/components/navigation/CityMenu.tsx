import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useBattleStore } from '../../stores/battleStore';
import { getZoneData, getGymData, getZoneTrainers, isTrainerAccessible } from '../../utils/dataLoader';
import { Button } from '../ui/Button';
import { NpcDialogue } from '../ui/NpcDialogue';
import { NPCData, CityData, RouteData, StaticEncounter } from '../../types/game';
import { soundManager } from '../../utils/SoundManager';
import { theme } from '../../theme';

// SVG mini-icons for menu items
function IconHeal() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="9" stroke={theme.colors.success} strokeWidth="1.5" fill={`${theme.colors.success}18`} />
      <line x1="11" y1="6" x2="11" y2="16" stroke={theme.colors.success} strokeWidth="2" strokeLinecap="round" />
      <line x1="6" y1="11" x2="16" y2="11" stroke={theme.colors.success} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconShop() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="4" y="8" width="14" height="11" rx="2" stroke={theme.colors.info} strokeWidth="1.5" fill={`${theme.colors.info}18`} />
      <path d="M4 10L6 5h10l2 5" stroke={theme.colors.info} strokeWidth="1.5" fill="none" />
      <circle cx="11" cy="14" r="2" stroke={theme.colors.info} strokeWidth="1.2" fill="none" />
    </svg>
  );
}

function IconGym({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <polygon points="11,2 20,8 20,18 2,18 2,8" stroke={color} strokeWidth="1.5" fill={`${color}18`} />
      <rect x="8" y="12" width="6" height="6" stroke={color} strokeWidth="1.2" fill="none" />
    </svg>
  );
}

function IconNpc({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="7" r="4" stroke={color} strokeWidth="1.5" fill={`${color}18`} />
      <path d="M4 19c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function IconStar({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <polygon points="11,2 13.5,8 20,8.5 15,13 16.5,20 11,16 5.5,20 7,13 2,8.5 8.5,8" stroke={color} strokeWidth="1.2" fill={`${color}30`} />
    </svg>
  );
}

function IconSafari() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="9" stroke={theme.colors.success} strokeWidth="1.5" fill={`${theme.colors.success}18`} />
      <text x="11" y="15" textAnchor="middle" fontSize="10" fontFamily={theme.font.family} fill={theme.colors.success}>S</text>
    </svg>
  );
}

// Shared action card component
function ActionCard({
  icon,
  title,
  subtitle,
  accentColor,
  onClick,
  disabled = false,
  completed = false,
  variant = 'default',
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accentColor: string;
  onClick: () => void;
  disabled?: boolean;
  completed?: boolean;
  variant?: 'default' | 'gold' | 'locked';
}) {
  const isGold = variant === 'gold';
  const isLocked = variant === 'locked';

  return (
    <button
      onClick={() => { if (!disabled) { soundManager.playClick(); onClick(); } }}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: `${theme.spacing.md}px`,
        padding: '12px 14px',
        background: isGold
          ? `linear-gradient(135deg, ${theme.colors.gold}18 0%, ${theme.colors.deepBg} 80%)`
          : completed
            ? theme.colors.deepBg
            : `linear-gradient(135deg, ${accentColor}0a 0%, ${theme.colors.deepBg} 80%)`,
        border: completed
          ? theme.borders.thin(theme.colors.borderDark)
          : isGold
            ? `2px solid ${theme.colors.gold}66`
            : isLocked
              ? theme.borders.thin(theme.colors.borderDark)
              : `2px solid ${accentColor}44`,
        borderLeft: completed
          ? `3px solid ${theme.colors.borderDark}`
          : isGold
            ? `3px solid ${theme.colors.gold}`
            : isLocked
              ? `3px solid ${theme.colors.borderDark}`
              : `3px solid ${accentColor}`,
        borderRadius: `${theme.radius.md}px`,
        cursor: disabled ? 'default' : 'pointer',
        opacity: completed ? 0.55 : isLocked ? 0.45 : 1,
        textAlign: 'left',
        width: '100%',
        transition: 'opacity 0.2s, border-color 0.2s',
      }}
    >
      <div style={{ flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: completed ? theme.colors.textDimmer : isGold ? theme.colors.gold : accentColor,
          fontSize: theme.font.md,
          fontFamily: theme.font.family,
          textDecoration: completed ? 'line-through' : 'none',
        }}>
          {title}
        </div>
        <div style={{
          color: theme.colors.textDim,
          fontSize: theme.font.micro,
          fontFamily: theme.font.family,
          marginTop: '3px',
          lineHeight: '1.4',
        }}>
          {subtitle}
        </div>
      </div>
    </button>
  );
}

// Trainer sub-card (smaller, for gym trainers list)
function TrainerCard({
  name,
  subtitle,
  defeated,
  accentColor,
  onClick,
}: {
  name: string;
  subtitle: string;
  defeated: boolean;
  accentColor: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={() => { if (!defeated) { soundManager.playClick(); onClick(); } }}
      disabled={defeated}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '9px 12px',
        background: defeated ? 'rgba(15,23,42,0.5)' : `${accentColor}08`,
        border: defeated ? theme.borders.thin(theme.colors.borderDark) : `1px solid ${accentColor}33`,
        borderLeft: `3px solid ${defeated ? theme.colors.borderDark : accentColor}`,
        borderRadius: `${theme.radius.sm}px`,
        cursor: defeated ? 'default' : 'pointer',
        opacity: defeated ? 0.45 : 1,
        textAlign: 'left',
        width: '100%',
        transition: 'opacity 0.2s',
      }}
    >
      <div style={{
        width: '18px', height: '18px',
        borderRadius: theme.radius.round,
        background: defeated ? theme.colors.borderDark : `${accentColor}22`,
        border: `1px solid ${defeated ? theme.colors.borderDark : accentColor}66`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '9px', color: defeated ? theme.colors.borderDark : accentColor,
        fontFamily: theme.font.family, flexShrink: 0,
      }}>
        {defeated ? '\u2713' : '!'}
      </div>
      <div>
        <div style={{
          color: defeated ? theme.colors.textDimmer : theme.colors.textSecondary,
          fontSize: theme.font.xs,
          fontFamily: theme.font.family,
          textDecoration: defeated ? 'line-through' : 'none',
        }}>
          {name}
        </div>
        <div style={{
          color: theme.colors.textDimmer,
          fontSize: '6px',
          fontFamily: theme.font.family,
          marginTop: '2px',
        }}>
          {subtitle}
        </div>
      </div>
    </button>
  );
}

export function CityMenu() {
  const { selectedZone, team, player, progress, setView, addItem, givePlayerPokemon, triggerEvent, addNotification } = useGameStore();
  const devSkip = useGameStore(s => s.settings.devSkipBattle);
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
              return zoneTrainers.every((t: string) => progress.defeatedTrainers.includes(t));
            } catch { return true; }
          });
          if (!allDefeated) { gymLocked = true; gymLockReason = 'Explorez les zones environnantes'; }
        }
        if (condition.type === 'badge' && condition.badge) {
          if (!player.badges.includes(condition.badge)) { gymLocked = true; gymLockReason = 'Badge requis manquant'; }
        }
        if (condition.type === 'hm' && condition.hmMove) {
          const hmMoveIds: Record<string, number> = { surf: 57, strength: 70, cut: 15, fly: 19, flash: 148 };
          const moveId = hmMoveIds[condition.hmMove as string];
          if (!moveId || !team.some(p => p.moves.some(m => m.moveId === moveId))) {
            gymLocked = true; gymLockReason = `${(condition.hmMove as string).charAt(0).toUpperCase() + (condition.hmMove as string).slice(1)} requis`;
          }
        }
        if (condition.type === 'item' && condition.itemId) {
          if (!useGameStore.getState().inventory.some(i => i.itemId === condition.itemId && i.quantity > 0)) {
            gymLocked = true; gymLockReason = 'Objet requis manquant';
          }
        }
        if (condition.type === 'event' && condition.eventId) {
          if (!progress.events[condition.eventId as string]) {
            gymLocked = true; gymLockReason = 'Explorez les zones environnantes';
          }
        }
        if (condition.type === 'badgeCount' && condition.count) {
          if (player.badges.length < (condition.count as number)) {
            gymLocked = true; gymLockReason = `${condition.count} badges requis`;
          }
        }
      }
    } catch { gym = null; }
  }

  const handleGymBattle = () => {
    if (!gym || gymDefeated || gymLocked) return;
    startGymBattle(gym, team);
    if (!devSkip) setView('battle');
  };

  const handleHeal = () => {
    const state = useGameStore.getState();
    state.healTeam();
    if (selectedZone) {
      useGameStore.setState({ progress: { ...state.progress, lastPokemonCenter: selectedZone } });
    }
    setHealMessage('Votre equipe est soignee !');
    setTimeout(() => setHealMessage(''), 2000);
    useGameStore.getState().saveGameState();
  };

  const handleNpcClick = (npc: NPCData) => { setActiveNpc(npc); setDialogueIndex(0); };

  const advanceDialogue = () => {
    if (!activeNpc) return;
    if (dialogueIndex < activeNpc.dialogue.length - 1) {
      setDialogueIndex(prev => prev + 1);
    } else {
      if (activeNpc.setsEvent && !progress.events[activeNpc.setsEvent]) {
        triggerEvent(activeNpc.setsEvent);
        if (activeNpc.givesItem) {
          const qty = activeNpc.givesItemQuantity || 1;
          addItem(activeNpc.givesItem, qty);
          addNotification({ type: 'item', itemId: activeNpc.givesItem, quantity: qty });
        }
        if (activeNpc.givesPokemon) { givePlayerPokemon(activeNpc.givesPokemon.pokemonId, activeNpc.givesPokemon.level); addNotification({ type: 'pokemon', pokemonId: activeNpc.givesPokemon.pokemonId, level: activeNpc.givesPokemon.level }); }
      }
      setActiveNpc(null);
    }
  };

  if (activeNpc) {
    return <NpcDialogue npc={activeNpc} dialogueIndex={dialogueIndex} onAdvance={advanceDialogue} />;
  }

  return (
    <div style={{ padding: `${theme.spacing.xl}px`, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: '500px' }}>

        {/* ====== HEADER ====== */}
        <div style={{
          textAlign: 'center',
          marginBottom: `${theme.spacing.xl}px`,
          position: 'relative',
        }}>
          {/* Zone type icon */}
          <div style={{
            width: '48px', height: '48px',
            margin: '0 auto 10px',
            borderRadius: theme.radius.round,
            background: `linear-gradient(135deg, ${theme.colors.gold}22, ${theme.colors.gold}08)`,
            border: `2px solid ${theme.colors.gold}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="8" width="18" height="13" rx="2" stroke={theme.colors.gold} strokeWidth="1.5" fill={`${theme.colors.gold}15`} />
              <polygon points="12,2 22,8 2,8" stroke={theme.colors.gold} strokeWidth="1.5" fill="none" />
              <rect x="9" y="13" width="6" height="8" stroke={theme.colors.gold} strokeWidth="1" fill="none" />
            </svg>
          </div>
          <h2 style={{
            color: theme.colors.gold,
            fontSize: theme.font.hero,
            fontFamily: theme.font.family,
            margin: 0,
            textShadow: `0 2px 8px ${theme.colors.gold}22`,
          }}>
            {zone.name}
          </h2>
          <div style={{
            width: '50px', height: '2px',
            background: `linear-gradient(90deg, transparent, ${theme.colors.gold}, transparent)`,
            margin: '8px auto 0',
          }} />
          <div style={{
            color: theme.colors.textDimmer,
            fontSize: theme.font.xs,
            fontFamily: theme.font.family,
            marginTop: '8px',
          }}>
            Ville de Kanto
          </div>
        </div>

        {/* ====== ACTIONS ====== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

          {/* Centre Pokemon */}
          <ActionCard
            icon={<IconHeal />}
            title="Centre Pokemon"
            subtitle={healMessage || 'Soigner votre equipe'}
            accentColor={theme.colors.success}
            onClick={handleHeal}
          />

          {/* Shop */}
          {hasShop && (
            <ActionCard
              icon={<IconShop />}
              title="Boutique"
              subtitle="Acheter des objets"
              accentColor={theme.colors.info}
              onClick={() => setView('shop')}
            />
          )}

          {/* NPCs */}
          {npcs.map(npc => {
            if (npc.requiredEvent && !progress.events[npc.requiredEvent]) return null;
            const isCompleted = npc.setsEvent ? progress.events[npc.setsEvent] : false;
            return (
              <ActionCard
                key={npc.id}
                icon={<IconNpc color={isCompleted ? theme.colors.textDimmer : theme.colors.success} />}
                title={npc.name}
                subtitle={isCompleted ? 'Deja parle' : 'Interagir'}
                accentColor={theme.colors.success}
                onClick={() => handleNpcClick(npc)}
                completed={!!isCompleted}
              />
            );
          })}

          {/* Gym section */}
          {gym && (() => {
            const accessibleTrainers = filteredTrainers.filter(t => isTrainerAccessible(t, team, useGameStore.getState().inventory, { events: progress.events, badges: player.badges }));
            const allTrainersDefeated = accessibleTrainers.every(t => progress.defeatedTrainers.includes(t.id));
            const trainerCount = filteredTrainers.length;
            const gymColor = gymDefeated ? theme.colors.gold : gymLocked ? theme.colors.textDimmer : theme.colors.primary;

            return (
              <div>
                {/* Gym header */}
                <button
                  onClick={() => {
                    soundManager.playClick();
                    if (gymLocked || gymDefeated) return;
                    setGymExpanded(!gymExpanded);
                  }}
                  disabled={gymLocked}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: `${theme.spacing.md}px`,
                    padding: '12px 14px',
                    background: gymDefeated
                      ? theme.colors.deepBg
                      : gymLocked
                        ? theme.colors.deepBg
                        : `linear-gradient(135deg, ${theme.colors.primary}0a 0%, ${theme.colors.deepBg} 80%)`,
                    border: gymDefeated
                      ? theme.borders.thin(theme.colors.borderDark)
                      : gymLocked
                        ? theme.borders.thin(theme.colors.borderDark)
                        : `2px solid ${theme.colors.primary}44`,
                    borderLeft: `3px solid ${gymColor}`,
                    borderRadius: gymExpanded && !gymDefeated && !gymLocked
                      ? `${theme.radius.md}px ${theme.radius.md}px 0 0`
                      : `${theme.radius.md}px`,
                    cursor: gymDefeated || gymLocked ? 'default' : 'pointer',
                    opacity: gymDefeated ? 0.55 : gymLocked ? 0.45 : 1,
                    textAlign: 'left',
                    width: '100%',
                    transition: 'opacity 0.2s',
                  }}
                >
                  <div style={{ flexShrink: 0 }}>
                    <IconGym color={gymColor} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      color: gymColor,
                      fontSize: theme.font.md,
                      fontFamily: theme.font.family,
                    }}>
                      Arene — {gym.leader}
                    </div>
                    <div style={{
                      color: theme.colors.textDim,
                      fontSize: theme.font.micro,
                      fontFamily: theme.font.family,
                      marginTop: '3px',
                    }}>
                      {gymDefeated
                        ? 'Badge obtenu !'
                        : gymLocked
                          ? gymLockReason
                          : trainerCount > 0
                            ? `${trainerCount} dresseur${trainerCount > 1 ? 's' : ''} + Champion`
                            : `Champion — ${gym.team.length} Pokemon`}
                    </div>
                  </div>
                  {!gymDefeated && !gymLocked && (
                    <span style={{
                      color: theme.colors.primary,
                      fontSize: theme.font.sm,
                      transition: 'transform 0.2s',
                      transform: gymExpanded ? 'rotate(90deg)' : 'rotate(0)',
                    }}>
                      {'\u25B6'}
                    </span>
                  )}
                </button>

                {/* Expanded gym trainers + leader */}
                {gymExpanded && !gymDefeated && !gymLocked && (
                  <div style={{
                    background: `${theme.colors.deepBg}ee`,
                    border: `2px solid ${theme.colors.primary}44`,
                    borderTop: 'none',
                    borderRadius: `0 0 ${theme.radius.md}px ${theme.radius.md}px`,
                    padding: `${theme.spacing.sm}px`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                  }}>
                    {filteredTrainers.map(trainer => {
                      const defeated = progress.defeatedTrainers.includes(trainer.id);
                      return (
                        <TrainerCard
                          key={trainer.id}
                          name={`${trainer.trainerClass} ${trainer.name}`}
                          subtitle={defeated ? 'Vaincu' : `${trainer.team.length} Pokemon`}
                          defeated={defeated}
                          accentColor={theme.colors.danger}
                          onClick={() => {
                            const { startTrainerBattle } = useBattleStore.getState();
                            startTrainerBattle(trainer, team);
                            if (!devSkip) setView('battle');
                          }}
                        />
                      );
                    })}

                    {/* Gym leader */}
                    <button
                      onClick={() => { if (allTrainersDefeated) { soundManager.playClick(); handleGymBattle(); } }}
                      disabled={!allTrainersDefeated}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        background: allTrainersDefeated
                          ? `${theme.colors.gold}0c`
                          : 'rgba(15,23,42,0.5)',
                        border: allTrainersDefeated
                          ? `2px solid ${theme.colors.gold}66`
                          : theme.borders.thin(theme.colors.borderDark),
                        borderLeft: `3px solid ${allTrainersDefeated ? theme.colors.gold : theme.colors.borderDark}`,
                        borderRadius: `${theme.radius.sm}px`,
                        cursor: allTrainersDefeated ? 'pointer' : 'default',
                        opacity: allTrainersDefeated ? 1 : 0.4,
                        textAlign: 'left',
                        width: '100%',
                      }}
                    >
                      <IconStar color={allTrainersDefeated ? theme.colors.gold : theme.colors.borderDark} />
                      <div>
                        <div style={{
                          color: allTrainersDefeated ? theme.colors.gold : theme.colors.borderDark,
                          fontSize: theme.font.sm,
                          fontFamily: theme.font.family,
                        }}>
                          Champion: {gym.leader}
                        </div>
                        <div style={{
                          color: theme.colors.textDim,
                          fontSize: '6px',
                          fontFamily: theme.font.family,
                          marginTop: '2px',
                        }}>
                          {allTrainersDefeated
                            ? `${gym.team.length} Pokemon — Pret au combat !`
                            : 'Battez tous les dresseurs d\'abord'}
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Zone trainers (no gym) */}
          {!gym && filteredTrainers.map(trainer => {
            const defeated = progress.defeatedTrainers.includes(trainer.id);
            return (
              <ActionCard
                key={trainer.id}
                icon={<div style={{
                  width: '22px', height: '22px',
                  borderRadius: theme.radius.round,
                  background: defeated ? theme.colors.borderDark : `${theme.colors.primary}22`,
                  border: `1.5px solid ${defeated ? theme.colors.borderDark : theme.colors.primary}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', color: defeated ? theme.colors.borderDark : theme.colors.primary,
                  fontFamily: theme.font.family,
                }}>
                  {defeated ? '\u2713' : '!'}
                </div>}
                title={`${trainer.trainerClass} ${trainer.name}`}
                subtitle={defeated ? 'Vaincu' : `${trainer.team.length} Pokemon`}
                accentColor={theme.colors.primary}
                onClick={() => {
                  if (defeated) return;
                  const { startTrainerBattle } = useBattleStore.getState();
                  startTrainerBattle(trainer, team);
                  if (!devSkip) setView('battle');
                }}
                completed={defeated}
                disabled={defeated}
              />
            );
          })}

          {/* Static encounters */}
          {staticEncounters.map((encounter: StaticEncounter) => {
            if (progress.events[encounter.id]) return null;
            if (encounter.requiredItem && !useGameStore.getState().inventory.some(i => i.itemId === encounter.requiredItem && i.quantity > 0)) return null;
            return (
              <ActionCard
                key={encounter.id}
                icon={<IconStar color={theme.colors.gold} />}
                title={encounter.name}
                subtitle={encounter.dialogue || 'Une presence imposante...'}
                accentColor={theme.colors.gold}
                variant="gold"
                onClick={() => {
                  startWildBattle([{ pokemonId: encounter.pokemonId, minLevel: encounter.level, maxLevel: encounter.level, rate: 100 }], team, encounter.id);
                  if (!devSkip) setView('battle');
                }}
              />
            );
          })}

          {/* Safari Zone */}
          {zone.id === 'parmanie' && (
            <ActionCard
              icon={<IconSafari />}
              title="Parc Safari"
              subtitle="Cout: 500P"
              accentColor={theme.colors.success}
              onClick={() => useGameStore.getState().startSafari()}
              disabled={useGameStore.getState().player.money < 500}
            />
          )}

        </div>
      </div>
    </div>
  );
}
