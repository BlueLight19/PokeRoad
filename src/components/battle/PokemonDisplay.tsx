import React from 'react';
import { PokemonInstance } from '../../types/pokemon';
import { getPokemonData } from '../../utils/dataLoader';
import { HealthBar } from '../ui/HealthBar';
import { StatusIcon } from '../ui/StatusIcon';

interface PokemonDisplayProps {
  pokemon: PokemonInstance;
  isPlayer: boolean;
}

export function PokemonDisplay({ pokemon, isPlayer }: PokemonDisplayProps) {
  const data = getPokemonData(pokemon.dataId);
  const name = pokemon.nickname || data.name;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isPlayer ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        background: '#16213e',
        borderRadius: '12px',
        border: isPlayer ? '2px solid #2196F3' : '2px solid #e94560',
      }}
    >
      {/* Sprite */}
      <div
        style={{
          width: '96px',
          height: '96px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={data.spriteUrl}
          alt={name}
          style={{
            width: '96px',
            height: '96px',
            imageRendering: 'pixelated',
            transform: isPlayer ? 'scaleX(-1)' : 'none',
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '4px',
          }}
        >
          <span
            style={{
              color: '#fff',
              fontSize: '11px',
              fontFamily: "'Press Start 2P', monospace",
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </span>
          <StatusIcon status={pokemon.status} />
        </div>

        <div
          style={{
            color: '#aaa',
            fontSize: '9px',
            fontFamily: "'Press Start 2P', monospace",
            marginBottom: '6px',
          }}
        >
          Niv.{pokemon.level}
        </div>

        <HealthBar current={pokemon.currentHp} max={pokemon.maxHp} />

        {/* Types */}
        <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
          {data.types.map(type => (
            <TypeBadge key={type} type={type} />
          ))}
        </div>
      </div>
    </div>
  );
}

const typeColors: Record<string, string> = {
  normal: '#A8A878',
  feu: '#F08030',
  eau: '#6890F0',
  plante: '#78C850',
  electrique: '#F8D030',
  glace: '#98D8D8',
  combat: '#C03028',
  poison: '#A040A0',
  sol: '#E0C068',
  vol: '#A890F0',
  psy: '#F85888',
  insecte: '#A8B820',
  roche: '#B8A038',
  spectre: '#705898',
  dragon: '#7038F8',
};

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '7px',
        fontFamily: "'Press Start 2P', monospace",
        color: '#fff',
        background: typeColors[type] || '#888',
        textTransform: 'uppercase',
      }}
    >
      {type}
    </span>
  );
}
