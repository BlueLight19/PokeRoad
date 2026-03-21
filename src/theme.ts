// PokeRoad Design System — single source of truth for all visual tokens
// Import and use: import { theme } from '../theme';

export const theme = {
  colors: {
    primary: '#e94560',
    primaryLight: '#ff6b8a',
    gold: '#FFD600',
    goldDim: '#FFD60088',
    success: '#4CAF50',
    successDark: '#388E3C',
    successDarker: '#2E7D32',
    info: '#2196F3',
    infoDark: '#1976D2',
    infoDarker: '#1565C0',
    danger: '#f44336',
    dangerDark: '#d32f2f',
    dangerDarker: '#c62828',
    warning: '#FF9800',

    // Backgrounds
    panelBg: '#1a1a2e',
    navyBg: '#16213e',
    deepBg: '#0f1923',
    darkBg: '#0f172a',

    // Borders
    borderDark: '#333',
    borderMid: '#555',
    borderSubtle: '#1a2a3a',

    // Text
    textPrimary: '#fff',
    textSecondary: '#ddd',
    textMuted: '#aaa',
    textDim: '#888',
    textDimmer: '#666',

    // Overlays
    overlay: 'rgba(0,0,0,0.7)',
    overlayLight: 'rgba(0,0,0,0.4)',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },

  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    round: '50%',
  },

  font: {
    family: "'Press Start 2P', monospace" as const,
    micro: '7px',
    xs: '8px',
    sm: '9px',
    md: '10px',
    lg: '11px',
    xl: '12px',
    xxl: '14px',
    hero: '24px',
    title: '32px',
  },

  shadows: {
    button3d: (c: string) => `0 3px 0 ${c}, 0 4px 8px rgba(0,0,0,0.3)`,
    cardSm: '0 2px 8px rgba(0,0,0,0.3)',
    cardMd: '0 4px 20px rgba(0,0,0,0.3)',
    cardLg: '0 8px 32px rgba(0,0,0,0.5)',
    glow: (c: string) => `0 0 6px ${c}44`,
    glowStrong: (c: string) => `0 0 15px ${c}66`,
  },

  borders: {
    thin: (c = '#333') => `1px solid ${c}`,
    medium: (c = '#333') => `2px solid ${c}`,
    thick: (c = '#333') => `3px solid ${c}`,
  },
} as const;
