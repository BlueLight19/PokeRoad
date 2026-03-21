import { PokemonInstance, MoveData, PokemonType } from '../types/pokemon';
import { BattleLogEntry } from '../types/battle';
import { getItemData, getPokemonData, getTypeEffectiveness } from '../utils/dataLoader';

// ===== Held Item Trigger Types =====

export type HeldItemTrigger =
  | 'modify-damage'    // Modify outgoing damage (type boost, Life Orb, Choice Band calc)
  | 'after-attack'     // After dealing damage (Life Orb recoil, Shell Bell heal)
  | 'on-hit'           // When this Pokémon is hit (Rocky Helmet, Air Balloon pop, Focus Sash)
  | 'end-turn'         // End of turn (Leftovers, Black Sludge, Toxic/Flame Orb)
  | 'modify-speed'     // Speed modification (Choice Scarf, Iron Ball, Quick Claw)
  | 'modify-crit'      // Crit stage modification (Scope Lens, Razor Claw)
  | 'modify-accuracy'  // Accuracy modification (Wide Lens, Zoom Lens)
  | 'on-pinch';        // When HP drops below threshold (berries)

export interface HeldItemContext {
  pokemon: PokemonInstance;
  opponent?: PokemonInstance;
  move?: MoveData;
  damageDealt?: number;
  effectiveness?: number;      // For super-effective boost (Expert Belt)
  pokemonName: string;
  opponentName?: string;
  weather?: string | null;
}

export interface HeldItemResult {
  logs: BattleLogEntry[];
  damageMultiplier?: number;
  speedMultiplier?: number;
  critStageBonus?: number;
  accuracyMultiplier?: number;
  consumed?: boolean;          // Item was consumed (berries, Focus Sash, etc.)
  preventedKO?: boolean;       // Focus Sash / Focus Band triggered
}

// ===== Effect Handlers =====
// Each handler reads the item's effect JSON from Supabase and applies it.
// This is data-driven: the handler logic is generic, parameterized by effect fields.

type EffectHandler = (ctx: HeldItemContext, effect: Record<string, any>, itemName: string) => HeldItemResult;

