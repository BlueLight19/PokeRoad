/**
 * Move Effect Enrichment Script
 *
 * Fetches detailed move data from PokeAPI and generates SQL UPDATE statements
 * to enrich the Supabase moves.effect JSON column with proper fields:
 * - stat, stages (for stat-changing moves)
 * - flinch_chance (for flinch moves like Bite)
 * - drain % (for drain moves)
 * - min/max hits (for multi-hit moves)
 * - high_crit flag
 * - recoil %
 * - fixed_damage amount
 * - self_destruct flag
 * - charge flag (two-turn moves)
 * - rampage flag
 * - recoil_crash flag (crash on miss)
 *
 * Usage: node scripts/enrich_moves.cjs
 * Output: scripts/enrich_moves.sql
 */

const fs = require('fs');
const path = require('path');

const POKEAPI_BASE = 'https://pokeapi.co/api/v2/move';
const OUTPUT_FILE = path.join(__dirname, 'enrich_moves.sql');
const BATCH_SIZE = 20; // Concurrent requests
const DELAY_MS = 200; // Delay between batches to be nice to the API

// PokeAPI stat name → our stat name
const STAT_MAP = {
  'attack': 'attack',
  'defense': 'defense',
  'special-attack': 'spAtk',
  'special-defense': 'spDef',
  'speed': 'speed',
  'hp': 'hp',
  'accuracy': 'accuracy',
  'evasion': 'evasion',
};

// Known two-turn charge moves (PokeAPI doesn't flag these clearly in meta)
const CHARGE_MOVES = new Set([
  76,   // Solar Beam
  13,   // Razor Wind
  19,   // Fly
  91,   // Dig
  130,  // Skull Bash
  143,  // Sky Attack
  291,  // Dive
  340,  // Bounce
  467,  // Shadow Force
  566,  // Phantom Force
  553,  // Geomancy
  556,  // Solar Blade
  800,  // Meteor Beam
  906,  // Electro Shot
]);

// Known recharge moves (must skip next turn after attacking)
// We treat them as 'charge' type — the engine handles recharge same as charge
const RECHARGE_MOVES = new Set([
  63,   // Hyper Beam
  76,   // Solar Beam (already in CHARGE)
  303,  // Blast Burn (Frenzy Plant, Hydro Cannon, etc. are similar — these recharge)
  304,  // Hydro Cannon
  338,  // Frenzy Plant
  416,  // Giga Impact
  512,  // Rock Wrecker
  705,  // Prismatic Laser
  722,  // Eternabeam
]);

// Known rampage moves (lock-in 2-3 turns, confuse after)
const RAMPAGE_MOVES = new Set([
  37,   // Thrash
  38,   // Petal Dance
  200,  // Outrage
  253,  // Uproar (not exactly rampage but lock-in)
]);

// Known crash-on-miss moves
const CRASH_MOVES = new Set([
  26,   // Jump Kick
  136,  // Hi Jump Kick
]);

// Known self-destruct moves
const SELF_DESTRUCT_MOVES = new Set([
  120,  // Self-Destruct
  153,  // Explosion
  551,  // Misty Explosion
  802,  // Steel Beam (partial — loses HP but not full faint, skip)
]);

// Known fixed-damage moves
const FIXED_DAMAGE_MOVES = {
  49: 20,   // Sonic Boom = 20 HP
  82: 40,   // Dragon Rage = 40 HP
  69: 65535, // Seismic Toss = level-based (special)
  101: 65535, // Night Shade = level-based (special)
  162: 65535, // Super Fang = 50% current HP (special)
};

// Known Pay Day type moves
const MONEY_MOVES = new Set([
  6,    // Pay Day
  521,  // Happy Hour — not damage, but money-related
]);

async function fetchMove(id) {
  const url = `${POKEAPI_BASE}/${id}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`HTTP ${res.status} for move ${id}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`  Failed to fetch move ${id}: ${err.message}`);
    return null;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Build the enriched effect object from PokeAPI data
 */
