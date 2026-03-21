# PokeRoad

A browser-based Pokemon RPG built with React and TypeScript, featuring a Gen 9-accurate battle engine, full Kanto region exploration, and data powered by Supabase.

## Overview

PokeRoad is a single-player Pokemon adventure game that runs entirely in the browser. Players explore the Kanto region, battle wild Pokemon and trainers, earn gym badges, challenge the Elite Four, and complete post-game content. The game uses French language throughout.

**Current version:** 0.4.0
**Current region:** Kanto (Gen 1) — 58 zones (cities, routes, dungeons)
**Pokemon available:** 151 (Gen 1 roster)
**Moves in database:** 919 (all generations, ready for future regions)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite |
| State | Zustand (gameStore + battleStore) |
| Backend | Supabase (PostgreSQL) |
| Local Cache | IndexedDB (via `idb`) |
| Styling | CSS-in-JS (inline styles) |
| Audio | Web Audio API (synthesized) |

## Architecture

```
Supabase (PostgreSQL)
    |
    v  (sync on app load / version bump)
IndexedDB (browser cache)
    |
    v  (initializeData)
In-memory registries (Map<id, Data>)
    |
    v
React components (Zustand stores)
```

Data flows one way: **Supabase -> IndexedDB -> Memory -> UI**. The game works offline after the initial sync. A `LOCAL_DATA_VERSION` constant in `db.ts` triggers re-sync when bumped.

## Project Structure

```
src/
├── components/
│   ├── battle/         BattleScreen, MoveSelection, PokemonDisplay, BattleLog
│   ├── navigation/     WorldMap, CityMenu, RouteMenu
│   ├── scenes/         HallOfFame
│   ├── shop/           ShopMenu (buy/sell)
│   ├── team/           TeamView, PCStorage
│   └── ui/             Button, HealthBar, StatusIcon, Modal, InventoryScreen,
│                       PokedexScreen, LeagueMenu, NotificationOverlay
├── engine/
│   ├── battleEngine.ts         Core turn execution, status effects, AI
│   ├── moveEffects.ts          Effect handlers (89 override moves for Gen 1)
│   ├── abilityEffects.ts       100+ ability implementations
│   ├── heldItemEffects.ts      40+ held item battle effects
│   ├── damageCalculator.ts     Gen 9 damage formula
│   ├── statCalculator.ts       Stat stage calculations
│   ├── experienceCalculator.ts XP, EVs, IVs, level-up
│   ├── evolutionEngine.ts      Level / stone / trade evolutions
│   ├── catchCalculator.ts      Catch rate formula
│   ├── itemLogic.ts            Item usage logic
│   └── pcStorage.ts            PC box system (30 boxes x 30 slots)
├── stores/
│   ├── gameStore.ts            Main game state (team, inventory, progress, zones)
│   └── battleStore.ts          Battle state (phases, turns, weather, hazards)
├── types/
│   ├── pokemon.ts              Pokemon data, instances, volatile status
│   ├── battle.ts               Battle state, side conditions
│   ├── game.ts                 Zones, trainers, gyms, progress
│   └── inventory.ts            Items, categories
├── utils/
│   ├── dataLoader.ts           In-memory registries + data access functions
│   ├── db.ts                   IndexedDB schema + Supabase sync engine
│   ├── supabaseClient.ts       Supabase client init
│   ├── saveManager.ts          Game save/load
│   ├── SoundManager.ts         Web Audio synth (click, damage, victory)
│   └── typeColors.ts           Type color palette
└── data/
    └── typeChart.json          18x18 type effectiveness matrix
```

## Battle Engine

The battle system targets Gen 9 mechanics:

- **Damage formula:** `((2*Level/5 + 2) * Power * Atk/Def / 50 + 2) * modifiers`
- **Modifiers:** STAB, type effectiveness, weather, critical hits, screens, badge boosts, abilities, held items
- **Status conditions:** Paralysis, poison, toxic, burn, freeze, sleep
- **Volatile effects:** Confusion, substitute, leech seed, curse, perish song, taunt, encore, protect, future sight, and 20+ more
- **Side conditions:** Reflect, Light Screen, Aurora Veil, Spikes, Toxic Spikes, Stealth Rock, Sticky Web, Tailwind
- **Weather:** Sun, Rain, Sandstorm, Hail
- **Move types:** Physical, Special, Status with full priority system
- **Special moves:** Charge (Solar Beam), multi-hit, rampage (Thrash), recharge (Hyper Beam), OHKO, fixed damage, delayed (Future Sight)
- **AI:** Type-matchup-based move selection with taunt/disable/encore awareness

## Game Features

### Implemented

- **World exploration** — 58 Kanto zones with progressive unlocking (badge gates, story events, item requirements)
- **Wild encounters** — Grass, water, fishing, cave encounters with level ranges
- **Trainer battles** — Route trainers, rival encounters, gym leaders with themed teams
- **Gym system** — 8 Kanto gyms with badges that unlock zones and boost stats in battle
- **Elite Four + Champion** — 5-battle league gauntlet with hall of fame
- **Team management** — Party of 6 + PC storage (30 boxes, drag-and-drop reorder)
- **Held items** — Equip items to Pokemon from inventory (Choice Band, Leftovers, Life Orb, etc.)
- **Evolution** — Level-up, evolution stones, with modal for learning new moves
- **Shop system** — City-specific inventories with progression-gated stock (basic items early, competitive items late)
- **Pokedex** — Seen/caught tracking for all 151 Pokemon
- **Save/load** — Auto-save to IndexedDB, manual save available
- **Safari Zone** — Balls, rocks, bait mechanics
- **Post-game** — Mew sidequest (hidden, multi-step)
- **Game speed** — 1x, 2x, 4x speed settings
- **Shiny Pokemon** — 1/4096 encounter rate

### Known Gaps (Kanto)

- Evolution stones not yet available in shops (~20 Pokemon locked behind stone evolutions)
- No trade evolution system (13 Pokemon affected)
- No fishing rod source (water Pokemon limited)
- Wild encounter coverage: ~66/151 Pokemon obtainable through encounters alone
- Some shop inventories may appear empty if IndexedDB cache is stale (hard refresh fixes this)

## Supabase Tables

| Table | Purpose |
|-------|---------|
| `pokemon` | Base stats, types, sprites, abilities, evolution chains |
| `moves` | Name, type, power, accuracy, PP, effects, priority |
| `pokemon_learnset` | Level-up move learning per Pokemon |
| `items` | Name, price, category, effect, usability flags |
| `zones` | Cities/routes/dungeons with connections, NPCs, shops |
| `wild_encounters` | Zone encounters by type (grass/water/fishing/cave) |
| `gyms` | Leaders, teams, badges, rewards |
| `trainers` | NPC trainers with teams and zone assignments |
| `game_meta` | Data versioning for cache invalidation |

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Type check
npx tsc --noEmit

# Build for production
npm run build
```

### Data Updates

When Supabase data changes:
1. Bump `LOCAL_DATA_VERSION` in `src/utils/db.ts`
2. Users will re-sync on next page load

### Dev Tools

In-game dev panel (password: `tomer`) provides:
- Generate items/Pokemon
- Add money
- Game speed controls
- Force Supabase sync
- Reset save data

## Roadmap

- [ ] Evolution stone shop availability
- [ ] Trade evolution alternative (link cable item or NPC)
- [ ] Fishing rod acquisition (NPC gift or event)
- [ ] Expand wild encounter coverage to 151/151
- [ ] Gen 2 (Johto) region and Pokemon
- [ ] Additional generations (data already supports 919 moves, all Pokemon)
- [ ] Music system (currently synth SFX only)
- [ ] Mobile touch controls optimization
