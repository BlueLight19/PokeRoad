import React from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getPokemonData, getMoveData, getItemData, getAllItems } from '../../utils/dataLoader';
import { xpForLevel } from '../../engine/experienceCalculator';
import { HealthBar } from '../ui/HealthBar';
import { StatusIcon } from '../ui/StatusIcon';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { soundManager } from '../../utils/SoundManager';
import { ItemCategory } from '../../types/inventory';
import { typeColors } from '../../utils/typeColors';
import { theme } from '../../theme';

const statNames: Record<string, string> = {
  hp: 'PV', attack: 'Attaque', defense: 'Defense',
  spAtk: 'Atk. Spe.', spDef: 'Def. Spe.', speed: 'Vitesse',
};

const statMaxRef = 255; // visual reference max for stat bars

export function TeamView() {
  const { team, setView, selectedPokemonIndex, healTeam, switchTeamOrder, setHeldItem, inventory } = useGameStore();
  const [selected, setSelected] = React.useState<number | null>(null);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);
  const [showItemPicker, setShowItemPicker] = React.useState(false);

  const HELD_CATEGORIES = [
    'held-items', 'type-enhancement', 'in-a-pinch', 'choice', 'bad-held-items', 'scarves',
  ] as ItemCategory[];

  // ===== DETAIL VIEW =====
  if (selected !== null) {
    const pokemon = team[selected];
    if (!pokemon) {
      setSelected(null);
      return null;
    }
    const data = getPokemonData(pokemon.dataId);
    const spriteUrl = pokemon.isShiny ? data.spriteUrl.replace('pokemon', 'pokemon/shiny') : data.spriteUrl;
    const name = pokemon.nickname || data.name;
    const primaryType = data.types[0];
    const typeColor = typeColors[primaryType] || theme.colors.textDim;

    return (
      <div style={{ padding: `${theme.spacing.lg}px`, maxWidth: '500px', margin: '0 auto' }}>
        {/* Header card */}
        <div style={{
          background: `linear-gradient(135deg, ${typeColor}18 0%, ${theme.colors.deepBg} 60%)`,
          border: theme.borders.medium(typeColor + '44'),
          borderRadius: `${theme.radius.lg}px`,
          padding: `${theme.spacing.lg}px`,
          marginBottom: `${theme.spacing.lg}px`,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative type circle */}
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            background: `${typeColor}0a`,
            border: `1px solid ${typeColor}15`,
          }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: `${theme.spacing.lg}px`, position: 'relative' }}>
            <div style={{
              background: `radial-gradient(circle, ${typeColor}15 0%, transparent 70%)`,
              borderRadius: `${theme.radius.md}px`,
              padding: '4px',
            }}>
              <img
                src={spriteUrl}
                alt={name}
                style={{ width: '100px', height: '100px', imageRendering: 'pixelated' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: `${theme.spacing.sm}px` }}>
                <span style={{ color: theme.colors.textPrimary, fontSize: theme.font.xxl, fontFamily: theme.font.family }}>
                  {name}
                </span>
                {pokemon.isShiny && (
                  <span style={{ color: theme.colors.gold, fontSize: theme.font.sm }}>★</span>
                )}
              </div>
              <div style={{ color: typeColor, fontSize: theme.font.sm, fontFamily: theme.font.family, marginTop: `${theme.spacing.xs}px` }}>
                Niv. {pokemon.level}
              </div>
              <div style={{ display: 'flex', gap: `${theme.spacing.xs}px`, marginTop: '8px' }}>
                {data.types.map(t => (
                  <span key={t} style={{
                    padding: '3px 8px',
                    borderRadius: `${theme.radius.sm}px`,
                    fontSize: theme.font.micro,
                    fontFamily: theme.font.family,
                    color: theme.colors.textPrimary,
                    background: `linear-gradient(180deg, ${typeColors[t] || theme.colors.textDim}, ${typeColors[t] || theme.colors.textDim}aa)`,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>{t}</span>
                ))}
              </div>
              <StatusIcon status={pokemon.status} />
            </div>
          </div>

          {/* HP + XP bars inside header */}
          <div style={{ marginTop: `${theme.spacing.md}px`, position: 'relative' }}>
            <HealthBar current={pokemon.currentHp} max={pokemon.maxHp} />
            <div style={{ marginTop: `${theme.spacing.sm}px` }}>
              {(() => {
                const pokData = getPokemonData(pokemon.dataId);
                const currentLevelXp = xpForLevel(pokemon.level, pokData.expGroup);
                const xpProgress = pokemon.xp - currentLevelXp;
                const xpNeeded = pokemon.xpToNextLevel - currentLevelXp;
                const xpPercent = xpNeeded > 0 ? Math.min(100, (xpProgress / xpNeeded) * 100) : 100;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: `${theme.spacing.sm}px` }}>
                    <span style={{ color: theme.colors.info, fontSize: theme.font.xs, fontFamily: theme.font.family }}>EXP</span>
                    <div style={{ flex: 1, height: '5px', background: theme.colors.borderDark, borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${xpPercent}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, ${theme.colors.info}, ${theme.colors.infoDark})`,
                        borderRadius: '3px',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                    <span style={{ color: theme.colors.textDim, fontSize: theme.font.micro, fontFamily: theme.font.family, minWidth: '70px', textAlign: 'right' }}>
                      {xpProgress}/{xpNeeded}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Stats section */}
        <div style={{
          background: `${theme.colors.navyBg}cc`,
          borderRadius: `${theme.radius.md}px`,
          padding: `${theme.spacing.md}px`,
          marginBottom: `${theme.spacing.md}px`,
          border: theme.borders.thin(theme.colors.borderDark),
        }}>
          <div style={{
            color: theme.colors.primary,
            fontSize: theme.font.sm,
            fontFamily: theme.font.family,
            marginBottom: `${theme.spacing.md}px`,
            paddingBottom: `${theme.spacing.xs}px`,
            borderBottom: theme.borders.thin(theme.colors.borderDark),
          }}>
            Statistiques
          </div>
          {(['hp', 'attack', 'defense', 'spAtk', 'spDef', 'speed'] as const).map(stat => {
            const value = pokemon.stats[stat];
            const barPercent = Math.min(100, (value / statMaxRef) * 100);
            const barColor = value >= 120 ? theme.colors.success : value >= 80 ? theme.colors.info : value >= 50 ? theme.colors.warning : theme.colors.danger;
            return (
              <div key={stat} style={{ display: 'flex', alignItems: 'center', gap: `${theme.spacing.sm}px`, marginBottom: '6px' }}>
                <span style={{ color: theme.colors.textMuted, fontSize: theme.font.xs, fontFamily: theme.font.family, width: '60px', flexShrink: 0 }}>
                  {statNames[stat]}
                </span>
                <span style={{ color: theme.colors.textPrimary, fontSize: theme.font.xs, fontFamily: theme.font.family, width: '28px', textAlign: 'right', flexShrink: 0 }}>
                  {value}
                </span>
                <div style={{ flex: 1, height: '6px', background: theme.colors.borderDark, borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${barPercent}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${barColor}, ${barColor}88)`,
                    borderRadius: '3px',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <span style={{ color: theme.colors.textDimmer, fontSize: '6px', fontFamily: theme.font.family, width: '50px', textAlign: 'right', flexShrink: 0 }}>
                  {pokemon.ivs[stat]}/{pokemon.evs[stat]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Moves section */}
        <div style={{
          background: `${theme.colors.navyBg}cc`,
          borderRadius: `${theme.radius.md}px`,
          padding: `${theme.spacing.md}px`,
          marginBottom: `${theme.spacing.md}px`,
          border: theme.borders.thin(theme.colors.borderDark),
        }}>
          <div style={{
            color: theme.colors.primary,
            fontSize: theme.font.sm,
            fontFamily: theme.font.family,
            marginBottom: `${theme.spacing.md}px`,
            paddingBottom: `${theme.spacing.xs}px`,
            borderBottom: theme.borders.thin(theme.colors.borderDark),
          }}>
            Capacites
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {pokemon.moves.map((m, i) => {
              const move = getMoveData(m.moveId);
              const moveTypeColor = typeColors[move.type] || theme.colors.textDim;
              return (
                <div key={i} style={{
                  background: `${moveTypeColor}0c`,
                  borderRadius: `${theme.radius.sm}px`,
                  borderLeft: `3px solid ${moveTypeColor}`,
                  padding: `${theme.spacing.sm}px`,
                }}>
                  <div style={{ color: theme.colors.textPrimary, fontSize: theme.font.xs, fontFamily: theme.font.family, marginBottom: '3px' }}>
                    {move.name}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: moveTypeColor, fontSize: '6px', fontFamily: theme.font.family, textTransform: 'uppercase' }}>
                      {move.type} · {move.category === 'physical' ? 'PHY' : move.category === 'special' ? 'SPE' : 'STA'}
                    </span>
                    <span style={{ color: theme.colors.textDim, fontSize: '6px', fontFamily: theme.font.family }}>
                      {m.currentPp}/{m.maxPp}
                    </span>
                  </div>
                  {(move.power || move.accuracy) && (
                    <div style={{ color: theme.colors.textDimmer, fontSize: '6px', fontFamily: theme.font.family, marginTop: '2px' }}>
                      {move.power ? `Pwr ${move.power}` : ''}{move.power && move.accuracy ? ' · ' : ''}{move.accuracy ? `Prc ${move.accuracy}%` : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Held Item section */}
        <div style={{
          background: `${theme.colors.navyBg}cc`,
          borderRadius: `${theme.radius.md}px`,
          padding: `${theme.spacing.md}px`,
          marginBottom: `${theme.spacing.lg}px`,
          border: theme.borders.thin(theme.colors.borderDark),
        }}>
          <div style={{
            color: theme.colors.primary,
            fontSize: theme.font.sm,
            fontFamily: theme.font.family,
            marginBottom: `${theme.spacing.sm}px`,
            paddingBottom: `${theme.spacing.xs}px`,
            borderBottom: theme.borders.thin(theme.colors.borderDark),
          }}>
            Objet tenu
          </div>
          {pokemon.heldItem ? (() => {
            let itemName = pokemon.heldItem;
            try { itemName = getItemData(pokemon.heldItem).name; } catch {}
            return (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: `${theme.spacing.sm}px`, background: `${theme.colors.gold}0c`,
                borderRadius: `${theme.radius.sm}px`, border: theme.borders.thin(`${theme.colors.gold}33`),
              }}>
                <span style={{ color: theme.colors.gold, fontSize: theme.font.sm, fontFamily: theme.font.family }}>
                  {itemName}
                </span>
                <Button variant="ghost" size="sm" onClick={() => {
                  soundManager.playClick();
                  setHeldItem(selected, null);
                }}>
                  Retirer
                </Button>
              </div>
            );
          })() : (
            <div style={{ color: theme.colors.textDimmer, fontSize: theme.font.xs, fontFamily: theme.font.family, fontStyle: 'italic', padding: `${theme.spacing.sm}px 0` }}>
              Aucun objet
            </div>
          )}
          <div style={{ marginTop: `${theme.spacing.sm}px` }}>
            <Button variant="secondary" size="sm" onClick={() => {
              soundManager.playClick();
              setShowItemPicker(true);
            }}>
              Donner objet
            </Button>
          </div>
        </div>

        {/* Item Picker Modal */}
        <Modal open={showItemPicker} title="Choisir un objet" onClose={() => setShowItemPicker(false)}>
          {(() => {
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
              <>
                {holdableItems.length === 0 ? (
                  <div style={{ color: theme.colors.textDimmer, fontSize: theme.font.sm, fontFamily: theme.font.family, textAlign: 'center', padding: `${theme.spacing.lg}px` }}>
                    Aucun objet disponible
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: `${theme.spacing.xs}px` }}>
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
                          padding: `${theme.spacing.sm}px`, background: `${theme.colors.navyBg}cc`,
                          border: theme.borders.thin(theme.colors.borderDark), borderRadius: `${theme.radius.sm}px`,
                          cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: theme.colors.textPrimary, fontSize: theme.font.sm, fontFamily: theme.font.family }}>
                            {data.name}
                          </span>
                          <span style={{ color: theme.colors.textMuted, fontSize: theme.font.xs, fontFamily: theme.font.family }}>
                            x{inv.quantity}
                          </span>
                        </div>
                        <span style={{ color: theme.colors.textDim, fontSize: theme.font.micro, fontFamily: theme.font.family, lineHeight: '1.4' }}>
                          {data.description}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: `${theme.spacing.md}px`, textAlign: 'center' }}>
                  <Button variant="ghost" onClick={() => setShowItemPicker(false)}>
                    Annuler
                  </Button>
                </div>
              </>
            );
          })()}
        </Modal>

        <Button variant="ghost" onClick={() => setSelected(null)} style={{ width: '100%' }}>
          Retour
        </Button>
      </div>
    );
  }

  // ===== TEAM LIST =====
  return (
    <div style={{ padding: `${theme.spacing.lg}px`, maxWidth: '500px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: `${theme.spacing.lg}px` }}>
        <h2 style={{ color: theme.colors.info, fontSize: theme.font.xxl, fontFamily: theme.font.family, margin: 0 }}>
          Equipe
        </h2>
        <div style={{
          width: '40px',
          height: '2px',
          background: `linear-gradient(90deg, transparent, ${theme.colors.info}, transparent)`,
          margin: '8px auto 0',
        }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {team.map((pokemon, index) => {
          const data = getPokemonData(pokemon.dataId);
          const spriteUrl = pokemon.isShiny ? data.spriteUrl.replace('pokemon', 'pokemon/shiny') : data.spriteUrl;
          const name = pokemon.nickname || data.name;
          const isFainted = pokemon.currentHp <= 0;
          const isDragging = dragIndex === index;
          const isDragOver = dragOverIndex === index && dragIndex !== index;
          const primaryType = data.types[0];
          const typeColor = typeColors[primaryType] || theme.colors.textDim;

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
                gap: `${theme.spacing.md}px`,
                padding: '10px 14px',
                background: isFainted
                  ? `linear-gradient(135deg, rgba(244,67,54,0.08) 0%, ${theme.colors.deepBg} 60%)`
                  : `linear-gradient(135deg, ${typeColor}0c 0%, ${theme.colors.deepBg} 60%)`,
                border: isDragOver
                  ? `2px solid ${theme.colors.info}`
                  : isFainted
                    ? `2px solid ${theme.colors.danger}44`
                    : `2px solid ${typeColor}22`,
                borderLeft: isDragOver
                  ? `4px solid ${theme.colors.info}`
                  : `4px solid ${isFainted ? theme.colors.danger + '66' : typeColor}`,
                borderRadius: `${theme.radius.md}px`,
                cursor: 'grab',
                textAlign: 'left',
                opacity: isDragging ? 0.5 : 1,
                transition: 'border-color 0.2s, opacity 0.2s, background 0.2s',
              }}
            >
              <div style={{
                position: 'relative',
                flexShrink: 0,
              }}>
                <img
                  src={spriteUrl}
                  alt={name}
                  style={{
                    width: '64px',
                    height: '64px',
                    imageRendering: 'pixelated',
                    opacity: isFainted ? 0.35 : 1,
                    filter: isFainted ? 'grayscale(0.6)' : 'none',
                  }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span style={{ color: theme.colors.textPrimary, fontSize: theme.font.md, fontFamily: theme.font.family }}>
                    {name}
                  </span>
                  <span style={{ color: typeColor, fontSize: theme.font.xs, fontFamily: theme.font.family }}>
                    Nv.{pokemon.level}
                  </span>
                  {pokemon.isShiny && (
                    <span style={{ color: theme.colors.gold, fontSize: theme.font.xs }}>★</span>
                  )}
                  <StatusIcon status={pokemon.status} />
                </div>
                <HealthBar current={pokemon.currentHp} max={pokemon.maxHp} height={8} />
              </div>
              {/* Drag handle hint */}
              <div style={{ color: theme.colors.borderDark, fontSize: '14px', flexShrink: 0, lineHeight: 1, userSelect: 'none' }}>⋮⋮</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
