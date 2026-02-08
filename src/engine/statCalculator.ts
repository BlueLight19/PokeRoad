import { PokemonInstance, BaseStats, StatName } from '../types/pokemon';

export function getEffectiveStat(pokemon: PokemonInstance, stat: keyof BaseStats): number {
    if (stat === 'hp') return pokemon.stats.hp;

    const stage = pokemon.statStages[stat];
    let multiplier = 1;

    if (stage >= 0) {
        multiplier = (2 + stage) / 2;
    } else {
        multiplier = 2 / (2 + Math.abs(stage));
    }

    // Paralysis drops speed
    if (stat === 'speed' && pokemon.status === 'paralysis') {
        multiplier *= 0.25; // Gen 1/2 was 0.25, later 0.5. Let's stick to 0.25 for severe penalty or 0.5 for modern.
        // The previous code had 0.25. Let's keep 0.25.
    }

    // Burn drops Attack
    if (stat === 'attack' && pokemon.status === 'burn') {
        multiplier *= 0.5;
    }

    return Math.floor(pokemon.stats[stat] * multiplier);
}
