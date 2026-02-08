import { useRef, useEffect } from 'react';
import { BattleLogEntry } from '../../types/battle';

interface BattleLogProps {
  logs: BattleLogEntry[];
}

const logColors: Record<BattleLogEntry['type'], string> = {
  info: '#ccd6dd',
  damage: '#f44336',
  status: '#FF9800',
  effective: '#4CAF50',
  critical: '#FFD600',
  catch: '#2196F3',
  xp: '#CE93D8',
};

const logIcons: Record<BattleLogEntry['type'], string> = {
  info: '\u25B8',
  damage: '\u2694',
  status: '\u26A0',
  effective: '\u2728',
  critical: '\u26A1',
  catch: '\u25CF',
  xp: '\u2605',
};

export function BattleLog({ logs }: BattleLogProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  const displayLogs = logs.slice(-8);

  return (
    <div
      style={{
        background: '#080c12',
        border: '2px solid #1a2a3a',
        borderRadius: '10px',
        padding: '10px 14px',
        maxHeight: '140px',
        overflowY: 'auto',
        position: 'relative',
      }}
    >
      {/* Top fade */}
      <div style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        height: '8px',
        background: 'linear-gradient(180deg, #080c12, transparent)',
        marginTop: '-10px',
        paddingTop: '10px',
        zIndex: 1,
      }} />

      {displayLogs.map((log, i) => {
        const isNew = i === displayLogs.length - 1;
        return (
          <div
            key={logs.length - displayLogs.length + i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '6px',
              padding: '3px 0',
              opacity: isNew ? 1 : 0.7 + (i / displayLogs.length) * 0.3,
              animation: isNew ? 'slideUp 0.2s ease' : 'none',
            }}
          >
            <span style={{
              color: logColors[log.type] || '#ccd6dd',
              fontSize: '8px',
              lineHeight: '1.8',
              flexShrink: 0,
            }}>
              {logIcons[log.type] || '\u25B8'}
            </span>
            <span
              style={{
                color: logColors[log.type] || '#ccd6dd',
                fontSize: '9px',
                fontFamily: "'Press Start 2P', monospace",
                lineHeight: '1.8',
              }}
            >
              {log.message}
            </span>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
