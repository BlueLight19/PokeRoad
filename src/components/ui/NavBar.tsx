import React, { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { theme } from '../../theme';
import { soundManager } from '../../utils/SoundManager';
import { GameView } from '../../types/game';

interface NavItem {
  view: GameView | 'save';
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { view: 'world_map', label: 'Carte' },
  { view: 'team', label: 'Equipe' },
  { view: 'pc', label: 'PC' },
  { view: 'inventory', label: 'Sac' },
  { view: 'pokedex', label: 'Pokdex' },
  { view: 'save', label: 'Sauveg.' },
];

// Pixel-art style icons rendered as small styled elements
function NavIcon({ view, isActive, color }: { view: string; isActive: boolean; color: string }) {
  const s: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
  };

  switch (view) {
    case 'world_map':
      // Compass / map pin
      return (
        <div style={s}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke={color} strokeWidth="1.5" fill="none" />
            <polygon points="10,3 12,9 10,8 8,9" fill={color} />
            <polygon points="10,17 8,11 10,12 12,11" fill={`${color}66`} />
          </svg>
        </div>
      );
    case 'team':
      // Pokeball
      return (
        <div style={s}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke={color} strokeWidth="1.5" fill="none" />
            <line x1="2" y1="10" x2="18" y2="10" stroke={color} strokeWidth="1.5" />
            <circle cx="10" cy="10" r="2.5" stroke={color} strokeWidth="1.5" fill="none" />
          </svg>
        </div>
      );
    case 'pc':
      // Monitor / PC box
      return (
        <div style={s}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="3" width="14" height="10" rx="1.5" stroke={color} strokeWidth="1.5" fill="none" />
            <line x1="8" y1="13" x2="8" y2="16" stroke={color} strokeWidth="1.5" />
            <line x1="12" y1="13" x2="12" y2="16" stroke={color} strokeWidth="1.5" />
            <line x1="6" y1="16.5" x2="14" y2="16.5" stroke={color} strokeWidth="1.5" />
          </svg>
        </div>
      );
    case 'inventory':
      // Bag / backpack
      return (
        <div style={s}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7 6V4.5C7 3.67 7.67 3 8.5 3h3c.83 0 1.5.67 1.5 1.5V6" stroke={color} strokeWidth="1.5" />
            <rect x="4" y="6" width="12" height="11" rx="2" stroke={color} strokeWidth="1.5" fill="none" />
            <line x1="8" y1="10" x2="12" y2="10" stroke={color} strokeWidth="1.5" />
            <line x1="10" y1="8.5" x2="10" y2="11.5" stroke={color} strokeWidth="1.5" />
          </svg>
        </div>
      );
    case 'pokedex':
      // Book / Pokédex
      return (
        <div style={s}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="4" y="2" width="12" height="16" rx="1.5" stroke={color} strokeWidth="1.5" fill="none" />
            <circle cx="10" cy="7" r="2.5" stroke={color} strokeWidth="1.2" fill="none" />
            <line x1="7" y1="12" x2="13" y2="12" stroke={color} strokeWidth="1.2" />
            <line x1="7" y1="14.5" x2="11" y2="14.5" stroke={color} strokeWidth="1.2" />
          </svg>
        </div>
      );
    case 'save':
      // Floppy / save
      return (
        <div style={s}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 3.5C4 2.67 4.67 2 5.5 2h7.59c.4 0 .78.16 1.06.44l2.41 2.41c.28.28.44.66.44 1.06V16.5c0 .83-.67 1.5-1.5 1.5h-11c-.83 0-1.5-.67-1.5-1.5V3.5z" stroke={color} strokeWidth="1.5" fill="none" />
            <rect x="7" y="2" width="6" height="5" rx="0.5" stroke={color} strokeWidth="1" fill="none" />
            <rect x="6" y="11" width="8" height="5" rx="0.5" stroke={color} strokeWidth="1" fill="none" />
          </svg>
        </div>
      );
    default:
      return null;
  }
}

const HIDDEN_VIEWS: GameView[] = ['title', 'battle', 'hall_of_fame'];

export function NavBar() {
  const currentView = useGameStore(s => s.currentView);
  const setView = useGameStore(s => s.setView);
  const saveGameState = useGameStore(s => s.saveGameState);
  const [saveFlash, setSaveFlash] = useState(false);

  if (HIDDEN_VIEWS.includes(currentView)) return null;

  const handleTap = (item: NavItem) => {
    soundManager.playClick();
    if (item.view === 'save') {
      saveGameState();
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 1500);
    } else {
      setView(item.view as GameView);
    }
  };

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 900,
      display: 'flex',
      justifyContent: 'center',
    }}>
      <div style={{
        display: 'flex',
        width: '100%',
        background: `${theme.colors.deepBg}ee`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: theme.borders.thin(theme.colors.borderSubtle),
        boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
      }}>
        {NAV_ITEMS.map(item => {
          const isActive = item.view !== 'save' && currentView === item.view;
          const isSave = item.view === 'save';
          const showSuccess = isSave && saveFlash;

          const color = showSuccess
            ? theme.colors.success
            : isActive
              ? theme.colors.primary
              : theme.colors.textDim;

          return (
            <button
              key={item.view}
              onClick={() => handleTap(item)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                padding: '12px 0 14px',
                background: 'transparent',
                border: 'none',
                borderTop: '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
            >
              {/* Active glow line */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: '15%',
                  right: '15%',
                  height: '1px',
                  background: theme.colors.primary,
                  boxShadow: `0 0 8px ${theme.colors.primary}, 0 0 16px ${theme.colors.primary}66`,
                }} />
              )}

              {showSuccess ? (
                <div style={{
                  width: '22px', height: '22px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: theme.colors.success,
                  fontSize: '16px',
                  fontFamily: theme.font.family,
                }}>
                  {'\u2713'}
                </div>
              ) : (
                <NavIcon view={item.view} isActive={isActive} color={color} />
              )}

              <span style={{
                fontSize: theme.font.xs,
                fontFamily: theme.font.family,
                color,
                transition: 'color 0.15s ease',
              }}>
                {showSuccess ? 'OK!' : item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
