import { PokemonInstance, PokemonType, MoveData } from '../types/pokemon';
import { BattleLogEntry } from '../types/battle';
import { getPokemonData } from '../utils/dataLoader';

// ===== Ability Trigger Types =====

export type AbilityTrigger =
  | 'switch-in'       // When this Pokémon enters the field
  | 'before-move'     // Before the opponent's move hits (immunities, absorb)
  | 'after-hit'       // After this Pokémon is hit by an attack (contact abilities)
  | 'on-status'       // When a status is about to be applied
  | 'on-stat-drop'    // When a stat drop is about to happen
  | 'end-turn'        // End of turn effects
  | 'switch-out'      // When this Pokémon leaves the field
  | 'modify-damage'   // Modify outgoing or incoming damage multiplier
  | 'modify-speed';   // Modify speed calculation

export interface AbilityContext {
  pokemon: PokemonInstance;       // The Pokémon with this ability
  opponent?: PokemonInstance;     // The opposing Pokémon
  trigger: AbilityTrigger;
  move?: MoveData;               // The move being used (if relevant)
  damageAmount?: number;          // Damage dealt (for after-hit)
  statusToApply?: string;         // Status being applied (for on-status)
  statDrop?: { stat: string; stages: number }; // Stat drop (for on-stat-drop)
  weather?: string | null;        // Current weather (for speed/damage mods)
  pokemonName: string;
  opponentName?: string;
}

export interface AbilityResult {
  logs: BattleLogEntry[];
  prevented?: boolean;            // For on-status/on-stat-drop: was the effect blocked?
  damageMultiplier?: number;      // For modify-damage: multiply damage by this
  speedMultiplier?: number;       // For modify-speed: multiply speed by this
  healed?: number;                // HP healed (for absorb abilities)
}

export type AbilityHandler = (ctx: AbilityContext) => AbilityResult;

// ===== Ability Registry =====

