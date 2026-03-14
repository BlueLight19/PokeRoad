import React from 'react';

interface HealthBarProps {
  current: number;
  max: number;
  showText?: boolean;
  height?: number;
}

export function HealthBar({ current, max, showText = true, height = 12 }: HealthBarProps) {
  const ratio = Math.max(0, Math.min(1, current / max));
  const color = ratio > 0.5 ? '#4CAF50' : ratio > 0.2 ? '#FF9800' : '#f44336';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
      <span style={{ fontSize: '10px', color: '#aaa', fontFamily: "'Press Start 2P', monospace" }}>
        PV
      </span>
      <div
        style={{
          flex: 1,
          height: `${height}px`,
          background: '#333',
          borderRadius: '4px',
          overflow: 'hidden',
          border: '1px solid #555',
        }}
      >
        <div
          style={{
            width: `${ratio * 100}%`,
            height: '100%',
            background: `linear-gradient(180deg, ${color}, ${color}88)`,
            transition: 'width 0.8s ease-out, background 0.8s ease',
            borderRadius: '3px',
          }}
        />
      </div>
      {showText && (
        <span
          style={{
            fontSize: '10px',
            color: '#ddd',
            fontFamily: "'Press Start 2P', monospace",
            minWidth: '80px',
            textAlign: 'right',
          }}
        >
          {current}/{max}
        </span>
      )}
    </div>
  );
}
