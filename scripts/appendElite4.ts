
import fs from 'fs';
import path from 'path';
import { TrainerData } from '../src/types/game';

const trainersPath = path.join(process.cwd(), 'src/data/gen1/trainers.json');

const elite4Data = [
    {
        "id": "league-lorelei",
        "name": "Olga",
        "trainerClass": "Conseil 4",
        "reward": 5544,
        "zone": "league-hall",
        "team": [
            { "pokemonId": 87, "level": 54, "moves": [] },
            { "pokemonId": 91, "level": 53, "moves": [] },
            { "pokemonId": 80, "level": 54, "moves": [] },
            { "pokemonId": 124, "level": 56, "moves": [] },
            { "pokemonId": 131, "level": 56, "moves": [] }
        ]
    },
    {
        "id": "league-bruno",
        "name": "Aldo",
        "trainerClass": "Conseil 4",
        "reward": 5742,
        "zone": "league-hall",
        "team": [
            { "pokemonId": 95, "level": 53, "moves": [] },
            { "pokemonId": 107, "level": 55, "moves": [] },
            { "pokemonId": 106, "level": 55, "moves": [] },
            { "pokemonId": 95, "level": 56, "moves": [] },
            { "pokemonId": 68, "level": 58, "moves": [] }
        ]
    },
    {
        "id": "league-agatha",
        "name": "Agatha",
        "trainerClass": "Conseil 4",
        "reward": 5940,
        "zone": "league-hall",
        "team": [
            { "pokemonId": 94, "level": 56, "moves": [] },
            { "pokemonId": 42, "level": 56, "moves": [] },
            { "pokemonId": 93, "level": 55, "moves": [] },
            { "pokemonId": 24, "level": 58, "moves": [] },
            { "pokemonId": 94, "level": 60, "moves": [] }
        ]
    },
    {
        "id": "league-lance",
        "name": "Peter",
        "trainerClass": "Conseil 4",
        "reward": 6138,
        "zone": "league-hall",
        "team": [
            { "pokemonId": 130, "level": 58, "moves": [] },
            { "pokemonId": 148, "level": 56, "moves": [] },
            { "pokemonId": 148, "level": 56, "moves": [] },
            { "pokemonId": 142, "level": 60, "moves": [] },
            { "pokemonId": 149, "level": 62, "moves": [] }
        ]
    },
    {
        "id": "league-champion",
        "name": "Blue",
        "trainerClass": "Maître",
        "reward": 9900,
        "zone": "league-hall",
        "team": [
            { "pokemonId": 18, "level": 61, "moves": [] },
            { "pokemonId": 65, "level": 59, "moves": [] },
            { "pokemonId": 112, "level": 61, "moves": [] },
            { "pokemonId": 103, "level": 61, "moves": [] },
            { "pokemonId": 130, "level": 63, "moves": [] },
            { "pokemonId": 6, "level": 65, "moves": [] }
        ]
    }
];

try {
    const fileContent = fs.readFileSync(trainersPath, 'utf8');
    const trainers = JSON.parse(fileContent);

    let addedCount = 0;
    for (const trainer of elite4Data) {
        if (!trainers.find((t: any) => t.id === trainer.id)) {
            trainers.push(trainer);
            addedCount++;
        }
    }

    if (addedCount > 0) {
        fs.writeFileSync(trainersPath, JSON.stringify(trainers, null, 2));
        console.log(`Successfully added ${addedCount} Elite 4 trainers.`);
    } else {
        console.log("Elite 4 trainers already exist.");
    }

} catch (e) {
    console.error("Error updating trainers.json:", e);
}