const effectHandlers: Record<string, Partial<Record<HeldItemTrigger, EffectHandler>>> = {

  // ---- Type boost (Charcoal, Mystic Water, etc.) ----
  'type_boost': {
    'modify-damage': (ctx, effect) => {
      if (ctx.move?.type === effect.moveType) {
        return { logs: [], damageMultiplier: effect.value ?? 1.2 };
      }
      // Species-specific type boost (Adamant Orb, Soul Dew)
      if (effect.moveTypes && Array.isArray(effect.moveTypes) && ctx.move) {
        if (effect.pokemon) {
          const validPokemon = Array.isArray(effect.pokemon) ? effect.pokemon : [effect.pokemon];
          const pokemonName = getPokemonData(ctx.pokemon.dataId).name.toLowerCase();
          if (!validPokemon.some((p: string) => pokemonName.includes(p))) return { logs: [] };
        }
        if (effect.moveTypes.includes(ctx.move.type)) {
          return { logs: [], damageMultiplier: effect.value ?? 1.2 };
        }
      }
      return { logs: [] };
    },
  },

  // ---- Category boost (Muscle Band = physical 1.1x, Wise Glasses = special 1.1x) ----
  'category_boost': {
    'modify-damage': (ctx, effect) => {
      if (ctx.move?.category === effect.category) {
        return { logs: [], damageMultiplier: effect.value ?? 1.1 };
      }
      return { logs: [] };
    },
  },

  // ---- Damage boost with recoil (Life Orb) ----
  'damage_boost': {
    'modify-damage': (_ctx, effect) => {
      return { logs: [], damageMultiplier: effect.value ?? 1.3 };
    },
    'after-attack': (ctx, effect) => {
      if (!ctx.damageDealt || ctx.damageDealt <= 0) return { logs: [] };
      const recoilFraction = effect.recoil ?? 0.1;
      const recoilDmg = Math.max(1, Math.floor(ctx.pokemon.maxHp * recoilFraction));
      ctx.pokemon.currentHp = Math.max(0, ctx.pokemon.currentHp - recoilDmg);
      return { logs: [{ message: `${ctx.pokemonName} perd des PV à cause de son Orbe Vie !`, type: 'status' as const }] };
    },
  },

  // ---- Super-effective boost (Expert Belt) ----
  'super_effective_boost': {
    'modify-damage': (ctx, effect) => {
      if (ctx.effectiveness && ctx.effectiveness > 1) {
        return { logs: [], damageMultiplier: effect.value ?? 1.2 };
      }
      return { logs: [] };
    },
  },

  // ---- Stat multiply (Choice Band/Specs/Scarf, Assault Vest, Eviolite, Light Ball, Thick Club) ----
  'stat_multiply': {
    'modify-damage': (ctx, effect) => {
      // Choice Band: 1.5x attack (physical moves only)
      // Choice Specs: 1.5x sp_atk (special moves only)
      if (effect.stat === 'attack' && ctx.move?.category === 'physical') {
        return { logs: [], damageMultiplier: effect.value ?? 1.5 };
      }
      if (effect.stat === 'sp_atk' && ctx.move?.category === 'special') {
        return { logs: [], damageMultiplier: effect.value ?? 1.5 };
      }
      // Species-specific stat multiply (Light Ball doubles both for Pikachu)
      if (effect.pokemon) {
        const validPokemon = Array.isArray(effect.pokemon) ? effect.pokemon : [effect.pokemon];
        const pokemonName = getPokemonData(ctx.pokemon.dataId).name.toLowerCase();
        if (!validPokemon.some((p: string) => pokemonName.includes(p))) return { logs: [] };
        if (Array.isArray(effect.stat)) {
          if (ctx.move?.category === 'physical' && effect.stat.includes('attack')) {
            return { logs: [], damageMultiplier: effect.value ?? 2 };
          }
          if (ctx.move?.category === 'special' && effect.stat.includes('sp_atk')) {
            return { logs: [], damageMultiplier: effect.value ?? 2 };
          }
        }
      }
      return { logs: [] };
    },
    'modify-speed': (_ctx, effect) => {
      if (effect.stat === 'speed') {
        return { logs: [], speedMultiplier: effect.value ?? 1.5 };
      }
      return { logs: [] };
    },
  },

  // ---- End-of-turn heal (Leftovers) ----
  'end_turn_heal': {
    'end-turn': (ctx, effect, itemName) => {
      if (ctx.pokemon.currentHp <= 0 || ctx.pokemon.currentHp >= ctx.pokemon.maxHp) return { logs: [] };
      const healAmount = Math.max(1, Math.floor(ctx.pokemon.maxHp * (effect.value ?? 0.0625)));
      const actual = Math.min(healAmount, ctx.pokemon.maxHp - ctx.pokemon.currentHp);
      ctx.pokemon.currentHp += actual;
      return { logs: [{ message: `${ctx.pokemonName} récupère des PV grâce à ${itemName} ! (+${actual} PV)`, type: 'heal' as const }] };
    },
  },

  // ---- End-turn heal OR damage (Black Sludge: heals Poison types, damages others) ----
  'end_turn_heal_or_damage': {
    'end-turn': (ctx, effect, itemName) => {
      if (ctx.pokemon.currentHp <= 0) return { logs: [] };
      const pokemonData = getPokemonData(ctx.pokemon.dataId);
      if (pokemonData.types.includes(effect.healType ?? 'poison')) {
        if (ctx.pokemon.currentHp >= ctx.pokemon.maxHp) return { logs: [] };
        const heal = Math.max(1, Math.floor(ctx.pokemon.maxHp * (effect.healValue ?? 0.0625)));
        const actual = Math.min(heal, ctx.pokemon.maxHp - ctx.pokemon.currentHp);
        ctx.pokemon.currentHp += actual;
        return { logs: [{ message: `${ctx.pokemonName} récupère des PV grâce à ${itemName} ! (+${actual} PV)`, type: 'heal' as const }] };
      } else {
        const dmg = Math.max(1, Math.floor(ctx.pokemon.maxHp * (effect.damageValue ?? 0.125)));
        ctx.pokemon.currentHp = Math.max(0, ctx.pokemon.currentHp - dmg);
        return { logs: [{ message: `${ctx.pokemonName} perd des PV à cause de ${itemName} ! (-${dmg} PV)`, type: 'status' as const }] };
      }
    },
  },

  // ---- End-turn damage (Sticky Barb) ----
  'end_turn_damage': {
    'end-turn': (ctx, effect, itemName) => {
      if (ctx.pokemon.currentHp <= 0) return { logs: [] };
      const dmg = Math.max(1, Math.floor(ctx.pokemon.maxHp * (effect.value ?? 0.125)));
      ctx.pokemon.currentHp = Math.max(0, ctx.pokemon.currentHp - dmg);
      return { logs: [{ message: `${ctx.pokemonName} est blessé par ${itemName} ! (-${dmg} PV)`, type: 'status' as const }] };
    },
  },

  // ---- Inflict status at end of turn (Flame Orb → burn, Toxic Orb → toxic) ----
  'inflict_status': {
    'end-turn': (ctx, effect, itemName) => {
      if (ctx.pokemon.currentHp <= 0 || ctx.pokemon.status !== null) return { logs: [] };
      const status = effect.status === 'badly_poisoned' ? 'toxic' : effect.status;
      ctx.pokemon.status = status;
      ctx.pokemon.statusTurns = 0;
      const statusNames: Record<string, string> = {
        burn: 'brûlé', toxic: 'gravement empoisonné', poison: 'empoisonné',
        paralysis: 'paralysé', sleep: 'endormi',
      };
      return { logs: [{ message: `${ctx.pokemonName} est ${statusNames[status] ?? status} par ${itemName} !`, type: 'status' as const }] };
    },
  },

  // ---- Survive OHKO (Focus Sash: from full HP, consumable; Focus Band: 10% chance, not consumed) ----
  'survive_ohko': {
    'on-hit': (ctx, effect, itemName) => {
      // This is checked inline during damage application, not via trigger
      // The handler just returns the result for the engine to use
      if (effect.condition === 'full_hp' && ctx.pokemon.currentHp < ctx.pokemon.maxHp) {
        return { logs: [] }; // Focus Sash only works at full HP
      }
      if (effect.chance && Math.random() >= effect.chance) {
        return { logs: [] }; // Focus Band: 10% chance
      }
      return {
        logs: [{ message: `${ctx.pokemonName} tient bon grâce à ${itemName} !`, type: 'info' as const }],
        preventedKO: true,
        consumed: effect.consumable ?? true,
      };
    },
  },

  // ---- Type immunity (Air Balloon = Ground immunity, consumed on hit) ----
  'type_immunity': {
    'on-hit': (ctx, effect, itemName) => {
      if (ctx.move?.type === effect.immuneType) {
        return {
          logs: [{ message: `${ctx.pokemonName} évite l'attaque grâce à ${itemName} !`, type: 'info' as const }],
          consumed: effect.consumable ?? true,
        };
      }
      return { logs: [] };
    },
  },

  // ---- Contact damage (Rocky Helmet: 1/6 HP to attacker on contact) ----
  'contact_damage': {
    'on-hit': (ctx, effect, itemName) => {
      if (!ctx.move || ctx.move.category !== 'physical' || !ctx.opponent) return { logs: [] };
      const dmg = Math.max(1, Math.floor(ctx.opponent.maxHp * (effect.value ?? 0.1667)));
      ctx.opponent.currentHp = Math.max(0, ctx.opponent.currentHp - dmg);
      const oppName = ctx.opponentName ?? 'l\'adversaire';
      return { logs: [{ message: `${oppName} est blessé par ${itemName} ! (-${dmg} PV)`, type: 'status' as const }] };
    },
  },

  // ---- Drain heal (Shell Bell: heal 1/8 of damage dealt) ----
  'drain_heal': {
    'after-attack': (ctx, effect, itemName) => {
      if (!ctx.damageDealt || ctx.damageDealt <= 0) return { logs: [] };
      if (ctx.pokemon.currentHp <= 0 || ctx.pokemon.currentHp >= ctx.pokemon.maxHp) return { logs: [] };
      const heal = Math.max(1, Math.floor(ctx.damageDealt * (effect.value ?? 0.125)));
      const actual = Math.min(heal, ctx.pokemon.maxHp - ctx.pokemon.currentHp);
      ctx.pokemon.currentHp += actual;
      return { logs: [{ message: `${ctx.pokemonName} récupère des PV grâce à ${itemName} ! (+${actual} PV)`, type: 'heal' as const }] };
    },
  },

  // ---- Crit boost (Scope Lens, Razor Claw: +1 crit stage) ----
  'crit_boost': {
    'modify-crit': (_ctx, effect) => {
      return { logs: [], critStageBonus: effect.stages ?? 1 };
    },
  },

  // ---- Accuracy boost (Wide Lens: 1.1x, Zoom Lens: 1.2x if moving last) ----
  'accuracy_boost': {
    'modify-accuracy': (_ctx, effect) => {
      // Zoom Lens condition (move_last) is simplified — always apply
      return { logs: [], accuracyMultiplier: effect.value ?? 1.1 };
    },
  },

  // ---- Flinch chance (King's Rock, Razor Fang: 10% flinch on hit) ----
  'flinch_chance': {
    'after-attack': (ctx, effect) => {
      if (!ctx.opponent || ctx.opponent.currentHp <= 0) return { logs: [] };
      if (!ctx.damageDealt || ctx.damageDealt <= 0) return { logs: [] };
      if (Math.random() < (effect.value ?? 0.1)) {
        ctx.opponent.volatile.flinch = true;
        return { logs: [] }; // Silent — flinch message shown when they try to move
      }
      return { logs: [] };
    },
  },

  // ---- Pinch heal (Figy Berry, etc.: heal 33% HP when below 25%) ----
  'pinch_heal': {
    'on-pinch': (ctx, effect, itemName) => {
      const threshold = effect.threshold ?? 0.25;
      if (ctx.pokemon.currentHp > ctx.pokemon.maxHp * threshold) return { logs: [] };
      if (ctx.pokemon.currentHp <= 0) return { logs: [] };
      const healAmount = Math.max(1, Math.floor(ctx.pokemon.maxHp * (effect.value ?? 0.33)));
      const actual = Math.min(healAmount, ctx.pokemon.maxHp - ctx.pokemon.currentHp);
      ctx.pokemon.currentHp += actual;
      return {
        logs: [{ message: `${ctx.pokemonName} mange sa ${itemName} et récupère ${actual} PV !`, type: 'heal' as const }],
        consumed: true,
      };
    },
  },

  // ---- Pinch stat boost (Liechi Berry = +1 Atk at 25% HP, etc.) ----
  'pinch_stat_boost': {
    'on-pinch': (ctx, effect, itemName) => {
      const threshold = effect.threshold ?? 0.25;
      if (ctx.pokemon.currentHp > ctx.pokemon.maxHp * threshold) return { logs: [] };
      if (ctx.pokemon.currentHp <= 0) return { logs: [] };
      const stat = effect.stat as string;
      const stages = effect.stages ?? 1;
      if (stat === 'crit' || stat === 'priority' || stat === 'accuracy' || stat === 'random') {
        // Simplified: these niche effects just log
        return {
          logs: [{ message: `${ctx.pokemonName} mange sa ${itemName} !`, type: 'info' as const }],
          consumed: true,
        };
      }
      const statKey = stat === 'sp_atk' ? 'spAtk' : stat === 'sp_def' ? 'spDef' : stat;
      if (statKey in ctx.pokemon.statStages) {
        const current = ctx.pokemon.statStages[statKey as keyof typeof ctx.pokemon.statStages];
        if (current < 6) {
          ctx.pokemon.statStages[statKey as keyof typeof ctx.pokemon.statStages] =
            Math.min(6, current + stages) as number;
          const statNames: Record<string, string> = {
            attack: 'Attaque', defense: 'Défense', spAtk: 'Attaque Spé.',
            spDef: 'Défense Spé.', speed: 'Vitesse',
          };
          return {
            logs: [{ message: `${ctx.pokemonName} mange sa ${itemName} ! ${statNames[statKey] || statKey} monte !`, type: 'info' as const }],
            consumed: true,
          };
        }
      }
      return { logs: [] };
    },
  },

  // ---- Drain boost (Big Root: 1.3x drain/leech heal) ----
  'drain_boost': {
    'modify-damage': () => {
      // Handled in moveEffects drain handler — flag only
      return { logs: [] };
    },
  },

  // ---- Move last (Lagging Tail, Full Incense) ----
  'move_last': {
    'modify-speed': () => {
      return { logs: [], speedMultiplier: 0 }; // Speed effectively 0 = always last
    },
  },

  // ---- Speed halve (Iron Ball) ----
  'speed_halve': {
    'modify-speed': () => {
      return { logs: [], speedMultiplier: 0.5 };
    },
  },

  // ---- Priority chance (Quick Claw: 20% chance to go first) ----
  'priority_chance': {
    'modify-speed': (_ctx, effect) => {
      if (Math.random() < (effect.chance ?? 0.2)) {
        return { logs: [{ message: `Vive Griffe permet d'agir en premier !`, type: 'info' as const }], speedMultiplier: 99999 };
      }
      return { logs: [] };
    },
  },

  // ---- Guarantee flee (Smoke Ball) ----
  'guarantee_flee': {},

  // ---- Skip charge turn (Power Herb) ----
  'skip_charge_turn': {},

  // ---- Extend screens (Light Clay: 8 turns instead of 5) ----
  'extend_screens': {},

  // ---- Extend weather rocks ----
  'extend_weather': {},

  // ---- Immunity to entry hazards (Heavy-Duty Boots) ----
  // Handled inline in applyEntryHazards

  // ---- Evasion boost (Bright Powder, Lax Incense) — simplified no-op ----
  'evasion_boost': {},

  // ---- Weight halve (Float Stone) — niche, no-op ----
  'weight_halve': {},

  // ---- Misc no-ops for items with out-of-battle or niche effects ----
  'guarantee_switch': {},
  'transfer_infatuation': {},
  'form_change': {},
  'consecutive_use_boost': {},
  'multi_hit_boost': {},
  'trap_damage_boost': {},
  'copy_stat_boosts': {},
  'clear_stat_drops': {},
  'cure_mental': {},
  'on_type_hit': {},
  'on_sound_move': {},
  'on_trick_room': {},
  'on_terrain': {},
  'on_move_miss': {},
  'on_intimidate': {},
  'force_switch_self': {},
  'force_switch_opponent': {},
  'activate_paradox_ability': {},
  'weather_ignore': {},
  'lose_type_immunities': {},
  'miracle_shooter': {},
  'money_double': {},
  'punch_boost': {},
};

