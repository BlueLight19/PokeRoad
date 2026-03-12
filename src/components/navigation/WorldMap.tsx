import React, { useState, useMemo } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getZoneData, getAllZones, getGymData } from '../../utils/dataLoader';
import { CityData, RouteData } from '../../types/game';
import { Button } from '../ui/Button';

// Complete Kanto progression order
const ZONE_ORDER = [
  'bourg-palette',
  'route-1',
  'jadielle',
  'route-22',
  'route-2',
  'foret-jade',
  'argenta',
  'route-3',
  'mt-moon',
  'route-4',
  'azuria',
  'route-24',
  'route-25',
  'route-5',
  'route-6',
  'carmin',
  'route-11',
  'cave-diglett',
  'route-9',
  'route-10',
  'rock-tunnel',
  'lavanville',
  'route-8',
  'safrania',
  'route-7',
  'celadopole',
  'route-16',
  'route-17',
  'route-18',
  'parmanie',
  'route-15',
  'route-14',
  'route-13',
  'route-12',
  'route-19',
  'route-20',
  'seafoam-islands',
  'cramois-ile',
  'pokemon-mansion',
  'route-21',
  'power-plant',
  'route-23',
  'victory-road',
  'plateau-indigo',
  'league-hall',
  'cerulean-cave',
];

