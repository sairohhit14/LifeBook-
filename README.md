# LifeBook — AI-Powered Digital Legacy Platform

LifeBook lets users preserve memories, life timelines, legacy (time-capsule) messages,
family circles, and a secure document vault — with AI-assisted biography, companion chat,
image description, and video storyboarding.

## Architecture (current)

One backend, one source of truth. The previous dual-backend setup (Spring Boot + Node)
has been consolidated: **the Node/Express backend is the only backend.**

Feature highlight — **Autobiography** (`src/components/Autobiography.tsx`,
`server/autobiography-pipeline.ts`, `/api/autobiography*`): turns the user's real
memories and milestones into a source-grounded, first-person life story. The
pipeline clusters memories into chapters, detects conflicting dates/places, and
constrains Gemini to a strict biographer role (no invented people, dates, or
events; untrusted memory text is fenced against prompt injection; AI output is
validated against the chapter plan and rejected if it cites memories it wasn't
given). Generation is per-chapter with persisted progress and per-chapter retry,
never rewrites user-edited chapters, reuses unchanged chapters via a source
fingerprint, and is rate-limited. Guests (family view-only) can read a
copy only after the owner publishes it; drafts are private to the owner.

```
React/Vite SPA (src/)
        │  fetch /api/* (same-origin; Vite dev proxy or Vercel rewrite)
        ▼
Express API (server.ts, served by api/index.ts on Vercel)
        │
        ├─ Auth: custom HMAC-signed bearer tokens (7-day expiry)
        │   · password login (scrypt hashes) · OTP recovery email
        │   · Google Sign-In (Firebase Auth popup → local session)
        │   · guest "Family View-Only" sessions via Legacy Key (GET-only)
        ├─ Firebase Admin (optional): mirrors identities into Firebase Auth
        ├─ Gemini (@google/genai): biography, companion chat, image
        │   description, video storyboard — each with graceful fallbacks
        ├─ Email: SMTP (nodemailer) or Resend API; per-user config supported;
        │   Ethereal test-account fallback when unconfigured
        └─ Scheduled legacy-message delivery (in-process, every 10s)
              │
              ▼
        Data: Supabase `vault_data` (db_key/db_value rows) when configured,
        otherwise local db.json (atomic writes + mkdir lockfile)
        Files: Supabase public `uploads` bucket → Firebase Storage → local ./uploads
```

Legacy/dead components removed in the stabilization pass: Spring Boot backend,
vendored Maven toolchain, MongoDB mirror code, Firebase Data Connect SDKs,
Firebase Hosting/Functions deployment config, duplicate frontend entry files.

### Backend ownership
| Concern | Owner |
|---|---|
| API | `server.ts` (Express, TypeScript) — also serves the built SPA in production |
| Sessions | HMAC token `payload.timestamp.signature` (`SESSION_SECRET`) |
| Data | Supabase `vault_data` table (primary), `db.json` (local fallback/cache) |
| Files | Supabase `uploads` bucket → Firebase Storage → local `./uploads` |
| Email | SMTP or Resend (env or per-user Settings config) |

### Security model
- **Authentication:** custom bearer token signed with `SESSION_SECRET`; without it a
  per-boot random secret is used and all sessions reset on restart — always set
  `SESSION_SECRET` in production.
- **Authorization:** every `/api/*` resource endpoint filters by the authenticated
  `userId`; guest (Legacy Key) sessions are GET-only, enforced both in middleware and
  on the client.
- **Admin:** `GET /api/admin/metrics`, `GET /api/admin/revenue`, and `POST /api/ads`
  require `role === "admin"` in the user record. The role cannot be self-assigned via
  `POST /api/user/role`; grant it directly in the database for trusted operators.
- **Payments:** `POST /api/subscription/upgrade` is a hard 501 stub — no payment
  processor is integrated, so the API cannot mint paid invoices. The UI is hidden while
  `MONETIZATION_ENABLED=false` (`src/config.ts`). Enable both only after wiring real
  checkout + webhook verification.
- **OTP recovery:** 6-digit code, 15-minute validity, timing-safe comparison, and a
  per-user 5-attempt lockout persisted in the database (survives restarts/instances).
