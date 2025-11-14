# Feature Specification: HR Module (Employee Management)

**Document Version:** 1.0
**Last Updated:** 2024-01-20
**Status:** Draft
**Owner:** Product Team

---

## Executive Summary

The HR Module transforms Laglig.se from a law database into a **complete compliance management system**. By connecting Swedish labor laws to actual employees, businesses can track:

- Which laws apply to each employee (based on role)
- Which employment documents are in place
- Compliance status per employee
- Kollektivavtal (collective agreement) compliance

**Key Differentiator vs. Competitors:**

- **Notisum/Karnov:** Provide law databases only
- **Laglig.se:** Law database + Employee management + AI-powered compliance checking + Kollektivavtal integration

**Strategic Value:**

- **Cost Avoidance:** Union disputes over contract violations = €10,000-50,000+ in legal fees
- **Time Savings:** HR spends 5-10 hours/week on compliance checks → AI does it in seconds
- **Audit Readiness:** ISO consultants can show complete employee compliance in minutes
- **Upsell Driver:** HR Module is Pro/Enterprise feature (Basic tier = laws only)

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [Employee Data Structure](#employee-data-structure)
3. [HR Module Navigation](#hr-module-navigation)
4. [Employee List View](#employee-list-view)
5. [Individual Employee Profile](#individual-employee-profile)
6. [CSV Import Workflow](#csv-import-workflow)
7. [Fortnox Integration](#fortnox-integration)
8. [Kollektivavtal Management](#kollektivavtal-management)
9. [HR Dashboard & Metrics](#hr-dashboard--metrics)
10. [Document Management](#document-management)
11. [Task Linking](#task-linking)
12. [AI Chat Integration](#ai-chat-integration)
13. [Permissions & Privacy](#permissions--privacy)
14. [Technical Implementation](#technical-implementation)
15. [Post-MVP Features](#post-mvp-features)

---

## Core Principles

### 1. Compliance-First Design

**Every employee has a compliance status: Compliant, Needs Attention, or Non-Compliant.**

**Calculated based on:**

- Documents uploaded (employment contract required)
- Kollektivavtal compliance (if assigned)
- Data completeness (missing critical fields reduces quality score)

### 2. Role-Based Law Assignment

**Predefined roles auto-assign applicable laws.**

**Example:**

- Select role "Construction Worker" → Auto-assigns Arbetsmiljölagen, PBL, ATL, LAS
- AI suggests: "Construction workers often need Första Hjälpen training"

### 3. Kollektivavtal as First-Class Citizen

**Swedish companies must comply with collective agreements.**

**Implementation:**

- Upload kollektivavtal PDF → AI chunks, embeds, adds to RAG
- Assign to employee groups (arbetare vs. tjänstemän)
- AI compares employment contracts vs. kollektivavtal requirements

### 4. Data Quality Matters

**Incomplete employee data = Poor AI advice.**

**Enforcement:**

- Data quality score visible on HR Dashboard
- Warnings when critical fields missing
- "Fix data quality" prompts encourage complete profiles

### 5. Integration Over Duplication

**Don't compete with Fortnox for payroll/vacation tracking.**

**Strategy:**

- If user has Fortnox integration → Sync vacation data (read-only)
- Focus Laglig.se on **compliance**, not **payroll**

---

## Employee Data Structure

### Core Schema

**Aligned with Fortnox for future integration, simplified for compliance focus.**

```typescript
interface Employee {
  // Core Identity
  id: string // UUID
  employeeId?: string // Optional custom ID (1-15 chars)
  firstName: string // Required
  lastName: string // Required
  fullName: string // Auto-generated: "Anna Svensson"
  personalIdentityNumber?: string // Encrypted Swedish personnummer

  // Contact
  email: string // Required
  phone?: string
  address?: {
    street?: string
    city?: string
    postCode?: string
    country?: string
  }

  // Employment
  employmentDate: Date // Start date (required)
  employedTo?: Date // End date (null if active)
  inactive: boolean // false = active, true = terminated
  employmentForm?: EmploymentForm // Fortnox-aligned enums
  personnelType?: PersonnelType // ARB (arbetare) vs TJM (tjänsteman)
  jobTitle: string // E.g., "Construction Worker"
  department?: string // E.g., "Construction", "Office"
  managerId?: string // Employee ID of manager
  fullTimeEquivalent: number // 1.0 = full-time, 0.5 = half-time
  averageWeeklyHours?: number // For ATL compliance

  // Role (Predefined for MVP)
  role: PredefinedRole // See roles below

  // Compliance
  applicableLaws: string[] // Law IDs (auto-assigned based on role)
  documents: Document[] // Uploaded files linked to Mina Filer
  complianceStatus: ComplianceStatus // Calculated field
  assignedKollektivavtal: string[] // Kollektivavtal IDs

  // Vacation (Fortnox integration only - Post-MVP)
  vacationData?: {
    source: 'fortnox'
    lastSyncedAt: Date
    entitlement: number
    taken: number
    remaining: number
    saved: number
  }

  // Temporal Tracking
  roleHistory: RoleHistoryEntry[] // Track role changes over time

  // Metadata
  userId: string // Company owner
  createdAt: Date
  updatedAt: Date
  createdBy: string // User ID
  lastModifiedBy: string

  // Fortnox Integration (Post-MVP)
  fortnoxEmployeeId?: string
  fortnoxLastSyncedAt?: Date
}

// Supporting Types
type EmploymentForm =
  | 'TV' // Tillsvidareanställning (permanent)
  | 'PRO' // Provanställning (probation)
  | 'TID' // Tidsbegränsad (temporary)
  | 'VIK' // Vikariat (substitute)
  | 'PRJ' // Projektanställning (project)
  | 'PRA' // Praktik (internship)
  | 'CONS' // Konsult (consultant)
  | null

type PersonnelType =
  | 'ARB' // Arbetare (worker - often has kollektivavtal)
  | 'TJM' // Tjänsteman (salaried employee)
  | null

type ComplianceStatus =
  | 'compliant' // All docs uploaded, data complete
  | 'needs_attention' // Some missing fields or docs
  | 'non_compliant' // Critical issues (e.g., contract missing)

// Predefined Roles (MVP)
type PredefinedRole =
  | 'construction_worker'
  | 'office_worker'
  | 'driver'
  | 'restaurant_worker'
  | 'warehouse_worker'
  | 'sales_representative'
  | 'manager'
  | 'consultant'
  | 'other'

interface Document {
  fileId: string // Reference to Mina Filer
  documentType:
    | 'employment_contract'
    | 'gdpr_consent'
    | 'policy_signature'
    | 'certification'
    | 'other'
  uploadedDate: Date
  uploadedBy: string // User ID
}

interface RoleHistoryEntry {
  effectiveDate: Date
  jobTitle: string
  role: PredefinedRole
  department?: string
  applicableLaws: string[]
}
```

---

### Predefined Roles - Law Mapping

**Each role template auto-assigns laws and (future) trainings:**

```typescript
const ROLE_TEMPLATES: Record<
  PredefinedRole,
  {
    defaultLaws: string[]
    description: string
  }
> = {
  construction_worker: {
    defaultLaws: [
      'law_arbetsmiljo', // AML
      'law_planbygglagen', // PBL
      'law_arbetstid', // ATL
      'law_anstallningsskydd', // LAS
    ],
    description: 'Byggarbetare, anläggningsarbetare, hantverkare',
  },

  office_worker: {
    defaultLaws: [
      'law_arbetsmiljo',
      'law_arbetstid',
      'law_anstallningsskydd',
      'law_gdpr',
    ],
    description: 'Kontorsanställda, administrativa roller',
  },

  driver: {
    defaultLaws: [
      'law_arbetsmiljo',
      'law_arbetstid',
      'law_anstallningsskydd',
      'law_vagtrafik',
    ],
    description: 'Lastbilschaufförer, distributionsförare',
  },

  restaurant_worker: {
    defaultLaws: [
      'law_livsmedel',
      'law_alkohol',
      'law_arbetsmiljo',
      'law_arbetstid',
      'law_anstallningsskydd',
    ],
    description: 'Kökspersonal, servitörer, bartenders',
  },

  warehouse_worker: {
    defaultLaws: ['law_arbetsmiljo', 'law_arbetstid', 'law_anstallningsskydd'],
    description: 'Lagerarbetare, logistikpersonal',
  },

  sales_representative: {
    defaultLaws: [
      'law_arbetsmiljo',
      'law_arbetstid',
      'law_anstallningsskydd',
      'law_marknadsforingslag',
    ],
    description: 'Säljare, kundtjänst, account managers',
  },

  manager: {
    defaultLaws: [
      'law_arbetsmiljo',
      'law_arbetstid',
      'law_anstallningsskydd',
      'law_medbestammande', // MBL
      'law_diskriminering',
    ],
    description: 'Chefer med personalansvar',
  },

  consultant: {
    defaultLaws: ['law_arbetsmiljo', 'law_arbetstid'],
    description: 'Inhyrda konsulter, frilansare',
  },

  other: {
    defaultLaws: ['law_arbetsmiljo', 'law_anstallningsskydd'],
    description: 'Övriga roller (anpassa manuellt)',
  },
}
```

**Why this matters:**

- **Onboarding speed:** Select role → Laws assigned automatically
- **Compliance consistency:** All Construction Workers get same baseline laws
- **AI context:** AI knows "Construction Workers need PBL compliance" without user input

---

## HR Module Navigation

### Left Sidebar Integration

**The HR section appears in the main left sidebar as an accordion:**

```
┌─────────────────────────┐
│ [Laglig.se Logo]        │
├─────────────────────────┤
│ 📋 Dashboard            │
│ 💬 AI Chat              │
│ ⚖️ Laglistor ▼          │
│ 📚 Alla Lagar           │
│ ✅ Uppgifter            │
│ 👥 HR ▼                 │  ← HR Module
│   📊 Översikt           │
│   👤 Anställda          │
│   📄 Kollektivavtal     │
│ 🔔 Ändringsbevakning    │
│ 👥 Team (Pro)           │
│ 📁 Mina Filer           │
│ ⚙️ Inställningar        │
└─────────────────────────┘
```

**HR Submenu:**

1. **📊 Översikt** - HR Dashboard (metrics, data quality)
2. **👤 Anställda** - Employee list (table/card view)
3. **📄 Kollektivavtal** - Manage collective agreements

---

## Employee List View

### Layout Options

**Users can toggle between Table and Card views (default: Table).**

### Table View (Default)

```
┌────────────────────────────────────────────────────────────────────────┐
│ ANSTÄLLDA                                        [+ Lägg till] [Import]│
│ ┌──────────────────────────────────────────────────────────────────┐  │
│ │ 🔍 Sök anställda...                         [⊞ Tabell] [⊟ Kort]  │  │
│ └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│ Filter:                                                                │
│ Status: [Alla ▼] Department: [Alla ▼] Sort: [Namn A-Z ▼]            │
│                                                                        │
│ ┌──────────────────────────────────────────────────────────────────┐  │
│ │ Namn            Role              Status         Docs   Actions  │  │
│ ├──────────────────────────────────────────────────────────────────┤  │
│ │ Anna Svensson   Construction      ⚠️ Needs Att.  2/3    [View]   │  │
│ │ Erik Johansson  Office Worker     ✅ Compliant   3/3    [View]   │  │
│ │ Lisa Andersson  Driver            ❌ Non-Compl.  0/3    [View]   │  │
│ │ Johan Berg      Construction      ✅ Compliant   3/3    [View]   │  │
│ │ ...                                                               │  │
│ └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│ Visar 4 av 25 anställda                               [1] 2 3 4 >    │
└────────────────────────────────────────────────────────────────────────┘
```

**Table Columns:**

1. **Namn** - Full name with avatar
2. **Role** - Job title
3. **Status** - Compliance badge (✅ ⚠️ ❌)
4. **Docs** - Document count (e.g., "2/3" = 2 of 3 required docs uploaded)
5. **Actions** - [View] button (opens employee profile)

---

### Card View

```
┌────────────────────────────────────────────────────────────────────────┐
│ ANSTÄLLDA                                        [+ Lägg till] [Import]│
│ ┌──────────────────────────────────────────────────────────────────┐  │
│ │ 🔍 Sök anställda...                         [⊞ Tabell] [⊟ Kort]  │  │
│ └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│ ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────┐  │
│ │ 👤 Anna Svensson    │ │ 👤 Erik Johansson   │ │ 👤 Lisa Anderss.│  │
│ │ Construction Worker │ │ Office Worker       │ │ Driver          │  │
│ │ ⚠️ Needs Attention  │ │ ✅ Compliant        │ │ ❌ Non-Compliant│  │
│ │                     │ │                     │ │                 │  │
│ │ Saknas:             │ │ Allt klart          │ │ Saknas:         │  │
│ │ • GDPR-samtycke     │ │                     │ │ • Kontrakt      │  │
│ │                     │ │ Docs: 3/3           │ │ • Policies      │  │
│ │ Docs: 2/3           │ │                     │ │ • GDPR          │  │
│ │                     │ │                     │ │                 │  │
│ │ [View Profile →]    │ │ [View Profile →]    │ │ [View Profile →]│  │
│ └─────────────────────┘ └─────────────────────┘ └─────────────────┘  │
│                                                                        │
│ ┌─────────────────────┐ ┌─────────────────────┐                      │
│ │ 👤 Johan Berg       │ │ ...                 │                      │
│ │ Construction Worker │ │                     │                      │
│ │ ✅ Compliant        │ │                     │                      │
│ └─────────────────────┘ └─────────────────────┘                      │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Filters & Search

**Search bar:**

- Searches: Name, Email, Job Title, Department
- Instant results (debounced 300ms)

**Filter dropdowns:**

**Status:**

- Alla (default)
- ✅ Compliant
- ⚠️ Needs Attention
- ❌ Non-Compliant

**Department:**

- Alla (default)
- Construction
- Office
- Sales
- (Dynamic based on unique departments)

**Sort:**

- Namn (A-Z)
- Namn (Z-A)
- Status (Non-compliant first)
- Anställningsdatum (Newest first)
- Anställningsdatum (Oldest first)

---

### Action Buttons

**Top-right actions:**

**[+ Lägg till]** - Opens "Add Employee" form
**[Import]** - Opens CSV import modal

---

## Individual Employee Profile

### Page Layout

**URL:** `/hr/anstallda/[employeeId]`

```
┌────────────────────────────────────────────────────────────────────────┐
│ ← Tillbaka till Anställda                                             │
├────────────────────────────────────────────────────────────────────────┤
│ HEADER                                                                 │
│ ┌────────┐                                                             │
│ │   AA   │  Anna Svensson                                             │
│ └────────┘  Construction Worker · Construction Department             │
│             ⚠️ Needs Attention                                         │
│                                                                        │
│             [Redigera] [Radera] [Exportera profil]                    │
├────────────────────────────────────────────────────────────────────────┤
│ TABS                                                                   │
│ [Översikt] [Dokument] [Uppgifter] [Historik]                          │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│ OVERVIEW TAB CONTENT (see below)                                      │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Header Section

**Avatar:**

- Initials if no photo (e.g., "AS" for Anna Svensson)
- Colored background (random consistent color per employee)

**Name & Title:**

- Full name (large, bold)
- Job title · Department (smaller, muted)

**Compliance Badge:**

- ✅ **Compliant** (green)
- ⚠️ **Needs Attention** (yellow)
- ❌ **Non-Compliant** (red)

**Actions:**

- **[Redigera]** - Opens edit form (inline or modal)
- **[Radera]** - Confirmation dialog → Soft delete (sets `inactive = true`)
- **[Exportera profil]** - Download employee data as PDF (for GDPR requests)

---

### Tab 1: Översikt (Overview)

```
┌────────────────────────────────────────────────────────────────────────┐
│ ANSTÄLLNINGSINFO                                   [Redigera]          │
├────────────────────────────────────────────────────────────────────────┤
│ Personnummer:     900101-1234                                          │
│ E-post:           anna@company.se                                      │
│ Telefon:          070-123 45 67                                        │
│ Anställningsdatum: 2023-06-15                                          │
│ Anställningsform:  Tillsvidareanställning (TV)                         │
│ Personaltyp:       Arbetare (ARB)                                      │
│ Heltidsekvivalent: 1.0 (100%)                                          │
│ Genomsnitt timmar: 40h/vecka                                           │
│ Chef:              Erik Johansson                                      │
├────────────────────────────────────────────────────────────────────────┤
│ KOLLEKTIVAVTAL                                                         │
├────────────────────────────────────────────────────────────────────────┤
│ 📄 Byggnads Kollektivavtal 2023-2025                                   │
│    Gäller från: 2023-01-01 till 2025-12-31                            │
│    [Visa dokument] [Ta bort tilldelning]                              │
│                                                                        │
│ [+ Tilldela kollektivavtal]                                            │
├────────────────────────────────────────────────────────────────────────┤
│ COMPLIANCE SUMMARY                                                     │
├────────────────────────────────────────────────────────────────────────┤
│ ⚠️ 2 items need attention:                                            │
│                                                                        │
│ 1. GDPR-samtycke saknas                                               │
│    Krävs enligt Dataskyddsförordningen (GDPR)                         │
│    [Ladda upp dokument]                                               │
│                                                                        │
│ 2. Telefonnummer saknas                                               │
│    Förbättrar datakvalitet för AI-kontextanalys                       │
│    [Lägg till telefonnummer]                                          │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Tab 2: Dokument (Documents)

```
┌────────────────────────────────────────────────────────────────────────┐
│ DOKUMENT                                           [Ladda upp]         │
├────────────────────────────────────────────────────────────────────────┤
│ Dra och släpp filer här eller klicka för att ladda upp               │
│ Accepterade format: PDF, DOCX, JPG, PNG                               │
│ Max storlek: 30 MB                                                    │
├────────────────────────────────────────────────────────────────────────┤
│ ANSTÄLLNINGSKONTRAKT (1)                                               │
│ ┌──────────────────────────────────────────────────────────────────┐  │
│ │ 📄 Anställningskontrakt_Anna_Svensson.pdf                        │  │
│ │    Uppladdad: 2023-06-15 av Erik Johansson                       │  │
│ │    Storlek: 245 KB                                               │  │
│ │    [Visa] [Ladda ner] [Radera] [Dra till chat]                   │  │
│ └──────────────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│ POLICIES & SAMTYCKEN (1)                                               │
│ ┌──────────────────────────────────────────────────────────────────┐  │
│ │ 📄 GDPR_Samtycke_Anna.pdf                                        │  │
│ │    Uppladdad: 2023-06-15 av Erik Johansson                       │  │
│ │    [Visa] [Ladda ner] [Radera] [Dra till chat]                   │  │
│ └──────────────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│ CERTIFIERINGAR (0)                                                     │
│ Inga certifieringar uppladdade                                         │
│ [Ladda upp certifiering]                                               │
└────────────────────────────────────────────────────────────────────────┘
```

**Document types (auto-categorized):**

1. **Anställningskontrakt** (Employment contracts)
2. **Policies & Samtycken** (GDPR consent, signed policies)
3. **Certifieringar** (Truckkort, Första hjälpen, etc.)
4. **Övrigt** (Other)

**Document actions:**

- **[Visa]** - Opens PDF viewer in modal
- **[Ladda ner]** - Downloads file
- **[Radera]** - Confirmation → Removes file (soft delete in Mina Filer)
- **[Dra till chat]** - Draggable handle → Add to AI Chat context

**Upload flow:**

1. User drags PDF onto drop zone
2. File uploads to Mina Filer under `Anställda/Anna_Svensson/`
3. Document linked to employee record
4. Compliance status recalculated

---

### Tab 3: Uppgifter (Tasks)

```
┌────────────────────────────────────────────────────────────────────────┐
│ UPPGIFTER KOPPLADE TILL ANNA                                           │
├────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────────┐  │
│ │ ✅ Genomför riskbedömning för Anna                                │  │
│ │    Status: Klar                                                  │  │
│ │    Skapad: 2023-06-20 · Klar: 2023-07-01                         │  │
│ │    Kopplad till: Arbetsmiljölagen (AML)                          │  │
│ │    [Visa uppgift]                                                │  │
│ └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│ ┌──────────────────────────────────────────────────────────────────┐  │
│ │ ⚠️ Uppdatera anställningsavtal med OB-tillägg                     │  │
│ │    Status: Pågår                                                 │  │
│ │    Deadline: 2024-02-15                                          │  │
│ │    Kopplad till: Byggnads Kollektivavtal §7.3                    │  │
│ │    [Visa uppgift]                                                │  │
│ └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│ Inga fler uppgifter                                                    │
│ [Skapa ny uppgift för Anna]                                            │
└────────────────────────────────────────────────────────────────────────┘
```

**Task linking:**

- Tasks from Kanban board can be assigned to employees
- Employee profile shows all related tasks
- Clicking [Visa uppgift] opens task modal

---

### Tab 4: Historik (Activity Log - Future)

**Post-MVP feature:**

```
┌────────────────────────────────────────────────────────────────────────┐
│ HISTORIK                                                               │
├────────────────────────────────────────────────────────────────────────┤
│ 2024-01-20 10:30 - Erik Johansson laddade upp GDPR-samtycke           │
│ 2024-01-15 14:20 - Anna Svensson tilldelades Byggnads Kollektivavtal  │
│ 2023-07-01 09:00 - Uppgift "Riskbedömning" markerad som klar          │
│ 2023-06-15 08:00 - Anna Svensson skapad av Erik Johansson             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## CSV Import Workflow

### Entry Point

**From Employee List page:**
User clicks **[Import]** button → Opens CSV Import Modal

---

### Step 1: Upload CSV File

```
┌────────────────────────────────────────────────────────────────────────┐
│ IMPORTERA ANSTÄLLDA                                          [Stäng ×]│
├────────────────────────────────────────────────────────────────────────┤
│ Steg 1 av 3: Ladda upp CSV-fil                                        │
│                                                                        │
│ ┌──────────────────────────────────────────────────────────────────┐  │
│ │ Dra och släpp CSV-fil här eller klicka för att välja             │  │
│ │                                                                  │  │
│ │ [Välj fil]                                                       │  │
│ └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│ Format: CSV (UTF-8 rekommenderas)                                     │
│ Max storlek: 5 MB                                                     │
│ Max antal rader: 1000 anställda                                       │
│                                                                        │
│ [Ladda ner exempelmall.csv]                                            │
│                                                                        │
│ [Avbryt] [Nästa →]                                                     │
└────────────────────────────────────────────────────────────────────────┘
```

**Example CSV template:**

```csv
FirstName,LastName,Email,JobTitle,Role,EmploymentDate,Department
Anna,Svensson,anna@company.se,Construction Worker,Byggnadsarbetare,2023-06-15,Construction
Erik,Johansson,erik@company.se,Office Manager,Kontorschef,2023-07-01,Office
```

---

### Step 2: Date Format Selection

**After CSV uploaded, system detects date columns:**

```
┌────────────────────────────────────────────────────────────────────────┐
│ IMPORTERA ANSTÄLLDA                                          [Stäng ×]│
├────────────────────────────────────────────────────────────────────────┤
│ Steg 2 av 3: Välj datumformat                                         │
│                                                                        │
│ Vi hittade datumkolumner i din CSV. Ange vilket format som används:   │
│                                                                        │
│ EmploymentDate kolumn:                                                │
│ Exempel från din fil: "2023-06-15"                                    │
│                                                                        │
│ ( ) YYYY-MM-DD (ISO 8601) ← Rekommenderat                             │
│ ( ) DD/MM/YYYY (Svensk)                                               │
│ ( ) MM/DD/YYYY (Amerikansk)                                           │
│ ( ) DD.MM.YYYY (Europeisk)                                            │
│ ( ) Automatisk detektering                                            │
│                                                                        │
│ Förhandsgranskning:                                                   │
│ "2023-06-15" → Tolkas som: 15 juni 2023 ✅                            │
│                                                                        │
│ [← Tillbaka] [Nästa →]                                                │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Step 3: Field Mapping & Role Fuzzy Matching

```
┌────────────────────────────────────────────────────────────────────────┐
│ IMPORTERA ANSTÄLLDA                                          [Stäng ×]│
├────────────────────────────────────────────────────────────────────────┤
│ Steg 3 av 3: Mappa fält                                               │
│                                                                        │
│ Matcha dina CSV-kolumner till Laglig.se-fält:                         │
│                                                                        │
│ CSV-kolumn              →  Laglig.se-fält                             │
│ ─────────────────────────────────────────────────────────────────     │
│ FirstName               →  [Förnamn ▼]                 ✅ Korrekt     │
│ LastName                →  [Efternamn ▼]               ✅ Korrekt     │
│ Email                   →  [E-post ▼]                  ✅ Korrekt     │
│ JobTitle                →  [Jobbtitel ▼]               ✅ Korrekt     │
│ Role                    →  [Roll ▼]                    ⚠️ Behöver AI  │
│ EmploymentDate          →  [Anställningsdatum ▼]      ✅ Korrekt     │
│ Department              →  [Avdelning ▼]               ✅ Korrekt     │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│ ROLL-MAPPNING (AI-assisterad)                                         │
├────────────────────────────────────────────────────────────────────────┤
│ Vi hittade 3 unika roller i din CSV. AI har mappat dem automatiskt:   │
│                                                                        │
│ CSV-värde              →  Föreslagen roll           Säkerhet          │
│ ─────────────────────────────────────────────────────────────────     │
│ Byggnadsarbetare       →  [Construction Worker ▼]   95% 🟢           │
│ Kontorschef            →  [Manager ▼]               92% 🟢           │
│ Builder                →  [Construction Worker ▼]   88% 🟡           │
│                                                                        │
│ ⚠️ Låg säkerhet (< 90%): Kontrollera "Builder"-mappningen              │
│                                                                        │
│ [Redigera mappningar manuellt]                                         │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│ FÖRHANDSGRANSKNING (3 anställda)                                       │
├────────────────────────────────────────────────────────────────────────┤
│ ✅ Anna Svensson (anna@company.se) - Construction Worker              │
│ ✅ Erik Johansson (erik@company.se) - Manager                         │
│ ✅ Johan Berg (johan@company.se) - Construction Worker                │
│                                                                        │
│ [← Tillbaka] [Importera 3 anställda →]                                │
└────────────────────────────────────────────────────────────────────────┘
```

**AI Fuzzy Matching Logic:**

```typescript
async function fuzzyMatchRole(csvRoleValue: string): Promise<{
  suggestedRole: PredefinedRole
  confidence: number
}> {
  const prompt = `
Map this Swedish job role to one of our predefined roles.

CSV value: "${csvRoleValue}"

Predefined roles:
- construction_worker (Byggnadsarbetare, byggarbetare, builder, construction, hantverkare)
- office_worker (Kontorsanställd, administratör, office, administration)
- driver (Förare, chaufför, lastbilsförare, driver, trucker)
- restaurant_worker (Kock, servitör, restaurang, chef, bartender)
- warehouse_worker (Lagerarbetare, lager, warehouse, logistik)
- sales_representative (Säljare, försäljare, sales, account manager)
- manager (Chef, manager, ledare, ansvarig)
- consultant (Konsult, consultant, frilans)
- other (Anything that doesn't fit above)

Return JSON:
{
  "role": "construction_worker",
  "confidence": 0.95,
  "reasoning": "Byggnadsarbetare is Swedish for construction worker"
}
  `

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  })

  const result = JSON.parse(response.choices[0].message.content)
  return {
    suggestedRole: result.role,
    confidence: result.confidence,
  }
}
```

**Confidence indicators:**

- **95-100%** 🟢 High confidence (auto-accept)
- **85-94%** 🟡 Medium confidence (flag for review)
- **< 85%** 🔴 Low confidence (user must confirm)

---

### Step 4: Import Results

```
┌────────────────────────────────────────────────────────────────────────┐
│ IMPORT SLUTFÖRD                                              [Stäng]  │
├────────────────────────────────────────────────────────────────────────┤
│ ✅ 2 anställda importerade                                             │
│ ⚠️ 1 rad hoppades över                                                │
│                                                                        │
│ IMPORTERADE:                                                           │
│ • Anna Svensson (anna@company.se)                                     │
│ • Johan Berg (johan@company.se)                                       │
│                                                                        │
│ HOPPADE ÖVER:                                                          │
│ • Rad 3: Erik Johansson - Saknar e-postadress (obligatoriskt fält)   │
│                                                                        │
│ [Ladda ner felrapport.csv] för att fixa och importera igen            │
│                                                                        │
│ [Visa importerade anställda] [Stäng]                                  │
└────────────────────────────────────────────────────────────────────────┘
```

**Error CSV format:**

```csv
Row,Name,Error,OriginalData
3,Erik Johansson,Missing required field: Email,"Erik,Johansson,,Office Worker,2023-07-01"
```

---

## Fortnox Integration

**Post-MVP feature - included for completeness.**

### Integration Setup

**Settings page: `/settings/integrations`**

```
┌────────────────────────────────────────────────────────────────────────┐
│ INTEGRATIONER                                                          │
├────────────────────────────────────────────────────────────────────────┤
│ FORTNOX                                                       [Connect]│
│ ┌──────────────────────────────────────────────────────────────────┐  │
│ │ 📊 Fortnox - Ekonomisystem                                       │  │
│ │                                                                  │  │
│ │ Importera anställda automatiskt från Fortnox                    │  │
│ │ Synka semesterdagar (läsläge)                                   │  │
│ │                                                                  │  │
│ │ Status: Inte ansluten                                           │  │
│ │                                                                  │  │
│ │ [Anslut Fortnox →]                                              │  │
│ └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

**OAuth Flow:**

1. User clicks [Anslut Fortnox]
2. Redirects to Fortnox OAuth consent screen
3. User authorizes Laglig.se
4. Fortnox redirects back with access token
5. Store encrypted token in database

---

### Initial Employee Sync

**After connection, prompt user:**

```
┌────────────────────────────────────────────────────────────────────────┐
│ FORTNOX ANSLUTEN                                                       │
├────────────────────────────────────────────────────────────────────────┤
│ ✅ Fortnox-integration aktiv                                           │
│                                                                        │
│ Vi hittade 15 anställda i ditt Fortnox-konto.                         │
│ Vill du importera dem till Laglig.se?                                 │
│                                                                        │
│ Detta kommer att:                                                     │
│ • Skapa 15 nya anställda i Laglig.se                                 │
│ • Synka grundläggande uppgifter (namn, e-post, anställningsdatum)    │
│ • Synka semesterdagar (skrivskyddat)                                 │
│                                                                        │
│ [Avbryt] [Importera från Fortnox →]                                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Nightly Sync Job

**Cron job runs at 2 AM:**

```typescript
// app/api/cron/sync-fortnox-employees/route.ts
export async function GET(req: Request) {
  const usersWithFortnox = await getUsersWithFortnoxIntegration()

  for (const user of usersWithFortnox) {
    const fortnoxEmployees = await fetchFortnoxEmployees(user.fortnoxApiKey)

    for (const fortnoxEmp of fortnoxEmployees) {
      const existingEmployee = await supabase
        .from('employees')
        .select('id')
        .eq('fortnox_employee_id', fortnoxEmp.EmployeeId)
        .eq('user_id', user.id)
        .single()

      if (existingEmployee) {
        // Update existing
        await supabase
          .from('employees')
          .update({
            first_name: fortnoxEmp.FirstName,
            last_name: fortnoxEmp.LastName,
            email: fortnoxEmp.Email,
            employed_to: fortnoxEmp.EmployedTo,
            inactive: fortnoxEmp.Inactive,

            // Sync vacation (read-only)
            vacation_data: {
              source: 'fortnox',
              lastSyncedAt: new Date().toISOString(),
              entitlement: calculateVacationEntitlement(fortnoxEmp),
              taken: fortnoxEmp.VacationDaysRegisteredPaid || 0,
              remaining: fortnoxEmp.VacationDaysPaid || 0,
              saved: fortnoxEmp.VacationDaysSaved || 0,
            },

            fortnox_last_synced_at: new Date().toISOString(),
          })
          .eq('id', existingEmployee.id)
      } else {
        // Create new employee
        await createEmployeeFromFortnox(user.id, fortnoxEmp)
      }
    }
  }

  return NextResponse.json({ success: true })
}
```

---

### Vacation Display (Fortnox-synced)

**On employee profile, if Fortnox integration active:**

```
┌────────────────────────────────────────────────────────────────────────┐
│ SEMESTER (FRÅN FORTNOX)                                                │
├────────────────────────────────────────────────────────────────────────┤
│ 📊 Semesterdagar (2024):                                               │
│                                                                        │
│ Rätt till:       30 dagar                                             │
│ Tagna:           12 dagar                                             │
│ Kvar:            18 dagar                                             │
│ Sparade:         5 dagar (från tidigare år)                           │
│                                                                        │
│ ℹ️ Data synkas varje natt från Fortnox (läsläge)                      │
│ Senast uppdaterad: 2024-01-20 02:00                                   │
│                                                                        │
│ [Öppna i Fortnox →]                                                    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Kollektivavtal Management

### Kollektivavtal List Page

**Location:** `/hr/kollektivavtal`

```
┌────────────────────────────────────────────────────────────────────────┐
│ KOLLEKTIVAVTAL                                   [+ Ladda upp nytt]    │
├────────────────────────────────────────────────────────────────────────┤
│ Ladda upp era kollektivavtal för att säkerställa att anställnings-    │
│ avtal följer fackets krav. AI analyserar automatiskt compliance.      │
├────────────────────────────────────────────────────────────────────────┤
│ AKTIVA KOLLEKTIVAVTAL (2)                                              │
│                                                                        │
│ ┌──────────────────────────────────────────────────────────────────┐  │
│ │ 📄 Byggnads Kollektivavtal 2023-2025                             │  │
│ │    12 anställda tilldelade                                       │  │
│ │    Gäller: 2023-01-01 - 2025-12-31                              │  │
│ │    Uppladdad: 2024-01-15 av Erik Johansson                      │  │
│ │                                                                  │  │
│ │    [Visa anställda] [Visa dokument] [Redigera] [Radera]         │  │
│ └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│ ┌──────────────────────────────────────────────────────────────────┐  │
│ │ 📄 Handels Kollektivavtal 2024-2026                              │  │
│ │    5 anställda tilldelade                                        │  │
│ │    Gäller: 2024-01-01 - 2026-12-31                              │  │
│ │    Uppladdad: 2024-01-20 av Erik Johansson                      │  │
│ │                                                                  │  │
│ │    [Visa anställda] [Visa dokument] [Redigera] [Radera]         │  │
│ └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Upload Kollektivavtal Flow

**Step 1: Upload PDF**

```
┌────────────────────────────────────────────────────────────────────────┐
│ LADDA UPP KOLLEKTIVAVTAL                                     [Stäng ×]│
├────────────────────────────────────────────────────────────────────────┤
│ Filnamn:                                                               │
│ [Byggnads Kollektivavtal 2023-2025.pdf_______]                        │
│                                                                        │
│ Beskrivning (valfri):                                                 │
│ [Kollektivavtal för byggarbetare enligt Byggnads___________]          │
│                                                                        │
│ Giltighetsperiod (valfri):                                            │
│ Från: [2023-01-01] Till: [2025-12-31]                                 │
│                                                                        │
│ ┌──────────────────────────────────────────────────────────────────┐  │
│ │ Dra och släpp PDF här eller klicka för att välja               │  │
│ │ [Välj fil]                                                       │  │
│ └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│ Format: PDF                                                           │
│ Max storlek: 50 MB                                                    │
│                                                                        │
│ [Avbryt] [Ladda upp och tilldela →]                                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

**Step 2: Assign to Employees**

**After upload completes, modal opens:**

```
┌────────────────────────────────────────────────────────────────────────┐
│ TILLDELA KOLLEKTIVAVTAL                                      [Stäng ×]│
│ Byggnads Kollektivavtal 2023-2025                                      │
├────────────────────────────────────────────────────────────────────────┤
│ Välj vilka anställda detta kollektivavtal gäller för:                 │
│                                                                        │
│ 🔍 [Sök anställda...___________________________]                       │
│                                                                        │
│ Snabbval:                                                             │
│ [Välj alla arbetare (ARB)] [Välj alla tjänstemän (TJM)]              │
│ [Välj Construction Workers]                                            │
│                                                                        │
│ ☐ Markera alla (25 anställda)                                         │
│                                                                        │
│ ARBETARE (12):                                                         │
│ ☑ Anna Svensson - Construction Worker                                 │
│ ☑ Johan Berg - Construction Worker                                    │
│ ☑ Lisa Andersson - Warehouse Worker                                   │
│ ☐ Erik Johansson - Driver                                             │
│ ... (8 more)                                                           │
│                                                                        │
│ TJÄNSTEMÄN (13):                                                       │
│ ☐ Maria Nilsson - Office Manager                                      │
│ ☐ Karl Svensson - Sales Representative                                │
│ ... (11 more)                                                          │
│                                                                        │
│ 12 anställda valda                                                     │
│                                                                        │
│ [Avbryt] [Tilldela kollektivavtal →]                                   │
└────────────────────────────────────────────────────────────────────────┘
```

**Smart selection logic:**

```typescript
function getQuickSelectEmployees(filter: string): string[] {
  switch (filter) {
    case 'arbetare':
      return employees.filter((e) => e.personnelType === 'ARB').map((e) => e.id)
    case 'tjansteman':
      return employees.filter((e) => e.personnelType === 'TJM').map((e) => e.id)
    case 'construction_workers':
      return employees
        .filter((e) => e.role === 'construction_worker')
        .map((e) => e.id)
    default:
      return []
  }
}
```

---

**Step 3: Background Processing**

**After user clicks [Tilldela]:**

```
┌────────────────────────────────────────────────────────────────────────┐
│ BEARBETAR KOLLEKTIVAVTAL...                                            │
├────────────────────────────────────────────────────────────────────────┤
│ ⏳ Extraherar text från PDF...                                         │
│ ⏳ Chunkar dokument för AI-analys...                                   │
│ ⏳ Genererar embeddings...                                             │
│ ⏳ Sparar i RAG-databasen...                                           │
│                                                                        │
│ Detta kan ta 30-60 sekunder för stora dokument.                       │
└────────────────────────────────────────────────────────────────────────┘
```

**Then:**

```
┌────────────────────────────────────────────────────────────────────────┐
│ KOLLEKTIVAVTAL LADDAT UPP                                    [Stäng]  │
├────────────────────────────────────────────────────────────────────────┤
│ ✅ Byggnads Kollektivavtal 2023-2025 har laddats upp och analyserats  │
│                                                                        │
│ 📊 Statistik:                                                          │
│ • 12 anställda tilldelade                                             │
│ • 245 textchunks skapade                                              │
│ • Redo att användas i AI Chat                                         │
│                                                                        │
│ Testa AI-analysen:                                                    │
│ Dra en anställd + deras anställningsavtal till AI Chat och fråga:    │
│ "Följer detta kontrakt Byggnads kollektivavtal?"                      │
│                                                                        │
│ [Öppna AI Chat] [Stäng]                                               │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Kollektivavtal Processing Logic

```typescript
async function processKollektivavtal(
  fileId: string,
  name: string,
  assignedEmployeeIds: string[],
  userId: string
) {
  // 1. Extract text from PDF
  const file = await getFileFromMinaFiler(fileId)
  const text = await extractPdfText(file)

  // 2. Semantic chunking (500-800 tokens, 100 token overlap)
  const chunks = await semanticChunk(text, {
    maxTokens: 800,
    minTokens: 500,
    overlap: 100,
  })

  // 3. Generate embeddings (OpenAI text-embedding-3-large)
  const embeddings = await embedChunks(chunks)

  // 4. Store kollektivavtal record
  const { data: kollektivavtal } = await supabase
    .from('kollektivavtal')
    .insert({
      file_id: fileId,
      name,
      assigned_employees: assignedEmployeeIds,
      user_id: userId,
      uploaded_at: new Date(),
      active: true,
    })
    .select()
    .single()

  // 5. Store chunks in RAG database
  for (let i = 0; i < chunks.length; i++) {
    await supabase.from('kollektivavtal_chunks').insert({
      kollektivavtal_id: kollektivavtal.id,
      file_id: fileId,
      chunk_index: i,
      chunk_text: chunks[i].text,
      token_count: chunks[i].tokenCount,
      embedding: embeddings[i],
      metadata: {
        file_name: name,
        applicable_to: assignedEmployeeIds,
      },
    })
  }

  // 6. Update employee records
  await supabase
    .from('employees')
    .update({
      assigned_kollektivavtal: supabase.raw(
        'array_append(assigned_kollektivavtal, ?)',
        [kollektivavtal.id]
      ),
    })
    .in('id', assignedEmployeeIds)

  console.log(`Kollektivavtal processed: ${chunks.length} chunks embedded`)
  return kollektivavtal
}
```

---

## HR Dashboard & Metrics

### Dashboard Layout

**Location:** `/hr/oversikt`

```
┌────────────────────────────────────────────────────────────────────────┐
│ HR ÖVERSIKT                                                            │
├────────────────────────────────────────────────────────────────────────┤
│ COMPLIANCE SUMMARY                                                     │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐             │
│ │ Totalt         │ │ ✅ Compliant   │ │ ⚠️ Needs Att.  │             │
│ │ 25 anställda   │ │ 18 (72%)       │ │ 5 (20%)        │             │
│ └────────────────┘ └────────────────┘ └────────────────┘             │
│ ┌────────────────┐                                                     │
│ │ ❌ Non-Compl.  │                                                     │
│ │ 2 (8%)         │                                                     │
│ └────────────────┘                                                     │
├────────────────────────────────────────────────────────────────────────┤
│ DATA QUALITY SCORE                                                     │
│ ┌──────────────────────────────────────────────────────────────────┐  │
│ │ 78%                                                              │  │
│ │ ██████████████████████████████░░░░░░░░░░                         │  │
│ │                                                                  │  │
│ │ ⚠️ 3 anställda saknar telefonnummer                             │  │
│ │ ⚠️ 5 anställda saknar avdelning                                 │  │
│ │ ⚠️ 2 anställda saknar anställningskontrakt                      │  │
│ │                                                                  │  │
│ │ [Åtgärda datakvalitet →]                                         │  │
│ └──────────────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│ DOCUMENTS MISSING                                                      │
│ • 2 anställda saknar anställningskontrakt                             │
│ • 3 anställda saknar GDPR-samtycke                                    │
│ • 1 anställd saknar policy-underskrifter                              │
│                                                                        │
│ [Visa detaljer →]                                                      │
├────────────────────────────────────────────────────────────────────────┤
│ KOLLEKTIVAVTAL COVERAGE                                                │
│ • Byggnads Kollektivavtal: 12 anställda                               │
│ • Handels Kollektivavtal: 5 anställda                                 │
│ • Inget kollektivavtal: 8 anställda                                   │
│                                                                        │
│ [Tilldela kollektivavtal →]                                            │
├────────────────────────────────────────────────────────────────────────┤
│ RECENT ACTIVITY                                                        │
│ • Lisa Andersson - Anställningskontrakt uppladdat (2024-01-20)       │
│ • Johan Berg - Tilldelad Byggnads Kollektivavtal (2024-01-19)        │
│ • Anna Svensson - Profil uppdaterad (2024-01-18)                     │
│                                                                        │
│ [Visa all aktivitet →]                                                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Data Quality Score Calculation

```typescript
function calculateDataQualityScore(employee: Employee): number {
  let score = 100
  const penalties = {
    missingPhone: 5,
    missingDepartment: 5,
    missingContract: 20,
    missingGdprConsent: 15,
    missingPersonnelType: 10,
    missingManager: 5,
  }

  if (!employee.phone) score -= penalties.missingPhone
  if (!employee.department) score -= penalties.missingDepartment
  if (!employee.personnelType) score -= penalties.missingPersonnelType
  if (!employee.managerId) score -= penalties.missingManager

  const hasContract = employee.documents.some(
    (d) => d.documentType === 'employment_contract'
  )
  if (!hasContract) score -= penalties.missingContract

  const hasGdprConsent = employee.documents.some(
    (d) => d.documentType === 'gdpr_consent'
  )
  if (!hasGdprConsent) score -= penalties.missingGdprConsent

  return Math.max(0, score)
}

function calculateCompanyDataQualityScore(employees: Employee[]): number {
  const scores = employees.map(calculateDataQualityScore)
  return Math.round(scores.reduce((a, b) => a + b, 0) / employees.length)
}
```

---

## Document Management

### Upload Flow

**From employee profile → Documents tab:**

1. User drags PDF onto drop zone
2. Modal opens: "Select document type"

   ```
   Dokumenttyp:
   ( ) Anställningskontrakt
   ( ) GDPR-samtycke
   ( ) Policy-underskrift
   ( ) Certifiering
   ( ) Övrigt

   [Avbryt] [Ladda upp]
   ```

3. File uploads to Mina Filer under `/Anställda/Anna_Svensson/`
4. Document linked to employee record
5. Compliance status recalculated

---

### Document Storage in Mina Filer

**Folder structure:**

```
Mina Filer/
├── Anställda/
│   ├── Anna_Svensson/
│   │   ├── Anställningskontrakt_Anna.pdf
│   │   ├── GDPR_Samtycke_Anna.pdf
│   │   └── Första_Hjälpen_Certifikat.pdf
│   ├── Erik_Johansson/
│   │   └── Anställningskontrakt_Erik.pdf
│   └── ...
├── Kollektivavtal/
│   ├── Byggnads_2023-2025.pdf
│   └── Handels_2024-2026.pdf
└── ...
```

**Database linkage:**

```typescript
interface Document {
  fileId: string // UUID in Mina Filer
  employeeId: string // Links to employee
  documentType: DocumentType
  uploadedDate: Date
  uploadedBy: string
}

// When document uploaded:
await supabase.from('files').insert({
  id: fileId,
  user_id: userId,
  filename: 'Anställningskontrakt_Anna.pdf',
  file_path: '/Anställda/Anna_Svensson/Anställningskontrakt_Anna.pdf',
  file_type: 'application/pdf',
  uploaded_date: new Date(),
})

await supabase
  .from('employees')
  .update({
    documents: supabase.raw('array_append(documents, ?)', [
      JSON.stringify({
        fileId,
        documentType: 'employment_contract',
        uploadedDate: new Date(),
      }),
    ]),
  })
  .eq('id', employeeId)
```

---

## Task Linking

### Creating Employee-Linked Tasks

**From employee profile → Tasks tab:**

```
[Skapa ny uppgift för Anna]

Modal opens:
┌────────────────────────────────────────────────────────────────────────┐
│ SKAPA UPPGIFT                                                [Stäng ×]│
├────────────────────────────────────────────────────────────────────────┤
│ Titel:                                                                 │
│ [Uppdatera anställningsavtal med OB-tillägg_______________]           │
│                                                                        │
│ Beskrivning:                                                          │
│ [Enligt Byggnads Kollektivavtal §7.3 krävs OB-tillägg för_____]       │
│ [kvälls- och nattarbete. Uppdatera Annas kontrakt._________]          │
│                                                                        │
│ Kopplad till anställd:                                                │
│ [Anna Svensson ✓] (förvald)                                           │
│                                                                        │
│ Kopplad till lag/kollektivavtal:                                      │
│ [Byggnads Kollektivavtal ▼]                                            │
│                                                                        │
│ Prioritet: ( ) Hög (•) Medel ( ) Låg                                  │
│ Deadline: [2024-02-15]                                                 │
│                                                                        │
│ [Avbryt] [Skapa uppgift]                                              │
└────────────────────────────────────────────────────────────────────────┘
```

**Task appears in:**

1. Employee profile → Tasks tab
2. Dashboard Kanban board (with employee tag)

---

## AI Chat Integration

### Dragging Employee Card to Chat

**User drags employee card from HR list:**

```
From:
┌─────────────────────┐
│ 👤 Anna Svensson    │
│ Construction Worker │
│ ⚠️ Needs Attention  │
└─────────────────────┘

To: AI Chat sidebar (right side)

Context pill appears:
┌────────────────────────────────────┐
│ 👤 Anna Svensson [×]               │
└────────────────────────────────────┘
```

**Employee data sent to AI:**

```json
{
  "type": "employee",
  "employeeId": "emp_abc123",
  "fullName": "Anna Svensson",
  "jobTitle": "Construction Worker",
  "role": "construction_worker",
  "employmentForm": "TV",
  "personnelType": "ARB",
  "employmentDate": "2023-06-15",
  "department": "Construction",
  "applicableLaws": ["law_arbetsmiljo", "law_planbygglagen", ...],
  "assignedKollektivavtal": ["koll_byggnads_2023"],
  "complianceStatus": "needs_attention",
  "documents": [
    {
      "type": "employment_contract",
      "filename": "Anställningskontrakt_Anna.pdf",
      "uploadedDate": "2023-06-15"
    }
  ]
}
```

---

### AI Chat Use Cases

**Use Case 1: Data Quality Check**

```
User drags: 👤 Anna Svensson

User: "Vilka uppgifter saknas för Anna?"

AI:
"Anna Svenssons profil saknar följande information:

⚠️ Kritiska fält:
• GDPR-samtycke (dokument saknas)

💡 Valfria fält som förbättrar datakvalitet:
• Telefonnummer

Datakvalitetsscore: 85/100

Rekommendation: Ladda upp GDPR-samtycke för att nå
100% compliance."
```

---

**Use Case 2: Kollektivavtal Compliance**

```
User drags:
- 👤 Anna Svensson
- 📄 Anställningskontrakt_Anna.pdf

User: "Följer Annas kontrakt Byggnads kollektivavtal?"

AI retrieves:
1. Anna's employment contract (full text)
2. Byggnads Kollektivavtal chunks (vector search)
3. Anställningsskyddslagen (LAS) requirements

AI response:
"Jag har granskat Annas anställningsavtal mot Byggnads
kollektivavtal 2023-2025:

✅ Uppfyller kraven:
- Grundlön 32,000 SEK/mån (minimilön 28,000 enligt §4.1[¹])
- Semester 30 dagar (25 + 5 extra enligt §3.2[²])
- Övertidsersättning 150% (enligt §6.2[³])

❌ Brister:
- OB-tillägg för kvälls-/nattarbete saknas (krävs enligt §7.3[⁴])
- Uppsägningstid 2 månader (kollektivavtalet kräver 3 månader
  för anställda >2 år, §9.4[⁵])

Rekommendation: Uppdatera kontraktet med saknade klausuler.

Vill du att jag skapar en uppgift för att åtgärda detta?

Källor:
[¹] Byggnads Kollektivavtal §4.1 - Minimilöner
[²] Byggnads Kollektivavtal §3.2 - Semesterdagar
[³] Byggnads Kollektivavtal §6.2 - Övertid
[⁴] Byggnads Kollektivavtal §7.3 - OB-tillägg
[⁵] Byggnads Kollektivavtal §9.4 - Uppsägning"
```

**User:** "Ja, skapa uppgift"

**AI creates task:**

```json
{
  "title": "Uppdatera Annas anställningsavtal med OB-tillägg och uppsägningstid",
  "description": "Enligt Byggnads Kollektivavtal §7.3 och §9.4 saknas OB-tillägg och korrekt uppsägningstid (3 månader).",
  "linkedEmployee": "emp_anna",
  "linkedKollektivavtal": "koll_byggnads_2023",
  "priority": "high",
  "deadline": "2024-02-15"
}
```

---

**Use Case 3: Bulk Compliance Audit**

```
User drags:
- 📄 Byggnads Kollektivavtal 2023-2025.pdf

User: "Vilka av mina anställda har kontrakt som INTE följer detta?"

AI:
1. Identifies all employees assigned to Byggnads kollektivavtal (12 employees)
2. Retrieves their employment contracts from Mina Filer
3. Compares each against kollektivavtal
4. Generates summary

AI response:
"Jag har granskat 12 anställningskontrakt mot Byggnads kollektivavtal:

✅ Fullständigt compliant (7):
- Anna Svensson
- Johan Berg
- Lisa Andersson
- ... (4 more)

⚠️ Mindre brister (3):
- Erik Johansson: Saknar OB-tillägg (§7.3)
- Maria Nilsson: Kostnadstillägg otydligt (§8.1)
- Karl Svensson: Semesterdagar 25 istället för 30

❌ Allvarliga brister (2):
- Sara Ek: Grundlön under minimilön (26,000 vs 28,000 kr)
- Jonas Holm: Uppsägningstid för kort (1 mån vs 3 mån)

Vill du att jag skapar uppgifter för att åtgärda dessa brister?"
```

---

## Permissions & Privacy

### User Roles (MVP)

**Owner/Admin:**

- Full access to all employees
- Can add, edit, delete employees
- Can upload kollektivavtal
- Can assign kollektivavtal to employees

**HR Manager (Post-MVP):**

- Can view/edit all employees
- Cannot delete employees
- Can upload documents

**Manager (Post-MVP):**

- Can view direct reports only (based on `managerId` field)
- Cannot edit employee data
- Read-only access

---

### Data Retention

**Active employees:**

- Store indefinitely (as long as company account active)

**Terminated employees:**

- Keep for **2 years** after `employedTo` date
- After 2 years: Auto-delete or prompt user
- Exception: If linked to active tasks/kollektivavtal, keep until resolved

**Deletion prompt:**

```
┌────────────────────────────────────────────────────────────────────────┐
│ RADERING AV ANSTÄLLDA                                                  │
├────────────────────────────────────────────────────────────────────────┤
│ 3 anställda har varit avslutade i över 2 år och kan raderas enligt    │
│ GDPR och svensk lagstiftning:                                         │
│                                                                        │
│ • Anna Svensson (Avslutad: 2022-01-15)                                │
│ • Erik Johansson (Avslutad: 2022-03-01)                               │
│ • Lisa Andersson (Avslutad: 2022-06-30)                               │
│                                                                        │
│ Vill du radera dessa anställdas data permanent?                       │
│                                                                        │
│ ⚠️ Detta kan inte ångras. Dokument i Mina Filer kommer också raderas. │
│                                                                        │
│ [Avbryt] [Arkivera istället] [Radera permanent]                       │
└────────────────────────────────────────────────────────────────────────┘
```

---

### GDPR Compliance

**Data Export (Employee request):**

User clicks [Exportera profil] on employee page:

```
Generates PDF:
┌────────────────────────────────────────────────────────────────────────┐
│ PERSONUPPGIFTSUTDRAG - Anna Svensson                                   │
│ Genererad: 2024-01-20 enligt GDPR Artikel 15                          │
├────────────────────────────────────────────────────────────────────────┤
│ PERSONUPPGIFTER                                                        │
│ Namn: Anna Svensson                                                   │
│ Personnummer: 900101-1234                                             │
│ E-post: anna@company.se                                               │
│ Telefon: 070-123 45 67                                                │
│ ...                                                                    │
│                                                                        │
│ ANSTÄLLNINGSUPPGIFTER                                                  │
│ Anställd sedan: 2023-06-15                                            │
│ Roll: Construction Worker                                             │
│ ...                                                                    │
│                                                                        │
│ DOKUMENT                                                               │
│ • Anställningskontrakt_Anna.pdf (2023-06-15)                          │
│ • GDPR_Samtycke_Anna.pdf (2023-06-15)                                 │
│                                                                        │
│ HISTORIK                                                               │
│ • 2024-01-20: Profil uppdaterad av Erik Johansson                     │
│ • 2023-06-15: Anställd skapad av Erik Johansson                       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### Database Schema

```sql
-- Employees table
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  employee_id TEXT UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  personal_identity_number TEXT,     -- Encrypted

  -- Contact
  email TEXT NOT NULL,
  phone TEXT,
  address JSONB,

  -- Employment
  employment_date DATE NOT NULL,
  employed_to DATE,
  inactive BOOLEAN DEFAULT FALSE,
  employment_form TEXT,
  personnel_type TEXT,
  job_title TEXT NOT NULL,
  department TEXT,
  manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  full_time_equivalent NUMERIC(3,2) DEFAULT 1.0,
  average_weekly_hours NUMERIC(5,2),

  -- Role
  role TEXT NOT NULL,

  -- Compliance
  applicable_laws TEXT[],
  documents JSONB DEFAULT '[]',
  compliance_status TEXT DEFAULT 'needs_attention',
  assigned_kollektivavtal UUID[],

  -- Vacation (Fortnox only)
  vacation_data JSONB,

  -- Role History
  role_history JSONB DEFAULT '[]',

  -- Metadata
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  last_modified_by UUID REFERENCES users(id),

  -- Fortnox Integration
  fortnox_employee_id TEXT,
  fortnox_last_synced_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX employees_user_id_idx ON employees(user_id);
CREATE INDEX employees_inactive_idx ON employees(inactive);
CREATE INDEX employees_compliance_status_idx ON employees(compliance_status);
CREATE INDEX employees_role_idx ON employees(role);
CREATE INDEX employees_manager_id_idx ON employees(manager_id);
CREATE INDEX employees_assigned_kollektivavtal_idx ON employees USING GIN(assigned_kollektivavtal);

-- Kollektivavtal table
CREATE TABLE kollektivavtal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES files(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  assigned_employees UUID[],
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE,
  valid_from DATE,
  valid_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX kollektivavtal_user_id_idx ON kollektivavtal(user_id);
CREATE INDEX kollektivavtal_assigned_employees_idx ON kollektivavtal USING GIN(assigned_employees);

-- Kollektivavtal chunks (for RAG)
CREATE TABLE kollektivavtal_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kollektivavtal_id UUID REFERENCES kollektivavtal(id) ON DELETE CASCADE,
  file_id UUID REFERENCES files(id),
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX kollektivavtal_chunks_kollektivavtal_id_idx ON kollektivavtal_chunks(kollektivavtal_id);
CREATE INDEX kollektivavtal_chunks_embedding_idx ON kollektivavtal_chunks USING hnsw (embedding vector_cosine_ops);
```

---

### API Routes

**Employees:**

- `GET /api/employees` - List employees (with filters)
- `POST /api/employees` - Create employee
- `GET /api/employees/[id]` - Get employee details
- `PATCH /api/employees/[id]` - Update employee
- `DELETE /api/employees/[id]` - Soft delete (set inactive)
- `POST /api/employees/import-csv` - CSV import
- `GET /api/employees/[id]/export-pdf` - GDPR export

**Kollektivavtal:**

- `GET /api/kollektivavtal` - List kollektivavtal
- `POST /api/kollektivavtal` - Upload and process
- `GET /api/kollektivavtal/[id]` - Get details
- `PATCH /api/kollektivavtal/[id]/assign` - Assign to employees
- `DELETE /api/kollektivavtal/[id]` - Delete

**HR Dashboard:**

- `GET /api/hr/metrics` - Get compliance metrics

---

## Post-MVP Features

### 1. Training Tracking System

**Full training management:**

- Master training database
- Auto-assignment based on role + laws
- Expiration tracking
- Renewal notifications
- Training cost tracking

---

### 2. Document Signing (E-Signature)

**Integration with Scrive or BankID:**

- Send employment contract from Laglig.se
- Employee signs with BankID
- Signed document auto-stored in Mina Filer
- Compliance status auto-updated

---

### 3. Onboarding/Offboarding Checklists

**Guided workflows:**

- HR creates employee → Checklist generated
- Track completion: "Send contract ✓", "Schedule training ☐"
- Offboarding: "Collect equipment ☐", "Revoke access ☐"

---

### 4. Employee Self-Service Portal

**Employees can:**

- View own profile
- Upload certifications (Truckkort, etc.)
- Request GDPR data export
- View assigned trainings and deadlines

---

### 5. Bulk Operations

**Multi-select employees:**

- Bulk assign kollektivavtal
- Bulk assign training
- Bulk export compliance reports

---

### 6. Advanced AI Features

**Proactive compliance advisor:**

- "You're hiring a 6th employee - you now need a skyddsombud per AML"
- "Anna's Första Hjälpen expires in 30 days - create renewal task?"

**Predictive analytics:**

- "Based on your growth rate, you'll need to review MBL compliance in 3 months"

---

## Success Metrics

**Product Metrics:**

- **Employee adoption:** % of companies adding >10 employees
- **Document upload rate:** Avg docs per employee
- **Kollektivavtal usage:** % of companies uploading kollektivavtal
- **AI Chat engagement:** % of employees dragged into chat

**Business Metrics:**

- **Upsell driver:** % of Basic users upgrading for HR Module
- **Retention:** Companies with HR Module have X% lower churn
- **Time savings:** HR spends Y% less time on compliance checks

---

## Conclusion

The HR Module is Laglig.se's **strategic differentiator**. By connecting Swedish labor laws to actual employees and integrating kollektivavtal compliance checking, we create value that:

1. **Competitors cannot easily replicate** (Notisum/Karnov lack employee management)
2. **Saves significant costs** (union dispute avoidance = €10,000-50,000+)
3. **Drives upsell** (Pro/Enterprise tier requirement)
4. **Creates stickiness** (switching cost high once employee data imported)

**Next steps:**

1. Build employee CRUD + CSV import
2. Implement kollektivavtal upload + RAG processing
3. Integrate employee cards with AI Chat
4. Deploy HR Dashboard with data quality metrics
5. Measure usage and iterate

---

**Document End**
