
import fs from 'fs';
import path from 'path';

const routesPath = path.join(process.cwd(), 'src/data/gen1/routes.json');

const specialZones = [
    {
        "id": "power-plant",
        "name": "Centrale",
        "region": "kanto",
        "generation": 1,
        "type": "dungeon",
        "unlockCondition": null,
        "wildEncounters": [
            { "pokemonId": 25, "minLevel": 22, "maxLevel": 26, "rate": 20 },
            { "pokemonId": 81, "minLevel": 22, "maxLevel": 26, "rate": 20 },
            { "pokemonId": 100, "minLevel": 22, "maxLevel": 26, "rate": 20 },
            { "pokemonId": 125, "minLevel": 30, "maxLevel": 36, "rate": 10 }
        ],
        "trainers": [],
        "connectedZones": ["route-10"],
        "description": "Une centrale abandonnée."
    },
    {
        "id": "seafoam-islands",
        "name": "Iles Ecume",
        "region": "kanto",
        "generation": 1,
        "type": "dungeon",
        "unlockCondition": { "type": "badge", "badge": "Ame" },
        "wildEncounters": [
            { "pokemonId": 86, "minLevel": 28, "maxLevel": 32, "rate": 30 },
            { "pokemonId": 79, "minLevel": 28, "maxLevel": 32, "rate": 30 },
            { "pokemonId": 124, "minLevel": 30, "maxLevel": 34, "rate": 10 }
        ],
        "trainers": [],
        "connectedZones": ["route-20"],
        "description": "Des îles jumelles glacées."
    },
    {
        "id": "cerulean-cave",
        "name": "Grotte Azurée",
        "region": "kanto",
        "generation": 1,
        "type": "dungeon",
        "unlockCondition": { "type": "badge", "badge": "Terre" },
        "wildEncounters": [
            { "pokemonId": 64, "minLevel": 50, "maxLevel": 60, "rate": 20 },
            { "pokemonId": 93, "minLevel": 50, "maxLevel": 60, "rate": 20 },
            { "pokemonId": 42, "minLevel": 50, "maxLevel": 60, "rate": 20 },
            { "pokemonId": 112, "minLevel": 50, "maxLevel": 60, "rate": 10 },
            { "pokemonId": 113, "minLevel": 50, "maxLevel": 60, "rate": 5 }
        ],
        "trainers": [],
        "connectedZones": ["azuria"],
        "description": "Une grotte mystérieuse réservée aux maîtres."
    }
];

try {
    const fileContent = fs.readFileSync(routesPath, 'utf8');
    const routes = JSON.parse(fileContent);

    let addedCount = 0;
    for (const zone of specialZones) {
        if (!routes.find((r: any) => r.id === zone.id)) {
            routes.push(zone);
            addedCount++;
        }
    }

    if (addedCount > 0) {
        fs.writeFileSync(routesPath, JSON.stringify(routes, null, 2));
        console.log(`Successfully added ${addedCount} special zones.`);
    } else {
        console.log("Special zones already exist.");
    }

} catch (e) {
    console.error("Error updating routes.json:", e);
}
