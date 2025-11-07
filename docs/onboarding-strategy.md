# Onboarding & Lead Capture Strategy

## Recommended Approach: Hybrid Session-Based Model with MQL Capture

### Architecture Overview

We use a **three-stage approach** that balances conversion optimization, lead capture, and resource efficiency:

1. **Anonymous Session (Pre-Email)** - Temporary storage, no workspace
2. **Lead Capture (Email Only)** - MQL created, session persisted
3. **Full Signup (Account Creation)** - Workspace created, data migrated

---

## Stage 1: Anonymous Session (Widget Trial)

**When:** User enters org-number and answers questions
**Storage:** Temporary session in Redis (24-hour TTL)
**No workspace created yet**

```typescript
interface AnonymousSession {
  sessionId: string, // UUID
  orgNumber: string,
  companyName: string,
  sniCode: string,
  websiteUrl?: string,
  contextAnswers: Record<string, boolean>,
  phase1Laws: string[], // 15-30 laws shown immediately
  createdAt: Date,
  ipAddress: string, // For analytics
  userAgent: string,
  referrer?: string, // Track marketing source
}

// Store in Redis with 24-hour expiration
async function createAnonymousSession(data: CompanyContext): Promise<string> {
  const sessionId = generateUUID()

  await redis.set(
    `session:${sessionId}`,
    JSON.stringify({
      ...data,
      createdAt: new Date(),
    }),
    { ex: 86400 } // 24 hours
  )

  // Track anonymous event for analytics
  await analytics.track({
    event: 'Onboarding Started',
    properties: {
      orgNumber: hashOrgNumber(data.orgNumber), // Privacy-safe
      industry: data.sniCode,
      hasWebsite: !!data.websiteUrl,
    },
  })

  return sessionId
}
```

**Benefits:**
- No database pollution with abandoned sessions
- Low resource usage (Redis only)
- Fast performance
- Easy cleanup (auto-expires)

---

## Stage 2: Lead Capture (Email Collection for MQL)

**When:** User sees value and wants to continue
**Trigger:** "Se alla ~70 lagar" CTA button
**Storage:** Lead record in database + session extended

```typescript
interface LeadCapture {
  id: string,
  email: string,
  sessionId: string, // Links to Redis session
  orgNumber: string,
  companyName: string,
  marketingConsent: boolean,
  source: 'widget_trial',
  createdAt: Date,
  sessionData: AnonymousSession, // Snapshot for safety
}

async function captureLeadEmail(email: string, sessionId: string): Promise<void> {
  const session = await redis.get(`session:${sessionId}`)
  if (!session) throw new Error('Session expired')

  const sessionData = JSON.parse(session)

  // Create MQL in database
  const lead = await prisma.lead.create({
    data: {
      email,
      session_id: sessionId,
      org_number: sessionData.orgNumber,
      company_name: sessionData.companyName,
      sni_code: sessionData.sniCode,
      session_data: sessionData, // JSONB column
      source: 'widget_trial',
    },
  })

  // Extend session to 7 days
  await redis.expire(`session:${sessionId}`, 604800)

  // Send to marketing automation (HubSpot/Brevo)
  await marketingAutomation.createContact({
    email,
    properties: {
      company: sessionData.companyName,
      industry: sessionData.sniCode,
      employee_count: sessionData.employeeCount,
      laws_identified: sessionData.phase1Laws.length,
      lifecycle_stage: 'marketingqualifiedlead',
    },
  })

  // Send immediate nurture email
  await sendEmail({
    to: email,
    template: 'trial_started',
    data: {
      companyName: sessionData.companyName,
      lawCount: sessionData.phase1Laws.length,
      resumeLink: `${APP_URL}/resume/${sessionId}`,
    },
  })
}
```

**Marketing Automation Flow:**
1. **Immediate:** "Din laglista är sparad" email with resume link
2. **Day 1:** "Visste du att..." education email
3. **Day 3:** "3 lagar som ofta missas" value email
4. **Day 7:** "Specialerbjudande" discount offer
5. **Day 14:** "Sista påminnelsen" urgency email

---

## Stage 3: Full Signup (Workspace Creation)

**When:** User creates account with password
**Storage:** Full workspace + user account created

