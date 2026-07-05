# Fortnox Integration Plan

**Source:** Story 7.8 (mapping layer & sync scaffolding — no live sync)
**Mapper:** `lib/integrations/fortnox/employee-mapper.ts`
**Schema Reference:** `docs/reference/fortnox-employee-schema-analysis.md`
**Purpose:** Record what exists today, the mapper's documented assumptions, and every deliberately deferred piece of the future Fortnox employee sync

---

## Overview

Story 7.8 ships the **pure mapping adapter only**: `toFortnox(employee)` and
`fromFortnox(payload)` translate between our `Employee` row shape
(snake_case, Prisma types) and the Fortnox Employee payload (PascalCase, per
the Fortnox OpenAPI spec). No OAuth, no network calls, no UI, no schema
change, no migration. Enabling the integration later is an adapter + OAuth
job, not a redesign.

---

## What Exists Today (Story 7.1 + 7.8)

- `Employee` model with Fortnox-aligned columns and identity-mappable enums
  (`EmploymentForm`, `PersonelType`, `SalaryForm` members ARE the Fortnox
  codes — by design since 7.1).
- Sync-metadata columns, reserved and null until integration:
  `fortnox_employee_id`, `fortnox_synced_at`, `fortnox_sync_status`
  (default `NOT_LINKED`), `fortnox_raw`.
- `@@unique([workspace_id, fortnox_employee_id])` — already enforced by the
  7.1 schema (verified in 7.8; not re-added).
- Pure mapper + typed `FortnoxEmployee` interface + unit tests
  (`tests/unit/lib/integrations/fortnox/employee-mapper.test.ts`), including
  a round-trip test and enum drift guards against the Prisma enums.

---

## Field Map (Single Source of Truth)

The per-field column ↔ property map lives as doc comments on the
`FortnoxEmployee` interface in `lib/integrations/fortnox/employee-mapper.ts`.
Summary:

```ts
// Mapped (adapter handles casing, dates, Decimal boundary, country default):
employee_id_ref      ↔ EmployeeId          // business key, 1–15 chars
personnummer         ↔ PersonalIdentityNumber // opaque — ciphertext in our DB
first_name           ↔ FirstName            // required
last_name            ↔ LastName             // required
email                ↔ Email
phone1 / phone2      ↔ Phone1 / Phone2
address1 / address2  ↔ Address1 / Address2
post_code            ↔ PostCode
city                 ↔ City
country              ↔ Country              // default "SE" both directions
job_title            ↔ JobTitle             // Fortnox max 30 chars
employment_date      ↔ EmploymentDate       // "YYYY-MM-DD" (assumption, below)
employed_to          ↔ EmployedTo
employment_form      ↔ EmploymentForm       // identity enum
personel_type        ↔ PersonelType         // identity enum
inactive             ↔ Inactive
full_time_equivalent ↔ FullTimeEquivalent   // Decimal(4,3) ↔ FLOAT
average_weekly_hours ↔ AverageWeeklyHours   // Decimal(5,2) ↔ STRING (spec split!)
schedule_id          ↔ ScheduleId
salary_form          ↔ SalaryForm           // identity enum
vacation_days_paid   ↔ VacationDaysPaid     // Decimal(5,2) ↔ FLOAT

// Laglig-native, NOT mapped:
group_id, manager_id, collective_agreement_id, audit/timestamps, sync metadata
```

**String-vs-float split (spec-verified, not uniform):** `MonthlySalary`,
`HourlyPay`, `AverageHourlyWage`, `AverageWeeklyHours` are Fortnox
**strings**; `FullTimeEquivalent`, `VacationDaysPaid` are Fortnox
**floats**. The mapper encodes this per field.

---

## The Two-Id Distinction (Never Conflate)

```ts
// 1) Fortnox business key — part of the PAYLOAD, mapped by the adapter:
Employee.employee_id_ref ↔ FortnoxEmployee.EmployeeId
//    "Anställnings-ID": 1–15 chars, unique per Fortnox company.

// 2) OUR sync-metadata reference — NOT a Fortnox payload property:
Employee.fortnox_employee_id
//    Written by the future sync job when a row is linked to a Fortnox
//    record; backs @@unique([workspace_id, fortnox_employee_id]).
```

`toFortnox` emits `EmployeeId` from `employee_id_ref` only. `fromFortnox`
writes `employee_id_ref` from `EmployeeId` and never touches
`fortnox_employee_id` or any sync metadata — those keys do not exist on its
`EmployeeInput` output shape.

---

## Documented Assumptions (Made by the Mapper)

1. **Date wire format = `YYYY-MM-DD`.** The Fortnox schema analysis types
   `EmploymentDate`/`EmployedTo` as `date` without specifying a wire format.
   The mapper emits `YYYY-MM-DD` strings toward Fortnox and parses
   `YYYY-MM-DD` (or ISO-prefixed) strings into UTC-midnight `Date` objects
   inbound. Verify against the live API during the OAuth story; the format
   is isolated in two helpers if it needs adjusting.