const abilityHandlers: Record<string, Partial<Record<AbilityTrigger, AbilityHandler>>> = {

  // ===== Switch-in Abilities =====

  'intimidate': {
    'switch-in': (ctx) => {
      if (!ctx.opponent || ctx.opponent.currentHp <= 0) return { logs: [] };
      const opp = ctx.opponent;
      const oppName = ctx.opponentName || 'l\'adversaire';
      if (opp.volatile.mistTurns > 0) {
        return { logs: [{ message: `La Brume protège ${oppName} de Intimidation !`, type: 'info' }] };
      }
      const current = opp.statStages.attack;
      if (current <= -6) {
        return { logs: [{ message: `L'Attaque de ${oppName} ne peut pas baisser plus !`, type: 'info' }] };
      }
      opp.statStages.attack = Math.max(-6, current - 1);
      return { logs: [{ message: `${ctx.pokemonName} intimide ${oppName} ! L'Attaque baisse !`, type: 'info' }] };
    },
  },

  'drizzle': {
    'switch-in': (ctx) => {
      return { logs: [{ message: `${ctx.pokemonName} déclenche la pluie !`, type: 'info' }] };
    },
  },

  'drought': {
    'switch-in': (ctx) => {
      return { logs: [{ message: `${ctx.pokemonName} déclenche le soleil !`, type: 'info' }] };
    },
  },

  'sand-stream': {
    'switch-in': (ctx) => {
      return { logs: [{ message: `${ctx.pokemonName} déclenche une tempête de sable !`, type: 'info' }] };
    },
  },

  // ===== Immunity / Absorb Abilities (before-move) =====

  'levitate': {
    'before-move': (ctx) => {
      if (ctx.move?.type === 'ground') {
        return {
          logs: [{ message: `${ctx.pokemonName} lévite et évite l'attaque !`, type: 'info' }],
          prevented: true,
        };
      }
      return { logs: [] };
    },
  },

  'flash-fire': {
    'before-move': (ctx) => {
      if (ctx.move?.type === 'fire') {
        return {
          logs: [{ message: `${ctx.pokemonName} absorbe le feu ! Sa puissance de Feu augmente !`, type: 'info' }],
          prevented: true,
        };
      }
      return { logs: [] };
    },
  },

  'water-absorb': {
    'before-move': (ctx) => {
      if (ctx.move?.type === 'water') {
        const heal = Math.max(1, Math.floor(ctx.pokemon.maxHp / 4));
        const actual = Math.min(heal, ctx.pokemon.maxHp - ctx.pokemon.currentHp);
        ctx.pokemon.currentHp = Math.min(ctx.pokemon.maxHp, ctx.pokemon.currentHp + heal);
        return {
          logs: [{ message: `${ctx.pokemonName} absorbe l'eau ! (+${actual} PV)`, type: 'info' }],
          prevented: true,
          healed: actual,
        };
      }
      return { logs: [] };
    },
  },

  'volt-absorb': {
    'before-move': (ctx) => {
      if (ctx.move?.type === 'electric') {
        const heal = Math.max(1, Math.floor(ctx.pokemon.maxHp / 4));
        const actual = Math.min(heal, ctx.pokemon.maxHp - ctx.pokemon.currentHp);
        ctx.pokemon.currentHp = Math.min(ctx.pokemon.maxHp, ctx.pokemon.currentHp + heal);
        return {
          logs: [{ message: `${ctx.pokemonName} absorbe l'électricité ! (+${actual} PV)`, type: 'info' }],
          prevented: true,
          healed: actual,
        };
      }
      return { logs: [] };
    },
  },

  'lightning-rod': {
    'before-move': (ctx) => {
      if (ctx.move?.type === 'electric') {
        const current = ctx.pokemon.statStages.spAtk;
        if (current < 6) ctx.pokemon.statStages.spAtk = Math.min(6, current + 1);
        return {
          logs: [{ message: `${ctx.pokemonName} attire l'électricité ! Attaque Spé. monte !`, type: 'info' }],
          prevented: true,
        };
      }
      return { logs: [] };
    },
  },

  'dry-skin': {
    'before-move': (ctx) => {
      if (ctx.move?.type === 'water') {
        const heal = Math.max(1, Math.floor(ctx.pokemon.maxHp / 4));
        ctx.pokemon.currentHp = Math.min(ctx.pokemon.maxHp, ctx.pokemon.currentHp + heal);
        return {
          logs: [{ message: `${ctx.pokemonName} absorbe l'eau !`, type: 'info' }],
          prevented: true,
        };
      }
      return { logs: [] };
    },
    'modify-damage': (ctx) => {
      if (ctx.move?.type === 'fire') {
        return { logs: [], damageMultiplier: 1.25 };
      }
      return { logs: [] };
    },
  },

  // ===== Damage Modification Abilities =====

  'thick-fat': {
    'modify-damage': (ctx) => {
      if (ctx.move?.type === 'fire' || ctx.move?.type === 'ice') {
        return { logs: [], damageMultiplier: 0.5 };
      }
      return { logs: [] };
    },
  },

  'filter': {
    'modify-damage': (ctx) => {
      // Reduce super-effective damage
      return { logs: [], damageMultiplier: 0.75 };
    },
  },

  'solid-rock': {
    'modify-damage': (ctx) => {
      return { logs: [], damageMultiplier: 0.75 };
    },
  },

  // Offensive damage modifiers
  'adaptability': {
    'modify-damage': (ctx) => {
      // STAB becomes 2x instead of 1.5x — return multiplier of 2/1.5
      if (ctx.move) {
        const atkData = getPokemonData(ctx.pokemon.dataId);
        if (atkData.types.includes(ctx.move.type)) {
          return { logs: [], damageMultiplier: 2 / 1.5 };
        }
      }
      return { logs: [] };
    },
  },

  'technician': {
    'modify-damage': (ctx) => {
      if (ctx.move?.power && ctx.move.power <= 60) {
        return { logs: [], damageMultiplier: 1.5 };
      }
      return { logs: [] };
    },
  },

  'reckless': {
    'modify-damage': (ctx) => {
      if (ctx.move?.effect?.type === 'recoil' || ctx.move?.effect?.type === 'recoil_crash') {
        return { logs: [], damageMultiplier: 1.2 };
      }
      return { logs: [] };
    },
  },

  'sheer-force': {
    'modify-damage': (ctx) => {
      // Boost moves with secondary effects by 1.3x (status, flinch, stat)
      if (ctx.move?.effect && ['status', 'flinch', 'stat'].includes(ctx.move.effect.type) && ctx.move.effect.chance && ctx.move.effect.chance < 100) {
        return { logs: [], damageMultiplier: 1.3 };
      }
      return { logs: [] };
    },
  },

  'pure-power': {
    'modify-damage': (ctx) => {
      if (ctx.move?.category === 'physical') {
        return { logs: [], damageMultiplier: 2 };
      }
      return { logs: [] };
    },
  },

  'huge-power': {
    'modify-damage': (ctx) => {
      if (ctx.move?.category === 'physical') {
        return { logs: [], damageMultiplier: 2 };
      }
      return { logs: [] };
    },
  },

  'sniper': {
    'modify-damage': (_ctx) => {
      // Sniper 1.5x on crits is handled in damageCalculator after crit multiplier
      return { logs: [] };
    },
  },

  // ===== Contact Abilities (after-hit) =====

  'static': {
    'after-hit': (ctx) => {
      if (!ctx.opponent || ctx.opponent.currentHp <= 0) return { logs: [] };
      if (!ctx.move || ctx.move.category === 'status') return { logs: [] };
      // Only on contact (physical moves as proxy)
      if (ctx.move.category !== 'physical') return { logs: [] };
      if (ctx.opponent.status !== null) return { logs: [] };
      const oppData = getPokemonData(ctx.opponent.dataId);
      if (oppData.types.includes('electric')) return { logs: [] };
      if (Math.random() < 0.3) {
        ctx.opponent.status = 'paralysis';
        const oppName = ctx.opponentName || 'l\'adversaire';
        return { logs: [{ message: `${oppName} est paralysé par Statik !`, type: 'status' }] };
      }
      return { logs: [] };
    },
  },

  'flame-body': {
    'after-hit': (ctx) => {
      if (!ctx.opponent || ctx.opponent.currentHp <= 0) return { logs: [] };
      if (!ctx.move || ctx.move.category !== 'physical') return { logs: [] };
      if (ctx.opponent.status !== null) return { logs: [] };
      const oppData = getPokemonData(ctx.opponent.dataId);
      if (oppData.types.includes('fire')) return { logs: [] };
      if (Math.random() < 0.3) {
        ctx.opponent.status = 'burn';
        const oppName = ctx.opponentName || 'l\'adversaire';
        return { logs: [{ message: `${oppName} est brûlé par Corps Ardent !`, type: 'status' }] };
      }
      return { logs: [] };
    },
  },

  'poison-point': {
    'after-hit': (ctx) => {
      if (!ctx.opponent || ctx.opponent.currentHp <= 0) return { logs: [] };
      if (!ctx.move || ctx.move.category !== 'physical') return { logs: [] };
      if (ctx.opponent.status !== null) return { logs: [] };
      const oppData = getPokemonData(ctx.opponent.dataId);
      if (oppData.types.includes('poison') || oppData.types.includes('steel')) return { logs: [] };
      if (Math.random() < 0.3) {
        ctx.opponent.status = 'poison';
        const oppName = ctx.opponentName || 'l\'adversaire';
        return { logs: [{ message: `${oppName} est empoisonné par Point Poison !`, type: 'status' }] };
      }
      return { logs: [] };
    },
  },

  'cute-charm': {
    'after-hit': (ctx) => {
      // Simplified: no attraction mechanic, just log
      return { logs: [] };
    },
  },

  'effect-spore': {
    'after-hit': (ctx) => {
      if (!ctx.opponent || ctx.opponent.currentHp <= 0) return { logs: [] };
      if (!ctx.move || ctx.move.category !== 'physical') return { logs: [] };
      if (ctx.opponent.status !== null) return { logs: [] };
      if (Math.random() < 0.3) {
        const roll = Math.random();
        const oppName = ctx.opponentName || 'l\'adversaire';
        const oppData = getPokemonData(ctx.opponent.dataId);
        if (roll < 0.33) {
          if (!oppData.types.includes('poison') && !oppData.types.includes('steel')) {
            ctx.opponent.status = 'poison';
            return { logs: [{ message: `${oppName} est empoisonné par Pose Spore !`, type: 'status' }] };
          }
        } else if (roll < 0.66) {
          ctx.opponent.status = 'paralysis';
          return { logs: [{ message: `${oppName} est paralysé par Pose Spore !`, type: 'status' }] };
        } else {
          ctx.opponent.status = 'sleep';
          ctx.opponent.statusTurns = 1 + Math.floor(Math.random() * 3);
          return { logs: [{ message: `${oppName} est endormi par Pose Spore !`, type: 'status' }] };
        }
      }
      return { logs: [] };
    },
  },

  'anger-point': {
    'after-hit': (ctx) => {
      // Triggered by critical hit → max attack. Check is done externally.
      return { logs: [] };
    },
  },

  // ===== Status Blocking Abilities =====

  'immunity': {
    'on-status': (ctx) => {
      if (ctx.statusToApply === 'poison' || ctx.statusToApply === 'toxic') {
        return { logs: [{ message: `Immunité protège ${ctx.pokemonName} !`, type: 'info' }], prevented: true };
      }
      return { logs: [] };
    },
  },

  'insomnia': {
    'on-status': (ctx) => {
      if (ctx.statusToApply === 'sleep') {
        return { logs: [{ message: `Insomnia protège ${ctx.pokemonName} !`, type: 'info' }], prevented: true };
      }
      return { logs: [] };
    },
  },

  'vital-spirit': {
    'on-status': (ctx) => {
      if (ctx.statusToApply === 'sleep') {
        return { logs: [{ message: `Esprit Vital protège ${ctx.pokemonName} !`, type: 'info' }], prevented: true };
      }
      return { logs: [] };
    },
  },

  'limber': {
    'on-status': (ctx) => {
      if (ctx.statusToApply === 'paralysis') {
        return { logs: [{ message: `Échauffement protège ${ctx.pokemonName} !`, type: 'info' }], prevented: true };
      }
      return { logs: [] };
    },
  },

  'water-veil': {
    'on-status': (ctx) => {
      if (ctx.statusToApply === 'burn') {
        return { logs: [{ message: `Voile d'Eau protège ${ctx.pokemonName} !`, type: 'info' }], prevented: true };
      }
      return { logs: [] };
    },
  },

  'oblivious': {
    // Prevents infatuation (not implemented) — no-op
    'on-status': (_ctx) => ({ logs: [] }),
  },

  // ===== Stat Drop Blocking =====

  'clear-body': {
    'on-stat-drop': (ctx) => {
      return { logs: [{ message: `Corps Sain protège ${ctx.pokemonName} !`, type: 'info' }], prevented: true };
    },
  },

  'hyper-cutter': {
    'on-stat-drop': (ctx) => {
      if (ctx.statDrop?.stat === 'attack') {
        return { logs: [{ message: `Hyper Cutter protège l'Attaque de ${ctx.pokemonName} !`, type: 'info' }], prevented: true };
      }
      return { logs: [] };
    },
  },

  'keen-eye': {
    'on-stat-drop': (ctx) => {
      if (ctx.statDrop?.stat === 'accuracy') {
        return { logs: [{ message: `Regard Vif protège la Précision de ${ctx.pokemonName} !`, type: 'info' }], prevented: true };
      }
      return { logs: [] };
    },
  },

  // ===== End-of-Turn Abilities =====

  'shed-skin': {
    'end-turn': (ctx) => {
      if (ctx.pokemon.status && Math.random() < 0.3) {
        ctx.pokemon.status = null;
        ctx.pokemon.statusTurns = 0;
        return { logs: [{ message: `${ctx.pokemonName} guérit grâce à Mue !`, type: 'info' }] };
      }
      return { logs: [] };
    },
  },

  'pressure': {
    'switch-in': (ctx) => {
      return { logs: [{ message: `${ctx.pokemonName} exerce une Pression !`, type: 'info' }] };
    },
  },

  // ===== Switch-out Abilities =====

  'natural-cure': {
    'switch-out': (ctx) => {
      if (ctx.pokemon.status) {
        ctx.pokemon.status = null;
        ctx.pokemon.statusTurns = 0;
        return { logs: [{ message: `${ctx.pokemonName} guérit grâce à Médic Nature !`, type: 'info' }] };
      }
      return { logs: [] };
    },
  },

  'regenerator': {
    'switch-out': (ctx) => {
      const heal = Math.floor(ctx.pokemon.maxHp / 3);
      ctx.pokemon.currentHp = Math.min(ctx.pokemon.maxHp, ctx.pokemon.currentHp + heal);
      return { logs: [] }; // Silent heal
    },
  },

  // ===== Speed Modification =====

  'swift-swim': {
    'modify-speed': (ctx) => {
      if (ctx.weather === 'rain') return { logs: [], speedMultiplier: 2 };
      return { logs: [] };
    },
  },

  'chlorophyll': {
    'modify-speed': (ctx) => {
      if (ctx.weather === 'sun') return { logs: [], speedMultiplier: 2 };
      return { logs: [] };
    },
  },

  'sand-rush': {
    'modify-speed': (ctx) => {
      if (ctx.weather === 'sandstorm') return { logs: [], speedMultiplier: 2 };
      return { logs: [] };
    },
  },

  'sand-veil': {
    // Raises evasion in sandstorm — simplified as no-op (evasion mods complex)
    'modify-speed': (_ctx) => ({ logs: [] }),
  },

  // ===== Misc Abilities (simplified/no-op) =====

  'overgrow': {
    'modify-damage': (ctx) => {
      if (ctx.move?.type === 'grass' && ctx.pokemon.currentHp <= ctx.pokemon.maxHp / 3) {
        return { logs: [], damageMultiplier: 1.5 };
      }
      return { logs: [] };
    },
  },

  'blaze': {
    'modify-damage': (ctx) => {
      if (ctx.move?.type === 'fire' && ctx.pokemon.currentHp <= ctx.pokemon.maxHp / 3) {
        return { logs: [], damageMultiplier: 1.5 };
      }
      return { logs: [] };
    },
  },

  'torrent': {
    'modify-damage': (ctx) => {
      if (ctx.move?.type === 'water' && ctx.pokemon.currentHp <= ctx.pokemon.maxHp / 3) {
        return { logs: [], damageMultiplier: 1.5 };
      }
      return { logs: [] };
    },
  },

  'swarm': {
    'modify-damage': (ctx) => {
      if (ctx.move?.type === 'bug' && ctx.pokemon.currentHp <= ctx.pokemon.maxHp / 3) {
        return { logs: [], damageMultiplier: 1.5 };
      }
      return { logs: [] };
    },
  },

  'guts': {
    'modify-damage': (ctx) => {
      if (ctx.pokemon.status && ctx.move?.category === 'physical') {
        return { logs: [], damageMultiplier: 1.5 };
      }
      return { logs: [] };
    },
  },

  'iron-fist': {
    'modify-damage': (ctx) => {
      // Boosts punch moves — simplified: check move name contains "punch/poing"
      if (ctx.move) {
        const name = ctx.move.name.toLowerCase();
        if (name.includes('poing') || name.includes('punch') || name.includes('mach') || name.includes('uppercut')) {
          return { logs: [], damageMultiplier: 1.2 };
        }
      }
      return { logs: [] };
    },
  },

  'skill-link': {
    // Multi-hit moves always hit max times — handled in battleEngine
    'modify-damage': (_ctx) => ({ logs: [] }),
  },

  'compound-eyes': {
    // +30% accuracy — handled in executeMove accuracy check
    'modify-damage': (_ctx) => ({ logs: [] }),
  },

  'no-guard': {
    // All moves hit — handled in executeMove accuracy check
    'modify-damage': (_ctx) => ({ logs: [] }),
  },

  'sturdy': {
    // Survives OHKO with 1 HP from full — handled in damage application
    'modify-damage': (_ctx) => ({ logs: [] }),
  },

  'rock-head': {
    // No recoil damage — handled in recoil effect
    'modify-damage': (_ctx) => ({ logs: [] }),
  },

  'shell-armor': {
    // Prevents critical hits — handled in damageCalculator
    'modify-damage': (_ctx) => ({ logs: [] }),
  },

  'battle-armor': {
    // Prevents critical hits — handled in damageCalculator
    'modify-damage': (_ctx) => ({ logs: [] }),
  },

  'mold-breaker': {
    'switch-in': (ctx) => {
      return { logs: [{ message: `${ctx.pokemonName} brise le moule !`, type: 'info' }] };
    },
  },

  // ===== Synchronize: copy status back to attacker =====
  'synchronize': {
    'on-status': (ctx) => {
      // Synchronize doesn't prevent the status — it copies it to the opponent
      // We set a flag; the actual copy happens after status is applied (in battleEngine)
      return { logs: [] };
    },
  },

  // ===== Trace: copy opponent's ability on switch-in =====
  'trace': {
    'switch-in': (ctx) => {
      if (!ctx.opponent || ctx.opponent.currentHp <= 0) return { logs: [] };
      const oppAbility = ctx.opponent.ability;
      if (!oppAbility || oppAbility === 'trace' || oppAbility === 'imposter') return { logs: [] };
      ctx.pokemon.ability = oppAbility;
      const oppName = ctx.opponentName || 'l\'adversaire';
      return { logs: [{ message: `${ctx.pokemonName} copie ${oppAbility} de ${oppName} grâce à Calque !`, type: 'info' }] };
    },
  },

  // ===== Download: boost Atk or SpAtk based on opponent's lower defense =====
  'download': {
    'switch-in': (ctx) => {
      if (!ctx.opponent || ctx.opponent.currentHp <= 0) return { logs: [] };
      const oppDef = ctx.opponent.stats.defense;
      const oppSpDef = ctx.opponent.stats.spDef;
      if (oppDef <= oppSpDef) {
        ctx.pokemon.statStages.attack = Math.min(6, ctx.pokemon.statStages.attack + 1);
        return { logs: [{ message: `Téléchargement booste l'Attaque de ${ctx.pokemonName} !`, type: 'info' }] };
      } else {
        ctx.pokemon.statStages.spAtk = Math.min(6, ctx.pokemon.statStages.spAtk + 1);
        return { logs: [{ message: `Téléchargement booste l'Attaque Spé. de ${ctx.pokemonName} !`, type: 'info' }] };
      }
    },
  },

  // ===== Shield Dust: block secondary effects =====
  'shield-dust': {
    // Checked inline in battleEngine when applying secondary effects
    'modify-damage': (_ctx) => ({ logs: [] }),
  },

  // ===== Own Tempo: prevent confusion =====
  'own-tempo': {
    'on-status': (ctx) => {
      if (ctx.statusToApply === 'confusion') {
        return { logs: [{ message: `Tempo Perso protège ${ctx.pokemonName} de la confusion !`, type: 'info' }], prevented: true };
      }
      return { logs: [] };
    },
  },

  // ===== Early Bird: halve sleep turns =====
  'early-bird': {
    // Checked inline in checkStatusBlock when decrementing sleep turns
    'on-status': (_ctx) => ({ logs: [] }),
  },

  // ===== Damp: prevent Self-Destruct/Explosion =====
  'damp': {
    // Checked inline in battleEngine before self-destruct moves execute
    'before-move': (ctx) => {
      if (ctx.move && (ctx.move.id === 120 || ctx.move.id === 153)) { // Self-Destruct, Explosion
        return { logs: [{ message: `Moiteur empêche l'explosion !`, type: 'info' }], prevented: true };
      }
      return { logs: [] };
    },
  },

  // ===== Liquid Ooze: damage drain users =====
  'liquid-ooze': {
    // Checked inline in drain effect handler
    'modify-damage': (_ctx) => ({ logs: [] }),
  },

  // ===== Scrappy: Normal/Fighting hit Ghost =====
  'scrappy': {
    // Checked inline in type effectiveness calculation
    'modify-damage': (_ctx) => ({ logs: [] }),
  },

  // ===== Cursed Body: 30% chance to disable on contact =====
  'cursed-body': {
    'after-hit': (ctx) => {
      if (!ctx.opponent || ctx.opponent.currentHp <= 0) return { logs: [] };
      if (!ctx.move) return { logs: [] };
      if (Math.random() < 0.3) {
        if (!ctx.opponent.volatile.disabled) {
          ctx.opponent.volatile.disabled = { moveId: ctx.move.id, turns: 4 };
          const oppName = ctx.opponentName || 'l\'adversaire';
          return { logs: [{ message: `Corps Maudit désactive ${ctx.move.name} de ${oppName} !`, type: 'info' }] };
        }
      }
      return { logs: [] };
    },
  },

  // ===== Anger Point: max attack on crit received =====
  'anger-point': {
    'after-hit': (ctx) => {
      // This needs isCritical context — we'll check via a flag set in battleEngine
      return { logs: [] };
    },
  },

  // ===== Leaf Guard: block status in sun =====
  'leaf-guard': {
    'on-status': (ctx) => {
      if (ctx.weather === 'sun') {
        return { logs: [{ message: `Feuille Garde protège ${ctx.pokemonName} au soleil !`, type: 'info' }], prevented: true };
      }
      return { logs: [] };
    },
  },

  // ===== Hydration: cure status in rain at end of turn =====
  'hydration': {
    'end-turn': (ctx) => {
      if (ctx.weather === 'rain' && ctx.pokemon.status) {
        ctx.pokemon.status = null;
        ctx.pokemon.statusTurns = 0;
        return { logs: [{ message: `${ctx.pokemonName} guérit grâce à Hydratation !`, type: 'info' }] };
      }
      return { logs: [] };
    },
  },

  // ===== Marvel Scale: 1.5x Defense when statused =====
  'marvel-scale': {
    'modify-damage': (ctx) => {
      // Only boosts defense when defender is statused — checked for incoming physical moves
      if (ctx.pokemon.status && ctx.move?.category === 'physical') {
        return { logs: [], damageMultiplier: 0.67 }; // ~1.5x defense = ~0.67x damage taken
      }
      return { logs: [] };
    },
  },

  // ===== Serene Grace: double secondary effect chances =====
  'serene-grace': {
    // Checked inline in battleEngine/moveEffects when applying secondary effects
    'modify-damage': (_ctx) => ({ logs: [] }),
  },

  // ===== Pressure: extra PP drain =====
  'pressure': {
    'switch-in': (ctx) => {
      return { logs: [{ message: `${ctx.pokemonName} exerce une Pression !`, type: 'info' }] };
    },
    // PP drain checked inline in executeMove
  },

  // ===== Arena Trap / Magnet Pull: trapping =====
  'arena-trap': {
    // Trapping checked via isTrappedByAbility in battleStore
    'switch-in': (_ctx) => ({ logs: [] }),
  },
  'magnet-pull': {
    // Trapping checked via isTrappedByAbility in battleStore
    'switch-in': (_ctx) => ({ logs: [] }),
  },

  // ===== Soundproof: block sound moves =====
  'soundproof': {
    'before-move': (ctx) => {
      if (!ctx.move) return { logs: [] };
      const soundMoves = [45, 46, 47, 48, 103, 173, 195, 215, 253, 304, 310, 319, 336, 405, 497, 547, 555, 574, 586]; // Growl, Screech, Snore, Perish Song, Heal Bell, Uproar, Hyper Voice, Bug Buzz, etc.
      if (soundMoves.includes(ctx.move.id)) {
        return { logs: [{ message: `Anti-Bruit protège ${ctx.pokemonName} !`, type: 'info' }], prevented: true };
      }
      return { logs: [] };
    },
  },

  // No-op abilities (out-of-battle only or very niche)
  'run-away': {},
  'pickup': {},
  'illuminate': {},
  'stench': {},
  'sticky-hold': {},
  'cloud-nine': {},
  'suction-cups': {},
  'inner-focus': {
    'after-hit': (_ctx) => ({ logs: [] }), // Prevents flinch — handled in flinch check
  },
  'imposter': {},
  'forewarn': {},
};

