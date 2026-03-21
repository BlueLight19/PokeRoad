import React from 'react';
import { PokemonInstance, PokemonType } from '../../types/pokemon';
import { getMoveData, getPokemonData, getTypeEffectiveness } from '../../utils/dataLoader';
import { soundManager } from '../../utils/SoundManager';

interface MoveSelectionProps {
  pokemon: PokemonInstance;
  onSelectMove: (index: number) => void;
  enemyDataId?: number;
}

const typeColors: Record<string, string> = {
  normal: '#A8A878',
  fire: '#F08030',
  water: '#6890F0',
  grass: '#78C850',
  electric: '#F8D030',
  ice: '#98D8D8',
  fighting: '#C03028',
  poison: '#A040A0',
  ground: '#E0C068',
  flying: '#A890F0',
  psychic: '#F85888',
  bug: '#A8B820',
  rock: '#B8A038',
  ghost: '#705898',
  dragon: '#7038F8',
  dark: '#705848',
  steel: '#B8B8D0',
  fairy: '#EE99AC',
};

function getEffectivenessBadge(
  moveType: PokemonType,
  movePower: number | null,
  enemyDataId?: number
): { text: string; color: string } | null {
  if (!enemyDataId || !movePower) return null;

  try {
    const enemyData = getPokemonData(enemyDataId);
    const effectiveness = getTypeEffectiveness(moveType, enemyData.types);

    if (effectiveness === 0) return { text: 'x0', color: '#888' };
    if (effectiveness === 0.25) return { text: 'x0.25', color: '#e06030' };
    if (effectiveness === 0.5) return { text: 'x0.5', color: '#e09040' };
    if (effectiveness === 1) return null;
    if (effectiveness === 2) return { text: 'x2', color: '#50d050' };
    if (effectiveness >= 4) return { text: 'x4', color: '#30ff30' };
  } catch {
    return null;
  }

  return null;
}

export function MoveSelection({ pokemon, onSelectMove, enemyDataId }: MoveSelectionProps) {
  // Rampage lock-in: force the rampage move
  const rampageLocked = pokemon.volatile.rampageTurns > 0 && pokemon.volatile.rampageMoveId !== undefined;
  const rampageIndex = rampageLocked
    ? pokemon.moves.findIndex(m => m.moveId === pokemon.volatile.rampageMoveId)
    : -1;

  // Encore lock-in: force the encored move
  const encoreLocked = pokemon.volatile.encoreTurns > 0 && pokemon.volatile.encoreMoveId !== undefined;
  const encoreIndex = encoreLocked
    ? pokemon.moves.findIndex(m => m.moveId === pokemon.volatile.encoreMoveId)
    : -1;

  const allMovesEmpty = pokemon.moves.every((m) => m.currentPp <= 0);

  if (allMovesEmpty) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '6px',
        }}
      >
        <button
          onClick={() => {
            soundManager.playClick();
            onSelectMove(-1);
          }}
          style={{
            padding: '10px 8px',
            background: '#55222222',
            border: '2px solid #C03028',
            borderRadius: '8px',
            cursor: 'pointer',
            textAlign: 'center',
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
            Lutte
          </div>
          <div
            style={{
              fontSize: '7px',
              fontFamily: "'Press Start 2P', monospace",
              color: '#C03028',
              textTransform: 'uppercase',
            }}
          >
            normal - Pui:50
          </div>
        </button>
      </div>
    );
  }

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
        const isDisabled = pokemon.volatile.disabled?.moveId === moveInst.moveId;
        const isRampageForced = rampageLocked && index === rampageIndex;
        const isRampageBlocked = rampageLocked && index !== rampageIndex;
        const isEncoreForced = encoreLocked && index === encoreIndex;
        const isEncoreBlocked = encoreLocked && index !== encoreIndex;
        const isLocked = isRampageBlocked || isEncoreBlocked;
        const canUse = haspp && !isDisabled && !isLocked;
        const badge = getEffectivenessBadge(move.type, move.power, enemyDataId);

        return (
          <button
            key={index}
            onClick={() => {
              if (canUse) {
                soundManager.playClick();
                onSelectMove(index);
              }
            }}
            disabled={!canUse}
            style={{
              padding: '10px 8px',
              background: (isRampageForced || isEncoreForced) ? `${typeColors[move.type] || '#555'}44` : canUse ? `${typeColors[move.type] || '#555'}22` : '#1a1a1a',
              border: `2px solid ${(isRampageForced || isEncoreForced) ? '#ff6060' : canUse ? typeColors[move.type] || '#555' : '#333'}`,
              borderRadius: '8px',
              cursor: canUse ? 'pointer' : 'not-allowed',
              opacity: canUse ? 1 : 0.4,
              textAlign: 'left',
              position: 'relative',
            }}
          >
            {badge && (
              <span
                style={{
                  position: 'absolute',
                  top: '3px',
                  right: '4px',
                  fontSize: '7px',
                  fontFamily: "'Press Start 2P', monospace",
                  color: badge.color,
                  lineHeight: 1,
                }}
              >
                {badge.text}
              </span>
            )}
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
            {move.category !== 'status' && move.power && (
              <div
                style={{
                  fontSize: '7px',
                  fontFamily: "'Press Start 2P', monospace",
                  color: '#888',
                  marginTop: '2px',
                }}
              >
                {move.category === 'physical' ? 'PHY' : 'SPE'} - Pui:{move.power} Pre:{move.accuracy ?? '∞'}
              </div>
            )}
            {move.category === 'status' && (
              <div
                style={{
                  fontSize: '7px',
                  fontFamily: "'Press Start 2P', monospace",
                  color: '#888',
                  marginTop: '2px',
                }}
              >
                STATUT - Pre:{move.accuracy ?? '∞'}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
