import { PokemonInstance, StatusCondition } from '../types/pokemon';
import { getPokemonData } from '../utils/dataLoader';

/**
 * Pokémon capture formula (Gen III+):
 *
 * a = ((3*HPmax - 2*HPcurrent) * CatchRate * BallBonus) / (3*HPmax)
 * a = a * StatusBonus
 *
 * StatusBonus: Sleep/Freeze=2.5, Paralysis/Poison/Burn=1.5, None=1
 * BallBonus: Poké Ball=1, Super Ball=1.5, Hyper Ball=2
 *
 * If a >= 255: instant capture
 * Otherwise: 4 shake checks, each succeeds if rand(0-65535) < b
 * where b = 65536 / sqrt(sqrt(255/a))
 */

function getStatusBonus(status: StatusCondition): number {
  switch (status) {
    case 'sleep':
    case 'freeze':
      return 2.5;
    case 'paralysis':
    case 'poison':
    case 'burn':
      return 1.5;
    default:
      return 1;
  }
}

export interface CatchResult {
  success: boolean;
  shakes: number; // 0-4, 4 = caught
  messages: string[];
}

export function attemptCatch(
  target: PokemonInstance,
  ballMultiplier: number
): CatchResult {
  const data = getPokemonData(target.dataId);
  const messages: string[] = [];

  // Calculate 'a'
  const hpMax = target.maxHp;
  const hpCurrent = target.currentHp;
  const catchRate = data.catchRate;

  let a = ((3 * hpMax - 2 * hpCurrent) * catchRate * ballMultiplier) / (3 * hpMax);
  a *= getStatusBonus(target.status);
  a = Math.floor(a);

  // Instant capture
  if (a >= 255) {
    messages.push('Gotcha !');
    return { success: true, shakes: 4, messages };
  }

  // Calculate 'b' for shake checks
  const b = Math.floor(65536 / Math.sqrt(Math.sqrt(255 / a)));

  // 4 shake checks
  let shakes = 0;
  for (let i = 0; i < 4; i++) {
    const roll = Math.floor(Math.random() * 65536);
    if (roll < b) {
      shakes++;
    } else {
      break;
    }
  }

  if (shakes === 4) {
    messages.push('Gotcha !');
    return { success: true, shakes: 4, messages };
  }

  // Failed capture messages
  const failMessages = [
    'Oh non ! Le Pokémon s\'est libéré !',
    'Mince ! C\'était presque ça !',
    'Aargh ! Encore un peu !',
    'Zut ! Le Pokémon s\'est échappé !',
  ];
  messages.push(failMessages[Math.min(shakes, failMessages.length - 1)]);

  return { success: false, shakes, messages };
}
