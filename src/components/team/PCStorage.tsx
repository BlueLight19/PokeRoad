import React, { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getPokemonData, getMoveData } from '../../utils/dataLoader';
import { Button } from '../ui/Button';
import { PokemonInstance } from '../../types/pokemon';
import { BOX_CAPACITY } from '../../engine/pcStorage';

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
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ color: '#9C27B0', fontSize: '14px', fontFamily: "'Press Start 2P', monospace", marginBottom: '16px', textAlign: 'center' }}>
        PC de Léo
      </h2>

      {/* Team section */}
      <div 
        style={{ marginBottom: '16px' }}
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
        <div style={{ color: '#aaa', fontSize: '9px', fontFamily: "'Press Start 2P', monospace", marginBottom: '8px' }}>
          Équipe ({team.length}/6)
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '6px',
          background: 'rgba(26, 42, 58, 0.8)',
          padding: '8px',
          borderRadius: '8px',
          border: '2px solid #333',
        }}>
          {Array.from({ length: 6 }).map((_, idx) => {
            const pokemon = team[idx];
            const isDragOver = dragOverTeamIndex === idx && dragSource?.type === 'team' && dragSource.index !== idx;
            
            if (!pokemon) {
              return (
                <div key={`team-empty-${idx}`} style={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  borderRadius: '6px',
                  aspectRatio: '1',
                  opacity: 0.2,
                  border: '2px solid transparent',
                }} />
              );
            }
            const data = getPokemonData(pokemon.dataId);
            const spriteUrl = pokemon.isShiny ? data.spriteUrl.replace('pokemon', 'pokemon/shiny') : data.spriteUrl;
            const isSelected = selected?.type === 'team' && selected.index === idx;
            const hpRatio = pokemon.currentHp / pokemon.maxHp;
            const hpColor = hpRatio > 0.5 ? '#4CAF50' : hpRatio > 0.2 ? '#FF9800' : '#f44336';
            const isDragging = dragSource?.type === 'team' && dragSource.index === idx;

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
                  background: 'rgba(15, 23, 42, 0.7)',
                  borderRadius: '6px',
                  aspectRatio: '1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'grab',
                  position: 'relative',
                  border: isDragOver ? '2px solid #2196F3' : isSelected ? '2px solid #9C27B0' : '2px solid #333',
                  opacity: isDragging ? 0.5 : 1,
                  transition: 'border-color 0.2s, opacity 0.2s',
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
                  bottom: '2px',
                  left: '2px',
                  right: '2px',
                  height: '3px',
                  background: '#333',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}>
                  <div style={{ width: `${hpRatio * 100}%`, height: '100%', background: hpColor }} />
                </div>
                <div style={{
                  position: 'absolute',
                  top: '1px',
                  right: '2px',
                  fontSize: '7px',
                  color: '#aaa',
                  fontFamily: "'Press Start 2P', monospace",
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

      {/* Box section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <Button variant="secondary" size="sm" onClick={handlePrevBox}>&lt;</Button>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px', color: '#ccc' }}>
          {currentBox.name} ({boxCount}/{BOX_CAPACITY})
        </div>
        <Button variant="secondary" size="sm" onClick={handleNextBox}>&gt;</Button>
      </div>

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
          background: 'rgba(22, 33, 62, 0.8)',
          padding: '8px',
          borderRadius: '8px',
          minHeight: '200px',
          border: isDragOverPc && dragSource?.type === 'team' ? '2px solid #2196F3' : '2px solid #333',
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
                  background: 'rgba(15, 23, 42, 0.5)',
                  borderRadius: '4px',
                  aspectRatio: '1',
                  opacity: isDragOver ? 0.6 : 0.2,
                  border: isDragOver ? '2px solid #2196F3' : '2px solid transparent',
                  transition: 'border-color 0.2s, opacity 0.2s',
                }}
              />
            );
          }

          const data = getPokemonData(pokemon.dataId);
          const spriteUrl = pokemon.isShiny ? data.spriteUrl.replace('pokemon', 'pokemon/shiny') : data.spriteUrl;
          const isSelected = selected?.type === 'pc' && selected.uid === pokemon.uid;
          const hpRatio = pokemon.currentHp / pokemon.maxHp;
          const hpColor = hpRatio > 0.5 ? '#4CAF50' : hpRatio > 0.2 ? '#FF9800' : '#f44336';
          const isDragging = dragSource?.type === 'pc' && dragSource.uid === pokemon.uid;

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
                background: 'rgba(15, 23, 42, 0.7)',
                borderRadius: '4px',
                aspectRatio: '1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'grab',
                position: 'relative',
                border: isDragOver && !isDragging ? '2px solid #2196F3' : isSelected ? '2px solid #9C27B0' : '2px solid #333',
                opacity: isDragging ? 0.5 : 1,
                transition: 'border-color 0.2s, opacity 0.2s',
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
                bottom: '2px',
                left: '2px',
                right: '2px',
                height: '3px',
                background: '#333',
                borderRadius: '2px',
                overflow: 'hidden',
              }}>
                <div style={{ width: `${hpRatio * 100}%`, height: '100%', background: hpColor }} />
              </div>
              <div style={{
                position: 'absolute',
                top: '1px',
                right: '2px',
                fontSize: '7px',
                color: '#aaa',
                fontFamily: "'Press Start 2P', monospace",
              }}>
                {pokemon.level}
              </div>
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
  const hpColor = hpRatio > 0.5 ? '#4CAF50' : hpRatio > 0.2 ? '#FF9800' : '#f44336';
  const font = "'Press Start 2P', monospace";

  const canDeposit = source.type === 'team' && teamLength > 1;
  const canWithdraw = source.type === 'pc' && teamLength < 6;

  return (
    <div style={{
      background: 'rgba(15, 25, 35, 0.9)',
      border: '2px solid #9C27B0',
      borderRadius: '10px',
      padding: '12px',
      marginBottom: '16px',
      animation: 'fadeIn 0.2s ease',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
        <img
          src={spriteUrl}
          alt={data.name}
          style={{ width: '64px', height: '64px', imageRendering: 'pixelated' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontSize: '11px', fontFamily: font }}>
            {pokemon.nickname || data.name}
          </div>
          <div style={{ color: '#888', fontSize: '8px', fontFamily: font, marginTop: '4px' }}>
            Nv.{pokemon.level}
            {pokemon.status !== null && (
              <span style={{ color: '#e94560', marginLeft: '8px' }}>
                [{pokemon.status.toUpperCase()}]
              </span>
            )}
          </div>
          {/* HP bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
            <div style={{ flex: 1, height: '6px', background: '#333', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${hpRatio * 100}%`, height: '100%', background: hpColor, borderRadius: '3px' }} />
            </div>
            <span style={{ color: '#aaa', fontSize: '7px', fontFamily: font }}>
              {pokemon.currentHp}/{pokemon.maxHp}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '4px',
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
            background: 'rgba(26, 42, 58, 0.7)',
            borderRadius: '4px',
            padding: '4px 6px',
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span style={{ color: '#888', fontSize: '7px', fontFamily: font }}>{label}</span>
            <span style={{ color: '#fff', fontSize: '7px', fontFamily: font }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Moves */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ color: '#888', fontSize: '7px', fontFamily: font, marginBottom: '4px' }}>
          Capacites
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          {pokemon.moves.map((move, i) => {
            let moveData;
            try { moveData = getMoveData(move.moveId); } catch { return null; }
            return (
              <div key={i} style={{
                background: 'rgba(26, 42, 58, 0.7)',
                borderRadius: '4px',
                padding: '4px 6px',
              }}>
                <div style={{ color: '#fff', fontSize: '7px', fontFamily: font }}>
                  {moveData.name}
                </div>
                <div style={{ color: '#666', fontSize: '6px', fontFamily: font, marginTop: '2px' }}>
                  PP {move.currentPp}/{move.maxPp}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
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
