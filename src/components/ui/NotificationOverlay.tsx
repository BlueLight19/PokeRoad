import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getItemData, getPokemonData } from '../../utils/dataLoader';
import { soundManager } from '../../utils/SoundManager';

export function NotificationOverlay() {
  const { notifications, removeNotification } = useGameStore();
  const [activeNotification, setActiveNotification] = useState<any>(null);

  useEffect(() => {
    if (notifications.length > 0 && !activeNotification) {
      setActiveNotification(notifications[0]);
      soundManager.playClick();
    }
  }, [notifications, activeNotification]);

  if (!activeNotification) return null;

  const handleDismiss = () => {
    soundManager.playClick();
    removeNotification(activeNotification.id);
    setActiveNotification(null);
  };

  let iconSrc = '';
  let title = '';
  let subText = '';

  if (activeNotification.type === 'item' && activeNotification.itemId) {
    try {
      const itemData = getItemData(activeNotification.itemId);
      if (itemData.sprite && itemData.sprite.startsWith('http')) {
        iconSrc = itemData.sprite;
      } else {
        const spriteName = (itemData.sprite || activeNotification.itemId).replace(/^(tm|hm)-(\d+)$/, '$1$2');
        iconSrc = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${spriteName}.png`;
      }
      title = `Vous avez obtenu ${activeNotification.quantity || 1}x ${itemData.name} !`;
      subText = itemData.description;
    } catch (e) {
      iconSrc = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png`;
      title = `Vous avez obtenu un objet !`;
      subText = '';
    }
  } else if (activeNotification.type === 'pokemon' && activeNotification.pokemonId) {
    try {
      const pokemonData = getPokemonData(activeNotification.pokemonId);
      iconSrc = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${activeNotification.pokemonId}.png`;
      title = `Vous avez obtenu ${pokemonData.name} !`;
      subText = `Niveau ${activeNotification.level || 5}`;
    } catch {
      title = `Vous avez obtenu un Pokémon !`;
    }
  }

  return (
    <div
      onClick={handleDismiss}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
        zIndex: 10000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        animation: 'fadeInNotif 0.3s ease-out',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30,30,40,0.95) 0%, rgba(20,20,30,0.95) 100%)',
          border: '2px solid #FFD600',
          borderRadius: '16px',
          padding: '24px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: '0 8px 32px rgba(255, 214, 0, 0.2)',
          maxWidth: '80%',
          textAlign: 'center',
          animation: 'slideUpNotif 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            background: 'radial-gradient(circle, rgba(255,214,0,0.2) 0%, transparent 70%)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: '16px',
            borderRadius: '50%',
            animation: 'pulseNotif 2s infinite',
          }}
        >
          <img
            src={iconSrc}
            alt="icon"
            style={{
              width: activeNotification.type === 'pokemon' ? '80px' : '48px',
              height: activeNotification.type === 'pokemon' ? '80px' : '48px',
              imageRendering: 'pixelated',
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png';
            }}
          />
        </div>

        <h3 style={{
          color: '#FFD600',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '12px',
          lineHeight: '1.6',
          margin: '0 0 12px 0',
          textShadow: '0 2px 4px rgba(0,0,0,0.5)'
        }}>
          {title}
        </h3>

        <p style={{
          color: '#aaa',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '8px',
          lineHeight: '1.6',
          margin: 0,
          maxWidth: '280px',
        }}>
          {subText}
        </p>

        <div style={{
          marginTop: '24px',
          color: '#ccc',
          fontSize: '8px',
          fontFamily: "'Press Start 2P', monospace",
          animation: 'blinkNotif 1.5s infinite'
        }}>
          ▶ Cliquez pour continuer
        </div>
      </div>

      <style>
        {`
          @keyframes fadeInNotif {
            from { background: rgba(0, 0, 0, 0); backdrop-filter: blur(0px); }
            to { background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(4px); }
          }
          @keyframes slideUpNotif {
            from { transform: translateY(50px) scale(0.9); opacity: 0; }
            to { transform: translateY(0) scale(1); opacity: 1; }
          }
          @keyframes blinkNotif {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
          @keyframes pulseNotif {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 214, 0, 0.4); }
            70% { transform: scale(1); box-shadow: 0 0 0 15px rgba(255, 214, 0, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 214, 0, 0); }
          }
        `}
      </style>
    </div>
  );
}
