# OTTOPLAY Arena - Phase 0 Baseline

Baseline date: 2026-10-17 (Asia/Jakarta)
Environment inspected: Supabase production project

## Scope completed

- Confirmed the Event -> Arena migration is applied in Supabase.
- Confirmed the latest migration is `20261017150814_stabilize_event_arena_flow`.
- Inventoried public tables and row counts.
- Ran Supabase security and performance advisors.
- Confirmed local build and pairing tests are green.

## Production inventory

| Table | Rows | RLS |
| --- | ---: | --- |
| `kocok_arena_venues` | 49 | enabled |
| `kocok_arena_history` | 40 | enabled |
| `kocok_arena_matches` | 256 | enabled |
| `arena_rooms` | 37 | enabled |
| `arena_players` | 290 | enabled |
| `arena_matches` | 342 | enabled |
| `arena_player_stats` | 78 | enabled |
| `roles` | 10 | enabled |
| `profiles` | 10 | enabled |
| `user_roles` | 11 | enabled |
| `kocok_arena_meta` | 18 | enabled |
| `organizations` | 4 | enabled |
| `organization_members` | 24 | enabled |
| `organization_invites` | 0 | enabled |
| `venues` | 4 | enabled |
| `courts` | 17 | enabled |
| `events` | 4 | enabled |
| `event_players` | 13 | enabled |
| `event_staff` | 8 | enabled |

## Findings to carry into staging

### Security

- Three legacy Arena tables have RLS enabled with no policies. Access currently relies on security-definer RPCs; this must be covered by RLS/RPC tests before public launch.
- Supabase reports 16 security-definer functions executable by `anon` or `authenticated`. Some are intentional for public guest registration and Arena access, but host/admin functions need an explicit allowlist.
- Leaked-password protection is disabled in Supabase Auth and should be enabled before public launch.

### Performance

- Ten foreign-key columns are missing covering indexes.
- Seven RLS policies re-evaluate `auth.*` per row and should use the initplan-safe `(select auth.uid())` pattern.
- Six tables have overlapping permissive policies. These are candidates for consolidation after permission behavior is covered by tests.

## Staging gate

The Supabase staging branch was requested but could not be created from this session because the connector requires a cost confirmation ID that is not available here. No production data was changed by that failed attempt.

Before the next database migration:

1. Create a Supabase staging branch and record its project reference.
2. Apply all migrations to staging from a clean database.
3. Run anonymous and authenticated RPC/RLS tests.
4. Run the Event -> Arena smoke test with a real staging event.
5. Only after the gate passes, apply the migration to production.

## Current application gate

- `npm.cmd run build`: passed.
- `npm.cmd test`: 29 passed.
- Event -> Arena session sharing and status transition migration are present locally and applied to production.

## Environment commands

- Development app: `npm run dev`
- Production-config app: `npm run dev:prod`
- Push development migrations: `npm run db:dev`
- Push production migrations: `npm run db:prod`
- Push both in order: `npm run db:both`

`db:both` always pushes development first and production second. Do not use
`supabase db reset` for these existing databases.
