import React, { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { createPokemonInstance, calculateStat } from '../../engine/experienceCalculator';
import { getPokemonData, getMoveData } from '../../utils/dataLoader';

export function DevCustomPokemon() {
    const [pokeId, setPokeId] = useState<number>(1);
    const [level, setLevel] = useState<number>(100);
    const [isShiny, setIsShiny] = useState<boolean>(false);
    const [ability, setAbility] = useState<string>('');

    // Stats: HP, Atk, Def, SpA, SpD, Spe
    const [ivs, setIvs] = useState({ hp: 31, attack: 31, defense: 31, spAtk: 31, spDef: 31, speed: 31 });
    const [evs, setEvs] = useState({ hp: 0, attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 });

    // 4 moves
    const [moves, setMoves] = useState<number[]>([0, 0, 0, 0]);

    const [isExpanded, setIsExpanded] = useState(false);

    const giveCustomPokemon = useGameStore(s => s.giveCustomPokemon);

    const handleCreate = () => {
        try {
            const basePokemon = createPokemonInstance(pokeId, level, [], isShiny);
            
            // Apply IVs and EVs
            basePokemon.ivs = { ...ivs };
            basePokemon.evs = { ...evs };
            basePokemon.isShiny = isShiny;
            if (ability.trim()) {
                basePokemon.ability = ability.trim();
            }

            // Recalculate stats
            const data = getPokemonData(pokeId);
            const stats = {
                hp: calculateStat('hp', data.baseStats.hp, ivs.hp, evs.hp, level),
                attack: calculateStat('attack', data.baseStats.attack, ivs.attack, evs.attack, level),
                defense: calculateStat('defense', data.baseStats.defense, ivs.defense, evs.defense, level),
                spAtk: calculateStat('spAtk', data.baseStats.spAtk, ivs.spAtk, evs.spAtk, level),
                spDef: calculateStat('spDef', data.baseStats.spDef, ivs.spDef, evs.spDef, level),
                speed: calculateStat('speed', data.baseStats.speed, ivs.speed, evs.speed, level),
            };
            basePokemon.stats = stats;
            basePokemon.maxHp = stats.hp;
            basePokemon.currentHp = stats.hp;

            // Apply moves
            const validMoves = moves.filter(m => m > 0);
            basePokemon.moves = validMoves.map(m => {
                const moveData = getMoveData(m);
                return {
                    moveId: m,
                    currentPp: moveData.pp,
                    maxPp: moveData.pp
                };
            });

            giveCustomPokemon(basePokemon);
            alert("Pokémon personnalisé généré et ajouté !");
        } catch (err) {
            console.error(err);
            alert("Erreur lors de la création : Vérifiez l'ID du Pokémon et des attaques.");
        }
    };

    const inputStyle = {
        background: '#0f172a', color: '#fff', border: '1px solid #333',
        padding: '4px', fontSize: '8px', fontFamily: "'Press Start 2P', monospace",
        width: '100%', marginBottom: '6px', boxSizing: 'border-box' as const, borderRadius: '2px'
    };
    
    const smallInputStyle = { ...inputStyle, width: '40px', display: 'inline-block', marginBottom: '2px' };
    const labelStyle = { color: '#aaa', fontSize: '7px', display: 'block', marginBottom: '2px' };

    const btnStyle = {
        background: '#16213e', color: '#fff', border: '1px solid #e94560',
        padding: '6px', fontFamily: "'Press Start 2P', monospace", fontSize: '7px',
        cursor: 'pointer', borderRadius: '2px', width: '100%', marginTop: '6px'
    };

    const toggleBtnStyle = {
        background: 'none', border: '1px solid #e94560', color: '#e94560',
        padding: '4px', fontFamily: "'Press Start 2P', monospace", fontSize: '7px',
        cursor: 'pointer', borderRadius: '2px', width: '100%', marginBottom: '6px'
    };

    if (!isExpanded) {
        return (
            <div style={{ marginBottom: '10px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
                <button style={toggleBtnStyle} onClick={() => setIsExpanded(true)}>+ Créer Pokémon Sur-Mesure</button>
            </div>
        );
    }

    return (
        <div style={{ marginBottom: '10px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#FFD600', fontSize: '8px' }}>Pokémon Sur-Mesure</span>
                <button onClick={() => setIsExpanded(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '10px' }}>✖</button>
            </div>

            <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                <div style={{ flex: 1 }}>
                    <span style={labelStyle}>Num. Dex</span>
                    <input style={inputStyle} type="number" value={pokeId} onChange={e => setPokeId(parseInt(e.target.value) || 1)} />
                </div>
                <div style={{ flex: 1 }}>
                    <span style={labelStyle}>Niveau</span>
                    <input style={inputStyle} type="number" value={level} onChange={e => setLevel(parseInt(e.target.value) || 1)} />
                </div>
            </div>

            <div style={{ marginBottom: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '7px', color: '#fff' }}>
                    <input type="checkbox" checked={isShiny} onChange={e => setIsShiny(e.target.checked)} />
                    Shiny (Chromatique)
                </label>
            </div>

            <div style={{ marginBottom: '6px' }}>
                <span style={labelStyle}>Talent (nom exact, laisser vide pour defaut)</span>
                <input style={inputStyle} type="text" placeholder="ex: Levitate" value={ability} onChange={e => setAbility(e.target.value)} />
            </div>

            <div style={{ marginBottom: '6px' }}>
                <span style={labelStyle}>IVs (0-31)</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                    <input style={smallInputStyle} type="number" placeholder="HP" value={ivs.hp} onChange={e => setIvs({...ivs, hp: parseInt(e.target.value)||0})} title="HP" />
                    <input style={smallInputStyle} type="number" placeholder="Atk" value={ivs.attack} onChange={e => setIvs({...ivs, attack: parseInt(e.target.value)||0})} title="Attack" />
                    <input style={smallInputStyle} type="number" placeholder="Def" value={ivs.defense} onChange={e => setIvs({...ivs, defense: parseInt(e.target.value)||0})} title="Defense" />
                    <input style={smallInputStyle} type="number" placeholder="SpA" value={ivs.spAtk} onChange={e => setIvs({...ivs, spAtk: parseInt(e.target.value)||0})} title="SpAtk" />
                    <input style={smallInputStyle} type="number" placeholder="SpD" value={ivs.spDef} onChange={e => setIvs({...ivs, spDef: parseInt(e.target.value)||0})} title="SpDef" />
                    <input style={smallInputStyle} type="number" placeholder="Spe" value={ivs.speed} onChange={e => setIvs({...ivs, speed: parseInt(e.target.value)||0})} title="Speed" />
                </div>
            </div>

            <div style={{ marginBottom: '6px' }}>
                <span style={labelStyle}>EVs (0-252)</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                    <input style={smallInputStyle} type="number" placeholder="HP" value={evs.hp} onChange={e => setEvs({...evs, hp: parseInt(e.target.value)||0})} title="HP" />
                    <input style={smallInputStyle} type="number" placeholder="Atk" value={evs.attack} onChange={e => setEvs({...evs, attack: parseInt(e.target.value)||0})} title="Attack" />
                    <input style={smallInputStyle} type="number" placeholder="Def" value={evs.defense} onChange={e => setEvs({...evs, defense: parseInt(e.target.value)||0})} title="Defense" />
                    <input style={smallInputStyle} type="number" placeholder="SpA" value={evs.spAtk} onChange={e => setEvs({...evs, spAtk: parseInt(e.target.value)||0})} title="SpAtk" />
                    <input style={smallInputStyle} type="number" placeholder="SpD" value={evs.spDef} onChange={e => setEvs({...evs, spDef: parseInt(e.target.value)||0})} title="SpDef" />
                    <input style={smallInputStyle} type="number" placeholder="Spe" value={evs.speed} onChange={e => setEvs({...evs, speed: parseInt(e.target.value)||0})} title="Speed" />
                </div>
            </div>

            <div style={{ marginBottom: '6px' }}>
                <span style={labelStyle}>Attaques (IDs des capacités, 0 = vide)</span>
                <div style={{ display: 'flex', gap: '2px' }}>
                    {[0,1,2,3].map(i => (
                        <input key={i} style={smallInputStyle} type="number" value={moves[i]} onChange={e => {
                            const newMoves = [...moves];
                            newMoves[i] = parseInt(e.target.value) || 0;
                            setMoves(newMoves);
                        }} />
                    ))}
                </div>
            </div>

            <button style={{ ...btnStyle, background: '#e94560' }} onClick={handleCreate}>Générer & Ajouter</button>
        </div>
    );
}
