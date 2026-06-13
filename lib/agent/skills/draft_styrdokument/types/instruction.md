# Instruktion (work instruction)

An instruktion tells ONE performer exactly how to carry out ONE task safely and
correctly. Narrower than a rutin: one task, one role, step by step.

## Structure

1. **Uppgift och giltighet** — the task, where/what equipment it applies to, who may
   perform it (krav på behörighet/utbildning om sådana finns).
2. **Före arbetet** — preparations and safety checks (skyddsutrustning, avspärrning,
   frånkoppling).
3. **Utförande** — the steps in strict order (`orderedList`), one action per step.
4. **Efter arbetet** — återställning, kontroll, rapportering.
5. **Vid fel eller tillbud** — stop criteria and who to contact.

## Style

- **Imperative, directed at the performer: "utför", "kontrollera", "stäng av".**
  One action per step — no compound steps hiding a second action.
- Warnings BEFORE the step they concern, visually distinct ("**Varning:** …").
- No abstractions: name the actual equipment/system/plats.

## Criteria

- Steps are strictly sequential and individually verifiable as done.
- Safety-critical steps (frånkoppling, skyddsutrustning) come before the work
  steps that need them.
- Stop-/felkriterier are present (what aborts the task).
- Behörighetskrav stated when the task legally requires training or certification,
  with the legal ground cited (GR-001).
