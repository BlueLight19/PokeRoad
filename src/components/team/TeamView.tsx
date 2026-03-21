import React from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getPokemonData, getMoveData, getItemData, getAllItems } from '../../utils/dataLoader';
import { xpForLevel } from '../../engine/experienceCalculator';
import { HealthBar } from '../ui/HealthBar';
import { StatusIcon } from '../ui/StatusIcon';
import { Button } from '../ui/Button';
import { soundManager } from '../../utils/SoundManager';
import { ItemCategory } from '../../types/inventory';
import { typeColors } from '../../utils/typeColors';

export function TeamView() {
  const { team, setView, selectedPokemonIndex, healTeam, switchTeamOrder, setHeldItem, inventory } = useGameStore();
  const [selected, setSelected] = React.useState<number | null>(null);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);
  const [showItemPicker, setShowItemPicker] = React.useState(false);

  const HELD_CATEGORIES: ItemCategory[] = [
    'held-items', 'type-enhancement', 'in-a-pinch', 'choice', 'bad-held-items', 'scarves',
  ];

  // Detailed view of a Pokémon
  if (selected !== null) {
    const pokemon = team[selected];
    if (!pokemon) {
      setSelected(null);
      return null;
    }
    const data = getPokemonData(pokemon.dataId);
    const spriteUrl = pokemon.isShiny ? data.spriteUrl.replace('pokemon', 'pokemon/shiny') : data.spriteUrl;
    const name = pokemon.nickname || data.name;

    return (
      <div style={{ padding: '16px', maxWidth: '500px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <img
            src={spriteUrl}
            alt={name}
            style={{ width: '80px', height: '80px', imageRendering: 'pixelated' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div>
            <div style={{ color: '#fff', fontSize: '14px', fontFamily: "'Press Start 2P', monospace" }}>
              {name}
            </div>
            <div style={{ color: '#aaa', fontSize: '10px', fontFamily: "'Press Start 2P', monospace", marginTop: '4px' }}>
              Niv.{pokemon.level}
            </div>
            <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
              {data.types.map(t => (
                <span key={t} style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '7px',
                  fontFamily: "'Press Start 2P', monospace",
                  color: '#fff',
                  background: typeColors[t] || '#888',
                  textTransform: 'uppercase',
                }}>{t}</span>
              ))}
            </div>
            <StatusIcon status={pokemon.status} />
          </div>
        </div>

        {/* HP */}
        <HealthBar current={pokemon.currentHp} max={pokemon.maxHp} />

        {/* XP bar */}
        <div style={{ marginTop: '8px' }}>
          {(() => {
            const pokData = getPokemonData(pokemon.dataId);
            const currentLevelXp = xpForLevel(pokemon.level, pokData.expGroup);
            const xpProgress = pokemon.xp - currentLevelXp;
            const xpNeeded = pokemon.xpToNextLevel - currentLevelXp;
            const xpPercent = xpNeeded > 0 ? Math.min(100, (xpProgress / xpNeeded) * 100) : 100;
            return (
              <>
                <div style={{ color: '#aaa', fontSize: '8px', fontFamily: "'Press Start 2P', monospace", marginBottom: '4px' }}>
                  XP: {xpProgress} / {xpNeeded}
                </div>
                <div style={{ height: '6px', background: '#333', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${xpPercent}%`,
                    height: '100%',
                    background: '#2196F3',
                    borderRadius: '3px',
                  }} />
                </div>
              </>
            );
          })()}
        </div>

        {/* Stats */}
        <div style={{ marginTop: '16px' }}>
          <h4 style={{ color: '#e94560', fontSize: '10px', fontFamily: "'Press Start 2P', monospace", marginBottom: '8px' }}>
            Statistiques (IV / EV)
          </h4>
          {(['hp', 'attack', 'defense', 'spAtk', 'spDef', 'speed'] as const).map(stat => (
            <div key={stat} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span style={{ color: '#aaa', fontSize: '8px', fontFamily: "'Press Start 2P', monospace" }}>
                {statNames[stat]}
              </span>
              <div style={{ display: 'flex', gap: '8px', color: '#fff', fontSize: '8px', fontFamily: "'Press Start 2P', monospace" }}>
                <span>{pokemon.stats[stat]}</span>
                <span style={{ color: '#666', fontSize: '7px' }}>
                  ({pokemon.ivs[stat]} / {pokemon.evs[stat]})
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Moves */}
        <div style={{ marginTop: '16px' }}>
          <h4 style={{ color: '#e94560', fontSize: '10px', fontFamily: "'Press Start 2P', monospace", marginBottom: '8px' }}>
            Capacites
          </h4>
          {pokemon.moves.map((m, i) => {
            const move = getMoveData(m.moveId);
            return (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 8px',
                marginBottom: '3px',
                background: 'rgba(22, 33, 62, 0.8)',
                borderRadius: '4px',
                borderLeft: `3px solid ${typeColors[move.type] || '#888'}`,
              }}>
                <div>
                  <div style={{ color: '#fff', fontSize: '9px', fontFamily: "'Press Start 2P', monospace", marginBottom: '4px' }}>
                    {move.name}
                  </div>
                  <div style={{ color: '#aaa', fontSize: '7px', fontFamily: "'Press Start 2P', monospace" }}>
                    {move.type.toUpperCase()} | {move.category.toUpperCase()} 
                    {move.power ? ` | Pwr: ${move.power}` : ''} 
                    {move.accuracy ? ` | Acc: ${move.accuracy}` : ' | Acc: ∞'}
                  </div>
                </div>
                <span style={{ color: '#aaa', fontSize: '8px', fontFamily: "'Press Start 2P', monospace" }}>
                  PP {m.currentPp}/{m.maxPp}
                </span>
              </div>
            );
          })}
        </div>

        {/* Held Item */}
        <div style={{ marginTop: '16px' }}>
          <h4 style={{ color: '#e94560', fontSize: '10px', fontFamily: "'Press Start 2P', monospace", marginBottom: '8px' }}>
            Objet tenu
          </h4>
          {pokemon.heldItem ? (() => {
            let itemName = pokemon.heldItem;
            try { itemName = getItemData(pokemon.heldItem).name; } catch {}
            return (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 8px', background: 'rgba(22, 33, 62, 0.8)', borderRadius: '4px',
              }}>
                <span style={{ color: '#fff', fontSize: '9px', fontFamily: "'Press Start 2P', monospace" }}>
                  {itemName}
                </span>
                <Button variant="ghost" onClick={() => {
                  soundManager.playClick();
                  setHeldItem(selected, null);
                }}>
                  Retirer
                </Button>
              </div>
            );
          })() : (
            <div style={{ color: '#666', fontSize: '9px', fontFamily: "'Press Start 2P', monospace", padding: '6px 8px' }}>
              Pas d'objet tenu
            </div>
          )}
          <div style={{ marginTop: '8px' }}>
            <Button variant="primary" onClick={() => {
              soundManager.playClick();
              setShowItemPicker(true);
            }}>
              Donner objet
            </Button>
          </div>
        </div>

        {/* Item Picker Modal */}
        {showItemPicker && (() => {
          const holdableItems = inventory
            .map(inv => {
              try {
                const data = getItemData(inv.itemId);
                return { inv, data };
              } catch {
                return null;
              }
            })
            .filter((entry): entry is NonNullable<typeof entry> => {
              if (!entry || entry.inv.quantity <= 0) return false;
              return HELD_CATEGORIES.includes(entry.data.category);
            });

          return (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.85)', zIndex: 1000,
              display: 'flex', justifyContent: 'center', alignItems: 'center',
            }}>
              <div style={{
                background: '#1a1a2e', border: '2px solid #333', borderRadius: '8px',
                padding: '16px', maxWidth: '420px', width: '90%', maxHeight: '70vh', overflow: 'auto',
              }}>
                <h3 style={{ color: '#2196F3', fontSize: '11px', fontFamily: "'Press Start 2P', monospace", marginBottom: '12px', textAlign: 'center' }}>
                  Choisir un objet
                </h3>
                {holdableItems.length === 0 ? (
                  <div style={{ color: '#666', fontSize: '9px', fontFamily: "'Press Start 2P', monospace", textAlign: 'center', padding: '16px' }}>
                    Aucun objet disponible
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {holdableItems.map(({ inv, data }) => (
                      <button
                        key={inv.itemId}
                        onClick={() => {
                          soundManager.playClick();
                          setHeldItem(selected, inv.itemId);
                          setShowItemPicker(false);
                        }}
                        style={{
                          display: 'flex', flexDirection: 'column', gap: '2px',
                          padding: '8px', background: 'rgba(22, 33, 62, 0.8)',
                          border: '1px solid #333', borderRadius: '4px',
                          cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#fff', fontSize: '9px', fontFamily: "'Press Start 2P', monospace" }}>
                            {data.name}
                          </span>
                          <span style={{ color: '#aaa', fontSize: '8px', fontFamily: "'Press Start 2P', monospace" }}>
                            x{inv.quantity}
                          </span>
                        </div>
                        <span style={{ color: '#888', fontSize: '7px', fontFamily: "'Press Start 2P', monospace", lineHeight: '1.4' }}>
                          {data.description}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: '12px', textAlign: 'center' }}>
                  <Button variant="ghost" onClick={() => setShowItemPicker(false)}>
                    Annuler
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}

        <div style={{ marginTop: '16px' }}>
          <Button variant="ghost" onClick={() => setSelected(null)}>
            Retour
          </Button>
        </div>
      </div>
    );
  }

  // Team list
  return (
    <div style={{ padding: '16px', maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ color: '#2196F3', fontSize: '14px', fontFamily: "'Press Start 2P', monospace", marginBottom: '16px', textAlign: 'center' }}>
        Equipe
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {team.map((pokemon, index) => {
          const data = getPokemonData(pokemon.dataId);
          const spriteUrl = pokemon.isShiny ? data.spriteUrl.replace('pokemon', 'pokemon/shiny') : data.spriteUrl;
          const name = pokemon.nickname || data.name;
          const isFainted = pokemon.currentHp <= 0;
          const isDragging = dragIndex === index;
          const isDragOver = dragOverIndex === index && dragIndex !== index;

          return (
            <button
              key={pokemon.uid}
              draggable
              onDragStart={(e) => {
                setDragIndex(index);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverIndex(index);
              }}
              onDragLeave={() => {
                setDragOverIndex(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null && dragIndex !== index) {
                  switchTeamOrder(dragIndex, index);
                }
                setDragIndex(null);
                setDragOverIndex(null);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setDragOverIndex(null);
              }}
              onClick={() => {
                soundManager.playClick();
                setSelected(index);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                background: isFainted ? 'rgba(26, 10, 10, 0.7)' : 'rgba(22, 33, 62, 0.8)',
                border: isDragOver ? '2px solid #2196F3' : isFainted ? '2px solid #f44336' : '2px solid #333',
                borderRadius: '8px',
                cursor: 'grab',
                textAlign: 'left',
                opacity: isDragging ? 0.5 : 1,
                transition: 'border-color 0.2s, opacity 0.2s',
              }}
            >
              <img
                src={spriteUrl}
                alt={name}
                style={{ width: '48px', height: '48px', imageRendering: 'pixelated', opacity: isFainted ? 0.4 : 1 }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#fff', fontSize: '10px', fontFamily: "'Press Start 2P', monospace" }}>
                    {name}
                  </span>
                  <span style={{ color: '#aaa', fontSize: '8px', fontFamily: "'Press Start 2P', monospace" }}>
                    Nv.{pokemon.level}
                  </span>
                  <StatusIcon status={pokemon.status} />
                </div>
                <div style={{ marginTop: '4px' }}>
                  <HealthBar current={pokemon.currentHp} max={pokemon.maxHp} height={8} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
        <Button variant="ghost" onClick={() => setView('world_map')}>
          Retour
        </Button>
      </div>
    </div>
  );
}

const statNames: Record<string, string> = {
  hp: 'PV', attack: 'Attaque', defense: 'Defense',
  spAtk: 'Atk. Spe.', spDef: 'Def. Spe.', speed: 'Vitesse',
};
