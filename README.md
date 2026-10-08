# ApparelFlow ERP — GateLine

**GateLine** is a mission-critical apparel manufacturing ERP subsystem designed for high-precision cutting-to-sewing handoff. It enforces a server-side verification gate between the cutting room and the sewing assembly line, ensuring that defective, uncounted, or out-of-tolerance garment components never reach the sewing floor.

---

## 🔑 Demo Credentials

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Cutting Supervisor** | `supervisor@apparelflow.demo` | `Supervisor#2026` | Create cutting orders, view BOM multipliers, submit for QC, re-cut rejected orders |
| **Cutting Verifier** | `verifier@apparelflow.demo` | `Verifier#2026` | Live QC terminal, count components, enforce variance tolerances, approve/reject |
| **Sewing Supervisor** | `sewing@apparelflow.demo` | `Sewing#2026` | Access only QC-verified batches, inspect component logs, release orders to sewing lines |

---

## 🏛 Architecture Summary

GateLine is built using a modern, domain-driven, layered full-stack TypeScript architecture:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Next.js 16 App Router                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  Presentation Layer (React 19 / Tailwind CSS / Radix UI Primitives)         │
│  - /dashboard      : Executive production control room & order monitoring    │
│  - /cutting        : Cutting floor register, recipe picker, multiplier BOM  │
│  - /verification  : Verifier QC terminal with live item count verification  │
│  - /sewing         : Sewing floor assembly queue with immutable gate        │
│  - OrderDetailsModal : Universal order detail inspector with component tree │
├─────────────────────────────────────────────────────────────────────────────┤
│  API & Security Layer (Route Handlers / Edge-compatible JWT RBAC)           │
│  - jose JWT httpOnly Cookie Authentication                                  │
│  - Server-enforced requireRole() route barriers                             │
│  - Zod validation schemas across all ingestion endpoints                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Domain & Service Layer                                                     │
│  - Order State Machine Engine (domain/order-engine.ts)                      │
│  - Verification & Wastage Rules (domain/verification.ts)                    │
│  - Concurrency Lock & Extended Timeouts (Interactive Prisma Transactions)   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Persistence Layer (Prisma ORM & Supabase PostgreSQL)                       │
│  - Dual driver support: Production PostgreSQL or In-memory Demo Store       │
│  - Row-level transactions with SELECT FOR UPDATE row locking                │
│  - PostgreSQL triggers for immutable append-only audit ledgers              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Highlights

1. **Strict Server-Side State Machine**:
   - Order status transitions are never governed by client input.
   - The sewing floor only accepts batches in `VERIFIED` state. All other statuses are physically locked out.

2. **Concurrency & Race Condition Prevention**:
   - Verification decisions (`APPROVE` / `REJECT`) run inside Prisma interactive transactions with `pg_advisory_xact_lock` or row-level row locking (`SELECT FOR UPDATE`).
   - Transaction timeouts are hardened (`timeout: 30000ms`, `maxWait: 15000ms`) to handle cloud connection pooler latency.

3. **Append-Only Immutable Audit Ledger**:
   - Every verification decision is permanently recorded in `VerificationLog`.
   - Every status transition is captured in `OrderEvent`.
   - PostgreSQL triggers prevent `UPDATE` or `DELETE` mutations on audit logs.

