# Epic 8: Change Monitoring & Notification System (DETAILED)

**Goal:** Implement retention engine that automatically detects law changes and notifies users with AI-powered plain language summaries and business impact assessment.

**Value Delivered:** Users never miss critical law updates + AI summaries make changes understandable + retention improves through ongoing value delivery.

**Competitive Context:** Notisum provides basic change notifications with raw legal text only (confirmed via live account testing). Laglig.se differentiates through:

- AI plain language summaries explaining "what changed" in Swedish
- Business impact assessment (High/Medium/Low priority)
- Action guidance ("Review by [date]" vs "No action needed")
- Visual GitHub-style diffs (not just grey text boxes)
- Contextual help explaining legal notation (ändr:, nya §§, rubr:)

## **Reference:** See `docs/competitive-analysis/notisum-change-notification-analysis.md` for detailed competitor breakdown based on live email examples.

## Story 8.1: Build Change Detection UI (Changes Tab)

**As a** user,
**I want** to see which laws in my list have changed,
**so that** I review updates and stay compliant.

**Acceptance Criteria:**

1. Law List page → "Changes" tab (next to "All Laws" tab)
2. Changes tab shows all unacknowledged changes for laws in workspace
3. Each change displayed as card:
   - 🔴/🟡/🟢 Priority badge (High/Medium/Low) - DIFFERENTIATION from Notisum
   - Law title, SFS number
   - Change detected date
   - Change type badge (Amendment, New Section, Repeal, Metadata Update)
   - **AI Summary** (1-2 sentences in plain Swedish): "This amendment extends parental leave to 18 months" - DIFFERENTIATION from Notisum
   - **Business Impact** (1 sentence): "Action required by Dec 1" or "FYI only - reference update" - DIFFERENTIATION from Notisum
   - "View Details" button → Opens diff view
   - "Mark as Reviewed" button
4. Changes sorted by priority (High → Medium → Low), then by date
5. Unacknowledged count badge on "Changes" tab: "Changes (3)"
6. Empty state: "No unacknowledged changes ✅"
7. Filter by priority: "Show: All | High Priority | Medium | Low"

## Story 8.2: Implement GitHub-Style Diff View

**As a** user,
**I want** to see exactly what changed in a law,
**so that** I understand the impact.

**Acceptance Criteria:**

1. Clicking "View Details" on change card opens diff modal
2. **Diff view shows** (DIFFERENTIATION: Notisum only shows grey box with full text):
   - Law title, SFS number
   - Change type, detected date
   - **Side-by-side comparison:** Old version | New version (GitHub-style)
   - **Changed sections highlighted:** Red background for removed text, green for added
   - Line numbers for reference
   - **Contextual explanation:** "§ 26 was modified - this section handles X"
3. **AI summary at top** (2-3 sentences in plain Swedish):
   - "Summary: Sick pay procedure references updated to align with new Försäkringskassan guidelines"
   - "Impact: Low - Administrative reference update, no action required"
4. "Mark as Reviewed" button in modal
5. **"View Full Law" link** → Opens individual law page
6. **Link to official source:** "Riksdagen PDF" link
7. Mobile: Stack old/new versions vertically instead of side-by-side
8. Diff library: Use `diff` npm package or similar
9. **Competitive note:** Notisum shows raw text in grey box - no visual diff, no before/after

## Story 8.3: Implement "Mark as Reviewed" Workflow

**As a** user,
**I want** to mark changes as reviewed,
**so that** they disappear from my Changes tab after I've acknowledged them.

**Acceptance Criteria:**

1. "Mark as Reviewed" button on change card and diff modal
2. Clicking button:
   - Updates `law_changes.acknowledged_at` timestamp
   - Updates `law_changes.acknowledged_by` to current user
   - Removes change from Changes tab
   - Decreases unacknowledged count badge
3. Confirmation toast: "Change marked as reviewed ✓"
4. Bulk "Mark All as Reviewed" button (confirmation modal)
5. Activity logged: "Anna reviewed change to Arbetsmiljölagen on 2025-01-15"
6. Enterprise tier: Activity appears in Workspace Activity Log

---

## Story 8.4: Implement Email Notifications for Law Changes

**As a** user,
**I want** to receive email notifications when laws in my list change,
**so that** I'm alerted even when not using the app.

**Acceptance Criteria:**

1. When law change detected (Epic 2.11 cron job), trigger notification pipeline
2. **Daily Digest Email** (sent 08:00-09:00 CET, morning batch):
   - **Subject:** "🔔 [List Name] - X nya lagändringar att granska" (personalized per law list)
   - **Email body structure** (inspired by Notisum, enhanced with AI):
     - Greeting: "Hej [Name],"
     - Context: "Följande lagar i din lista '[List Name]' har ändrats:"
     - **For each changed law:**
       - 🟢/🟡/🔴 Priority badge (Low/Medium/High)
       - Law title with link to Laglig.se page
       - SFS amendment number (e.g., "SFS 2025:938")
       - **AI Summary** (2-3 sentences in plain Swedish)
       - **Business Impact** (1 sentence: "No action required" or "Review by Dec 1")
       - Changed sections: "ändr: 26 §" with explanation
       - Effective date: "Ikraftträdande 1 december 2025"
       - **Dual links:** [View on Laglig.se] [Official Riksdagen PDF]
     - CTA button: "Granska alla ändringar"
     - Footer with unsubscribe link
   - Sent only if changes detected in last 24 hours
   - **Multiple law lists:** Send separate email per list (like Notisum)
