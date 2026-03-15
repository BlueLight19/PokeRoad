import { PokemonInstance } from '../../types/pokemon';
import { getPokemonData } from '../../utils/dataLoader';
import { HealthBar } from '../ui/HealthBar';
import { StatusIcon } from '../ui/StatusIcon';

interface PokemonDisplayProps {
  pokemon: PokemonInstance;
  isPlayer: boolean;
}

const typeColors: Record<string, string> = {
  normal: '#A8A878', feu: '#F08030', eau: '#6890F0', plante: '#78C850',
  electrique: '#F8D030', glace: '#98D8D8', combat: '#C03028', poison: '#A040A0',
  sol: '#E0C068', vol: '#A890F0', psy: '#F85888', insecte: '#A8B820',
  roche: '#B8A038', spectre: '#705898', dragon: '#7038F8',
};

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
      </div>
    </div>
  );
}
