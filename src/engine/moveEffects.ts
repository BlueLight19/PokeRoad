import { PokemonInstance, MoveData, StatName, MoveInstance, freshStatStages } from '../types/pokemon';
import { BattleLogEntry, SideConditions } from '../types/battle';
import { getPokemonData, getMoveData, getAllMoveIds } from '../utils/dataLoader';
import { getEffectiveStat } from './statCalculator';
import { tryApplyStatus, tryApplyStatChange } from './battleEngine';

export interface EffectContext {
  attacker: PokemonInstance;
  defender: PokemonInstance;
  move: MoveData;
  damageDealt: number;
  defenderHpBefore: number;
  attackerName: string;
  defenderName: string;
  attackerSide?: SideConditions;  // Side of the attacker (for setting own hazards/screens)
  defenderSide?: SideConditions;  // Side of the defender (for setting hazards on their field)
}

export type EffectHandler = (ctx: EffectContext) => BattleLogEntry[];

const effectHandlers: Record<string, EffectHandler> = {

  // ===== Migrated from battleEngine =====

  status: (ctx) => {
    if (ctx.defender.currentHp <= 0) return [];
    return tryApplyStatus(ctx.defender, ctx.move);
  },

  stat: (ctx) => {
    if (!ctx.move.effect) return [];
    const logs: BattleLogEntry[] = [];
    const statNames: Record<string, string> = {
      attack: 'Attaque', defense: 'Défense', spAtk: 'Attaque Spé.',
      spDef: 'Défense Spé.', speed: 'Vitesse', hp: 'PV',
      accuracy: 'Précision', evasion: 'Esquive',
    };

    function applyStage(target: PokemonInstance, stat: string, stages: number, name: string): void {
      const current = target.statStages[stat as keyof typeof target.statStages];
      if (current === undefined) return;
      const newStage = Math.max(-6, Math.min(6, current + stages));
      if (current === newStage) {
        logs.push({ message: `Les stats de ${name} ne peuvent pas aller plus loin !`, type: 'info' });
        return;
      }
      (target.statStages as any)[stat] = newStage;
      const direction = stages > 0 ? 'monte' : 'baisse';
      const intensity = Math.abs(stages) > 1 ? ' beaucoup' : '';
      logs.push({ message: `${statNames[stat] || stat} de ${name} ${direction}${intensity} !`, type: 'info' });
    }

    // Normal stat change on target (defender for offensive, attacker for self-targeting)
    if (ctx.defender.currentHp > 0) {
      logs.push(...tryApplyStatChange(ctx.defender, ctx.move, false));
    }

    // Apply additionalStats (e.g., Close Combat: -1 Def, -1 SpDef)
    if (ctx.move.effect.additionalStats && ctx.move.effect.additionalStats.length > 0) {
      for (const as of ctx.move.effect.additionalStats) {
        // Negative stages on damaging moves affect the attacker (self-debuff)
        if (as.stages < 0 && ctx.move.category !== 'status') {
          if (ctx.attacker.currentHp > 0) applyStage(ctx.attacker, as.stat, as.stages, ctx.attackerName);
        } else {
          // For status moves, additional stats target same as primary
          const target = ctx.move.target === 'self' ? ctx.attacker : ctx.defender;
          const targetName = ctx.move.target === 'self' ? ctx.attackerName : ctx.defenderName;
          if (target.currentHp > 0) applyStage(target, as.stat, as.stages, targetName);
        }
      }
    }

    // selfEffect: stat change on attacker from damaging moves (e.g., Flame Charge +1 Speed)
    if (ctx.move.effect.selfEffect && ctx.attacker.currentHp > 0) {
      const se = ctx.move.effect.selfEffect;
      if (se.stat && se.stages) {
        applyStage(ctx.attacker, se.stat, se.stages, ctx.attackerName);
      }
    }

    // Swagger/Flatter: stat boost + confusion (status field on stat move)
    if (ctx.move.effect.status && (ctx.move.effect.status as string) === 'confusion') {
      if (ctx.defender.currentHp > 0 && ctx.defender.volatile.confusion <= 0) {
        ctx.defender.volatile.confusion = 2 + Math.floor(Math.random() * 4);
        logs.push({ message: `${ctx.defenderName} devient confus !`, type: 'status' });
      }
    }

    // Rapid Spin (ID 229): also clears hazards from attacker's side + frees from bind/leech seed
    if (ctx.move.id === 229 && ctx.attackerSide) {
      const cleared = ctx.attackerSide.stealthRock || ctx.attackerSide.spikes > 0 ||
        ctx.attackerSide.toxicSpikes > 0 || ctx.attackerSide.stickyWeb;
      ctx.attackerSide.stealthRock = false;
      ctx.attackerSide.spikes = 0;
      ctx.attackerSide.toxicSpikes = 0;
      ctx.attackerSide.stickyWeb = false;
      if (cleared) logs.push({ message: `Les pièges sont dissipés !`, type: 'info' });
      // Free from bind/leech seed
      if (ctx.attacker.volatile.bound > 0) { ctx.attacker.volatile.bound = 0; logs.push({ message: `${ctx.attackerName} se libère !`, type: 'info' }); }
      if (ctx.attacker.volatile.leechSeed) { ctx.attacker.volatile.leechSeed = false; logs.push({ message: `${ctx.attackerName} se libère de Vampigraine !`, type: 'info' }); }
    }

    // Defog (ID 432): clear hazards from BOTH sides + screens from defender's side
    if (ctx.move.id === 432) {
      if (ctx.defenderSide) {
        const clearedDef = ctx.defenderSide.stealthRock || ctx.defenderSide.spikes > 0 ||
          ctx.defenderSide.toxicSpikes > 0 || ctx.defenderSide.stickyWeb ||
          ctx.defenderSide.reflect > 0 || ctx.defenderSide.lightScreen > 0 || ctx.defenderSide.auroraVeil > 0;
        ctx.defenderSide.stealthRock = false;
        ctx.defenderSide.spikes = 0;
        ctx.defenderSide.toxicSpikes = 0;
        ctx.defenderSide.stickyWeb = false;
        ctx.defenderSide.reflect = 0;
        ctx.defenderSide.lightScreen = 0;
        ctx.defenderSide.auroraVeil = 0;
        if (clearedDef) logs.push({ message: `Les pièges et écrans adverses sont dissipés !`, type: 'info' });
      }
      if (ctx.attackerSide) {
        const clearedAtk = ctx.attackerSide.stealthRock || ctx.attackerSide.spikes > 0 ||
          ctx.attackerSide.toxicSpikes > 0 || ctx.attackerSide.stickyWeb;
        ctx.attackerSide.stealthRock = false;
        ctx.attackerSide.spikes = 0;
        ctx.attackerSide.toxicSpikes = 0;
        ctx.attackerSide.stickyWeb = false;
        if (clearedAtk) logs.push({ message: `Les pièges de votre côté sont dissipés !`, type: 'info' });
      }
    }

    return logs;
  },

  drain: (ctx) => {
    if (!ctx.move.effect) return [];
    const amount = ctx.move.effect.drainPercent ?? ctx.move.effect.amount ?? 50;
    const actualHpLost = ctx.defenderHpBefore - ctx.defender.currentHp;
    const healAmount = Math.max(1, Math.floor(actualHpLost * amount / 100));
    // Liquid Ooze: drain damages the attacker instead of healing
    if (ctx.defender.ability === 'liquid-ooze') {
      ctx.attacker.currentHp = Math.max(0, ctx.attacker.currentHp - healAmount);
      return [{ message: `${ctx.attackerName} est blessé par Suintement ! (-${healAmount} PV)`, type: 'damage' }];
    }
    ctx.attacker.currentHp = Math.min(ctx.attacker.maxHp, ctx.attacker.currentHp + healAmount);
    return [{ message: `${ctx.attackerName} récupère ${healAmount} PV !`, type: 'info' }];
  },

  recoil: (ctx) => {
    if (!ctx.move.effect?.amount) return [];
    // Rock Head prevents recoil
    if (ctx.attacker.ability === 'rock-head') return [];
    const recoil = Math.max(1, Math.floor(ctx.damageDealt * ctx.move.effect.amount / 100));
    ctx.attacker.currentHp = Math.max(0, ctx.attacker.currentHp - recoil);
    return [{ message: `${ctx.attackerName} subit le contrecoup ! (-${recoil} PV)`, type: 'damage' }];
  },

  flinch: (ctx) => {
    if (ctx.defender.currentHp <= 0) return [];
    // Inner Focus prevents flinch
    if (ctx.defender.ability === 'inner-focus') return [];
    const chance = ctx.move.effect?.chance ?? 30;
    if (Math.random() * 100 < chance) {
      ctx.defender.volatile.flinch = true;
    }
    return [];
  },

  critical: (ctx) => {
    // High crit ratio is handled in damageCalculator via 'high_crit' cast
    // This handler exists for completeness; no additional effect needed
    return [];
  },

  // ===== New implementations =====

  ohko: (ctx) => {
    // One-hit KO: Guillotine, Horn Drill, Fissure
    // Accuracy handled specially: (attacker.level - defender.level + 30)%
    // Fails if defender level > attacker level
    if (ctx.defender.level > ctx.attacker.level) {
      return [{ message: `Mais cela échoue !`, type: 'info' }];
    }
    const hitChance = ctx.attacker.level - ctx.defender.level + 30;
    if (Math.random() * 100 >= hitChance) {
      return [{ message: `${ctx.attackerName} rate son attaque !`, type: 'info' }];
    }
    ctx.defender.currentHp = 0;
    return [{ message: `K.O. en un coup !`, type: 'damage' }];
  },

  fixed_damage: (ctx) => {
    if (!ctx.move.effect) return [];
    const fixedAmount = ctx.move.effect.amount ?? 40;
    const actual = Math.min(fixedAmount, ctx.defender.currentHp);
    ctx.defender.currentHp = Math.max(0, ctx.defender.currentHp - fixedAmount);
    return [{
      message: `${ctx.defenderName} perd ${actual} PV !`,
      type: 'damage',
    }];
  },

  trap: (ctx) => {
    if (ctx.defender.currentHp <= 0) return [];
    if (ctx.defender.volatile.bound > 0) return [];
    const turns = Math.random() < 0.5 ? 4 : 5;
    ctx.defender.volatile.bound = turns;
    return [{ message: `${ctx.defenderName} est piégé !`, type: 'info' }];
  },

  recoil_crash: (_ctx) => {
    // Handled in executeMove on miss branch — this is a no-op post-hit
    return [];
  },

  money: (ctx) => {
    // Pay Day: scatter coins. Bonus money added to trainer reward externally.
    return [{ message: `Des pièces se dispersent partout !`, type: 'info' }];
  },

  disable: (ctx) => {
    if (ctx.defender.currentHp <= 0) return [];
    if (ctx.defender.volatile.disabled) {
      return [{ message: `Mais cela échoue !`, type: 'info' }];
    }
    const lastMove = ctx.defender.volatile.lastMoveUsed;
    if (lastMove === undefined) {
      return [{ message: `Mais cela échoue !`, type: 'info' }];
    }
    ctx.defender.volatile.disabled = { moveId: lastMove, turns: 4 };
    return [{ message: `La dernière attaque de ${ctx.defenderName} est bloquée !`, type: 'info' }];
  },

  mist: (ctx) => {
    ctx.attacker.volatile.mistTurns = 5;
    return [{ message: `${ctx.attackerName} est protégé par la Brume !`, type: 'info' }];
  },

  rampage: (_ctx) => {
    // Lock-in is handled in executeMove; this is a placeholder
    return [];
  },

  force_switch: (ctx) => {
    // Pivot moves (U-Turn 369, Volt Switch 521, Flip Turn 812): damaging + attacker switches out
    const PIVOT_MOVES = [369, 521, 812];
    if (PIVOT_MOVES.includes(ctx.move.id)) {
      return [{ message: `${ctx.attackerName} revient !`, type: 'pivot' as any }];
    }
    // Phaze moves (Roar/Whirlwind/Dragon Tail): defender is forced out
    return [{ message: `${ctx.defenderName} est forcé de reculer !`, type: 'force_switch' as any }];
  },

  leech_seed: (ctx) => {
    if (ctx.defender.currentHp <= 0) return [];
    // Grass and Steel types are immune
    const defData = getPokemonData(ctx.defender.dataId);
    if (defData.types.includes('grass') || defData.types.includes('steel')) {
      return [{ message: `Ça n'affecte pas ${ctx.defenderName}...`, type: 'info' }];
    }
    if (ctx.defender.volatile.leechSeed) {
      return [{ message: `Mais cela échoue !`, type: 'info' }];
    }
    ctx.defender.volatile.leechSeed = true;
    return [{ message: `${ctx.defenderName} est infecté par Vampigraine !`, type: 'info' }];
  },

  self_destruct: (ctx) => {
    // Attacker faints after dealing damage
    ctx.attacker.currentHp = 0;
    return [{ message: `${ctx.attackerName} est K.O. !`, type: 'info' }];
  },

  weather: (ctx) => {
    if (!ctx.move.effect?.weather) return [];
    const weatherNames: Record<string, string> = {
      sun: 'Le soleil brille intensément !',
      rain: 'Il commence à pleuvoir !',
      sandstorm: 'Une tempête de sable se lève !',
      hail: 'Il commence à grêler !',
    };
    return [{ message: weatherNames[ctx.move.effect.weather] ?? 'Le temps change !', type: 'info' }];
  },

  protect: (ctx) => {
    // Protect is handled as a pre-check in executeMove; this is post-hit no-op
    return [];
  },

  heal_self: (ctx) => {
    if (ctx.attacker.currentHp >= ctx.attacker.maxHp) {
      return [{ message: `Mais cela échoue !`, type: 'info' }];
    }
    // amount is percentage (e.g. 50 for Recover, 25 for Moonlight)
    const percent = ctx.move.effect?.amount ?? 50;
    const healAmount = Math.max(1, Math.floor(ctx.attacker.maxHp * percent / 100));
    const oldHp = ctx.attacker.currentHp;
    ctx.attacker.currentHp = Math.min(ctx.attacker.maxHp, ctx.attacker.currentHp + healAmount);
    const healed = ctx.attacker.currentHp - oldHp;
    return [{ message: `${ctx.attackerName} récupère ${healed} PV !`, type: 'info' }];
  },

  transform: (ctx) => {
    // Copy opponent's species/stats/moves (simplified)
    ctx.attacker.stats = { ...ctx.defender.stats };
    ctx.attacker.statStages = { ...ctx.defender.statStages };
    // Copy moves (with 5 PP each)
    ctx.attacker.moves = ctx.defender.moves.map(m => ({
      moveId: m.moveId,
      currentPp: 5,
      maxPp: 5,
    }));
    return [{ message: `${ctx.attackerName} se transforme en ${ctx.defenderName} !`, type: 'info' }];
  },

  recharge: (_ctx) => {
    // Recharge logic (skip next turn) is handled in executeMove
    return [];
  },

  override: (ctx) => {
    // Dispatch to special handlers based on move name/id
    return handleOverrideMove(ctx);
  },
};

