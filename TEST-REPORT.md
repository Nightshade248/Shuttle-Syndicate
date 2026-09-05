## V1.4.4 release update
- Version labels updated from V1.4.3 to V1.4.4.
- Footer now displays `Created by Irfan Shaik · V1.4.4` on Admin and Game Board pages.
- Downloaded result banner footer also includes the build version.

# Shuttle Syndicate V1.4.4 — Validation Report

## Static validation
- `node --check app.js`: PASS.
- Production Vite build: NOT CLAIMED. `npm install --ignore-scripts` timed out in the isolated build environment, so `vite build` was not executed there.

## Exhaustive configuration matrix
- 301 valid combinations across both tournament types were tested.
- Player counts: 4, 6, 8, 10, 12, 14, 16, 18.
- Games/player: every value from 1–12 that satisfies the 4-player appearance rule and unique-game feasibility.
- Courts: every valid value from 1–3 for the player count.
- Every case passed:
  - exact league game count = players × games/player ÷ 4;
  - four distinct players per game;
  - equal appearances for every player;
  - no duplicate game key;
  - Team vs Team keeps Sky and Net on their required sides;
  - all configured initial courts can be filled when enough checked-in players exist.

## Bugs found and fixed during validation
1. Round Robin could generate a schedule whose first games overlapped, leaving a configured second court empty at tournament start.
   - Fixed by optimizing schedules for a disjoint initial court pack and selecting the initial live games as a disjoint set.
2. Round Robin high games/player values could take too long with the previous exhaustive candidate search.
   - Replaced it with a constrained randomized 4-player grouping search that preserves equal appearances and game uniqueness while retaining partner/opponent diversity scoring.
3. Team vs Team high games/player configurations could repeat the same Sky-pair vs Net-pair game.
   - Added duplicate-game prevention and partner-use limits.
4. The original configuration validator accepted mathematically divisible configurations that could not satisfy the no-duplicate-game rule (notably 4 players with games/player > 3).
   - Added a unique-game feasibility limit and clearer configuration validation.
5. `gamesSinceRest` was not actually measuring rest because only players who played were incremented before being reset.
   - Fixed rest tracking so available non-playing players accumulate rest credit and players who play reset to zero.
6. Round Robin Trump Card UI effectively allowed only one player per card because a card was disabled after its first selection.
   - Fixed to allow exactly two players per card and prevent a third selection.
7. Editing a completed league score after playoffs were initialized could leave stale playoff qualification/matchups.
   - League score edits now invalidate playoff state so qualification and playoff positions recalculate from the corrected league data.

## Live-flow validation
- Initial live courts are filled from checked-in players without player overlap.
- A finishing court is promoted with a separate eligible queued game when one exists.
- Live games never reuse a player across courts.
- NEXT / ON DECK candidate games do not share players with each other.
- Full-flow simulations completed for multiple Round Robin and Team vs Team configurations through all queued games.
- Partial availability was tested; the engine starts only as many courts as the checked-in player count can support.

## Ranking / playoff validation
- Player statistics correctly account for matches, wins, losses, Win %, PF, PA and Difference.
- Team vs Team rankings are recalculated within Sky and Net separately.
- 12–14 player Team vs Team playoff pattern validated.
- 16+ player Team vs Team qualifier pattern validated.
- Round Robin Top 8 qualification and semifinal structure validated.
- Trump-card pairing 1/1, 2/2, 3/3, 4/4 validated.

## Manual browser checks still required before production
- Desktop: 1920×1080 and 1366×768.
- Mobile: 390×844 and 360×800.
- Fresh tournament: all player checkboxes initially unchecked.
- Start with checked-in players and verify all configured courts start when enough players are available.
- Score entry, Schedule / Ranking, EDIT SCORE, Round Robin playoffs, Team vs Team playoffs and final result download.
- Test GitHub Pages URL on a phone after deployment.

## Scope
V1.4.4 remains local-only: no Supabase, authentication or realtime synchronization was added.
