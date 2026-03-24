import { useState, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { Button } from './Button';
import { theme } from '../../theme';
import { NPCData } from '../../types/game';

interface NpcDialogueProps {
  npc: NPCData;
  dialogueIndex: number;
  onAdvance: () => void;
}

export function NpcDialogue({ npc, dialogueIndex, onAdvance }: NpcDialogueProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const fullText = npc.dialogue[dialogueIndex];
  const gameSpeed = useGameStore(s => s.settings.gameSpeed);

  useEffect(() => {
    setDisplayedText('');
    setIsTyping(true);
    let current = 0;
    const interval = setInterval(() => {
      current++;
      setDisplayedText(fullText.slice(0, current));
      if (current >= fullText.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 10 / gameSpeed);
    return () => clearInterval(interval);
  }, [fullText, gameSpeed]);

  const handleClick = () => {
    onAdvance();
  };

  return (
    <div style={{
      padding: `${theme.spacing.lg}px`,
      maxWidth: '500px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '300px',
    }}>
      {/* NPC name tag */}
      <div style={{
        background: `linear-gradient(90deg, ${theme.colors.gold}, #FFA000)`,
        padding: `6px ${theme.spacing.lg}px`,
        borderRadius: `${theme.radius.md}px ${theme.radius.md}px 0 0`,
        display: 'inline-block',
        alignSelf: 'flex-start',
      }}>
        <span style={{
          color: '#000',
          fontSize: theme.font.md,
          fontFamily: theme.font.family,
          fontWeight: 'bold',
        }}>
          {npc.name}
        </span>
      </div>

      {/* Dialogue box */}
      <div
        onClick={handleClick}
        style={{
          flex: 1,
          background: theme.colors.deepBg,
          border: theme.borders.thick(theme.colors.gold),
          borderRadius: `0 ${theme.radius.lg}px ${theme.radius.lg}px ${theme.radius.lg}px`,
          padding: `${theme.spacing.xl}px`,
          color: theme.colors.textPrimary,
          fontFamily: theme.font.family,
          fontSize: theme.font.md,
          lineHeight: '2',
          marginBottom: `${theme.spacing.lg}px`,
          cursor: 'pointer',
          minHeight: '120px',
          position: 'relative',
          boxShadow: `0 0 15px ${theme.colors.goldDim}22, inset 0 0 30px rgba(0, 0, 0, 0.3)`,
        }}
      >
        {displayedText}
        {!isTyping && (
          <span style={{
            position: 'absolute',
            bottom: '10px',
            right: '14px',
            fontSize: theme.font.xs,
            color: theme.colors.gold,
            animation: 'pulse 1s infinite alternate',
          }}>
            {dialogueIndex < npc.dialogue.length - 1 ? '\u25BC' : '\u2715'}
          </span>
        )}
      </div>

      {/* Progress dots */}
      {npc.dialogue.length > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '6px',
          marginBottom: `${theme.spacing.md}px`,
        }}>
          {npc.dialogue.map((_, i) => (
            <div key={i} style={{
              width: `${theme.spacing.sm}px`,
              height: `${theme.spacing.sm}px`,
              borderRadius: theme.radius.round,
              background: i === dialogueIndex
                ? theme.colors.gold
                : i < dialogueIndex
                  ? theme.colors.textDimmer
                  : theme.colors.borderDark,
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
      )}

      <Button onClick={handleClick} style={{ width: '100%' }}>
        {isTyping ? 'Passer' : dialogueIndex < npc.dialogue.length - 1 ? 'Suivant' : 'Fermer'}
      </Button>
    </div>
  );
}