function buildEffect(apiMove) {
  const id = apiMove.id;
  const meta = apiMove.meta;
  const statChanges = apiMove.stat_changes || [];
  const category = meta?.category?.name || 'damage';
  const ailment = meta?.ailment?.name || 'none';
  const ailmentChance = meta?.ailment_chance || 0;
  const flinchChance = meta?.flinch_chance || 0;
  const drain = meta?.drain || 0;
  const healing = meta?.healing || 0;
  const critRate = meta?.crit_rate || 0;
  const minHits = meta?.min_hits;
  const maxHits = meta?.max_hits;
  const statChance = meta?.stat_chance || 0;
  const damageClass = apiMove.damage_class?.name; // physical, special, status

  const effect = {};

  // === Determine primary effect type ===

  // 1. Self-destruct
  if (SELF_DESTRUCT_MOVES.has(id)) {
    effect.type = 'self_destruct';
    return effect;
  }

  // 2. Charge / Recharge moves
  if (CHARGE_MOVES.has(id) || RECHARGE_MOVES.has(id)) {
    effect.type = 'charge';
    return effect;
  }

  // 3. Rampage moves
  if (RAMPAGE_MOVES.has(id)) {
    effect.type = 'rampage';
    return effect;
  }

  // 4. Crash-on-miss moves
  if (CRASH_MOVES.has(id)) {
    effect.type = 'recoil_crash';
    return effect;
  }

  // 5. Fixed damage
  if (id in FIXED_DAMAGE_MOVES) {
    effect.type = 'fixed_damage';
    effect.amount = FIXED_DAMAGE_MOVES[id];
    return effect;
  }

  // 6. Pay Day
  if (MONEY_MOVES.has(id)) {
    effect.type = 'money';
    return effect;
  }

  // 7. OHKO
  if (category === 'ohko') {
    effect.type = 'ohko';
    return effect;
  }

  // 8. Force switch
  if (category === 'force-switch') {
    effect.type = 'force_switch';
    return effect;
  }

  // 9. Multi-hit
  if (minHits && maxHits) {
    effect.type = 'multi';
    if (minHits === maxHits) {
      effect.count = minHits;
    } else {
      effect.min = minHits;
      effect.max = maxHits;
    }
    // Multi-hit can also have secondary effects, add them
    if (flinchChance > 0) effect.flinch_chance = flinchChance;
    return effect;
  }

  // 10. Drain moves
  if (drain > 0) {
    effect.type = 'drain';
    effect.amount = drain; // PokeAPI gives percentage (e.g. 50 for Absorb)
    effect.drainPercent = drain;
    return effect;
  }

  // 11. Recoil (negative drain)
  if (drain < 0) {
    effect.type = 'recoil';
    effect.amount = Math.abs(drain);
    return effect;
  }

  // 12. Heal moves (status category)
  if (category === 'heal' || (healing > 0 && damageClass === 'status')) {
    effect.type = 'heal_self';
    if (healing > 0) effect.amount = healing;
    return effect;
  }

  // === For damaging moves with secondary effects ===
  if (damageClass === 'physical' || damageClass === 'special') {

    // High crit rate
    if (critRate > 0) {
      effect.type = 'critical';
      effect.high_crit = true;
      // Can also have secondary status, add it
      if (ailment !== 'none' && ailmentChance > 0) {
        effect.status = mapAilment(ailment);
        effect.chance = ailmentChance;
      }
      if (flinchChance > 0) {
        // Crit + flinch is rare but possible — prioritize crit
        effect.flinch_chance = flinchChance;
      }
      return effect;
    }

    // Flinch
    if (flinchChance > 0) {
      effect.type = 'flinch';
      effect.chance = flinchChance;
      return effect;
    }

    // Status ailment on hit (burn, poison, paralysis, freeze, confusion, sleep)
    if (ailment !== 'none' && ailment !== 'unknown') {
      if (ailment === 'trap') {
        effect.type = 'trap';
        effect.chance = ailmentChance || 100;
      } else {
        const mapped = mapAilment(ailment);
        if (mapped) {
          effect.type = 'status';
          effect.status = mapped;
          effect.chance = ailmentChance || 100;
        }
      }

      // Stat changes on damaging moves (e.g. Psychic lowers SpDef)
      if (statChanges.length > 0) {
        const sc = statChanges[0];
        const statName = STAT_MAP[sc.stat.name];
        if (statName && sc.change < 0) {
          // Lower enemy stat
          effect.stat = statName;
          effect.stages = sc.change;
          if (!effect.chance) effect.chance = statChance || ailmentChance || 100;
        }
      }

      if (effect.type) return effect;
    }

    // Stat change on damaging move (damage+lower or damage+raise)
    if (statChanges.length > 0) {
      const sc = statChanges[0];
      const statName = STAT_MAP[sc.stat.name];
      if (statName) {
        effect.type = 'stat';
        if (sc.change > 0) {
          // Self boost on damaging move
          effect.selfEffect = { stat: statName, stages: sc.change };
        } else {
          // Lower enemy stat
          effect.stat = statName;
          effect.stages = sc.change;
        }
        effect.chance = statChance || 100;

        // If multiple stat changes, add them
        if (statChanges.length > 1) {
          effect.additionalStats = statChanges.slice(1).map(s => ({
            stat: STAT_MAP[s.stat.name] || s.stat.name,
            stages: s.change,
          }));
        }
        return effect;
      }
    }

    // Healing on hit (e.g. some moves heal user after damage without being drain)
    if (healing > 0) {
      effect.type = 'drain';
      effect.amount = healing;
      effect.drainPercent = healing;
      return effect;
    }

    // Plain damage — no special effect
    return null;
  }

  // === Status moves ===
  if (damageClass === 'status') {
    // Stat change moves (Swords Dance, Growl, etc.)
    if (statChanges.length > 0) {
      effect.type = 'stat';
      const sc = statChanges[0];
      effect.stat = STAT_MAP[sc.stat.name] || sc.stat.name;
      effect.stages = sc.change;
      effect.chance = statChance || 100;

      if (statChanges.length > 1) {
        effect.additionalStats = statChanges.slice(1).map(s => ({
          stat: STAT_MAP[s.stat.name] || s.stat.name,
          stages: s.change,
        }));
      }

      // Swagger/Flatter: stat boost + confusion
      if (ailment !== 'none' && ailment !== 'unknown') {
        const mapped = mapAilment(ailment);
        if (mapped) {
          effect.status = mapped;
        }
      }
      return effect;
    }

    // Ailment status moves (Thunder Wave, Hypnosis, etc.)
    if (ailment !== 'none' && ailment !== 'unknown') {
      if (ailment === 'leech-seed') {
        effect.type = 'leech_seed';
        return effect;
      }
      const mapped = mapAilment(ailment);
      if (mapped) {
        effect.type = 'status';
        effect.status = mapped;
        effect.chance = ailmentChance || 100;
        return effect;
      }
      // Unhandled ailments → override
      effect.type = 'override';
      return effect;
    }

    // Unique/special status moves
    effect.type = 'override';
    return effect;
  }

  return null;
}

