import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useBattleStore } from '../../stores/battleStore';
import { getZoneData, getTrainerData, getZoneTrainers, isTrainerAccessible } from '../../utils/dataLoader';
import { Button } from '../ui/Button';
import { NpcDialogue } from '../ui/NpcDialogue';
import { WildEncounter, StaticEncounter, RouteData, CityData, NPCData } from '../../types/game';
import { soundManager } from '../../utils/SoundManager';
import { theme } from '../../theme';

// SVG icons
function IconGrass() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M5 18C5 18 6 10 11 6C16 10 17 18 17 18" stroke={theme.colors.success} strokeWidth="1.5" fill={`${theme.colors.success}18`} />
      <line x1="11" y1="6" x2="11" y2="18" stroke={theme.colors.success} strokeWidth="1" />
      <path d="M8 14C8 14 9 11 11 9" stroke={theme.colors.success} strokeWidth="1" fill="none" />
      <path d="M14 14C14 14 13 11 11 9" stroke={theme.colors.success} strokeWidth="1" fill="none" />
    </svg>
  );
}

function IconWater() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M11 3C11 3 5 10 5 14C5 17.3 7.7 20 11 20C14.3 20 17 17.3 17 14C17 10 11 3 11 3Z" stroke={theme.colors.info} strokeWidth="1.5" fill={`${theme.colors.info}18`} />
    </svg>
  );
}

function IconFishing() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <line x1="6" y1="2" x2="6" y2="14" stroke="#00bcd4" strokeWidth="1.5" />
      <path d="M6 14C6 14 10 16 10 19" stroke="#00bcd4" strokeWidth="1.5" fill="none" />
      <circle cx="12" cy="19" r="2" stroke="#00bcd4" strokeWidth="1" fill="#00bcd418" />
      <line x1="6" y1="2" x2="12" y2="5" stroke="#00bcd4" strokeWidth="1" />
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

// Shared action card
function ActionCard({
  icon, title, subtitle, accentColor, onClick,
  disabled = false, completed = false, variant = 'default',
}: {
  icon: React.ReactNode; title: string; subtitle: string; accentColor: string;
  onClick: () => void; disabled?: boolean; completed?: boolean; variant?: 'default' | 'gold';
}) {
  const isGold = variant === 'gold';
  return (
    <button
      onClick={() => { if (!disabled) { soundManager.playClick(); onClick(); } }}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center',
        gap: `${theme.spacing.md}px`, padding: '12px 14px',
        background: isGold
          ? `linear-gradient(135deg, ${theme.colors.gold}18 0%, ${theme.colors.deepBg} 80%)`
          : completed ? theme.colors.deepBg
            : `linear-gradient(135deg, ${accentColor}0a 0%, ${theme.colors.deepBg} 80%)`,
        border: completed ? theme.borders.thin(theme.colors.borderDark)
          : isGold ? `2px solid ${theme.colors.gold}66`
            : `2px solid ${accentColor}44`,
        borderLeft: completed ? `3px solid ${theme.colors.borderDark}`
          : isGold ? `3px solid ${theme.colors.gold}`
            : `3px solid ${accentColor}`,
        borderRadius: `${theme.radius.md}px`,
        cursor: disabled ? 'default' : 'pointer',
        opacity: completed ? 0.55 : disabled ? 0.5 : 1,
        textAlign: 'left', width: '100%',
        transition: 'opacity 0.2s, border-color 0.2s',
      }}
    >
      <div style={{ flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: completed ? theme.colors.textDimmer : isGold ? theme.colors.gold : accentColor,
          fontSize: theme.font.md, fontFamily: theme.font.family,
          textDecoration: completed ? 'line-through' : 'none',
        }}>
          {title}
        </div>
        <div style={{
          color: theme.colors.textDim, fontSize: theme.font.micro,
          fontFamily: theme.font.family, marginTop: '3px', lineHeight: '1.4',
        }}>
          {subtitle}
        </div>
      </div>
    </button>
  );
}

