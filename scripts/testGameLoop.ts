
import { createPokemonInstance } from '../src/engine/experienceCalculator';
import { executeMove } from '../src/engine/battleEngine';
import { getMoveData, initializeData } from '../src/utils/dataLoader';
import { PokemonInstance } from '../src/types/pokemon';

// Mock console to avoid spam
const logs: string[] = [];
const log = (msg: string) => logs.push(msg);

async function runTest() {
    console.log("Initializing data...");
    try {
        initializeData();
    } catch (e) {
        console.error("Failed to initialize data:", e);
        return;
    }

    console.log("Creating Pokemon...");
    const charizard = createPokemonInstance(6, 50); // Charizard
    const blastoise = createPokemonInstance(9, 50); // Blastoise

    console.log(`Created ${charizard.nickname || 'Charizard'} (HP: ${charizard.currentHp}/${charizard.maxHp})`);
    console.log("Moves:", charizard.moves.map(m => getMoveData(m.moveId).name).join(", "));

    console.log(`Created ${blastoise.nickname || 'Blastoise'} (HP: ${blastoise.currentHp}/${blastoise.maxHp})`);
    console.log("Moves:", blastoise.moves.map(m => getMoveData(m.moveId).name).join(", "));

    // Test Battle Loop
    console.log("\n--- Starting Simulated Battle ---");
    let turn = 1;
    while (charizard.currentHp > 0 && blastoise.currentHp > 0 && turn <= 20) {
        console.log(`\nTurn ${turn}`);

        // Randomly pick a move
        const move1 = charizard.moves[Math.floor(Math.random() * charizard.moves.length)];
        const move2 = blastoise.moves[Math.floor(Math.random() * blastoise.moves.length)];

        if (!move1 || !move2) {
            console.error("Pokemon have no moves!");
            break;
        }

        const moveData1 = getMoveData(move1.moveId);
        const moveData2 = getMoveData(move2.moveId);

        console.log(`Charizard (${charizard.currentHp}) uses ${moveData1.name}`);
        const result1 = executeMove(charizard, blastoise, move1);
        result1.logs.forEach(l => console.log(`[Battle] ${l.message}`));

        if (blastoise.currentHp <= 0) break;

        console.log(`Blastoise (${blastoise.currentHp}) uses ${moveData2.name}`);
        const result2 = executeMove(blastoise, charizard, move2);
        result2.logs.forEach(l => console.log(`[Battle] ${l.message}`));

        turn++;
    }

    console.log("\n--- Battle Ended ---");
    console.log(`Charizard HP: ${charizard.currentHp}`);
    console.log(`Blastoise HP: ${blastoise.currentHp}`);
}

runTest().catch(console.error);
