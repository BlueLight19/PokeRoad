const fs = require('fs');

const pPath = 'src/data/gen1/pokemon.json';
const mPath = 'src/data/gen1/moves.json';

const pokemon = JSON.parse(fs.readFileSync(pPath, 'utf8'));
const moves = JSON.parse(fs.readFileSync(mPath, 'utf8'));

const nameToId = {};
moves.forEach(m => { nameToId[m.name.toLowerCase()] = m.id; });

function getId(name) {
    const id = nameToId[name.toLowerCase()];
    if (!id) console.log("WARNING: Move not found: " + name);
    return id || -1;
}

function replaceMoveForPokes(pIds, badId, goodName, levelCond = null) {
    const goodId = getId(goodName);
    pIds.forEach(pid => {
        const p = pokemon.find(x => x.id === pid);
        if (p) {
            p.learnset.forEach(l => {
                if (l.moveId === badId && (levelCond === null || l.level === levelCond)) {
                    l.moveId = goodId;
                }
            });
        }
    });
}

function swapMoves(pIds, idA, idB) {
    pIds.forEach(pid => {
        const p = pokemon.find(x => x.id === pid);
        if (p) {
            p.learnset.forEach(l => {
                if (l.moveId === idA) l.moveId = idB;
                else if (l.moveId === idB) l.moveId = idA;
            });
        }
    });
}

// 1. Bulbizarre, Herbizarre, Florizarre (1, 2, 3)
replaceMoveForPokes([1, 2, 3], 73, "Vampigraine", 7);
replaceMoveForPokes([1, 2, 3], 76, "Fouet Lianes", 13);
replaceMoveForPokes([1, 2, 3], 169, "Lance-Soleil");

// 2. Dracaufeu (6)
const p6 = pokemon.find(x => x.id === 6);
if (p6) {
    const l36 = p6.learnset.find(l => l.level === 36);
    if (l36) l36.moveId = getId("Tranche");
    
    // Remove 81 if exists, and properly set 46, 55
    p6.learnset = p6.learnset.filter(l => l.level !== 81);
    const l46 = p6.learnset.find(l => l.level === 46);
    if (l46) l46.moveId = getId("Lance-Flammes");
    else p6.learnset.push({level: 46, moveId: getId("Lance-Flammes")});
    
    const l55 = p6.learnset.find(l => l.level === 55);
    if (l55) l55.moveId = getId("Danse-Flamme");
    else p6.learnset.push({level: 55, moveId: getId("Danse-Flamme")});
    
    p6.learnset.sort((a,b) => a.level - b.level);
}

// 3. Chenipan, Papilusion (10, 12)
replaceMoveForPokes([10], 81, "Sécrétion");
replaceMoveForPokes([12], 48, "Choc Mental");

// 4. Aspicot, Dardargnan (13, 15)
replaceMoveForPokes([13], 81, "Sécrétion");
replaceMoveForPokes([15], 165, "Hâte");

// 5. Rattata, Rattatac (19, 20)
replaceMoveForPokes([19, 20], 162, "Croc de Mort");

// 6. Piafabec, Rapasdepic (21, 22)
replaceMoveForPokes([21, 22], 100, "Bec Vrille");

// 7. Pikachu, Raichu (25, 26)
const p25 = pokemon.find(x => x.id === 25);
if (p25) p25.learnset = p25.learnset.filter(l => l.moveId !== 85);
const p26 = pokemon.find(x => x.id === 26);
if (p26) p26.learnset = p26.learnset.filter(l => l.moveId !== 85);

// 8. Sabelette, Sablaireau (27, 28)
swapMoves([27, 28], 154, 129);

// 9. Nidoran♀, Nidorina, Nidoqueen (29, 30, 31)
replaceMoveForPokes([29, 30, 31], 41, "Double Pied");
const p31 = pokemon.find(x => x.id === 31);
if (p31 && !p31.learnset.find(l => l.moveId === getId("Mimi-Queue"))) {
    p31.learnset.push({level: 1, moveId: getId("Mimi-Queue")});
    p31.learnset.sort((a,b) => a.level - b.level);
}

