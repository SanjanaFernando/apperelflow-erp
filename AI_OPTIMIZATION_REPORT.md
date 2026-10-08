# AI Optimization Report

## 1. What was implemented

The project began as a Next.js shell with a demo store. The implementation was
incrementally moved behind a Prisma repository so Supabase PostgreSQL is the
source of truth when `NEXT_PUBLIC_DEMO_MODE=false`. The domain layer remains
pure TypeScript for multiplier, traffic-light, wastage, and gate calculations.

Phase 3 and 4 add transactional verification decisions, immutable audit
records, role-isolated sewing queries, and the verified-to-sewing transition.
The UI uses small Tailwind/shadcn-style primitives rather than putting business
rules in client components.

## 2. Useful engineering decisions

- A global Prisma client avoids connection churn during Next.js development.
- Approval uses `SELECT ... FOR UPDATE` plus compare-and-set status updates so
  racing decisions cannot both succeed.
- The approve body is ignored; verifier identity comes from the session.
- Sewing queue SQL is pinned to `VERIFIED` and active SQL is pinned to
  `SEWING_IN_PROGRESS`, preventing query-parameter bypasses.
- `db:harden` exists because the connected Supabase database was initialized
  with `db push` before the hand-written integrity SQL was added.

## 3. Tradeoffs and known limits

- Demo mode keeps an in-memory store for fast unit tests and local exploration;
  production mode uses Supabase.
- The app has focused unit/domain coverage plus a Playwright smoke and axe
  contrast check. A full stateful browser flow against a dedicated test
  database remains deployment-environment work.
- The project uses local shadcn-style primitives under `src/components/ui`;
  the full shadcn generator/Radix catalog is intentionally not required for
  the current screens.
- `db:push` is retained for the existing Supabase setup. New production
  environments should adopt a fully baselined Prisma migration history before
  using `db:migrate` as the deployment gate.

## 4. Validation evidence

- `npm test`: 8 tests passing across the order and verification domain suites.
- `npm run build`: successful Next.js production build with cutting,
  verification, and sewing routes compiled.
- `npm run test:e2e`: Playwright login accessibility and unauthenticated sewing
  API isolation checks pass.
- `npm run db:harden`: successfully applied the Phase 3 audit protections to
  the connected Supabase database.