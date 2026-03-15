import React from 'react';
import { useGameStore } from '../stores/gameStore';
import { getPokemonData, getMoveData } from '../utils/dataLoader';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

export function EvolutionModal() {
  const { pendingEvolution, team, confirmEvolution } = useGameStore();

  if (!pendingEvolution) return null;

  const pokemon = team[pendingEvolution.pokemonIndex];
  if (!pokemon) return null;

  const currentData = getPokemonData(pokemon.dataId);
  const targetData = getPokemonData(pendingEvolution.targetId);
  const name = pokemon.nickname || currentData.name;
  const currentSpriteUrl = pokemon.isShiny ? currentData.spriteUrl.replace('pokemon', 'pokemon/shiny') : currentData.spriteUrl;
  const targetSpriteUrl = pokemon.isShiny ? targetData.spriteUrl.replace('pokemon', 'pokemon/shiny') : targetData.spriteUrl;

  return (
    <Modal open={true} title="Evolution !">
      <div style={{ textAlign: 'center' }}>
        <div style={{
          color: '#fff',
          fontSize: '10px',
          fontFamily: "'Press Start 2P', monospace",
          marginBottom: '16px',
        }}>
          {name} veut evoluer en {targetData.name} !
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
          <div>
            <img
              src={currentSpriteUrl}
              alt={currentData.name}
              style={{ width: '80px', height: '80px', imageRendering: 'pixelated' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div style={{ color: '#aaa', fontSize: '8px', fontFamily: "'Press Start 2P', monospace", marginTop: '4px' }}>
              {currentData.name}
            </div>
          </div>
          <div style={{ color: '#FFD600', fontSize: '20px' }}>→</div>
          <div>
            <img
              src={targetSpriteUrl}
              alt={targetData.name}
              style={{ width: '80px', height: '80px', imageRendering: 'pixelated' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div style={{ color: '#FFD600', fontSize: '8px', fontFamily: "'Press Start 2P', monospace", marginTop: '4px' }}>
              {targetData.name}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <Button variant="primary" onClick={() => confirmEvolution(true)}>
            Evoluer
          </Button>
          <Button variant="ghost" onClick={() => confirmEvolution(false)}>
            Annuler
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function MoveLearnModal() {
  const { pendingMoveLearn, team, learnMoveChoice } = useGameStore();

  if (!pendingMoveLearn) return null;

  const pokemon = team[pendingMoveLearn.pokemonIndex];
  if (!pokemon) return null;

  const newMove = getMoveData(pendingMoveLearn.moveId);
  const pokemonData = getPokemonData(pokemon.dataId);
  const name = pokemon.nickname || pokemonData.name;

  return (
    <Modal open={true} title="Nouvelle Capacite !">
      <div style={{ textAlign: 'center' }}>
        <div style={{
          color: '#fff',
          fontSize: '10px',
          fontFamily: "'Press Start 2P', monospace",
          marginBottom: '16px',
        }}>
          {name} veut apprendre {newMove.name} !
        </div>
        <div style={{
          color: '#aaa',
          fontSize: '8px',
          fontFamily: "'Press Start 2P', monospace",
          marginBottom: '16px',
        }}>
          Choisissez une capacite a oublier:
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
          {pokemon.moves.map((m, i) => {
            const move = getMoveData(m.moveId);
            return (
              <button
                key={i}
                onClick={() => learnMoveChoice(i)}
                style={{
                  padding: '8px 12px',
                  background: '#16213e',
                  border: '1px solid #e94560',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: '#fff',
                  fontSize: '9px',
                  fontFamily: "'Press Start 2P', monospace",
                  textAlign: 'left',
                }}
              >
                Oublier {move.name}
              </button>
            );
          })}
        </div>

        <Button variant="ghost" onClick={() => learnMoveChoice(null)}>
          Ne pas apprendre
        </Button>
      </div>
    </Modal>
  );
}