// ===== Public API =====

/**
 * Trigger a held item effect. Returns empty result if no item or no handler.
 */
export function triggerHeldItem(
  pokemon: PokemonInstance,
  trigger: HeldItemTrigger,
  ctx: Omit<HeldItemContext, 'pokemon' | 'pokemonName'>
): HeldItemResult {
  if (!pokemon.heldItem) return { logs: [] };

  const item = getItemData(pokemon.heldItem);
  if (!item?.effect) return { logs: [] };

  const effect = item.effect as Record<string, any>;
  const effectType = effect.effect as string;
  if (!effectType) return { logs: [] };

  const handlers = effectHandlers[effectType];
  if (!handlers) return { logs: [] };

  const handler = handlers[trigger];
  if (!handler) return { logs: [] };

  const pokemonName = pokemon.nickname || getPokemonData(pokemon.dataId).name;
  const fullCtx: HeldItemContext = { ...ctx, pokemon, pokemonName };

  const result = handler(fullCtx, effect, item.name);

  // Auto-consume the item if the handler flagged it
  if (result.consumed) {
    pokemon.heldItem = null;
  }

  return result;
}

/**
 * Check if a held item prevents entry hazards (Heavy-Duty Boots).
 */
export function heldItemBlocksHazards(pokemon: PokemonInstance): boolean {
  if (!pokemon.heldItem) return false;
  const item = getItemData(pokemon.heldItem);
  const effect = item?.effect as Record<string, any> | undefined;
  return effect?.effect === 'immunity' && Array.isArray(effect.targets) && effect.targets.includes('entry_hazards');
}

/**
 * Check if a held item blocks secondary effects (Covert Cloak).
 */
export function heldItemBlocksSecondary(pokemon: PokemonInstance): boolean {
  if (!pokemon.heldItem) return false;
  const item = getItemData(pokemon.heldItem);
  const effect = item?.effect as Record<string, any> | undefined;
  return effect?.effect === 'immunity' && Array.isArray(effect.targets) && effect.targets.includes('secondary_effects');
}

/**
 * Check if held item is a Choice item (locks move).
 */
export function isChoiceItem(itemId: string | null): boolean {
  return itemId === 'choice-band' || itemId === 'choice-specs' || itemId === 'choice-scarf';
}

/**
 * Check if held item blocks status moves (Assault Vest).
 */
export function isAssaultVest(itemId: string | null): boolean {
  return itemId === 'assault-vest';
}
