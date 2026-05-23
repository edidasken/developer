# FlockSort — Build Plan
### Water-Sort Puzzle Game · FlockOS New Covenant · v1.0

**Vision:** A completely free, no-friction water-color sorting puzzle game built natively into FlockOS.  
Same satisfying gameplay as Magic Sort — tap to pour colored water between bottles until each bottle holds only one color — but stripped of every monetization mechanic. No coins. No lives. No timers. No waiting. Just pure puzzle.

---

## MASTER TO-DO LIST

> Mark `[x]` after each task is completed. This is the source of truth for execution order.

### Phase 0 — Scaffolding & File Structure
- [ ] FS-0-1: Create `New_Covenant/flock.sort/flock_sort.html` — standalone PWA shell
- [ ] FS-0-2: Create `New_Covenant/flock.sort/flock_sort.css` — game-specific styles
- [ ] FS-0-3: Create `New_Covenant/flock.sort/flock_sort.js` — core game engine (ES module)
- [ ] FS-0-4: Create `New_Covenant/flock.sort/levels.js` — level data pack (export const LEVELS)
- [ ] FS-0-5: Create `New_Covenant/flock.sort/manifest.json` — PWA manifest for FlockSort
- [ ] FS-0-6: Add `app.embeds/embed-flocksort.html` per new-app-rule
- [ ] FS-0-7: Add B-Build Firebase patch step for `flock.sort/` folder (following embed-stand pattern)
- [ ] FS-0-8: BCP

### Phase 1 — Core Game Engine
- [ ] FS-1-1: Implement `Bottle` data model — `{ id, slots: Color[], capacity: 4 }`
- [ ] FS-1-2: Implement `pour(fromId, toId)` — validates move rules, executes pour, returns undo snapshot
- [ ] FS-1-3: Implement `isValidPour(from, to)` — rules: top color must match OR target empty, target must have space
- [ ] FS-1-4: Implement `isSolved(bottles)` — every bottle is either empty or all-one-color
- [ ] FS-1-5: Implement undo stack (max 50 moves) — `undoMove()` restores prior snapshot
- [ ] FS-1-6: Implement `restartLevel()` — resets to initial level state from LEVELS data
- [ ] FS-1-7: Implement `loadLevel(levelIndex)` — deep-clones level from LEVELS, initializes game state
- [ ] FS-1-8: Write unit test suite (plain JS, no framework) in `flock.sort/tests.js` — covers all engine functions
- [ ] FS-1-9: BCP

### Phase 2 — Level Pack (100 Launch Levels)
- [ ] FS-2-1: Author 10 tutorial levels (3–4 bottles, 2 colors) — teaches mechanics
- [ ] FS-2-2: Author 20 easy levels (4–5 bottles, 3 colors)
- [ ] FS-2-3: Author 30 medium levels (5–6 bottles, 4–5 colors)
- [ ] FS-2-4: Author 25 hard levels (7–8 bottles, 5–6 colors)
- [ ] FS-2-5: Author 15 expert levels (9–12 bottles, 6–8 colors)
- [ ] FS-2-6: Export all 100 levels as `LEVELS` array in `levels.js` — each entry: `{ id, name, bottles: [[...colors]], emptyBottles: N }`
- [ ] FS-2-7: Validate all 100 levels are solvable (manual + engine dry-run)
- [ ] FS-2-8: BCP

### Phase 3 — UI & Animation
- [ ] FS-3-1: Render bottle grid — CSS Grid, responsive (2–4 columns based on bottle count)
- [ ] FS-3-2: Render each bottle as a `<div>` with 4 stacked color segments (CSS `flex-direction: column-reverse`)
- [ ] FS-3-3: Implement tap/click selection — first tap selects bottle (highlight ring), second tap pours
- [ ] FS-3-4: Pour animation — CSS `transform: translateY` + `opacity` transition, ~300ms, ease-out
- [ ] FS-3-5: Liquid fill animation — segments animate height from 0 to full on arrival
- [ ] FS-3-6: Wobble/shake animation on invalid pour attempt
- [ ] FS-3-7: Level-complete celebration — `confetti` burst (pure CSS + JS, no library) + "Well Done!" overlay
- [ ] FS-3-8: Color palette — 12 named game colors, all WCAG AA compliant, distinct in both normal and color-blind modes
- [ ] FS-3-9: Bottle count auto-scales layout — 4 bottles: 2×2, 6: 3×2, 8: 4×2, 10: 5×2, 12: 4×3
- [ ] FS-3-10: BCP