// 10. Nidoran♂, Nidorino, Nidoking (32, 33, 34)
replaceMoveForPokes([32, 33, 34], 41, "Double Pied");
const p34 = pokemon.find(x => x.id === 34);
if (p34) {
    const l1 = p34.learnset.find(l => l.level === 1 && l.moveId === getId("Griffe"));
    if (l1) l1.moveId = getId("Dard-Venin");
}

// 11. Mélofée, Mélodelfe (35, 36)
replaceMoveForPokes([35, 36], 24, "Torgnoles");

// 12. Rondoudou, Grodoudou (39, 40)
replaceMoveForPokes([39, 40], 106, "Boul'Armure");

// 13. Mystherbe, Ortide, Rafflesia (43, 44, 45)
replaceMoveForPokes([43, 44, 45], 169, "Lance-Soleil");

// 14. Paras, Parasect (46, 47)
replaceMoveForPokes([46, 47], 71, "Vampirisme");

// 15. Mimitoss, Aéromite (48, 49)
replaceMoveForPokes([48, 49], 93, "Rafale Psy");

// 16. Psykokwak, Akwakwak (54, 55)
[54, 55].forEach(pid => {
    const p = pokemon.find(x => x.id === pid);
    if(p) {
        const l39 = p.learnset.find(l => l.level === 39 && l.moveId === 154);
        if(l39) l39.level = 43;
        const l43 = p.learnset.find(l => l.level === 43 && l.moveId === 56);
        if(l43) l43.level = 52;
        p.learnset.sort((a,b) => a.level - b.level);
    }
});

// 17. Férosinge, Colossinge (56, 57)
replaceMoveForPokes([56, 57], 103, "Frappe Atlas");

// 18. Ptitard, Têtarte (60, 61)
replaceMoveForPokes([60, 61], 161, "Torgnoles");

// 19. Kadabra, Alakazam (64, 65)
replaceMoveForPokes([64, 65], 94, "Entrave");
replaceMoveForPokes([64, 65], 149, "Psyko");

// 20. Tentacool, Tentacruel (72, 73)
replaceMoveForPokes([72, 73], 115, "Bouclier");

// 21. Racaillou, Gravalanch, Grolem (74, 75, 76)
replaceMoveForPokes([74, 75, 76], 106, "Boul'Armure");

// 22. Magnéti, Magnéton (81, 82)
replaceMoveForPokes([81, 82], 86, "Ultrason");

// 23. Tadmorv, Grotadmorv (88, 89)
replaceMoveForPokes([88, 89], 51, "Gaz Toxik");

// 24. Kokiyas, Crustabri (90, 91)
replaceMoveForPokes([90, 91], 50, "Ultrason");

// 25. Fantominus, Spectrum, Ectoplasma (92, 93, 94)
[92, 93, 94].forEach(pid => {
    const p = pokemon.find(x => x.id === pid);
    if(p) {
        p.learnset.forEach(l => {
            if (l.moveId === 95 && l.level > 1) {
                l.moveId = getId("Ombre Nocturne");
            }
        });
    }
});

// 26. Onix (95)
replaceMoveForPokes([95], 153, "Souplesse");

// 27. Soporifik, Hypnomade (96, 97)
replaceMoveForPokes([96, 97], 94, "Yoga");

// 28. Krabby, Krabboss (98, 99)
replaceMoveForPokes([98, 99], 110, "Pince-Masse");

// 29. Noeunoeuf, Noadkoko (102, 103)
replaceMoveForPokes([102, 103], 73, "Vampigraine");

// 30. Osselait, Ossatueur (104, 105)
replaceMoveForPokes([104, 105], 39, "Massd'Os");

