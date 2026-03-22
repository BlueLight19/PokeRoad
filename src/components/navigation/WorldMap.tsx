import React, { useState, useMemo, useRef } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getAllZones, getGymData, getZoneTrainers } from '../../utils/dataLoader';
import { CityData } from '../../types/game';
import { ZONE_COORDS, ZONE_CONNECTIONS } from '../../data/kantoAreas';
import { theme } from '../../theme';
import { soundManager } from '../../utils/SoundManager';
import kantoMapImg from '../../assets/kantoMap.png';

const ZONE_ORDER = [
    'bourg-palette', 'route-1', 'jadielle', 'route-22', 'route-2', 'foret-jade',
    'argenta', 'route-3', 'mt-moon', 'route-4', 'azuria', 'route-24', 'route-25',
    'route-5', 'route-6', 'carmin', 'route-11', 'cave-diglett',
    'route-9', 'route-10', 'rock-tunnel', 'lavanville', 'pokemon-tower',
    'route-8', 'safrania', 'route-7', 'celadopole',
    'route-16', 'route-17', 'route-18', 'parmanie', 'route-15', 'route-14', 'route-13', 'route-12',
    'route-19', 'route-20', 'seafoam-islands', 'cramois-ile', 'pokemon-mansion', 'route-21',
    'power-plant', 'route-23', 'victory-road', 'plateau-indigo', 'league-hall',
    'cerulean-cave',
];

// Zone type styling
const TYPE_STYLES = {
    city:    { color: '#FFD600', bg: 'linear-gradient(135deg, #FFD600, #FFA000)', border: '#FFF176', size: 28 },
    route:   { color: '#66BB6A', bg: 'linear-gradient(135deg, #66BB6A, #388E3C)', border: '#A5D6A7', size: 16 },
    dungeon: { color: '#CE93D8', bg: 'linear-gradient(135deg, #CE93D8, #7B1FA2)', border: '#E1BEE7', size: 22 },
    league:  { color: '#EF5350', bg: 'linear-gradient(135deg, #EF5350, #C62828)', border: '#EF9A9A', size: 26 },
};

function getZoneType(zone: any): 'city' | 'route' | 'dungeon' | 'league' {
    const id = zone.id;
    if (id.includes('plateau-indigo') || id.includes('victory-road') || id.includes('league-hall')) return 'league';
    if ((zone as any).type === 'city') return 'city';
    if ((zone as any).type === 'dungeon') return 'dungeon';
    return 'route';
}

// Short display names for labels on the map
const SHORT_NAMES: Record<string, string> = {
    'bourg-palette': 'Bourg Palette',
    'jadielle': 'Jadielle',
    'argenta': 'Argenta',
    'azuria': 'Azuria',
    'carmin': 'Carmin',
    'lavanville': 'Lavanville',
    'safrania': 'Safrania',
    'celadopole': 'Celadopole',
    'parmanie': 'Parmanie',
    'cramois-ile': "Cramois'Ile",
    'plateau-indigo': 'Plateau Indigo',
    'league-hall': 'Ligue',
    'cerulean-cave': 'Grotte Azuree',
    'foret-jade': 'Foret de Jade',
    'mt-moon': 'Mont Selenite',
    'rock-tunnel': 'Grotte Sombre',
    'seafoam-islands': 'Iles Ecume',
    'pokemon-mansion': 'Manoir Pokemon',
    'power-plant': 'Centrale',
    'cave-diglett': 'Grotte Diglett',
    'victory-road': 'Route Victoire',
};

// Kanto badge display data (shapes are SVG polygon points for distinct badge silhouettes)
const KANTO_BADGES = [
    { name: 'Roche',  color: '#B8A038', shape: '10,2 18,7 14,18 6,18 2,7' },         // pentagon
    { name: 'Cascade', color: '#6890F0', shape: '10,1 16,6 16,14 10,19 4,14 4,6' },   // hexagon tall
    { name: 'Foudre', color: '#F8D030', shape: '10,1 19,10 10,8 10,19 1,10 10,8' },    // lightning bolt
    { name: 'Prisme', color: '#78C850', shape: '10,2 18,10 10,18 2,10' },              // diamond
    { name: 'Ame',    color: '#F85888', shape: '10,4 14,2 17,6 15,11 10,18 5,11 3,6 6,2' }, // heart-ish
    { name: 'Marais', color: '#F8D030', shape: '3,3 17,3 17,17 3,17' },                // square
    { name: 'Volcan', color: '#F08030', shape: '10,1 18,18 2,18' },                     // triangle
    { name: 'Terre',  color: '#78C850', shape: '10,2 15,5 18,10 15,15 10,18 5,15 2,10 5,5' }, // octagon
];

