# Feature Specification: Change Monitoring System

**Document Version:** 1.0
**Last Updated:** 2025-01-01
**Status:** Draft
**Owner:** Product Team

---

## Executive Summary

The Change Monitoring System is Laglig.se's competitive moat for retention and engagement - an automated law change detection and notification system that keeps users informed about updates to Swedish laws they're tracking. By integrating with Riksdagen's API and leveraging AI-powered change analysis, the system ensures users never miss critical compliance updates.

**Key Differentiators:**
- **Complete Change History** - Full amendment timeline for all 10,000+ Swedish laws
- **AI-Powered Summaries** - Plain-language explanations of what changed and why it matters
- **GitHub-Style Diff View** - See exactly what text was added, modified, or deleted
- **Industry-Aware Monitoring** - Weekly emails with changes relevant to user's SNI code
- **Zero Configuration Required** - Auto-monitoring when laws added to user's list
- **Unlimited Change Analysis** - AI summaries don't count toward monthly query limits

**Strategic Value:**
- **Retention Driver** - Users must stay subscribed to receive critical compliance updates
- **Engagement Mechanism** - Weekly industry emails bring users back to the platform
- **Trust Builder** - Proactive notifications position Laglig.se as a reliable compliance partner
- **Upsell Opportunity** - Advanced features (AI impact assessment, custom alerts) for higher tiers

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [System Architecture Overview](#system-architecture-overview)
3. [Change Detection Engine](#change-detection-engine)
4. [Notification System](#notification-system)
5. [User Interface Components](#user-interface-components)
6. [Change Review Workflow](#change-review-workflow)
7. [AI Change Analysis](#ai-change-analysis)
8. [Industry Monitoring (SNI-Based)](#industry-monitoring-sni-based)
9. [Integration with Law Lists](#integration-with-law-lists)
10. [Timeline Visualization](#timeline-visualization)
11. [Database Schema](#database-schema)
12. [Technical Implementation](#technical-implementation)
13. [Riksdagen API Integration](#riksdagen-api-integration)
14. [Post-MVP Features](#post-mvp-features)

---

## Core Principles

### 1. Proactive, Not Reactive
**Users shouldn't have to check for updates - the system notifies them automatically.**

**Problem:** Small business owners don't have time to monitor Riksdagen for law changes.

**Solution:**
- Daily automated checks for all laws in the database
- Immediate notifications when tracked laws change
- Weekly industry summaries for broader awareness

### 2. Context-Aware Notifications
**Only notify about laws the user cares about.**

**Implementation:**
- Track only laws explicitly added to user's law list
- No spam notifications for irrelevant laws
- Industry emails curated based on SNI code

### 3. Change Transparency
**Users must understand exactly what changed and when it takes effect.**

**Features:**
- GitHub-style diff view (old vs. new text side-by-side)
- AI-generated plain-language summary
- Effective date clearly displayed
- Source document link to Riksdagen proposition

### 4. Frictionless Acknowledgment
**Users should be able to review and acknowledge changes quickly.**

**Workflow:**
- One-click "Mark as reviewed" button
- Bulk acknowledgment for multiple changes
- Persistent reminders for unacknowledged critical changes
- Visual badges showing unreviewed count

### 5. Complete Historical Record
**Every change to every law is stored permanently.**

**Value:**
- Users can see full amendment history when they join the platform
- SEO-rich content for law pages (Google loves comprehensive timelines)
- Audit trail for compliance documentation
- Future analytics (e.g., "This law changes 3x per year on average")

---

## System Architecture Overview

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    CHANGE DETECTION LAYER                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Daily Cron Job (00:00 UTC)                                  │
│  ├─> Fetch all laws from Riksdagen API                       │
│  ├─> Compare with local database                             │
│  ├─> Detect changes (new sections, amendments, deletions)    │
│  ├─> Store changes in law_changes table                      │
│  └─> Trigger notification pipeline                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    AI PROCESSING LAYER                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  For each detected change:                                   │
│  ├─> Generate plain-language summary (GPT-4)                 │
│  ├─> Extract affected sections (§X, §Y)                      │
│  ├─> Parse effective date from source document               │
│  ├─> Store AI summary in database                            │
│  └─> Update RAG database with new law text                   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   NOTIFICATION LAYER                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Find affected users:                                        │
│  ├─> Query law_lists for users tracking this law             │
│  ├─> Create notification records (in-app + email queue)      │
│  ├─> Send immediate email (daily digest)                     │
│  └─> Update notification bell badge count                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERFACE LAYER                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  User receives notification:                                 │
│  ├─> Email: "3 laws in your list have changed"               │
│  ├─> In-app bell: Red badge shows "3"                        │
│  ├─> Clicks → Opens dropdown or navigates to Changes tab     │
│  ├─> Reviews diff view + AI summary                          │
│  └─> Marks as reviewed → Badge count decrements              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Change Detection Engine

### Daily Cron Job

**Schedule:** Every day at 00:00 UTC (01:00 CET, 02:00 CEST)

**Why daily?**
- Riksdagen API is free (no cost concerns)
- Laws can change at any time (government updates published daily)
- Users expect timely notifications (within 24 hours)

**Job Steps:**

1. **Fetch All Laws from Riksdagen API**
   ```typescript
   async function fetchAllLawsFromRiksdagen() {
     const response = await fetch(
       'https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json'
     );
     const data = await response.json();
     return data.dokumentlista.dokument; // Array of ~10,000 laws
   }
   ```

2. **Compare with Local Database**
   ```typescript
   for (const riksdagenLaw of riksdagenLaws) {
     const localLaw = await db.laws.findUnique({
       where: { sfsNumber: riksdagenLaw.beteckning }
     });

     if (!localLaw) {
       // New law published - create record
       await createNewLaw(riksdagenLaw);
     } else {
       // Check if content has changed
       const hasChanged = await detectChanges(localLaw, riksdagenLaw);
       if (hasChanged) {
         await recordChange(localLaw, riksdagenLaw);
       }
     }
   }
   ```

3. **Detect Changes**
   ```typescript
   async function detectChanges(localLaw, riksdagenLaw) {
     const changes = [];

     // Compare full text
     if (localLaw.fullText !== riksdagenLaw.text) {
       changes.push({
         type: 'text_amendment',
         oldText: localLaw.fullText,
         newText: riksdagenLaw.text,
       });
     }

     // Compare metadata
     if (localLaw.title !== riksdagenLaw.titel) {
       changes.push({ type: 'metadata', field: 'title' });
     }

     if (localLaw.status !== riksdagenLaw.status) {
       changes.push({ type: 'status_change', newStatus: riksdagenLaw.status });
     }

     return changes.length > 0 ? changes : null;
   }
   ```

4. **Record Change in Database**
   ```typescript
   async function recordChange(localLaw, riksdagenLaw) {
     const change = await db.lawChanges.create({
       data: {
         lawId: localLaw.id,
         changeDate: new Date(riksdagenLaw.systemdatum),
         detectedAt: new Date(),
         changeType: 'amendment', // or 'new_section', 'repeal', etc.
         oldText: localLaw.fullText,
         newText: riksdagenLaw.text,
         sourceDocumentUrl: riksdagenLaw.dokument_url_html,
       },
     });

     // Trigger AI processing
     await generateAISummary(change.id);

     // Update local law record
     await db.laws.update({
       where: { id: localLaw.id },
       data: {
         fullText: riksdagenLaw.text,
         lastAmendedAt: new Date(riksdagenLaw.systemdatum),
       },
     });

     // Trigger notifications
     await notifyAffectedUsers(localLaw.id, change.id);
   }
   ```

### Change Types

The system detects the following types of changes:

| Change Type | Description | Example |
|-------------|-------------|---------|
| `amendment` | Existing text modified | §3:2 text changed to clarify employer obligations |
| `new_section` | New section/paragraph added | New §3:2a inserted requiring digital assessments |
| `repeal` | Section deleted/repealed | §5:4 removed from law |
| `metadata` | Title, department, or classification changed | Law renamed from "Arbetsmiljölag" to "Arbetsmiljölagen" |
| `status_change` | Law becomes active, inactive, or repealed | Law status changed from "proposed" to "active" |
| `associated_document` | New preparatory work or government bill added | Proposition 2024/25:42 linked to law |

**For MVP:** All change types are treated equally (no severity classification).

**Post-MVP:** AI-powered severity assessment (Minor / Moderate / Critical).

---

## Notification System

### Notification Triggers

**When does the system send notifications?**

1. **Immediate (Same Day):** When a law in the user's law list changes
2. **Weekly Digest:** Sunday 18:00 CET - Industry-specific changes (SNI-based)
3. **Reminder:** 3 days and 7 days after initial notification if change not acknowledged

**Who receives notifications?**

- All users in a workspace who have the changed law in their law list
- Notifications sent per workspace (not per individual user)
- Owner, Admin, and Members all receive notifications
- Auditor role: Read-only access, no notifications

### Notification Channels

#### 1. Email Notifications

**Daily Digest Email**

- **Sent:** Once per day at 18:00 CET if changes detected
- **Recipients:** All users in workspaces tracking changed laws
- **Subject Line:** `[Laglig.se] X lagar i din lista har ändrats` (X laws in your list have changed)

**Email Template (Simple List - MVP):**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Law Changes Detected</title>
</head>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">

  <div style="background: #1e40af; color: white; padding: 20px;">
    <h1 style="margin: 0;">Laglig.se</h1>
    <p style="margin: 5px 0 0 0; opacity: 0.9;">Lagändringar upptäckta</p>
  </div>

  <div style="padding: 30px 20px;">
    <p style="font-size: 16px; color: #333;">
      Hej {{firstName}},
    </p>

    <p style="font-size: 16px; color: #333;">
      <strong>{{changeCount}} lagar</strong> i din lista har ändrats:
    </p>

    <ul style="list-style: none; padding: 0;">
      {{#each changes}}
      <li style="padding: 15px; background: #f3f4f6; margin-bottom: 10px; border-radius: 8px;">
        <strong style="color: #1e40af;">{{lawName}}</strong><br>
        <span style="color: #6b7280; font-size: 14px;">Ändrad: {{changeDate}}</span>
      </li>
      {{/each}}
    </ul>

    <a href="{{reviewChangesUrl}}"
       style="display: inline-block; background: #1e40af; color: white;
              padding: 12px 24px; text-decoration: none; border-radius: 6px;
              font-weight: 600; margin-top: 20px;">
      Granska ändringar →
    </a>
  </div>

  <div style="padding: 20px; background: #f9fafb; border-top: 1px solid #e5e7eb;
              text-align: center; color: #6b7280; font-size: 14px;">
    <p>
      Du får detta mejl eftersom du prenumererar på ändringar för lagar i din lista.
    </p>
    <p>
      <a href="{{unsubscribeUrl}}" style="color: #1e40af;">Avsluta prenumeration</a>
    </p>
  </div>

</body>
</html>
```

**Post-MVP:** Include AI summaries directly in email (Option B from clarifications).

---

**Weekly Industry Digest Email**

- **Sent:** Every Sunday at 18:00 CET
- **Recipients:** All users (regardless of law list)
- **Content:** Changes to laws in a curated "industry starter pack" based on SNI code

**Email Template:**

```html
<div style="padding: 30px 20px;">
  <h2 style="color: #1e40af;">Veckans branschändringar</h2>

  <p style="font-size: 16px; color: #333;">
    Här är lagändringar som kan påverka din bransch
    <strong>({{industryName}} - SNI {{sniCode}})</strong>:
  </p>

  <ul style="list-style: none; padding: 0;">
    {{#each industryChanges}}
    <li style="padding: 15px; background: #fef3c7; margin-bottom: 10px;
               border-left: 4px solid #f59e0b; border-radius: 4px;">
      <strong style="color: #92400e;">{{lawName}}</strong><br>
      <span style="color: #78350f; font-size: 14px;">
        {{aiSummary}}
      </span>
    </li>
    {{/each}}
  </ul>

  <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
    💡 <em>Tips: Lägg till dessa lagar i din lista för att få detaljerade ändringsnotiser.</em>
  </p>
</div>
```

**Note:** Weekly industry email does NOT include CTA to add laws for MVP. Post-MVP: Add "Lägg till i min lista" button.

---

**Reminder Emails**

If user has unacknowledged changes:

- **First reminder:** 3 days after initial notification
- **Second reminder:** 7 days after initial notification
- **Then stop:** No further email reminders (but in-app badge persists)

**Reminder Template:**

```
Subject: [Påminnelse] Du har {{unacknowledgedCount}} ogransk­ade lagändringar

Body:
Hej {{firstName}},

Du har {{unacknowledgedCount}} lagändringar som väntar på granskning:

- Arbetsmiljölagen (ändrad 2024-03-15)
- LAS (ändrad 2024-03-15)
- Alkohollagen (ändrad 2024-03-14)

[Granska nu →]

/Laglig.se
```

---

#### 2. In-App Notification Bell

**Location:** Top navigation bar, right side (next to user avatar)

**Visual Design:**

```
┌────────────────────────────────────────────┐
│  Laglig.se    [Hem] [Lagar] [HR] [Chat]   │
│                                    🔔³  👤 │ ← Bell with badge count
└────────────────────────────────────────────┘
```

**Badge Behavior:**
- Red circular badge shows count of unacknowledged changes
- Badge disappears when all changes acknowledged
- Max display: "9+" (if more than 9 unacknowledged)

**Click Interaction:**

Clicking the bell opens a dropdown panel:

```
┌──────────────────────────────────────────┐
│  Notifikationer                      [×] │
├──────────────────────────────────────────┤
│                                          │
│  📋 Arbetsmiljölagen                     │
│  Ändrad 2024-03-15                       │
│  [Granska] [Markera som granskad]       │
│                                          │
├──────────────────────────────────────────┤
│                                          │
│  📋 LAS (Anställningsskyddslagen)        │
│  Ändrad 2024-03-15                       │
│  [Granska] [Markera som granskad]       │
│                                          │
├──────────────────────────────────────────┤
│                                          │
│  📋 Alkohollagen                         │
│  Ändrad 2024-03-14                       │
│  [Granska] [Markera som granskad]       │
│                                          │
├──────────────────────────────────────────┤
│  Visa alla ändringar →                   │
└──────────────────────────────────────────┘
```

**Dropdown Actions:**
- **Granska:** Navigate to law page with diff view open
- **Markera som granskad:** Acknowledge change without viewing (decrements badge)
- **Visa alla ändringar:** Navigate to Law List → Changes tab

**Technical Implementation:**

```typescript
// Notification bell component
export function NotificationBell() {
  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications/unacknowledged');
      return res.json();
    },
    refetchInterval: 60000, // Poll every minute
  });

  const unacknowledgedCount = notifications?.length ?? 0;

  return (
    <Popover>
      <PopoverTrigger>
        <button className="relative">
          <Bell className="w-6 h-6" />
          {unacknowledgedCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white
                           text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unacknowledgedCount > 9 ? '9+' : unacknowledgedCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-80">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Notifikationer</h3>
          <button onClick={closeDropdown}>×</button>
        </div>

        {notifications?.slice(0, 5).map((notification) => (
          <NotificationItem key={notification.id} notification={notification} />
        ))}

        <Link href="/mina-lagar?tab=changes" className="text-blue-600 text-sm">
          Visa alla ändringar →
        </Link>
      </PopoverContent>
    </Popover>
  );
}
```

---

#### 3. SMS & Push Notifications (Post-MVP)

**Not included in MVP.**

Post-MVP features:
- SMS notifications for Enterprise tier (critical changes only)
- Mobile app push notifications
- Slack/Teams integration

---

### Notification Preferences

**MVP:** No user configuration. All users receive:
- Daily email digest (if changes detected)
- Weekly industry email
- In-app notifications

**Post-MVP:** Granular settings in Workspace Settings → Notifications:
- Frequency: Immediate / Daily / Weekly / Never
- Channels: Email / In-app / SMS
- Severity filter: Only critical / All changes
- Per-law overrides: "Notify immediately for LAS, weekly for others"

---

## User Interface Components

### 1. Law List Page → Changes Tab

**Location:** `/mina-lagar?tab=changes`

**Navigation:**

```
┌────────────────────────────────────────────────────────────┐
│  Mina Lagar                                                 │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  [Alla lagar] [Ändringar (3)] [Arkiverade]                 │ ← Badge shows unacknowledged count
│                    ↑                                        │
│                  Active tab                                 │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

**Changes Tab Content:**

```
┌────────────────────────────────────────────────────────────┐
│  Ändringar i dina lagar                                     │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  [Markera alla som granskade]           [Filtrera ▾]       │
│                                                             │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  📋 Arbetsmiljölagen (1977:1160)            🔴 Ny    │ │
│  │  Ändrad: 2024-03-15  |  Träder i kraft: 2024-04-01  │ │
│  │                                                      │ │
│  │  Ny sektion 3:2a kräver digitala arbetsmiljö-       │ │
│  │  bedömningar för distansarbete.                      │ │
│  │                                                      │ │
│  │  [Visa ändringar] [Markera som granskad]            │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  📋 LAS (1982:80)                           🔴 Ny    │ │
│  │  Ändrad: 2024-03-15  |  Träder i kraft: 2024-05-01  │ │
│  │                                                      │ │
│  │  § 7 ändrad för att förtydliga turordningsregler    │ │
│  │  vid uppsägningar på grund av arbetsbrist.          │ │
│  │                                                      │ │
│  │  [Visa ändringar] [Markera som granskad]            │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  📋 Alkohollagen (2010:1622)                ✓        │ │
│  │  Ändrad: 2024-03-14  |  Granskad av: Anna S.        │ │
│  │                                                      │ │
│  │  Metadata uppdaterad (departement ändrat).          │ │
│  │                                                      │ │
│  │  [Visa ändringar]                                    │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

**Visual States:**
- **🔴 Ny** - Unacknowledged change (red badge)
- **✓ Granskad** - Acknowledged (checkmark, grayed out)

**Sorting:** Most recent first (by `changeDate`)

**Actions:**
- **Visa ändringar:** Navigate to law page with diff view open
- **Markera som granskad:** Acknowledge change inline
- **Markera alla som granskade:** Bulk acknowledge all unacknowledged changes

**Empty State:**

If no changes:
```
┌────────────────────────────────────────────┐
│                                            │
│         🎉                                 │
│                                            │
│     Inga nya ändringar                     │
│                                            │
│  Alla dina lagar är uppdaterade!           │
│                                            │
└────────────────────────────────────────────┘
```

---

### 2. Individual Law Page → Diff View

**Location:** `/alla-lagar/arbetsmiljolagen?change=abc123`

**Layout:**

```
┌────────────────────────────────────────────────────────────┐
│  Arbetsmiljölagen (1977:1160)                               │
│  📝 Uppdaterad 2024-03-15                                   │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  [Översikt] [Innehåll] [Ändringshistorik] [Anteckningar]   │
│                           ↑                                 │
│                    Auto-selected when ?change= param        │
│                                                             │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  Ändringshistorik                                           │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Senaste ändring: 2024-03-15                                │
│  Träder i kraft: 2024-04-01                                 │
│  Källa: [Proposition 2024/25:42 →]                          │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  🤖 AI-sammanfattning                                │ │
│  │                                                      │ │
│  │  Ny sektion 3:2a kräver digitala arbetsmiljö-       │ │
│  │  bedömningar för distansarbete. Arbetsgivare måste  │ │
│  │  dokumentera hur de säkerställer god arbetsmiljö    │ │
│  │  även när anställda arbetar hemifrån eller på andra │ │
│  │  platser utanför arbetsplatsen.                      │ │
│  │                                                      │ │
│  │  Påverkade paragrafer: Ny § 3:2a                     │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Diff-vy (GitHub-stil)                               │ │
│  ├──────────────────────────────────────────────────────┤ │
│  │                                                      │ │
│  │  3 kap. Arbetsgivarens skyldigheter                  │ │
│  │                                                      │ │
│  │  § 3:2                                               │ │
│  │  Arbetsgivaren skall systematiskt planera, leda...  │ │
│  │  (oförändrat)                                        │ │
│  │                                                      │ │
│  │  + § 3:2a (NY SEKTION)                               │ │  ← Green highlight
│  │  + För arbete som utförs på distans eller på andra  │ │
│  │  + platser än arbetsgivarens fasta arbetsplats      │ │
│  │  + skall arbetsgivaren säkerställa att reglerna i   │ │
│  │  + denna lag följs. Arbetsgivaren skall dokumentera │ │
│  │  + de åtgärder som vidtas för att uppfylla denna    │ │
│  │  + skyldighet.                                       │ │
│  │                                                      │ │
│  │  § 3:3                                               │ │
│  │  Arbetsgivaren skall ge arbetstagaren de            │ │
│  │  förutsättningar som behövs...                       │ │
│  │  (oförändrat)                                        │ │
│  │                                                      │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  [Markera som granskad] [Dela ändring]                     │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

**Diff View Color Coding:**
- **Green background** - New text added
- **Red background** - Text deleted
- **Yellow background** - Text modified
- **White background** - Unchanged text (context)

**Technical Implementation:**

```typescript
import { diffLines } from 'diff'; // npm package

function renderDiffView(oldText: string, newText: string) {
  const diff = diffLines(oldText, newText);

  return diff.map((part, index) => {
    const bgColor = part.added
      ? 'bg-green-100'
      : part.removed
      ? 'bg-red-100'
      : 'bg-white';

    const prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';

    return (
      <div key={index} className={`${bgColor} px-4 py-1 font-mono text-sm`}>
        {part.value.split('\n').map((line, i) => (
          <div key={i}>
            {prefix}{line}
          </div>
        ))}
      </div>
    );
  });
}
```

---

## Change Review Workflow

### User Journey: From Notification to Acknowledgment

**Step 1: User receives email**
```
Subject: [Laglig.se] 3 lagar i din lista har ändrats

Body:
- Arbetsmiljölagen (ändrad 2024-03-15)
- LAS (ändrad 2024-03-15)
- Alkohollagen (ändrad 2024-03-14)

[Granska ändringar →]
```

**Step 2: User clicks email link → Lands on Law List → Changes tab**

URL: `https://laglig.se/mina-lagar?tab=changes`

User sees list of 3 unacknowledged changes with AI summaries.

**Step 3: User clicks "Visa ändringar" on Arbetsmiljölagen**

→ Navigates to `/alla-lagar/arbetsmiljolagen?change=abc123`

→ Law page opens with "Ändringshistorik" tab auto-selected

→ User sees:
- AI summary of what changed
- GitHub-style diff view
- Effective date
- Source document link

**Step 4: User reviews the change**

User reads the AI summary and diff view to understand impact.

**Step 5: User clicks "Markera som granskad"**

```typescript
async function acknowledgeChange(changeId: string, userId: string) {
  await db.lawChanges.update({
    where: { id: changeId },
    data: {
      acknowledgedBy: {
        push: {
          userId,
          acknowledgedAt: new Date(),
        },
      },
    },
  });

  // Decrement notification badge count
  await decrementNotificationBadge(userId);

  // Show success toast
  toast.success('Ändring markerad som granskad');

  // Redirect back to Changes tab
  router.push('/mina-lagar?tab=changes');
}
```

**Step 6: User returns to Changes tab**

- Arbetsmiljölagen now shows ✓ checkmark instead of 🔴 badge
- Notification bell badge decrements from "3" to "2"
- Change card grayed out but still visible (not hidden)

**Step 7: User acknowledges remaining changes**

Option A: Click "Visa ändringar" and review each individually
Option B: Click "Markera som granskad" directly from list
Option C: Click "Markera alla som granskade" to bulk acknowledge

**Step 8: All changes acknowledged**

- Notification bell badge disappears (count = 0)
- Changes tab shows "Inga nya ändringar" empty state
- User receives no further reminder emails

---

### Reminder Logic

If user does NOT acknowledge a change:

**Day 0:** Initial notification email sent
**Day 3:** First reminder email sent
**Day 7:** Second reminder email sent
**Day 8+:** No further emails, but in-app badge persists

**Weekly digest also includes reminder:**
```
Du har 3 ogranskade lagändringar från tidigare veckor:
- Arbetsmiljölagen (ändrad 2024-03-15)
- LAS (ändrad 2024-03-15)
- Alkohollagen (ändrad 2024-03-14)

[Granska nu →]
```

**Persistent in-app badge:**
- Notification bell continues showing count until acknowledged
- Law List → Changes tab shows badge "(3)" indefinitely

---

## AI Change Analysis

### AI-Powered Summaries

**Goal:** Generate plain-language explanations of law changes so non-lawyers can understand impact.

**Process:**

1. **Extract Diff**
   ```typescript
   const diff = diffLines(oldText, newText);
   const addedText = diff.filter(part => part.added).map(p => p.value).join('\n');
   const removedText = diff.filter(part => part.removed).map(p => p.value).join('\n');
   ```

2. **Generate Summary with GPT-4**
   ```typescript
   async function generateAISummary(changeId: string) {
     const change = await db.lawChanges.findUnique({ where: { id: changeId } });

     const prompt = `
       You are a legal analyst explaining Swedish law changes to business owners.

       Law: ${change.law.name}

       Old text:
       ${change.oldText}

       New text:
       ${change.newText}

       Generate a 2-3 sentence plain-language summary in Swedish explaining:
       1. What changed (new section added, text modified, section deleted)
       2. Why it matters (what employers/businesses must do differently)
       3. Which sections are affected (§X, §Y)

       Keep it concise and actionable. Avoid legal jargon.
     `;

     const completion = await openai.chat.completions.create({
       model: 'gpt-4',
       messages: [
         { role: 'system', content: 'You are a legal compliance expert.' },
         { role: 'user', content: prompt },
       ],
       temperature: 0.3, // Low temperature for factual accuracy
     });

     const aiSummary = completion.choices[0].message.content;

     // Store summary in database
     await db.lawChanges.update({
       where: { id: changeId },
       data: { aiSummary },
     });

     return aiSummary;
   }
   ```

3. **Store in Database**
   ```typescript
   interface LawChange {
     id: string;
     lawId: string;
     changeDate: Date;
     oldText: string;
     newText: string;
     aiSummary: string; // ← Generated summary stored here
   }
   ```

**Example AI Summary:**

```
Ny sektion 3:2a kräver digitala arbetsmiljöbedömningar för distansarbete.
Arbetsgivare måste dokumentera hur de säkerställer god arbetsmiljö även när
anställda arbetar hemifrån eller på andra platser utanför arbetsplatsen.
Påverkade paragrafer: Ny § 3:2a.
```

---

### AI Query Quota

**MVP Decision:** AI change summaries do NOT count toward monthly query limits.

**Rationale:**
- Change summaries are system-generated (not user-initiated)
- Critical for user experience (users expect summaries)
- Predictable cost (max ~100 changes/month across all laws)

**Post-MVP:** Deep impact assessments (comparing against user's employees, documents, kollektivavtal) count toward quota.

**Example Deep Impact Assessment (Post-MVP):**

```typescript
async function generateImpactAssessment(changeId: string, workspaceId: string) {
  const change = await db.lawChanges.findUnique({ where: { id: changeId } });
  const workspace = await db.workspaces.findUnique({ where: { id: workspaceId } });

  // Fetch user's context
  const employees = await db.employees.findMany({ where: { workspaceId } });
  const kollektivavtal = await db.kollektivavtal.findMany({ where: { workspaceId } });

  const prompt = `
    Law change: ${change.aiSummary}

    User context:
    - ${employees.length} employees (${employees.filter(e => e.employmentForm === 'distans').length} remote workers)
    - Kollektivavtal: ${kollektivavtal.map(k => k.name).join(', ')}

    Does this change affect the user's organization? If yes, what action should they take?
  `;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are a compliance advisor.' },
      { role: 'user', content: prompt },
    ],
  });

  return completion.choices[0].message.content;

  // ↑ This counts toward monthly AI query limit
}
```

---

## Industry Monitoring (SNI-Based)

### Weekly Industry Digest Email

**Goal:** Keep users engaged by showing law changes relevant to their industry, even if not in their law list.

**Sent:** Every Sunday at 18:00 CET

**Recipients:** All users with a workspace SNI code

**Content:** Changes to laws in a **curated "industry starter pack"** (not all laws tagged with SNI code).

---

### Industry Starter Packs

**What is an industry starter pack?**

A manually curated list of 15-25 most important laws for each major industry.

**Example: Restaurant Industry (SNI 56.101)**

```typescript
const restaurantStarterPack = [
  'Livsmedelslagen',
  'Alkohollagen',
  'Tobakslagen',
  'Arbetsmiljölagen',
  'LAS (Anställningsskyddslagen)',
  'Arbetstidslagen',
  'Semesterlagen',
  'Diskrimineringslagen',
  'GDPR',
  'Kassaregisterlagen',
  'Skatteförfarandelagen',
  'Mervärdesskattelagen',
  'Miljöbalken',
  'Plan- och bygglagen (serveringstillstånd)',
  'Konsumentköplagen',
];
```

**Why curated packs instead of all SNI-tagged laws?**
- Quality over quantity (15-25 laws vs. 100+)
- Human expertise ensures relevance
- Easier to maintain and update
- Better user experience (focused email)

---

### Email Template

```html
<div style="padding: 30px 20px; background: #fffbeb;">

  <h2 style="color: #92400e; margin-bottom: 10px;">
    🍽️ Veckans branschändringar
  </h2>

  <p style="font-size: 14px; color: #78350f;">
    Restauranger & Catering (SNI 56.101)
  </p>

  <div style="margin-top: 20px;">

    <div style="background: white; padding: 15px; margin-bottom: 10px;
                border-left: 4px solid #f59e0b; border-radius: 4px;">
      <strong style="color: #1e40af;">Alkohollagen (2010:1622)</strong><br>
      <span style="color: #6b7280; font-size: 13px;">Ändrad 2024-03-18</span>
      <p style="margin: 10px 0 0 0; color: #374151; font-size: 14px;">
        Nya regler för uteserveringar kräver skriftligt medgivande från fastighetsägare.
        Gäller från 1 maj 2024.
      </p>
    </div>

    <div style="background: white; padding: 15px; margin-bottom: 10px;
                border-left: 4px solid #f59e0b; border-radius: 4px;">
      <strong style="color: #1e40af;">Livsmedelslagen (2006:804)</strong><br>
      <span style="color: #6b7280; font-size: 13px;">Ändrad 2024-03-16</span>
      <p style="margin: 10px 0 0 0; color: #374151; font-size: 14px;">
        Uppdaterade märkningskrav för allergener. Menyer måste tydligt visa
        alla 14 huvudallergener från 1 juni 2024.
      </p>
    </div>

  </div>

  <p style="color: #78350f; font-size: 13px; margin-top: 20px;
            background: #fef3c7; padding: 10px; border-radius: 4px;">
    💡 <strong>Tips:</strong> Dessa lagar påverkar din bransch men är inte i din laglista.
    Du kan lägga till dem för mer detaljerade ändringsnotiser.
  </p>

  <p style="text-align: center; margin-top: 30px;">
    <a href="https://laglig.se/alla-lagar?sni=56.101"
       style="display: inline-block; background: #1e40af; color: white;
              padding: 12px 24px; text-decoration: none; border-radius: 6px;">
      Utforska alla lagar för din bransch →
    </a>
  </p>

</div>
```

**Note:** No CTA to "Add to list" for MVP. Link goes to Alla Lagar page filtered by SNI code.

**Post-MVP:** Add "Lägg till i min lista" button next to each law.

---

### Industry Pack Curation Process

**Initial Setup (Pre-Launch):**

1. Identify top 10-15 industries by SME count in Sweden:
   - Restaurants (SNI 56.x)
   - Construction (SNI 41.x, 43.x)
   - Retail (SNI 47.x)
   - Professional services (SNI 69.x, 70.x)
   - Manufacturing (SNI 10.x-33.x)
   - Healthcare (SNI 86.x)
   - IT/Software (SNI 62.x)
   - Transport/Logistics (SNI 49.x)
   - Real estate (SNI 68.x)
   - Education (SNI 85.x)

2. For each industry, manually curate 15-25 laws by consulting:
   - Industry associations (e.g., Visita for restaurants)
   - Legal compliance guides
   - AI Chat Interface queries (ask GPT-4: "What are the most important laws for restaurants in Sweden?")

3. Store in database:
   ```typescript
   interface IndustryStarterPack {
     id: string;
     sniCode: string;              // '56.101'
     industryName: string;          // 'Restauranger & Catering'
     laws: string[];                // Array of law IDs
     createdAt: Date;
     updatedAt: Date;
   }
   ```

**Ongoing Maintenance:**

- Quarterly review: Add new important laws, remove irrelevant ones
- User feedback: "Was this relevant?" button in weekly email
- Analytics: Track which laws users add to their lists from industry emails

---

## Integration with Law Lists

### Auto-Monitoring on Add

**User Action:** User adds law to their law list

**System Response:** Automatically start monitoring for changes (no configuration needed)

**Implementation:**

```typescript
async function addLawToList(lawId: string, workspaceId: string) {
  // Add law to user's list
  await db.lawLists.create({
    data: {
      lawId,
      workspaceId,
      addedAt: new Date(),
    },
  });

  // ✅ No separate "monitoring" record needed
  // The system automatically checks all laws in law_lists table for changes

  // Show confirmation
  toast.success('Lag tillagd i din lista. Du får nu automatiska ändringsnotiser.');
}
```

**Why no separate "monitoring" concept?**
- Simpler UX (less cognitive load)
- Clearer value proposition ("Add to list = get updates")
- Easier to implement (one source of truth)

---

### Stop Monitoring on Remove

**User Action:** User removes law from their law list

**System Response:** Stop sending notifications for changes to this law

**Implementation:**

```typescript
async function removeLawFromList(lawListId: string) {
  await db.lawLists.delete({
    where: { id: lawListId },
  });

  // ✅ Monitoring automatically stops (law no longer in user's list)

  // Optionally: Mark any unacknowledged changes as "archived"
  await db.lawChanges.updateMany({
    where: {
      lawId: deletedLaw.lawId,
      acknowledgedBy: { none: { userId: currentUser.id } },
    },
    data: {
      archivedForUsers: { push: currentUser.id },
    },
  });

  toast.success('Lag borttagen. Du får inte längre ändringsnotiser för denna lag.');
}
```

**Question:** Should unacknowledged changes remain in the Changes tab after removing the law?

**Answer (MVP):** No. When law is removed, hide its unacknowledged changes from Changes tab.

**Rationale:** User explicitly removed the law → They no longer care about it.

**Post-MVP:** Add "Archive" option (soft delete) so changes remain visible for 30 days.

---

### Law List Tier Limits

**Solo Tier:** 50 laws in list
**Team Tier:** Unlimited
**Enterprise Tier:** Unlimited

**Question:** Can user "monitor" laws without adding to list?

**Answer:** No. Monitoring is tied to law list membership.

**Rationale:**
- Simpler mental model
- Encourages users to curate their law list (quality over quantity)
- Prevents workaround to tier limits ("I'll just monitor 1000 laws without adding them")

---

## Timeline Visualization

### Law Page Amendment History

**Location:** Individual law page → "Ändringshistorik" tab

**Visual Design:**

```
┌────────────────────────────────────────────────────────────┐
│  Arbetsmiljölagen (1977:1160)                               │
├────────────────────────────────────────────────────────────┤
│  [Översikt] [Innehåll] [Ändringshistorik] [Anteckningar]   │
│                           ↑                                 │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  Ändringshistorik                                           │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Denna lag har ändrats 47 gånger sedan 1977.               │
│                                                             │
│  ───────────────────────────────────────────────────────   │
│                                                             │
│  2024-03-15  ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│              │                                              │
│              └─> Ny sektion 3:2a tillagd                    │
│                  Kräver digitala arbetsmiljöbedömningar     │
│                  [Visa ändringar →]                         │
│                                                             │
│  2024-01-20  ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│              │                                              │
│              └─> § 5:4 ändrad                               │
│                  Förtydligande av arbetsgivarens ansvar     │
│                  [Visa ändringar →]                         │
│                                                             │
│  2023-11-10  ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│              │                                              │
│              └─> Metadata uppdaterad                        │
│                  Departement ändrat                         │
│                  [Visa ändringar →]                         │
│                                                             │
│  2023-08-05  ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│              │                                              │
│              └─> § 2:1 upphävd                              │
│                  Sektion borttagen (ersatt av § 2:1a)       │
│                  [Visa ändringar →]                         │
│                                                             │
│  ...                                                        │
│                                                             │
│  [Visa äldre ändringar] (läs in fler)                       │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

**Timeline Elements:**
- **Date:** When change was made (left side)
- **Bullet:** Visual timeline marker
- **Line:** Connects timeline events
- **Summary:** One-line description of change
- **Link:** "Visa ändringar" opens diff view for that specific change

**Click Interaction:**

Clicking "Visa ändringar" opens a modal with:
- Change date
- AI summary
- Affected sections
- Full diff view (old vs. new text)
- Source document link

```
┌────────────────────────────────────────────────────────────┐
│  Ändring från 2024-03-15                           [× stäng]│
├────────────────────────────────────────────────────────────┤
│                                                             │
│  🤖 AI-sammanfattning                                       │
│                                                             │
│  Ny sektion 3:2a kräver digitala arbetsmiljö-              │
│  bedömningar för distansarbete...                           │
│                                                             │
│  Påverkade paragrafer: Ny § 3:2a                            │
│  Träder i kraft: 2024-04-01                                 │
│  Källa: [Proposition 2024/25:42 →]                          │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Diff-vy                                             │ │
│  │                                                      │ │
│  │  + § 3:2a (NY SEKTION)                               │ │
│  │  + För arbete som utförs på distans...               │ │
│  │  ...                                                 │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  [Markera som granskad] [Dela ändring]                     │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

### Implementation

```typescript
// Timeline component
export function LawTimeline({ lawId }: { lawId: string }) {
  const { data: changes } = useQuery({
    queryKey: ['lawChanges', lawId],
    queryFn: async () => {
      const res = await fetch(`/api/laws/${lawId}/changes`);
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <p className="text-gray-600">
        Denna lag har ändrats {changes.length} gånger sedan {changes[changes.length - 1]?.changeDate.getFullYear()}.
      </p>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[104px] top-0 bottom-0 w-0.5 bg-gray-300" />

        {changes.slice(0, 10).map((change, index) => (
          <div key={change.id} className="relative flex gap-4 mb-8">
            {/* Date */}
            <div className="w-24 text-right text-sm text-gray-600">
              {format(new Date(change.changeDate), 'yyyy-MM-dd')}
            </div>

            {/* Timeline bullet */}
            <div className="relative flex items-center justify-center w-3 h-3">
              <div className="w-3 h-3 bg-blue-600 rounded-full border-2 border-white" />
            </div>

            {/* Change details */}
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900">
                {change.changeType === 'new_section' && 'Ny sektion tillagd'}
                {change.changeType === 'amendment' && 'Sektion ändrad'}
                {change.changeType === 'repeal' && 'Sektion upphävd'}
                {change.changeType === 'metadata' && 'Metadata uppdaterad'}
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                {change.aiSummary}
              </p>
              <button
                onClick={() => openDiffModal(change.id)}
                className="text-sm text-blue-600 hover:underline mt-2"
              >
                Visa ändringar →
              </button>
            </div>
          </div>
        ))}

        {changes.length > 10 && (
          <button className="text-blue-600 hover:underline">
            Visa äldre ändringar
          </button>
        )}
      </div>
    </div>
  );
}
```

---

## Database Schema

### `law_changes` Table

```typescript
model LawChange {
  id                    String   @id @default(cuid())

  // Relationship
  lawId                 String
  law                   Law      @relation(fields: [lawId], references: [id], onDelete: Cascade)

  // Change metadata
  changeDate            DateTime  // When Riksdagen made the change
  detectedAt            DateTime  // When our system detected it
  effectiveDate         DateTime? // When change becomes legally active

  // Change classification
  changeType            ChangeType // amendment, new_section, repeal, metadata, status_change
  severity              Severity?  // minor, moderate, critical (Post-MVP)

  // Change content
  affectedSections      String[]  // ['§3:2a', '§5:4']
  oldText               String?   @db.Text
  newText               String?   @db.Text

  // AI-generated content
  aiSummary             String?   @db.Text
  aiImpactAssessment    String?   @db.Text // Post-MVP

  // Source
  sourceDocumentUrl     String?

  // User acknowledgment
  acknowledgedBy        Json[]    // [{ userId, acknowledgedAt }]
  archivedForUsers      String[]  // Users who removed this law from their list

  // Timestamps
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([lawId, changeDate])
  @@index([changeDate]) // For timeline queries
}

enum ChangeType {
  amendment
  new_section
  repeal
  metadata
  status_change
  associated_document
}

enum Severity {
  minor
  moderate
  critical
}
```

---

### `notifications` Table

```typescript
model Notification {
  id                String   @id @default(cuid())

  // Recipient
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Content
  type              NotificationType  // law_change, industry_update, reminder
  title             String
  message           String   @db.Text

  // Related entities
  lawChangeId       String?
  lawChange         LawChange? @relation(fields: [lawChangeId], references: [id])

  lawId             String?
  law               Law?     @relation(fields: [lawId], references: [id])

  // Status
  read              Boolean  @default(false)
  acknowledged      Boolean  @default(false)
  acknowledgedAt    DateTime?

  // Delivery
  emailSent         Boolean  @default(false)
  emailSentAt       DateTime?

  // Timestamps
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([userId, read])
  @@index([userId, acknowledged])
}

enum NotificationType {
  law_change
  industry_update
  reminder
}
```

---

## Technical Implementation

### API Routes

#### `GET /api/notifications/unacknowledged`

Returns all unacknowledged law changes for the current user.

```typescript
// app/api/notifications/unacknowledged/route.ts
export async function GET(req: Request) {
  const session = await getServerSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const notifications = await db.notification.findMany({
    where: {
      userId: session.user.id,
      acknowledged: false,
      type: 'law_change',
    },
    include: {
      lawChange: {
        include: {
          law: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return Response.json(notifications);
}
```

---

#### `POST /api/notifications/:id/acknowledge`

Marks a notification as acknowledged.

```typescript
// app/api/notifications/[id]/acknowledge/route.ts
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const notification = await db.notification.update({
    where: { id: params.id },
    data: {
      acknowledged: true,
      acknowledgedAt: new Date(),
    },
  });

  // Also update lawChange.acknowledgedBy
  if (notification.lawChangeId) {
    await db.lawChange.update({
      where: { id: notification.lawChangeId },
      data: {
        acknowledgedBy: {
          push: {
            userId: session.user.id,
            acknowledgedAt: new Date(),
          },
        },
      },
    });
  }

  return Response.json({ success: true });
}
```

---

#### `GET /api/laws/:id/changes`

Returns all changes for a specific law (for timeline visualization).

```typescript
// app/api/laws/[id]/changes/route.ts
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const changes = await db.lawChange.findMany({
    where: { lawId: params.id },
    orderBy: { changeDate: 'desc' },
  });

  return Response.json(changes);
}
```

---

### Cron Jobs

#### Daily Change Detection

```typescript
// cron/detect-law-changes.ts
import { CronJob } from 'cron';

// Run daily at 00:00 UTC
const job = new CronJob('0 0 * * *', async () => {
  console.log('🔍 Starting daily law change detection...');

  try {
    // 1. Fetch all laws from Riksdagen API
    const riksdagenLaws = await fetchAllLawsFromRiksdagen();
    console.log(`📚 Fetched ${riksdagenLaws.length} laws from Riksdagen`);

    // 2. Compare with local database
    let changesDetected = 0;

    for (const riksdagenLaw of riksdagenLaws) {
      const localLaw = await db.law.findUnique({
        where: { sfsNumber: riksdagenLaw.beteckning },
      });

      if (!localLaw) {
        // New law - create record
        await createNewLaw(riksdagenLaw);
        continue;
      }

      // Check for changes
      const changes = await detectChanges(localLaw, riksdagenLaw);

      if (changes.length > 0) {
        for (const change of changes) {
          await recordChange(localLaw.id, change);
          changesDetected++;
        }
      }
    }

    console.log(`✅ Detection complete. ${changesDetected} changes found.`);

    // 3. Trigger notification pipeline
    if (changesDetected > 0) {
      await sendDailyDigestEmails();
    }

  } catch (error) {
    console.error('❌ Error detecting law changes:', error);
    // Send alert to dev team
    await sendErrorAlert('Law change detection failed', error);
  }
});

job.start();
```

---

#### Weekly Industry Digest

```typescript
// cron/send-industry-digests.ts
import { CronJob } from 'cron';

// Run every Sunday at 18:00 CET (17:00 UTC in winter, 16:00 UTC in summer)
const job = new CronJob('0 17 * * 0', async () => {
  console.log('📬 Sending weekly industry digest emails...');

  try {
    // 1. Get all workspaces with SNI codes
    const workspaces = await db.workspace.findMany({
      where: {
        sniCode: { not: null },
      },
      include: {
        users: true,
      },
    });

    console.log(`📊 Found ${workspaces.length} workspaces with SNI codes`);

    // 2. For each workspace, find relevant law changes
    for (const workspace of workspaces) {
      const starterPack = await getIndustryStarterPack(workspace.sniCode);

      if (!starterPack) continue;

      // Get changes from the past 7 days for laws in starter pack
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);

      const relevantChanges = await db.lawChange.findMany({
        where: {
          lawId: { in: starterPack.laws },
          changeDate: { gte: weekStart },
        },
        include: {
          law: true,
        },
      });

      if (relevantChanges.length === 0) continue;

      // 3. Send email to all users in workspace
      for (const user of workspace.users) {
        await sendIndustryDigestEmail(user, workspace, relevantChanges);
      }
    }

    console.log('✅ Industry digest emails sent');

  } catch (error) {
    console.error('❌ Error sending industry digests:', error);
  }
});

job.start();
```

---

#### Reminder Emails

```typescript
// cron/send-reminder-emails.ts
import { CronJob } from 'cron';

// Run daily at 09:00 CET
const job = new CronJob('0 8 * * *', async () => {
  console.log('⏰ Checking for unacknowledged changes...');

  try {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Find notifications that need reminders
    const needsFirstReminder = await db.notification.findMany({
      where: {
        acknowledged: false,
        createdAt: { lte: threeDaysAgo, gte: sevenDaysAgo },
        // And no reminder sent yet
        NOT: {
          reminderSentAt: { not: null },
        },
      },
      include: {
        user: true,
        lawChange: {
          include: { law: true },
        },
      },
    });

    // Send first reminder
    for (const notification of needsFirstReminder) {
      await sendReminderEmail(notification.user, notification.lawChange, 'first');

      await db.notification.update({
        where: { id: notification.id },
        data: { reminderSentAt: new Date() },
      });
    }

    // Find notifications that need second reminder
    const needsSecondReminder = await db.notification.findMany({
      where: {
        acknowledged: false,
        createdAt: { lte: sevenDaysAgo },
        reminderSentAt: { not: null },
        // And second reminder not sent yet
        secondReminderSentAt: null,
      },
      include: {
        user: true,
        lawChange: {
          include: { law: true },
        },
      },
    });

    // Send second reminder
    for (const notification of needsSecondReminder) {
      await sendReminderEmail(notification.user, notification.lawChange, 'second');

      await db.notification.update({
        where: { id: notification.id },
        data: { secondReminderSentAt: new Date() },
      });
    }

    console.log(`✅ Sent ${needsFirstReminder.length} first reminders, ${needsSecondReminder.length} second reminders`);

  } catch (error) {
    console.error('❌ Error sending reminders:', error);
  }
});

job.start();
```

---

## Riksdagen API Integration

### API Overview

**Documentation:** https://data.riksdagen.se/

**Base URL:** `https://data.riksdagen.se/`

**Authentication:** None required (public API)

**Rate Limits:** None documented (but be respectful - use caching)

**Response Format:** JSON or XML (use `utformat=json`)

---

### Relevant Endpoints

#### 1. List All Laws (SFS)

```
GET https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json
```

**Response:**

```json
{
  "dokumentlista": {
    "@datum": "2024-03-20",
    "@antal": "10234",
    "dokument": [
      {
        "dok_id": "SFS1977:1160",
        "rm": "1977",
        "beteckning": "1977:1160",
        "titel": "Arbetsmiljölag",
        "doktyp": "sfs",
        "systemdatum": "2024-03-15 12:34:56",
        "publicerad": "2024-03-15",
        "status": "gällande",
        "dokument_url_text": "https://data.riksdagen.se/dokument/SFS1977:1160.text",
        "dokument_url_html": "https://data.riksdagen.se/dokument/SFS1977:1160.html"
      },
      ...
    ]
  }
}
```

**Key Fields:**
- `beteckning` - SFS number (e.g., "1977:1160") - use as unique identifier
- `titel` - Law title
- `systemdatum` - Last updated timestamp (use to detect changes)
- `status` - "gällande" (active), "upphävd" (repealed), "förslag" (proposed)
- `dokument_url_text` - Full text URL

---

#### 2. Get Full Law Text

```
GET https://data.riksdagen.se/dokument/SFS1977:1160.text
```

**Response:** Plain text content of the law (all sections, full text)

---

#### 3. Get Law Metadata

```
GET https://data.riksdagen.se/dokument/SFS1977:1160.json
```

**Response:**

```json
{
  "dokumentstatus": {
    "dokument": {
      "dok_id": "SFS1977:1160",
      "titel": "Arbetsmiljölag (1977:1160)",
      "beteckning": "1977:1160",
      "status": "gällande",
      "typ": "sfs",
      "systemdatum": "2024-03-15 12:34:56",
      "publicerad": "1978-01-01",
      "notisrubrik": "Arbetsmiljölag",
      "omtryck": false,
      "ändring": [
        {
          "sfsnummer": "2024:123",
          "ikraftträdande": "2024-04-01",
          "omfattning": "Ny § 3:2a"
        }
      ]
    }
  }
}
```

**Key Fields:**
- `systemdatum` - Compare with local database to detect changes
- `ändring` - Array of amendments (useful for change tracking)

---

### Change Detection Logic

```typescript
async function detectChanges(localLaw: Law, riksdagenData: any) {
  const changes: Change[] = [];

  // 1. Compare systemdatum (last updated timestamp)
  const localTimestamp = localLaw.lastAmendedAt;
  const riksdagenTimestamp = new Date(riksdagenData.systemdatum);

  if (riksdagenTimestamp > localTimestamp) {
    // Something changed - fetch full text to compare
    const newText = await fetch(riksdagenData.dokument_url_text).then(r => r.text());
    const oldText = localLaw.fullText;

    if (newText !== oldText) {
      changes.push({
        type: 'amendment',
        oldText,
        newText,
        changeDate: riksdagenTimestamp,
      });
    }
  }

  // 2. Compare status (active vs. repealed)
  if (localLaw.status !== riksdagenData.status) {
    changes.push({
      type: 'status_change',
      oldStatus: localLaw.status,
      newStatus: riksdagenData.status,
      changeDate: riksdagenTimestamp,
    });
  }

  // 3. Compare title (rare, but possible)
  if (localLaw.title !== riksdagenData.titel) {
    changes.push({
      type: 'metadata',
      field: 'title',
      oldValue: localLaw.title,
      newValue: riksdagenData.titel,
      changeDate: riksdagenTimestamp,
    });
  }

  return changes;
}
```

---

### Handling API Errors

```typescript
async function fetchAllLawsFromRiksdagen() {
  try {
    const response = await fetch(
      'https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json',
      { timeout: 30000 } // 30 second timeout
    );

    if (!response.ok) {
      throw new Error(`Riksdagen API error: ${response.status}`);
    }

    const data = await response.json();
    return data.dokumentlista.dokument;

  } catch (error) {
    console.error('Failed to fetch laws from Riksdagen:', error);

    // Send alert to dev team
    await sendErrorAlert('Riksdagen API failure', error);

    // Return empty array to prevent cron job crash
    return [];
  }
}
```

---

### Caching Strategy

**Problem:** Fetching 10,000+ laws daily is expensive (bandwidth, processing time).

**Solution:** Cache Riksdagen API responses.

```typescript
// Cache full law list for 24 hours
const cachedLawList = await redis.get('riksdagen:law-list');

if (cachedLawList) {
  return JSON.parse(cachedLawList);
}

const lawList = await fetchAllLawsFromRiksdagen();

await redis.set('riksdagen:law-list', JSON.stringify(lawList), {
  ex: 86400, // 24 hours
});

return lawList;
```

**Note:** Caching is optional for MVP (API is free and fast). Add if performance issues arise.

---

## Post-MVP Features

### 1. AI Severity Classification

**Goal:** Automatically classify changes as Minor / Moderate / Critical.

**Implementation:**

```typescript
async function classifyChangeSeverity(change: LawChange) {
  const prompt = `
    Classify this law change as Minor, Moderate, or Critical:

    Law: ${change.law.name}
    Change: ${change.aiSummary}

    - **Critical**: New compliance requirements, new penalties, major obligations
    - **Moderate**: Clarifications, deadline extensions, process changes
    - **Minor**: Formatting, cross-references, metadata updates

    Return only: "minor", "moderate", or "critical"
  `;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
  });

  const severity = completion.choices[0].message.content.trim().toLowerCase();

  return severity as 'minor' | 'moderate' | 'critical';
}
```

**Use Cases:**
- Filter notifications: "Only show me critical changes"
- Prioritize in Changes tab: Critical first, then moderate, then minor
- Different notification channels: Critical → Email + SMS, Moderate → Email, Minor → In-app only

---

### 2. Deep Impact Assessment

**Goal:** AI analyzes how the change affects user's specific context (employees, documents, kollektivavtal).

**Example:**

```
🤖 Impact Assessment

This change may affect your organization:

✓ You have 3 remote employees → New § 3:2a requires digital work environment assessments

⚠️ Action needed:
1. Review your current remote work policy (Policy_2023.pdf)
2. Create assessment template for remote workers
3. Document assessments for Anna S., Erik L., Maria K.

[Create compliance task] [Ask AI for help]
```

**Implementation:**

```typescript
async function generateImpactAssessment(changeId: string, workspaceId: string) {
  const change = await db.lawChange.findUnique({
    where: { id: changeId },
    include: { law: true },
  });

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      employees: true,
      documents: true,
      kollektivavtal: true,
    },
  });

  const prompt = `
    Analyze the impact of this law change on the user's organization:

    **Law Change:**
    ${change.aiSummary}

    **User Context:**
    - ${workspace.employees.length} employees
    - ${workspace.employees.filter(e => e.employmentForm === 'distans').length} remote workers
    - Kollektivavtal: ${workspace.kollektivavtal.map(k => k.name).join(', ')}
    - Documents: ${workspace.documents.map(d => d.name).join(', ')}

    Does this change affect them? If yes, provide:
    1. Who/what is affected
    2. Specific actions they should take
    3. Deadline (if applicable)

    Be concise and actionable.
  `;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  });

  return completion.choices[0].message.content;
}
```

---

### 3. Automatic Task Generation

**Goal:** AI automatically creates compliance tasks when critical changes detected.

**Example:**

User receives notification:
```
📋 Arbetsmiljölagen changed (Critical)

🤖 AI automatically created task for you:
"Update remote work safety assessments (due 2024-03-31)"

[View task] [Dismiss]
```

**Workflow:**

1. Change detected → AI severity = "critical"
2. AI impact assessment identifies action needed
3. System automatically creates task:
   - Title: "Update remote work safety assessments"
   - Due date: Effective date - 7 days
   - Assigned to: Workspace owner
   - Linked law: Arbetsmiljölagen
   - Description: AI-generated action steps

4. User receives notification about new task
5. User can accept, modify, or dismiss

**User Control:** Users can disable auto-task generation in settings.

---

### 4. Custom Alert Rules

**Goal:** Advanced users can configure custom notification rules.

**Examples:**

```
IF law category = "Arbetsrätt"
  AND severity = "critical"
THEN notify via SMS + email immediately

IF law in my list
  AND change type = "new_section"
THEN create AI impact assessment
  AND notify team members
```

**UI:**

```
┌────────────────────────────────────────────┐
│  Custom Alert Rules                        │
├────────────────────────────────────────────┤
│                                            │
│  Rule 1: Critical labor law changes        │
│  ├─ IF: Category = Arbetsrätt              │
│  │      Severity = Critical                │
│  └─ THEN: Notify via SMS + Email           │
│           Create task automatically        │
│                                            │
│  [Edit] [Delete]                           │
│                                            │
│  [+ Add new rule]                          │
│                                            │
└────────────────────────────────────────────┘
```

---

### 5. Change Analytics Dashboard

**Goal:** Show users insights about law changes over time.

**Metrics:**
- Total changes in tracked laws this month/year
- Average changes per law
- Most frequently changed laws
- Acknowledgment rate (% of changes reviewed)
- Time to acknowledge (average days)

**Visualizations:**
- Line chart: Changes over time
- Bar chart: Changes by category
- Heatmap: Which months have most changes
- Progress ring: "You've reviewed 87% of changes this month"

---

### 6. Slack/Teams Integration

**Goal:** Send change notifications to team Slack/Teams channels.

**Setup:**
1. Workspace settings → Integrations → Connect Slack
2. Select channel: #legal-compliance
3. Configure notification preferences

**Slack Message:**

```
📋 New Law Change Detected

Arbetsmiljölagen (1977:1160) was updated on 2024-03-15

🤖 AI Summary:
Ny sektion 3:2a kräver digitala arbetsmiljöbedömningar för distansarbete.

Träder i kraft: 2024-04-01

[View in Laglig.se] [Mark as reviewed]
```

---

### 7. Export Change Report

**Goal:** Generate PDF report of all changes for compliance audits.

**Content:**
- Date range: 2024-01-01 to 2024-12-31
- List of all tracked laws
- All changes detected
- Acknowledgment status
- User who acknowledged (audit trail)

**Format:**

```
┌────────────────────────────────────────────┐
│  Law Change Report                         │
│  2024-01-01 to 2024-12-31                  │
│                                            │
│  Workspace: Bygg AB                        │
│  Generated: 2025-01-15                     │
├────────────────────────────────────────────┤
│                                            │
│  Arbetsmiljölagen (1977:1160)              │
│                                            │
│  2024-03-15: Ny sektion 3:2a tillagd       │
│  Summary: [AI summary here]                │
│  Acknowledged by: Anna Svensson (2024-03-16)│
│                                            │
│  2024-01-20: § 5:4 ändrad                  │
│  Summary: [AI summary here]                │
│  Acknowledged by: Erik Lundqvist (2024-01-22)│
│                                            │
│  ...                                       │
│                                            │
└────────────────────────────────────────────┘
```

**Use Case:** Enterprise customers need audit trail for compliance documentation.

---

## Summary: MVP Scope

### ✅ Included in MVP

1. **Change Detection**
   - Daily cron job checking all 10,000+ laws
   - Compare with local database
   - Store full change history

2. **Notifications**
   - Email notifications (daily digest)
   - In-app notification bell with badge
   - Weekly industry digest (SNI-based)
   - Reminder emails (3 days, 7 days)

3. **User Interface**
   - Law List → Changes tab (with unacknowledged count badge)
   - Notification bell dropdown (recent changes)
   - Individual law page → Timeline visualization
   - GitHub-style diff view

4. **AI Features**
   - Plain-language change summaries (unlimited, doesn't count toward quota)
   - Affected sections extraction

5. **Workflow**
   - "Mark as reviewed" acknowledgment
   - Bulk acknowledgment
   - Persistent badges until acknowledged

6. **Integration**
   - Auto-monitoring when law added to list
   - Stop monitoring when law removed

---

### ❌ Deferred to Post-MVP

1. **AI severity classification** (Minor / Moderate / Critical)
2. **Deep impact assessment** (comparing against employees, documents, kollektivavtal)
3. **Automatic task generation** from critical changes
4. **SMS notifications** (Enterprise tier)
5. **Mobile push notifications**
6. **Slack/Teams integration**
7. **Custom alert rules**
8. **Change analytics dashboard**
9. **Export change report (PDF)**
10. **Granular notification preferences** (per-law, per-channel)
11. **Advanced filtering** (by severity, date range, category)

---

## Technical Dependencies

### External Services

- **Riksdagen API** - Law data source (free, no authentication)
- **OpenAI GPT-4** - AI summary generation
- **Email Service** - SendGrid, Resend, or AWS SES
- **Redis** (optional) - Caching Riksdagen API responses

### NPM Packages

```json
{
  "dependencies": {
    "cron": "^3.1.0",              // Scheduled jobs
    "diff": "^5.1.0",              // GitHub-style diff view
    "date-fns": "^3.0.0",          // Date formatting
    "@vercel/postgres": "^0.5.0",  // Database
    "openai": "^4.20.0",           // AI summaries
    "@sendgrid/mail": "^8.0.0"     // Email notifications
  }
}
```

---

## Success Metrics

### Engagement Metrics

- **Email open rate:** Target 40%+ (industry average: 20-25%)
- **Click-through rate:** Target 15%+ (email → Changes tab)
- **Acknowledgment rate:** Target 70%+ of changes acknowledged within 7 days
- **Weekly digest engagement:** Target 25%+ open rate

### Retention Metrics

- **7-day retention:** Users who receive change notification return within 7 days
- **30-day retention:** Users with active monitoring vs. inactive users
- **Churn correlation:** Do users without change notifications churn faster?

### Business Metrics

- **Upgrade driver:** % of Solo users who upgrade to Team citing "more laws to monitor"
- **Activation metric:** % of trial users who add >3 laws to their list (enabling monitoring)
- **Feature adoption:** % of workspaces with >0 acknowledged changes

---

## Conclusion

The Change Monitoring System is a **strategic retention and engagement driver** for Laglig.se. By automatically notifying users about law changes and providing AI-powered summaries, the platform becomes an indispensable compliance partner.

**Key Differentiators:**
✅ Complete historical record (10,000+ laws, full amendment timeline)
✅ AI-powered plain-language summaries (no legal jargon)
✅ GitHub-style diff view (exact text changes)
✅ Industry-aware monitoring (weekly SNI-based emails)
✅ Frictionless acknowledgment workflow
✅ Unlimited AI change analysis (doesn't count toward quota)

**MVP delivers core value:**
- Users never miss critical compliance updates
- Clear understanding of what changed and when it takes effect
- Persistent reminders until changes acknowledged
- Industry awareness through weekly emails

**Post-MVP expansion opportunities:**
- AI severity classification and impact assessment
- Automatic task generation
- Advanced integrations (Slack, Teams, SMS)
- Change analytics and audit reports

**Next Steps:**
1. ✅ Elicit requirements (COMPLETE)
2. ⏳ Review and approve this specification
3. ⏳ Create technical implementation tickets
4. ⏳ Integrate with PRD and architecture documents
5. ⏳ Begin development

---

**Document End**
