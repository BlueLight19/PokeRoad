import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useBattleStore } from '../../stores/battleStore';
import { PokemonDisplay } from './PokemonDisplay';
import { MoveSelection } from './MoveSelection';
import { BattleLog } from './BattleLog';
import { Button } from '../ui/Button';
import { getPokemonData, getItemData, getZoneData } from '../../utils/dataLoader';
import { soundManager } from '../../utils/SoundManager';
import { WildEncounter } from '../../types/game';

export function BattleScreen() {
  const gameStore = useGameStore();
  const battle = useBattleStore();
  const [showBag, setShowBag] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [shakeEnemy, setShakeEnemy] = useState(false);
  const [shakePlayer, setShakePlayer] = useState(false);
  const [flashScreen, setFlashScreen] = useState<string | null>(null);
  const prevLogsLen = useRef(battle.logs.length);

  const player = battle.playerTeam[battle.activePlayerIndex];
  const enemy = battle.enemyTeam[battle.activeEnemyIndex];

  // Animate on new logs (damage, effectiveness)
  useEffect(() => {
    if (battle.logs.length > prevLogsLen.current) {
      const newLogs = battle.logs.slice(prevLogsLen.current);
      for (const log of newLogs) {
        if (log.type === 'damage' && log.message.includes('perd')) {
          soundManager.playDamage();
          // Determine who got hit
          const enemyName = enemy ? (getPokemonData(enemy.dataId).name) : '';
          if (log.message.includes(enemyName)) {
            setShakeEnemy(true);
            setTimeout(() => setShakeEnemy(false), 400);
          } else {
            setShakePlayer(true);
            setTimeout(() => setShakePlayer(false), 400);
          }
        }
        if (log.type === 'effective' && log.message.includes('super efficace')) {
          setFlashScreen('rgba(255, 200, 0, 0.15)');
          setTimeout(() => setFlashScreen(null), 300);
        }
        if (log.type === 'critical') {
          setFlashScreen('rgba(255, 80, 80, 0.2)');
          setTimeout(() => setFlashScreen(null), 300);
        }
      }
    }
    prevLogsLen.current = battle.logs.length;
  }, [battle.logs.length]);

  // Sound effects for phase changes
  useEffect(() => {
    if (battle.phase === 'victory' || battle.phase === 'caught') {
      soundManager.playVictory();
    } else if (battle.phase === 'defeat') {
      soundManager.playFaint();
    }
  }, [battle.phase]);

  if (!player || !enemy) return null;

  const handleEndBattle = (restart: boolean = false) => {
    // Apply XP gains
    for (const xp of battle.xpGained) {
      gameStore.grantXpAndProcess(xp.pokemonIndex, xp.defeatedId, xp.defeatedLevel, battle.type !== 'wild');
    }

    // Apply money
    if (battle.moneyGained > 0) {
      gameStore.addMoney(battle.moneyGained);
    }

    // Mark trainer defeated
    if (battle.trainerId) {
      gameStore.markTrainerDefeated(battle.trainerId);
    }

    // Mark gym defeated
    if (battle.isGym && battle.gymId) {
      gameStore.markGymDefeated(battle.gymId);
    }

    // Capture - add caught Pokemon BEFORE syncing team
    if (battle.caughtPokemon) {
      gameStore.addPokemonToTeam(battle.caughtPokemon);
    }

    // Sync team HP back - use getState() to get fresh state after capture
    const freshState = useGameStore.getState();
    const syncedTeam = [...freshState.team];
    for (let i = 0; i < syncedTeam.length && i < battle.playerTeam.length; i++) {
      syncedTeam[i] = {
        ...syncedTeam[i],
        currentHp: battle.playerTeam[i].currentHp,
        status: battle.playerTeam[i].status,
        statusTurns: battle.playerTeam[i].statusTurns,
      };
      syncedTeam[i].moves = battle.playerTeam[i].moves.map(m => ({ ...m }));
    }
    useGameStore.setState({ team: syncedTeam });

    // Auto-heal after battle
    useGameStore.getState().healTeam();

    battle.clearBattle();

    if (restart && gameStore.selectedZone) {
      // Start new battle
      const zone = getZoneData(gameStore.selectedZone);
      if (zone && (zone.wildEncounters || []).length > 0) {
        battle.startWildBattle(zone.wildEncounters || [], useGameStore.getState().team);
        return;
      }
    }

    useGameStore.getState().setView('world_map');
    useGameStore.getState().saveGameState();
  };

  const handleDefeat = () => {
    gameStore.healTeam();
    battle.clearBattle();
    gameStore.setView('world_map');
  };

  // ====== VICTORY / CAUGHT SCREEN ======
  if (battle.phase === 'victory' || battle.phase === 'caught') {
    const isCaught = battle.phase === 'caught';
    const caughtName = isCaught && battle.caughtPokemon
      ? getPokemonData(battle.caughtPokemon.dataId).name
      : null;

    return (
      <div className="battle-container" style={containerStyle}>
        <div className="battle-frame" style={frameStyle}>
          {/* Victory banner */}
          <div style={{
            textAlign: 'center',
            padding: '20px 0',
            animation: 'slideDown 0.5s ease',
          }}>
            <div style={{
              fontSize: '16px',
              color: isCaught ? '#2196F3' : '#FFD600',
              fontFamily: "'Press Start 2P', monospace",
              textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
              marginBottom: '12px',
            }}>
              {isCaught ? 'Capture reussie !' : 'Victoire !'}
            </div>

            {isCaught && battle.caughtPokemon && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                animation: 'bounceIn 0.6s ease',
              }}>
                <img
                  src={getPokemonData(battle.caughtPokemon.dataId).spriteUrl}
                  alt={caughtName || ''}
                  style={{ width: '96px', height: '96px', imageRendering: 'pixelated' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div style={{ color: '#fff', fontSize: '11px', fontFamily: "'Press Start 2P', monospace" }}>
                  {caughtName} a rejoint l'equipe !
                </div>
              </div>
            )}

            {!isCaught && battle.moneyGained > 0 && (
              <div style={{
                color: '#FFD600',
                fontSize: '10px',
                fontFamily: "'Press Start 2P', monospace",
                marginTop: '8px',
                animation: 'fadeIn 0.8s ease',
              }}>
                + {battle.moneyGained} P
              </div>
            )}
          </div>

          <BattleLog logs={battle.logs} />

          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            {battle.type === 'wild' && (
              <Button variant="primary" onClick={() => handleEndBattle(true)}>
                Combat Suivant
              </Button>
            )}

            <Button variant={battle.type === 'wild' ? "ghost" : "primary"} onClick={() => handleEndBattle(false)}>
              {battle.type === 'wild' ? 'Retour Carte' : 'Continuer'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ====== DEFEAT SCREEN ======
  if (battle.phase === 'defeat') {
    return (
      <div className="battle-container" style={containerStyle}>
        <div className="battle-frame" style={frameStyle}>
          <div style={{
            textAlign: 'center',
            padding: '30px 0',
            animation: 'fadeIn 0.8s ease',
          }}>
            <div style={{
              fontSize: '16px',
              color: '#e94560',
              fontFamily: "'Press Start 2P', monospace",
              textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
              marginBottom: '16px',
            }}>
              Defaite...
            </div>
            <div style={{ color: '#888', fontSize: '9px', fontFamily: "'Press Start 2P', monospace", marginBottom: '20px' }}>
              Vos Pokemon sont soignes
            </div>
          </div>
          <BattleLog logs={battle.logs} />
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <Button variant="danger" onClick={handleDefeat}>
              Retour
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ====== FLED SCREEN ======
  if (battle.phase === 'fled') {
    return (
      <div className="battle-container" style={containerStyle}>
        <div className="battle-frame" style={frameStyle}>
          <BattleLog logs={battle.logs} />
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <Button variant="ghost" onClick={() => { battle.clearBattle(); gameStore.setView('world_map'); }}>
              Continuer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ====== TEAM SWITCH SCREEN ======
  if (showTeam || battle.phase === 'switching') {
    return (
      <div className="battle-container" style={containerStyle}>
        <div className="battle-frame" style={frameStyle}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
            padding: '8px 12px',
            background: 'linear-gradient(90deg, #e94560 0%, transparent 100%)',
            borderRadius: '6px',
          }}>
            <span style={{ fontSize: '14px' }}>&#9733;</span>
            <span style={{ color: '#fff', fontSize: '12px', fontFamily: "'Press Start 2P', monospace" }}>
              {battle.phase === 'switching' ? 'Envoyez un Pokemon !' : 'Changer de Pokemon'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {battle.playerTeam.map((p, idx) => {
              const pData = getPokemonData(p.dataId);
              const isActive = idx === battle.activePlayerIndex;
              const isFainted = p.currentHp <= 0;
              const hpRatio = p.currentHp / p.maxHp;
              const hpColor = hpRatio > 0.5 ? '#4CAF50' : hpRatio > 0.2 ? '#FF9800' : '#f44336';

              return (
                <button
                  key={idx}
                  onClick={() => {
                    if (!isFainted && !isActive) {
                      battle.selectSwitch(idx);
                      setShowTeam(false);
                    }
                  }}
                  disabled={isFainted || isActive}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    width: '100%',
                    background: isActive
                      ? 'linear-gradient(90deg, #16213e, #1a3a5c)'
                      : isFainted ? '#1a0a0a' : '#0d1117',
                    border: isActive ? '2px solid #2196F3' : isFainted ? '2px solid #f4433644' : '2px solid #222',
                    borderRadius: '8px',
                    cursor: isFainted || isActive ? 'default' : 'pointer',
                    opacity: isFainted ? 0.5 : 1,
                    textAlign: 'left',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <img src={pData.spriteUrl} alt={pData.name}
                    style={{ width: '48px', height: '48px', imageRendering: 'pixelated', filter: isFainted ? 'grayscale(1)' : 'none' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#fff', fontSize: '9px', fontFamily: "'Press Start 2P', monospace" }}>
                        {p.nickname || pData.name}
                      </span>
                      <span style={{ color: '#888', fontSize: '8px', fontFamily: "'Press Start 2P', monospace" }}>
                        Nv.{p.level}
                      </span>
                      {isActive && <span style={{ color: '#2196F3', fontSize: '7px', fontFamily: "'Press Start 2P', monospace" }}>ACTIF</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <div style={{ flex: 1, height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${hpRatio * 100}%`, height: '100%', background: hpColor, borderRadius: '4px', transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ color: '#aaa', fontSize: '7px', fontFamily: "'Press Start 2P', monospace", minWidth: '55px', textAlign: 'right' }}>
                        {p.currentHp}/{p.maxHp}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {battle.phase !== 'switching' && (
            <div style={{ marginTop: '12px' }}>
              <Button variant="ghost" size="sm" onClick={() => setShowTeam(false)}>
                Retour
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ====== BAG SCREEN ======
  if (showBag) {
    const inventory = gameStore.inventory.filter(item => {
      try {
        const data = getItemData(item.itemId);
        return data.usableInBattle;
      } catch {
        return true;
      }
    });

    // Group items by category
    const balls = inventory.filter(i => { try { return getItemData(i.itemId).category === 'pokeball'; } catch { return false; } });
    const healing = inventory.filter(i => { try { const d = getItemData(i.itemId); return d.category === 'potion' || d.category === 'revive' || d.category === 'status_heal'; } catch { return false; } });

    const renderItemButton = (item: typeof inventory[0]) => {
      let itemData;
      try { itemData = getItemData(item.itemId); } catch { return null; }

      const categoryIcons: Record<string, string> = {
        pokeball: 'O',
        potion: '+',
        revive: '!',
        status_heal: '*',
      };

      return (
        <button
          key={item.itemId}
          onClick={() => {
            if (itemData.effect?.type === 'catch') {
              gameStore.removeItem(item.itemId, 1);
              battle.attemptCapture(item.itemId);
              setShowBag(false);
            } else {
              gameStore.removeItem(item.itemId, 1);
              battle.useItem(item.itemId);
              setShowBag(false);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            width: '100%',
            background: '#0d1117',
            border: '2px solid #222',
            borderRadius: '8px',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: itemData.category === 'pokeball' ? '#e94560' : '#4CAF50',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: '#fff',
            fontWeight: 'bold',
            flexShrink: 0,
          }}>
            {categoryIcons[itemData.category] || '?'}
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ color: '#fff', fontSize: '9px', fontFamily: "'Press Start 2P', monospace" }}>
              {itemData.name}
            </span>
            <div style={{ color: '#666', fontSize: '7px', fontFamily: "'Press Start 2P', monospace", marginTop: '2px' }}>
              {itemData.description}
            </div>
          </div>
          <span style={{
            color: '#FFD600',
            fontSize: '10px',
            fontFamily: "'Press Start 2P', monospace",
            background: '#FFD60022',
            padding: '2px 8px',
            borderRadius: '10px',
          }}>
            x{item.quantity}
          </span>
        </button>
      );
    };

    return (
      <div className="battle-container" style={containerStyle}>
        <div className="battle-frame" style={frameStyle}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
            padding: '8px 12px',
            background: 'linear-gradient(90deg, #2196F3 0%, transparent 100%)',
            borderRadius: '6px',
          }}>
            <span style={{ fontSize: '14px' }}>&#9776;</span>
            <span style={{ color: '#fff', fontSize: '12px', fontFamily: "'Press Start 2P', monospace" }}>
              Sac
            </span>
          </div>

          {inventory.length === 0 ? (
            <div style={{ color: '#666', fontSize: '9px', fontFamily: "'Press Start 2P', monospace", textAlign: 'center', padding: '30px' }}>
              Sac vide
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {balls.length > 0 && (
                <>
                  <div style={{ color: '#e94560', fontSize: '8px', fontFamily: "'Press Start 2P', monospace", padding: '4px 0', borderBottom: '1px solid #222' }}>
                    Poke Balls
                  </div>
                  {balls.map(renderItemButton)}
                </>
              )}
              {healing.length > 0 && (
                <>
                  <div style={{ color: '#4CAF50', fontSize: '8px', fontFamily: "'Press Start 2P', monospace", padding: '4px 0', borderBottom: '1px solid #222', marginTop: '8px' }}>
                    Soins
                  </div>
                  {healing.map(renderItemButton)}
                </>
              )}
            </div>
          )}

          <div style={{ marginTop: '12px' }}>
            <Button variant="ghost" size="sm" onClick={() => setShowBag(false)}>
              Retour
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ====== MAIN BATTLE UI ======
  return (
    <div className="battle-container" style={containerStyle}>
      {/* Flash overlay */}
      {flashScreen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: flashScreen,
          zIndex: 100,
          pointerEvents: 'none',
          animation: 'flashFade 0.3s ease',
        }} />
      )}

      <div className="battle-frame" style={frameStyle}>
        {/* Battle header - trainer info */}
        {battle.trainerName && (
          <div style={{
            textAlign: 'center',
            marginBottom: '8px',
            padding: '6px 12px',
            background: 'linear-gradient(90deg, transparent, #e9456033, transparent)',
            borderRadius: '4px',
          }}>
            <span style={{ color: '#e94560', fontSize: '10px', fontFamily: "'Press Start 2P', monospace" }}>
              VS {battle.trainerName}
            </span>
          </div>
        )}

        {/* Enemy display */}
        <div style={{
          transform: shakeEnemy ? 'translateX(-5px)' : 'none',
          animation: shakeEnemy ? 'hitShake 0.4s ease' : 'none',
          transition: 'transform 0.1s',
        }}>
          <PokemonDisplay pokemon={enemy} isPlayer={false} />
        </div>

        {/* VS separator */}
        <div style={{
          textAlign: 'center',
          margin: '4px 0',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '50%',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, #333, transparent)',
          }} />
          <span style={{
            position: 'relative',
            background: '#0f1923',
            padding: '0 12px',
            color: '#555',
            fontSize: '8px',
            fontFamily: "'Press Start 2P', monospace",
          }}>
            Tour {battle.turnNumber}
          </span>
        </div>

        {/* Player display */}
        <div style={{
          transform: shakePlayer ? 'translateX(5px)' : 'none',
          animation: shakePlayer ? 'hitShake 0.4s ease' : 'none',
          transition: 'transform 0.1s',
        }}>
          <PokemonDisplay pokemon={player} isPlayer={true} />
        </div>

        <div style={{ height: '8px' }} />

        {/* Battle log */}
        <BattleLog logs={battle.logs} />

        <div style={{ height: '10px' }} />

        {/* Action area */}
        {/* Action area */}
        {battle.phase === 'choosing' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            {battle.type === 'safari' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Button
                  variant="primary"
                  onClick={battle.throwSafariBall}
                  style={{ background: '#4CAF50', borderColor: '#2E7D32', flexDirection: 'column', gap: '4px' }}
                >
                  <span>Safari Ball</span>
                  <span style={{ fontSize: '9px', opacity: 0.8 }}>x{useGameStore.getState().safariState?.balls ?? 0}</span>
                </Button>
                <Button
                  variant="secondary"
                  onClick={battle.throwRock}
                  style={{ background: '#795548', borderColor: '#4E342E', flexDirection: 'column', gap: '4px' }}
                >
                  <span>Caillou</span>
                  <span style={{ fontSize: '9px', opacity: 0.8 }}>Enrager</span>
                </Button>
                <Button
                  variant="secondary"
                  onClick={battle.throwBait}
                  style={{ background: '#FFC107', borderColor: '#FFA000', color: '#000', flexDirection: 'column', gap: '4px' }}
                >
                  <span>Appât</span>
                  <span style={{ fontSize: '9px', opacity: 0.8 }}>Manger</span>
                </Button>
                <Button
                  variant="danger"
                  onClick={battle.attemptFlee}
                  style={{ flexDirection: 'column', gap: '4px' }}
                >
                  <span>Fuite</span>
                  <span style={{ fontSize: '9px', opacity: 0.8 }}>Quitter</span>
                </Button>
              </div>
            ) : (
              <>
                {/* Move selection */}
                <MoveSelection
                  pokemon={player}
                  onSelectMove={(index) => battle.selectMove(index)}
                />

                <div style={{ height: '10px' }} />

                {/* Bottom actions */}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  padding: '8px 0',
                  borderTop: '1px solid #222',
                }}>
                  <Button variant="secondary" size="sm" onClick={() => setShowBag(true)}>
                    Sac
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowTeam(true)}>
                    Pokemon
                  </Button>
                  {battle.type === 'wild' && (
                    <Button variant="danger" size="sm" onClick={() => battle.attemptFlee()}>
                      Fuite
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ====== STYLES ======
const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '12px',
  background: 'radial-gradient(ellipse at top, #0f1923 0%, #0a0a15 100%)',
};

const frameStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '520px',
  background: '#0f1923',
  border: '3px solid #1a2a3a',
  borderRadius: '16px',
  padding: '16px',
  boxShadow: '0 0 30px rgba(0,0,0,0.5), inset 0 1px 0 #1a2a3a44',
};