3. **Email content differentiators** (vs Notisum):
   - Plain language AI summaries (not just legal text)
   - Priority indication (High/Medium/Low)
   - Action guidance per change
   - Contextual explanation of legal notation
4. **Section-level granularity** (match Notisum):
   - Show exact sections changed (§ numbers)
   - List multiple recent amendments if applicable
   - Include "Senaste ändringar" section for multi-amendment laws
5. Email preferences in Workspace Settings (user can opt out)
6. Unsubscribe link in footer: "Avbeställare är [email]"
7. Email template uses React Email, branded design
8. Track email open rates (UTM parameters in links)
9. **Competitive validation:** Email structure validated against live Notisum examples (Nov 2025)

## Story 8.5: Implement In-App Notification Bell

**As a** user,
**I want** to see a notification bell with unacknowledged change count,
**so that** I know at a glance if there are updates.

**Acceptance Criteria:**

1. Notification bell icon in top navigation (right side)
2. Badge shows unacknowledged change count: "3"
3. Clicking bell opens dropdown showing recent changes (last 5)
4. Each change in dropdown:
   - Law title
   - AI summary (truncated to 50 chars)
   - Time ago: "2 hours ago"
   - Click → Opens Changes tab
5. "View All Changes" link at bottom → Opens Changes tab
6. Bell badge disappears when count = 0
7. Real-time updates: Poll for new changes every 5 minutes or use WebSocket

---

## Story 8.6: Implement Reminder Emails for Unacknowledged Changes

**As a** product owner,
**I want** to send reminder emails to users with unacknowledged changes,
**so that** critical updates aren't missed.

**Acceptance Criteria:**

1. **Day 3 reminder:**
   - If change unacknowledged after 3 days, send reminder email
   - Subject: "Påminnelse: Olästa lagändringar"
   - Body: "Du har 3 olästa lagändringar från [Date]. Granska dem nu för att hålla dig uppdaterad."
   - CTA: "Granska ändringar"
2. **Day 7 reminder:**
   - If still unacknowledged after 7 days, send second reminder
   - Subject: "Viktigt: Lagändringar kräver din uppmärksamhet"
   - Body: Slightly more urgent tone + specific law names listed
3. **Weekly digest inclusion:**
   - Unacknowledged changes included in weekly industry digest email
   - CTA prominently displayed
4. Reminder emails track engagement (opens, clicks)
5. Users can disable reminders in settings (not recommended, show warning)

---

## Story 8.7: Implement Weekly Industry Digest Email

**As a** user,
**I want** to receive a weekly email with law changes relevant to my industry,
**so that** I discover changes to laws not yet in my list.

**Acceptance Criteria:**

1. Weekly digest sent Sundays at 18:00 CET
2. **Email content:**
   - Subject: "Veckans lagändringar för [Industry Name]"
   - Intro: "Här är vad som hände i veckans lagstiftning för [industry]"
   - Section 1: Changes to laws in workspace (from daily digest)
   - Section 2: Changes to industry starter pack laws NOT in workspace (discovery)
   - Section 3: "Nya lagar du kanske behöver" - AI recommendations
   - CTA: "Lägg till i min laglista"
3. Industry determined by workspace's SNI code (set during onboarding)
4. Email sent only if ≥1 change detected that week
5. Users can opt out in settings
6. A/B test subject lines for engagement

---

## Story 8.8: Implement AI Change Summaries

**As a** user,
**I want** to see plain-language summaries of law changes,
**so that** I understand the impact without reading legal jargon.

**Acceptance Criteria:**

1. When change detected, generate AI summary using GPT-4
2. Prompt: "Summarize this law change in 1-2 sentences for a business owner. Focus on practical impact. Old version: [text]. New version: [text]."
3. Summary stored in `law_changes.ai_summary`
4. Summary generation completes within 5 minutes of detection (NFR11)
5. Summaries displayed in:
   - Changes tab cards
   - Email notifications
   - Notification bell dropdown
   - Diff view modal
6. Hallucination check: If summary contains claims not in diff, regenerate
7. Fallback: If AI fails, show "Change detected. View details for more information."

---

## Story 8.9: Add Amendment Timeline Visualization (Notisum Competitive Parity)

**As a** user,
**I want** to see a complete amendment history timeline for each law with rich metadata,
**so that** I understand how the law has evolved and can track regulatory changes over time.

**Competitive Context:** Notisum provides amendment timelines with 7 data points per amendment (see `docs/notisum-amendment-competitive-analysis.md`). This story implements **feature parity + automation advantages**.

**Acceptance Criteria:**