export function RouteMenu() {
  const {
    selectedZone, progress, team, setView, isTrainerDefeated,
    decrementRepelSteps, setRepelSteps,
    addItem, givePlayerPokemon, triggerEvent, addNotification,
    setCurrentFloor, isFloorUnlocked,
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

  const filteredTrainers = hasMultipleFloors
    ? getZoneTrainers(selectedZone, player.starter, currentFloor)
    : getZoneTrainers(selectedZone, player.starter);

  const inventory = useGameStore(s => s.inventory);
  const accessibleTrainers = filteredTrainers.filter(t => isTrainerAccessible(t, team, inventory, { events: progress.events, badges: player.badges }));
  const lockedTrainers = new Set(filteredTrainers.filter(t => !isTrainerAccessible(t, team, inventory, { events: progress.events, badges: player.badges })).map(t => t.id));
  const allFloorTrainersDefeated = accessibleTrainers.every(t => progress.defeatedTrainers.includes(t.id));

  const hasSurf = progress.events['hm-03-acquired'] || useGameStore.getState().inventory.some(i => i.itemId === 'hm-03');
  const hasRod = useGameStore.getState().inventory.some(i => ['old-rod', 'good-rod', 'super-rod'].includes(i.itemId));

  const handleWildEncounter = () => {
    if (wildEncounters.length === 0) return;
    if (progress.repelSteps > 0) {
      decrementRepelSteps();
      const leadLevel = team[0]?.level || 0;
      const available = wildEncounters.filter(e => e.maxLevel >= leadLevel);
      if (available.length === 0) {
        if (progress.repelSteps === 1) alert("L'effet du Repousse se dissipe.");
        return;
      }
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
    const newSteps = safariState.steps - 1;
    useGameStore.setState({ safariState: { ...safariState, steps: newSteps } });
    if (wildEncounters.length > 0) {
      startWildBattle(wildEncounters, team);
      setView('battle');
    }
  };

  const handleNpcClick = (npc: NPCData) => { setActiveNpc(npc); setDialogueIndex(0); };

  const advanceDialogue = () => {
    if (!activeNpc) return;
    if (dialogueIndex < activeNpc.dialogue.length - 1) {
      setDialogueIndex(prev => prev + 1);
    } else {
      if (activeNpc.setsEvent && !progress.events[activeNpc.setsEvent]) {
        triggerEvent(activeNpc.setsEvent);
        if (activeNpc.givesItem) { addItem(activeNpc.givesItem, 1); addNotification({ type: 'item', itemId: activeNpc.givesItem, quantity: 1 }); }
        if (activeNpc.givesPokemon) { givePlayerPokemon(activeNpc.givesPokemon.pokemonId, activeNpc.givesPokemon.level); addNotification({ type: 'pokemon', pokemonId: activeNpc.givesPokemon.pokemonId, level: activeNpc.givesPokemon.level }); }
      }
      setActiveNpc(null);
    }
  };

  if (activeNpc) {
    return <NpcDialogue npc={activeNpc} dialogueIndex={dialogueIndex} onAdvance={advanceDialogue} />;
  }

  // Header color by zone type
  const headerColor = isDungeon ? theme.colors.purple : theme.colors.success;
  const zoneLabel = isDungeon ? 'Donjon' : 'Zone Sauvage';

  // Header icon
  const HeaderIcon = isDungeon ? (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L2 8v14h20V8L12 2z" stroke={headerColor} strokeWidth="1.5" fill={`${headerColor}15`} />
      <rect x="9" y="12" width="6" height="10" stroke={headerColor} strokeWidth="1" fill="none" />
      <circle cx="12" cy="7" r="2" stroke={headerColor} strokeWidth="1" fill="none" />
    </svg>
  ) : (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M3 20C3 20 6 8 12 4C18 8 21 20 21 20" stroke={headerColor} strokeWidth="1.5" fill={`${headerColor}15`} />
      <line x1="12" y1="4" x2="12" y2="20" stroke={headerColor} strokeWidth="1" />
    </svg>
  );

  return (
    <div style={{ padding: `${theme.spacing.xl}px`, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: '500px' }}>

        {/* ====== HEADER ====== */}
        <div style={{ textAlign: 'center', marginBottom: `${theme.spacing.xl}px` }}>
          <div style={{
            width: '48px', height: '48px',
            margin: '0 auto 10px',
            borderRadius: theme.radius.round,
            background: `linear-gradient(135deg, ${headerColor}22, ${headerColor}08)`,
            border: `2px solid ${headerColor}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {HeaderIcon}
          </div>
          <h2 style={{
            color: headerColor,
            fontSize: theme.font.hero,
            fontFamily: theme.font.family,
            margin: 0,
            textShadow: `0 2px 8px ${headerColor}22`,
          }}>
            {zone.name}
          </h2>
          <div style={{
            width: '50px', height: '2px',
            background: `linear-gradient(90deg, transparent, ${headerColor}, transparent)`,
            margin: '8px auto 0',
          }} />
          <div style={{
            color: theme.colors.textDimmer,
            fontSize: theme.font.xs,
            fontFamily: theme.font.family,
            marginTop: '8px',
          }}>
            {zoneLabel}
          </div>
        </div>

        {/* Floor navigation */}
        {hasMultipleFloors && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: `${theme.spacing.lg}px`,
            padding: '10px 16px',
            background: `linear-gradient(135deg, ${theme.colors.purple}0c 0%, ${theme.colors.deepBg} 80%)`,
            border: `2px solid ${theme.colors.purple}44`,
            borderLeft: `3px solid ${theme.colors.purple}`,
            borderRadius: `${theme.radius.md}px`,
            marginBottom: `${theme.spacing.lg}px`,
          }}>
            <button
              onClick={() => { soundManager.playClick(); if (currentFloor > 1) setCurrentFloor(selectedZone!, currentFloor - 1); }}
              disabled={currentFloor <= 1}
              style={{
                background: 'none', border: 'none',
                color: currentFloor > 1 ? theme.colors.purpleLight : theme.colors.borderDark,
                fontSize: theme.font.xl, fontFamily: theme.font.family,
                cursor: currentFloor > 1 ? 'pointer' : 'default',
                padding: '4px 8px',
              }}
            >
              ◀
            </button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: theme.colors.purpleLight, fontSize: theme.font.md, fontFamily: theme.font.family }}>
                Etage {currentFloor}/{totalFloors}
              </div>
              <div style={{
                color: allFloorTrainersDefeated ? theme.colors.success : theme.colors.textDim,
                fontSize: theme.font.micro, fontFamily: theme.font.family, marginTop: '2px',
              }}>
                {allFloorTrainersDefeated
                  ? 'Etage termine'
                  : `${filteredTrainers.filter(t => progress.defeatedTrainers.includes(t.id)).length}/${filteredTrainers.length} dresseurs`}
              </div>
            </div>
            <button
              onClick={() => {
                soundManager.playClick();
                if (currentFloor < totalFloors && isFloorUnlocked(selectedZone!, currentFloor + 1))
                  setCurrentFloor(selectedZone!, currentFloor + 1);
              }}
              disabled={currentFloor >= totalFloors || !isFloorUnlocked(selectedZone!, currentFloor + 1)}
              style={{
                background: 'none', border: 'none',
                color: currentFloor < totalFloors && isFloorUnlocked(selectedZone!, currentFloor + 1)
                  ? theme.colors.purpleLight : theme.colors.borderDark,
                fontSize: theme.font.xl, fontFamily: theme.font.family,
                cursor: currentFloor < totalFloors && isFloorUnlocked(selectedZone!, currentFloor + 1)
                  ? 'pointer' : 'default',
                padding: '4px 8px',
              }}
            >
              ▶
            </button>
          </div>
        )}

        {/* Safari banner */}
        {useGameStore.getState().safariState && (
          <div style={{
            background: `linear-gradient(135deg, ${theme.colors.gold}18 0%, ${theme.colors.deepBg} 80%)`,
            border: `2px solid ${theme.colors.gold}66`,
            borderLeft: `3px solid ${theme.colors.gold}`,
            borderRadius: `${theme.radius.md}px`,
            padding: '10px 14px',
            marginBottom: `${theme.spacing.lg}px`,
            display: 'flex', justifyContent: 'space-between',
            fontFamily: theme.font.family, fontSize: theme.font.md,
            color: theme.colors.gold,
          }}>
            <span>Balls: {useGameStore.getState().safariState?.balls}</span>
            <span>Pas: {useGameStore.getState().safariState?.steps}</span>
          </div>
        )}

        {/* ====== ACTIONS ====== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

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

          {/* Safari encounter */}
          {useGameStore.getState().safariState ? (
            <ActionCard
              icon={<IconGrass />}
              title="Chasser un Pokemon"
              subtitle="Chercher dans les herbes"
              accentColor={theme.colors.success}
              onClick={handleSafariSearch}
            />
          ) : (
            /* Wild encounters */
            wildEncounters.length > 0 && (
              <ActionCard
                icon={<IconGrass />}
                title="Hautes herbes"
                subtitle="Pokemon sauvages"
                accentColor={theme.colors.success}
                onClick={handleWildEncounter}
              />
            )
          )}

          {/* Water encounters */}
          {!useGameStore.getState().safariState && waterEncounters.length > 0 && hasSurf && (
            <ActionCard
              icon={<IconWater />}
              title="Surfer sur l'eau"
              subtitle="Creatures aquatiques"
              accentColor={theme.colors.info}
              onClick={handleWaterEncounter}
            />
          )}

          {/* Fishing encounters */}
          {!useGameStore.getState().safariState && fishingEncounters.length > 0 && hasRod && (
            <ActionCard
              icon={<IconFishing />}
              title="Pecher"
              subtitle="Lancer la ligne"
              accentColor="#00bcd4"
              onClick={handleFishingEncounter}
            />
          )}

          {/* Static encounters */}
          {staticEncounters.map((encounter: StaticEncounter) => {
            if (progress.events[encounter.id]) return null;
            if (encounter.requiredItem && !useGameStore.getState().inventory.some(i => i.itemId === encounter.requiredItem && i.quantity > 0)) return null;
            return (
              <ActionCard
                key={encounter.id}
                icon={<IconStar color={encounter.isGift ? theme.colors.success : theme.colors.gold} />}
                title={encounter.name}
                subtitle={encounter.dialogue || (encounter.isGift ? 'Obtenir ce Pokemon ?' : 'Une presence imposante...')}
                accentColor={encounter.isGift ? theme.colors.success : theme.colors.gold}
                variant={encounter.isGift ? 'default' : 'gold'}
                onClick={() => {
                  startWildBattle([{ pokemonId: encounter.pokemonId, minLevel: encounter.level, maxLevel: encounter.level, rate: 100 }], team, encounter.id);
                  setView('battle');
                }}
              />
            );
          })}

          {/* Trainers */}
          {filteredTrainers.map(trainer => {
            const defeated = isTrainerDefeated(trainer.id);
            const locked = lockedTrainers.has(trainer.id);
            return (
              <ActionCard
                key={trainer.id}
                icon={<div style={{
                  width: '22px', height: '22px',
                  borderRadius: theme.radius.round,
                  background: locked ? `${theme.colors.textMuted}15` : defeated ? theme.colors.borderDark : `${theme.colors.primary}22`,
                  border: `1.5px solid ${locked ? theme.colors.textMuted : defeated ? theme.colors.borderDark : theme.colors.primary}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: locked ? '12px' : '10px', color: locked ? theme.colors.textMuted : defeated ? theme.colors.borderDark : theme.colors.primary,
                  fontFamily: theme.font.family,
                }}>
                  {locked ? '🔒' : defeated ? '\u2713' : '!'}
                </div>}
                title={`${trainer.trainerClass} ${trainer.name}`}
                subtitle={locked ? (trainer.requireCondition?.label || 'Inaccessible') : defeated ? 'Vaincu' : `${trainer.team.length} Pokemon`}
                accentColor={locked ? theme.colors.textMuted : theme.colors.primary}
                onClick={locked ? undefined : () => handleTrainerBattle(trainer.id)}
                completed={defeated}
                disabled={defeated || locked}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