// Moves that Metronome cannot call
const METRONOME_BANNED = new Set([
  102, // Mimic
  118, // Metronome itself
  144, // Transform
  165, // Struggle
  166, // Sketch
  168, // Thief
  171, // Nightmare — status, not worth random calling
  214, // Sleep Talk
  243, // Mirror Coat
  264, // Focus Punch
  266, // Follow Me
  270, // Helping Hand
  343, // Covet
  364, // Feint
  382, // Me First
  415, // Switcheroo
  448, // Chatter
  507, // Assist
  509, // Circle Throw
  525, // Dragon Tail
  557, // Nature Power (calls another move)
]);

function simplifiedDamage(ctx: EffectContext, move: MoveData): number {
  if (!move.power || move.category === 'status') return 0;
  const atk = move.category === 'physical'
    ? getEffectiveStat(ctx.attacker, 'attack')
    : getEffectiveStat(ctx.attacker, 'spAtk');
  const def = move.category === 'physical'
    ? getEffectiveStat(ctx.defender, 'defense')
    : getEffectiveStat(ctx.defender, 'spDef');
  const levelFactor = Math.floor((2 * ctx.attacker.level) / 5 + 2);
  let damage = Math.floor((levelFactor * move.power * atk / def) / 50) + 2;
  return Math.max(1, Math.floor(damage * (0.85 + Math.random() * 0.15)));
}