// ===== Public API =====

export function getAbilityHandler(abilityName: string, trigger: AbilityTrigger): AbilityHandler | undefined {
  const handlers = abilityHandlers[abilityName];
  if (!handlers) return undefined;
  return handlers[trigger];
}

export function triggerAbility(
  abilityName: string,
  trigger: AbilityTrigger,
  ctx: AbilityContext
): AbilityResult {
  const handler = getAbilityHandler(abilityName, trigger);
  if (!handler) return { logs: [] };
  return handler(ctx);
}

/**
 * Check if a Pokémon's ability blocks critical hits (Shell Armor, Battle Armor)
 */
export function abilityBlocksCrit(abilityName: string): boolean {
  return abilityName === 'shell-armor' || abilityName === 'battle-armor';
}

/**
 * Check if a Pokémon's ability prevents recoil (Rock Head)
 */
export function abilityBlocksRecoil(abilityName: string): boolean {
  return abilityName === 'rock-head';
}

/**
 * Check if attacker's ability bypasses defender abilities (Mold Breaker)
 */
export function abilityIsMoldBreaker(abilityName: string): boolean {
  return abilityName === 'mold-breaker';
}

/**
 * Check if No Guard — all moves bypass accuracy
 */
export function abilityIsNoGuard(abilityName: string): boolean {
  return abilityName === 'no-guard';
}

