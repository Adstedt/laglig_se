# UAT — `feat/epic-14-agent-action-cards`

Walk the preview deploy (or local dev) end-to-end before merging. Check each box as you go. If anything deviates from **Expected**, note the behavior in the PR and don't merge.

**Preview:** Vercel auto-deploys this branch; URL is in the PR checks.
**Login:** `alexander.adstedt+10@kontorab.se` / standard password.

---

## 1. Per-kravpunkt comments

**Where:** legal-document modal → **Kravpunkter** accordion → expand a krav.

### 1.1 Add comment to a krav (empty state)

Pre: pick any law list item. Open it. Expand Kravpunkter. Add a new krav ("UAT note test") so you have a known target.

- [ ] Click the chevron on the new krav → row expands, revealing "Kräver bevis" toggle, "Länka bevis", and **+ Lägg till kommentar**.
- [ ] Click **+ Lägg till kommentar** → a textarea appears with placeholder "Skriv en kommentar…".
- [ ] Type a note, click anywhere outside the textarea (blur) → note saves and renders as muted text under the "Kommentar" label.
- [ ] Collapse the krav (click chevron again) → a small speech-bubble icon shows on the row next to the bevis badge.

### 1.2 Comment persists after reopen

- [ ] Close the modal (X or Escape).
- [ ] Reopen the same law list item.
- [ ] Expand Kravpunkter → the speech-bubble icon is on the row.
- [ ] Expand the krav → comment text is visible under "Kommentar".

### 1.3 Edit an existing comment

- [ ] Click the comment text → it becomes an editable textarea with the prior value.
- [ ] Change the text, blur → new text saved.

### 1.4 Escape cancels edit (does NOT close modal)

**This is the regression gate** — the legacy-dialog Escape bug bit us before.

- [ ] Click the comment to enter edit mode.
- [ ] Type a change.
- [ ] Press **Escape**.
- [ ] The textarea closes, the original comment is restored, **and the modal stays open**.

### 1.5 Clear a comment

- [ ] Open a krav with an existing comment.
- [ ] Edit → clear all text → blur.
- [ ] The section reverts to **+ Lägg till kommentar**.
- [ ] Collapse the krav → the speech-bubble icon is gone.

### 1.6 Read-only permissions

Optional: if you have a workspace member with read-only tasks permission, log in as them and confirm:

- [ ] Comment renders as plain text (no edit affordance, no cursor change on hover).
- [ ] **+ Lägg till kommentar** button is hidden entirely when no comment exists.

Cleanup: delete the test krav via the ✕ button on its row.

---

## 2. "Generella kommentarer" rename

**Where:** legal-document modal → Kravpunkter accordion.

- [ ] The list-item-wide free-text section heading reads **Generella kommentarer** (not "Kommentar").
- [ ] Per-krav comments inside expanded rows still use the "Kommentar" label (scoped to that krav) — this is intentional.
- [ ] Clicking **Generella kommentarer** still opens the rich-text editor as before (free-text behavior unchanged).

---

## 3. "Fråga Lexa" CTA inversion

**Where:** both modals' Snabblänkar card.

### 3.1 Legal-document modal

- [ ] Open any law list item.
- [ ] In the right panel → **Snabblänkar** card, the **Fråga Lexa om lagen** button has a **dark (near-black) background with white text and white logo** — not a white outline button.
- [ ] Click it → the in-modal AI chat panel opens.

### 3.2 Task modal

- [ ] Open any task (create one if needed).
- [ ] In the right panel → **Snabblänkar** card, **Fråga Lexa om uppgiften** has the same dark fill + white text/logo.
- [ ] Click it → chat panel opens.

### 3.3 Dark-mode check

- [ ] Switch the app to dark mode (user menu → theme).
- [ ] Both CTAs flip to **white background + dark text/logo** (still pops against the dark panel).

---

## 4. Split-panel modal shell (chat toggle, compact strip, rail)

**Where:** both modals — the shared shell that wraps content + chat.

### 4.1 Open/close chat in legal-document modal

- [ ] Open a legal document modal.
- [ ] Click **Fråga Lexa om lagen** → chat panel slides in from the right.
- [ ] The left panel compacts (smaller header / rail-like) so both fit.
- [ ] Close the chat (X on chat panel) → left panel expands back to full width.

### 4.2 Open/close chat in task modal

Same flow with a task:

- [ ] Open → click Fråga Lexa → chat opens, task panel compacts.
- [ ] Close chat → task panel restores.

### 4.3 Rail / compact strip visibility

When chat is open, the compact strip/rail on the left should still show:

- [ ] (Legal modal) Document number, title, quick action icons.
- [ ] (Task modal) Task title, status, assignee.

### 4.4 Deep-link opens chat context

- [ ] From the /ai-chat standalone page OR from the modal, confirm switching between documents in the chat sidebar works without layout thrash.

---

## 5. Activity-log overhaul

**Where:** `/workspace/activity` (main nav → Aktivitet, or similar).

### 5.1 Day separator headers

- [ ] Rows are grouped under day headers: **Idag**, **Igår**, or formatted dates like "Torsdag 16 April 2026".
- [ ] Each header shows the count: "· 5 händelser" (pluralization handled — `1 händelse` vs. `N händelser`).

### 5.2 Sentence-based rendering

- [ ] Each row renders as **one human Swedish sentence** describing the action (e.g. "Alexander ändrade status på uppgiften 'Fixa bug' till Klar").
- [ ] Links inside the sentence (task / law / user) are clickable and navigate correctly.
- [ ] A category badge (color-coded icon + label) renders in its own column.
- [ ] A two-line timestamp (time + relative-or-date) renders in its own column.

### 5.3 Expand/collapse a row

- [ ] Click the chevron on any row → row expands to show the full old→new diff.
- [ ] Notification recipients (if applicable) render in the expanded panel.
- [ ] Click again → row collapses.

### 5.4 Filters

- [ ] Filter by category → only matching rows + headers remain.
- [ ] Filter by user → same.
- [ ] Clear filters → everything returns.

### 5.5 Export

- [ ] Export to CSV (if button visible) → downloaded file opens, columns match the on-screen table.

---

## 6. Regression checks (things that should NOT have changed)

Quick sanity pass — these are adjacent areas that could have been nicked.

- [ ] Kravpunkter: check/uncheck a krav still toggles its `compliance_status` badge.
- [ ] Kravpunkter: linking a bevis file / styrdokument still works from the expanded row.
- [ ] Kravpunkter: the **Saknar bevis** amber badge still appears when `Kräver bevis` is on and no evidence is linked.
- [ ] Legal-document modal: **Visa fullständig lag** button still links to the full law page.
- [ ] Task modal: basic CRUD (create, edit title, change status, assign, delete) still works.
- [ ] Generella kommentarer rich-text editor: save, cancel, empty states behave as before.

---

## Sign-off

- [ ] All boxes above checked
- [ ] Any deviations documented in the PR
- [ ] Safe to merge

Tester: ________________  Date: ________________
