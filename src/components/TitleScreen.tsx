import React, { useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { getPokemonData } from '../utils/dataLoader';
import { Button } from './ui/Button';

export function TitleScreen() {
  const { startNewGame, loadGameState, hasSaveData } = useGameStore();
  const [showNewGame, setShowNewGame] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [selectedStarter, setSelectedStarter] = useState<number | null>(null);

  const starters = [
    { id: 1, name: 'Bulbizarre', type: 'plante', color: '#78C850' },
    { id: 4, name: 'Salamèche', type: 'feu', color: '#F08030' },
    { id: 7, name: 'Carapuce', type: 'eau', color: '#6890F0' },
  ];

  const handleStart = () => {
    if (!playerName.trim() || selectedStarter === null) return;
    startNewGame(playerName.trim(), selectedStarter);
  };

  const handleContinue = () => {
    loadGameState();
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
      }}>
        <h2 style={{
          color: '#e94560',
          fontSize: '16px',
          fontFamily: "'Press Start 2P', monospace",
          marginBottom: '24px',
        }}>
          Nouvelle Partie
        </h2>

        {/* Player name */}
        <div style={{ marginBottom: '24px', width: '100%', maxWidth: '400px' }}>
          <label style={{
            color: '#aaa',
            fontSize: '10px',
            fontFamily: "'Press Start 2P', monospace",
            display: 'block',
            marginBottom: '8px',
          }}>
            Votre nom:
          </label>
          <input
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            maxLength={12}
            placeholder="Entrez votre nom..."
            style={{
              width: '100%',
              padding: '10px 14px',
              background: '#16213e',
              border: '2px solid #333',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '12px',
              fontFamily: "'Press Start 2P', monospace",
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={e => e.target.style.borderColor = '#e94560'}
            onBlur={e => e.target.style.borderColor = '#333'}
          />
        </div>

        {/* Starter selection */}
        <div style={{ marginBottom: '24px', width: '100%', maxWidth: '400px' }}>
          <label style={{
            color: '#aaa',
            fontSize: '10px',
            fontFamily: "'Press Start 2P', monospace",
            display: 'block',
            marginBottom: '12px',
          }}>
            Choisissez votre starter:
          </label>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            {starters.map(starter => (
              <button
                key={starter.id}
                onClick={() => setSelectedStarter(starter.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '12px',
                  background: selectedStarter === starter.id ? `${starter.color}33` : '#16213e',
                  border: `3px solid ${selectedStarter === starter.id ? starter.color : '#333'}`,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  flex: 1,
                }}
              >
                <img
                  src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${starter.id}.png`}
                  alt={starter.name}
                  style={{ width: '80px', height: '80px', imageRendering: 'pixelated' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <span style={{
                  color: selectedStarter === starter.id ? starter.color : '#aaa',
                  fontSize: '9px',
                  fontFamily: "'Press Start 2P', monospace",
                  marginTop: '8px',
                }}>
                  {starter.name}
                </span>
                <span style={{
                  color: starter.color,
                  fontSize: '7px',
                  fontFamily: "'Press Start 2P', monospace",
                  marginTop: '4px',
                  textTransform: 'uppercase',
                }}>
                  {starter.type}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Button
            variant="primary"
            onClick={handleStart}
            disabled={!playerName.trim() || selectedStarter === null}
          >
            Commencer !
          </Button>
          <Button variant="ghost" onClick={() => setShowNewGame(false)}>
            Retour
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
    }}>
      <h1 style={{
        color: '#e94560',
        fontSize: '28px',
        fontFamily: "'Press Start 2P', monospace",
        marginBottom: '8px',
        textAlign: 'center',
        textShadow: '3px 3px 0 #1a1a2e',
      }}>
        PokeRoad
      </h1>
      <p style={{
        color: '#aaa',
        fontSize: '10px',
        fontFamily: "'Press Start 2P', monospace",
        marginBottom: '40px',
      }}>
        Aventure Pokemon par Menus
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '250px' }}>
        {hasSaveData() && (
          <Button variant="primary" size="lg" onClick={handleContinue}>
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

      <div style={{
        marginTop: '60px',
        color: '#444',
        fontSize: '8px',
        fontFamily: "'Press Start 2P', monospace",
      }}>
        v0.1 - MVP
      </div>
    </div>
  );
}