/**
 * Check if Compound Eyes — 1.3x accuracy
 */
export function abilityIsCompoundEyes(abilityName: string): boolean {
  return abilityName === 'compound-eyes';
}

/**
 * Check if Skill Link — multi-hit always 5
 */
export function abilityIsSkillLink(abilityName: string): boolean {
  return abilityName === 'skill-link';
}

/**
 * Check if Inner Focus — prevents flinch
 */
export function abilityBlocksFlinch(abilityName: string): boolean {
  return abilityName === 'inner-focus';
}

/**
 * Check if Sturdy — survive with 1 HP from full HP
 */
export function abilityIsSturdy(abilityName: string): boolean {
  return abilityName === 'sturdy';
}

/**
 * Shield Dust: blocks secondary effects from opponent's moves
 */
export function abilityIsShieldDust(abilityName: string): boolean {
  return abilityName === 'shield-dust';
}

/**
 * Serene Grace: double secondary effect chances
 */
export function abilityIsSereneGrace(abilityName: string): boolean {
  return abilityName === 'serene-grace';
}

/**
 * Scrappy: Normal/Fighting moves hit Ghost types
 */
export function abilityIsScrappy(abilityName: string): boolean {
  return abilityName === 'scrappy';
}

/**
 * Liquid Ooze: drain moves damage the attacker instead of healing
 */
export function abilityIsLiquidOoze(abilityName: string): boolean {
  return abilityName === 'liquid-ooze';
}

/**
 * Early Bird: halve sleep duration
 */
export function abilityIsEarlyBird(abilityName: string): boolean {
  return abilityName === 'early-bird';
}
