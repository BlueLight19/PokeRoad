import React from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getPokemonData, getMoveData } from '../../utils/dataLoader';
import { HealthBar } from '../ui/HealthBar';
import { StatusIcon } from '../ui/StatusIcon';
import { Button } from '../ui/Button';

export function TeamView() {
  const { team, setView, selectedPokemonIndex, healTeam } = useGameStore();
  const [selected, setSelected] = React.useState<number | null>(null);

  // Detailed view of a Pokémon
  if (selected !== null) {
    const pokemon = team[selected];
    if (!pokemon) {
      setSelected(null);
      return null;
    }
    const data = getPokemonData(pokemon.dataId);
    const name = pokemon.nickname || data.name;

    return (
      <div style={{ padding: '16px', maxWidth: '500px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <img
            src={data.spriteUrl}
            alt={name}
            style={{ width: '80px', height: '80px', imageRendering: 'pixelated' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div>
            <div style={{ color: '#fff', fontSize: '14px', fontFamily: "'Press Start 2P', monospace" }}>
              {name}
            </div>
            <div style={{ color: '#aaa', fontSize: '10px', fontFamily: "'Press Start 2P', monospace", marginTop: '4px' }}>
              Niv.{pokemon.level}
            </div>
            <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
              {data.types.map(t => (
                <span key={t} style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '7px',
                  fontFamily: "'Press Start 2P', monospace",
                  color: '#fff',
                  background: typeColors[t] || '#888',
                  textTransform: 'uppercase',
                }}>{t}</span>
              ))}
            </div>
            <StatusIcon status={pokemon.status} />
          </div>
        </div>

        {/* HP */}
        <HealthBar current={pokemon.currentHp} max={pokemon.maxHp} />

        {/* XP bar */}
        <div style={{ marginTop: '8px' }}>
          <div style={{ color: '#aaa', fontSize: '8px', fontFamily: "'Press Start 2P', monospace", marginBottom: '4px' }}>
            XP: {pokemon.xp} / {pokemon.xpToNextLevel}
          </div>
          <div style={{ height: '6px', background: '#333', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, (pokemon.xp / pokemon.xpToNextLevel) * 100)}%`,
              height: '100%',
              background: '#2196F3',
              borderRadius: '3px',
            }} />
          </div>
        </div>

        {/* Stats */}
        <div style={{ marginTop: '16px' }}>
          <h4 style={{ color: '#e94560', fontSize: '10px', fontFamily: "'Press Start 2P', monospace", marginBottom: '8px' }}>
            Statistiques (IV / EV)
          </h4>
          {(['hp', 'attack', 'defense', 'spAtk', 'spDef', 'speed'] as const).map(stat => (
            <div key={stat} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span style={{ color: '#aaa', fontSize: '8px', fontFamily: "'Press Start 2P', monospace" }}>
                {statNames[stat]}
              </span>
              <div style={{ display: 'flex', gap: '8px', color: '#fff', fontSize: '8px', fontFamily: "'Press Start 2P', monospace" }}>
                <span>{pokemon.stats[stat]}</span>
                <span style={{ color: '#666', fontSize: '7px' }}>
                  ({pokemon.ivs[stat]} / {pokemon.evs[stat]})
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Moves */}
        <div style={{ marginTop: '16px' }}>
          <h4 style={{ color: '#e94560', fontSize: '10px', fontFamily: "'Press Start 2P', monospace", marginBottom: '8px' }}>
            Capacites
          </h4>
          {pokemon.moves.map((m, i) => {
            const move = getMoveData(m.moveId);
            return (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 8px',
                marginBottom: '3px',
                background: '#16213e',
                borderRadius: '4px',
                borderLeft: `3px solid ${typeColors[move.type] || '#888'}`,
              }}>
                <span style={{ color: '#fff', fontSize: '9px', fontFamily: "'Press Start 2P', monospace" }}>
                  {move.name}
                </span>
                <span style={{ color: '#aaa', fontSize: '8px', fontFamily: "'Press Start 2P', monospace" }}>
                  PP {m.currentPp}/{m.maxPp}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: '16px' }}>
          <Button variant="ghost" onClick={() => setSelected(null)}>
            Retour
          </Button>
        </div>
      </div>
    );
  }

  // Team list
  return (
    <div style={{ padding: '16px', maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ color: '#2196F3', fontSize: '14px', fontFamily: "'Press Start 2P', monospace", marginBottom: '16px', textAlign: 'center' }}>
        Equipe
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {team.map((pokemon, index) => {
          const data = getPokemonData(pokemon.dataId);
          const name = pokemon.nickname || data.name;
          const isFainted = pokemon.currentHp <= 0;

          return (
            <button
              key={pokemon.uid}
              onClick={() => setSelected(index)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                background: isFainted ? '#1a0a0a' : '#16213e',
                border: isFainted ? '2px solid #f44336' : '2px solid #333',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <img
                src={data.spriteUrl}
                alt={name}
                style={{ width: '48px', height: '48px', imageRendering: 'pixelated', opacity: isFainted ? 0.4 : 1 }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#fff', fontSize: '10px', fontFamily: "'Press Start 2P', monospace" }}>
                    {name}
                  </span>
                  <span style={{ color: '#aaa', fontSize: '8px', fontFamily: "'Press Start 2P', monospace" }}>
                    Nv.{pokemon.level}
                  </span>
                  <StatusIcon status={pokemon.status} />
                </div>
                <div style={{ marginTop: '4px' }}>
                  <HealthBar current={pokemon.currentHp} max={pokemon.maxHp} height={8} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
        <Button variant="ghost" onClick={() => setView('world_map')}>
          Retour
        </Button>
      </div>
    </div>
  );
}

const typeColors: Record<string, string> = {
  normal: '#A8A878', feu: '#F08030', eau: '#6890F0', plante: '#78C850',
  electrique: '#F8D030', glace: '#98D8D8', combat: '#C03028', poison: '#A040A0',
  sol: '#E0C068', vol: '#A890F0', psy: '#F85888', insecte: '#A8B820',
  roche: '#B8A038', spectre: '#705898', dragon: '#7038F8',
};

const statNames: Record<string, string> = {
  hp: 'PV', attack: 'Attaque', defense: 'Defense',
  spAtk: 'Atk. Spe.', spDef: 'Def. Spe.', speed: 'Vitesse',
};
