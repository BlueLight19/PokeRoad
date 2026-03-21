import React from 'react';
import { theme } from '../../theme';

interface HealthBarProps {
  current: number;
  max: number;
  showText?: boolean;
  height?: number;
}

export function getHpColor(ratio: number): string {
  return ratio > 0.5 ? theme.colors.success : ratio > 0.2 ? theme.colors.warning : theme.colors.danger;
}

export function HealthBar({ current, max, showText = true, height = 12 }: HealthBarProps) {
  const ratio = Math.max(0, Math.min(1, current / max));
  const color = getHpColor(ratio);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: `${theme.spacing.sm}px`, width: '100%' }}>
      <span style={{ fontSize: theme.font.md, color: theme.colors.textMuted, fontFamily: theme.font.family }}>
        PV
      </span>
      <div
        style={{
          flex: 1,
          height: `${height}px`,
          background: theme.colors.borderDark,
          borderRadius: `${theme.radius.sm}px`,
          overflow: 'hidden',
          border: theme.borders.thin(theme.colors.borderMid),
        }}
      >
        <div
          style={{
            width: `${ratio * 100}%`,
            height: '100%',
            background: `linear-gradient(180deg, ${color}, ${color}88)`,
            transition: 'width 0.5s ease-out, background 0.5s ease',
            borderRadius: '3px',
          }}
        />
      </div>
      {showText && (
        <span
          style={{
            fontSize: theme.font.md,
            color: theme.colors.textSecondary,
            fontFamily: theme.font.family,
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
