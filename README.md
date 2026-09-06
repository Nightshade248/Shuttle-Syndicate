# Shuttle Syndicate V1.4.5

Shuttle Syndicate is a browser-based private recurring weekend 2v2 badminton tournament organizer.

## V1.4.5 changes

1. Shared Player/Game Board links no longer expose the `ADMIN` button.
2. Live tournament state can synchronize across devices through Supabase Realtime.
3. Live court opponents are displayed side by side with a centered `VS` for both Round Robin and Team vs Team.

The existing V1.4.4 tournament engine, scheduling rules, rankings, playoffs, Trump Cards, and result flow are preserved.

## Realtime setup

GitHub Pages is static hosting, so V1.4.5 uses Supabase as the central tournament state store.

### 1. Create a Supabase project

Create a project in Supabase and open its SQL Editor.

### 2. Run the database setup

Run the complete contents of:

`supabase-schema.sql`

The schema creates `public.shuttle_tournaments`, enables Realtime, and creates the `upsert_shuttle_tournament` RPC. The RPC uses a per-tournament admin possession key. The key is stored in the browser session and hashed in the database; it is not included in the shared player state.

### 3. Configure the browser client

Edit `supabase-config.js`:

```js
window.SHUTTLE_SUPABASE = {
  url: "https://YOUR-PROJECT.supabase.co",
  anonKey: "YOUR-PUBLISHABLE-OR-ANON-KEY"
};
```

Use only the public/publishable (anon) key. Never use a `service_role` key in this project.

### 4. Generate and share a tournament

Admin opens:

`#admin`

Generate the tournament. The generated Game Board link now contains only the tournament ID, not the complete tournament JSON.

Player devices open the shared `#board=<tournament-id>` link. They read the central tournament state and subscribe to its Realtime updates.

### 5. Live scoring

The Admin view is the score-entry view. Player/shared links are read-only for scores.

When the Admin confirms a score:

`Admin → Supabase → Realtime → all connected Player links`

The same tournament state updates on every connected device.

## Local validation

Run:

```bash
npm test
npm run build
```

The comprehensive core tests continue to cover schedule generation, initial court allocation, live flow, rankings, playoffs, configuration limits, and both tournament types.

## Important security boundary

V1.4.5 removes Admin controls from the shared player UI and uses a per-tournament admin possession key for realtime writes. It is not a full user-account authentication system. A future version can replace the possession key with Supabase Auth and role-based RLS for stronger identity-based administration.
