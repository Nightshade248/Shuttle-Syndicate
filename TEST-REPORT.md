# Shuttle Syndicate V1.4.5 — Validation Report

## Scope

V1.4.5 contains exactly three requested product changes:

- remove Admin exposure from shared player links;
- synchronize live tournament state through Supabase Realtime when configured;
- display opposing names side by side in the Live Board for Round Robin and Team vs Team.

## Core regression test

`npm test`

Result:

`ALL COMPREHENSIVE CORE TESTS PASSED`

Covered by the inherited V1.4.4 suite:

- valid configurations;
- Round Robin schedules;
- Team vs Team schedules;
- initial court allocation;
- partial availability;
- live flow/promotion;
- NEXT / ON-DECK uniqueness;
- ranking accounting;
- Team vs Team playoffs for 12/14 and 16+;
- Round Robin playoffs and Trump Cards;
- configuration limits.

## Realtime architecture

The browser stores the tournament locally as a fallback and publishes authorized Admin changes through the Supabase RPC `upsert_shuttle_tournament`. Player links fetch the tournament by ID and subscribe to Postgres Changes for updates.

The shared player state does not contain the Admin possession key.

## Build note

The source was syntax-checked and the complete core test suite passed in this environment. The Vite CLI was not installed in the execution environment, so `npm run build` could not be executed here; it must be run in the project directory after dependencies are installed.
