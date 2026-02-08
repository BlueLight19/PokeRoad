import React, { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getPokemonData } from '../../utils/dataLoader';
import { HealthBar } from '../ui/HealthBar';
import { Button } from '../ui/Button';
import { BOX_CAPACITY } from '../../engine/pcStorage';

export function PCStorage() {
  const { pc, team, moveFromPc, setView } = useGameStore();
  const [currentBoxIndex, setCurrentBoxIndex] = useState(pc.currentBoxId || 0);

  const currentBox = pc.boxes[currentBoxIndex];

  const handleNextBox = () => {
    setCurrentBoxIndex((prev) => (prev + 1) % pc.boxes.length);
  };

  const handlePrevBox = () => {
    setCurrentBoxIndex((prev) => (prev - 1 + pc.boxes.length) % pc.boxes.length);
  };

  return (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ color: '#9C27B0', fontSize: '14px', fontFamily: "'Press Start 2P', monospace", marginBottom: '16px', textAlign: 'center' }}>
        PC de Léo
      </h2>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <Button variant="secondary" size="sm" onClick={handlePrevBox}>&lt;</Button>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px' }}>
          {currentBox.name}
        </div>
        <Button variant="secondary" size="sm" onClick={handleNextBox}>&gt;</Button>
      </div>

      <div style={{ color: '#aaa', fontSize: '9px', fontFamily: "'Press Start 2P', monospace", marginBottom: '12px', textAlign: 'center' }}>
        Equipe: {team.length}/6
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '8px',
        background: '#16213e',
        padding: '10px',
        borderRadius: '8px',
        minHeight: '200px'
      }}>
        {currentBox.pokemon.map((pokemon, slotId) => {
          if (!pokemon) {
            return (
              <div key={slotId} style={{
                background: '#0f172a',
                borderRadius: '4px',
                aspectRatio: '1',
                opacity: 0.3
              }} />
            );
          }

          const data = getPokemonData(pokemon.dataId);
          const canMove = team.length < 6;

          return (
            <div
              key={pokemon.uid}
              style={{
                background: '#0f172a',
                borderRadius: '4px',
                aspectRatio: '1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: canMove ? 'pointer' : 'default',
                position: 'relative',
                border: '1px solid #333'
              }}
              onClick={() => {
                if (canMove) moveFromPc(pokemon.uid);
              }}
              title={`${data.name} Nv.${pokemon.level}`}
            >
              <img
                src={data.spriteUrl}
                alt={data.name}
                style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }}
              />
              <div style={{
                position: 'absolute',
                bottom: '2px',
                right: '2px',
                fontSize: '8px',
                background: 'rgba(0,0,0,0.7)',
                padding: '1px 2px',
                borderRadius: '2px'
              }}>
                {pokemon.level}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
        <Button variant="ghost" onClick={() => setView('world_map')}>
          Quitter
        </Button>
      </div>
    </div>
  );
}