4. **Universal Order Inspector Modal**:
   - Reusable [`OrderDetailsModal`](file:///src/components/orders/order-details-modal.tsx) embedded across Dashboard and Cutting Floor views.
   - Deep inspection into recipe codes, fabric roll IDs, expected vs actual multiplier pieces, QC color badges (`GREEN`, `YELLOW`, `RED`), and full transition logs.

---

## 🔄 Order State Machine & Business Rules

```text
       [Supervisor: Create]
                │
                ▼
      CUTTING_IN_PROGRESS  ◄────────────┐
                │                       │
       [Supervisor: Submit]       [Supervisor: Re-cut]
                │                       │
                ▼                       │
      PENDING_VERIFICATION              │
          │             │               │
  [Verifier: Approve]  [Verifier: Reject]
          │             │               │
          ▼             └────────►  REJECTED
       VERIFIED
          │
  [Sewing: Start Sewing]
          │
          ▼
   SEWING_IN_PROGRESS
```

### Business Rules & Tolerances
- **BOM Piece Multiplier**: Expected component piece quantity = $\text{Target Quantity} \times \text{Pieces Per Garment}$.
- **Item QC Classification**:
  - `GREEN` (Matched): Actual count equals expected count ($\Delta = 0$).
  - `YELLOW` (Overage): Actual count is greater than expected count ($\Delta > 0$).
  - `RED` (Shortage): Actual count is less than expected count ($\Delta < 0$).
- **Hard-Stop Approval Rule**: Approval requires **100% of components to be counted** with **zero `RED` (shortage) items**. Any shortage triggers mandatory rejection.
- **Mandatory Rejection Note**: Rejection requires a descriptive reason with a **minimum of 10 characters** (enforced at both application and PostgreSQL constraint levels).
- **Fabric Wastage Formula**:
  $$\text{Wastage \%} = \frac{\text{Actual Fabric Yards} - (\text{Target Qty} \times \text{Standard Fabric Yards})}{\text{Target Qty} \times \text{Standard Fabric Yards}} \times 100$$
  If wastage exceeds recipe's `wastageCap`, verifier is prompted with a high-wastage warning.

---

## 🗄 Database Schema Documentation

The system utilizes Prisma ORM with PostgreSQL hosted on Supabase:

### Enums
- **`UserRole`**: `cutting_supervisor` | `cutting_verifier` | `sewing_supervisor`
- **`OrderStatus`**: `CUTTING_IN_PROGRESS` | `PENDING_VERIFICATION` | `VERIFIED` | `REJECTED` | `SEWING_IN_PROGRESS`
- **`ItemStatus`**: `GREEN` | `YELLOW` | `RED`
- **`Decision`**: `APPROVED` | `REJECTED`

---

### Models & Entity Relationships

#### 1. `User`
Stores authenticated personnel accounts and security role assignments.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String (`cuid`) | Primary key |
| `email` | String (`unique`) | Login email |
| `passwordHash`| String | Bcrypt hash |
| `role` | `UserRole` | System access role |
| `fullName` | String | Full employee name |
| `createdAt` | DateTime | Account creation timestamp |

#### 2. `Recipe`
Garment specification blueprints with fabric allowances and tolerances.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String (`cuid`) | Primary key |
| `recipeCode` | String (`unique`) | Recipe identifier (e.g. `REC-BL01`) |
| `name` | String | Garment name (e.g. Casual Blouse) |
| `category` | String | Category (e.g. Topwear) |
| `stdFabricYards`| Decimal | Standard fabric required per unit |
| `wastageCap` | Decimal | Maximum permitted wastage % before warning |

#### 3. `RecipeComponent`
Child components required for each garment recipe (BOM items).
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String (`cuid`) | Primary key |
| `recipeId` | String | Foreign key $\to$ `Recipe.id` |
| `componentName`| String | Component label (e.g. Front Body, Sleeves) |
| `piecesPerGarment`| Int | Multiplier ratio per garment unit |
| `imageUrl` | String? | Optional technical diagram reference |

#### 4. `CuttingOrder`
Primary production batch tracked through the cutting and sewing pipeline.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String (`cuid`) | Primary key |
| `orderNo` | String (`unique`) | Batch number (e.g. `CUT-2026-DEMO-001`) |
| `recipeId` | String | Foreign key $\to$ `Recipe.id` |
| `targetQty` | Int | Target units to manufacture |
| `fabricRollId` | String? | Source roll barcode identifier |
| `actualFabricYds`| Decimal | Fabric yardage consumed for cut |
| `status` | `OrderStatus` | Current lifecycle state |
| `createdById` | String | Foreign key $\to$ `User.id` |
| `rejectionCount`| Int | Total number of QC rejections incurred |
| `submittedAt` | DateTime? | Timestamp when sent to verification |
| `createdAt` | DateTime | Timestamp when created |
| `updatedAt` | DateTime | Last modified timestamp |

#### 5. `VerificationItem`
Physical count and QC verdict for each component in an order.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String (`cuid`) | Primary key |
| `orderId` | String | Foreign key $\to$ `CuttingOrder.id` |
| `componentId` | String | Foreign key $\to$ `RecipeComponent.id` |
| `expectedQty` | Int | Multiplier quantity ($Q_{target} \times \text{pieces}$) |
| `actualQty` | Int? | Actual pieces counted by verifier |
| `status` | `ItemStatus?` | `GREEN`, `YELLOW`, or `RED` status |
| *Constraint* | Unique | `@@unique([orderId, componentId])` |

#### 6. `VerificationLog` (Append-Only Audit)
Immutable audit record generated upon every verification approval or rejection.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String (`cuid`) | Primary key |
| `orderId` | String | Foreign key $\to$ `CuttingOrder.id` |
| `verifierId` | String | Foreign key $\to$ `User.id` |
| `decision` | `Decision` | `APPROVED` or `REJECTED` |
| `rejectionNote` | String? | Reason for rejection ($\ge 10$ chars required) |
| `wastagePct` | Decimal? | Computed fabric wastage percentage |
| `componentVariances`| Json? | Snapshot of counted piece variances |
| `timestamp` | DateTime | Instant verification decision was committed |

#### 7. `OrderEvent` (Append-Only Audit)
Chronological ledger recording every state change and initiating actor.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String (`cuid`) | Primary key |
| `orderId` | String | Foreign key $\to$ `CuttingOrder.id` |
| `actorId` | String? | User responsible for transition |
| `fromStatus` | `OrderStatus?`| Previous state |
| `toStatus` | `OrderStatus` | New state |
| `at` | DateTime | Timestamp of event |

---

### Database Hardening & Triggers
Applied via `prisma/migrations/20261008_phase3_integrity/migration.sql`:
1. **Rejection Note Check**:
   ```sql
   CHECK ("decision" <> 'REJECTED' OR length(trim(coalesce("rejectionNote", ''))) >= 10)
   ```
2. **One-Approval Partial Unique Index**:
   ```sql
   CREATE UNIQUE INDEX "uq_verification_logs_one_approval"
     ON "VerificationLog" ("orderId") WHERE "decision" = 'APPROVED';
   ```
3. **Immutability Triggers**:
   `BEFORE UPDATE OR DELETE` triggers on `VerificationLog` and `OrderEvent` executing `prevent_audit_mutation()`, throwing an exception if an update or delete is attempted.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20 or higher
- **npm**: v10 or higher
- **PostgreSQL**: Supabase PostgreSQL database instance

### 2. Installation
```bash
git clone https://github.com/SanjanaFernando/apperelflow-erp.git
cd apperelflow-erp
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```env
# Supabase PostgreSQL (Connection Pooling)
DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct Supabase Connection (for migrations)
DIRECT_URL="postgresql://postgres.[REF]:[PASSWORD]@[REGION].pooler.supabase.com:5432/postgres"

# Authentication & Mode
JWT_SECRET="apparelflow-super-secret-jwt-key-change-in-production"
NEXT_PUBLIC_DEMO_MODE="false"
```

### 4. Database Initialization & Hardening
```bash
# Generate Prisma Client
npm run db:generate

# Push Schema to PostgreSQL
npm run db:push

# Seed Demo Recipes, Users, and Sample Orders
npm run db:seed

# Apply PostgreSQL Immutability Triggers and Hardening
npm run db:harden
```

### 5. Running the Application
```bash
# Development Server
npm run dev

# Production Build & Run
npm run build
npm run start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Validation

The application includes unit, integration, and end-to-end tests:

```bash
# Run Unit and Domain Logic Tests (Vitest)
npm test

# Run End-to-End Browser & Accessibility Suite (Playwright)
npm run test:e2e
```

### Test Coverage Highlights
- **`verification.test.ts`**: Validates piece multiplier logic, `GREEN`/`YELLOW`/`RED` status calculation, wastage percentage math, and hard-stop rejection on shortages.
- **`order-engine.test.ts`**: Verifies strict state transitions, invalid status rejection, and immutable event logging.
- **`order-api.test.ts`**: Tests authentication gating, role scoping, pagination (10/20/50 per page), and parameter bounds.
