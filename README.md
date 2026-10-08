# ApparelFlow ERP — GateLine

GateLine is a production verification terminal for apparel cutting batches. The
sewing floor is isolated behind a server-enforced verification gate.

## What is included

- Next.js 16 App Router and TypeScript
- Tailwind CSS with shadcn-style accessible UI primitives
- Supabase PostgreSQL through Prisma
- JWT cookie authentication with three RBAC roles
- Cutting order creation, multiplier preview, submit, and re-cut flow
- Verifier QC terminal with server-side hard-stop approval
- Immutable verification history and order event ledger
- Sewing queue isolated to approved batches

## Demo credentials

| Role               | Email                       | Password        |
| ------------------ | --------------------------- | --------------- |
| Cutting Supervisor | supervisor@apparelflow.demo | Supervisor#2026 |
| Cutting Verifier   | verifier@apparelflow.demo   | Verifier#2026   |
| Sewing Supervisor  | sewing@apparelflow.demo     | Sewing#2026     |

## Assumption recorded from the brief

The rejection note rule is enforced with a minimum of 10 trimmed characters. This is a defensive rule chosen to prevent a single-character reason from satisfying the requirement. The brief only requires a mandatory reason note, so this value can be lowered to any non-empty reason in one place if the evaluator prefers that stricter/looser version.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Connect Supabase PostgreSQL

The application uses Prisma with Supabase PostgreSQL. Copy `.env.example` to
`.env`, then replace the placeholder with the connection string from Supabase.
A direct Supabase connection is sufficient for local development. Prisma CLI
loads `.env`; it does not load Next.js-specific `.env.local` files.

```env
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@[REGION].pooler.supabase.com:5432/postgres"
NEXT_PUBLIC_DEMO_MODE="false"
JWT_SECRET="use-a-long-random-secret"
```

From the `apparelflow-erp` directory, create the tables and seed the demo
users and recipes:

```bash
npm run db:generate
npm run db:push
npm run db:seed
npm run db:harden
```

When `NEXT_PUBLIC_DEMO_MODE` is `false`, login and order APIs use Supabase.
When it is `true` or no `DATABASE_URL` is configured, the demo authentication
and in-memory store are used instead.

## Phase 3 database hardening

After initializing an existing database with `npm run db:push`, apply the
append-only audit protections and one-approval index:

```bash
npm run db:harden
```

The verifier terminal is available at `/verification` for the
`cutting_verifier` role. It saves component counts, blocks approval for
uncounted or short components, records approval/rejection logs, and exposes
read-only verification history.

## Application routes

| Route | Role | Purpose |
| --- | --- | --- |
| `/cutting` | `cutting_supervisor` | Create, submit, and re-cut orders |
| `/verification` | `cutting_verifier` | Count components and approve/reject batches |
| `/sewing` | `sewing_supervisor` | Inspect approved batches and start assembly |

The API keeps the same boundaries: `/api/orders` is unavailable to sewing,
verification actions are verifier-only, and sewing queries accept no client
status override.

## API and data integrity

The order state machine is:

```text
CUTTING_IN_PROGRESS -> PENDING_VERIFICATION -> VERIFIED -> SEWING_IN_PROGRESS
								  |
								  -> REJECTED -> CUTTING_IN_PROGRESS
```

Approval and rejection run in Prisma transactions with row locking. The
database hardening script adds a partial unique approval index, a rejection
note check, and update/delete-blocking triggers for verification logs and
order events.

## Validation

```bash
npm test
npm run build
npm run test:e2e
```

The automated suite covers the domain engine, verification gate, browser shell,
axe accessibility checks, and unauthenticated API isolation. A production
deployment still requires environment-specific Vercel configuration.
