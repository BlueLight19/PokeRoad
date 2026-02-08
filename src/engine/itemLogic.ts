import { PokemonInstance } from '../types/pokemon';
import { ItemData } from '../types/inventory';
import { checkStoneEvolution, evolvePokemon } from './evolutionEngine';

export interface ItemUseResult {
    success: boolean;
    message: string;
    consumed: boolean;
    newPokemonId?: number;
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

        const amount = item.effect.amount || 0;
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

        const percent = item.effect.percent || 50;
        target.currentHp = Math.floor(target.maxHp * (percent / 100));
        target.status = null;
        target.statusTurns = 0;
        target.volatile = { confusion: 0, flinch: false, leechSeed: false, bound: 0 };

        return { success: true, message: "Le Pokémon est ravivé !", consumed: true };
    }

    // Status Heal
    if (item.effect.type === 'status') {
        if (target.currentHp === 0) {
            return { success: false, message: "Ce Pokémon est K.O.", consumed: false };
        }

        const statusToRemove = item.effect.status;
        let cured = false;

        if (statusToRemove === 'all') {
            if (target.status !== null || target.volatile.confusion > 0) {
                target.status = null;
                target.statusTurns = 0;
                target.volatile.confusion = 0;
                cured = true;
            }
        } else if (statusToRemove === 'confusion') {
            if (target.volatile.confusion > 0) {
                target.volatile.confusion = 0;
                cured = true;
            }
        } else {
            if (target.status === statusToRemove) {
                target.status = null;
                target.statusTurns = 0;
                cured = true;
            }
        }

        if (cured) {
            return { success: true, message: "Le statut est soigné.", consumed: true };
        } else {
            return { success: false, message: "Ça n'aura aucun effet.", consumed: false };
        }
    }

    // Default
    return { success: false, message: "Impossible d'utiliser cet objet ici.", consumed: false };
}
