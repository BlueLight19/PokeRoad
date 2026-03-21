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

    // Paralysis drops speed (Gen 9: 0.5x)
    if (stat === 'speed' && pokemon.status === 'paralysis') {
        multiplier *= 0.5;
    }

    // Burn drops Attack
    if (stat === 'attack' && pokemon.status === 'burn') {
        multiplier *= 0.5;
    }

    return Math.floor(pokemon.stats[stat] * multiplier);
}
