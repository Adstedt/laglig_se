# Feature Specification: User & Team Management

**Document Version:** 1.0
**Last Updated:** 2024-01-20
**Status:** Draft
**Owner:** Product Team

---

## Executive Summary

User & Team Management is the foundation that enables Laglig.se to scale from individual users to collaborative teams and enterprise customers. This feature covers:

- **Account structure:** Workspace-based model (like Slack/Notion)
- **Subscription tiers:** Solo (€399), Team (€899), Enterprise (€2,000+)
- **Team collaboration:** Invite users, assign roles, manage permissions
- **Billing integration:** Stripe for Solo/Team, manual invoicing for Enterprise
- **Usage tracking:** Enforce limits, prompt upgrades, track metrics

**Strategic Value:**
- **Revenue driver:** Tiered pricing captures solo entrepreneurs → SMBs → enterprises
- **Team collaboration:** 5 users per Team plan = €899/month (vs. €399 × 5 individual plans)
- **Enterprise land-and-expand:** Start with 1 department, expand to whole organization
- **Network effects:** Teams invite colleagues → viral growth within companies

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [Account Structure](#account-structure)
3. [Subscription Tiers](#subscription-tiers)
4. [User Roles & Permissions](#user-roles--permissions)
5. [Authentication & Signup](#authentication--signup)
6. [Workspace Creation & Onboarding](#workspace-creation--onboarding)
7. [Team Invites](#team-invites)
8. [Billing Integration](#billing-integration)
9. [Usage Tracking & Limits](#usage-tracking--limits)
10. [Workspace Settings](#workspace-settings)
11. [Upgrade/Downgrade Flows](#upgradedowngrade-flows)
12. [Workspace Deletion](#workspace-deletion)
13. [Multi-Workspace Support (Auditor Role)](#multi-workspace-support-auditor-role)
14. [Activity Logs](#activity-logs)
15. [Security & Compliance](#security--compliance)
16. [Technical Implementation](#technical-implementation)

---

## Core Principles

### 1. Workspace-First Model
**Every user belongs to a workspace (company/team).**

**Why:**
- Enables team collaboration (shared law lists, employees, files)
- Clean billing model (pay per workspace, not per user until limit)
- Enterprise-ready (departments as separate workspaces)

**Structure:**
```
Workspace (Bygg AB)
├── Owner (Erik Johansson)
├── Admin (Anna Svensson)
├── HR Manager (Lisa Andersson)
├── Member (Johan Berg)
└── Auditor (External consultant - read-only)

Shared Resources:
├── Law Lists (3 lists, 156 laws)
├── Employees (25 people)
├── Kollektivavtal (2 agreements)
└── Files in Mina Filer (2.3 GB)
```

---

### 2. Trial-Based, No Free Tier
**14-day free trial, then paid plan required.**

**Rationale:**
- Attracts serious customers only (no "tire kickers")
- Higher conversion rate (vs. freemium churn)
- Predictable revenue (no permanent free users consuming resources)

**Competitor comparison:**
- **Notisum:** Subscription-only, no trial → High barrier
- **Karnov:** Freemium → Many inactive users
- **Laglig.se:** 14-day trial → Sweet spot (try before buy, no long-term free)

---

### 3. Three-Tier Pricing (Solo/Team/Enterprise)
**Clear positioning for different customer segments.**

- **Solo (€399/mo):** Micro-businesses, solo entrepreneurs, consultants
- **Team (€899/mo):** SMBs with 2-5 users needing collaboration
- **Enterprise (€2,000+/mo):** Large companies, public sector, unlimited scale

**Price anchoring:** Team plan is 2.25× Solo, but includes 5 users → perceived value.

---

### 4. Flexible Add-Ons for Growth
**Don't lose customers who outgrow tier limits.**

**Add-ons:**
- **+10 Employees:** €100/month (for customers between 50-100 employees)
- **+5 GB Storage:** €50/month (for customers needing more than 1 GB)
- **Extra AI Queries:** €0.50 per query above limit (up to 10% overage)

**Why:** Customers can grow without immediately jumping to Enterprise tier.

---

### 5. Auditor Role for Multi-Workspace Access
**ISO consultants, external auditors serve multiple clients.**

**Implementation:**
- User can be Auditor in 10+ workspaces (doesn't count toward user limits)
- Read-only access (view law lists, employees, export reports)
- Billed to client workspace, not auditor

---

## Account Structure

### Workspace Entity

**A workspace represents a company/team using Laglig.se.**

```typescript
interface Workspace {
  id: string;                          // UUID
  name: string;                        // "Bygg AB"
  orgNumber: string;                   // Swedish organisationsnummer
  sniCode?: string;                    // Industry code for law suggestions
  legalForm?: string;                  // AB, HB, Enskild firma, etc.
  logo?: string;                       // URL to uploaded logo

  // Subscription
  tier: 'solo' | 'team' | 'enterprise';
  billingStatus: 'trial' | 'active' | 'paused' | 'canceled' | 'past_due';
  trialEndsAt?: Date;
  subscriptionId?: string;             // Stripe subscription ID
  billingEmail: string;

  // Usage Tracking
  usageStats: {
    aiQueriesThisMonth: number;
    storageUsed: number;                // Bytes
    employeeCount: number;
    userCount: number;
    lawListCount: number;
    kollektivavtalCount: number;
  };

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;                     // User ID of workspace owner
  deletedAt?: Date;                    // Soft delete timestamp
}
```

---

### User Entity

**A user can belong to one primary workspace and multiple as Auditor.**

```typescript
interface User {
  id: string;                          // UUID
  email: string;                       // Unique, used for auth
  passwordHash?: string;               // Null if OAuth-only
  emailVerified: boolean;

  // Profile
  firstName: string;
  lastName: string;
  phone?: string;

  // Auth
  authMethod: 'email' | 'google' | 'microsoft';
  lastLoginAt?: Date;

  // Primary Workspace
  workspaceId: string;                 // Main workspace
  role: 'owner' | 'admin' | 'hr_manager' | 'member';

  // Additional Workspaces (Auditor only)
  auditorWorkspaces: Array<{
    workspaceId: string;
    invitedBy: string;                 // User ID who invited
    invitedAt: Date;
  }>;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
}
```

---

### Team Invitation Entity

```typescript
interface TeamInvitation {
  id: string;
  workspaceId: string;
  email: string;                       // Invitee email
  role: 'admin' | 'hr_manager' | 'member' | 'auditor';
  invitedBy: string;                   // User ID
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: Date;                     // 7 days from creation
  createdAt: Date;
}
```

---

## Subscription Tiers

### Tier Comparison Table

| Feature | Solo (€399/mo) | Team (€899/mo) | Enterprise (€2,000+/mo) |
|---------|----------------|----------------|-------------------------|
| **Users** | 1 (owner only) | 5 users | Unlimited |
| **Employees (HR)** | 5 employees | 50 employees | Unlimited |
| **Law Lists** | 1 list, max 50 laws | Unlimited lists & laws | Unlimited |
| **AI Chat Queries** | 50/month (+10% overage) | 500/month (+10% overage) | Unlimited |
| **Kollektivavtal** | 1 kollektivavtal | 5 kollektivavtal | Unlimited |
| **Storage (Mina Filer)** | 1 GB | 1 GB | Custom (10+ GB) |
| **Change Monitoring** | ✅ Email notifications | ✅ Email notifications | ✅ Email + SMS + In-app |
| **Fortnox Integration** | ❌ | ✅ (Post-MVP) | ✅ |
| **Support** | Email only | Priority email | Dedicated CSM + phone |
| **Audit Logs** | ❌ | ❌ | ✅ (unlimited retention) |
| **Custom Onboarding** | ❌ Self-service | ❌ Self-service | ✅ CSM-led onboarding |
| **SLA** | None | 24-hour response | 4-hour response + 99.9% uptime |
| **Annual Discount** | 17% (€3,980/year) | 17% (€8,950/year) | Negotiable |
| **Free Trial** | 14 days | 14 days | Custom demo |

---

### Tier Positioning

**Solo (€399/month):**
- **Target customer:** Solo entrepreneur, consultant, micro-business (<5 employees)
- **Use case:** "I just need basic compliance tracking for my small business"
- **Example:** Freelance electrician tracking AML, ATL, LAS for himself + 2 apprentices

**Team (€899/month):**
- **Target customer:** SMB with 5-25 employees, multiple stakeholders (Owner + HR + Ops)
- **Use case:** "Our HR manager needs to track employees, I need compliance reports"
- **Example:** Construction company with Owner, HR Manager, Site Manager, 20 workers

**Enterprise (€2,000+/month):**
- **Target customer:** Large corporations (100+ employees), public sector, multi-location
- **Use case:** "We need unlimited users, dedicated support, and audit trails for compliance"
- **Example:** Municipality with 500 employees across 10 departments, ISO 27001 certified

---

### Add-Ons (Flexible Pricing)

**Available for Solo & Team tiers:**

**+10 Employees:**
- **Price:** €100/month
- **Use case:** Team customer with 60 employees (50 included, +10 add-on)
- **Limit:** Max 100 employees total via add-ons (then force Enterprise upgrade)

**+5 GB Storage:**
- **Price:** €50/month
- **Use case:** Customer with many PDF contracts, risk assessments
- **Limit:** Max 10 GB total via add-ons

**AI Query Overage:**
- **Price:** €0.50 per query above limit
- **Limit:** Max 10% overage (e.g., 55 queries for Solo plan = 50 included + 5 overage)
- **After 10% overage:** Hard block with upgrade prompt

---

## User Roles & Permissions

### Role Hierarchy

```
Owner (1 per workspace)
  └── Full control (billing, delete workspace, transfer ownership)

Admin (Unlimited)
  └── Can do everything except billing & workspace deletion

HR Manager (Unlimited)
  └── Full access to HR Module, read-only for law lists

Member (Unlimited)
  └── Can view law lists & use AI Chat, no HR access

Auditor (External, read-only, multi-workspace)
  └── Can view all data, export reports, no editing
```

---

### Permissions Matrix

| Action | Owner | Admin | HR Manager | Member | Auditor |
|--------|-------|-------|------------|--------|---------|
| **Law Lists** | | | | | |
| View law lists | ✅ | ✅ | ✅ (read-only) | ✅ | ✅ |
| Create/edit/delete lists | ✅ | ✅ | ❌ | ❌ | ❌ |
| Add/remove laws from lists | ✅ | ✅ | ❌ | ❌ | ❌ |
| **HR Module** | | | | | |
| View employees | ✅ | ✅ | ✅ | ❌ | ✅ |
| View sensitive data (personnummer) | ✅ | ✅ | ✅ | ❌ | ✅ |
| Create/edit/delete employees | ✅ | ✅ | ✅ | ❌ | ❌ |
| Upload kollektivavtal | ✅ | ✅ | ✅ | ❌ | ❌ |
| **AI Chat** | | | | | |
| Use AI Chat | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Documents (Mina Filer)** | | | | | |
| View files | ✅ | ✅ | ✅ | ✅ | ✅ |
| Upload/delete files | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Tasks (Kanban)** | | | | | |
| View tasks | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create/edit/complete tasks | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Team Management** | | | | | |
| Invite users | ✅ | ✅ | ❌ | ❌ | ❌ |
| Remove users | ✅ | ✅ | ❌ | ❌ | ❌ |
| Change user roles | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Billing** | | | | | |
| View billing info | ✅ | ❌ | ❌ | ❌ | ❌ |
| Change plan | ✅ | ❌ | ❌ | ❌ | ❌ |
| Update payment method | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Workspace Settings** | | | | | |
| Edit workspace info | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete workspace | ✅ | ❌ | ❌ | ❌ | ❌ |
| Transfer ownership | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Reporting** | | | | | |
| Export compliance reports | ✅ | ✅ | ✅ | ❌ | ✅ |
| View audit logs (Enterprise) | ✅ | ✅ | ❌ | ❌ | ✅ |

---

### Role Descriptions

**Owner:**
- **Count:** 1 per workspace (transferable)
- **Typical user:** CEO, Founder, Managing Director
- **Key powers:**
  - Manages subscription & billing
  - Can delete workspace
  - Can transfer ownership to another user
  - Full access to all features

**Admin:**
- **Count:** Unlimited (within user tier limit)
- **Typical user:** COO, Operations Manager, Compliance Officer
- **Key powers:**
  - Same as Owner except billing & workspace deletion
  - Can invite/remove users
  - Can manage all law lists, employees, tasks

**HR Manager:**
- **Count:** Unlimited
- **Typical user:** HR Director, HR Coordinator
- **Key powers:**
  - Full access to HR Module (employees, kollektivavtal, documents)
  - Can view sensitive employee data (personnummer)
  - Read-only access to law lists (can view, cannot edit)
  - Can use AI Chat with employee context

**Member:**
- **Count:** Unlimited
- **Typical user:** Site Manager, Team Lead, regular employee
- **Key powers:**
  - Can view law lists
  - Can use AI Chat
  - Cannot access HR Module
  - Cannot edit anything

**Auditor:**
- **Count:** Unlimited (doesn't count toward workspace user limit)
- **Typical user:** External ISO consultant, accountant, lawyer
- **Key powers:**
  - Read-only access to all workspace data
  - Can export compliance reports
  - Can join multiple workspaces
  - Cannot edit anything

---

## Authentication & Signup

### Supported Auth Methods

**MVP:**
1. **Email/Password** - Standard signup with email verification
2. **Google OAuth** - "Sign in with Google"
3. **Microsoft OAuth** - "Sign in with Microsoft" (for businesses using M365)

**Post-MVP:**
4. **BankID** - Swedish e-ID (for government/public sector customers)
5. **Magic Links** - Passwordless email login

---

### Email/Password Signup Flow

**Step 1: User visits `/signup`**

```
┌────────────────────────────────────────────────────────────────┐
│ SKAPA KONTO                                                    │
├────────────────────────────────────────────────────────────────┤
│ E-post:                                                        │
│ [___________________________________________________]          │
│                                                                │
│ Lösenord:                                                      │
│ [___________________________________________________]          │
│ ⓘ Minst 8 tecken, 1 nummer, 1 specialtecken, 1 versal        │
│                                                                │
│ [Skapa konto →]                                                │
│                                                                │
│ ──────────────── eller ────────────────                        │
│                                                                │
│ [🔵 Fortsätt med Google]                                       │
│ [📘 Fortsätt med Microsoft]                                    │
│                                                                │
│ Har du redan ett konto? [Logga in]                            │
└────────────────────────────────────────────────────────────────┘
```

---

**Step 2: Email Verification**

After signup, user sees:

```
┌────────────────────────────────────────────────────────────────┐
│ VERIFIERA DIN E-POST                                           │
├────────────────────────────────────────────────────────────────┤
│ Vi har skickat en 6-siffrig kod till:                         │
│ erik@example.com                                               │
│                                                                │
│ Ange koden här:                                               │
│ [_] [_] [_] [_] [_] [_]                                       │
│                                                                │
│ Inte fått koden? [Skicka igen]                                │
└────────────────────────────────────────────────────────────────┘
```

**Email content:**
```
Subject: Verifiera din e-post för Laglig.se

Hej!

Din verifieringskod är: 123456

Koden är giltig i 15 minuter.

Om du inte skapade ett konto på Laglig.se, ignorera detta mejl.

Mvh,
Laglig.se
```

---

### Password Requirements

**Complexity rules:**
- Minimum 8 characters
- At least 1 number
- At least 1 special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
- At least 1 uppercase letter
- Not in "Have I Been Pwned" breach database

**Validation:**
```typescript
async function validatePassword(password: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  if (password.length < 8) {
    return { valid: false, error: 'Lösenord måste vara minst 8 tecken' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, error: 'Lösenord måste innehålla minst 1 siffra' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, error: 'Lösenord måste innehålla minst 1 specialtecken' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Lösenord måste innehålla minst 1 versal' };
  }

  // Check against breach database
  const isPwned = await checkHaveIBeenPwned(password);
  if (isPwned) {
    return {
      valid: false,
      error: 'Detta lösenord har läckt i en dataintrång. Välj ett annat.',
    };
  }

  return { valid: true };
}

async function checkHaveIBeenPwned(password: string): Promise<boolean> {
  const sha1 = hashSHA1(password);
  const prefix = sha1.substring(0, 5);
  const suffix = sha1.substring(5);

  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
  const hashes = await response.text();

  return hashes.toLowerCase().includes(suffix.toLowerCase());
}
```

---

### OAuth Signup Flow

**Google/Microsoft OAuth:**

1. User clicks "Fortsätt med Google"
2. Redirects to Google OAuth consent screen
3. User authorizes Laglig.se
4. Google redirects back with access token
5. System checks if email exists:
   - **If yes:** Log in existing user
   - **If no:** Create new user, proceed to workspace creation

**No email verification needed** (Google/Microsoft already verified email)

---

### Login Flow

**Step 1: User visits `/login`**

```
┌────────────────────────────────────────────────────────────────┐
│ LOGGA IN                                                       │
├────────────────────────────────────────────────────────────────┤
│ E-post:                                                        │
│ [___________________________________________________]          │
│                                                                │
│ Lösenord:                                                      │
│ [___________________________________________________]          │
│                                                                │
│ [Logga in →]                 [Glömt lösenord?]                │
│                                                                │
│ ──────────────── eller ────────────────                        │
│                                                                │
│ [🔵 Fortsätt med Google]                                       │
│ [📘 Fortsätt med Microsoft]                                    │
│                                                                │
│ Inget konto? [Skapa konto]                                    │
└────────────────────────────────────────────────────────────────┘
```

---

### Password Reset Flow

**Step 1: User clicks "Glömt lösenord?"**

```
┌────────────────────────────────────────────────────────────────┐
│ ÅTERSTÄLL LÖSENORD                                             │
├────────────────────────────────────────────────────────────────┤
│ Ange din e-postadress så skickar vi en återställningslänk.    │
│                                                                │
│ E-post:                                                        │
│ [___________________________________________________]          │
│                                                                │
│ [Skicka återställningslänk →]                                  │
│                                                                │
│ [← Tillbaka till inloggning]                                  │
└────────────────────────────────────────────────────────────────┘
```

**Step 2: Email sent**

```
Subject: Återställ ditt lösenord för Laglig.se

Hej Erik!

Vi fick en begäran om att återställa ditt lösenord.

[Återställ lösenord →]

Länken är giltig i 1 timme.

Om du inte begärde detta, ignorera detta mejl.

Mvh,
Laglig.se
```

**Step 3: User clicks link → `/reset-password?token=abc123`**

```
┌────────────────────────────────────────────────────────────────┐
│ SKAPA NYTT LÖSENORD                                            │
├────────────────────────────────────────────────────────────────┤
│ Nytt lösenord:                                                 │
│ [___________________________________________________]          │
│ ⓘ Minst 8 tecken, 1 nummer, 1 specialtecken, 1 versal        │
│                                                                │
│ Bekräfta lösenord:                                            │
│ [___________________________________________________]          │
│                                                                │
│ [Återställ lösenord →]                                         │
└────────────────────────────────────────────────────────────────┘
```

---

## Workspace Creation & Onboarding

### Workspace Creation (Post-Signup)

**After email verification, user proceeds to workspace setup:**

**Step 1: Organisationsnummer Lookup**

```
┌────────────────────────────────────────────────────────────────┐
│ SKAPA WORKSPACE                                                │
├────────────────────────────────────────────────────────────────┤
│ Steg 1 av 3: Företagsinformation                              │
│                                                                │
│ Organisationsnummer:                                           │
│ [556123-4567_____________________________] [Lookup →]         │
│                                                                │
│ ⓘ Vi hämtar företagsinformation från Bolagsverket            │
└────────────────────────────────────────────────────────────────┘
```

**After clicking [Lookup →], Bolagsverket API fetches company data:**

```typescript
async function lookupBolagsverket(orgNumber: string) {
  const response = await fetch(
    `https://data.bolagsverket.se/api/v1/company/${orgNumber}`
  );

  if (!response.ok) {
    throw new Error('Organisationsnummer hittades inte i Bolagsverket');
  }

  const data = await response.json();

  return {
    companyName: data.name,
    address: {
      street: data.address.street,
      city: data.address.city,
      postCode: data.address.postCode,
    },
    sniCode: data.sniCode,
    legalForm: data.legalForm, // AB, HB, Enskild firma, etc.
  };
}
```

---

**Step 2: Confirm Pre-filled Data**

```
┌────────────────────────────────────────────────────────────────┐
│ SKAPA WORKSPACE                                                │
├────────────────────────────────────────────────────────────────┤
│ Steg 1 av 3: Företagsinformation                              │
│                                                                │
│ ✅ Hittades i Bolagsverket                                     │
│                                                                │
│ Företagsnamn:                                                  │
│ [Bygg AB_______________________________________]               │
│                                                                │
│ Adress:                                                        │
│ [Storgatan 1____________________________________]              │
│ [123 45] [Stockholm__________________________]                │
│                                                                │
│ Bransch (SNI-kod):                                            │
│ [41.200 - Byggverksamhet ▼]                                   │
│                                                                │
│ Juridisk form:                                                │
│ [Aktiebolag (AB)]                                             │
│                                                                │
│ [← Tillbaka] [Nästa: Välj plan →]                             │
└────────────────────────────────────────────────────────────────┘
```

---

**Step 3: Select Plan**

```
┌────────────────────────────────────────────────────────────────┐
│ SKAPA WORKSPACE                                                │
├────────────────────────────────────────────────────────────────┤
│ Steg 2 av 3: Välj plan                                        │
│                                                                │
│ ┌──────────────────┐ ┌──────────────────┐ ┌─────────────────┐│
│ │ SOLO             │ │ TEAM ⭐ Populär  │ │ ENTERPRISE      ││
│ │ 399 € /månad     │ │ 899 € /månad     │ │ Kontakta oss    ││
│ │                  │ │                  │ │                 ││
│ │ • 1 användare    │ │ • 5 användare    │ │ • Unlimited     ││
│ │ • 5 anställda    │ │ • 50 anställda   │ │ • Dedicated CSM ││
│ │ • 50 AI-frågor   │ │ • 500 AI-frågor  │ │ • Audit logs    ││
│ │ • 1 GB lagring   │ │ • 1 GB lagring   │ │ • Custom SLA    ││
│ │                  │ │ • Fortnox        │ │                 ││
│ │ [Välj Solo]      │ │ [Välj Team]      │ │ [Kontakta oss]  ││
│ └──────────────────┘ └──────────────────┘ └─────────────────┘│
│                                                                │
│ ✨ 14 dagars gratis provperiod på alla planer                  │
│ 💳 Inget betalkort krävs under provperioden                    │
│                                                                │
│ [← Tillbaka]                                                   │
└────────────────────────────────────────────────────────────────┘
```

**Note:** User selects plan, but **doesn't enter payment until trial ends** (14 days later).

---

**Step 4: Payment Method (Optional - Skip if Trial)**

**If user selects Solo/Team:**

```
┌────────────────────────────────────────────────────────────────┐
│ SKAPA WORKSPACE                                                │
├────────────────────────────────────────────────────────────────┤
│ Steg 3 av 3: Betalsätt                                        │
│                                                                │
│ ⓘ Du debiteras inte förrän din 14-dagars provperiod är slut   │
│                                                                │
│ [Lägg till betalkort →]                                        │
│ [Hoppa över - lägg till senare]                               │
│                                                                │
│ [← Tillbaka]                                                   │
└────────────────────────────────────────────────────────────────┘
```

**If user clicks "Lägg till betalkort" → Stripe Checkout embeds:**

```
┌────────────────────────────────────────────────────────────────┐
│ Stripe Checkout iframe:                                        │
│                                                                │
│ Kortnummer: [____ ____ ____ ____]                             │
│ Utgångsdatum: [MM / YY]  CVC: [___]                           │
│                                                                │
│ [Spara kort]                                                   │
└────────────────────────────────────────────────────────────────┘
```

**After card saved or skipped:**

```
┌────────────────────────────────────────────────────────────────┐
│ ✅ WORKSPACE SKAPAD!                                           │
├────────────────────────────────────────────────────────────────┤
│ Välkommen till Laglig.se, Erik!                               │
│                                                                │
│ Din 14-dagars provperiod börjar nu.                           │
│ Provperioden slutar: 2024-02-03                               │
│                                                                │
│ Kom igång:                                                     │
│ ☐ Lägg till din första lag i en lista                        │
│ ☐ Ladda upp ett dokument till Mina Filer                     │
│ ☐ Fråga AI om lagefterlevnad                                  │
│ ☐ Lägg till din första anställd (Team-plan)                  │
│                                                                │
│ [Börja utforska →]                                             │
│ [Hoppa över, gå till Dashboard]                               │
└────────────────────────────────────────────────────────────────┘
```

---

### Onboarding Tasks (Interactive Tutorial)

**If user clicks "Börja utforska":**

**Task 1: Add First Law**

```
┌────────────────────────────────────────────────────────────────┐
│ STEG 1/4: LÄGG TILL DIN FÖRSTA LAG                            │
├────────────────────────────────────────────────────────────────┤
│ Baserat på din bransch (Byggverksamhet) rekommenderar vi:     │
│                                                                │
│ ☐ Arbetsmiljölagen (AML) - Obligatorisk för alla arbetsgivare │
│ ☐ Plan- och bygglagen (PBL) - Byggverksamhet                 │
│ ☐ Anställningsskyddslagen (LAS) - Om du har anställda        │
│                                                                │
│ [Lägg till alla →]  [Sök annan lag]                           │
│                                                                │
│ [Hoppa över]                                                   │
└────────────────────────────────────────────────────────────────┘
```

**After adding laws:**

```
✅ Bra jobbat! Du har nu 3 lagar i din lista.
```

---

**Task 2: Upload Document**

```
┌────────────────────────────────────────────────────────────────┐
│ STEG 2/4: LADDA UPP ETT DOKUMENT                              │
├────────────────────────────────────────────────────────────────┤
│ Ladda upp ett dokument (t.ex. anställningsavtal, policy)      │
│ så kan AI hjälpa dig granska det.                             │
│                                                                │
│ [Drag & drop eller välj fil]                                   │
│                                                                │
│ [Hoppa över]                                                   │
└────────────────────────────────────────────────────────────────┘
```

---

**Task 3: Ask AI a Question**

```
┌────────────────────────────────────────────────────────────────┐
│ STEG 3/4: FRÅGA AI OM EFTERLEVNAD                             │
├────────────────────────────────────────────────────────────────┤
│ Prova att fråga AI om dina lagar:                             │
│                                                                │
│ Förslag:                                                       │
│ • "Vad kräver Arbetsmiljölagen för byggarbetare?"             │
│ • "Hur ofta måste jag göra riskbedömningar?"                  │
│                                                                │
│ [Öppna AI Chat →]                                              │
│                                                                │
│ [Hoppa över]                                                   │
└────────────────────────────────────────────────────────────────┘
```

---

**Task 4: Add Employee (Team plan only)**

```
┌────────────────────────────────────────────────────────────────┐
│ STEG 4/4: LÄGG TILL DIN FÖRSTA ANSTÄLLD                       │
├────────────────────────────────────────────────────────────────┤
│ Håll koll på dina anställdas efterlevnad.                     │
│                                                                │
│ [+ Lägg till anställd]                                         │
│                                                                │
│ [Hoppa över]                                                   │
└────────────────────────────────────────────────────────────────┘
```

---

**After completing all tasks (or skipping):**

```
┌────────────────────────────────────────────────────────────────┐
│ 🎉 DU ÄR REDO ATT ANVÄNDA LAGLIG.SE!                          │
├────────────────────────────────────────────────────────────────┤
│ Du har nu:                                                     │
│ ✅ 3 lagar i din lista                                         │
│ ✅ 1 dokument uppladdat                                        │
│ ✅ Använt AI Chat                                              │
│                                                                │
│ [Gå till Dashboard →]                                          │
└────────────────────────────────────────────────────────────────┘
```

---

## Team Invites

### Invite Flow (Owner/Admin)

**Step 1: Owner goes to Settings → Team → "Bjud in medlem"**

```
┌────────────────────────────────────────────────────────────────┐
│ BJUD IN TEAMMEDLEM                                   [Stäng ×]│
├────────────────────────────────────────────────────────────────┤
│ E-post:                                                        │
│ [anna@example.com_________________________________]            │
│                                                                │
│ Roll:                                                          │
│ [Admin ▼]                                                      │
│ │ Admin - Kan hantera allt utom billing                       │
│ │ HR Manager - Full access till HR, read-only lagar          │
│ │ Member - Kan visa lagar & använda AI Chat                  │
│ │ Auditor - Läsbehörighet, multi-workspace                   │
│                                                                │
│ Personligt meddelande (valfritt):                             │
│ [Välkommen till teamet!_______________________________]       │
│                                                                │
│ [Avbryt] [Skicka inbjudan →]                                   │
└────────────────────────────────────────────────────────────────┘
```

---

**Step 2: System sends email**

```
Subject: Du har blivit inbjuden till Bygg AB på Laglig.se

Hej!

Erik Johansson har bjudit in dig att gå med i "Bygg AB" på
Laglig.se som Admin.

Personligt meddelande från Erik:
"Välkommen till teamet!"

[Acceptera inbjudan →]

Denna länk går ut om 7 dagar.

Om du inte känner igen avsändaren, ignorera detta mejl.

Mvh,
Laglig.se
```

---

**Step 3: Invitee clicks link**

**If invitee already has Laglig.se account:**
```
┌────────────────────────────────────────────────────────────────┐
│ ACCEPTERA INBJUDAN                                             │
├────────────────────────────────────────────────────────────────┤
│ Du har blivit inbjuden att gå med i:                          │
│                                                                │
│ Workspace: Bygg AB                                             │
│ Roll: Admin                                                    │
│ Inbjuden av: Erik Johansson                                   │
│                                                                │
│ ⚠️ Viktigt: Du kan bara tillhöra 1 workspace som Owner/Admin. │
│ Om du accepterar kommer du att lämna ditt nuvarande workspace. │
│                                                                │
│ Nuvarande workspace: "Min Firma" (Owner)                      │
│                                                                │
│ [Avböj] [Acceptera och byt workspace →]                        │
└────────────────────────────────────────────────────────────────┘
```

**If invitee doesn't have account:**
```
┌────────────────────────────────────────────────────────────────┐
│ ACCEPTERA INBJUDAN                                             │
├────────────────────────────────────────────────────────────────┤
│ Du har blivit inbjuden att gå med i "Bygg AB" som Admin.      │
│                                                                │
│ Skapa ditt konto för att fortsätta:                           │
│                                                                │
│ E-post: anna@example.com (låst)                               │
│                                                                │
│ Lösenord:                                                      │
│ [___________________________________________________]          │
│                                                                │
│ [Skapa konto & gå med →]                                       │
│                                                                │
│ ──────────────── eller ────────────────                        │
│                                                                │
│ [🔵 Fortsätt med Google]                                       │
│ [📘 Fortsätt med Microsoft]                                    │
└────────────────────────────────────────────────────────────────┘
```

**Important:** Email address is locked to invitation email (anna@example.com). If user signs up with Google, Google account email MUST match invitation email.

---

### Team Management Page

**Location:** `/settings/team`

```
┌────────────────────────────────────────────────────────────────┐
│ TEAM                                         [+ Bjud in medlem]│
├────────────────────────────────────────────────────────────────┤
│ MEDLEMMAR (3 / 5)                                              │
│                                                                │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ 👤 Erik Johansson                              [Owner]   │  │
│ │    erik@example.com                                      │  │
│ │    Senast aktiv: 2 timmar sedan                          │  │
│ │    [Överför ägarskap →]                                  │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ 👤 Anna Svensson                               [Admin ▼] │  │
│ │    anna@example.com                                      │  │
│ │    Senast aktiv: 5 minuter sedan                         │  │
│ │    [Ta bort från team]                                   │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ 👤 Lisa Andersson                       [HR Manager ▼]   │  │
│ │    lisa@example.com                                      │  │
│ │    Senast aktiv: Igår                                    │  │
│ │    [Ta bort från team]                                   │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│ VÄNTANDE INBJUDNINGAR (1)                                      │
│                                                                │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ ✉️  johan@example.com                          [Member]  │  │
│ │    Inbjuden: 2024-01-18                                  │  │
│ │    Går ut: 2024-01-25                                    │  │
│ │    [Skicka igen] [Avbryt inbjudan]                       │  │
│ └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

### Transfer Ownership

**Owner right-clicks another user → "Överför ägarskap":**

```
┌────────────────────────────────────────────────────────────────┐
│ ⚠️ ÖVERFÖR ÄGARSKAP                                 [Stäng ×]│
├────────────────────────────────────────────────────────────────┤
│ Du är på väg att överföra ägarskapet av "Bygg AB" till:       │
│                                                                │
│ Anna Svensson (anna@example.com)                               │
│                                                                │
│ Efter överföringen:                                            │
│ • Anna blir Owner (full kontroll över workspace & billing)    │
│ • Du blir Admin (kan inte hantera billing eller radera)       │
│                                                                │
│ Skriv ditt lösenord för att bekräfta:                         │
│ [___________________________________________________]          │
│                                                                │
│ [Avbryt] [Överför ägarskap →]                                  │
└────────────────────────────────────────────────────────────────┘
```

---

## Billing Integration

### Stripe Integration Architecture

**Payment flow:**
1. User selects plan (Solo/Team) during signup or upgrade
2. **If trial:** Create Stripe subscription with `trial_period_days: 14`, no charge
3. **After trial ends:** Stripe automatically charges saved card
4. **If upgrade during trial:** Trial ends immediately, charge prorated amount

---

### Stripe Subscription Creation

```typescript
async function createStripeSubscription(
  workspaceId: string,
  tier: 'solo' | 'team',
  paymentMethodId?: string
) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  // Create or retrieve Stripe customer
  const workspace = await getWorkspace(workspaceId);
  let customerId = workspace.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: workspace.billingEmail,
      name: workspace.name,
      metadata: {
        workspace_id: workspaceId,
        org_number: workspace.orgNumber,
      },
    });
    customerId = customer.id;

    await updateWorkspace(workspaceId, { stripeCustomerId: customerId });
  }

  // Attach payment method (if provided)
  if (paymentMethodId) {
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  }

  // Create subscription
  const priceId = tier === 'solo'
    ? process.env.STRIPE_SOLO_PRICE_ID
    : process.env.STRIPE_TEAM_PRICE_ID;

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    trial_period_days: 14,
    metadata: {
      workspace_id: workspaceId,
      tier,
    },
  });

  // Update workspace
  await updateWorkspace(workspaceId, {
    subscriptionId: subscription.id,
    tier,
    billingStatus: 'trial',
    trialEndsAt: new Date(subscription.trial_end * 1000),
  });

  return subscription;
}
```

---

### Stripe Webhooks

**Handle subscription events:**

```typescript
// app/api/webhooks/stripe/route.ts
export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')!;
  const body = await req.text();

  const event = stripe.webhooks.constructEvent(
    body,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET!
  );

  switch (event.type) {
    case 'customer.subscription.created':
      await handleSubscriptionCreated(event.data.object);
      break;

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object);
      break;

    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(event.data.object);
      break;

    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return new Response('OK', { status: 200 });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const workspaceId = subscription.metadata.workspace_id;

  // Update workspace billing status
  let billingStatus: BillingStatus = 'active';

  if (subscription.status === 'trialing') {
    billingStatus = 'trial';
  } else if (subscription.status === 'active') {
    billingStatus = 'active';
  } else if (subscription.status === 'past_due') {
    billingStatus = 'past_due';
  } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
    billingStatus = 'canceled';
  }

  await updateWorkspace(workspaceId, {
    billingStatus,
    trialEndsAt: subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : null,
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const workspace = await getWorkspaceByStripeCustomerId(customerId);

  // Update workspace status
  await updateWorkspace(workspace.id, {
    billingStatus: 'past_due',
  });

  // Send email to owner
  await sendEmail({
    to: workspace.billingEmail,
    subject: 'Betalning misslyckades för Laglig.se',
    body: `
      Hej!

      Betalningen för din Laglig.se-prenumeration misslyckades.

      Vänligen uppdatera ditt betalkort för att undvika avbrott.

      [Uppdatera betalkort →]

      Mvh,
      Laglig.se
    `,
  });
}
```

---

### Enterprise Billing (Manual Invoicing)

**Enterprise customers don't use Stripe.**

**Flow:**
1. Sales team creates workspace manually in admin panel
2. Sets `tier = 'enterprise'`, `billingStatus = 'active'`, `subscriptionId = null`
3. Finance team sends invoice monthly/quarterly via email or Fortnox
4. Payment tracked manually (mark as paid in admin panel)

**Admin panel:**
```
Enterprise Workspace: Kommun AB
Tier: Enterprise
Billing: Manual Invoice
Contract: €5,000/month (12-month commitment)
Next invoice: 2024-02-01
Status: Active

[Mark invoice paid] [Pause account] [Cancel contract]
```

---

## Usage Tracking & Limits

### Tracked Metrics

**Per workspace, per billing period (monthly):**

```typescript
interface UsageStats {
  aiQueriesThisMonth: number;
  storageUsed: number;              // Bytes
  employeeCount: number;
  userCount: number;
  lawListCount: number;
  kollektivavtalCount: number;
}
```

---

### AI Query Limit Enforcement

**On each AI Chat query:**

```typescript
async function checkAIQueryLimit(workspaceId: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const workspace = await getWorkspace(workspaceId);
  const usage = workspace.usageStats;

  // Get tier limits
  const limits = {
    solo: { queries: 50, overage: 5 },      // 50 + 10% = 55 max
    team: { queries: 500, overage: 50 },    // 500 + 10% = 550 max
    enterprise: { queries: Infinity, overage: 0 },
  };

  const limit = limits[workspace.tier];
  const maxQueries = limit.queries + limit.overage;

  if (usage.aiQueriesThisMonth >= maxQueries) {
    return {
      allowed: false,
      reason: 'query_limit_exceeded',
    };
  }

  // Allow if within limit or within overage
  return { allowed: true };
}
```

**Response when limit exceeded:**

```
┌────────────────────────────────────────────────────────────────┐
│ ⚠️ AI-FRÅGOR SLUT                                              │
├────────────────────────────────────────────────────────────────┤
│ Du har använt 55/50 AI-frågor denna månad (inkl. 10% överskott│
│                                                                │
│ För att fortsätta fråga AI:                                   │
│ • Uppgradera till Team (500 frågor/månad)                     │
│ • Vänta till nästa månad (återställs 2024-02-01)              │
│                                                                │
│ [Uppgradera till Team →]                                       │
└────────────────────────────────────────────────────────────────┘
```

---

### Storage Limit Enforcement

**On file upload:**

```typescript
async function checkStorageLimit(
  workspaceId: string,
  fileSize: number
): Promise<{ allowed: boolean; reason?: string }> {
  const workspace = await getWorkspace(workspaceId);
  const currentUsage = workspace.usageStats.storageUsed;

  const limits = {
    solo: 1 * 1024 * 1024 * 1024,        // 1 GB
    team: 1 * 1024 * 1024 * 1024,        // 1 GB
    enterprise: Infinity,
  };

  const limit = limits[workspace.tier];

  if (currentUsage + fileSize > limit) {
    return {
      allowed: false,
      reason: 'storage_limit_exceeded',
    };
  }

  return { allowed: true };
}
```

**Response when limit exceeded:**

```
┌────────────────────────────────────────────────────────────────┐
│ ⚠️ LAGRINGSKAPACITET FULL                                      │
├────────────────────────────────────────────────────────────────┤
│ Du har använt 1.0 GB av 1.0 GB lagring.                        │
│                                                                │
│ För att ladda upp fler filer:                                 │
│ • Ta bort gamla filer                                         │
│ • Köp +5 GB lagring (50 €/månad)                              │
│ • Uppgradera till Enterprise (custom lagring)                 │
│                                                                │
│ [Hantera lagring] [Köp mer lagring →]                          │
└────────────────────────────────────────────────────────────────┘
```

---

### Employee Limit Enforcement

**On adding employee:**

```typescript
async function checkEmployeeLimit(workspaceId: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const workspace = await getWorkspace(workspaceId);
  const currentCount = workspace.usageStats.employeeCount;

  const limits = {
    solo: 5,
    team: 50,
    enterprise: Infinity,
  };

  const limit = limits[workspace.tier];

  if (currentCount >= limit) {
    return {
      allowed: false,
      reason: 'employee_limit_exceeded',
    };
  }

  return { allowed: true };
}
```

**Response when limit exceeded:**

```
┌────────────────────────────────────────────────────────────────┐
│ ⚠️ ANSTÄLLNINGSGRÄNS UPPNÅDD                                   │
├────────────────────────────────────────────────────────────────┤
│ Du har 50/50 anställda (Team-plan).                           │
│                                                                │
│ För att lägga till fler anställda:                            │
│ • Köp tillägg: +10 anställda för 100 €/månad                  │
│ • Uppgradera till Enterprise (obegränsade anställda)          │
│                                                                │
│ [Köp tillägg →] [Uppgradera till Enterprise →]                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Workspace Settings

### Settings Page Layout

**Location:** `/settings`

**Left sidebar navigation:**
```
┌─────────────────────────┐
│ INSTÄLLNINGAR           │
├─────────────────────────┤
│ Workspace               │
│ Team                    │
│ Billing                 │
│ Integrationer           │
│ Notiser                 │
│ Användarprofil          │
│ Farlig zon              │
└─────────────────────────┘
```

---

### Workspace Tab

```
┌────────────────────────────────────────────────────────────────┐
│ WORKSPACE                                                      │
├────────────────────────────────────────────────────────────────┤
│ GRUNDINFORMATION                                               │
│                                                                │
│ Workspace-namn:                                                │
│ [Bygg AB_______________________________________] [Spara]       │
│                                                                │
│ Organisationsnummer:                                           │
│ [556123-4567] (Låst - kontakta support för ändring)           │
│                                                                │
│ Bransch (SNI-kod):                                            │
│ [41.200 - Byggverksamhet ▼] [Spara]                          │
│                                                                │
│ Logotyp:                                                       │
│ ┌────────┐                                                     │
│ │  BYGG  │  [Ladda upp ny logotyp]                           │
│ │   AB   │  [Ta bort logotyp]                                │
│ └────────┘                                                     │
│ ⓘ Används i PDF-rapporter och exports                         │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│ ANVÄNDNINGSSTATISTIK                                           │
│                                                                │
│ Plan: Team (899 €/månad)                                      │
│ Status: Aktiv                                                  │
│ Nästa fakturering: 2024-02-15                                 │
│                                                                │
│ AI-frågor: 234 / 500 denna månad                              │
│ Lagring: 687 MB / 1 GB                                        │
│ Anställda: 23 / 50                                            │
│ Teammedlemmar: 3 / 5                                          │
│                                                                │
│ [Uppgradera plan →]                                            │
└────────────────────────────────────────────────────────────────┘
```

---

### Team Tab

**See "Team Management Page" section above.**

---

### Billing Tab

```
┌────────────────────────────────────────────────────────────────┐
│ BILLING                                                        │
├────────────────────────────────────────────────────────────────┤
│ NUVARANDE PLAN                                                 │
│                                                                │
│ Plan: Team                                                     │
│ Pris: 899 €/månad                                             │
│ Faktureringsperiod: Månadsvis                                  │
│ Nästa fakturering: 2024-02-15                                 │
│ Status: Aktiv                                                  │
│                                                                │
│ [Uppgradera till Enterprise] [Byt till årlig fakturering]     │
│ [Nedgradera till Solo] [Pausa prenumeration]                  │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│ BETALMETOD                                                     │
│                                                                │
│ Visa •••• 4242                                                │
│ Utgår: 12/2025                                                │
│                                                                │
│ [Uppdatera betalkort]                                          │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│ FAKTURAHISTORIK                                                │
│                                                                │
│ 2024-01-15  899 €   Betald   [Ladda ner PDF]                 │
│ 2023-12-15  899 €   Betald   [Ladda ner PDF]                 │
│ 2023-11-15  899 €   Betald   [Ladda ner PDF]                 │
│                                                                │
│ [Visa alla fakturor →]                                         │
└────────────────────────────────────────────────────────────────┘
```

---

### Notifications Tab

```
┌────────────────────────────────────────────────────────────────┐
│ NOTISER                                                        │
├────────────────────────────────────────────────────────────────┤
│ E-POSTNOTISER                                                  │
│                                                                │
│ ☑ Lagändringar (när en lag i din lista uppdateras)            │
│ ☑ Uppgiftspåminnelser (1 dag innan deadline)                   │
│ ☑ Teamaktivitet (när teammedlemmar gör ändringar)             │
│ ☑ Användningsgränser (när du når 80% av gränser)              │
│ ☑ Fakturering (fakturor, betalningar, misslyckanden)          │
│                                                                │
│ [Spara inställningar]                                          │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│ IN-APP NOTISER                                                 │
│                                                                │
│ ☑ Lagändringar                                                 │
│ ☑ Uppgiftspåminnelser                                          │
│ ☐ Teamaktivitet                                               │
│                                                                │
│ [Spara inställningar]                                          │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│ SMS-NOTISER (Enterprise only)                                  │
│                                                                │
│ ⚠️ Tillgänglig på Enterprise-plan                              │
│                                                                │
│ [Uppgradera till Enterprise →]                                 │
└────────────────────────────────────────────────────────────────┘
```

---

### Danger Zone Tab

```
┌────────────────────────────────────────────────────────────────┐
│ ⚠️ FARLIG ZON                                                  │
├────────────────────────────────────────────────────────────────┤
│ ÖVERFÖR ÄGARSKAP                                               │
│                                                                │
│ Överför kontroll över workspace till annan teammedlem.        │
│                                                                │
│ [Överför ägarskap →]                                           │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│ RADERA WORKSPACE                                               │
│                                                                │
│ ⚠️ Detta kan inte ångras! All data raderas permanent.          │
│                                                                │
│ Detta kommer att radera:                                       │
│ • 3 laglistor (156 lagar)                                     │
│ • 23 anställda                                                │
│ • 2 kollektivavtal                                            │
│ • 412 filer (687 MB)                                          │
│ • All chatthistorik och uppgifter                             │
│                                                                │
│ Teammedlemmar (3 personer) kommer förlora åtkomst omedelbart. │
│                                                                │
│ [Radera workspace →]                                           │
└────────────────────────────────────────────────────────────────┘
```

---

## Upgrade/Downgrade Flows

### Upgrade Flow (Solo → Team)

**User clicks "Uppgradera till Team" in Billing tab:**

```
┌────────────────────────────────────────────────────────────────┐
│ UPPGRADERA TILL TEAM                               [Stäng ×]  │
├────────────────────────────────────────────────────────────────┤
│ Nuvarande plan: Solo (399 €/månad)                            │
│ Ny plan: Team (899 €/månad)                                   │
│                                                                │
│ Nya fördelar:                                                  │
│ ✅ 5 användare (istället för 1)                                │
│ ✅ 50 anställda (istället för 5)                               │
│ ✅ 500 AI-frågor/månad (istället för 50)                       │
│ ✅ Fortnox-integration (Post-MVP)                              │
│                                                                │
│ Nästa fakturering: 2024-02-15                                 │
│ Pris idag: 500 € (proportionell betalning för 15 dagar)      │
│ Från 2024-02-15: 899 €/månad                                  │
│                                                                │
│ [Avbryt] [Uppgradera nu →]                                     │
└────────────────────────────────────────────────────────────────┘
```

**After clicking "Uppgradera nu":**
1. Stripe updates subscription (prorated charge for remaining days)
2. Workspace tier updated to "team"
3. Limits immediately updated (can now add 5 users, 50 employees, etc.)
4. Confirmation toast: "✅ Uppgraderad till Team-plan!"

---

### Downgrade Flow (Team → Solo)

**User clicks "Nedgradera till Solo":**

```
┌────────────────────────────────────────────────────────────────┐
│ ⚠️ NEDGRADERA TILL SOLO                            [Stäng ×]  │
├────────────────────────────────────────────────────────────────┤
│ Du är på väg att nedgradera från Team till Solo.              │
│                                                                │
│ Du kommer förlora:                                             │
│ ❌ 4 teammedlemmar (endast Owner kvar)                         │
│ ❌ 18 anställda arkiveras (Solo max 5 anställda)              │
│ ❌ AI-frågor minskar till 50/månad (du använder 234/månad)    │
│                                                                │
│ Vad händer:                                                    │
│ • Nedgraderingen träder i kraft vid slutet av faktureringsp.  │
│ • Du behåller Team-funktioner till: 2024-02-15                │
│ • Teammedlemmar kommer förlora åtkomst: 2024-02-15            │
│ • Anställda arkiveras (kan återställas om du uppgraderar)     │
│                                                                │
│ Ny fakturering från 2024-02-15: 399 €/månad                   │
│                                                                │
│ [Avbryt] [Bekräfta nedgradering →]                             │
└────────────────────────────────────────────────────────────────┘
```

**Implementation:**
- Stripe subscription updated with `cancel_at_period_end: true`
- Workspace marked for downgrade on `2024-02-15`
- Cron job on that date: Downgrade tier, remove excess users/employees

---

### Pause Subscription Flow

**User clicks "Pausa prenumeration":**

```
┌────────────────────────────────────────────────────────────────┐
│ ⚠️ PAUSA PRENUMERATION                             [Stäng ×]  │
├────────────────────────────────────────────────────────────────┤
│ Din Team-prenumeration kommer pausas omedelbart.               │
│                                                                │
│ Under pausen:                                                  │
│ • Du debiteras inte (fakturering stoppad)                     │
│ • Ditt team förlorar åtkomst till Laglig.se                   │
│ • All data bevaras (raderas inte)                             │
│ • Du kan återaktivera när som helst                           │
│                                                                │
│ När vill du fortsätta igen?                                   │
│ ( ) Tillfällig paus (återaktivera manuellt)                   │
│ ( ) Schemalagd återaktivering: [2024-03-01 ▼]                 │
│                                                                │
│ [Avbryt] [Pausa prenumeration →]                               │
└────────────────────────────────────────────────────────────────┘
```

**After pausing:**
- Stripe subscription paused
- Workspace `billingStatus = 'paused'`
- All users see banner: "Workspace pausad. [Återaktivera →]"
- Data preserved but read-only

**To unpause:**
```
┌────────────────────────────────────────────────────────────────┐
│ ⚠️ WORKSPACE PAUSAD                                            │
├────────────────────────────────────────────────────────────────┤
│ Bygg AB har pausats av Owner.                                 │
│                                                                │
│ [Återaktivera workspace →] (endast Owner)                      │
└────────────────────────────────────────────────────────────────┘
```

---

## Workspace Deletion

### Deletion Flow

**Owner clicks "Radera workspace" in Danger Zone:**

```
┌────────────────────────────────────────────────────────────────┐
│ ⚠️ RADERA WORKSPACE - DETTA KAN INTE ÅNGRAS         [Stäng ×]│
├────────────────────────────────────────────────────────────────┤
│ Du är på väg att permanent radera "Bygg AB".                  │
│                                                                │
│ Detta kommer radera:                                           │
│ • 3 laglistor (156 lagar)                                     │
│ • 23 anställda                                                │
│ • 2 kollektivavtal                                            │
│ • 412 filer (687 MB)                                          │
│ • All chatthistorik                                           │
│ • Alla uppgifter                                              │
│                                                                │
│ Teammedlemmar (3 personer) kommer förlora åtkomst omedelbart. │
│                                                                │
│ För att bekräfta, skriv workspace-namnet:                     │
│ [___________________________________________________]          │
│ (skriv "Bygg AB")                                             │
│                                                                │
│ [Avbryt] [Radera permanent →]                                  │
└────────────────────────────────────────────────────────────────┘
```

---

### After Deletion

**Implementation:**
1. **Soft delete** workspace (set `deletedAt = now()`)
2. **Cancel Stripe subscription** (if active)
3. **Send email to all team members:**

```
Subject: Workspace "Bygg AB" har raderats

Hej!

Erik Johansson har raderat workspace "Bygg AB" på Laglig.se.

Du har förlorat åtkomst till:
• 3 laglistor
• 23 anställda
• 412 filer

Data kommer finnas kvar i 30 dagar om du vill återställa.
Kontakta support@laglig.se för återställning.

Mvh,
Laglig.se
```

4. **30-day grace period:** Data kept, workspace can be restored by support
5. **After 30 days:** Hard delete (permanent removal from database)

---

## Multi-Workspace Support (Auditor Role)

### Auditor User Model

**Auditor can join multiple workspaces in read-only capacity.**

```typescript
interface User {
  // Primary workspace (if Owner/Admin/HR Manager/Member)
  workspaceId: string | null;
  role: 'owner' | 'admin' | 'hr_manager' | 'member' | null;

  // Additional workspaces (if Auditor)
  auditorWorkspaces: Array<{
    workspaceId: string;
    invitedBy: string;
    invitedAt: Date;
  }>;
}

// Example: ISO consultant
{
  id: 'user_consultant',
  email: 'consultant@isofirm.se',
  workspaceId: null,                  // No primary workspace
  role: null,
  auditorWorkspaces: [
    { workspaceId: 'ws_companyA', invitedBy: 'user_ownerA', invitedAt: '2024-01-10' },
    { workspaceId: 'ws_companyB', invitedBy: 'user_ownerB', invitedAt: '2024-01-15' },
    { workspaceId: 'ws_companyC', invitedBy: 'user_ownerC', invitedAt: '2024-01-18' },
  ]
}
```

---

### Workspace Switcher

**Top-right corner of header:**

```
┌────────────────────────────────────────┐
│ consultant@isofirm.se          [v]     │
└────────────────────────────────────────┘
       ↓ Click dropdown
┌────────────────────────────────────────┐
│ MINA WORKSPACES                        │
├────────────────────────────────────────┤
│ Bygg AB (Auditor)              ✓       │  ← Currently active
│ Restaurant Co (Auditor)                │
│ Tech Startup (Auditor)                 │
│ ──────────────────────────────────     │
│ + Skapa ny workspace                   │
└────────────────────────────────────────┘
```

**Clicking a workspace switches to that workspace context.**

---

### Auditor Invitation Flow

**Same as regular team invite, but role = "Auditor":**

```
Subject: Du har blivit inbjuden som Auditor till Bygg AB

Hej!

Erik Johansson har bjudit in dig som Auditor till "Bygg AB"
på Laglig.se.

Som Auditor har du:
✅ Läsbehörighet till alla lagar, anställda, och dokument
✅ Möjlighet att exportera compliance-rapporter
❌ Kan inte redigera data

[Acceptera inbjudan →]

Mvh,
Laglig.se
```

---

### Billing for Auditors

**Auditors don't count toward workspace user limit.**

**Example:**
- Team plan: 5 users (Owner + 4 Admins/Members)
- Auditors: Unlimited (don't count toward limit)

**Workspace with 5 users + 3 Auditors = Still within Team plan limit.**

---

## Activity Logs

### What is Logged

**Track changes for compliance and debugging:**

```typescript
interface ActivityLog {
  id: string;
  workspaceId: string;
  userId: string;                      // Who did the action
  action: string;                      // 'law_added', 'employee_created', etc.
  resource: string;                    // 'law_list', 'employee', 'task', etc.
  resourceId: string;                  // ID of affected resource
  metadata: Record<string, any>;       // Details
  timestamp: Date;
}
```

**Logged actions:**
- **Law Lists:** Created, deleted, law added, law removed
- **Employees:** Created, updated, deleted, document uploaded
- **Kollektivavtal:** Uploaded, assigned, unassigned
- **Tasks:** Created, updated, completed, deleted
- **Users:** Invited, joined, role changed, removed
- **Workspace:** Settings changed, ownership transferred
- **Billing:** Plan upgraded, downgraded, payment failed

---

### Activity Log Display

**Location:** Dashboard → Recent Activity (last 10)

```
┌────────────────────────────────────────────────────────────────┐
│ SENASTE AKTIVITET                                              │
├────────────────────────────────────────────────────────────────┤
│ 👤 Anna Svensson laddade upp "Anställningskontrakt.pdf"       │
│    2 timmar sedan                                              │
│                                                                │
│ 📋 Erik Johansson la till Arbetsmiljölagen i "Min huvudlista" │
│    5 timmar sedan                                              │
│                                                                │
│ 👥 Lisa Andersson ändrade roll för Johan Berg till Admin      │
│    Igår 14:30                                                  │
│                                                                │
│ [Visa alla →]                                                  │
└────────────────────────────────────────────────────────────────┘
```

**Full activity log:** `/settings/activity` (Enterprise only)

```
┌────────────────────────────────────────────────────────────────┐
│ AKTIVITETSLOGG                                                 │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ Filter: [Alla användare ▼] [Alla åtgärder ▼] [Sök...]    ││
│ └────────────────────────────────────────────────────────────┘│
├────────────────────────────────────────────────────────────────┤
│ 2024-01-20 14:32 - Anna Svensson (anna@example.com)           │
│ Åtgärd: Laddade upp dokument                                  │
│ Resurs: Anställningskontrakt.pdf (employee_123)               │
│                                                                │
│ 2024-01-20 10:15 - Erik Johansson (erik@example.com)          │
│ Åtgärd: Skapade laglista                                      │
│ Resurs: Bygglagstiftning (list_456)                           │
│                                                                │
│ [Exportera logg (CSV)] [1] 2 3 4 >                            │
└────────────────────────────────────────────────────────────────┘
```

---

### Retention Policy

**Solo/Team:** 30 days
**Enterprise:** Unlimited retention

---

## Security & Compliance

### GDPR Compliance

**Data Processing Agreement (DPA):**
- Required for Enterprise customers
- Signed during onboarding
- Stored in admin panel

**User Rights:**
- **Right to access:** Export workspace data (Settings → Export)
- **Right to deletion:** Delete workspace (30-day grace period)
- **Right to portability:** Export as JSON/CSV

---

### Session Management

**Session timeout:** 30 days of inactivity
**After timeout:** User must log in again

**Implementation:**
```typescript
// Middleware checks last active timestamp
async function checkSession(req: Request) {
  const session = await getSession(req);
  const lastActiveAt = session.lastActiveAt;
  const now = new Date();
  const daysSinceActive = (now - lastActiveAt) / (1000 * 60 * 60 * 24);

  if (daysSinceActive > 30) {
    // Session expired
    await destroySession(session.id);
    return redirect('/login?reason=session_expired');
  }

  // Update last active
  await updateSession(session.id, { lastActiveAt: now });
}
```

---

### Two-Factor Authentication (Post-MVP)

**Flow:**
1. User enables 2FA in Settings → Security
2. Scan QR code with Google Authenticator / Authy
3. On login: Enter password → Enter 6-digit code

---

### Audit Logs (Enterprise Only)

**Full audit trail for compliance (ISO 27001, SOC 2):**
- Who accessed what data
- When
- From which IP address
- What changes were made

**Required for public sector and highly regulated industries.**

---

## Technical Implementation

### Database Schema

```sql
-- Workspaces
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  org_number TEXT UNIQUE NOT NULL,
  sni_code TEXT,
  legal_form TEXT,
  logo_url TEXT,

  -- Subscription
  tier TEXT NOT NULL, -- 'solo' | 'team' | 'enterprise'
  billing_status TEXT NOT NULL, -- 'trial' | 'active' | 'paused' | 'canceled' | 'past_due'
  trial_ends_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  billing_email TEXT NOT NULL,

  -- Usage Stats (JSONB for flexibility)
  usage_stats JSONB DEFAULT '{"aiQueriesThisMonth": 0, "storageUsed": 0, "employeeCount": 0, "userCount": 0, "lawListCount": 0, "kollektivavtalCount": 0}',

  -- Metadata
  owner_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX workspaces_tier_idx ON workspaces(tier);
CREATE INDEX workspaces_billing_status_idx ON workspaces(billing_status);
CREATE INDEX workspaces_owner_id_idx ON workspaces(owner_id);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  email_verified BOOLEAN DEFAULT FALSE,

  -- Profile
  first_name TEXT,
  last_name TEXT,
  phone TEXT,

  -- Auth
  auth_method TEXT NOT NULL, -- 'email' | 'google' | 'microsoft'
  last_login_at TIMESTAMPTZ,

  -- Primary Workspace
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  role TEXT, -- 'owner' | 'admin' | 'hr_manager' | 'member'

  -- Auditor Workspaces (JSONB array)
  auditor_workspaces JSONB DEFAULT '[]',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX users_email_idx ON users(email);
CREATE INDEX users_workspace_id_idx ON users(workspace_id);

-- Team Invitations
CREATE TABLE team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL, -- 'admin' | 'hr_manager' | 'member' | 'auditor'
  invited_by UUID REFERENCES users(id),
  status TEXT DEFAULT 'pending', -- 'pending' | 'accepted' | 'expired'
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX team_invitations_workspace_id_idx ON team_invitations(workspace_id);
CREATE INDEX team_invitations_email_idx ON team_invitations(email);

-- Activity Logs
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX activity_logs_workspace_id_idx ON activity_logs(workspace_id);
CREATE INDEX activity_logs_timestamp_idx ON activity_logs(timestamp DESC);
```

---

### API Routes

**Authentication:**
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/verify-email` - Verify email with code
- `POST /api/auth/reset-password` - Request password reset
- `POST /api/auth/oauth/google` - Google OAuth callback
- `POST /api/auth/oauth/microsoft` - Microsoft OAuth callback

**Workspaces:**
- `POST /api/workspaces` - Create workspace
- `GET /api/workspaces/[id]` - Get workspace details
- `PATCH /api/workspaces/[id]` - Update workspace settings
- `DELETE /api/workspaces/[id]` - Delete workspace
- `POST /api/workspaces/[id]/transfer-ownership` - Transfer ownership

**Team:**
- `GET /api/workspaces/[id]/team` - List team members
- `POST /api/workspaces/[id]/team/invite` - Invite user
- `DELETE /api/workspaces/[id]/team/[userId]` - Remove user
- `PATCH /api/workspaces/[id]/team/[userId]` - Change role

**Billing:**
- `POST /api/billing/create-checkout-session` - Create Stripe Checkout
- `POST /api/billing/upgrade` - Upgrade plan
- `POST /api/billing/downgrade` - Downgrade plan
- `POST /api/billing/pause` - Pause subscription
- `POST /api/billing/unpause` - Unpause subscription
- `GET /api/billing/invoices` - Get invoice history

---

## Conclusion

User & Team Management is the **revenue engine and collaboration foundation** for Laglig.se. By implementing:

- **Workspace model** (shared resources, team collaboration)
- **Three-tier pricing** (Solo €399, Team €899, Enterprise €2,000+)
- **Trial-based onboarding** (14 days, credit card upfront)
- **Flexible add-ons** (employees, storage, AI queries)
- **Auditor role** (multi-workspace access for consultants)
- **Stripe integration** (automated billing, webhooks)
- **Usage tracking** (enforce limits, prompt upgrades)

...we create a scalable SaaS business that can grow from individual users to enterprise customers.

**Next steps:**
1. Implement Supabase Auth (email/OAuth)
2. Build workspace creation flow with Bolagsverket integration
3. Integrate Stripe subscriptions and webhooks
4. Deploy team invite system
5. Build usage tracking and limit enforcement
6. Launch billing management UI

---

**Document End**
