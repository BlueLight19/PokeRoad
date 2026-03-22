import { useState, useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';
import { Button } from './ui/Button';
import { soundManager } from '../utils/SoundManager';
import { hasSave } from '../utils/saveManager';
import { theme } from '../theme';
import profBoreImg from '../assets/Prof_Bore.png';

const PROF_DIALOGUE = [
  "Bienvenue dans le monde des Pokemon ! Je suis le Professeur Bore, chercheur en Pokemon.",
  "Ce monde est vaste et regorge de creatures extraordinaires que l'on appelle Pokemon.",
  "Certains les utilisent comme animaux de compagnie, d'autres les font combattre. Quant a moi... je les etudie !",
  "Mon reve est de constituer l'encyclopedie la plus complete de tous les Pokemon existants, a travers toutes les regions du monde.",
  "Pour cela, j'ai besoin de dresseurs courageux prets a parcourir chaque region, de Kanto jusqu'a Paldea.",
  "Chaque region possede ses propres Pokemon, ses propres champions et sa propre Ligue. Tu devras tous les affronter !",
  "Ton voyage commence ici, a Kanto. Mais ce n'est que le debut d'une longue aventure a travers le monde entier.",
  "Es-tu pret a relever ce defi ? Alors choisis ton premier Pokemon et pars a l'aventure !",
];

export function TitleScreen() {
  const { startNewGame, loadGameState } = useGameStore();
  const [showProfIntro, setShowProfIntro] = useState(false);
  const [profDialogueIndex, setProfDialogueIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [showNewGame, setShowNewGame] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [selectedStarter, setSelectedStarter] = useState<number | null>(null);
  const [saveExists, setSaveExists] = useState(false);
  const [saveChecked, setSaveChecked] = useState(false);

  useEffect(() => {
    hasSave().then(exists => {
      setSaveExists(exists);
      setSaveChecked(true);
    });
  }, []);

  // Professor intro typewriter effect
  useEffect(() => {
    if (!showProfIntro) return;
    const fullText = PROF_DIALOGUE[profDialogueIndex];
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
    }, 25);
    return () => clearInterval(interval);
  }, [showProfIntro, profDialogueIndex]);

  const handleProfClick = () => {
    if (isTyping) {
      setDisplayedText(PROF_DIALOGUE[profDialogueIndex]);
      setIsTyping(false);
    } else if (profDialogueIndex < PROF_DIALOGUE.length - 1) {
      setProfDialogueIndex(i => i + 1);
    } else {
      setShowProfIntro(false);
      setShowNewGame(true);
    }
  };

  const starters = [
    { id: 1, name: 'Bulbizarre', type: 'plante', color: '#78C850', desc: 'PV et Spe. equilibres' },
    { id: 4, name: 'Salameche', type: 'feu', color: '#F08030', desc: 'Vitesse et Atk. Spe.' },
    { id: 7, name: 'Carapuce', type: 'eau', color: '#6890F0', desc: 'Defense solide' },
  ];

  const handleStart = () => {
    if (!playerName.trim() || selectedStarter === null) return;
    startNewGame(playerName.trim(), selectedStarter);
  };

  const handleContinue = async () => {
    await loadGameState();
  };

  // ====== PROFESSOR INTRO ======
  if (showProfIntro) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        background: 'transparent',
      }}>
        <div style={{
          maxWidth: '500px',
          width: '100%',
          animation: 'fadeIn 0.5s ease',
        }}>
          {/* Professor sprite */}
          <div style={{
            textAlign: 'center',
            marginBottom: `${theme.spacing.lg}px`,
          }}>
            <img
              src={profBoreImg}
              alt="Professeur Bore"
              style={{
                width: '160px',
                height: 'auto',
                imageRendering: 'auto',
                filter: `drop-shadow(0 0 20px ${theme.colors.primary}33)`,
                animation: 'slideDown 0.6s ease',
              }}
            />
          </div>

          {/* Name tag */}
          <div style={{
            background: `linear-gradient(90deg, ${theme.colors.gold}, #FFA000)`,
            padding: `6px ${theme.spacing.lg}px`,
            borderRadius: `${theme.radius.md}px ${theme.radius.md}px 0 0`,
            display: 'inline-block',
          }}>
            <span style={{
              color: '#000',
              fontSize: theme.font.md,
              fontFamily: theme.font.family,
              fontWeight: 'bold',
            }}>
              Prof. Bore
            </span>
          </div>

          {/* Dialogue box */}
          <div
            onClick={handleProfClick}
            style={{
              background: theme.colors.deepBg,
              border: theme.borders.thick(theme.colors.gold),
              borderRadius: `0 ${theme.radius.lg}px ${theme.radius.lg}px ${theme.radius.lg}px`,
              padding: `${theme.spacing.xl}px`,
              color: theme.colors.textPrimary,
              fontFamily: theme.font.family,
              fontSize: theme.font.md,
              lineHeight: '2.2',
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
                {profDialogueIndex < PROF_DIALOGUE.length - 1 ? '\u25BC' : '\u2715'}
              </span>
            )}
          </div>

          {/* Progress dots */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '6px',
            marginBottom: `${theme.spacing.md}px`,
          }}>
            {PROF_DIALOGUE.map((_, i) => (
              <div key={i} style={{
                width: '6px',
                height: '6px',
                borderRadius: theme.radius.round,
                background: i === profDialogueIndex
                  ? theme.colors.gold
                  : i < profDialogueIndex
                    ? theme.colors.textDimmer
                    : theme.colors.borderDark,
                transition: 'background 0.3s',
              }} />
            ))}
          </div>

          <Button onClick={handleProfClick} style={{ width: '100%' }}>
            {isTyping ? 'Passer' : profDialogueIndex < PROF_DIALOGUE.length - 1 ? 'Suivant' : 'Commencer'}
          </Button>
        </div>
      </div>
    );
  }

  if (showNewGame) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        background: 'transparent',
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '32px',
          animation: 'slideDown 0.4s ease',
        }}>
          <h2 style={{
            color: '#e94560',
            fontSize: '16px',
            fontFamily: "'Press Start 2P', monospace",
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
          }}>
            Nouvelle Partie
          </h2>
          <div style={{
            width: '60px',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #e94560, transparent)',
            margin: '12px auto 0',
          }} />
        </div>

        {/* Player name */}
        <div style={{
          marginBottom: '28px',
          width: '100%',
          maxWidth: '420px',
          animation: 'fadeIn 0.5s ease 0.1s both',
        }}>
          <label style={{
            color: '#888',
            fontSize: '9px',
            fontFamily: "'Press Start 2P', monospace",
            display: 'block',
            marginBottom: '10px',
            letterSpacing: '1px',
          }}>
            VOTRE NOM
          </label>
          <input
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            maxLength={12}
            placeholder="..."
            style={{
              width: '100%',
              padding: '14px 18px',
              background: '#0d1117',
              border: '2px solid #1a2a3a',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '14px',
              fontFamily: "'Press Start 2P', monospace",
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            }}
            onFocus={e => {
              e.target.style.borderColor = '#e94560';
              e.target.style.boxShadow = '0 0 15px #e9456022';
            }}
            onBlur={e => {
              e.target.style.borderColor = '#1a2a3a';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Starter selection */}
        <div style={{
          marginBottom: '32px',
          width: '100%',
          maxWidth: '420px',
          animation: 'fadeIn 0.5s ease 0.2s both',
        }}>
          <label style={{
            color: '#888',
            fontSize: '9px',
            fontFamily: "'Press Start 2P', monospace",
            display: 'block',
            marginBottom: '12px',
            letterSpacing: '1px',
          }}>
            CHOISISSEZ VOTRE STARTER
          </label>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            {starters.map((starter, idx) => {
              const isSelected = selectedStarter === starter.id;
              return (
                <button
                  key={starter.id}
                  onClick={() => {
                    soundManager.playClick();
                    setSelectedStarter(starter.id);
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '16px 12px',
                    background: isSelected
                      ? `linear-gradient(180deg, ${starter.color}22 0%, ${starter.color}11 100%)`
                      : '#0d1117',
                    border: `3px solid ${isSelected ? starter.color : '#1a2a3a'}`,
                    borderRadius: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    flex: 1,
                    position: 'relative',
                    overflow: 'hidden',
                    animation: `slideUp 0.4s ease ${0.1 + idx * 0.1}s both`,
                  }}
                >
                  {isSelected && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: `radial-gradient(circle at center 60%, ${starter.color}15, transparent 70%)`,
                    }} />
                  )}

                  <img
                    src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${starter.id}.png`}
                    alt={starter.name}
                    style={{
                      width: '80px',
                      height: '80px',
                      imageRendering: 'pixelated',
                      position: 'relative',
                      filter: isSelected ? 'drop-shadow(0 0 8px ' + starter.color + '44)' : 'none',
                      transition: 'filter 0.3s ease',
                    }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span style={{
                    color: isSelected ? starter.color : '#888',
                    fontSize: '9px',
                    fontFamily: "'Press Start 2P', monospace",
                    marginTop: '8px',
                    transition: 'color 0.2s',
                    position: 'relative',
                  }}>
                    {starter.name}
                  </span>
                  <span style={{
                    color: `${starter.color}88`,
                    fontSize: '7px',
                    fontFamily: "'Press Start 2P', monospace",
                    marginTop: '4px',
                    textTransform: 'uppercase',
                    position: 'relative',
                  }}>
                    {starter.type}
                  </span>
                  {isSelected && (
                    <span style={{
                      color: '#666',
                      fontSize: '6px',
                      fontFamily: "'Press Start 2P', monospace",
                      marginTop: '6px',
                      position: 'relative',
                    }}>
                      {starter.desc}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', animation: 'fadeIn 0.5s ease 0.4s both' }}>
          <Button
            variant="primary"
            size="lg"
            onClick={handleStart}
            disabled={!playerName.trim() || selectedStarter === null}
          >
            Commencer !
          </Button>
          <Button variant="ghost" size="lg" onClick={() => setShowNewGame(false)}>
            Retour
          </Button>
        </div>
      </div>
    );
  }

  // ====== TITLE SCREEN ======
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      background: 'transparent',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Lueur rouge douce et diffuse */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '80vw',
        maxWidth: '600px',
        height: '80vw',
        maxHeight: '600px',
        background: 'radial-gradient(circle, rgba(233, 69, 96, 0.15) 0%, rgba(233, 69, 96, 0) 70%)',
        borderRadius: '50%',
        filter: 'blur(60px)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <div style={{ position: 'relative', textAlign: 'center' }}>
        {/* Logo */}
        <div style={{ animation: 'bounceIn 0.8s ease' }}>
          <h1 style={{
            color: '#e94560',
            fontSize: '32px',
            fontFamily: "'Press Start 2P', monospace",
            marginBottom: '4px',
            textShadow: '3px 3px 0 #0a0a15, 0 0 30px #e9456033',
            letterSpacing: '3px',
          }}>
            PokeRoad
          </h1>
          <div style={{
            width: '120px',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #e94560, transparent)',
            margin: '0 auto',
          }} />
        </div>

        <p style={{
          color: '#666',
          fontSize: '9px',
          fontFamily: "'Press Start 2P', monospace",
          marginTop: '16px',
          marginBottom: '48px',
          animation: 'fadeIn 0.8s ease 0.3s both',
          letterSpacing: '1px',
        }}>
          Catch them all !
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          width: '280px',
          animation: 'slideUp 0.6s ease 0.5s both',
        }}>
          {saveChecked && saveExists && (
            <Button variant="primary" size="lg" onClick={handleContinue}>
              Continuer
            </Button>
          )}
          <Button
            variant={saveExists ? 'secondary' : 'primary'}
            size="lg"
            onClick={() => setShowProfIntro(true)}
          >
            Nouvelle Partie
          </Button>
        </div>
      </div>

      <div style={{
        position: 'absolute',
        bottom: '20px',
        color: '#333',
        fontSize: '7px',
        fontFamily: "'Press Start 2P', monospace",
        letterSpacing: '1px',
      }}>
        <span id={"version"}>0.5.2</span>
      </div>
    </div>
  );
}
