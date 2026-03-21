import React, { useState, useMemo } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getZoneData, getAllZones, getGymData, getZoneTrainers } from '../../utils/dataLoader';
import { CityData, RouteData } from '../../types/game';
import { Button } from '../ui/Button';
import cityLogo from '../../assets/cityLogo.png';
import wildsLogo from '../../assets/wildsLogo.png';
import { soundManager } from '../../utils/SoundManager';

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
    const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);

    const zones = getAllZones();
    const orderedZones = ZONE_ORDER.map(id => zones.find(z => z.id === id)).filter(Boolean);

    return (
        <div style={{
            minHeight: '100vh',
            background: 'transparent',
            padding: '24px',
        }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>

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
                    background: 'rgba(13, 17, 23, 0.85)',
                    backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                    borderRadius: '24px',
                    border: '3px solid #1a2a3a',
                    padding: '24px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}>
                    <div style={{
                        color: '#888',
                        fontSize: '12px',
                        fontFamily: "'Press Start 2P', monospace",
                        textAlign: 'center',
                        marginBottom: '20px',
                        letterSpacing: '4px',
                        textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                    }}>
                        CARTE DE KANTO
                    </div>

                    {/* Zone path with connecting lines */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {orderedZones.map((zone, idx) => {
                            if (!zone) return null;
                            const isUnlocked = progress.unlockedZones.includes(zone.id);
                            const isCurrent = progress.currentZone === zone.id;
                            const isHovered = hoveredZoneId === zone.id;
                            const zoneType = (zone as any).type;
                            const isCity = zoneType === 'city';
                            const isDungeon = zoneType === 'dungeon';
                            const isLeague = zone.id.includes('plateau-indigo') || zone.id.includes('victory-road') || zone.id.includes('league-hall');
                            const isWild = !isCity && !isLeague;

                            // Don't show locked zones that are far ahead
                            if (!isUnlocked) {
                                // Show the next couple of locked zones as hints
                                const prevZone = idx > 0 ? orderedZones[idx - 1] : null;
                                const prevUnlocked = prevZone && progress.unlockedZones.includes(prevZone.id);
                                if (!prevUnlocked) return null;
                            }

                            // On utilise getZoneTrainers qui filtre automatiquement les mauvaises variantes du rival
                            // en fonction du starter choisi par le joueur !
                            const activeTrainersData = getZoneTrainers(zone.id, player.starter);
                            const zoneTrainers = activeTrainersData.map(t => t.id);

                            const defeatedCount = progress.defeatedTrainers.filter(t => zoneTrainers.includes(t)).length;
                            const allDefeated = zoneTrainers.length > 0 && defeatedCount === zoneTrainers.length;

                            const dungeonTotalFloors = isDungeon ? ((zone as CityData).totalFloors ?? 1) : 1;
                            const dungeonMaxFloor = isDungeon && dungeonTotalFloors > 1
                              ? useGameStore.getState().getMaxUnlockedFloor(zone.id, dungeonTotalFloors)
                              : 1;

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

                            const accentColor = isLeague ? '#e94560' : isCity ? '#FFD600' : isDungeon ? '#9C27B0' : '#4CAF50';
                            const zoneIcon = isLeague ? '🏆' : isCity ? '\u2302' : isDungeon ? '\u2666' : '\u2022';

                            return (
                                <div key={zone.id}>
                                    {/* Connecting line */}
                                    {idx > 0 && (
                                        <div style={{
                                            width: '4px',
                                            height: '12px',
                                            background: isUnlocked ? `${accentColor}66` : '#1a1a2e',
                                            margin: '0 auto',
                                            borderRadius: '2px',
                                        }} />
                                    )}

                                    <button
                                        onMouseEnter={() => isUnlocked && setHoveredZoneId(zone.id)}
                                        onMouseLeave={() => setHoveredZoneId(null)}
                                        onClick={() => {
                                            if (isUnlocked) {
                                                soundManager.playClick();
                                                selectZone(zone.id);
                                            }
                                        }}
                                        disabled={!isUnlocked}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '16px',
                                            padding: '14px 18px',
                                            width: '100%',
                                            background: isHovered
                                                ? `linear-gradient(90deg, ${accentColor}22 0%, transparent 100%)`
                                                : 'rgba(13, 17, 23, 0.7)',
                                            border: isHovered
                                                ? `2px solid ${accentColor}`
                                                : isUnlocked
                                                    ? `2px solid ${accentColor}33`
                                                    : '2px solid #151515',
                                            borderRadius: '10px',
                                            cursor: isUnlocked ? 'pointer' : 'not-allowed',
                                            opacity: isUnlocked ? 1 : 0.6,
                                            transition: 'all 0.4s ease',
                                            textAlign: 'left',
                                            position: 'relative',
                                            overflow: 'hidden',
                                            backdropFilter: 'blur(4px)',
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
                                            width: isCity ? '60px' : '40px',
                                            height: isCity ? '60px' : '40px',
                                            borderRadius: isCity || isWild ? '0' : '50%',
                                            background: (isCity || isWild) 
                                                ? 'transparent' 
                                                : (isUnlocked ? `linear-gradient(135deg, ${accentColor}, ${accentColor}88)` : '#222'),
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '14px',
                                            fontWeight: 'bold',
                                            color: '#fff',
                                            flexShrink: 0,
                                            boxShadow: (isCity || isWild)
                                                ? 'none' 
                                                : (isHovered ? `0 0 10px ${accentColor}44` : 'none'),
                                            overflow: (isCity || isWild) ? 'visible' : 'hidden',
                                        }}>
                                            {isCity ? (
                                                <img 
                                                    src={cityLogo} 
                                                    alt="City" 
                                                    style={{ 
                                                        width: '100%', 
                                                        height: '100%', 
                                                        objectFit: 'contain',
                                                        filter: isUnlocked ? 'drop-shadow(0 0 6px rgba(255, 214, 0, 0.4))' : 'grayscale(100%) opacity(0.5)',
                                                    }} 
                                                />
                                            ) : isWild ? (
                                                <img 
                                                    src={wildsLogo} 
                                                    alt="Wild" 
                                                    style={{ 
                                                        width: '100%', 
                                                        height: '100%', 
                                                        objectFit: 'contain',
                                                        filter: isUnlocked ? 'drop-shadow(0 0 6px rgba(76, 175, 80, 0.6))' : 'grayscale(100%) opacity(0.5)',
                                                    }} 
                                                />
                                            ) : (
                                                zoneIcon
                                            )}
                                        </div>

                                        {/* Zone info */}
                                        <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>

                                            {/* Informations */}
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                                                {/* Zone Type Indicator */}
                                                {isLeague ? (
                                                    <span style={{ color: `${accentColor}88`, fontSize: '10px', fontFamily: "'Press Start 2P', monospace" }}>Ligue</span>
                                                ) : isCity ? (
                                                    <span style={{ color: `${accentColor}88`, fontSize: '14px', fontFamily: "'Press Start 2P', monospace", fontWeight: 'bold', marginLeft: '12px' }}>Ville</span>
                                                ) : isDungeon ? (
                                                    <span style={{ color: `${accentColor}88`, fontSize: '10px', fontFamily: "'Press Start 2P', monospace" }}>Donjon</span>
                                                ) : null}

                                                {/* Wild pokemon indicator */}
                                                {(zone as any).wildEncounters?.length > 0 && (
                                                    <span style={{
                                                        color: '#4CAF5088',
                                                        fontSize: '10px',
                                                        fontFamily: "'Press Start 2P', monospace",
                                                    }}>
                                                        Sauvages
                                                    </span>
                                                )}

                                                {/* Trainer progress */}
                                                {zoneTrainers.length > 0 && (
                                                    <span style={{
                                                        color: allDefeated ? '#4CAF50' : '#666',
                                                        fontSize: '10px',
                                                        fontFamily: "'Press Start 2P', monospace",
                                                        marginLeft: '8px'
                                                    }}>
                                                        {allDefeated ? '\u2713 ' : ''}{defeatedCount}/{zoneTrainers.length} Dresseurs
                                                    </span>
                                                )}

                                                {/* Floor indicator for multi-floor dungeons */}
                                                {isDungeon && dungeonTotalFloors > 1 && (
                                                    <span style={{
                                                        color: dungeonMaxFloor >= dungeonTotalFloors ? '#4CAF50' : '#9C27B0',
                                                        fontSize: '10px',
                                                        fontFamily: "'Press Start 2P', monospace",
                                                        marginLeft: '8px'
                                                    }}>
                                                        Etage {dungeonMaxFloor}/{dungeonTotalFloors}
                                                    </span>
                                                )}

                                                {/* Gym indicator */}
                                                {hasGym && (
                                                    <span style={{
                                                        color: gymBadgeEarned ? '#FFD600' : '#e94560',
                                                        fontSize: '10px',
                                                        fontFamily: "'Press Start 2P', monospace",
                                                    }}>
                                                        {gymBadgeEarned ? '\u2605 Arene' : '! Arene'}
                                                    </span>
                                                )}

                                                {/* Lock indication */}
                                                {!isUnlocked && (zone as any).unlockCondition?.itemId && (
                                                    <span style={{
                                                        color: '#FF9800',
                                                        fontSize: '10px',
                                                        fontFamily: "'Press Start 2P', monospace",
                                                    }}>
                                                        [Objet Requis]
                                                    </span>
                                                )}
                                                {!isUnlocked && (zone as any).unlockCondition?.eventId && (
                                                    <span style={{
                                                        color: '#E91E63',
                                                        fontSize: '10px',
                                                        fontFamily: "'Press Start 2P', monospace",
                                                    }}>
                                                        [Bloqué]
                                                    </span>
                                                )}
                                            </div>

                                            {/* Nom de la zone */}
                                            <div style={{
                                                color: isUnlocked ? '#fff' : '#555',
                                                fontSize: '12px',
                                                fontFamily: "'Press Start 2P', monospace",
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                textAlign: 'right',
                                                maxWidth: '45%',
                                            }}>
                                                {zone.name}
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
