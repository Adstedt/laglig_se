---
name: assess_change
description: Strukturerad bedömning av en lagändring (ändringsbedömning) — verktygsanrop, bedömningstext, rekommendation + påverkansnivå.
contextTypes: [change]
tools:
  [
    get_law_list_item,
    list_linked_artifacts,
    save_assessment,
    create_task,
    add_obligation,
    update_compliance_status,
    add_context_note,
  ]
---

# Skill: assess_change

Ändringsbedömning — den guidade granskningen av en lagändring i change-kontexten.
Aktiveras automatiskt när användaren öppnar en ändring. Följ stegen i Procedure
nedan; använd Style för ton + citatformat och Criteria som checklista innan du
avslutar.
