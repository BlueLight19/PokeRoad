import React, { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useBattleStore } from '../../stores/battleStore';
import { PokemonDisplay } from './PokemonDisplay';
import { MoveSelection } from './MoveSelection';
import { BattleLog } from './BattleLog';
import { Button } from '../ui/Button';
import { getPokemonData, getItemData } from '../../utils/dataLoader';

export function BattleScreen() {
  const gameStore = useGameStore();
  const battle = useBattleStore();
  const [showBag, setShowBag] = useState(false);
  const [showTeam, setShowTeam] = useState(false);

  const player = battle.playerTeam[battle.activePlayerIndex];
  const enemy = battle.enemyTeam[battle.activeEnemyIndex];

  if (!player || !enemy) return null;

  const handleEndBattle = () => {
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

    // Capture
    if (battle.caughtPokemon) {
      gameStore.addPokemonToTeam(battle.caughtPokemon);
    }

    // Sync team HP back
    const syncedTeam = [...gameStore.team];
    for (let i = 0; i < syncedTeam.length && i < battle.playerTeam.length; i++) {
      syncedTeam[i] = { ...syncedTeam[i], currentHp: battle.playerTeam[i].currentHp, status: battle.playerTeam[i].status, statusTurns: battle.playerTeam[i].statusTurns };
      // Sync move PP
      syncedTeam[i].moves = battle.playerTeam[i].moves.map(m => ({ ...m }));
    }
    useGameStore.setState({ team: syncedTeam });

    // Auto-heal after battle
    gameStore.healTeam();

    battle.clearBattle();
    gameStore.setView('world_map');
    gameStore.saveGameState();
  };

  const handleDefeat = () => {
    gameStore.healTeam();
    battle.clearBattle();
    gameStore.setView('world_map');
  };

  // Victory/defeat/caught/fled screens
  if (battle.phase === 'victory' || battle.phase === 'caught') {
    return (
      <div style={{ padding: '16px', maxWidth: '500px', margin: '0 auto' }}>
        <BattleLog logs={battle.logs} />
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          {battle.xpGained.length > 0 && (
            <div style={{ color: '#9C27B0', fontSize: '10px', fontFamily: "'Press Start 2P', monospace", marginBottom: '12px' }}>
              {battle.xpGained.map((xp, i) => {
                const pData = getPokemonData(xp.defeatedId);
                return (
                  <div key={i}>XP gagne pour {getPokemonData(gameStore.team[xp.pokemonIndex]?.dataId || xp.defeatedId).name}</div>
                );
              })}
            </div>
          )}
          <Button variant="primary" onClick={handleEndBattle}>
            Continuer
          </Button>
        </div>
      </div>
    );
  }

  if (battle.phase === 'defeat') {
    return (
      <div style={{ padding: '16px', maxWidth: '500px', margin: '0 auto' }}>
        <BattleLog logs={battle.logs} />
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <div style={{ color: '#e94560', fontSize: '12px', fontFamily: "'Press Start 2P', monospace", marginBottom: '12px' }}>
            Defaite...
          </div>
          <Button variant="danger" onClick={handleDefeat}>
            Retour
          </Button>
        </div>
      </div>
    );
  }

  if (battle.phase === 'fled') {
    return (
      <div style={{ padding: '16px', maxWidth: '500px', margin: '0 auto' }}>
        <BattleLog logs={battle.logs} />
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <Button variant="ghost" onClick={() => { battle.clearBattle(); gameStore.setView('world_map'); }}>
            Continuer
          </Button>
        </div>
      </div>
    );
  }

  // Team switch screen
  if (showTeam || battle.phase === 'switching') {
    return (
      <div style={{ padding: '16px', maxWidth: '500px', margin: '0 auto' }}>
        <h3 style={{ color: '#fff', fontSize: '12px', fontFamily: "'Press Start 2P', monospace", marginBottom: '12px' }}>
          Choisissez un Pokemon
        </h3>
        {battle.playerTeam.map((p, idx) => {
          const pData = getPokemonData(p.dataId);
          const isActive = idx === battle.activePlayerIndex;
          const isFainted = p.currentHp <= 0;
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
                gap: '8px',
                padding: '8px 12px',
                marginBottom: '4px',
                width: '100%',
                background: isActive ? '#16213e' : '#0a0a15',
                border: isActive ? '2px solid #2196F3' : '1px solid #333',
                borderRadius: '6px',
                cursor: isFainted || isActive ? 'default' : 'pointer',
                opacity: isFainted ? 0.4 : 1,
                textAlign: 'left',
              }}
            >
              <img src={pData.spriteUrl} alt={pData.name} style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontSize: '9px', fontFamily: "'Press Start 2P', monospace" }}>{p.nickname || pData.name} Nv.{p.level}</div>
                <div style={{ color: '#aaa', fontSize: '8px', fontFamily: "'Press Start 2P', monospace" }}>PV: {p.currentHp}/{p.maxHp}</div>
              </div>
            </button>
          );
        })}
        {battle.phase !== 'switching' && (
          <Button variant="ghost" size="sm" onClick={() => setShowTeam(false)}>
            Retour
          </Button>
        )}
      </div>
    );
  }

  // Bag screen (items)
  if (showBag) {
    const inventory = gameStore.inventory.filter(item => {
      try {
        const data = getItemData(item.itemId);
        return data.usableInBattle;
      } catch {
        return true;
      }
    });

    return (
      <div style={{ padding: '16px', maxWidth: '500px', margin: '0 auto' }}>
        <h3 style={{ color: '#fff', fontSize: '12px', fontFamily: "'Press Start 2P', monospace", marginBottom: '12px' }}>
          Sac
        </h3>
        {inventory.length === 0 && (
          <div style={{ color: '#888', fontSize: '9px', fontFamily: "'Press Start 2P', monospace", marginBottom: '12px' }}>
            Sac vide
          </div>
        )}
        {inventory.map(item => {
          let itemData;
          try {
            itemData = getItemData(item.itemId);
          } catch {
            return null;
          }
          return (
            <button
              key={item.itemId}
              onClick={() => {
                if (itemData.effect.type === 'catch') {
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
                justifyContent: 'space-between',
                padding: '10px 12px',
                marginBottom: '4px',
                width: '100%',
                background: '#16213e',
                border: '1px solid #333',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ color: '#fff', fontSize: '9px', fontFamily: "'Press Start 2P', monospace" }}>
                {itemData.name}
              </span>
              <span style={{ color: '#aaa', fontSize: '9px', fontFamily: "'Press Start 2P', monospace" }}>
                x{item.quantity}
              </span>
            </button>
          );
        })}
        <Button variant="ghost" size="sm" onClick={() => setShowBag(false)}>
          Retour
        </Button>
      </div>
    );
  }

  // Main battle UI
  return (
    <div style={{ padding: '16px', maxWidth: '500px', margin: '0 auto' }}>
      {/* Enemy display */}
      <PokemonDisplay pokemon={enemy} isPlayer={false} />

      <div style={{ height: '8px' }} />

      {/* Player display */}
      <PokemonDisplay pokemon={player} isPlayer={true} />

      <div style={{ height: '8px' }} />

      {/* Battle log */}
      <BattleLog logs={battle.logs} />

      <div style={{ height: '8px' }} />

      {/* Action area */}
      {battle.phase === 'choosing' && (
        <div>
          {/* Move selection */}
          <MoveSelection
            pokemon={player}
            onSelectMove={(index) => battle.selectMove(index)}
          />

          <div style={{ height: '8px' }} />

          {/* Bottom actions */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
        </div>
      )}
    </div>
  );
}