### Phase 4 — App Shell & Navigation
- [ ] FS-4-1: Top bar — "FlockSort" wordmark + level number + move counter
- [ ] FS-4-2: Action buttons — Undo (↩), Restart (↺), Menu (☰) — always visible, no coins required
- [ ] FS-4-3: Level select screen — scrollable grid of level cards (numbered, shows star rating if solved)
- [ ] FS-4-4: Settings panel — color-blind mode toggle, sound toggle, theme select
- [ ] FS-4-5: Back button routes to level select; deep-link support (`?level=42`)
- [ ] FS-4-6: Apply `new_covenant.css` theming — `var(--bg)`, `var(--bg-raised)`, `var(--ink)`, `var(--gold)` for chrome; game colors are fixed/not theme-dependent
- [ ] FS-4-7: BCP

### Phase 5 — Progress & Persistence (Local-First)
- [ ] FS-5-1: Save progress to `localStorage` — `flocksort_progress`: `{ levelsUnlocked, levelStars: {}, totalMoves }`
- [ ] FS-5-2: Unlock levels sequentially — completing level N unlocks N+1 (all 100 available from level select; locked levels shown as locked but visible)
- [ ] FS-5-3: Star rating per level — 3 stars (≤ optimal moves), 2 stars (≤ 1.5× optimal), 1 star (solved)
- [ ] FS-5-4: Total stats view — levels solved, total moves, completion percentage
- [ ] FS-5-5: "Continue" button on home — resumes last-played level
- [ ] FS-5-6: Optional: Firestore sync for authenticated FlockOS users — saves `users/{uid}/flocksort` doc with progress JSON (no Firestore dependency for guest play)
- [ ] FS-5-7: BCP

### Phase 6 — Sound (Optional, Off by Default)
- [ ] FS-6-1: Pour sound — short liquid gurgle, synthesized via Web Audio API (no audio files, no network requests)
- [ ] FS-6-2: Complete sound — short pleasant chime, Web Audio API
- [ ] FS-6-3: Invalid move — subtle click/buzz, Web Audio API
- [ ] FS-6-4: All sounds gated by `settings.soundEnabled` (localStorage) — default OFF
- [ ] FS-6-5: BCP

### Phase 7 — Integration & Build
- [ ] FS-7-1: Add FlockSort entry to `the_pillars.js` sidebar nav — icon: 🎨, label: "FlockSort", route: opens `flock.sort/flock_sort.html`
- [ ] FS-7-2: Add FlockSort card to home dashboard (`the_good_shepherd`) — shows current level + % complete
- [ ] FS-7-3: Confirm B-Build rsync includes `flock.sort/` folder — add rsync line if missing
- [ ] FS-7-4: Full regression — load FlockSort on iPhone SE, iPhone 14 Pro, desktop Chrome Guest
- [ ] FS-7-5: Lighthouse audit — Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 90
- [ ] FS-7-6: Final BCP

---

## §A — Game Rules (Engine Contract)

```
POUR RULES:
  1. Source bottle must not be empty.
  2. If target is full (all 4 slots filled), pour is INVALID.
  3. If target is non-empty, its top color must match source's top color.
  4. Only the contiguous top-color block of the source is poured.
     e.g. source = [RED, RED, BLUE, GREEN] → pours 2 RED units at once.
  5. Amount poured = min(contiguous top-block size, available space in target).
  6. Source cannot pour into itself.

SOLVED STATE:
  Every bottle is either:
    (a) completely empty, OR
    (b) filled with exactly one color (all 4 slots same color)

UNDO:
  Stores snapshots of the full bottles array.
  Restores previous state and decrements move counter.
  No limit enforced in FlockSort (Magic Sort charges coins for extra undos — we don't).
```

