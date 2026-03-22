import { useState, useEffect } from 'react';
import { PokemonInstance } from '../../types/pokemon';
import { getPokemonData, getItemData } from '../../utils/dataLoader';
import { HealthBar } from '../ui/HealthBar';
import { StatusIcon } from '../ui/StatusIcon';
import { typeColors } from '../../utils/typeColors';
import { soundManager } from '../../utils/SoundManager';

interface PokemonDisplayProps {
  pokemon: PokemonInstance;
  isPlayer: boolean;
}

export function PokemonDisplay({ pokemon, isPlayer }: PokemonDisplayProps) {
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    if (pokemon.isShiny) {
      soundManager.playShiny();
    }
  }, [pokemon.uid, pokemon.isShiny]);

  const data = getPokemonData(pokemon.dataId);
  const name = pokemon.nickname || data.name;
  const isFainted = pokemon.currentHp <= 0;
  const spriteUrl = pokemon.isShiny ? data.spriteUrl.replace('pokemon', 'pokemon/shiny') : data.spriteUrl;
  const borderColor = isPlayer ? '#2196F3' : '#e94560';

  // Compute stat boosts
  const s = pokemon.statStages;
  const boosts: { label: string; stage: number; color: string }[] = [];
  if (s.attack !== 0) boosts.push({ label: 'Attaque', stage: s.attack, color: s.attack > 0 ? '#FF9800' : '#2196F3' });
  if (s.defense !== 0) boosts.push({ label: 'Défense', stage: s.defense, color: s.defense > 0 ? '#FFEB3B' : '#9C27B0' });
  if (s.spAtk !== 0) boosts.push({ label: 'Atk. Spé.', stage: s.spAtk, color: s.spAtk > 0 ? '#FF5722' : '#3F51B5' });
  if (s.spDef !== 0) boosts.push({ label: 'Déf. Spé.', stage: s.spDef, color: s.spDef > 0 ? '#CDDC39' : '#673AB7' });
  if (s.speed !== 0) boosts.push({ label: 'Vitesse', stage: s.speed, color: s.speed > 0 ? '#4CAF50' : '#795548' });
  if (s.accuracy !== 0) boosts.push({ label: 'Précision', stage: s.accuracy, color: s.accuracy > 0 ? '#00BCD4' : '#607D8B' });
  if (s.evasion !== 0) boosts.push({ label: 'Esquive', stage: s.evasion, color: s.evasion > 0 ? '#009688' : '#9E9E9E' });

  // Compute volatile statuses
  const v = pokemon.volatile;
  const volatiles: { label: string; color: string }[] = [];
  if (v.confusion > 0) volatiles.push({ label: 'Confus', color: '#FF9800' });
  if (v.leechSeed) volatiles.push({ label: 'Vampigraine', color: '#4CAF50' });
  if (v.cursed) volatiles.push({ label: 'Malédiction', color: '#705898' });
  if (v.bound > 0) volatiles.push({ label: 'Piégé', color: '#C03028' });
  if (v.tauntTurns > 0) volatiles.push({ label: 'Provoqué', color: '#e94560' });
  if (v.encoreTurns > 0) volatiles.push({ label: 'Encore', color: '#FF9800' });
  if (v.substituteHp > 0) volatiles.push({ label: 'Clone', color: '#2196F3' });
  if (v.ingrain) volatiles.push({ label: 'Enraciné', color: '#78C850' });
  if (v.aquaRing) volatiles.push({ label: 'Anneau Hydro', color: '#6890F0' });
  if (v.trapped) volatiles.push({ label: 'Piégé', color: '#A040A0' });
  if (v.perishTurns >= 0) volatiles.push({ label: `Requiem ${v.perishTurns}`, color: '#705898' });

  const hasStatChanges = boosts.length > 0 || volatiles.length > 0;

  // Net stat direction for button color
  const netBoost = boosts.reduce((sum, b) => sum + b.stage, 0);
  const statButtonColor = netBoost > 0 ? '#4CAF50' : netBoost < 0 ? '#e94560' : '#888';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isPlayer ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: '14px',
        padding: '14px 16px',
        background: `linear-gradient(${isPlayer ? '270deg' : '90deg'}, ${borderColor}11 0%, transparent 100%)`,
        borderRadius: '14px',
        border: `2px solid ${borderColor}44`,
        position: 'relative',
        overflow: 'visible',
        animation: isPlayer ? 'slideInRight 0.4s ease' : 'slideInLeft 0.4s ease',
      }}
    >
      {/* Top accent line */}
      <div style={{
        position: 'absolute',
        [isPlayer ? 'right' : 'left']: 0,
        top: 0,
        width: '60px',
        height: '3px',
        background: `linear-gradient(${isPlayer ? '270deg' : '90deg'}, ${borderColor}, transparent)`,
      }} />

      {/* Sprite */}
      <div style={{
        width: '96px',
        height: '96px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        {/* Glow behind sprite */}
        <div style={{
          position: 'absolute',
          inset: '10px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${borderColor}22, transparent 70%)`,
          filter: 'blur(8px)',
        }} />
        <img
          src={spriteUrl}
          alt={name}
          style={{
            width: '96px',
            height: '96px',
            imageRendering: 'pixelated',
            transform: isPlayer ? 'scaleX(-1)' : 'none',
            filter: isFainted ? 'grayscale(1) brightness(0.5)' : 'none',
            transition: 'filter 0.8s ease',
            position: 'relative',
          }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        {pokemon.isShiny && (
          <div style={{
            position: 'absolute',
            inset: '-20px',
            pointerEvents: 'none',
            zIndex: 10
          }}>
            <div className="shiny-star" style={{ top: '10%', left: '10%', animationDelay: '0s' }}>✨</div>
            <div className="shiny-star" style={{ top: '20%', right: '10%', animationDelay: '0.4s' }}>✨</div>
            <div className="shiny-star" style={{ bottom: '15%', left: '15%', animationDelay: '0.8s' }}>✨</div>
            <div className="shiny-star" style={{ bottom: '10%', right: '20%', animationDelay: '1.2s' }}>✨</div>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{
            color: '#fff',
            fontSize: '11px',
            fontFamily: "'Press Start 2P', monospace",
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {name}
          </span>
          {pokemon.isShiny && (
            <span style={{ color: '#FFD700', fontSize: '8px', fontFamily: "'Press Start 2P', monospace", textShadow: '1px 1px 0px #000', animation: 'pulse 2s infinite' }}>
              Shiny !
            </span>
          )}
          <StatusIcon status={pokemon.status} />
        </div>

        <div style={{
          color: '#888',
          fontSize: '9px',
          fontFamily: "'Press Start 2P', monospace",
          marginBottom: '6px',
        }}>
          Niv.{pokemon.level}
        </div>

        <HealthBar current={pokemon.currentHp} max={pokemon.maxHp} />

        {/* Types + stat button row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
          {data.types.map(type => (
            <span
              key={type}
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '7px',
                fontFamily: "'Press Start 2P', monospace",
                color: '#fff',
                background: `linear-gradient(135deg, ${typeColors[type] || '#888'}, ${typeColors[type] || '#888'}aa)`,
                textTransform: 'uppercase',
              }}
            >
              {type}
            </span>
          ))}

          {/* Stat changes button */}
          {hasStatChanges && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowStats(!showStats); }}
              style={{
                marginLeft: 'auto',
                padding: '2px 6px',
                borderRadius: '6px',
                fontSize: '7px',
                fontFamily: "'Press Start 2P', monospace",
                color: '#fff',
                background: `${statButtonColor}44`,
                border: `1px solid ${statButtonColor}`,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                animation: 'pulse 2s infinite alternate',
              }}
            >
              {boosts.length > 0 ? `${boosts.length} stat${boosts.length > 1 ? 's' : ''}` : ''}
              {boosts.length > 0 && volatiles.length > 0 ? ' + ' : ''}
              {volatiles.length > 0 ? `${volatiles.length} effet${volatiles.length > 1 ? 's' : ''}` : ''}
            </button>
          )}
        </div>

        {/* Held item */}
        {pokemon.heldItem && (() => {
          try {
            const item = getItemData(pokemon.heldItem);
            return (
              <div style={{
                fontSize: '7px',
                fontFamily: "'Press Start 2P', monospace",
                color: '#aaa',
                marginTop: '4px',
              }}>
                🔹 {item.name}
              </div>
            );
          } catch { return null; }
        })()}
      </div>

      {/* Stat changes popup */}
      {showStats && hasStatChanges && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowStats(false)}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 99,
            }}
          />
          <div style={{
            position: 'absolute',
            [isPlayer ? 'left' : 'right']: '0',
            top: '100%',
            marginTop: '4px',
            background: '#1a1a2e',
            border: '2px solid #444',
            borderRadius: '8px',
            padding: '10px 12px',
            zIndex: 100,
            minWidth: '160px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
          }}>
            {boosts.length > 0 && (
              <>
                <div style={{
                  color: '#aaa',
                  fontSize: '7px',
                  fontFamily: "'Press Start 2P', monospace",
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                }}>
                  Statistiques
                </div>
                {boosts.map((b, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '3px 0',
                  }}>
                    <span style={{
                      color: '#ccc',
                      fontSize: '7px',
                      fontFamily: "'Press Start 2P', monospace",
                    }}>
                      {b.label}
                    </span>
                    <span style={{
                      fontSize: '8px',
                      fontFamily: "'Press Start 2P', monospace",
                      fontWeight: 'bold',
                      color: b.stage > 0 ? '#4CAF50' : '#e94560',
                    }}>
                      {b.stage > 0 ? `+${b.stage}` : b.stage}
                    </span>
                  </div>
                ))}
              </>
            )}

            {volatiles.length > 0 && (
              <>
                <div style={{
                  color: '#aaa',
                  fontSize: '7px',
                  fontFamily: "'Press Start 2P', monospace",
                  marginTop: boosts.length > 0 ? '8px' : '0',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                }}>
                  Effets
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                  {volatiles.map((vs, i) => (
                    <span
                      key={i}
                      style={{
                        display: 'inline-block',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        fontSize: '7px',
                        fontFamily: "'Press Start 2P', monospace",
                        color: '#fff',
                        background: `${vs.color}88`,
                        border: `1px solid ${vs.color}`,
                      }}
                    >
                      {vs.label}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