1. Individual Law Page → "Change History" tab (replace placeholder from Epic 2.6)
2. **Amendment Timeline Component** displays all historical amendments chronologically (newest first)
3. **Each amendment card shows all 7 fields** (competitive requirement):
   - **SFS Number** (clickable link to amending law): "SFS 2025:732"
   - **Publication Date**: "2025-06-24"
   - **Full Title**: "Lag (2025:732) om ändring i arbetsmiljölagen (1977:1160)"
   - **Affected Sections** (Notisum format): "ändr. 6 kap. 17 §; upph. 8 kap. 4 §"
   - **Summary** (2-3 sentences, GPT-4 generated): "Gränsen för att företrädas av elevskyddsombud höjs..."
   - **Effective Date** (with future indicator): "2028-07-01" + badge "Framtida"
   - **User Comments** (workspace-specific): Expandable text area for team notes
4. **Visual Design** (inspired by Notisum, enhanced):
   - Border-left-4 with blue accent
   - Collapsible cards (click to expand full details)
   - Color coding: Green (new sections), Yellow (amended), Red (repealed)
   - Mobile-responsive (stack fields vertically on <768px)
5. **Contextual Help** explaining Swedish legal notation:
   - Tooltip on "ändr." → "Amended sections"
   - Tooltip on "upph." → "Repealed sections"
   - Tooltip on "nya" → "New sections added"
   - Tooltip on "betecknas" → "Section renumbered"
6. **Data Source Indicator**: Badge showing source (Riksdagen parsing, Lagen.nu, SFSR)
7. **Link to Amending Law**: Click SFS number → Opens amending law detail page
8. **Link to Official PDF**: "View Riksdagen PDF" button → Opens Notisum-hosted PDF or Riksdagen URL
9. **Empty State** (if no amendments): "This law has not been amended since publication."
10. **Loading State**: Skeleton cards while fetching 90K+ amendment records
11. **Performance**: Timeline loads <500ms for laws with <50 amendments (90% of cases)
12. **Verification**: Arbetsmiljölagen (1977:1160) displays all 77 amendments matching Notisum data

**Competitive Advantages Beyond Notisum:**

- ✅ **Automated Updates**: Nightly cron detects new amendments (Notisum requires manual updates)
- ✅ **AI Summaries**: GPT-4 generated vs. manually written
- ✅ **Workspace Comments**: Team collaboration (Notisum lacks this)
- ✅ **Cross-Law Navigation**: Click SFS number → View amending law immediately

**Reference Implementation:** See `docs/historical-amendment-tracking-strategy.md` Section 12.7 for React component code.

---

## Story 8.10: Implement Effective Date Tracking and Source Links

**As a** user,
**I want** to see when a law change takes effect and access source documents,
**so that** I plan compliance timelines.

**Acceptance Criteria:**

1. Riksdagen API provides effective date and source proposition link
2. `law_changes` table stores: `effective_date`, `source_url`
3. Diff view modal displays:
   - Detected date: "Ändringen upptäckt 2025-01-10"
   - Effective date: "Träder i kraft 2025-03-01"
   - Time until effective: "60 days from now" (if future)
   - Source link: "Läs proposition [link to Riksdagen]"
4. Changes tab shows effective date badge: "Effective in 30 days" (amber), "Effective today" (red), "Effective 10 days ago" (green)
5. Sort changes by effective date (prioritize upcoming)

---

## Story 8.11: Implement Change Notification Preferences

**As a** user,
**I want** to customize which change notifications I receive,
**so that** I'm not overwhelmed.

**Acceptance Criteria:**

1. Workspace Settings → Notifications tab
2. **Email preferences:**
   - Daily digest: On/Off
   - Weekly industry digest: On/Off
   - Reminder emails: On/Off (after 3 days, after 7 days)
   - Frequency: Instant, Daily, Weekly, Off
3. **In-app preferences:**
   - Notification bell: On/Off
   - Desktop notifications (browser push): On/Off
4. **Change type filters:**
   - Amendments: On/Off
   - New sections: On/Off
   - Repeals: On/Off
   - Metadata changes: On/Off
5. Preferences saved per user (not per workspace)
6. Default: All notifications enabled

---

## Story 8.12: Optimize Change Detection Performance

**As a** product owner,
**I want** to ensure change detection cron job completes within 2 hours,
**so that** notifications are timely.

**Acceptance Criteria:**

1. Daily cron job (from Epic 2.8) optimized:
   - Parallel processing: Process 10 laws concurrently
   - Incremental hashing: Compare checksums before full diff (skip unchanged)
   - Rate limiting: Respect Riksdagen API limits (10 req/sec)
2. Job completion time monitored (target <2 hours per NFR10)
3. Error handling: Retry failed law fetches, log errors to Sentry
4. Progress tracking: Log "Processed 5,000/10,000 laws (50%)"
5. Alerting: Email founder if job fails or exceeds 3 hours
6. Performance dashboard: Job runtime trend (daily chart)
7. Optimization: Cache frequently accessed laws, skip rarely changed laws

---

**Epic 8 Complete: 12 stories, 3-4 weeks estimated**

---

**ALL EPICS COMPLETE (Epics 2-8): Total 76 stories, 22-28 weeks estimated**

**End of PRD Epic Details**

---
