
import fs from 'fs';
import path from 'path';

const routesPath = path.join(process.cwd(), 'src/data/gen1/routes.json');

const leagueZone = {
    "id": "league-hall",
    "name": "Plateau Indigo",
    "region": "kanto",
    "generation": 1,
    "type": "city",
    "hasShop": true,
    "gymId": null,
    "connectedZones": ["victory-road"],
    "unlockCondition": {
        "type": "badge",
        "badge": "Terre"
    },
    "description": "Le défi ultime pour les dresseurs."
};

try {
    const fileContent = fs.readFileSync(routesPath, 'utf8');
    const routes = JSON.parse(fileContent);

    if (!routes.find((r: any) => r.id === leagueZone.id)) {
        routes.push(leagueZone);
        fs.writeFileSync(routesPath, JSON.stringify(routes, null, 2));
        console.log("Successfully added league-hall zone.");
    } else {
        console.log("league-hall zone already exists.");
    }

} catch (e) {
    console.error("Error updating routes.json:", e);
}
