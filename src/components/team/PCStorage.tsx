import React, { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getPokemonData, getMoveData } from '../../utils/dataLoader';
import { Button } from '../ui/Button';
import { PokemonInstance } from '../../types/pokemon';
import { BOX_CAPACITY } from '../../engine/pcStorage';
import { theme } from '../../theme';
import { getHpColor } from '../ui/HealthBar';
import { typeColors } from '../../utils/typeColors';

type DragSource = { type: 'team'; index: number } | { type: 'pc'; uid: string; boxId: number; slotId: number };
type SelectedSource = { type: 'team'; index: number } | { type: 'pc'; uid: string };

export function PCStorage() {
  const { pc, team, moveFromPc, moveToPc, setView, switchTeamOrder, movePokemonInPC } = useGameStore();
  const [currentBoxIndex, setCurrentBoxIndex] = useState(pc.currentBoxId || 0);
  const [selected, setSelected] = useState<SelectedSource | null>(null);
  const [dragSource, setDragSource] = useState<DragSource | null>(null);
  const [dragOverTeamIndex, setDragOverTeamIndex] = useState<number | null>(null);
  const [dragOverPcSlot, setDragOverPcSlot] = useState<number | null>(null);
  const [isDragOverPc, setIsDragOverPc] = useState(false);

  const currentBox = pc.boxes[currentBoxIndex];
  const boxCount = currentBox.pokemon.filter(p => p !== null).length;

  const handleNextBox = () => {
    setCurrentBoxIndex((prev) => (prev + 1) % pc.boxes.length);
    setSelected(null);
  };

  const handlePrevBox = () => {
    setCurrentBoxIndex((prev) => (prev - 1 + pc.boxes.length) % pc.boxes.length);
    setSelected(null);
  };

  // Resolve selected pokemon
  let selectedPokemon: PokemonInstance | null = null;
  if (selected?.type === 'team') {
    selectedPokemon = team[selected.index] || null;
  } else if (selected?.type === 'pc') {
    for (const box of pc.boxes) {
      const found = box.pokemon.find(p => p?.uid === selected.uid);
      if (found) { selectedPokemon = found; break; }
    }
  }

  const handleDeposit = (uid: string) => {
    if (team.length <= 1) return;
    moveToPc(uid);
    setSelected(null);
  };

  const handleWithdraw = (uid: string) => {
    if (team.length >= 6) return;
    moveFromPc(uid);
    setSelected(null);
  };

  return (
    <div style={{ padding: `${theme.spacing.lg}px`, maxWidth: '600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: `${theme.spacing.lg}px` }}>
        <h2 style={{ color: theme.colors.purple, fontSize: theme.font.xxl, fontFamily: theme.font.family, margin: 0 }}>
          PC de Leo
        </h2>
        <div style={{
          width: '40px',
          height: '2px',
          background: `linear-gradient(90deg, transparent, ${theme.colors.purple}, transparent)`,
          margin: '8px auto 0',
        }} />
      </div>

      {/* Team section */}
      <div
        style={{ marginBottom: `${theme.spacing.lg}px` }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (dragSource?.type === 'pc') {
            handleWithdraw(dragSource.uid);
          }
          setDragSource(null);
          setDragOverTeamIndex(null);
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: `${theme.spacing.sm}px`,
        }}>
          <span style={{ color: theme.colors.textMuted, fontSize: theme.font.sm, fontFamily: theme.font.family }}>
            Equipe
          </span>
          <span style={{ color: theme.colors.textDimmer, fontSize: theme.font.xs, fontFamily: theme.font.family }}>
            {team.length}/6
          </span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '6px',
          background: `linear-gradient(180deg, ${theme.colors.navyBg}cc, ${theme.colors.deepBg}cc)`,
          padding: `${theme.spacing.sm}px`,
          borderRadius: `${theme.radius.md}px`,
          border: theme.borders.medium(theme.colors.borderDark),
        }}>
          {Array.from({ length: 6 }).map((_, idx) => {
            const pokemon = team[idx];
            const isDragOver = dragOverTeamIndex === idx && dragSource?.type === 'team' && dragSource.index !== idx;

            if (!pokemon) {
              return (
                <div key={`team-empty-${idx}`} style={{
                  background: 'rgba(15, 23, 42, 0.4)',
                  borderRadius: `${theme.radius.sm}px`,
                  aspectRatio: '1',
                  opacity: 0.3,
                  border: '2px dashed rgba(255,255,255,0.05)',
                }} />
              );
            }
            const data = getPokemonData(pokemon.dataId);
            const spriteUrl = pokemon.isShiny ? data.spriteUrl.replace('pokemon', 'pokemon/shiny') : data.spriteUrl;
            const isSelected = selected?.type === 'team' && selected.index === idx;
            const hpRatio = pokemon.currentHp / pokemon.maxHp;
            const hpColor = getHpColor(hpRatio);
            const isDragging = dragSource?.type === 'team' && dragSource.index === idx;
            const primaryType = data.types[0];
            const typeColor = typeColors[primaryType] || theme.colors.textDim;

            return (
              <div
                key={pokemon.uid}
                draggable
                onDragStart={(e) => {
                  setDragSource({ type: 'team', index: idx });
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverTeamIndex(idx);
                }}
                onDragLeave={() => {
                  setDragOverTeamIndex(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragSource?.type === 'team' && dragSource.index !== idx) {
                    switchTeamOrder(dragSource.index, idx);
                  } else if (dragSource?.type === 'pc') {
                    handleWithdraw(dragSource.uid);
                  }
                  setDragSource(null);
                  setDragOverTeamIndex(null);
                }}
                onDragEnd={() => {
                  setDragSource(null);
                  setDragOverTeamIndex(null);
                }}
                onClick={() => setSelected(isSelected ? null : { type: 'team', index: idx })}
                style={{
                  background: isSelected
                    ? `linear-gradient(180deg, ${theme.colors.purple}18 0%, rgba(15,23,42,0.8) 100%)`
                    : `linear-gradient(180deg, ${typeColor}0a 0%, rgba(15,23,42,0.7) 100%)`,
                  borderRadius: `${theme.radius.sm}px`,
                  aspectRatio: '1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'grab',
                  position: 'relative',
                  border: isDragOver
                    ? `2px solid ${theme.colors.info}`
                    : isSelected
                      ? `2px solid ${theme.colors.purple}`
                      : `2px solid ${typeColor}22`,
                  opacity: isDragging ? 0.5 : 1,
                  transition: 'border-color 0.2s, opacity 0.2s, background 0.2s',
                }}
              >
                <img
                  src={spriteUrl}
                  alt={data.name}
                  style={{ width: '80%', height: '80%', imageRendering: 'pixelated' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                {/* HP bar */}
                <div style={{
                  position: 'absolute',
                  bottom: '3px',
                  left: '4px',
                  right: '4px',
                  height: '3px',
                  background: theme.colors.borderDark,
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}>
                  <div style={{ width: `${hpRatio * 100}%`, height: '100%', background: hpColor, borderRadius: '2px' }} />
                </div>
                {/* Level */}
                <div style={{
                  position: 'absolute',
                  top: '1px',
                  right: '3px',
                  fontSize: theme.font.micro,
                  color: theme.colors.textMuted,
                  fontFamily: theme.font.family,
                }}>
                  {pokemon.level}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail panel */}
      {selectedPokemon && (
        <DetailPanel
          pokemon={selectedPokemon}
          source={selected!}
          teamLength={team.length}
          onDeposit={() => handleDeposit(selectedPokemon!.uid)}
          onWithdraw={() => handleWithdraw(selectedPokemon!.uid)}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Box header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: `${theme.spacing.sm}px`,
        padding: `${theme.spacing.xs}px 0`,
      }}>
        <button
          onClick={handlePrevBox}
          style={{
            background: 'none',
            border: 'none',
            color: theme.colors.purple,
            fontSize: theme.font.lg,
            fontFamily: theme.font.family,
            cursor: 'pointer',
            padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
          }}
        >
          ◀
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: theme.font.family, fontSize: theme.font.md, color: theme.colors.textSecondary }}>
            {currentBox.name}
          </div>
          <div style={{ fontFamily: theme.font.family, fontSize: theme.font.micro, color: theme.colors.textDimmer, marginTop: '2px' }}>
            {boxCount}/{BOX_CAPACITY}
          </div>
        </div>
        <button
          onClick={handleNextBox}
          style={{
            background: 'none',
            border: 'none',
            color: theme.colors.purple,
            fontSize: theme.font.lg,
            fontFamily: theme.font.family,
            cursor: 'pointer',
            padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
          }}
        >
          ▶
        </button>
      </div>

      {/* Box grid */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setIsDragOverPc(true);
        }}
        onDragLeave={() => { setIsDragOverPc(false); setDragOverPcSlot(null); }}
        onDrop={(e) => {
          e.preventDefault();
          if (dragSource?.type === 'team') {
            const pokemon = team[dragSource.index];
            if (pokemon) {
              handleDeposit(pokemon.uid);
            }
          }
          setDragSource(null);
          setIsDragOverPc(false);
          setDragOverPcSlot(null);
        }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '6px',
          background: `linear-gradient(180deg, ${theme.colors.navyBg}cc, ${theme.colors.deepBg}cc)`,
          padding: `${theme.spacing.sm}px`,
          borderRadius: `${theme.radius.md}px`,
          minHeight: '200px',
          border: isDragOverPc && dragSource?.type === 'team'
            ? `2px solid ${theme.colors.info}`
            : theme.borders.medium(theme.colors.borderDark),
          transition: 'border-color 0.2s',
        }}
      >
        {currentBox.pokemon.map((pokemon, slotId) => {
          const isDragOver = dragOverPcSlot === slotId;

          if (!pokemon) {
            return (
              <div
                key={`slot-${slotId}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverPcSlot(slotId);
                }}
                onDragLeave={() => setDragOverPcSlot(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragSource?.type === 'pc') {
                    movePokemonInPC(dragSource.boxId, dragSource.slotId, currentBoxIndex, slotId);
                  } else if (dragSource?.type === 'team') {
                    const teamPokemon = team[dragSource.index];
                    if (teamPokemon) handleDeposit(teamPokemon.uid);
                  }
                  setDragSource(null);
                  setDragOverPcSlot(null);
                }}
                style={{
                  background: 'rgba(15, 23, 42, 0.4)',
                  borderRadius: `${theme.radius.sm}px`,
                  aspectRatio: '1',
                  opacity: isDragOver ? 0.6 : 0.2,
                  border: isDragOver ? `2px solid ${theme.colors.info}` : '2px dashed rgba(255,255,255,0.04)',
                  transition: 'border-color 0.2s, opacity 0.2s',
                }}
              />
            );
          }

          const data = getPokemonData(pokemon.dataId);
          const spriteUrl = pokemon.isShiny ? data.spriteUrl.replace('pokemon', 'pokemon/shiny') : data.spriteUrl;
          const isSelected = selected?.type === 'pc' && selected.uid === pokemon.uid;
          const hpRatio = pokemon.currentHp / pokemon.maxHp;
          const hpColor = getHpColor(hpRatio);
          const isDragging = dragSource?.type === 'pc' && dragSource.uid === pokemon.uid;
          const primaryType = data.types[0];
          const typeColor = typeColors[primaryType] || theme.colors.textDim;

          return (
            <div
              key={pokemon.uid}
              draggable
              onDragStart={(e) => {
                setDragSource({ type: 'pc', uid: pokemon.uid, boxId: currentBoxIndex, slotId });
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOverPcSlot(slotId);
              }}
              onDragLeave={() => setDragOverPcSlot(null)}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dragSource?.type === 'pc') {
                  movePokemonInPC(dragSource.boxId, dragSource.slotId, currentBoxIndex, slotId);
                } else if (dragSource?.type === 'team') {
                  const teamPokemon = team[dragSource.index];
                  if (teamPokemon) handleDeposit(teamPokemon.uid);
                }
                setDragSource(null);
                setDragOverPcSlot(null);
              }}
              onDragEnd={() => {
                setDragSource(null);
                setDragOverPcSlot(null);
              }}
              onClick={() => setSelected(isSelected ? null : { type: 'pc', uid: pokemon.uid })}
              style={{
                background: isSelected
                  ? `linear-gradient(180deg, ${theme.colors.purple}18 0%, rgba(15,23,42,0.8) 100%)`
                  : `linear-gradient(180deg, ${typeColor}0a 0%, rgba(15,23,42,0.7) 100%)`,
                borderRadius: `${theme.radius.sm}px`,
                aspectRatio: '1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'grab',
                position: 'relative',
                border: isDragOver && !isDragging
                  ? `2px solid ${theme.colors.info}`
                  : isSelected
                    ? `2px solid ${theme.colors.purple}`
                    : `2px solid ${typeColor}22`,
                opacity: isDragging ? 0.5 : 1,
                transition: 'border-color 0.2s, opacity 0.2s, background 0.2s',
              }}
            >
              <img
                src={spriteUrl}
                alt={data.name}
                style={{ width: '80%', height: '80%', imageRendering: 'pixelated' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div style={{
                position: 'absolute',
                bottom: '3px',
                left: '4px',
                right: '4px',
                height: '3px',
                background: theme.colors.borderDark,
                borderRadius: '2px',
                overflow: 'hidden',
              }}>
                <div style={{ width: `${hpRatio * 100}%`, height: '100%', background: hpColor, borderRadius: '2px' }} />
              </div>
              <div style={{
                position: 'absolute',
                top: '1px',
                right: '3px',
                fontSize: theme.font.micro,
                color: theme.colors.textMuted,
                fontFamily: theme.font.family,
              }}>
                {pokemon.level}
              </div>
              {pokemon.isShiny && (
                <div style={{
                  position: 'absolute',
                  top: '1px',
                  left: '3px',
                  fontSize: '6px',
                  color: theme.colors.gold,
                }}>★</div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}

function DetailPanel({
  pokemon,
  source,
  teamLength,
  onDeposit,
  onWithdraw,
  onClose,
}: {
  pokemon: PokemonInstance;
  source: SelectedSource;
  teamLength: number;
  onDeposit: () => void;
  onWithdraw: () => void;
  onClose: () => void;
}) {
  const data = getPokemonData(pokemon.dataId);
  const spriteUrl = pokemon.isShiny ? data.spriteUrl.replace('pokemon', 'pokemon/shiny') : data.spriteUrl;
  const hpRatio = pokemon.currentHp / pokemon.maxHp;
  const hpColor = getHpColor(hpRatio);
  const primaryType = data.types[0];
  const typeColor = typeColors[primaryType] || theme.colors.textDim;

  const canDeposit = source.type === 'team' && teamLength > 1;
  const canWithdraw = source.type === 'pc' && teamLength < 6;

  return (
    <div style={{
      background: `linear-gradient(135deg, ${typeColor}0a 0%, ${theme.colors.deepBg}e6 40%)`,
      border: `2px solid ${theme.colors.purple}66`,
      borderRadius: `${theme.radius.lg}px`,
      padding: `${theme.spacing.md}px`,
      marginBottom: `${theme.spacing.lg}px`,
      animation: 'fadeIn 0.2s ease',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: `${theme.spacing.md}px`, marginBottom: '10px' }}>
        <div style={{
          background: `radial-gradient(circle, ${typeColor}12 0%, transparent 70%)`,
          borderRadius: `${theme.radius.sm}px`,
          padding: '2px',
          flexShrink: 0,
        }}>
          <img
            src={spriteUrl}
            alt={data.name}
            style={{ width: '72px', height: '72px', imageRendering: 'pixelated' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: theme.colors.textPrimary, fontSize: theme.font.lg, fontFamily: theme.font.family }}>
              {pokemon.nickname || data.name}
            </span>
            {pokemon.isShiny && <span style={{ color: theme.colors.gold, fontSize: theme.font.xs }}>★</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: `${theme.spacing.xs}px` }}>
            <span style={{ color: typeColor, fontSize: theme.font.xs, fontFamily: theme.font.family }}>
              Nv.{pokemon.level}
            </span>
            {data.types.map(t => (
              <span key={t} style={{
                padding: '1px 5px',
                borderRadius: '3px',
                fontSize: '6px',
                fontFamily: theme.font.family,
                color: theme.colors.textPrimary,
                background: typeColors[t] || theme.colors.textDim,
                textTransform: 'uppercase',
              }}>{t}</span>
            ))}
            {pokemon.status !== null && (
              <span style={{ color: theme.colors.primary, fontSize: theme.font.micro, fontFamily: theme.font.family }}>
                [{pokemon.status.toUpperCase()}]
              </span>
            )}
          </div>
          {/* HP bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
            <div style={{ flex: 1, height: '5px', background: theme.colors.borderDark, borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${hpRatio * 100}%`, height: '100%', background: hpColor, borderRadius: '3px' }} />
            </div>
            <span style={{ color: theme.colors.textMuted, fontSize: theme.font.micro, fontFamily: theme.font.family }}>
              {pokemon.currentHp}/{pokemon.maxHp}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: `${theme.spacing.xs}px`,
        marginBottom: '10px',
      }}>
        {([
          ['ATK', pokemon.stats.attack],
          ['DEF', pokemon.stats.defense],
          ['VIT', pokemon.stats.speed],
          ['SPA', pokemon.stats.spAtk],
          ['SPD', pokemon.stats.spDef],
          ['PV', pokemon.maxHp],
        ] as [string, number][]).map(([label, value]) => (
          <div key={label} style={{
            background: 'rgba(26, 42, 58, 0.6)',
            borderRadius: `${theme.radius.sm}px`,
            padding: `${theme.spacing.xs}px 6px`,
            display: 'flex',
            justifyContent: 'space-between',
            border: theme.borders.thin('rgba(255,255,255,0.03)'),
          }}>
            <span style={{ color: theme.colors.textDim, fontSize: theme.font.micro, fontFamily: theme.font.family }}>{label}</span>
            <span style={{ color: theme.colors.textPrimary, fontSize: theme.font.micro, fontFamily: theme.font.family }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Moves */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ color: theme.colors.textDim, fontSize: theme.font.micro, fontFamily: theme.font.family, marginBottom: `${theme.spacing.xs}px`, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Capacites
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `${theme.spacing.xs}px` }}>
          {pokemon.moves.map((move, i) => {
            let moveData;
            try { moveData = getMoveData(move.moveId); } catch { return null; }
            const moveTypeColor = typeColors[moveData.type] || theme.colors.textDim;
            return (
              <div key={i} style={{
                background: `${moveTypeColor}08`,
                borderRadius: `${theme.radius.sm}px`,
                borderLeft: `2px solid ${moveTypeColor}`,
                padding: `${theme.spacing.xs}px 6px`,
              }}>
                <div style={{ color: theme.colors.textPrimary, fontSize: theme.font.micro, fontFamily: theme.font.family }}>
                  {moveData.name}
                </div>
                <div style={{ color: theme.colors.textDimmer, fontSize: '6px', fontFamily: theme.font.family, marginTop: '2px' }}>
                  PP {move.currentPp}/{move.maxPp}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: `${theme.spacing.sm}px`, justifyContent: 'center' }}>
        {source.type === 'team' && (
          <Button
            variant="danger"
            size="sm"
            onClick={onDeposit}
            disabled={!canDeposit}
          >
            Deposer
          </Button>
        )}
        {source.type === 'pc' && (
          <Button
            variant="primary"
            size="sm"
            onClick={onWithdraw}
            disabled={!canWithdraw}
          >
            Retirer
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onClose}>
          Fermer
        </Button>
      </div>
    </div>
  );
}
