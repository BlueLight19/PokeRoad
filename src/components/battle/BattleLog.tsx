import React, { useRef, useEffect } from 'react';
import { BattleLogEntry } from '../../types/battle';

interface BattleLogProps {
  logs: BattleLogEntry[];
}

const logColors: Record<BattleLogEntry['type'], string> = {
  info: '#ddd',
  damage: '#f44336',
  status: '#FF9800',
  effective: '#4CAF50',
  critical: '#FFD600',
  catch: '#2196F3',
  xp: '#9C27B0',
};

export function BattleLog({ logs }: BattleLogProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  // Show last 6 logs
  const displayLogs = logs.slice(-6);

  return (
    <div
      style={{
        background: '#0a0a15',
        border: '2px solid #333',
        borderRadius: '8px',
        padding: '8px 12px',
        maxHeight: '120px',
        overflowY: 'auto',
      }}
    >
      {displayLogs.map((log, i) => (
        <div
          key={logs.length - displayLogs.length + i}
          style={{
            color: logColors[log.type] || '#ddd',
            fontSize: '9px',
            fontFamily: "'Press Start 2P', monospace",
            lineHeight: '1.8',
          }}
        >
          {log.message}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
