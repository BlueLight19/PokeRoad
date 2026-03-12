import { useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { Button } from './ui/Button';

export function TitleScreen() {
  const { startNewGame, loadGameState, hasSaveData } = useGameStore();
  const [showNewGame, setShowNewGame] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [selectedStarter, setSelectedStarter] = useState<number | null>(null);

  const starters = [
    { id: 1, name: 'Bulbizarre', type: 'plante', color: '#78C850', desc: 'PV et Spe. equilibres' },
    { id: 4, name: 'Salameche', type: 'feu', color: '#F08030', desc: 'Vitesse et Atk. Spe.' },
    { id: 7, name: 'Carapuce', type: 'eau', color: '#6890F0', desc: 'Defense solide' },
  ];

  const handleStart = () => {
    if (!playerName.trim() || selectedStarter === null) return;
    startNewGame(playerName.trim(), selectedStarter);
  };

  if (showNewGame) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        background: 'radial-gradient(ellipse at center, #16213e 0%, #0a0a15 100%)',
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '32px',
          animation: 'slideDown 0.4s ease',
        }}>
          <h2 style={{
            color: '#e94560',
            fontSize: '16px',
            fontFamily: "'Press Start 2P', monospace",
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
          }}>
            Nouvelle Partie
          </h2>
          <div style={{
            width: '60px',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #e94560, transparent)',
            margin: '12px auto 0',
          }} />
        </div>

        {/* Player name */}
        <div style={{
          marginBottom: '28px',
          width: '100%',
          maxWidth: '420px',
          animation: 'fadeIn 0.5s ease 0.1s both',
        }}>
          <label style={{
            color: '#888',
            fontSize: '9px',
            fontFamily: "'Press Start 2P', monospace",
            display: 'block',
            marginBottom: '10px',
            letterSpacing: '1px',
          }}>
            VOTRE NOM
          </label>
          <input
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            maxLength={12}
            placeholder="..."
            style={{
              width: '100%',
              padding: '14px 18px',
              background: '#0d1117',
              border: '2px solid #1a2a3a',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '14px',
              fontFamily: "'Press Start 2P', monospace",
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            }}
            onFocus={e => {
              e.target.style.borderColor = '#e94560';
              e.target.style.boxShadow = '0 0 15px #e9456022';
            }}
            onBlur={e => {
              e.target.style.borderColor = '#1a2a3a';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Starter selection */}
        <div style={{
          marginBottom: '32px',
          width: '100%',
          maxWidth: '420px',
          animation: 'fadeIn 0.5s ease 0.2s both',
        }}>
          <label style={{
            color: '#888',
            fontSize: '9px',
            fontFamily: "'Press Start 2P', monospace",
            display: 'block',
            marginBottom: '12px',
            letterSpacing: '1px',
          }}>
            CHOISISSEZ VOTRE STARTER
          </label>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            {starters.map((starter, idx) => {
              const isSelected = selectedStarter === starter.id;
              return (
                <button
                  key={starter.id}
                  onClick={() => setSelectedStarter(starter.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '16px 12px',
                    background: isSelected
                      ? `linear-gradient(180deg, ${starter.color}22 0%, ${starter.color}11 100%)`
                      : '#0d1117',
                    border: `3px solid ${isSelected ? starter.color : '#1a2a3a'}`,
                    borderRadius: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    flex: 1,
                    position: 'relative',
                    overflow: 'hidden',
                    animation: `slideUp 0.4s ease ${0.1 + idx * 0.1}s both`,
                  }}
                >
                  {/* Selected glow */}
                  {isSelected && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: `radial-gradient(circle at center 60%, ${starter.color}15, transparent 70%)`,
                    }} />
                  )}

                  <img
                    src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${starter.id}.png`}
                    alt={starter.name}
                    style={{
                      width: '80px',
                      height: '80px',
                      imageRendering: 'pixelated',
                      position: 'relative',
                      filter: isSelected ? 'drop-shadow(0 0 8px ' + starter.color + '44)' : 'none',
                      transition: 'filter 0.3s ease',
                    }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span style={{
                    color: isSelected ? starter.color : '#888',
                    fontSize: '9px',
                    fontFamily: "'Press Start 2P', monospace",
                    marginTop: '8px',
                    transition: 'color 0.2s',
                    position: 'relative',
                  }}>
                    {starter.name}
                  </span>
                  <span style={{
                    color: `${starter.color}88`,
                    fontSize: '7px',
                    fontFamily: "'Press Start 2P', monospace",
                    marginTop: '4px',
                    textTransform: 'uppercase',
                    position: 'relative',
                  }}>
                    {starter.type}
                  </span>
                  {isSelected && (
                    <span style={{
                      color: '#666',
                      fontSize: '6px',
                      fontFamily: "'Press Start 2P', monospace",
                      marginTop: '6px',
                      position: 'relative',
                    }}>
                      {starter.desc}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', animation: 'fadeIn 0.5s ease 0.4s both' }}>
          <Button
            variant="primary"
            size="lg"
            onClick={handleStart}
            disabled={!playerName.trim() || selectedStarter === null}
          >
            Commencer !
          </Button>
          <Button variant="ghost" size="lg" onClick={() => setShowNewGame(false)}>
            Retour
          </Button>
        </div>
      </div>
    );
  }

  // ====== TITLE SCREEN ======
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      background: 'radial-gradient(ellipse at center, #16213e 0%, #0a0a15 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle background decoration */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        background: 'radial-gradient(circle at 30% 40%, #e9456008 0%, transparent 40%), radial-gradient(circle at 70% 60%, #2196F308 0%, transparent 40%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', textAlign: 'center' }}>
        {/* Logo */}
        <div style={{ animation: 'bounceIn 0.8s ease' }}>
          <h1 style={{
            color: '#e94560',
            fontSize: '32px',
            fontFamily: "'Press Start 2P', monospace",
            marginBottom: '4px',
            textShadow: '3px 3px 0 #0a0a15, 0 0 30px #e9456033',
            letterSpacing: '3px',
          }}>
            PokeRoad
          </h1>
          <div style={{
            width: '120px',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #e94560, transparent)',
            margin: '0 auto',
          }} />
        </div>

        <p style={{
          color: '#666',
          fontSize: '9px',
          fontFamily: "'Press Start 2P', monospace",
          marginTop: '16px',
          marginBottom: '48px',
          animation: 'fadeIn 0.8s ease 0.3s both',
          letterSpacing: '1px',
        }}>
          Catch them all !
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          width: '280px',
          animation: 'slideUp 0.6s ease 0.5s both',
        }}>
          {hasSaveData() && (
            <Button variant="primary" size="lg" onClick={() => loadGameState()}>
              Continuer
            </Button>
          )}
          <Button
            variant={hasSaveData() ? 'secondary' : 'primary'}
            size="lg"
            onClick={() => setShowNewGame(true)}
          >
            Nouvelle Partie
          </Button>
        </div>
      </div>

      <div style={{
        position: 'absolute',
        bottom: '20px',
        color: '#333',
        fontSize: '7px',
        fontFamily: "'Press Start 2P', monospace",
        letterSpacing: '1px',
      }}>
        v1.0 - Kanto
      </div>
    </div>
  );
}
