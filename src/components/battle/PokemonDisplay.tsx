import { PokemonInstance } from '../../types/pokemon';
import { getPokemonData, getItemData } from '../../utils/dataLoader';
import { HealthBar } from '../ui/HealthBar';
import { StatusIcon } from '../ui/StatusIcon';
import { typeColors } from '../../utils/typeColors';

interface PokemonDisplayProps {
  pokemon: PokemonInstance;
  isPlayer: boolean;
}

export function PokemonDisplay({ pokemon, isPlayer }: PokemonDisplayProps) {
  const data = getPokemonData(pokemon.dataId);
  const name = pokemon.nickname || data.name;
  const isFainted = pokemon.currentHp <= 0;
  const spriteUrl = pokemon.isShiny ? data.spriteUrl.replace('pokemon', 'pokemon/shiny') : data.spriteUrl;
  const borderColor = isPlayer ? '#2196F3' : '#e94560';

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
        overflow: 'hidden',
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
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            animation: 'pulse 1s infinite alternate',
            textShadow: '0 0 10px gold',
            zIndex: 10
          }}>✨</div>
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

        {/* Types */}
        <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
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
        </div>

        {/* Held item */}
        {pokemon.heldItem && (() => {
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
        })()}

        {/* Stat changes */}
        {(() => {
          const s = pokemon.statStages;
          const boosts: { label: string; stage: number; color: string }[] = [];
          if (s.attack !== 0) boosts.push({ label: 'Atk', stage: s.attack, color: s.attack > 0 ? '#FF9800' : '#2196F3' });
          if (s.defense !== 0) boosts.push({ label: 'Def', stage: s.defense, color: s.defense > 0 ? '#FFEB3B' : '#9C27B0' });
          if (s.spAtk !== 0) boosts.push({ label: 'SpA', stage: s.spAtk, color: s.spAtk > 0 ? '#FF5722' : '#3F51B5' });
          if (s.spDef !== 0) boosts.push({ label: 'SpD', stage: s.spDef, color: s.spDef > 0 ? '#CDDC39' : '#673AB7' });
          if (s.speed !== 0) boosts.push({ label: 'Spe', stage: s.speed, color: s.speed > 0 ? '#4CAF50' : '#795548' });
          if (s.accuracy !== 0) boosts.push({ label: 'Acc', stage: s.accuracy, color: s.accuracy > 0 ? '#00BCD4' : '#607D8B' });
          if (s.evasion !== 0) boosts.push({ label: 'Esa', stage: s.evasion, color: s.evasion > 0 ? '#009688' : '#9E9E9E' });

          if (boosts.length === 0) return null;
          return (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px',
              marginTop: '6px',
            }}>
              {boosts.map((b, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    fontSize: '6px',
                    fontFamily: "'Press Start 2P', monospace",
                    color: b.stage > 0 ? '#fff' : '#fff',
                    background: `${b.color}99`,
                    border: `1px solid ${b.color}`,
                    boxShadow: b.stage > 0 ? `0 0 5px ${b.color}aa` : 'none',
                  }}
                >
                  {b.label} {b.stage > 0 ? `+${b.stage}` : b.stage}
                </span>
              ))}
            </div>
          );
        })()}

        {/* Volatile status indicators */}
        {(() => {
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
          if (volatiles.length === 0) return null;
          return (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '3px',
              marginTop: '4px',
            }}>
              {volatiles.map((vs, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    padding: '1px 4px',
                    borderRadius: '6px',
                    fontSize: '6px',
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
          );
        })()}
      </div>
    </div>
  );
}