function executeRandomMove(ctx: EffectContext, move: MoveData, label: string): BattleLogEntry[] {
  const logs: BattleLogEntry[] = [{ message: `${label} choisit ${move.name} !`, type: 'info' }];
  if (move.category !== 'status' && move.power) {
    const damage = simplifiedDamage(ctx, move);
    ctx.defender.currentHp = Math.max(0, ctx.defender.currentHp - damage);
    logs.push({ message: `${ctx.defenderName} perd ${damage} PV !`, type: 'damage' });
  } else if (move.effect) {
    const handler = effectHandlers[move.effect.type];
    if (handler) {
      logs.push(...handler({ ...ctx, move, damageDealt: 0 }));
    }
  }
  return logs;
}

function handleOverrideMove(ctx: EffectContext): BattleLogEntry[] {
  const moveId = ctx.move.id;
  const moveName = ctx.move.name.toLowerCase();

  // ===== Disable / Mist (tagged override in DB but have registry handlers) =====

  // Disable (Entrave) — ID 50
  if (moveId === 50 || moveName.includes('entrave') || moveName.includes('disable')) {
    return effectHandlers.disable(ctx);
  }

  // Mist (Brume) — ID 54
  if (moveId === 54 || moveName === 'brume' || moveName === 'mist') {
    return effectHandlers.mist(ctx);
  }

  // ===== Trivial / No-op =====

  // Splash (Trempette) — ID 150
  if (moveId === 150 || moveName.includes('trempette') || moveName.includes('splash')) {
    return [{ message: `Mais rien ne se passe...`, type: 'info' }];
  }

  // Teleport — ID 100 (flee from wild, fail in trainer)
  if (moveId === 100 || moveName.includes('téléport') || moveName.includes('teleport')) {
    return [{ message: `Mais cela échoue !`, type: 'info' }];
  }

  // Singles no-ops: Follow Me, Helping Hand, Wide Guard, Rage Powder, After You, Quash, Ally Switch
  if ([266, 270, 469, 476, 495, 501, 502].includes(moveId)) {
    return [{ message: `Mais cela échoue !`, type: 'info' }];
  }

  // Celebrate (Célébration) — ID 606
  if (moveId === 606) {
    return [{ message: `Félicitations !`, type: 'info' }];
  }

  // ===== Weather Moves =====

  // Sandstorm (Tempête de Sable) — ID 201
  if (moveId === 201 || moveName.includes('tempête de sable') || moveName.includes('sandstorm')) {
    return [{ message: `Une tempête de sable se lève !`, type: 'weather' as any }];
  }

  // Rain Dance (Danse Pluie) — ID 240
  if (moveId === 240 || moveName.includes('danse pluie') || moveName.includes('rain dance')) {
    return [{ message: `Il commence à pleuvoir !`, type: 'weather' as any }];
  }

  // Sunny Day (Zénith) — ID 241
  if (moveId === 241 || moveName.includes('zénith') || moveName.includes('sunny day')) {
    return [{ message: `Le soleil brille !`, type: 'weather' as any }];
  }

  // Hail / Snowscape (Grêle/Chute de Neige) — ID 258, 883
  if (moveId === 258 || moveId === 883 || moveName.includes('grêle') || moveName.includes('chute de neige') || moveName.includes('hail') || moveName.includes('snowscape')) {
    return [{ message: `Il commence à grêler !`, type: 'weather' as any }];
  }

  // ===== Protect / Detect / Endure =====

  // Protect (Abri) — ID 182
  if (moveId === 182 || moveName === 'abri' || moveName === 'protect') {
    return effectHandlers.protect(ctx);
  }

  // Detect (Détection) — ID 197
  if (moveId === 197 || moveName.includes('détection') || moveName.includes('detect')) {
    return effectHandlers.protect(ctx); // Same as Protect
  }

  // Endure (Ténacité) — ID 203
  if (moveId === 203 || moveName.includes('ténacité') || moveName.includes('endure')) {
    ctx.attacker.volatile.protectStreak++;
    const chance = 1 / Math.pow(3, ctx.attacker.volatile.protectStreak - 1);
    if (Math.random() >= chance) {
      ctx.attacker.volatile.protectStreak = 0;
      return [{ message: `Mais cela échoue !`, type: 'info' }];
    }
    ctx.attacker.volatile.endure = true;
    return [{ message: `${ctx.attackerName} se prépare à encaisser !`, type: 'info' }];
  }

  // ===== Stat Boost Moves =====

  // Focus Energy (Puissance) — ID 116
  if (moveId === 116 || moveName === 'puissance' || moveName.includes('focus energy')) {
    if (ctx.attacker.volatile.focusEnergy) {
      return [{ message: `Mais cela échoue !`, type: 'info' }];
    }
    ctx.attacker.volatile.focusEnergy = true;
    return [{ message: `${ctx.attackerName} se concentre !`, type: 'info' }];
  }

  // Belly Drum (Cognobidon) — ID 187
  if (moveId === 187 || moveName.includes('cognobidon') || moveName.includes('belly drum')) {
    const cost = Math.floor(ctx.attacker.maxHp / 2);
    if (ctx.attacker.currentHp <= cost || ctx.attacker.statStages.attack >= 6) {
      return [{ message: `Mais cela échoue !`, type: 'info' }];
    }
    ctx.attacker.currentHp -= cost;
    ctx.attacker.statStages.attack = 6;
    return [{ message: `${ctx.attackerName} sacrifie des PV et maximise son Attaque !`, type: 'info' }];
  }

  // Bulk Up (Boost) — ID 244
  if (moveId === 244 || moveName === 'boost' || moveName.includes('bulk up')) {
    ctx.attacker.statStages.attack = Math.min(6, ctx.attacker.statStages.attack + 1);
    ctx.attacker.statStages.defense = Math.min(6, ctx.attacker.statStages.defense + 1);
    return [{ message: `L'Attaque et la Défense de ${ctx.attackerName} montent !`, type: 'info' }];
  }

  // Acupressure (Acupression) — ID 367
  if (moveId === 367 || moveName.includes('acupression') || moveName.includes('acupressure')) {
    const stats = ['attack', 'defense', 'spAtk', 'spDef', 'speed'] as const;
    const boostable = stats.filter(s => ctx.attacker.statStages[s] < 6);
    if (boostable.length === 0) {
      return [{ message: `Mais cela échoue !`, type: 'info' }];
    }
    const picked = boostable[Math.floor(Math.random() * boostable.length)];
    ctx.attacker.statStages[picked] = Math.min(6, ctx.attacker.statStages[picked] + 2);
    const names: Record<string, string> = { attack: 'Attaque', defense: 'Défense', spAtk: 'Attaque Spé.', spDef: 'Défense Spé.', speed: 'Vitesse' };
    return [{ message: `${names[picked]} de ${ctx.attackerName} monte fortement !`, type: 'info' }];
  }

  // Power Swap (Permuforce) — ID 384
  if (moveId === 384 || moveName.includes('permuforce') || moveName.includes('power swap')) {
    const tmpAtk = ctx.attacker.statStages.attack; const tmpSpA = ctx.attacker.statStages.spAtk;
    ctx.attacker.statStages.attack = ctx.defender.statStages.attack; ctx.attacker.statStages.spAtk = ctx.defender.statStages.spAtk;
    ctx.defender.statStages.attack = tmpAtk; ctx.defender.statStages.spAtk = tmpSpA;
    return [{ message: `${ctx.attackerName} échange les modifications d'Attaque et d'Attaque Spé. !`, type: 'info' }];
  }

  // Guard Swap (Permugarde) — ID 385
  if (moveId === 385 || moveName.includes('permugarde') || moveName.includes('guard swap')) {
    const tmpDef = ctx.attacker.statStages.defense; const tmpSpD = ctx.attacker.statStages.spDef;
    ctx.attacker.statStages.defense = ctx.defender.statStages.defense; ctx.attacker.statStages.spDef = ctx.defender.statStages.spDef;
    ctx.defender.statStages.defense = tmpDef; ctx.defender.statStages.spDef = tmpSpD;
    return [{ message: `${ctx.attackerName} échange les modifications de Défense et de Défense Spé. !`, type: 'info' }];
  }

  // ===== Status / Volatile Effects =====

  // Haze (Buée Noire) — ID 114
  if (moveId === 114 || moveName.includes('buée noire') || moveName.includes('haze')) {
    ctx.attacker.statStages = freshStatStages();
    ctx.defender.statStages = freshStatStages();
    return [{ message: `Toutes les modifications de stats sont annulées !`, type: 'info' }];
  }

  // Lock-On / Mind Reader (Verrouillage) — ID 199
  if (moveId === 199 || moveName.includes('verrouillage') || moveName.includes('lock-on') || moveName.includes('mind reader')) {
    ctx.attacker.volatile.lockOn = true;
    return [{ message: `${ctx.attackerName} verrouille ${ctx.defenderName} !`, type: 'info' }];
  }

  // Mean Look (Regard Noir) — ID 212 / Block (Barrage) — ID 335
  if (moveId === 212 || moveId === 335 || moveName.includes('regard noir') || moveName.includes('barrage') || moveName.includes('mean look') || moveName.includes('block')) {
    ctx.defender.volatile.trapped = true;
    return [{ message: `${ctx.defenderName} ne peut plus fuir !`, type: 'info' }];
  }

  // Safeguard (Rune Protect) — ID 219
  if (moveId === 219 || moveName.includes('rune protect') || moveName.includes('safeguard')) {
    if (ctx.attacker.volatile.safeguardTurns > 0) {
      return [{ message: `Mais cela échoue !`, type: 'info' }];
    }
    ctx.attacker.volatile.safeguardTurns = 5;
    return [{ message: `Un voile mystérieux protège l'équipe !`, type: 'info' }];
  }

  // Taunt (Provoc) — ID 269
  if (moveId === 269 || moveName.includes('provoc') || moveName.includes('taunt')) {
    if (ctx.defender.volatile.tauntTurns > 0) {
      return [{ message: `Mais cela échoue !`, type: 'info' }];
    }
    ctx.defender.volatile.tauntTurns = 3;
    return [{ message: `${ctx.defenderName} est provoqué ! Il ne peut utiliser que des attaques offensives !`, type: 'info' }];
  }

  // Yawn (Bâillement) — ID 281
  if (moveId === 281 || moveName.includes('bâillement') || moveName.includes('yawn')) {
    if (ctx.defender.status || ctx.defender.volatile.yawned) {
      return [{ message: `Mais cela échoue !`, type: 'info' }];
    }
    ctx.defender.volatile.yawned = true;
    return [{ message: `${ctx.defenderName} bâille !`, type: 'info' }];
  }

  // Torment (Tourmente) — ID 259
  if (moveId === 259 || moveName.includes('tourmente') || moveName.includes('torment')) {
    // Simplified: prevent using same move twice in a row (tracked via lastMoveUsed + disabled)
    return [{ message: `${ctx.defenderName} est soumis à la Tourmente !`, type: 'info' }];
  }

  // Attract (Attraction) — ID 213
  if (moveId === 213 || moveName.includes('attraction') || moveName.includes('attract')) {
    // Simplified: no gender system, always fails
    return [{ message: `Mais cela échoue !`, type: 'info' }];
  }

  // ===== Healing / Recovery =====

  // Rest (Repos) — ID 156
  if (moveId === 156 || moveName === 'repos' || moveName === 'rest') {
    if (ctx.attacker.currentHp >= ctx.attacker.maxHp) {
      return [{ message: `Mais cela échoue !`, type: 'info' }];
    }
    ctx.attacker.status = null;
    ctx.attacker.statusTurns = 0;
    ctx.attacker.currentHp = ctx.attacker.maxHp;
    ctx.attacker.status = 'sleep';
    ctx.attacker.statusTurns = 2;
    return [{ message: `${ctx.attackerName} récupère tous ses PV et s'endort !`, type: 'info' }];
  }

  // Dream Eater (Dévorêve) — ID 138: only works on sleeping targets, drains 50%
  if (moveId === 138 || moveName.includes('dévorêve') || moveName.includes('dream eater')) {
    if (ctx.defender.status !== 'sleep') {
      return [{ message: `Mais cela échoue !`, type: 'info' }];
    }
    const damage = simplifiedDamage(ctx, ctx.move!);
    ctx.defender.currentHp = Math.max(0, ctx.defender.currentHp - damage);
    // Liquid Ooze check
    const healAmount = Math.max(1, Math.floor(damage / 2));
    if (ctx.defender.ability === 'liquid-ooze') {
      ctx.attacker.currentHp = Math.max(0, ctx.attacker.currentHp - healAmount);
      return [
        { message: `${ctx.defenderName} perd ${damage} PV !`, type: 'damage' },
        { message: `${ctx.attackerName} est blessé par Suintement ! (-${healAmount} PV)`, type: 'damage' },
      ];
    }
    ctx.attacker.currentHp = Math.min(ctx.attacker.maxHp, ctx.attacker.currentHp + healAmount);
    return [
      { message: `${ctx.defenderName} perd ${damage} PV !`, type: 'damage' },
      { message: `${ctx.attackerName} récupère ${healAmount} PV !`, type: 'info' },
    ];
  }

  // Aromatherapy (Aromathérapie) — ID 312 / Heal Bell (Glas de Soin) — ID 215
  if (moveId === 312 || moveId === 215 || moveName.includes('aromathérapie') || moveName.includes('glas de soin') || moveName.includes('aromatherapy') || moveName.includes('heal bell')) {
    ctx.attacker.status = null;
    ctx.attacker.statusTurns = 0;
    return [{ message: `Une douce mélodie guérit les statuts de l'équipe !`, type: 'info' }];
  }

  // Aqua Ring (Anneau Hydro) — ID 392
  if (moveId === 392 || moveName.includes('anneau hydro') || moveName.includes('aqua ring')) {
    ctx.attacker.volatile.aquaRing = true;
    return [{ message: `${ctx.attackerName} s'entoure d'un voile d'eau !`, type: 'info' }];
  }

  // Ingrain (Racines) — ID 275
  if (moveId === 275 || moveName.includes('racines') || moveName.includes('ingrain')) {
    ctx.attacker.volatile.ingrain = true;
    return [{ message: `${ctx.attackerName} plante ses racines !`, type: 'info' }];
  }

  // Heal Wish (Vœu Soin) — ID 361 / Lunar Dance (Danse Lune) — ID 461
  if (moveId === 361 || moveId === 461 || moveName.includes('vœu soin') || moveName.includes('danse lune') || moveName.includes('heal wish')) {
    ctx.attacker.currentHp = 0;
    return [{ message: `${ctx.attackerName} s'évanouit pour soigner le prochain Pokémon !`, type: 'info' }];
  }

  // Wish (Vœu) — ID 273
  if (moveId === 273 || moveName.includes('vœu') || moveName.includes('wish')) {
    // Simplified: heal 50% next turn (applied as immediate heal since we don't track delayed effects)
    const heal = Math.floor(ctx.attacker.maxHp / 2);
    const actual = Math.min(heal, ctx.attacker.maxHp - ctx.attacker.currentHp);
    if (actual <= 0) return [{ message: `Mais cela échoue !`, type: 'info' }];
    ctx.attacker.currentHp += actual;
    return [{ message: `Le vœu de ${ctx.attackerName} se réalise ! (+${actual} PV)`, type: 'heal' }];
  }

  // ===== Unique Attack Moves =====

  // Metronome (Métronome) — ID 118
  if (moveId === 118 || moveName.includes('métronome') || moveName.includes('metronome')) {
    const allIds = getAllMoveIds().filter(id => !METRONOME_BANNED.has(id));
    if (allIds.length === 0) return [{ message: `Mais cela échoue !`, type: 'info' }];
    const randomMove = getMoveData(allIds[Math.floor(Math.random() * allIds.length)]);
    return executeRandomMove(ctx, randomMove, 'Métronome');
  }

  // Counter (Riposte) — ID 68
  if (moveId === 68 || moveName.includes('riposte') || moveName.includes('counter')) {
    const last = ctx.attacker.volatile.lastDamageTaken;
    if (!last || last.category !== 'physical' || last.amount <= 0) {
      return [{ message: `Mais cela échoue !`, type: 'info' }];
    }
    const counterDmg = last.amount * 2;
    ctx.defender.currentHp = Math.max(0, ctx.defender.currentHp - counterDmg);
    return [{ message: `${ctx.attackerName} contre-attaque ! ${ctx.defenderName} perd ${counterDmg} PV !`, type: 'damage' }];
  }

  // Mirror Coat (Voile Miroir) — ID 243
  if (moveId === 243 || moveName.includes('miroir') || moveName.includes('mirror coat')) {
    const last = ctx.attacker.volatile.lastDamageTaken;
    if (!last || last.category !== 'special' || last.amount <= 0) {
      return [{ message: `Mais cela échoue !`, type: 'info' }];
    }
    const mirrorDmg = last.amount * 2;
    ctx.defender.currentHp = Math.max(0, ctx.defender.currentHp - mirrorDmg);
    return [{ message: `${ctx.attackerName} renvoie l'attaque ! ${ctx.defenderName} perd ${mirrorDmg} PV !`, type: 'damage' }];
  }

  // Curse (Malédiction) — ID 174
  if (moveId === 174 || moveName.includes('malédiction') || moveName.includes('curse')) {
    const attackerData = getPokemonData(ctx.attacker.dataId);
    if (attackerData.types.includes('ghost')) {
      const sacrifice = Math.max(1, Math.floor(ctx.attacker.maxHp / 4));
      ctx.attacker.currentHp = Math.max(0, ctx.attacker.currentHp - sacrifice);
      ctx.defender.volatile.cursed = true;
      return [
        { message: `${ctx.attackerName} sacrifie des PV !`, type: 'damage' },
        { message: `${ctx.defenderName} est maudit !`, type: 'status' },
      ];
    } else {
      ctx.attacker.statStages.speed = Math.max(-6, ctx.attacker.statStages.speed - 1);
      ctx.attacker.statStages.attack = Math.min(6, ctx.attacker.statStages.attack + 1);
      ctx.attacker.statStages.defense = Math.min(6, ctx.attacker.statStages.defense + 1);
      return [
        { message: `La Vitesse de ${ctx.attackerName} baisse !`, type: 'info' },
        { message: `L'Attaque et la Défense de ${ctx.attackerName} montent !`, type: 'info' },
      ];
    }
  }

  // Destiny Bond (Lien du Destin) — ID 194
  if (moveId === 194 || moveName.includes('lien du destin') || moveName.includes('destiny bond')) {
    ctx.attacker.volatile.destinyBond = true;
    return [{ message: `${ctx.attackerName} lie son destin à celui de ${ctx.defenderName} !`, type: 'info' }];
  }

  // Encore — ID 227
  if (moveId === 227 || moveName.includes('encore')) {
    const lastMove = ctx.defender.volatile.lastMoveUsed;
    if (lastMove === undefined || ctx.defender.volatile.encoreTurns > 0) {
      return [{ message: `Mais cela échoue !`, type: 'info' }];
    }
    ctx.defender.volatile.encoreTurns = 3;
    ctx.defender.volatile.encoreMoveId = lastMove;
    return [{ message: `${ctx.defenderName} est forcé de répéter ${getMoveData(lastMove).name} !`, type: 'info' }];
  }

  // Pain Split (Balance) — ID 220
  if (moveId === 220 || moveName.includes('balance') || moveName.includes('pain split')) {
    const avg = Math.floor((ctx.attacker.currentHp + ctx.defender.currentHp) / 2);
    ctx.attacker.currentHp = Math.min(ctx.attacker.maxHp, avg);
    ctx.defender.currentHp = Math.min(ctx.defender.maxHp, avg);
    return [{ message: `Les PV sont partagés !`, type: 'info' }];
  }

  // Perish Song (Requiem) — ID 195
  if (moveId === 195 || moveName.includes('requiem') || moveName.includes('perish song')) {
    if (ctx.attacker.volatile.perishTurns < 0) ctx.attacker.volatile.perishTurns = 3;
    if (ctx.defender.volatile.perishTurns < 0) ctx.defender.volatile.perishTurns = 3;
    return [{ message: `Tous les Pokémon entendent le Requiem !`, type: 'info' }];
  }

  // Sleep Talk (Blabla Dodo) — ID 214
  if (moveId === 214 || moveName.includes('blabla dodo') || moveName.includes('sleep talk')) {
    if (ctx.attacker.status !== 'sleep') return [{ message: `Mais cela échoue !`, type: 'info' }];
    const otherMoves = ctx.attacker.moves.filter(m => m.moveId !== 214 && m.currentPp > 0);
    if (otherMoves.length === 0) return [{ message: `Mais cela échoue !`, type: 'info' }];
    const picked = otherMoves[Math.floor(Math.random() * otherMoves.length)];
    return executeRandomMove(ctx, getMoveData(picked.moveId), 'Blabla Dodo');
  }

  // Snore (Ronflement) — ID 173
  if (moveId === 173 || moveName.includes('ronflement') || moveName.includes('snore')) {
    if (ctx.attacker.status !== 'sleep') return [{ message: `Mais cela échoue !`, type: 'info' }];
    const damage = simplifiedDamage({ ...ctx, move: { ...ctx.move, power: 50 } as any }, { ...ctx.move, power: 50 } as any);
    ctx.defender.currentHp = Math.max(0, ctx.defender.currentHp - damage);
    const logs: BattleLogEntry[] = [{ message: `${ctx.defenderName} perd ${damage} PV !`, type: 'damage' }];
    if (ctx.defender.currentHp > 0 && Math.random() < 0.3) {
      ctx.defender.volatile.flinch = true;
    }
    return logs;
  }

  // Mirror Move (Mimique) — ID 119
  if (moveId === 119 || moveName.includes('mimique') || moveName.includes('mirror move')) {
    const lastUsed = ctx.defender.volatile.lastMoveUsed;
    if (lastUsed === undefined) return [{ message: `Mais cela échoue !`, type: 'info' }];
    const mirroredMove = getMoveData(lastUsed);
    return executeRandomMove(ctx, mirroredMove, 'Mimique');
  }

  // Mimic (Copie) — ID 102
  if (moveId === 102 || moveName === 'copie' || moveName === 'mimic') {
    const lastUsed = ctx.defender.volatile.lastMoveUsed;
    if (lastUsed === undefined) return [{ message: `Mais cela échoue !`, type: 'info' }];
    const copiedMove = getMoveData(lastUsed);
    // Replace Mimic in the moveset temporarily
    const mimicSlot = ctx.attacker.moves.findIndex(m => m.moveId === 102);
    if (mimicSlot >= 0) {
      ctx.attacker.moves[mimicSlot] = { moveId: lastUsed, currentPp: copiedMove.pp, maxPp: copiedMove.pp };
    }
    return [{ message: `${ctx.attackerName} copie ${copiedMove.name} !`, type: 'info' }];
  }

  // Copycat (Photocopie) — ID 383
  if (moveId === 383 || moveName.includes('photocopie') || moveName.includes('copycat')) {
    const lastUsed = ctx.defender.volatile.lastMoveUsed;
    if (lastUsed === undefined) return [{ message: `Mais cela échoue !`, type: 'info' }];
    return executeRandomMove(ctx, getMoveData(lastUsed), 'Photocopie');
  }

  // Transform (Morphing) — ID 144
  if (moveId === 144 || moveName.includes('morphing') || moveName.includes('transform')) {
    ctx.attacker.stats = { ...ctx.defender.stats };
    ctx.attacker.statStages = { ...ctx.defender.statStages };
    ctx.attacker.moves = ctx.defender.moves.map(m => ({ moveId: m.moveId, currentPp: 5, maxPp: 5 }));
    return [{ message: `${ctx.attackerName} se transforme en ${ctx.defenderName} !`, type: 'info' }];
  }

  // Spite (Dépit) — ID 180
  if (moveId === 180 || moveName.includes('dépit') || moveName.includes('spite')) {
    const lastUsed = ctx.defender.volatile.lastMoveUsed;
    if (lastUsed === undefined) return [{ message: `Mais cela échoue !`, type: 'info' }];
    const moveSlot = ctx.defender.moves.find(m => m.moveId === lastUsed);
    if (!moveSlot) return [{ message: `Mais cela échoue !`, type: 'info' }];
    const ppLoss = Math.min(4, moveSlot.currentPp);
    moveSlot.currentPp -= ppLoss;
    const movData = getMoveData(lastUsed);
    return [{ message: `${movData.name} de ${ctx.defenderName} perd ${ppLoss} PP !`, type: 'info' }];
  }

  // ===== Switching / Trapping =====

  // Baton Pass (Relais) — ID 226
  if (moveId === 226 || moveName.includes('relais') || moveName.includes('baton pass')) {
    return [{ message: `${ctx.attackerName} passe le relais !`, type: 'baton_pass' as any }];
  }

  // ===== Type / Ability Manipulation =====

  // Conversion — ID 160: change type to first move's type
  if (moveId === 160 || moveName === 'conversion') {
    if (ctx.attacker.moves.length === 0) return [{ message: `Mais cela échoue !`, type: 'info' }];
    const firstMove = getMoveData(ctx.attacker.moves[0].moveId);
    const attackerData = getPokemonData(ctx.attacker.dataId);
    (attackerData as any).types = [firstMove.type];
    const typeNames: Record<string, string> = { normal: 'Normal', fire: 'Feu', water: 'Eau', grass: 'Plante', electric: 'Électrik', ice: 'Glace', fighting: 'Combat', poison: 'Poison', ground: 'Sol', flying: 'Vol', psychic: 'Psy', bug: 'Insecte', rock: 'Roche', ghost: 'Spectre', dragon: 'Dragon', dark: 'Ténèbres', steel: 'Acier', fairy: 'Fée' };
    return [{ message: `${ctx.attackerName} devient type ${typeNames[firstMove.type] || firstMove.type} !`, type: 'info' }];
  }

  // Conversion 2 — ID 176: change type to resist last hit received
  if (moveId === 176 || moveName.includes('conversion 2')) {
    if (!ctx.defender.volatile.lastMoveUsed) return [{ message: `Mais cela échoue !`, type: 'info' }];
    const lastMove = getMoveData(ctx.defender.volatile.lastMoveUsed);
    const resistTypes: Record<string, string> = { normal: 'rock', fire: 'water', water: 'grass', grass: 'fire', electric: 'ground', ice: 'fire', fighting: 'flying', poison: 'ground', ground: 'grass', flying: 'rock', psychic: 'dark', bug: 'fire', rock: 'fighting', ghost: 'normal', dragon: 'steel', dark: 'fighting', steel: 'fire', fairy: 'steel' };
    const newType = resistTypes[lastMove.type] || 'normal';
    const attackerData = getPokemonData(ctx.attacker.dataId);
    (attackerData as any).types = [newType];
    const typeNames: Record<string, string> = { normal: 'Normal', fire: 'Feu', water: 'Eau', grass: 'Plante', electric: 'Électrik', ice: 'Glace', fighting: 'Combat', poison: 'Poison', ground: 'Sol', flying: 'Vol', psychic: 'Psy', bug: 'Insecte', rock: 'Roche', ghost: 'Spectre', dragon: 'Dragon', dark: 'Ténèbres', steel: 'Acier', fairy: 'Fée' };
    return [{ message: `${ctx.attackerName} devient type ${typeNames[newType] || newType} !`, type: 'info' }];
  }

  // Soak (Détrempage) — ID 487
  if (moveId === 487 || moveName.includes('détrempage') || moveName.includes('soak')) {
    return [{ message: `${ctx.defenderName} devient de type Eau !`, type: 'info' }];
  }

  // Reflect Type (Copie-Type) — ID 513
  if (moveId === 513 || moveName.includes('copie-type') || moveName.includes('reflect type')) {
    return [{ message: `${ctx.attackerName} copie le type de ${ctx.defenderName} !`, type: 'info' }];
  }

  // Role Play (Imitation) — ID 272
  if (moveId === 272 || moveName.includes('imitation') || moveName.includes('role play')) {
    ctx.attacker.ability = ctx.defender.ability;
    return [{ message: `${ctx.attackerName} copie le talent de ${ctx.defenderName} !`, type: 'info' }];
  }

  // Worry Seed (Soucigraine) — ID 388
  if (moveId === 388 || moveName.includes('soucigraine') || moveName.includes('worry seed')) {
    ctx.defender.ability = 'insomnia';
    return [{ message: `Le talent de ${ctx.defenderName} devient Insomnia !`, type: 'info' }];
  }

  // Gastro Acid (Suc Digestif) — ID 380
  if (moveId === 380 || moveName.includes('suc digestif') || moveName.includes('gastro acid')) {
    ctx.defender.ability = '';
    return [{ message: `Le talent de ${ctx.defenderName} est neutralisé !`, type: 'info' }];
  }

  // Trick / Switcheroo (Passe-Passe) — ID 415
  if (moveId === 415 || moveName.includes('passe-passe') || moveName.includes('switcheroo') || moveName.includes('trick')) {
    const tmpItem = ctx.attacker.heldItem;
    ctx.attacker.heldItem = ctx.defender.heldItem;
    ctx.defender.heldItem = tmpItem;
    return [{ message: `${ctx.attackerName} échange les objets tenus !`, type: 'info' }];
  }

  // Recycle (Recyclage) — ID 278
  if (moveId === 278 || moveName.includes('recyclage') || moveName.includes('recycle')) {
    // Simplified: can't restore consumed items without tracking previous held item
    return [{ message: `Mais cela échoue !`, type: 'info' }];
  }

  // Covet (Possessif) — ID 286
  if (moveId === 286 || moveName.includes('possessif') || moveName.includes('covet')) {
    if (ctx.defender.heldItem && !ctx.attacker.heldItem) {
      ctx.attacker.heldItem = ctx.defender.heldItem;
      ctx.defender.heldItem = null;
      return [{ message: `${ctx.attackerName} vole l'objet de ${ctx.defenderName} !`, type: 'info' }];
    }
    return [];
  }

  // ===== Field Effects =====

  // Gravity (Gravité) — ID 356
  if (moveId === 356 || moveName.includes('gravité') || moveName.includes('gravity')) {
    // Simplified: log only (would need field state for full implementation)
    return [{ message: `La gravité s'intensifie !`, type: 'info' }];
  }

  // Magnet Rise (Vol Magnétik) — ID 393
  if (moveId === 393 || moveName.includes('vol magnétik') || moveName.includes('magnet rise')) {
    ctx.attacker.volatile.magnetRise = 5;
    return [{ message: `${ctx.attackerName} lévite grâce à l'électromagnétisme !`, type: 'info' }];
  }

  // Wonder Room (Zone Étrange) — ID 472
  if (moveId === 472 || moveName.includes('zone étrange') || moveName.includes('wonder room')) {
    // Swap Def/SpDef for both
    const tmpA = ctx.attacker.stats.defense; ctx.attacker.stats.defense = ctx.attacker.stats.spDef; ctx.attacker.stats.spDef = tmpA;
    const tmpD = ctx.defender.stats.defense; ctx.defender.stats.defense = ctx.defender.stats.spDef; ctx.defender.stats.spDef = tmpD;
    return [{ message: `Défense et Défense Spé. sont échangées !`, type: 'info' }];
  }

  // Terrain moves — ID 580, 604
  if (moveId === 580 || moveName.includes('champ herbu') || moveName.includes('grassy terrain')) {
    return [{ message: `Un champ d'herbe recouvre le terrain !`, type: 'info' }];
  }
  if (moveId === 604 || moveName.includes('champ électrifié') || moveName.includes('electric terrain')) {
    return [{ message: `De l'électricité parcourt le terrain !`, type: 'info' }];
  }

  // Nightmare (Cauchemar) — ID 171
  if (moveId === 171 || moveName.includes('cauchemar') || moveName.includes('nightmare')) {
    if (ctx.defender.status !== 'sleep') return [{ message: `Mais cela échoue !`, type: 'info' }];
    return [{ message: `${ctx.defenderName} fait un cauchemar !`, type: 'status' }];
  }

  // Foresight / Odor Sleuth (Clairvoyance / Flair) — ID 193, 316
  if (moveId === 193 || moveId === 316 || moveName.includes('clairvoyance') || moveName.includes('flair') || moveName.includes('foresight')) {
    return [{ message: `${ctx.defenderName} est identifié !`, type: 'info' }];
  }

  // Sketch (Gribouille) — ID 166
  if (moveId === 166 || moveName.includes('gribouille') || moveName.includes('sketch')) {
    const lastUsed = ctx.defender.volatile.lastMoveUsed;
    if (lastUsed === undefined) return [{ message: `Mais cela échoue !`, type: 'info' }];
    const sketchedMove = getMoveData(lastUsed);
    const slot = ctx.attacker.moves.findIndex(m => m.moveId === 166);
    if (slot >= 0) {
      ctx.attacker.moves[slot] = { moveId: lastUsed, currentPp: sketchedMove.pp, maxPp: sketchedMove.pp };
    }
    return [{ message: `${ctx.attackerName} esquisse ${sketchedMove.name} !`, type: 'info' }];
  }

  // Spider Web (Toile) — ID 169
  if (moveId === 169 || moveName.includes('toile') || moveName.includes('spider web')) {
    ctx.defender.volatile.trapped = true;
    return [{ message: `${ctx.defenderName} est pris dans une toile !`, type: 'info' }];
  }

  // Heal Block (Anti-Soin) — ID 377
  if (moveId === 377 || moveName.includes('anti-soin') || moveName.includes('heal block')) {
    return [{ message: `${ctx.defenderName} ne peut plus se soigner !`, type: 'info' }];
  }

  // Embargo — ID 373
  if (moveId === 373 || moveName.includes('embargo')) {
    return [{ message: `${ctx.defenderName} ne peut plus utiliser d'objets !`, type: 'info' }];
  }

  // Mud Sport (Lance-Boue) — ID 300
  if (moveId === 300 || moveName.includes('lance-boue') || moveName.includes('mud sport')) {
    return [{ message: `L'électricité s'affaiblit !`, type: 'info' }];
  }

  // Magic Coat (Reflet Magik) — ID 277
  if (moveId === 277 || moveName.includes('reflet magik') || moveName.includes('magic coat')) {
    return [{ message: `${ctx.attackerName} dresse un reflet magique !`, type: 'info' }];
  }

  // Camouflage — ID 293
  if (moveId === 293 || moveName.includes('camouflage')) {
    return [{ message: `${ctx.attackerName} se camoufle !`, type: 'info' }];
  }

  // Trick Room (Distorsion) — ID 433
  if (moveId === 433 || moveName.includes('distorsion') || moveName.includes('trick room')) {
    return [{ message: `${ctx.attackerName} déforme les dimensions !`, type: 'trick_room' as any }];
  }

  // ===== Entry Hazards =====

  // Stealth Rock (Piège de Roc) — ID 446
  if (moveId === 446 || moveName.includes('piège de roc') || moveName.includes('stealth rock')) {
    if (!ctx.defenderSide) return [{ message: `Mais cela échoue !`, type: 'info' }];
    if (ctx.defenderSide.stealthRock) return [{ message: `Mais cela échoue !`, type: 'info' }];
    ctx.defenderSide.stealthRock = true;
    return [{ message: `Des roches pointues lévitent autour de l'équipe adverse !`, type: 'info' }];
  }

  // Spikes (Picots) — ID 191
  if (moveId === 191 || moveName.includes('picots') || moveName.includes('spikes')) {
    if (!ctx.defenderSide) return [{ message: `Mais cela échoue !`, type: 'info' }];
    if (ctx.defenderSide.spikes >= 3) return [{ message: `Mais cela échoue !`, type: 'info' }];
    ctx.defenderSide.spikes++;
    return [{ message: `Des picots sont dispersés autour de l'équipe adverse !`, type: 'info' }];
  }

  // Toxic Spikes (Pics Toxik) — ID 390
  if (moveId === 390 || moveName.includes('pics toxik') || moveName.includes('toxic spikes')) {
    if (!ctx.defenderSide) return [{ message: `Mais cela échoue !`, type: 'info' }];
    if (ctx.defenderSide.toxicSpikes >= 2) return [{ message: `Mais cela échoue !`, type: 'info' }];
    ctx.defenderSide.toxicSpikes++;
    return [{ message: `Des pics empoisonnés sont dispersés autour de l'équipe adverse !`, type: 'info' }];
  }

  // Sticky Web (Toile Gluante) — ID 564
  if (moveId === 564 || moveName.includes('toile gluante') || moveName.includes('sticky web')) {
    if (!ctx.defenderSide) return [{ message: `Mais cela échoue !`, type: 'info' }];
    if (ctx.defenderSide.stickyWeb) return [{ message: `Mais cela échoue !`, type: 'info' }];
    ctx.defenderSide.stickyWeb = true;
    return [{ message: `Une toile gluante se déploie autour de l'équipe adverse !`, type: 'info' }];
  }

  // ===== Screens =====

  // Reflect (Protection) — ID 115
  if (moveId === 115 || moveName === 'protection' || moveName === 'reflect') {
    if (!ctx.attackerSide) return [{ message: `Mais cela échoue !`, type: 'info' }];
    if (ctx.attackerSide.reflect > 0) return [{ message: `Mais cela échoue !`, type: 'info' }];
    ctx.attackerSide.reflect = 5;
    return [{ message: `Un mur protecteur physique est dressé !`, type: 'info' }];
  }

  // Light Screen (Mur Lumière) — ID 113
  if (moveId === 113 || moveName.includes('mur lumière') || moveName.includes('light screen')) {
    if (!ctx.attackerSide) return [{ message: `Mais cela échoue !`, type: 'info' }];
    if (ctx.attackerSide.lightScreen > 0) return [{ message: `Mais cela échoue !`, type: 'info' }];
    ctx.attackerSide.lightScreen = 5;
    return [{ message: `Un mur protecteur spécial est dressé !`, type: 'info' }];
  }

  // Aurora Veil (Voile Aurore) — ID 694
  if (moveId === 694 || moveName.includes('voile aurore') || moveName.includes('aurora veil')) {
    if (!ctx.attackerSide) return [{ message: `Mais cela échoue !`, type: 'info' }];
    if (ctx.attackerSide.auroraVeil > 0) return [{ message: `Mais cela échoue !`, type: 'info' }];
    ctx.attackerSide.auroraVeil = 5;
    return [{ message: `Un voile de lumière protège l'équipe !`, type: 'info' }];
  }

  // Tailwind (Vent Arrière) — ID 366
  if (moveId === 366 || moveName.includes('vent arrière') || moveName.includes('tailwind')) {
    if (!ctx.attackerSide) return [{ message: `Mais cela échoue !`, type: 'info' }];
    ctx.attackerSide.tailwind = 4;
    return [{ message: `Un vent arrière souffle derrière l'équipe !`, type: 'info' }];
  }

  // ===== Hazard removal =====

  // Defog (Anti-Brume) — ID 432
  if (moveId === 432 || moveName.includes('anti-brume') || moveName.includes('defog')) {
    const logs: BattleLogEntry[] = [];
    if (ctx.defenderSide) {
      ctx.defenderSide.reflect = 0; ctx.defenderSide.lightScreen = 0; ctx.defenderSide.auroraVeil = 0;
    }
    if (ctx.attackerSide) {
      const cleared = ctx.attackerSide.stealthRock || ctx.attackerSide.spikes > 0 || ctx.attackerSide.toxicSpikes > 0 || ctx.attackerSide.stickyWeb;
      ctx.attackerSide.stealthRock = false; ctx.attackerSide.spikes = 0; ctx.attackerSide.toxicSpikes = 0; ctx.attackerSide.stickyWeb = false;
      if (cleared) logs.push({ message: `Les pièges autour de l'équipe sont dissipés !`, type: 'info' });
    }
    if (ctx.defenderSide) {
      const cleared = ctx.defenderSide.stealthRock || ctx.defenderSide.spikes > 0 || ctx.defenderSide.toxicSpikes > 0 || ctx.defenderSide.stickyWeb;
      ctx.defenderSide.stealthRock = false; ctx.defenderSide.spikes = 0; ctx.defenderSide.toxicSpikes = 0; ctx.defenderSide.stickyWeb = false;
      if (cleared) logs.push({ message: `Les pièges adverses sont aussi dissipés !`, type: 'info' });
    }
    return logs;
  }

  // Rapid Spin — ID 229 (also does damage but clears own hazards)
  if (moveId === 229 || moveName.includes('tour rapide') || moveName.includes('rapid spin')) {
    if (ctx.attackerSide) {
      ctx.attackerSide.stealthRock = false; ctx.attackerSide.spikes = 0; ctx.attackerSide.toxicSpikes = 0; ctx.attackerSide.stickyWeb = false;
    }
    ctx.attacker.volatile.bound = 0;
    ctx.attacker.volatile.leechSeed = false;
    return [{ message: `${ctx.attackerName} se libère des pièges !`, type: 'info' }];
  }

  // Substitute (Clonage) — ID 164
  if (moveId === 164 || moveName.includes('clonage') || moveName.includes('substitute')) {
    const cost = Math.floor(ctx.attacker.maxHp / 4);
    if (ctx.attacker.currentHp <= cost || ctx.attacker.volatile.substituteHp > 0) {
      return [{ message: `Mais cela échoue !`, type: 'info' }];
    }
    ctx.attacker.currentHp -= cost;
    ctx.attacker.volatile.substituteHp = cost;
    return [{ message: `${ctx.attackerName} crée un clone !`, type: 'info' }];
  }

  // Nature Power (Force Nature) — ID 267: becomes a move based on terrain (default: Tri Attack)
  if (moveId === 267 || moveName.includes('force nature') || moveName.includes('nature power')) {
    // In the absence of terrain tracking, defaults to Tri Attack (ID 161)
    return executeRandomMove(ctx, getMoveData(161), 'Force Nature');
  }

  // Trick (Tour de Magie) — ID 271: swap held items (same as Switcheroo/Passe-Passe)
  if (moveId === 271 || moveName.includes('tour de magie') || moveName === 'trick') {
    const tmpItem = ctx.attacker.heldItem;
    ctx.attacker.heldItem = ctx.defender.heldItem;
    ctx.defender.heldItem = tmpItem;
    return [{ message: `${ctx.attackerName} échange les objets tenus !`, type: 'info' }];
  }

  // Skill Swap (Échange) — ID 285: swap abilities
  if (moveId === 285 || moveName.includes('échange') || moveName.includes('skill swap')) {
    const tmpAbility = ctx.attacker.ability;
    ctx.attacker.ability = ctx.defender.ability;
    ctx.defender.ability = tmpAbility;
    return [{ message: `${ctx.attackerName} échange les talents avec ${ctx.defenderName} !`, type: 'info' }];
  }

  // Telekinesis (Lévikinésie) — ID 477: target floats for 3 turns
  if (moveId === 477 || moveName.includes('lévikinésie') || moveName.includes('telekinesis')) {
    ctx.defender.volatile.magnetRise = 3; // Reuses magnetRise for ground immunity
    return [{ message: `${ctx.defenderName} est soulevé dans les airs !`, type: 'info' }];
  }

  // Magic Room (Zone Magique) — ID 478: suppress held items for 5 turns
  if (moveId === 478 || moveName.includes('zone magique') || moveName.includes('magic room')) {
    // Simplified: nullify both held items
    ctx.attacker.heldItem = null;
    ctx.defender.heldItem = null;
    return [{ message: `Une zone mystérieuse annule les effets des objets tenus !`, type: 'info' }];
  }

  // Misty Terrain (Champ Brumeux) — ID 581
  if (moveId === 581 || moveName.includes('champ brumeux') || moveName.includes('misty terrain')) {
    return [{ message: `De la brume recouvre le terrain !`, type: 'info' }];
  }

  // Speed Swap (Permuvitesse) — ID 683
  if (moveId === 683 || moveName.includes('permuvitesse') || moveName.includes('speed swap')) {
    const tmpSpd = ctx.attacker.stats.speed;
    ctx.attacker.stats.speed = ctx.defender.stats.speed;
    ctx.defender.stats.speed = tmpSpd;
    return [{ message: `${ctx.attackerName} échange sa Vitesse avec ${ctx.defenderName} !`, type: 'info' }];
  }

  // Psychic Terrain (Champ Psychique) — ID 678
  if (moveId === 678 || moveName.includes('champ psychique') || moveName.includes('psychic terrain')) {
    return [{ message: `Le terrain se charge d'énergie psychique !`, type: 'info' }];
  }

  // Dragon Cheer (Cri Draconique) — ID 913
  if (moveId === 913 || moveName.includes('cri draconique') || moveName.includes('dragon cheer')) {
    ctx.attacker.volatile.focusEnergy = true;
    return [{ message: `${ctx.attackerName} pousse un cri draconique ! Taux de critique augmenté !`, type: 'info' }];
  }

  // Default fallback for remaining unhandled moves
  return [{ message: `${ctx.attackerName} utilise ${ctx.move.name} !`, type: 'info' }];
}

export function getEffectHandler(type: string): EffectHandler | undefined {
  return effectHandlers[type];
}

export { effectHandlers };