// 31. Kicklee (106)
const p106 = pokemon.find(x => x.id === 106);
if (p106) {
    p106.learnset = [
        {level: 1, moveId: getId("Double Pied")},
        {level: 33, moveId: getId("Mawashi Geri")},
        {level: 38, moveId: getId("Pied Sauté")},
        {level: 43, moveId: getId("Puissance")},
        {level: 48, moveId: getId("Pied Voltige")},
        {level: 53, moveId: getId("Ultimawashi")}
    ];
}

// 32. Tygnon (107)
replaceMoveForPokes([107], 4, "Ultimapoing");

// 33. Excelangue (108)
replaceMoveForPokes([108], 21, "Ligotage");

// 34. Smogo, Smogogo (109, 110)
replaceMoveForPokes([109, 110], 124, "Brouillard");

// 35. Rhinocorne, Rhinoféros (111, 112)
replaceMoveForPokes([111, 112], 24, "Mimi-Queue");

// 36. Leveinard (113)
replaceMoveForPokes([113], 118, "Torgnoles");

// 37. Saquedeneu (114)
replaceMoveForPokes([114], 79, "Ligotage");

// 38. Kangourex (115)
replaceMoveForPokes([115], 24, "Morsure");

// 39. Poissirène, Poissoroy (118, 119)
replaceMoveForPokes([118, 119], 31, "Ultrason");

// 40. Stari, Staross (120, 121)
replaceMoveForPokes([120, 121], 129, "Soin");

// 41. M. Mime (122)
replaceMoveForPokes([122], 114, "Bouclier");

// 42. Insécateur (123)
replaceMoveForPokes([123], 147, "Reflet");

// 43. Lippoutou (124)
replaceMoveForPokes([124], 8, "Torgnoles");

// 44. Elektek (125)
replaceMoveForPokes([125], 7, "Poing Éclair");

// 45. Magmar (126)
replaceMoveForPokes([126], 126, "Purédpois");

// 46. Scarabrute (127)
replaceMoveForPokes([127], 11, "Frappe Atlas", 30);

// 47. Tauros (128)
replaceMoveForPokes([128], 24, "Écrasement");

// 48. Léviator (130)
replaceMoveForPokes([130], 82, "Draco-Rage");

// 49. Lokhlass (131)
replaceMoveForPokes([131], 46, "Berceuse");

// 50. Aquali, Voltali, Pyroli (134, 135, 136)
replaceMoveForPokes([134], 28, "Pistolet à O", 31);
replaceMoveForPokes([135], 28, "Éclair", 31);
replaceMoveForPokes([136], 28, "Flammèche", 31);

// 51. Porygon (137)
replaceMoveForPokes([137], 93, "Rafale Psy");

// 52. Amonita, Amonistar (138, 139)
replaceMoveForPokes([138, 139], 106, "Koud'Korne");

// 53. Kabuto, Kabutops (140, 141)
replaceMoveForPokes([140, 141], 106, "Griffe");

// 54. Ptera (142)
replaceMoveForPokes([142], 98, "Ultrason");

// 55. Ronflex (143)
replaceMoveForPokes([143], 132, "Amnésie");

// 56. Artikodin (144)
replaceMoveForPokes([144], 59, "Laser Glace");

// 57. Electhor (145)
replaceMoveForPokes([145], 87, "Bec Vrille");

// 58. Sulfura (146)
replaceMoveForPokes([146], 52, "Danse-Flamme");

// 59. Minidraco, Draco, Dracolosse (147, 148, 149)
replaceMoveForPokes([147, 148, 149], 132, "Ligotage");

// 60. Mewtwo (150)
replaceMoveForPokes([150], 97, "Psyko");

// 61. Mew (151)
const p151 = pokemon.find(x => x.id === 151);
if (p151) {
    p151.learnset = [
        {level: 1, moveId: getId("Écras'Face")},
        {level: 10, moveId: getId("Morphing")},
        {level: 20, moveId: getId("Ultimapoing")},
        {level: 30, moveId: getId("Métronome")},
        {level: 40, moveId: getId("Psyko")}
    ];
}

fs.writeFileSync(pPath, JSON.stringify(pokemon, null, 2), 'utf8');
console.log("Done fixing pokemon.json moves.");