- **Rate limiting:** 15 auth requests/min/IP (in-memory). ponytail: per-instance only;
  add a shared store (e.g. Upstash) before running many instances.

## Data storage details

The JSON document model (collections: `users`, `memories`, `milestones`, `messages`,
`family`, `documents`, `stories`, `notifications`, `chatHistory`, …) is mirrored 1:1
into Supabase as one row per collection when `SUPABASE_URL`/`SUPABASE_KEY` are set.
Writes are serialized with a mkdir-based lockfile and atomic temp-file+rename, so
`db.json` never tears. ponytail: this document model is queryable only per-collection
in memory; if cross-user analytics or large datasets arrive, migrate to real
per-row tables with RLS.

One-time Supabase setup:

```sql
create table if not exists vault_data (
  db_key text primary key,
  db_value jsonb not null
);
```

Plus a **public** storage bucket named `uploads`. `SUPABASE_KEY` is the service-role
key: server-side only, never ship it to the client.

## Local development

```bash
npm install
npm run dev        # Express API on :3000 with Vite middleware (SPA + API together)
npm run dev:frontend  # Vite only, proxies /api + /uploads to :3000
```

Configure via `.env.local` (git-ignored) — see `.env.example` for every variable
including `SESSION_SECRET`, Supabase, Firebase, Gemini, and email settings.

## Testing & CI

```bash
npm test           # typecheck + db-race + supabase-sync + server routes + design tokens + autobiography
npm run test:browser   # headless-Chrome QA across the desktop/tablet/mobile matrix (dev server on :3000)
npm run audit:secrets  # crude committed-secret scanner (also runs in CI)
npm run build      # production SPA build
```

- `test/db-race-check.ts` — concurrent db.json write-race self-check
- `test/supabase-sync-check.ts` — vault round-trip self-check (fetch stubbed, no network)
- `test/server-routes-check.ts` — regression checks for the security-sensitive routes
  (admin gate, payment 501 stub, ad-tracker auth, role-escalation block, OTP lockout)
- `test/autobiography-check.ts` — autobiography pipeline units + route security
  (guest privacy, IDOR, idempotency, grounded generation, edit preservation, rate limits)
- `test/browser-qa.mjs` — dependency-free headless-Chrome QA: console errors, overflow,
  navigation, modals, reduced motion across 8 viewports
- `live-supabase-check.ts` — manual live check; only with your own test credentials

CI (`.github/workflows/ci.yml`): secret scan → typecheck → tests → build → artifact
verification, on every PR and push to `main`.

## Deployment (Vercel)

`vercel.json` routes `/api/*` and `/uploads/*` to `api/index.ts` (the Express app,
serverless) and everything else to the SPA. Set the same environment variables in the
Vercel project — `SESSION_SECRET` and the Supabase pair are the ones that matter;
without Supabase, the filesystem-backed db.json in `/tmp` is ephemeral per instance.

## Deployment (Render — single service)

The server binds `process.env.PORT` and serves the built SPA + API from one process,
so Render's "Web Service" works with:

- **Build command:** `npm install && npm run build`
- **Start command:** `npm start`
- Health check path: `/api/health`
- Set the same environment variables (`SESSION_SECRET` + Supabase pair matter most).
  With Supabase configured, data and uploads persist across deploys/instances.
- Deep SPA routes (`/vault`, `/settings`, …) fall back to `index.html` automatically.

Rollback: redeploy a previous Vercel build; data rollback is the Supabase project's
 PITR/backup — configure it before real users, and test a restore.

## Known limitations

- In-process scheduler + in-memory rate limiter assume a single warm instance (fine on
  one Vercel instance or a small VPS; see ponytail notes above for the upgrade path).
- Document vault files live in a **public** bucket; per-file signed URLs would be the
  next hardening step for genuinely sensitive documents.
- AI features fall back to canned content when Gemini is unavailable — service health
  is logged, not surfaced as a separate status page.
- Subscription/billing is intentionally non-functional (see Security model) until a
  real payment provider is integrated.
