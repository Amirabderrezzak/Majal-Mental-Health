# Majal — Votre espace de santé mentale

Majal is an Algerian mental health platform connecting patients with licensed psychologists for online therapy sessions.

## Stack

- **Frontend**: Vite + React 18 + TypeScript, shadcn/ui, Tailwind, React Query. FR/AR (RTL) via `src/contexts/LanguageContext.tsx`.
- **API**: Vercel serverless functions in `api/` (8 files, `?action=` routing — Hobby plan limit is 12).
- **Data**: Supabase (Postgres + RLS + Auth + Storage + Realtime). Schema = `supabase/migrations/`.
- **Services**: SofizPay (CIB/Edahabia), Daily.co (private video rooms + meeting tokens), Resend (e-mail), Web Push (VAPID).

## Session lifecycle

1. Patient picks a slot → `payments?action=checkout` validates it server-side (hours, buffer, overlaps, Algiers time), holds it as a `pending` booking and redirects to the gateway.
2. `/payment/return` → `payments?action=confirm` re-verifies with the gateway; `pending → confirmed`. Captures still in progress are re-checked by the scheduled job (never silently dropped).
3. From 15 min before the start, **either** party opens the room with `calls?action=room`; each gets a personal Daily token (the room is private).
4. After the end, the scheduled job reads Daily attendance: both present → `done`; only the therapist → patient no-show; patient only / nobody → therapist missed it, full refund.
5. Every refund or compensation is written to the `refunds` ledger; admins process it from **Admin → Remboursements**.

Cancellation policy (`api/_lib/cancellation-policy.ts`): > 24 h → 100 % refund · 2–24 h → 70 % (30 % to the therapist) · < 2 h or no-show → 0 % (100 % to the therapist). It is measured from the **first** date a session was booked for, so rescheduling (max 2 times, ≥ 2 h before) doesn't reset it.

## Scheduled job

`GET /api/notifications?action=push-cron` with `Authorization: Bearer $CRON_SECRET`. Vercel Hobby runs it once a day (`vercel.json`). Every step is idempotent, so **also call it hourly from any external scheduler** (e.g. cron-job.org) — missed sessions, late payments and refunds are then settled within the hour.

## Environment

See `.env.example`. Required in production: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SOFIZPAY_PUBLIC_KEY` (without it checkout fails closed), `DAILY_API_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, `FRONTEND_URL`.

Supabase dashboard settings the code relies on: Auth → minimum password length **8**.

## Database

- Apply migrations with `supabase db push`. The file `20260918230000_reconcile_schema_drift.sql` is dated before already-applied migrations (it makes fresh databases buildable and is a no-op on the live one): push once with `--include-all`.
- After a schema change, regenerate types: `DATABASE_URL=… node scripts/gen-types.mjs` (or `supabase gen types typescript --linked`).

## Tests

```bash
npm test            # unit tests (availability parity, money rules, cancellation policy, reservation page)
npm run lint
npx tsc -p tsconfig.app.json --noEmit && npx tsc -p api/tsconfig.json --noEmit
```

### End-to-end (local, no Docker)

`e2e/` runs the real migrations, RLS, triggers, `api/` handlers and frontend locally:
Postgres 16 + a PostgREST/GoTrue-compatible gateway (`e2e/stack/gateway.mjs`) + the API handlers with a fake Daily and an e-mail sink (`e2e/stack/api-server.ts`) + Vite.

```bash
# once: a local Postgres 16 listening on /tmp:54322 (initdb + pg_ctl), user "postgres", trust auth
cd e2e && npm install
node e2e/stack/run.mjs       # rebuilds the DB from supabase/migrations and starts everything (:8080)
node e2e/probes.mjs          # security probes (add --before to run them on the pre-audit schema)
node e2e/journey.mjs         # full browser journey; screenshots + report in e2e/artifacts/
```