---

## §B — File Structure

```
New_Covenant/
  flock.sort/
    FlockSortPlan.md        ← this file
    flock_sort.html         ← standalone PWA shell
    flock_sort.css          ← game styles
    flock_sort.js           ← engine + UI controller (ES module)
    levels.js               ← export const LEVELS = [...]
    manifest.json           ← PWA manifest
    tests.js                ← unit tests (run in browser console)

  app.embeds/
    embed-flocksort.html    ← embed shell (per new-app-rule)
```

---

## §C — Data Schema

```js
// LEVELS entry
{
  id: 1,
  name: "First Steps",
  optimalMoves: 4,
  bottles: [
    ['RED',  'BLUE', 'RED',  'BLUE'],  // bottom → top
    ['BLUE', 'RED',  'BLUE', 'RED'],
    [],                                 // empty bottle
  ]
}

// Progress (localStorage key: flocksort_progress)
{
  lastLevel: 7,
  levelsUnlocked: 12,
  levelStars: { "1": 3, "2": 2, "3": 1 },
  totalMoves: 284
}
```

---

## §D — Color Palette (12 Game Colors)

| Name      | Hex       | Color-blind alt |
|-----------|-----------|-----------------|
| RED       | `#e05c5c` | shape: circle   |
| ORANGE    | `#f0954a` | shape: triangle |
| YELLOW    | `#e8c94a` | shape: star     |
| LIME      | `#82c946` | shape: plus     |
| GREEN     | `#3db86b` | shape: diamond  |
| TEAL      | `#3dbfb8` | shape: hexagon  |
| CYAN      | `#4ab0e8` | shape: crescent |
| BLUE      | `#4a74e8` | shape: square   |
| PURPLE    | `#9b5fe0` | shape: pentagon |
| PINK      | `#e05caa` | shape: heart    |
| BROWN     | `#a07040` | shape: X        |
| GRAY      | `#8898aa` | shape: wave     |

> Color-blind mode overlays a small shape icon on each water segment so colors are distinguishable without relying on hue alone.

---

## §E — "No Coins" Philosophy

Magic Sort charges coins for:
- Extra undos beyond 3
- Hints (shows next valid move)
- Skip level
- Remove ads

**FlockSort removes all of these barriers:**

| Feature            | Magic Sort    | FlockSort          |
|--------------------|---------------|--------------------|
| Undo               | 3 free, coins | Unlimited, free    |
| Hints              | Coins         | Free (Phase 2+)    |
| Skip level         | Coins         | Free (any time)    |
| All 100 levels     | Gated         | All unlocked       |
| Ads                | Yes           | None               |
| Time pressure      | None          | None               |
| Lives / energy     | None          | None               |

---

## §F — Technical Decisions

| Decision            | Choice                                          | Reason                                         |
|---------------------|--------------------------------------------------|------------------------------------------------|
| Framework           | Vanilla JS ES module                            | Matches FlockOS pattern, no build step         |
| Animation           | CSS transitions + JS class toggling             | No dependency, 60fps, respects prefers-reduced-motion |
| Audio               | Web Audio API synthesis                         | No audio files, no HTTP requests, instant      |
| Persistence         | localStorage (primary), Firestore (optional)    | Works offline, no auth required                |
| Level data          | Static JS module (levels.js)                    | No fetch, instant load, B-Build friendly       |
| CSS                 | `new_covenant.css` + `flock_sort.css`           | Consistent theming, dark navy + gold chrome    |
| PWA                 | Standalone manifest + service worker (sw.js)    | Installable, offline-capable                   |

---

## §G — Phase Execution Order

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 (optional) → Phase 7
  │           │          │          │          │          │                              │
scaffold   engine     levels      UI        shell     progress                     ship + BCP
```

Phases 1–3 can partially overlap (engine first, then levels, then wire UI to engine).
Phase 6 (sound) is optional and can be deferred post-launch.

---

*Last updated: May 21, 2026*