export function WorldMap() {
  const { player, progress, selectZone, setView, team } = useGameStore();

  const zones = getAllZones();
  const orderedZones = ZONE_ORDER.map(id => zones.find(z => z.id === id)).filter(Boolean);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #0f1923 0%, #0a0a15 100%)',
      padding: '16px',
    }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>

        {/* ====== HEADER CARD ====== */}
        <div style={{
          background: 'linear-gradient(135deg, #16213e 0%, #0f1923 100%)',
          borderRadius: '16px',
          border: '2px solid #1a2a3a',
          padding: '16px 20px',
          marginBottom: '16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative accent */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100px',
            height: '3px',
            background: 'linear-gradient(90deg, #e94560, transparent)',
          }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{
                color: '#e94560',
                fontSize: '14px',
                fontFamily: "'Press Start 2P', monospace",
                marginBottom: '8px',
              }}>
                {player.name}
              </div>
              <div style={{
                color: '#FFD600',
                fontSize: '11px',
                fontFamily: "'Press Start 2P', monospace",
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span style={{ color: '#FFD60088', fontSize: '8px' }}>$</span>
                {player.money} P
              </div>
              <div style={{
                color: '#888',
                fontSize: '8px',
                fontFamily: "'Press Start 2P', monospace",
                marginTop: '4px',
              }}>
                {team.length} Pokemon | {progress.caughtPokemon.length} captures
              </div>
            </div>

            {/* Badges */}
            <div style={{ textAlign: 'right' }}>
              <div style={{
                color: '#666',
                fontSize: '7px',
                fontFamily: "'Press Start 2P', monospace",
                marginBottom: '6px',
              }}>
                BADGES
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                {[...Array(8)].map((_, i) => {
                  const earned = i < player.badges.length;
                  return (
                    <div
                      key={i}
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: earned
                          ? 'linear-gradient(135deg, #FFD600, #FFA000)'
                          : '#1a1a2e',
                        border: earned ? '1px solid #FFD600' : '1px solid #333',
                        boxShadow: earned ? '0 0 6px #FFD60044' : 'none',
                        transition: 'all 0.3s ease',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ====== ACTION BUTTONS ====== */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}>
          <Button variant="secondary" size="sm" onClick={() => setView('team')}>
            Equipe ({team.length})
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setView('pc')}>
            PC
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setView('inventory')}>
            Sac
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setView('pokedex')}>
            Pokedex
          </Button>
        </div>

        {/* ====== ZONE MAP ====== */}
        <div style={{
          background: '#0d111766',
          borderRadius: '16px',
          border: '2px solid #1a2a3a',
          padding: '12px',
        }}>
          <div style={{
            color: '#555',
            fontSize: '8px',
            fontFamily: "'Press Start 2P', monospace",
            textAlign: 'center',
            marginBottom: '12px',
            letterSpacing: '2px',
          }}>
            KANTO
          </div>

          {/* Zone path with connecting lines */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {orderedZones.map((zone, idx) => {
              if (!zone) return null;
              const isUnlocked = progress.unlockedZones.includes(zone.id);
              const isCurrent = progress.currentZone === zone.id;
              const zoneType = (zone as any).type;
              const isCity = zoneType === 'city';
              const isDungeon = zoneType === 'dungeon';

              // Don't show locked zones that are far ahead
              if (!isUnlocked) {
                // Show the next couple of locked zones as hints
                const prevZone = idx > 0 ? orderedZones[idx - 1] : null;
                const prevUnlocked = prevZone && progress.unlockedZones.includes(prevZone.id);
                if (!prevUnlocked) return null;
              }

              const zoneTrainers: string[] = (zone as any).trainers || [];
              const defeatedCount = progress.defeatedTrainers.filter(t => zoneTrainers.includes(t)).length;
              const allDefeated = zoneTrainers.length > 0 && defeatedCount === zoneTrainers.length;

              const hasGym = isCity && (zone as any).gymId;
              const gymBadgeEarned = hasGym && (() => {
                let gymDefeated = false;
                if ((zone as any).gymId) {
                  try {
                    const gym = getGymData((zone as any).gymId!);
                    if (gym) {
                      gymDefeated = player.badges.includes(gym.badge);
                    }
                  } catch {
                    // Gym data might be missing or gymId invalid
                  }
                }
                return gymDefeated;
              })();

              const accentColor = isCity ? '#FFD600' : isDungeon ? '#9C27B0' : '#4CAF50';
              const zoneIcon = isCity ? '\u2302' : isDungeon ? '\u2666' : '\u2022';

              return (
                <div key={zone.id}>
                  {/* Connecting line */}
                  {idx > 0 && (
                    <div style={{
                      width: '2px',
                      height: '6px',
                      background: isUnlocked ? `${accentColor}44` : '#1a1a2e',
                      margin: '0 auto',
                    }} />
                  )}

                  <button
                    onClick={() => isUnlocked && selectZone(zone.id)}
                    disabled={!isUnlocked}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      width: '100%',
                      background: isCurrent
                        ? `linear-gradient(90deg, ${accentColor}22 0%, transparent 100%)`
                        : '#0d1117',
                      border: isCurrent
                        ? `2px solid ${accentColor}`
                        : isUnlocked
                          ? `2px solid ${accentColor}33`
                          : '2px solid #151515',
                      borderRadius: '10px',
                      cursor: isUnlocked ? 'pointer' : 'not-allowed',
                      opacity: isUnlocked ? 1 : 0.6,
                      transition: 'all 0.25s ease',
                      textAlign: 'left',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Current zone pulse indicator */}
                    {isCurrent && (
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: '3px',
                        background: accentColor,
                        animation: 'pulse 2s ease infinite',
                      }} />
                    )}

                    {/* Zone icon */}
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: isCity ? '8px' : '50%',
                      background: isUnlocked
                        ? `linear-gradient(135deg, ${accentColor}, ${accentColor}88)`
                        : '#222',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      color: '#fff',
                      flexShrink: 0,
                      boxShadow: isCurrent ? `0 0 10px ${accentColor}44` : 'none',
                    }}>
                      {zoneIcon}
                    </div>

                    {/* Zone info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        color: isUnlocked ? '#fff' : '#555',
                        fontSize: '9px',
                        fontFamily: "'Press Start 2P', monospace",
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {zone.name}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '3px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Trainer progress */}
                        {zoneTrainers.length > 0 && (
                          <span style={{
                            color: allDefeated ? '#4CAF50' : '#666',
                            fontSize: '7px',
                            fontFamily: "'Press Start 2P', monospace",
                          }}>
                            {allDefeated ? '\u2713' : '\u2694'} {defeatedCount}/{zoneTrainers.length}
                          </span>
                        )}

                        {/* Wild pokemon indicator */}
                        {(zone as any).wildEncounters?.length > 0 && (
                          <span style={{
                            color: '#4CAF5088',
                            fontSize: '7px',
                            fontFamily: "'Press Start 2P', monospace",
                          }}>
                            ~ Sauvages
                          </span>
                        )}

                        {/* Gym indicator */}
                        {hasGym && (
                          <span style={{
                            color: gymBadgeEarned ? '#FFD600' : '#e94560',
                            fontSize: '7px',
                            fontFamily: "'Press Start 2P', monospace",
                          }}>
                            {gymBadgeEarned ? '\u2605 Arene' : '! Arene'}
                          </span>
                        )}

                        {/* Dungeon indicator */}
                        {isDungeon && !hasGym && (
                          <span style={{
                            color: '#9C27B088',
                            fontSize: '7px',
                            fontFamily: "'Press Start 2P', monospace",
                          }}>
                            Donjon
                          </span>
                        )}

                        {/* Lock indication */}
                        {!isUnlocked && (zone as any).unlockCondition?.itemId && (
                          <span style={{
                            color: '#FF9800',
                            fontSize: '7px',
                            fontFamily: "'Press Start 2P', monospace",
                          }}>
                            [Objet Requis]
                          </span>
                        )}
                        {!isUnlocked && (zone as any).unlockCondition?.eventId && (
                          <span style={{
                            color: '#E91E63',
                            fontSize: '7px',
                            fontFamily: "'Press Start 2P', monospace",
                          }}>
                            [Bloqué]
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    {isCurrent && (
                      <div style={{
                        color: accentColor,
                        fontSize: '12px',
                        animation: 'pulse 1.5s ease infinite',
                        flexShrink: 0,
                      }}>
                        {'\u25B6'}
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
