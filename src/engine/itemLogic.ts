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
                message: `${result.oldName} evolue en ${result.newName} !`,
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
            return { success: false, message: "Ca n'aura aucun effet.", consumed: false };
        }
        if (target.currentHp === 0) {
            return { success: false, message: "Ce Pokemon est K.O.", consumed: false };
        }

        // Support both healAmount (standard) and healFull
        if (item.effect.healFull) {
            const oldHp = target.currentHp;
            target.currentHp = target.maxHp;
            const healed = target.currentHp - oldHp;
            return { success: true, message: `${healed} PV restaures.`, consumed: true };
        }

        const amount = item.effect.healAmount || 0;
        const oldHp = target.currentHp;
        target.currentHp = Math.min(target.maxHp, target.currentHp + amount);
        const healed = target.currentHp - oldHp;

        return { success: true, message: `${healed} PV restaures.`, consumed: true };
    }

    // Revive
    if (item.effect.type === 'revive') {
        if (target.currentHp > 0) {
            return { success: false, message: "Ce Pokemon n'est pas K.O.", consumed: false };
        }

        const percent = item.effect.reviveHpPercent || 50;
        target.currentHp = Math.floor(target.maxHp * (percent / 100));
        target.status = null;
        target.statusTurns = 0;
        target.volatile = { confusion: 0, flinch: false, leechSeed: false, bound: 0 };

        return { success: true, message: "Le Pokemon est ravive !", consumed: true };
    }

    // Status Heal
    if (item.effect.type === 'status_cure') {
        if (target.currentHp === 0) {
            return { success: false, message: "Ce Pokemon est K.O.", consumed: false };
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
            return { success: true, message: "Le statut est soigne.", consumed: true };
        } else {
            return { success: false, message: "Ca n'aura aucun effet.", consumed: false };
        }
    }

    // Default
    return { success: false, message: "Impossible d'utiliser cet objet ici.", consumed: false };
}
