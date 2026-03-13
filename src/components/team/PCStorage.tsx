import React, { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getPokemonData, getMoveData } from '../../utils/dataLoader';
import { Button } from '../ui/Button';
import { PokemonInstance } from '../../types/pokemon';
import { BOX_CAPACITY } from '../../engine/pcStorage';

type SelectedSource = { type: 'team'; index: number } | { type: 'pc'; uid: string };

export function PCStorage() {
  const { pc, team, moveFromPc, moveToPc, setView, switchTeamOrder } = useGameStore();
  const [currentBoxIndex, setCurrentBoxIndex] = useState(pc.currentBoxId || 0);
  const [selected, setSelected] = useState<SelectedSource | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

  const handleDeposit = () => {
    if (!selectedPokemon || selected?.type !== 'team') return;
    if (team.length <= 1) return;
    moveToPc(selectedPokemon.uid);
    setSelected(null);
  };

  const handleWithdraw = () => {
    if (!selectedPokemon || selected?.type !== 'pc') return;
    if (team.length >= 6) return;
    moveFromPc(selectedPokemon.uid);
    setSelected(null);
  };

  return (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ color: '#9C27B0', fontSize: '14px', fontFamily: "'Press Start 2P', monospace", marginBottom: '16px', textAlign: 'center' }}>
        PC de Leo
      </h2>

      {/* Team section */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ color: '#aaa', fontSize: '9px', fontFamily: "'Press Start 2P', monospace", marginBottom: '8px' }}>
          Equipe ({team.length}/6)
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
            const isDragOver = dragOverIndex === idx && dragIndex !== idx;
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
            const isDragging = dragIndex === idx;

            return (
              <div
                key={pokemon.uid}
                draggable
                onDragStart={(e) => {
                  setDragIndex(idx);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverIndex(idx);
                }}
                onDragLeave={() => {
                  setDragOverIndex(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null && dragIndex !== idx) {
                    switchTeamOrder(dragIndex, idx);
                  }
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDragOverIndex(null);
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
          onDeposit={handleDeposit}
          onWithdraw={handleWithdraw}
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

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '6px',
        background: 'rgba(22, 33, 62, 0.8)',
        padding: '8px',
        borderRadius: '8px',
        minHeight: '200px',
        border: '2px solid #333',
      }}>
        {currentBox.pokemon.map((pokemon, slotId) => {
          if (!pokemon) {
            return (
              <div key={`slot-${slotId}`} style={{
                background: 'rgba(15, 23, 42, 0.5)',
                borderRadius: '4px',
                aspectRatio: '1',
                opacity: 0.2,
                border: '2px solid transparent',
              }} />
            );
          }

          const data = getPokemonData(pokemon.dataId);
          const spriteUrl = pokemon.isShiny ? data.spriteUrl.replace('pokemon', 'pokemon/shiny') : data.spriteUrl;
          const isSelected = selected?.type === 'pc' && selected.uid === pokemon.uid;
          const hpRatio = pokemon.currentHp / pokemon.maxHp;
          const hpColor = hpRatio > 0.5 ? '#4CAF50' : hpRatio > 0.2 ? '#FF9800' : '#f44336';

          return (
            <div
              key={pokemon.uid}
              onClick={() => setSelected(isSelected ? null : { type: 'pc', uid: pokemon.uid })}
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                borderRadius: '4px',
                aspectRatio: '1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
                border: isSelected ? '2px solid #9C27B0' : '2px solid #333',
                transition: 'border-color 0.2s',
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

      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
        <Button variant="ghost" onClick={() => setView('world_map')}>
          Quitter
        </Button>
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