```typescript
async function convertLeadToUser(
  leadId: string,
  password: string
): Promise<{ user: User, workspace: Workspace }> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
  })

  // Start transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create user account
    const user = await tx.user.create({
      data: {
        email: lead.email,
        password_hash: await hashPassword(password),
        email_verified: false, // Require verification
      },
    })

    // 2. Create workspace from session data
    const workspace = await tx.workspace.create({
      data: {
        name: `${lead.company_name} Workspace`,
        org_number: lead.org_number,
        sni_code: lead.sni_code,
        owner_id: user.id,
      },
    })

    // 3. Add user to workspace
    await tx.workspaceMember.create({
      data: {
        workspace_id: workspace.id,
        user_id: user.id,
        role: 'OWNER',
      },
    })

    // 4. Create law list from session
    const lawList = await tx.lawList.create({
      data: {
        workspace_id: workspace.id,
        name: 'Mina Lagar',
        created_by_id: user.id,
      },
    })

    // 5. Add Phase 1 laws immediately
    const phase1Laws = lead.session_data.phase1Laws
    for (const sfsNumber of phase1Laws) {
      await tx.lawInList.create({
        data: {
          law_list_id: lawList.id,
          sfs_number: sfsNumber,
        },
      })
    }

    // 6. Mark lead as converted
    await tx.lead.update({
      where: { id: leadId },
      data: {
        converted_at: new Date(),
        converted_user_id: user.id,
      },
    })

    return { user, workspace, lawList }
  })

  // 7. Trigger Phase 2 generation (background job)
  await backgroundJobs.enqueue('generate-phase2-laws', {
    workspaceId: result.workspace.id,
    sessionData: lead.session_data,
  })

  // 8. Update marketing automation
  await marketingAutomation.updateContact({
    email: lead.email,
    properties: {
      lifecycle_stage: 'customer',
      converted_date: new Date(),
    },
  })

  // 9. Clear session
  await redis.del(`session:${lead.session_id}`)

  return result
}
```

---

## Benefits of This Approach

### 1. Conversion Optimization
- **Low friction:** No email required to see value
- **Value first:** Show personalized laws before asking for email
- **Progressive commitment:** Email → Password in separate steps
- **Resume capability:** Users can return to saved session

### 2. Lead Generation
- **MQL capture:** Get email even if they don't convert immediately
- **Marketing automation:** Nurture leads over time
- **Attribution tracking:** Know which campaigns drive trials
- **Abandonment recovery:** Re-engage users who didn't complete

### 3. Resource Efficiency
- **No database pollution:** Abandoned sessions auto-expire
- **Deferred computation:** Phase 2 laws only for real signups
- **Cost control:** No workspace overhead for trials
- **Clean data:** Only real users in main database

### 4. Data Intelligence
- **Conversion funnel:** Track drop-off at each stage
- **Industry insights:** See which industries trial most
- **Feature validation:** Track which laws generate interest
- **Pricing optimization:** Test different offers to leads

---

## Implementation Checklist

- [ ] Redis session storage with TTL
- [ ] Lead capture form (email only)
- [ ] Lead table in database
- [ ] Marketing automation integration (HubSpot/Brevo)
- [ ] Email templates for nurture sequence
- [ ] Resume session functionality
- [ ] Session-to-workspace migration logic
- [ ] Background job for Phase 2 generation
- [ ] Analytics tracking at each stage
- [ ] GDPR-compliant data handling
- [ ] Session cleanup cron job (backup)

---

## Metrics to Track

```typescript
interface OnboardingMetrics {
  funnel: {
    sessionsStarted: number,      // Widget trials
    emailsCaptured: number,       // MQLs
    accountsCreated: number,      // Conversions
    workspacesActive: number,     // Retained users
  },

  conversionRates: {
    trialToLead: number,          // Sessions → Email (target: 30%)
    leadToCustomer: number,       // Email → Signup (target: 20%)
    overallConversion: number,    // Sessions → Signup (target: 6%)
  },

  timing: {
    avgTimeToEmail: number,       // How long before email capture
    avgTimeToSignup: number,      // Email → Signup duration
    sessionAbandonment: number,   // % who never give email
  },

  quality: {
    phase2CompletionRate: number, // % who wait for all laws
    firstWeekRetention: number,   // Still active after 7 days
    paidConversion: number,        // Free → Paid upgrade rate
  },
}
```

---

## Alternative Approaches Considered

### Option A: Create Full Workspace Immediately
❌ **Rejected because:**
- Database pollution with abandoned trials
- Higher infrastructure costs
- Complex cleanup logic needed
- GDPR concerns with storing data without consent

### Option B: No Persistence Until Signup
❌ **Rejected because:**
- Lose users who want to think about it
- Can't do abandonment recovery
- No lead capture for marketing
- Poor user experience if browser crashes

### Option C: Local Storage Only
❌ **Rejected because:**
- Can't resume on different device
- No lead capture capability
- Lost data if cookies cleared
- No backend analytics

---

## Conclusion

The **hybrid session-based model with MQL capture** provides the best balance of:
- High conversion rates (progressive commitment)
- Lead generation (email capture without full signup)
- Resource efficiency (Redis sessions, not full workspaces)
- Marketing automation (nurture sequences)
- User experience (can resume anytime)

This approach has been proven successful by companies like Typeform, Canva, and Grammarly who use similar progressive onboarding flows.