function mapAilment(name) {
  const map = {
    'burn': 'burn',
    'freeze': 'freeze',
    'paralysis': 'paralysis',
    'poison': 'poison',
    'badly-poison': 'poison',
    'sleep': 'sleep',
    'confusion': 'confusion',
    'trap': 'trap',
    'leech-seed': 'leech-seed',
  };
  return map[name] || null;
}

function escapeJson(obj) {
  return JSON.stringify(obj).replace(/'/g, "''");
}

async function main() {
  console.log('=== Move Effect Enrichment Script ===\n');

  // Fetch total move count from our DB range (1-919)
  const MAX_MOVE_ID = 919;
  const sqlLines = [];
  let enriched = 0;
  let skipped = 0;
  let failed = 0;
  let nullEffect = 0;

  sqlLines.push('-- Move Effect Enrichment — generated from PokeAPI');
  sqlLines.push('-- Updates effect JSON for all moves with proper handler types');
  sqlLines.push(`-- Generated: ${new Date().toISOString()}`);
  sqlLines.push('BEGIN;');
  sqlLines.push('');

  const allIds = [];
  for (let i = 1; i <= MAX_MOVE_ID; i++) allIds.push(i);

  for (let batch = 0; batch < allIds.length; batch += BATCH_SIZE) {
    const batchIds = allIds.slice(batch, batch + BATCH_SIZE);
    const batchNum = Math.floor(batch / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(allIds.length / BATCH_SIZE);
    process.stdout.write(`\rBatch ${batchNum}/${totalBatches} (moves ${batchIds[0]}-${batchIds[batchIds.length - 1]})...`);

    const results = await Promise.all(batchIds.map(id => fetchMove(id)));

    for (let i = 0; i < results.length; i++) {
      const apiMove = results[i];
      const moveId = batchIds[i];

      if (!apiMove) {
        skipped++;
        continue;
      }

      try {
        const effect = buildEffect(apiMove);

        if (effect === null) {
          // No special effect — set to NULL
          sqlLines.push(`UPDATE moves SET effect = NULL WHERE id = ${moveId};`);
          nullEffect++;
        } else {
          const json = escapeJson(effect);
          sqlLines.push(`UPDATE moves SET effect = '${json}'::jsonb WHERE id = ${moveId};`);
          enriched++;
        }
      } catch (err) {
        console.error(`\n  Error processing move ${moveId} (${apiMove.name}): ${err.message}`);
        failed++;
      }
    }

    if (batch + BATCH_SIZE < allIds.length) {
      await sleep(DELAY_MS);
    }
  }

  sqlLines.push('');
  sqlLines.push('COMMIT;');

  fs.writeFileSync(OUTPUT_FILE, sqlLines.join('\n'), 'utf8');

  console.log(`\n\n=== Done ===`);
  console.log(`Enriched: ${enriched}`);
  console.log(`Null effect (plain damage): ${nullEffect}`);
  console.log(`Skipped (404): ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
