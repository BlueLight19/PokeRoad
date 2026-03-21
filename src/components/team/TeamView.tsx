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
      <div style={{ padding: `${theme.spacing.lg}px`, maxWidth: '500px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: `${theme.spacing.md}px`, marginBottom: `${theme.spacing.lg}px` }}>
          <img
            src={spriteUrl}
            alt={name}
            style={{ width: '80px', height: '80px', imageRendering: 'pixelated' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div>
            <div style={{ color: theme.colors.textPrimary, fontSize: theme.font.xxl, fontFamily: theme.font.family }}>
              {name}
            </div>
            <div style={{ color: theme.colors.textMuted, fontSize: theme.font.md, fontFamily: theme.font.family, marginTop: `${theme.spacing.xs}px` }}>
              Niv.{pokemon.level}
            </div>
            <div style={{ display: 'flex', gap: `${theme.spacing.xs}px`, marginTop: '6px' }}>
              {data.types.map(t => (
                <span key={t} style={{
                  padding: '2px 6px',
                  borderRadius: `${theme.radius.sm}px`,
                  fontSize: theme.font.micro,
                  fontFamily: theme.font.family,
                  color: theme.colors.textPrimary,
                  background: typeColors[t] || theme.colors.textDim,
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
        <div style={{ marginTop: `${theme.spacing.sm}px` }}>
          {(() => {
            const pokData = getPokemonData(pokemon.dataId);
            const currentLevelXp = xpForLevel(pokemon.level, pokData.expGroup);
            const xpProgress = pokemon.xp - currentLevelXp;
            const xpNeeded = pokemon.xpToNextLevel - currentLevelXp;
            const xpPercent = xpNeeded > 0 ? Math.min(100, (xpProgress / xpNeeded) * 100) : 100;
            return (
              <>
                <div style={{ color: theme.colors.textMuted, fontSize: theme.font.xs, fontFamily: theme.font.family, marginBottom: `${theme.spacing.xs}px` }}>
                  XP: {xpProgress} / {xpNeeded}
                </div>
                <div style={{ height: '6px', background: theme.colors.borderDark, borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${xpPercent}%`,
                    height: '100%',
                    background: theme.colors.info,
                    borderRadius: '3px',
                  }} />
                </div>
              </>
            );
          })()}
        </div>

        {/* Stats */}
        <div style={{ marginTop: `${theme.spacing.lg}px` }}>
          <h4 style={{ color: theme.colors.primary, fontSize: theme.font.md, fontFamily: theme.font.family, marginBottom: `${theme.spacing.sm}px` }}>
            Statistiques (IV / EV)
          </h4>
          {(['hp', 'attack', 'defense', 'spAtk', 'spDef', 'speed'] as const).map(stat => (
            <div key={stat} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span style={{ color: theme.colors.textMuted, fontSize: theme.font.xs, fontFamily: theme.font.family }}>
                {statNames[stat]}
              </span>
              <div style={{ display: 'flex', gap: `${theme.spacing.sm}px`, color: theme.colors.textPrimary, fontSize: theme.font.xs, fontFamily: theme.font.family }}>
                <span>{pokemon.stats[stat]}</span>
                <span style={{ color: theme.colors.textDimmer, fontSize: theme.font.micro }}>
                  ({pokemon.ivs[stat]} / {pokemon.evs[stat]})
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Moves */}
        <div style={{ marginTop: `${theme.spacing.lg}px` }}>
          <h4 style={{ color: theme.colors.primary, fontSize: theme.font.md, fontFamily: theme.font.family, marginBottom: `${theme.spacing.sm}px` }}>
            Capacites
          </h4>
          {pokemon.moves.map((m, i) => {
            const move = getMoveData(m.moveId);
            return (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                marginBottom: '3px',
                background: `${theme.colors.navyBg}cc`,
                borderRadius: `${theme.radius.sm}px`,
                borderLeft: `3px solid ${typeColors[move.type] || theme.colors.textDim}`,
              }}>
                <div>
                  <div style={{ color: theme.colors.textPrimary, fontSize: theme.font.sm, fontFamily: theme.font.family, marginBottom: `${theme.spacing.xs}px` }}>
                    {move.name}
                  </div>
                  <div style={{ color: theme.colors.textMuted, fontSize: theme.font.micro, fontFamily: theme.font.family }}>
                    {move.type.toUpperCase()} | {move.category.toUpperCase()}
                    {move.power ? ` | Pwr: ${move.power}` : ''}
                    {move.accuracy ? ` | Acc: ${move.accuracy}` : ' | Acc: ∞'}
                  </div>
                </div>
                <span style={{ color: theme.colors.textMuted, fontSize: theme.font.xs, fontFamily: theme.font.family }}>
                  PP {m.currentPp}/{m.maxPp}
                </span>
              </div>
            );
          })}
        </div>

        {/* Held Item */}
        <div style={{ marginTop: `${theme.spacing.lg}px` }}>
          <h4 style={{ color: theme.colors.primary, fontSize: theme.font.md, fontFamily: theme.font.family, marginBottom: `${theme.spacing.sm}px` }}>
            Objet tenu
          </h4>
          {pokemon.heldItem ? (() => {
            let itemName = pokemon.heldItem;
            try { itemName = getItemData(pokemon.heldItem).name; } catch {}
            return (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 8px', background: `${theme.colors.navyBg}cc`, borderRadius: `${theme.radius.sm}px`,
              }}>
                <span style={{ color: theme.colors.textPrimary, fontSize: theme.font.sm, fontFamily: theme.font.family }}>
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
            <div style={{ color: theme.colors.textDimmer, fontSize: theme.font.sm, fontFamily: theme.font.family, padding: '6px 8px' }}>
              Pas d'objet tenu
            </div>
          )}
          <div style={{ marginTop: `${theme.spacing.sm}px` }}>
            <Button variant="primary" onClick={() => {
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

        <div style={{ marginTop: `${theme.spacing.lg}px` }}>
          <Button variant="ghost" onClick={() => setSelected(null)}>
            Retour
          </Button>
        </div>
      </div>
    );
  }

  // Team list
  return (
    <div style={{ padding: `${theme.spacing.lg}px`, maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ color: theme.colors.info, fontSize: theme.font.xxl, fontFamily: theme.font.family, marginBottom: `${theme.spacing.lg}px`, textAlign: 'center' }}>
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
                gap: `${theme.spacing.md}px`,
                padding: '10px 12px',
                background: isFainted ? 'rgba(26, 10, 10, 0.7)' : `${theme.colors.navyBg}cc`,
                border: isDragOver ? `2px solid ${theme.colors.info}` : isFainted ? `2px solid ${theme.colors.danger}` : theme.borders.medium(theme.colors.borderDark),
                borderRadius: `${theme.radius.md}px`,
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
                  <span style={{ color: theme.colors.textPrimary, fontSize: theme.font.md, fontFamily: theme.font.family }}>
                    {name}
                  </span>
                  <span style={{ color: theme.colors.textMuted, fontSize: theme.font.xs, fontFamily: theme.font.family }}>
                    Nv.{pokemon.level}
                  </span>
                  <StatusIcon status={pokemon.status} />
                </div>
                <div style={{ marginTop: `${theme.spacing.xs}px` }}>
                  <HealthBar current={pokemon.currentHp} max={pokemon.maxHp} height={8} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Navigation handled by NavBar */}
    </div>
  );
}

const statNames: Record<string, string> = {
  hp: 'PV', attack: 'Attaque', defense: 'Defense',
  spAtk: 'Atk. Spe.', spDef: 'Def. Spe.', speed: 'Vitesse',
};