2. **`fortnox_raw` ownership.** The mapper does NOT manage `fortnox_raw`.
   The future sync job snapshots the full raw Fortnox payload (including the
   ~80 unmapped payroll/vacation/tax/flex fields and the nested
   `DatedWages`/`DatedSchedules`/`OpeningSalaries`/`EmployeeCategories`/
   `EmployeeChildren` arrays) onto `Employee.fortnox_raw` at its own
   boundary, for audit and conflict resolution. Unretained-field
   preservation therefore lives in `fortnox_raw`, not in the mapper's
   round-trip.
3. **Encryption boundary.** `personnummer` ↔ `PersonalIdentityNumber` is
   mapped as an opaque field. Our column stores ciphertext (Story 7.1); the
   sync job decrypts before `toFortnox` output leaves the boundary and
   encrypts after `fromFortnox` before persisting. The mapper never imports
   crypto.
4. **The mapper is not a validator.** `JobTitle` max length (30),
   Email-required-on-create, and `EmployeeId` length (1–15) are Fortnox API
   constraints enforced by the sync job, not the mapper (pass-through, no
   truncation).
5. **Null emission policy.** `toFortnox` emits the complete mapped field set
   with `null` for absent values. The sync job decides which keys to include
   in an actual API call (e.g. strip nulls on PUT to avoid wiping
   Fortnox-side data).
6. **Throw contract.** `fromFortnox` throws the typed `FortnoxMappingError`
   (`code: 'FORTNOX_MISSING_REQUIRED_NAME'`) only when `FirstName`/`LastName`
   is missing or blank. Every other absent/malformed field degrades to null
   (`country` → `'SE'`, `inactive` → `false`).
7. **Decimal boundary.** First Prisma `Decimal` boundary in the codebase:
   conversion is string-based (`Decimal.toString()`), never `parseFloat` on
   a Decimal object. `fromFortnox` emits precision-safe decimal **strings**
   for Prisma `Decimal` columns.

---

## Sync Status Transitions

`FortnoxSyncStatus` (7.1 schema; documented here per AC5):

| From         | To        | Trigger                                                          |
| ------------ | --------- | ---------------------------------------------------------------- |
| `NOT_LINKED` | `LINKED`  | Sync job matches/links the row to a Fortnox employee (sets `fortnox_employee_id`, snapshots `fortnox_raw`) |
| `LINKED`     | `SYNCING` | A sync run picks up the row (either direction)                    |
| `SYNCING`    | `LINKED`  | Sync run completes cleanly (updates `fortnox_synced_at`)          |
| `SYNCING`    | `CONFLICT`| Both sides changed since last snapshot; needs resolution (policy deferred, below) |
| `SYNCING`    | `ERROR`   | API/validation failure (e.g. rate limit exhaustion, 4xx)          |
| `CONFLICT`   | `LINKED`  | User/policy resolves the conflict                                 |
| `ERROR`      | `SYNCING` | Retry                                                             |
| any          | `NOT_LINKED` | Integration disconnected/unlinked (clears sync metadata)       |

---

## Deferred Work (Future Sync Stories)

### 1. OAuth Flow

- Fortnox OAuth2 authorization-code flow; workspace-level connection
  (client id/secret in env, tokens encrypted at rest per workspace).
- Token refresh handling; scope: `salary` (employee endpoints).
- Disconnect flow → transition all rows to `NOT_LINKED`.

### 2. Sync Direction

- Decision deferred: start **read-only (Fortnox → laglig)** as the safe
  default; Fortnox is the payroll system of record for the mapped HR
  fields. Write-back (laglig → Fortnox) only after conflict policy exists.

### 3. Conflict-Resolution Policy

- Detection: compare current Fortnox payload against the `fortnox_raw`
  snapshot and our row's `updated_at` vs `fortnox_synced_at`.
- Policy options (deferred choice): last-write-wins per field,
  Fortnox-wins for payroll fields + laglig-wins for laglig-native fields,
  or manual resolution UI on `CONFLICT`.

### 4. Rate Limits

- Fortnox API limit (documented): ~25 requests / 5 seconds per
  access token, ~300/minute. Sync job needs a rate limiter + backoff
  (follow the `lib/external/eurlex.ts` retry/backoff pattern).

### 5. `fortnox_raw` Snapshotting

- Owned by the sync job (assumption 2 above): store the full raw payload on
  every successful pull; it is the conflict-detection baseline and the
  preservation mechanism for all unmapped fields.

### 6. Matching / Linking Strategy

- Initial link: match on `PersonalIdentityNumber` (decrypt-compare at the
  sync boundary) falling back to `EmployeeId` ↔ `employee_id_ref`, then
  manual pairing UI. Sets `fortnox_employee_id` (the two-id distinction
  stays absolute: business key vs sync reference).

### 7. Validation at the API Boundary

- Enforce Fortnox constraints pre-flight: `JobTitle` ≤ 30 chars,
  `EmployeeId` 1–15 chars, Email present on create; surface failures as
  `ERROR` status with actionable messages.

---

**Document Created**: 2026-07-03 (Story 7.8)
**For Project**: laglig.se — HR module (Epic 7)
