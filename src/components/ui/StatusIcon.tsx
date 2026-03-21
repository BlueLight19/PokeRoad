import React from 'react';
import { StatusCondition } from '../../types/pokemon';
import { theme } from '../../theme';

interface StatusIconProps {
  status: StatusCondition;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  paralysis: { label: 'PAR', color: theme.colors.textPrimary, bg: theme.colors.gold },
  sleep: { label: 'SOM', color: theme.colors.textPrimary, bg: '#9E9E9E' },
  poison: { label: 'PSN', color: theme.colors.textPrimary, bg: '#9C27B0' },
  toxic: { label: 'TOX', color: theme.colors.textPrimary, bg: '#7B1FA2' },
  burn: { label: 'BRL', color: theme.colors.textPrimary, bg: '#FF5722' },
  freeze: { label: 'GEL', color: theme.colors.borderDark, bg: '#00BCD4' },
};

export function StatusIcon({ status }: StatusIconProps) {
  if (!status) return null;

  const config = statusConfig[status];
  if (!config) return null;

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 6px',
        borderRadius: `${theme.radius.sm}px`,
        fontSize: theme.font.xs,
        fontFamily: theme.font.family,
        color: config.color,
        background: config.bg,
        fontWeight: 'bold',
      }}
    >
      {config.label}
    </span>
  );
}
