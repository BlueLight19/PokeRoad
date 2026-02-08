import React from 'react';
import { PokemonInstance } from '../../types/pokemon';
import { getMoveData } from '../../utils/dataLoader';

interface MoveSelectionProps {
  pokemon: PokemonInstance;
  onSelectMove: (index: number) => void;
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

export function MoveSelection({ pokemon, onSelectMove }: MoveSelectionProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '6px',
      }}
    >
      {pokemon.moves.map((moveInst, index) => {
        const move = getMoveData(moveInst.moveId);
        const haspp = moveInst.currentPp > 0;

        return (
          <button
            key={index}
            onClick={() => haspp && onSelectMove(index)}
            disabled={!haspp}
            style={{
              padding: '10px 8px',
              background: haspp ? `${typeColors[move.type] || '#555'}22` : '#1a1a1a',
              border: `2px solid ${haspp ? typeColors[move.type] || '#555' : '#333'}`,
              borderRadius: '8px',
              cursor: haspp ? 'pointer' : 'not-allowed',
              opacity: haspp ? 1 : 0.4,
              textAlign: 'left',
            }}
          >
            <div
              style={{
                color: '#fff',
                fontSize: '10px',
                fontFamily: "'Press Start 2P', monospace",
                marginBottom: '4px',
              }}
            >
              {move.name}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '7px',
                  fontFamily: "'Press Start 2P', monospace",
                  color: typeColors[move.type] || '#888',
                  textTransform: 'uppercase',
                }}
              >
                {move.type}
              </span>
              <span
                style={{
                  fontSize: '8px',
                  fontFamily: "'Press Start 2P', monospace",
                  color: '#aaa',
                }}
              >
                {moveInst.currentPp}/{moveInst.maxPp}
              </span>
            </div>
            {move.power && (
              <div
                style={{
                  fontSize: '7px',
                  fontFamily: "'Press Start 2P', monospace",
                  color: '#888',
                  marginTop: '2px',
                }}
              >
                Pui:{move.power} Pre:{move.accuracy ?? '∞'}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