interface TooltipData {
    zone: any;
    x: number;
    y: number;
    zoneType: string;
    trainers: string;
    gym: string;
    floors: string;
}

export function WorldMap() {
    const { player, progress, selectZone, setView, team } = useGameStore();
    const [tooltip, setTooltip] = useState<TooltipData | null>(null);
    const mapRef = useRef<HTMLDivElement>(null);

    const zones = getAllZones();
    const zoneMap = useMemo(() => {
        const map = new Map<string, any>();
        zones.forEach(z => map.set(z.id, z));
        return map;
    }, [zones]);

    const unlockedSet = useMemo(
        () => new Set(progress.unlockedZones),
        [progress.unlockedZones],
    );

    const getZoneInfo = (zone: any) => {
        const zType = getZoneType(zone);
        const isCity = zType === 'city';
        const isDungeon = (zone as any).type === 'dungeon';

        const activeTrainers = getZoneTrainers(zone.id, player.starter);
        const trainerIds = activeTrainers.map(t => t.id);
        const defeated = progress.defeatedTrainers.filter(t => trainerIds.includes(t)).length;
        const trainers = !isCity && trainerIds.length > 0
            ? `${defeated}/${trainerIds.length} Dresseurs`
            : '';

        let gym = '';
        if (isCity && (zone as any).gymId) {
            try {
                const gymData = getGymData((zone as any).gymId);
                if (gymData) {
                    gym = player.badges.includes(gymData.badge) ? '\u2605 Badge obtenu' : '! Arene';
                }
            } catch { /* */ }
        }

        const totalFloors = isDungeon ? ((zone as CityData).totalFloors ?? 1) : 1;
        let floors = '';
        if (isDungeon && totalFloors > 1) {
            const maxFloor = useGameStore.getState().getMaxUnlockedFloor(zone.id, totalFloors);
            floors = `Etage ${maxFloor}/${totalFloors}`;
        }

        return { zoneType: zType, trainers, gym, floors };
    };

    const handleZoneHover = (zoneId: string, _e: React.MouseEvent) => {
        const zone = zoneMap.get(zoneId);
        if (!zone) return;
        const coords = ZONE_COORDS[zoneId];
        if (!coords) return;
        if (unlockedSet.has(zoneId)) {
            const info = getZoneInfo(zone);
            setTooltip({ zone, x: coords.x, y: coords.y, ...info });
        } else {
            setTooltip({ zone, x: coords.x, y: coords.y, zoneType: getZoneType(zone), trainers: '', gym: '', floors: '' });
        }
    };

    const handleZoneClick = (zoneId: string) => {
        if (unlockedSet.has(zoneId)) {
            soundManager.playClick();
            selectZone(zoneId);
        }
    };

    // Check if a zone is fully completed
    const isZoneComplete = (zone: any) => {
        const trainers = getZoneTrainers(zone.id, player.starter).map(t => t.id);
        const allDefeated = trainers.length > 0 && trainers.every(t => progress.defeatedTrainers.includes(t));
        let gymDone = true;
        if ((zone as any).gymId) {
            try {
                const gym = getGymData((zone as any).gymId);
                gymDone = gym ? player.badges.includes(gym.badge) : true;
            } catch { /* */ }
        }
        return (trainers.length === 0 || allDefeated) && gymDone;
    };

    // Should this zone show a label?
    const shouldShowLabel = (zType: string) => zType !== 'route';

    return (
        <div style={{
            minHeight: '100vh',
            background: 'transparent',
            padding: `${theme.spacing.xxl}px`,
        }}>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>

                {/* ====== HEADER CARD ====== */}
                <div style={{
                    background: `linear-gradient(135deg, ${theme.colors.navyBg} 0%, ${theme.colors.deepBg} 100%)`,
                    borderRadius: `${theme.radius.xl}px`,
                    border: theme.borders.medium(theme.colors.borderSubtle),
                    padding: '14px 16px',
                    marginBottom: `${theme.spacing.lg}px`,
                    boxShadow: theme.shadows.cardMd,
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    {/* Decorative top accent */}
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0,
                        height: '2px',
                        background: `linear-gradient(90deg, ${theme.colors.primary}, ${theme.colors.primary}44, transparent)`,
                    }} />

                    {/* Player info row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: `${theme.spacing.md}px`, marginBottom: `${theme.spacing.md}px` }}>
                        {/* Player avatar circle */}
                        <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: theme.radius.round,
                            background: `linear-gradient(135deg, ${theme.colors.primary}22, ${theme.colors.primary}08)`,
                            border: `2px solid ${theme.colors.primary}44`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <span style={{ fontSize: '18px', lineHeight: 1 }}>🎒</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                color: theme.colors.textPrimary,
                                fontSize: theme.font.xl,
                                fontFamily: theme.font.family,
                                marginBottom: '3px',
                            }}>
                                {player.name}
                            </div>
                            <div style={{ display: 'flex', gap: `${theme.spacing.md}px`, alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{
                                    color: theme.colors.gold,
                                    fontSize: theme.font.sm,
                                    fontFamily: theme.font.family,
                                }}>
                                    {player.money.toLocaleString()} P
                                </span>
                                <span style={{ color: theme.colors.borderDark }}>|</span>
                                <span style={{
                                    color: theme.colors.textDim,
                                    fontSize: theme.font.xs,
                                    fontFamily: theme.font.family,
                                }}>
                                    {team.length} Pkmn
                                </span>
                                <span style={{ color: theme.colors.borderDark }}>|</span>
                                <span style={{
                                    color: theme.colors.textDim,
                                    fontSize: theme.font.xs,
                                    fontFamily: theme.font.family,
                                }}>
                                    {progress.caughtPokemon.length} captures
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Badge case */}
                    <div style={{
                        background: `linear-gradient(180deg, rgba(15,23,42,0.5) 0%, rgba(15,23,42,0.3) 100%)`,
                        borderRadius: `${theme.radius.md}px`,
                        padding: '10px 12px',
                        border: theme.borders.thin(theme.colors.borderDark),
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '8px',
                        }}>
                            <span style={{
                                color: theme.colors.textDimmer,
                                fontSize: theme.font.micro,
                                fontFamily: theme.font.family,
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                            }}>
                                Badges Kanto
                            </span>
                            <span style={{
                                color: player.badges.length === 8 ? theme.colors.gold : theme.colors.textDimmer,
                                fontSize: theme.font.micro,
                                fontFamily: theme.font.family,
                            }}>
                                {player.badges.length}/8
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
                            {KANTO_BADGES.map((badge, i) => {
                                const earned = i < player.badges.length;
                                return (
                                    <div key={i} style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '3px',
                                        flex: 1,
                                    }}>
                                        <div style={{
                                            width: '22px',
                                            height: '22px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            <svg width="20" height="20" viewBox="0 0 20 20">
                                                <polygon
                                                    points={badge.shape}
                                                    fill={earned ? badge.color : theme.colors.panelBg}
                                                    stroke={earned ? badge.color : theme.colors.borderDark}
                                                    strokeWidth="1"
                                                    opacity={earned ? 1 : 0.35}
                                                />
                                                {earned && (
                                                    <polygon
                                                        points={badge.shape}
                                                        fill="white"
                                                        opacity={0.2}
                                                    />
                                                )}
                                            </svg>
                                        </div>
                                        <span style={{
                                            fontSize: '5px',
                                            fontFamily: theme.font.family,
                                            color: earned ? badge.color : theme.colors.borderDark,
                                            textAlign: 'center',
                                            lineHeight: 1,
                                        }}>
                                            {badge.name}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* ====== KANTO MAP ====== */}
                <div style={{
                    borderRadius: `${theme.radius.xl}px`,
                    border: '3px solid #5a8a5a',
                    boxShadow: theme.shadows.cardLg,
                    position: 'relative',
                    overflow: 'hidden',
                    background: '#1a1a2e',
                }}>
                    {/* Title */}
                    <div style={{
                        color: theme.colors.textPrimary,
                        fontSize: theme.font.xl,
                        fontFamily: theme.font.family,
                        textAlign: 'center',
                        padding: `${theme.spacing.md}px 0`,
                        letterSpacing: '4px',
                        textShadow: '0 2px 4px rgba(0,0,0,0.4)',
                        background: 'rgba(0,0,0,0.3)',
                    }}>
                        CARTE DE KANTO
                    </div>

                    {/* Map container — aspect ratio matches the image */}
                    <div
                        ref={mapRef}
                        style={{
                            position: 'relative',
                            width: '100%',
                            paddingBottom: '75%', // 4:3 aspect ratio
                            overflow: 'hidden',
                        }}
                        onMouseLeave={() => setTooltip(null)}
                    >
                        {/* Kanto Map Image */}
                        <img
                            src={kantoMapImg}
                            alt="Kanto Map"
                            style={{
                                position: 'absolute',
                                top: 0, left: 0,
                                width: '100%', height: '100%',
                                objectFit: 'fill',
                                pointerEvents: 'none',
                                userSelect: 'none',
                            }}
                            draggable={false}
                        />

                        {/* SVG connections layer */}
                        <svg
                            style={{
                                position: 'absolute',
                                top: 0, left: 0,
                                width: '100%', height: '100%',
                                pointerEvents: 'none',
                                zIndex: 1,
                            }}
                            viewBox="0 0 100 75"
                            preserveAspectRatio="none"
                        >
                            {ZONE_CONNECTIONS.map(([a, b]) => {
                                const coordA = ZONE_COORDS[a];
                                const coordB = ZONE_COORDS[b];
                                if (!coordA || !coordB) return null;

                                const bothUnlocked = unlockedSet.has(a) && unlockedSet.has(b);
                                const anyUnlocked = unlockedSet.has(a) || unlockedSet.has(b);

                                return (
                                    <line
                                        key={`${a}-${b}`}
                                        x1={coordA.x}
                                        y1={coordA.y * 0.75}
                                        x2={coordB.x}
                                        y2={coordB.y * 0.75}
                                        stroke={bothUnlocked ? 'rgba(255,255,255,0.7)' : anyUnlocked ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}
                                        strokeWidth={bothUnlocked ? '0.5' : '0.3'}
                                        strokeDasharray={bothUnlocked ? 'none' : '1 0.6'}
                                        strokeLinecap="round"
                                    />
                                );
                            })}
                        </svg>

                        {/* Zone markers */}
                        {Object.entries(ZONE_COORDS).map(([zoneId, coords]) => {
                            const zone = zoneMap.get(zoneId);
                            if (!zone) return null;

                            const isUnlocked = unlockedSet.has(zoneId);
                            const isCurrent = progress.currentZone === zoneId;
                            const zType = getZoneType(zone);
                            const style = TYPE_STYLES[zType];
                            const isComplete = isUnlocked && isZoneComplete(zone);
                            const showLabel = shouldShowLabel(zType);
                            const label = SHORT_NAMES[zoneId] || zone.name;

                            return (
                                <React.Fragment key={zoneId}>
                                    {/* Clickable marker */}
                                    <button
                                        onClick={() => handleZoneClick(zoneId)}
                                        onMouseEnter={(e) => handleZoneHover(zoneId, e)}
                                        onMouseLeave={() => setTooltip(null)}
                                        disabled={!isUnlocked}
                                        style={{
                                            position: 'absolute',
                                            left: `${coords.x}%`,
                                            top: `${coords.y}%`,
                                            transform: 'translate(-50%, -50%)',
                                            width: `${style.size}px`,
                                            height: `${style.size}px`,
                                            borderRadius: zType === 'dungeon' ? '4px' : '50%',
                                            background: !isUnlocked
                                                ? '#444'
                                                : style.bg,
                                            border: isCurrent
                                                ? '3px solid #fff'
                                                : !isUnlocked
                                                    ? '2px solid #555'
                                                    : isComplete
                                                        ? `2px solid ${style.border}`
                                                        : `2px solid rgba(255,255,255,0.7)`,
                                            cursor: isUnlocked ? 'pointer' : 'default',
                                            opacity: isUnlocked ? 1 : 0.5,
                                            boxShadow: isCurrent
                                                ? `0 0 12px ${style.color}, 0 0 24px ${style.color}88, 0 0 4px rgba(255,255,255,0.8)`
                                                : isComplete
                                                    ? `0 0 8px ${style.color}88, 0 2px 4px rgba(0,0,0,0.5)`
                                                    : '0 2px 6px rgba(0,0,0,0.6)',
                                            animation: isCurrent ? 'pulse 2s ease infinite' : 'none',
                                            padding: 0,
                                            transition: 'box-shadow 0.2s ease, opacity 0.2s ease, transform 0.15s',
                                            zIndex: isCurrent ? 20 : zType === 'city' ? 10 : zType === 'league' ? 10 : zType === 'dungeon' ? 5 : 2,
                                            ...(zType === 'dungeon' ? { transform: 'translate(-50%, -50%) rotate(45deg)' } : {}),
                                        }}
                                        title={isUnlocked ? zone.name : '???'}
                                    />

                                    {/* Label under marker (cities, dungeons, league only) */}
                                    {showLabel && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                left: `${coords.x}%`,
                                                top: `${coords.y}%`,
                                                transform: `translate(-50%, ${style.size / 2 + 5}px)`,
                                                color: isUnlocked ? '#fff' : 'rgba(255,255,255,0.4)',
                                                fontSize: '7px',
                                                fontWeight: 'bold',
                                                fontFamily: theme.font.family,
                                                whiteSpace: 'nowrap',
                                                pointerEvents: 'none',
                                                textShadow: '0 0 5px #000, 1px 1px 3px #000, -1px -1px 3px #000, 1px -1px 3px #000, -1px 1px 3px #000, 0 0 10px rgba(0,0,0,0.8)',
                                                zIndex: isCurrent ? 19 : 3,
                                                letterSpacing: '0.5px',
                                            }}
                                        >
                                            {isUnlocked ? label : '???'}
                                        </div>
                                    )}
                                </React.Fragment>
                            );
                        })}

                        {/* Tooltip on hover */}
                        {tooltip && (
                            <div style={{
                                position: 'absolute',
                                left: `${Math.min(Math.max(tooltip.x, 15), 85)}%`,
                                top: `${tooltip.y}%`,
                                transform: 'translate(-50%, -100%) translateY(-22px)',
                                background: 'rgba(20, 20, 40, 0.95)',
                                border: `2px solid ${TYPE_STYLES[tooltip.zoneType as keyof typeof TYPE_STYLES]?.color || '#666'}`,
                                borderRadius: `${theme.radius.md}px`,
                                padding: '8px 14px',
                                zIndex: 100,
                                pointerEvents: 'none',
                                boxShadow: `0 4px 20px rgba(0,0,0,0.6), 0 0 8px ${TYPE_STYLES[tooltip.zoneType as keyof typeof TYPE_STYLES]?.color || '#666'}44`,
                                minWidth: '130px',
                                backdropFilter: 'blur(4px)',
                            }}>
                                <div style={{
                                    color: unlockedSet.has(tooltip.zone.id) ? theme.colors.textPrimary : theme.colors.textDim,
                                    fontSize: theme.font.xs,
                                    fontFamily: theme.font.family,
                                    marginBottom: tooltip.trainers || tooltip.gym || tooltip.floors ? '6px' : 0,
                                }}>
                                    {unlockedSet.has(tooltip.zone.id) ? tooltip.zone.name : '\uD83D\uDD12 ???'}
                                </div>
                                {tooltip.gym && (
                                    <div style={{
                                        color: tooltip.gym.includes('\u2605') ? theme.colors.gold : theme.colors.primary,
                                        fontSize: theme.font.micro,
                                        fontFamily: theme.font.family,
                                        marginBottom: '2px',
                                    }}>
                                        {tooltip.gym}
                                    </div>
                                )}
                                {tooltip.trainers && (
                                    <div style={{
                                        color: theme.colors.textDim,
                                        fontSize: theme.font.micro,
                                        fontFamily: theme.font.family,
                                        marginBottom: '2px',
                                    }}>
                                        {tooltip.trainers}
                                    </div>
                                )}
                                {tooltip.floors && (
                                    <div style={{
                                        color: '#CE93D8',
                                        fontSize: theme.font.micro,
                                        fontFamily: theme.font.family,
                                    }}>
                                        {tooltip.floors}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Legend */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: `${theme.spacing.lg}px`,
                        padding: `${theme.spacing.md}px 0`,
                        flexWrap: 'wrap',
                        background: 'rgba(0,0,0,0.3)',
                    }}>
                        {([
                            { key: 'city' as const, label: 'Ville', shape: 'circle' },
                            { key: 'route' as const, label: 'Route', shape: 'circle' },
                            { key: 'dungeon' as const, label: 'Grotte', shape: 'diamond' },
                            { key: 'league' as const, label: 'Ligue', shape: 'circle' },
                        ]).map(item => (
                            <div key={item.label} style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                            }}>
                                <div style={{
                                    width: '14px', height: '14px',
                                    borderRadius: item.shape === 'diamond' ? '3px' : '50%',
                                    background: TYPE_STYLES[item.key].bg,
                                    border: `1.5px solid ${TYPE_STYLES[item.key].border}`,
                                    transform: item.shape === 'diamond' ? 'rotate(45deg)' : 'none',
                                }} />
                                <span style={{
                                    color: theme.colors.textPrimary,
                                    fontSize: theme.font.xs,
                                    fontFamily: theme.font.family,
                                    fontWeight: 'bold',
                                }}>
                                    {item.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
