# AI Usage & Engineering Judgment Report

## 1. Tools & Prompting

GitHub Copilot was used throughout the implementation in VS Code. The work was
directed in small, reviewable tasks rather than accepting one large code
generation pass:

- **Scaffolding:** Next.js App Router, TypeScript, Tailwind CSS, Vitest, and
  Playwright setup.
- **Schema and backend:** Prisma models for users, recipes, cutting orders,
  verification items, verification logs, and order events; Supabase setup and
  seed data.
- **Domain logic:** multiplier calculations, traffic-light classification,
  wastage calculation, transition guards, and approval blockers.
- **API implementation:** JWT cookie authentication, RBAC guards, transactional
  order transitions, verifier decisions, audit history, and sewing isolation.
- **UI and styling:** Tailwind layouts, Lucide icons, local shadcn-style
  primitives, loading states, responsive workflow screens, and accessibility
  checks.
- **Validation:** repository searches, current-file inspection, TypeScript/build
  checks, Vitest, Prisma commands, and Playwright/axe checks.

Prompts were constrained by the build brief and checked against actual route
contracts and database behavior. Generated code was treated as a draft and
changed whenever tests, build diagnostics, or runtime logs disproved an
assumption.

## 2. Flawed / Broken AI Code

### A. Approval logic initially blocked valid overages

The first `canApprove()` implementation treated every quantity mismatch as a
blocker. That incorrectly rejected YELLOW items where `actualQty > expectedQty`.
The brief permits counted YELLOW overages and only blocks RED shortages or
uncounted items. This was corrected in `src/server/domain/verification.ts`, and
tests now prove that GREEN plus YELLOW items can pass while shortages and null
counts fail.

### B. Client code accidentally imported server-only headers

Shared validators initially imported `REJECTION_NOTE_MIN_LENGTH` from
`src/lib/session.ts`. That module imports `next/headers`, so the cutting page
pulled a server-only dependency into the browser bundle and the production
build failed. The constant was moved to the neutral `src/lib/constants.ts`
module, while the session module re-exports it for server callers.

### C. Database files were initially outside the deployable app root

The first Prisma scripts referenced `../prisma/schema.prisma`, and the seed
script resolved dependencies through a parent project directory. That worked
locally but was brittle for a GitHub repository rooted at `apparelflow-erp` and
would not be reliable on Vercel. The schema, seed, migration, and scripts were
moved inside the app repository and verified from that directory.

### D. The dashboard initially used misleading hardcoded metrics

The initial dashboard rendered fixed values such as “18 orders in cutting” and
“12 verified today”. Those values could look authoritative while the database
was empty. Order lists were changed to use API data, and the cutting,
verification, and sewing workspaces now load their role-scoped data.

## 3. Human Refactoring

The implementation was hardened through deliberate refactors:

- Split persistence into focused `order-repository.ts`,
  `verification-repository.ts`, and `sewing-repository.ts` modules.
- Split summary order queries from detail queries so dashboard and inbox pages
  do not load all verification items and event history unnecessarily.
- Added Prisma transactions around every state transition and wrote its
  corresponding `OrderEvent` in the same transaction.
- Added `SELECT ... FOR UPDATE` locking and compare-and-set updates for approve,
  reject, and sewing start operations.
- Recomputed item status on the server with `classifyItem()`; the API accepts
  only `componentId` and `actualQty`, ignoring forged status or verifier fields.
- Added Zod validation for integer counts, fabric precision, roll IDs, and
  rejection-note length before database writes.
- Added a partial unique approval index, rejection-note check, and immutable
  audit triggers in the Phase 3 hardening SQL.
- Added responsive Tailwind screens with explicit contrast colors, Lucide
  controls, loading states, focus styling, and an axe accessibility check.
- Removed generated build output and internal files from the GitHub-facing
  repository and strengthened `.gitignore` for nested artifacts.

## 4. Defensive Architecture

The client never owns order status. There is no generic status update endpoint.
Each transition has a separate route and server guard:

```text
CUTTING_IN_PROGRESS -> PENDING_VERIFICATION -> VERIFIED -> SEWING_IN_PROGRESS
                                  |
                                  -> REJECTED -> CUTTING_IN_PROGRESS
```

- `requireRole()` returns 401 for missing sessions and 403 for unauthorized
  roles before business logic runs.
- Cutting supervisors can create and submit only their own orders.
- Verifiers can update counts and approve/reject only orders in
  `PENDING_VERIFICATION`.
- Sewing supervisors cannot access `/api/orders` or verification endpoints;
  they receive only fixed `VERIFIED` and `SEWING_IN_PROGRESS` queues.
- Approval reloads the order and all items inside a locked transaction. Any
  missing, null, negative, or RED shortage returns `422 SHORTAGE_BLOCKED`.
- Approval and rejection identity comes from the signed session, never the
  request body.
- Rejection requires a trimmed ten-character note and increments the rejection
  counter exactly once.
- Every status change writes one append-only event in the same transaction.
- Database triggers reject updates/deletes to audit logs and events, while the
  partial unique index prevents a second approval for the same order.

This defense is duplicated intentionally: UI buttons improve usability, but the
API guards, transaction boundaries, database constraints, and immutable audit
layer remain authoritative when a client is forged or bypassed.

## Validation Evidence

- `npm test`: 8 unit/domain/API tests pass.
- `npm run build`: production Next.js build passes.
- `npm run test:e2e`: Playwright login accessibility and unauthenticated
  sewing API isolation checks pass.
- `npm run db:harden`: Phase 3 audit protections applied to Supabase.
