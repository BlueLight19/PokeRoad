import React, { useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { getPokemonData, getMoveData } from '../utils/dataLoader';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { soundManager } from '../utils/SoundManager';

export function EvolutionModal() {
  const { pendingEvolution, team, confirmEvolution } = useGameStore();
  const [animating, setAnimating] = useState(false);
  const [animStage, setAnimStage] = useState(0);

  if (!pendingEvolution) return null;

  const pokemon = team[pendingEvolution.pokemonIndex];
  if (!pokemon) return null;

  const currentData = getPokemonData(pokemon.dataId);
  const targetData = getPokemonData(pendingEvolution.targetId);
  const name = pokemon.nickname || currentData.name;
  const currentSpriteUrl = pokemon.isShiny ? currentData.spriteUrl.replace('pokemon', 'pokemon/shiny') : currentData.spriteUrl;
  const targetSpriteUrl = pokemon.isShiny ? targetData.spriteUrl.replace('pokemon', 'pokemon/shiny') : targetData.spriteUrl;

  const startAnimation = () => {
    setAnimating(true);
    setAnimStage(1);
    
    // Pulse glow
    setTimeout(() => {
      setAnimStage(2);
      
      // Fast flashing between shapes
      setTimeout(() => {
        setAnimStage(3); // Start reveal instantly
        
        // Show congrats message after reveal
        setTimeout(() => {
          setAnimStage(4);
          
          // Show congrats message, then finalize
          setTimeout(() => {
            confirmEvolution(true);
          }, 3000);
        }, 1500); 
      }, 3000); 
    }, 2000); 
  };

  return (
    <Modal open={true} title={animating ? "Évolution en cours..." : "Évolution !"}>
      <style>
        {`
        @keyframes evPulse {
          0% { filter: brightness(1) drop-shadow(0 0 0px #fff); transform: scale(1); }
          50% { filter: brightness(1.5) drop-shadow(0 0 15px #fff); transform: scale(1.1); }
          100% { filter: brightness(1) drop-shadow(0 0 0px #fff); transform: scale(1); }
        }
        @keyframes evFlashCurrent {
          0%, 100% { opacity: 1; filter: brightness(0) invert(1) drop-shadow(0 0 10px #fff); }
          50% { opacity: 0; filter: brightness(0) invert(1) drop-shadow(0 0 10px #fff); }
        }
        @keyframes evFlashTarget {
          0%, 100% { opacity: 0; filter: brightness(0) invert(1) drop-shadow(0 0 10px #fff); transform: scale(1.1); }
          50% { opacity: 1; filter: brightness(0) invert(1) drop-shadow(0 0 10px #fff); transform: scale(1.1); }
        }
        @keyframes evWhiteout {
          0% { background: rgba(255,255,255,0); }
          50% { background: rgba(255,255,255,1); }
          100% { background: rgba(255,255,255,0); }
        }
        @keyframes evReveal {
          0% { filter: brightness(10) drop-shadow(0 0 40px #FFD600); transform: scale(0.5); }
          100% { filter: brightness(1) drop-shadow(0 0 0px #FFD600); transform: scale(1); }
        }
        @keyframes evTextGlow {
          0%, 100% { text-shadow: 0 0 5px #fff; }
          50% { text-shadow: 0 0 15px #FFD600; color: #FFFDE7; }
        }
        `}
      </style>

      <div style={{ textAlign: 'center', position: 'relative', overflow: 'hidden', minHeight: '180px' }}>
        
        {/* Removed whiteout flash */}

        {/* Not animating yet */}
        {!animating && (
          <>
            <div style={{ color: '#fff', fontSize: '10px', fontFamily: "'Press Start 2P', monospace", marginBottom: '16px' }}>
              {name} veut evoluer en {targetData.name} !
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
              <div>
                <img src={currentSpriteUrl} alt={currentData.name} style={{ width: '80px', height: '80px', imageRendering: 'pixelated' }} />
                <div style={{ color: '#aaa', fontSize: '8px', fontFamily: "'Press Start 2P', monospace", marginTop: '4px' }}>
                  {currentData.name}
                </div>
              </div>
              <div style={{ color: '#FFD600', fontSize: '20px' }}>→</div>
              <div>
                <img src={targetSpriteUrl} alt={targetData.name} style={{ width: '80px', height: '80px', imageRendering: 'pixelated' }} />
                <div style={{ color: '#FFD600', fontSize: '8px', fontFamily: "'Press Start 2P', monospace", marginTop: '4px' }}>
                  {targetData.name}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Button variant="primary" onClick={() => { soundManager.playClick(); startAnimation(); }}>
                Évoluer
              </Button>
              <Button variant="ghost" onClick={() => confirmEvolution(false)}>
                Annuler
              </Button>
            </div>
          </>
        )}

        {/* Phase 1 & 2: Animating */}
        {(animStage === 1 || animStage === 2) && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '140px', position: 'relative' }}>
            <div style={{ color: '#fff', fontSize: '12px', fontFamily: "'Press Start 2P', monospace", marginBottom: '20px' }}>
              Quoi ? {name} évolue !
            </div>
            <div style={{ position: 'relative', width: '120px', height: '120px' }}>
              <img
                src={currentSpriteUrl}
                alt={currentData.name}
                style={{
                  width: '120px', height: '120px', imageRendering: 'pixelated', position: 'absolute', top: 0, left: 0,
                  animation: animStage === 1 ? 'evPulse 0.5s infinite' : 'evFlashCurrent 0.2s infinite'
                }}
              />
              {animStage === 2 && (
                <img
                  src={targetSpriteUrl}
                  alt={targetData.name}
                  style={{
                    width: '120px', height: '120px', imageRendering: 'pixelated', position: 'absolute', top: 0, left: 0,
                    animation: 'evFlashTarget 0.2s infinite'
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* Phase 3 & 4: Finalizing */}
        {(animStage === 3 || animStage === 4) && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '140px' }}>
            {animStage === 4 ? (
              <div style={{ color: '#FFD600', fontSize: '10px', fontFamily: "'Press Start 2P', monospace", marginBottom: '20px' }}>
                Félicitations ! Votre {name} a évolué en {targetData.name} !
              </div>
            ) : (
              <div style={{ height: '30px', width: '100%' }}></div>
            )}
            <img
              src={targetSpriteUrl}
              alt={targetData.name}
              style={{
                width: '120px', height: '120px', imageRendering: 'pixelated',
                animation: animStage === 3 ? 'evReveal 1.5s ease-out forwards' : 'none'
              }}
            />
          </div>
        )}

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
                onClick={() => {
                  soundManager.playClick();
                  learnMoveChoice(i);
                }}
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
