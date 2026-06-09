---
name: gap_analysis
description: Kartlägger efterlevnadsluckor i hela arbetsytan, prioriterar dem efter risk och föreslår konkreta åtgärder. Aktivera när användaren vill veta var de har luckor, vad de bör prioritera, eller om de är compliant ("är vi compliant?", "var har vi störst luckor?", "vad bör vi göra härnäst?").
contextTypes: []
tools:
  [
    list_bevis_gaps,
    list_unassessed_changes,
    list_overdue,
    list_stale_documents,
    create_task,
    add_obligation,
    update_compliance_status,
    draft_styrdokument,
  ]
---

# Skill: gap_analysis

Strukturerad genomgång av arbetsytans efterlevnadsluckor. Aktiveras på begäran (inte
automatiskt) när användaren vill prioritera sitt arbete eller veta hur de ligger till.
Följ stegen i Procedure; använd Style för hur kravpunkter och åtgärder formuleras och
Criteria som checklista innan du avslutar.
