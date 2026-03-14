import { PokemonInstance, BaseStats } from '../types/pokemon';
import { ItemData } from '../types/inventory';
import { checkStoneEvolution, evolvePokemon } from './evolutionEngine';
import { recalculateStats, processLevelUp, xpForLevel, LevelUpResult } from './experienceCalculator';
import { getPokemonData } from '../utils/dataLoader';

export interface ItemUseResult {
    success: boolean;
    message: string;
    consumed: boolean;
    newPokemonId?: number;
    levelUpResult?: LevelUpResult;
}

export function useItem(item: ItemData, target: PokemonInstance): ItemUseResult {
    if (!item.effect) {
        return { success: false, message: "Cet objet n'a aucun effet.", consumed: false };
    }

    // Evolution Stone / Link Cable
    if (item.effect.type === 'evolution') {
        const stoneId = item.effect.stone;
        if (!stoneId) return { success: false, message: "Pierre invalide.", consumed: false };

        const evolutionId = checkStoneEvolution(target, stoneId);
        if (evolutionId) {
            const result = evolvePokemon(target, evolutionId);
            return {
                success: true,
                message: `${result.oldName} évolue en ${result.newName} !`,
                consumed: true,
                newPokemonId: evolutionId
            };
        } else {
            return { success: false, message: "Cela n'a aucun effet.", consumed: false };
        }
    }

    // Healing
    if (item.effect.type === 'heal') {
        if (target.currentHp >= target.maxHp) {
            return { success: false, message: "Ça n'aura aucun effet.", consumed: false };
        }
        if (target.currentHp === 0) {
            return { success: false, message: "Ce Pokémon est K.O.", consumed: false };
        }

        // Support both healAmount (standard) and healFull
        if (item.effect.healFull) {
            const oldHp = target.currentHp;
            target.currentHp = target.maxHp;
            const healed = target.currentHp - oldHp;
            return { success: true, message: `${healed} PV restaurés.`, consumed: true };
        }

        const amount = item.effect.healAmount || 0;
        const oldHp = target.currentHp;
        target.currentHp = Math.min(target.maxHp, target.currentHp + amount);
        const healed = target.currentHp - oldHp;

        return { success: true, message: `${healed} PV restaurés.`, consumed: true };
    }

    // Revive
    if (item.effect.type === 'revive') {
        if (target.currentHp > 0) {
            return { success: false, message: "Ce Pokémon n'est pas K.O.", consumed: false };
        }

        const percent = item.effect.reviveHpPercent || 50;
        target.currentHp = Math.floor(target.maxHp * (percent / 100));
        target.status = null;
        target.statusTurns = 0;
        target.volatile = { confusion: 0, flinch: false, leechSeed: false, bound: 0 };

        return { success: true, message: "Le Pokémon est ravivé !", consumed: true };
    }

    // Status Heal
    if (item.effect.type === 'status_cure') {
        if (target.currentHp === 0) {
            return { success: false, message: "Ce Pokémon est K.O.", consumed: false };
        }

        const curesStatus = item.effect.curesStatus || [];
        let cured = false;

        // Check if it cures all statuses
        if (curesStatus.length >= 5 || curesStatus.includes('all')) {
            if (target.status !== null || target.volatile.confusion > 0) {
                target.status = null;
                target.statusTurns = 0;
                target.volatile.confusion = 0;
                cured = true;
            }
        } else if (curesStatus.includes('confusion')) {
            if (target.volatile.confusion > 0) {
                target.volatile.confusion = 0;
                cured = true;
            }
        } else if (target.status && curesStatus.includes(target.status)) {
            target.status = null;
            target.statusTurns = 0;
            cured = true;
        }

        if (cured) {
            return { success: true, message: "Le statut est soigné.", consumed: true };
        } else {
            return { success: false, message: "Ça n'aura aucun effet.", consumed: false };
        }
    }

    // Full Restore (heal + cure status)
    if (item.effect.type === 'full_restore') {
        if (target.currentHp === 0) {
            return { success: false, message: "Ce Pokémon est K.O.", consumed: false };
        }
        if (target.currentHp >= target.maxHp && target.status === null && target.volatile.confusion === 0) {
            return { success: false, message: "Ça n'aura aucun effet.", consumed: false };
        }
        const oldHp = target.currentHp;
        target.currentHp = target.maxHp;
        target.status = null;
        target.statusTurns = 0;
        target.volatile.confusion = 0;
        const healed = target.currentHp - oldHp;
        return { success: true, message: `${healed > 0 ? `${healed} PV restaurés. ` : ''}Statut soigné.`, consumed: true };
    }

    // Rare Candy (Super Bonbon)
    if (item.effect.type === 'rare_candy') {
        if (target.currentHp === 0) {
            return { success: false, message: "Ce Pokémon est K.O.", consumed: false };
        }
        if (target.level >= 100) {
            return { success: false, message: "Ce Pokémon est déjà au niveau max.", consumed: false };
        }
        
        const data = getPokemonData(target.dataId);
        
        // Create a temporary clone with boosted XP to check results
        const nextLevel = target.level + 1;
        const targetXp = xpForLevel(nextLevel, data.expGroup);
        const tempClone = { ...target, xp: targetXp };
        
        const result = processLevelUp(tempClone);
        if (result) {
            const hpDiff = result.newMaxHp - target.maxHp;
            target.level = result.newLevel;
            target.xp = targetXp;
            target.stats = result.newStats;
            target.maxHp = result.newMaxHp;
            target.currentHp = Math.min(target.maxHp, target.currentHp + hpDiff);
            target.xpToNextLevel = result.newXpToNextLevel;
            
            const name = target.nickname || data.name;
            return { 
                success: true, 
                message: `${name} monte au niveau ${target.level} !`, 
                consumed: true,
                levelUpResult: result
            };
        }
        
        return { success: false, message: "Ça n'aura aucun effet.", consumed: false };
    }

    // EV Boost (Vitamins)
    if (item.effect.type === 'ev_boost') {
        if (target.currentHp === 0) {
            return { success: false, message: "Ce Pokémon est K.O.", consumed: false };
        }
        const stat = item.effect.stat as keyof BaseStats;
        if (!stat || !(stat in target.evs)) {
            return { success: false, message: "Ça n'aura aucun effet.", consumed: false };
        }
        const totalEvs = Object.values(target.evs).reduce((s, v) => s + v, 0);
        if (totalEvs >= 510 || target.evs[stat] >= 255) {
            return { success: false, message: "Ça n'aura aucun effet.", consumed: false };
        }
        const gain = Math.min(item.effect.evAmount ?? 10, 255 - target.evs[stat], 510 - totalEvs);
        target.evs[stat] += gain;
        const newStats = recalculateStats(target);
        const hpDiff = newStats.hp - target.maxHp;
        target.stats = newStats;
        target.maxHp = newStats.hp;
        target.currentHp = Math.min(target.maxHp, target.currentHp + Math.max(0, hpDiff));
        return { success: true, message: `Les EVs ont augmenté !`, consumed: true };
    }

    // PP Restore (Ether / Elixir)
    if (item.effect.type === 'pp_restore') {
        if (target.currentHp === 0) {
            return { success: false, message: "Ce Pokémon est K.O.", consumed: false };
        }
        let restored = false;
        if (item.effect.ppAll) {
            // Restore all moves
            for (const move of target.moves) {
                if (move.currentPp < move.maxPp) {
                    if (item.effect.ppFull) {
                        move.currentPp = move.maxPp;
                    } else {
                        move.currentPp = Math.min(move.maxPp, move.currentPp + (item.effect.ppAmount ?? 10));
                    }
                    restored = true;
                }
            }
        } else {
            // Restore first move that needs PP (simplified - in real game player picks)
            for (const move of target.moves) {
                if (move.currentPp < move.maxPp) {
                    if (item.effect.ppFull) {
                        move.currentPp = move.maxPp;
                    } else {
                        move.currentPp = Math.min(move.maxPp, move.currentPp + (item.effect.ppAmount ?? 10));
                    }
                    restored = true;
                    break;
                }
            }
        }
        if (restored) {
            return { success: true, message: "Les PP ont été restaurés.", consumed: true };
        } else {
            return { success: false, message: "Ça n'aura aucun effet.", consumed: false };
        }
    }

    // Default
    return { success: false, message: "Impossible d'utiliser cet objet ici.", consumed: false };
}
