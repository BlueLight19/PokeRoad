import React from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getPokemonData } from '../../utils/dataLoader';
import { HealthBar } from '../ui/HealthBar';
import { Button } from '../ui/Button';

export function PCStorage() {
  const { pc, team, moveFromPc, moveToPc, setView } = useGameStore();

  return (
    <div style={{ padding: '16px', maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ color: '#9C27B0', fontSize: '14px', fontFamily: "'Press Start 2P', monospace", marginBottom: '16px', textAlign: 'center' }}>
        PC - Stockage
      </h2>

      <div style={{ color: '#aaa', fontSize: '9px', fontFamily: "'Press Start 2P', monospace", marginBottom: '12px' }}>
        Equipe: {team.length}/6 | PC: {pc.length} Pokemon
      </div>

      {pc.length === 0 ? (
        <div style={{ color: '#666', fontSize: '10px', fontFamily: "'Press Start 2P', monospace", textAlign: 'center', padding: '40px' }}>
          Le PC est vide
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {pc.map(pokemon => {
            const data = getPokemonData(pokemon.dataId);
            const name = pokemon.nickname || data.name;
            const canMove = team.length < 6;

            return (
              <div
                key={pokemon.uid}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  background: '#16213e',
                  border: '1px solid #333',
                  borderRadius: '8px',
                }}
              >
                <img
                  src={data.spriteUrl}
                  alt={name}
                  style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontSize: '9px', fontFamily: "'Press Start 2P', monospace" }}>
                    {name} Nv.{pokemon.level}
                  </div>
                  <HealthBar current={pokemon.currentHp} max={pokemon.maxHp} height={6} showText={false} />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!canMove}
                  onClick={() => moveFromPc(pokemon.uid)}
                >
                  Retirer
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: '16px' }}>
        <Button variant="ghost" onClick={() => setView('world_map')}>
          Retour
        </Button>
      </div>
    </div>
  );
}
