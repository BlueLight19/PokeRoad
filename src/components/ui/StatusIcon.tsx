import React from 'react';
import { StatusCondition } from '../../types/pokemon';

interface StatusIconProps {
  status: StatusCondition;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  paralysis: { label: 'PAR', color: '#fff', bg: '#FFD600' },
  sleep: { label: 'SOM', color: '#fff', bg: '#9E9E9E' },
  poison: { label: 'PSN', color: '#fff', bg: '#9C27B0' },
  burn: { label: 'BRL', color: '#fff', bg: '#FF5722' },
  freeze: { label: 'GEL', color: '#333', bg: '#00BCD4' },
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
        borderRadius: '4px',
        fontSize: '8px',
        fontFamily: "'Press Start 2P', monospace",
        color: config.color,
        background: config.bg,
        fontWeight: 'bold',
      }}
    >
      {config.label}
    </span>
  );
}
