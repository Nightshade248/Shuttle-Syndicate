# Shuttle Syndicate V1.4.4

V1.4.4 continues the V1.4.2 baseline without Supabase or authentication.

## Implemented focus
- Preserved tournament type and configuration workflow.
- Equal 2v2 mathematical schedule validation.
- Improved partner/opponent diversity scheduling.
- Player check-in and explicit START LEAGUE.
- Independent court replacement when a court finishes, with live eligibility based on the currently selected/available players.
- New tournaments begin with every player unchecked; the organizer checks in only players available at the start, and can add late arrivals later.
- Duplicate live/next candidate prevention.
- Dynamic NEXT and ON DECK candidate views.
- Live score entry with no browser spinner arrows.
- Full schedule/player filtering and ranking statistics.
- Completed league score correction with automatic ranking recalculation.
- Team-vs-Team playoff paths for 12–14 and 16+ players.
- Round Robin Top-8 qualification and Trump Card assignment.
- Interactive semifinal/final playoff scoring and winner propagation.
- Champion appears only after the final.
- Result banner generated from tournament data and downloadable as SVG after the final.
- Responsive layout for desktop and mobile.
- Live fixture names are kept together as readable side-by-side team strings for clearer score entry.
- Team-vs-Team rankings are ranked independently inside Sky Smashers and Net Hunters; top 4 in each team are highlighted, while the 16+ player qualifier path still exposes ranks 5–6.
- Footer preserved as `Created by Irfan Shaik`.

## Admin page and weekly tournaments
- The app has a permanent Admin entry in the top bar.
- The admin page is also addressable with `#admin`, so after GitHub Pages deployment you can bookmark the Admin URL.
- Create each new weekly tournament from Admin, generate its tournament-specific `#board=...` Game Board link, and share that link with players.
- This version has no authentication: anyone who has the deployed site can reach the Admin page.
- Tournament state is browser/localStorage based; the encoded board link carries the tournament state but is not realtime synchronized across devices.

## Run

```bash
npm.cmd install
npm.cmd run dev -- --host 0.0.0.0
```

V1.4.4 remains local/browser-state based. The encoded Game Board link is not realtime synchronized across devices. Supabase remains deferred.
